"""Аккаунт (тикет 04 identity-organizations): запрос на удаление/обезличивание.

POST /account/deletion-request — создаёт pending-запрос, отзывает все сессии
(refresh-токены, MFA-челленджи), аудит account.deletion_requested.
Идемпотентность: повторный запрос при pending/processing — 200 с тем же
запросом; после completed — 409 (защитно: обезличенный пользователь больше
не аутентифицируется, 403 в get_current_user).
"""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.db.models import AuditTrailEntry, DeletionRequest
from app.schemas import DeletionRequestOut
from app.services.consent_service import create_deletion_request

router = APIRouter(prefix="/account", tags=["account"])


@router.post("/deletion-request", response_model=DeletionRequestOut)
async def request_deletion(db: DBSession, user: CurrentUser) -> DeletionRequestOut:
    """Запрос на удаление аккаунта: отзыв сессий + аудит, идемпотентно."""
    request, created = await create_deletion_request(db, user)
    if created:
        db.add(
            AuditTrailEntry(
                project_id=None,
                user_id=user.id,
                action="account.deletion_requested",
                details={"request_id": request.id, "requested_by": "self"},
            )
        )
    await db.commit()
    await db.refresh(request)
    return DeletionRequestOut(
        id=request.id,
        user_id=request.user_id,
        requested_at=request.requested_at.isoformat(),
        processed_at=request.processed_at.isoformat() if request.processed_at else None,
        state=request.state,
        requested_by=request.requested_by,
    )


@router.get("/deletion-request", response_model=DeletionRequestOut | None)
async def my_deletion_request(db: DBSession, user: CurrentUser) -> DeletionRequestOut | None:
    """Текущий статус запроса на удаление (для UI/проверок)."""
    request = await db.scalar(
        select(DeletionRequest).where(DeletionRequest.user_id == user.id)
    )
    if request is None:
        return None
    return DeletionRequestOut(
        id=request.id,
        user_id=request.user_id,
        requested_at=request.requested_at.isoformat(),
        processed_at=request.processed_at.isoformat() if request.processed_at else None,
        state=request.state,
        requested_by=request.requested_by,
    )
