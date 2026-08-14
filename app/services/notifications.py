"""Уведомления и outbox-доставка (тикет 12).

- `notify_user` — персональное уведомление + запись в outbox (project scope).
- `notify_managers` — общее событие для всех менеджеров (general scope).
- `claim_next_task` — атомарное взятие неназначенной задачи (FOR UPDATE SKIP
  LOCKED): только один менеджер из N получает задачу.
- Outbox пишется в той же транзакции, что и уведомление, — будущий Bitrix-
  adapter читает только подтверждённые записи (transactional outbox).
"""

from __future__ import annotations

from typing import Any, cast

from sqlalchemy import select, text

from app.core.deps import DBSession
from app.db.models import Notification, NotificationOutbox, User
from app.services.realtime_bus import get_bus


async def notify_user(
    db: DBSession,
    user_id: int,
    type_: str,
    title: str,
    payload: dict[str, Any] | None = None,
) -> Notification:
    """Персональное проектное событие: уведомление + outbox (project scope).

    После записи публикует realtime-событие в шину (Redis pub/sub при
    заданном REDIS_URL, иначе локальный in-process bus) — подключённый
    пользователь получает его по SSE. Публикация best-effort: уведомление
    уже сохранено в БД и не теряется при отсутствии подписчиков.
    """
    notification = Notification(
        user_id=user_id, type=type_, title=title, payload=payload or {}
    )
    db.add(notification)
    await db.flush()
    db.add(
        NotificationOutbox(
            notification_id=notification.id,
            target_scope="project",
            manager_id=user_id,
            status="delivered",
            payload=payload or {},
        )
    )
    await get_bus().publish(
        [user_id],
        {
            "id": notification.id,
            "type": type_,
            "title": title,
            "payload": payload or {},
        },
    )
    return notification


async def notify_managers(
    db: DBSession,
    type_: str,
    title: str,
    payload: dict[str, Any] | None = None,
) -> NotificationOutbox:
    """Общее событие для подключённых менеджеров: только outbox (general scope).

    Менеджер получает событие realtime (SSE) и/или атомарно забирает его
    как задачу — никто не дублируется, запись не теряется при закрытом браузере.
    """
    entry = NotificationOutbox(
        target_scope="general",
        status="pending",
        payload={"type": type_, "title": title, **(payload or {})},
    )
    db.add(entry)
    await db.flush()
    return entry


async def notify_news_published(
    db: DBSession, news_id: int, title: str
) -> int:
    """Уведомление о публикации новости всем активным пользователям (спека §3.6).

    Создаёт персональное ``Notification`` + outbox-запись (project scope,
    delivered) для каждого активного пользователя — «Новость: {title}» —
    и публикует realtime-событие (best-effort). Вызывается в той же
    транзакции, что и публикация (transactional outbox).
    """
    user_ids = (
        await db.execute(select(User.id).where(User.is_active.is_(True)))
    ).scalars().all()
    payload = {"news_id": news_id}
    for user_id in user_ids:
        notification = Notification(
            user_id=user_id,
            type="news_published",
            title=f"Новость: {title}",
            payload=payload,
        )
        db.add(notification)
        await db.flush()
        db.add(
            NotificationOutbox(
                notification_id=notification.id,
                target_scope="project",
                manager_id=user_id,
                status="delivered",
                payload=payload,
            )
        )
    await get_bus().publish(
        list(user_ids),
        {
            "type": "news_published",
            "title": f"Новость: {title}",
            "payload": payload,
        },
    )
    return len(user_ids)


async def claim_next_task(db: DBSession, manager_id: int) -> NotificationOutbox | None:
    """Атомарно забирает самую старую неназначенную общую задачу.

    FOR UPDATE SKIP LOCKED гарантирует, что при одновременных запросах двух
    менеджеров задачу получит ровно один.
    """
    row = (
        await db.execute(
            text(
                """
                UPDATE public.notification_outbox
                SET status = 'claimed', manager_id = :manager_id
                WHERE id = (
                    SELECT id FROM public.notification_outbox
                    WHERE target_scope = 'general' AND status = 'pending'
                    ORDER BY created_at, id
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id
                """
            ),
            {"manager_id": manager_id},
        )
    ).first()
    if row is None:
        return None
    return cast(
        NotificationOutbox | None,
        await db.scalar(
            select(NotificationOutbox).where(NotificationOutbox.id == row[0])
        ),
    )
