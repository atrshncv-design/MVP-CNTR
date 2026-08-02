from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.db.models import Organization, Technology
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
        select(Technology, Organization.name)
        .outerjoin(Organization, Technology.organization_id == Organization.id)
        .order_by(Technology.created_at.desc())
    )

    if status:
        stmt = stmt.where(Technology.status == status)
    if category:
        stmt = stmt.where(Technology.category == category)
    if min_level is not None:
        stmt = stmt.where(Technology.current_level >= min_level)
    if max_level is not None:
        stmt = stmt.where(Technology.current_level <= max_level)

    rows = await db.execute(stmt)
    return [
        TechnologyOut(
            id=tech.id,
            name=tech.name,
            description=tech.description,
            category=tech.category,
            status=tech.status,
            current_level=tech.current_level,
            target_level=tech.target_level,
            organization=org_name,
            created_by_name=None,
            created_at=tech.created_at.isoformat() if tech.created_at else None,
        )
        for tech, org_name in rows
    ]
