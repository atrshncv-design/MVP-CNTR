from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.deps import CurrentUserOptional, DBSession, ReadDBSession
from app.db.models import (
    Organization,
    Project,
    ProjectMember,
    Role,
    User,
    UserProfile,
    user_roles_tbl,
)
from app.schemas import ExecutorOut

EXECUTOR_ROLE_SLUGS = ["rd_executor", "scientific_org", "serial_manufacturer"]
EXECUTOR_CATALOG_VIEWERS = (*EXECUTOR_ROLE_SLUGS, "gk_customer", "cntr_admin", "cntr_manager")

router = APIRouter(prefix="/executors", tags=["executors"])

# Организации из НИОКТР → роль в каталоге
ORG_ROLE_SLUG = {"scientific_org": "scientific_org"}
ORG_ROLE_DEFAULT = "rd_executor"
ORG_ROLE_NAMES = {
    "scientific_org": "Научная организация",
    "rd_executor": "R&D-исполнитель",
    "serial_manufacturer": "Серийный производитель",
}


async def _users_as_executors(db: DBSession) -> list[ExecutorOut]:
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
        .join(UserProfile, UserProfile.user_id == User.id)
        .where(User.is_active == True)  # noqa: E712
        # Только подтверждённые менеджером профили попадают в реестр (US 19).
        .where(UserProfile.state == "verified")
        # DISTINCT ON несовместим с ORDER BY по другому столбцу в PostgreSQL —
        # используем GROUP BY по всем выбранным столбцам.
        .group_by(
            User.id,
            User.full_name,
            User.organization,
            role_subq.c.role_slug,
            role_subq.c.role_name,
            completed_subq.c.cnt,
        )
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


async def _organizations_as_executors(db: DBSession) -> list[ExecutorOut]:
    stmt = select(Organization).order_by(Organization.projects_count.desc())
    rows = await db.execute(stmt)
    result: list[ExecutorOut] = []
    for org in rows.scalars().all():
        role_slug = ORG_ROLE_SLUG.get(org.org_type or "", ORG_ROLE_DEFAULT)
        # отрицательный id — организации не пересекаются с пользователями
        result.append(
            ExecutorOut(
                id=-org.id,
                full_name=org.short_name or org.name,
                organization=org.name,
                role_slug=role_slug,
                role_name=ORG_ROLE_NAMES[role_slug],
                competencies=list(org.competencies or []),
                completed_projects=org.projects_count,
            )
        )
    return result


@router.get("", response_model=list[ExecutorOut])
async def list_executors(
    db: ReadDBSession,
    user: CurrentUserOptional,
    role: str | None = Query(None),
    after_id: int | None = Query(None, description="Keyset курсор"),
    limit: int = Query(20, ge=1, le=100, description="Размер страницы"),
) -> list[ExecutorOut]:
    """Объединённый каталог исполнителей (совместимость)."""
    executors = await _users_as_executors(db)
    executors.extend(await _organizations_as_executors(db))
    if role:
        executors = [e for e in executors if e.role_slug == role]
    # P-08: keyset-пагинация (cursor) — защита от O(N) offset при 5К.
    if after_id is not None:
        try:
            idx = next(i for i, e in enumerate(executors) if e.id == after_id)
            executors = executors[idx + 1 :]
        except StopIteration:
            executors = [e for e in executors if e.id > after_id]
    return executors[:limit]


@router.get("/specialists", response_model=list[ExecutorOut])
async def list_specialists(
    db: ReadDBSession,
    user: CurrentUserOptional,
    role: str | None = Query(
        None, description="Роль: rd_executor | scientific_org | serial_manufacturer"
    ),
    org: str | None = Query(None, description="Подстрока организации"),
) -> list[ExecutorOut]:
    """Реестр специалистов: только verified-профили, отдельные фильтры (тикет 11)."""
    executors = await _users_as_executors(db)
    if role:
        executors = [e for e in executors if e.role_slug == role]
    if org:
        lowered = org.lower()
        executors = [
            e for e in executors if e.organization and lowered in e.organization.lower()
        ]
    return executors


@router.get("/organizations", response_model=list[ExecutorOut])
async def list_org_catalog(
    db: ReadDBSession,
    user: CurrentUserOptional,
    type: str | None = Query(None, description="Тип организации"),
    region: str | None = Query(None, description="Регион"),
) -> list[ExecutorOut]:
    """Реестр организаций: отдельные поля и фильтры (тикет 11)."""
    stmt = select(Organization).order_by(Organization.projects_count.desc())
    if type:
        stmt = stmt.where(Organization.org_type == type)
    if region:
        stmt = stmt.where(Organization.region == region)
    rows = await db.execute(stmt)
    result: list[ExecutorOut] = []
    for org in rows.scalars().all():
        role_slug = ORG_ROLE_SLUG.get(org.org_type or "", ORG_ROLE_DEFAULT)
        result.append(
            ExecutorOut(
                id=-org.id,
                full_name=org.short_name or org.name,
                organization=org.name,
                role_slug=role_slug,
                role_name=ORG_ROLE_NAMES[role_slug],
                competencies=list(org.competencies or []),
                completed_projects=org.projects_count,
            )
        )
    return result
