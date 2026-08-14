"""Администрирование: глобальный append-only аудит (тикет 13) и аналитика
достижений (тикет 09, спека §4.7)."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, require_role
from app.db.models import AuditTrailEntry, User
from app.schemas import AdminAchievementsStatsOut, AuditTrailEntryOut
from app.services.achievements import achievement_stats

router = APIRouter(prefix="/admin", tags=["admin"])

AdminOnly = require_role("cntr_admin")


def _at_out(entry: AuditTrailEntry, user_name: str | None = None) -> AuditTrailEntryOut:
    return AuditTrailEntryOut(
        id=entry.id,
        project_id=entry.project_id,
        user_id=entry.user_id,
        user_name=user_name or "—",
        action=entry.action,
        details=entry.details or {},
        created_at=entry.created_at.isoformat() if entry.created_at else None,
    )


@router.get("/audit", response_model=list[AuditTrailEntryOut])
async def global_audit(
    db: DBSession,
    user: CurrentUser,
    project_id: int | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
) -> list[AuditTrailEntryOut]:
    """Глобальный аудит append-only: все события платформы (администратор).

    Записи не редактируются и не удаляются — только чтение; новые события
    дописываются бизнес-логикой (AuditTrailEntry в ассessment/manager/stages).
    """
    await AdminOnly(user)
    stmt = (
        select(AuditTrailEntry, User.full_name)
        .outerjoin(User, AuditTrailEntry.user_id == User.id)
        .order_by(AuditTrailEntry.id.desc())
        .limit(limit)
    )
    if project_id is not None:
        stmt = stmt.where(AuditTrailEntry.project_id == project_id)
    if action:
        stmt = stmt.where(AuditTrailEntry.action == action)
    rows = await db.execute(stmt)
    return [_at_out(entry, name) for entry, name in rows]


@router.get("/achievements/stats", response_model=AdminAchievementsStatsOut)
async def achievements_stats(
    db: DBSession,
    user: CurrentUser,
) -> AdminAchievementsStatsOut:
    """Аналитика достижений (спека §4.7, тикет 09), только cntr_admin.

    Срезы: динамика начислений по дням/неделям, распределения по группам и
    редкости, отраслевые срезы, топ-10 медалей, застрявшие проекты, среднее
    время проверки менеджеров. Пустая БД — нули и пустые списки без ошибок.
    """
    await AdminOnly(user)
    stats = await achievement_stats(db)
    return AdminAchievementsStatsOut(
        generated_at=datetime.now(UTC).isoformat(),
        **stats,
    )
