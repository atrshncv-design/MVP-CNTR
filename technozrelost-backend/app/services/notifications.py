"""Уведомления и outbox-доставка (тикет 12).

- `notify_user` — персональное уведомление + запись в outbox (project scope).
- `notify_managers` — общее событие для всех менеджеров (general scope).
- `claim_next_task` — атомарное взятие неназначенной задачи (FOR UPDATE SKIP
  LOCKED): только один менеджер из N получает задачу.
- Outbox пишется в той же транзакции, что и уведомление, — будущий Bitrix-
  adapter читает только подтверждённые записи (transactional outbox).
"""

from __future__ import annotations

import logging
from typing import Any, cast

from sqlalchemy import select, text

from app.core.deps import DBSession
from app.db.models import Notification, NotificationOutbox, User

logger = logging.getLogger(__name__)


async def notify_user(
    db: DBSession,
    user_id: int,
    type_: str,
    title: str,
    payload: dict[str, Any] | None = None,
) -> Notification:
    """Персональное проектное событие: уведомление + outbox (project scope)."""
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


async def notify_news_published(db: DBSession, news_id: int, title: str) -> int:
    """Публикация новости: уведомление «Новость: {title}» каждому активному.

    Каждому активному пользователю — Notification + outbox-запись (project
    scope, delivered) в той же транзакции (transactional outbox).
    P-15: батчами по 500 — одна транзакция, но flush батчами, чтобы тик
    не держал N записей в памяти и не блокировал пул при росте базы.
    Возвращает число созданных уведомлений.
    """
    rows = await db.execute(select(User.id).where(User.is_active.is_(True)))
    user_ids = list(rows.scalars().all())
    if not user_ids:
        return 0
    # P-15: батч 500 — баланс памяти/латентности для пилотной базы
    batch_size = 500
    total = 0
    for offset in range(0, len(user_ids), batch_size):
        # SPEC-07 P-15 observability: лог per batch для trace при росте базы
        logger.info(
            "notify_news_published batch %s: %s users (offset %s)",
            offset // batch_size,
            len(user_ids[offset : offset + batch_size]),
            offset,
        )
        batch = user_ids[offset : offset + batch_size]
        notifications = [
            Notification(
                user_id=uid,
                type="news_published",
                title=f"Новость: {title}",
                payload={"news_id": news_id, "title": title},
            )
            for uid in batch
        ]
        db.add_all(notifications)
        await db.flush()
        outboxes = [
            NotificationOutbox(
                notification_id=notification.id,
                target_scope="project",
                manager_id=notification.user_id,
                status="delivered",
                payload={"news_id": news_id, "title": title},
            )
            for notification in notifications
        ]
        db.add_all(outboxes)
        await db.flush()
        total += len(batch)
    return total
