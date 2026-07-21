from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.db.models import Project, ProjectMember, Role, User, user_roles_tbl
from app.schemas import ExecutorOut

EXECUTOR_ROLE_SLUGS = ["rd_executor", "scientific_org", "serial_manufacturer"]

router = APIRouter(prefix="/executors", tags=["executors"])


async def get_executors(db: DBSession) -> list[ExecutorOut]:
    role_subq = (
        select(
            user_roles_tbl.c.user_id,
            Role.slug.label("role_slug"),
            Role.name.label("role_name"),
        )
        .join(Role, user_roles_tbl.c.role_id == Role.id)
        .where(Role.slug.in_(EXECUTOR_ROLE_SLUGS))
        .subquery()
    )

    completed_subq = (
        select(
            ProjectMember.user_id,
            func.count(Project.id).label("cnt"),
        )
        .join(Project, ProjectMember.project_id == Project.id)
        .where(Project.status.in_(["completed", "active"]))
        .group_by(ProjectMember.user_id)
        .subquery()
    )

    stmt = (
        select(
            User.id,
            User.full_name,
            User.organization,
            role_subq.c.role_slug,
            role_subq.c.role_name,
            func.coalesce(completed_subq.c.cnt, 0).label("completed_projects"),
        )
        .join(role_subq, User.id == role_subq.c.user_id)
        .outerjoin(completed_subq, User.id == completed_subq.c.user_id)
        .where(User.is_active == True)  # noqa: E712
        .distinct(User.id)
        .order_by(User.full_name)
    )

    rows = await db.execute(stmt)
    return [
        ExecutorOut(
            id=row.id,
            full_name=row.full_name,
            organization=row.organization,
            role_slug=row.role_slug,
            role_name=row.role_name,
            completed_projects=int(row.completed_projects),
        )
        for row in rows
    ]


@router.get("", response_model=list[ExecutorOut])
async def list_executors(
    db: DBSession,
    user: CurrentUser,
    role: str | None = Query(None),
) -> list[ExecutorOut]:
    executors = await get_executors(db)
    if role:
        executors = [e for e in executors if e.role_slug == role]
    return executors
