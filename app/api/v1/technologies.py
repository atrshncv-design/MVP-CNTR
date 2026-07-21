from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.db.models import Project, User
from app.schemas import TechnologyOut

router = APIRouter(prefix="/technologies", tags=["technologies"])


@router.get("", response_model=list[TechnologyOut])
async def list_technologies(
    db: DBSession,
    user: CurrentUser,
    status: str | None = Query(None),
    category: str | None = Query(None),
    min_level: int | None = Query(None, ge=1, le=9),
    max_level: int | None = Query(None, ge=1, le=9),
) -> list[TechnologyOut]:
    stmt = (
        select(
            Project.id,
            Project.name,
            Project.description,
            Project.category,
            Project.status,
            Project.current_level,
            Project.target_level,
            Project.created_by,
            Project.created_at,
            User.full_name.label("creator_name"),
        )
        .outerjoin(User, Project.created_by == User.id)
        .order_by(Project.updated_at.desc())
    )

    if status:
        stmt = stmt.where(Project.status == status)
    if category:
        stmt = stmt.where(Project.category == category)
    if min_level is not None:
        stmt = stmt.where(Project.current_level >= min_level)
    if max_level is not None:
        stmt = stmt.where(Project.current_level <= max_level)

    rows = await db.execute(stmt)
    return [
        TechnologyOut(
            id=row.id,
            name=row.name,
            description=row.description,
            category=row.category,
            status=row.status,
            current_level=row.current_level,
            target_level=row.target_level,
            organization=None,
            created_by_name=row.creator_name,
            created_at=str(row.created_at) if row.created_at else None,
        )
        for row in rows
    ]
