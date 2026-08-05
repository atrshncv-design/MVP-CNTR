"""Уведомления и outbox-доставка (тикет 12).

- `notify_user` — персональное уведомление + запись в outbox (project scope).
- `notify_managers` — общее событие для всех менеджеров (general scope).
- `claim_next_task` — атомарное взятие неназначенной задачи (FOR UPDATE SKIP
  LOCKED): только один менеджер из N получает задачу.
- Outbox пишется в той же транзакции, что и уведомление, — будущий Bitrix-
  adapter читает только подтверждённые записи (transactional outbox).
"""

from __future__ import annotations

from sqlalchemy import select, text

from app.core.deps import DBSession
from app.db.models import Notification, NotificationOutbox


async def notify_user(
    db: DBSession,
    user_id: int,
    type_: str,
    title: str,
    payload: dict | None = None,
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
    payload: dict | None = None,
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
    return await db.scalar(
        select(NotificationOutbox).where(NotificationOutbox.id == row[0])
    )
