from __future__ import annotations

import hashlib

from fastapi import APIRouter, Query, Request, Response
from fastapi import status as http_status
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.db.models import Organization, Technology
from app.schemas import TechnologyOut

router = APIRouter(prefix="/technologies", tags=["technologies"])


@router.get("", response_model=list[TechnologyOut])
async def list_technologies(
    request: Request,
    response: Response,
    db: DBSession,
    user: CurrentUser,
    status: str | None = Query(None),
    category: str | None = Query(None),
    min_level: int | None = Query(None, ge=1, le=9),
    max_level: int | None = Query(None, ge=1, le=9),
    limit: int = Query(  # noqa: E501
        50, ge=1, le=200, description="Размер страницы (M4 TICKET-09 per-page ETag)"
    ),
    offset: int = Query(0, ge=0, description="Смещение (M4 TICKET-09)"),
) -> list[TechnologyOut] | Response:
    """Список технологий (реестр), сортировка created_at DESC.

    L-06/P-09: ETag + Cache-Control 5 минут, Vary Accept-Encoding,
    private когда Authorization (аутентифицированный реестр), public иначе.
    """
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

    # M4 TICKET-09 (SPEC-05 I-02): per-page ETag — применяем limit/offset до md5
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    rows = result.all()
    # ETag per page: детерминирован по странице (уже rows страницы), Vary private
    etag_payload = "|".join(
        f"{tech.id}:{tech.registration_number or ''}:{tech.status}:"
        f"{tech.current_level}:{tech.target_level}:{tech.category or ''}:"
        f"{tech.created_at.isoformat() if tech.created_at else ''}"
        for tech, _ in rows
    )
    etag = f'W/"{hashlib.md5(etag_payload.encode()).hexdigest()}"'
    cache_control = (
        "private, max-age=300" if request.headers.get("authorization") else "public, max-age=300"
    )
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = cache_control
    response.headers["Vary"] = "Accept-Encoding"
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=http_status.HTTP_304_NOT_MODIFIED,
            headers={"ETag": etag, "Cache-Control": cache_control, "Vary": "Accept-Encoding"},
        )
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
