"""In-app уведомления (тикет 22): лента для текущего пользователя."""

from __future__ import annotations

from fastapi import APIRouter, Request
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.errors import raise_error
from app.db.models import Notification
from app.schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        type=n.type,
        title=n.title,
        payload=n.payload or {},
        is_read=n.is_read,
        created_at=n.created_at.isoformat() if n.created_at else None,
    )


@router.get("", response_model=list[NotificationOut])
async def my_notifications(db: DBSession, user: CurrentUser) -> list[NotificationOut]:
    rows = (
        (
            await db.execute(
                select(Notification)
                .where(Notification.user_id == user.id)
                .order_by(Notification.created_at.desc(), Notification.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return [_out(n) for n in rows]


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: int, request: Request, db: DBSession, user: CurrentUser
) -> NotificationOut:
    note = await db.get(Notification, notification_id)
    if note is None or note.user_id != user.id:
        raise raise_error("NOTIFICATION_NOT_FOUND", request=request)
    note.is_read = True
    await db.commit()
    await db.refresh(note)
    return _out(note)
