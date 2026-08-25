"""Каталог и витрина достижений (перенос со старой линии).

- ``GET /achievements/catalog`` — публичный каталог 66 медалей.
- ``GET /achievements/mine`` — персональная витрина авторизованного
  пользователя: выданные медали (что/когда/за какой проект/повторения)
  + прогресс до следующей ступени для пороговых медалей doc-*/m-*.
- ``GET /projects/{id}/achievements`` — командные медали проекта
  (участникам/менеджерам; анонимам — только для публичного проекта).
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.v1.projects import can_access_project, get_project_or_404
from app.core.deps import CurrentUser, CurrentUserOptional, DBSession, ReadDBSession
from app.db.models import Achievement, Project, ProjectAchievement, UserAchievement
from app.schemas import (
    AchievementCatalogOut,
    AchievementOut,
    AchievementProgressOut,
    ProjectAchievementOut,
    UserAchievementOut,
)

router = APIRouter(prefix="/achievements", tags=["achievements"])

# Группы пороговых ступеней, для которых витрина считает прогресс
# «N/порог следующей ступени»: документы и мета-медали.
PROGRESS_GROUPS = ("documents", "member")


def _achievement_out(a: Achievement) -> AchievementOut:
    """ORM Achievement → AchievementOut (хелпер-сериализатор)."""
    return AchievementOut(
        id=a.id,
        slug=a.slug,
        title=a.title,
        description=a.description,
        group=a.group,
        rarity=a.rarity,
        sector_slug=a.sector_slug,
        threshold=a.threshold,
        ugt_level=a.ugt_level,
        secret=a.secret,
        sort_order=a.sort_order,
        icon_key=a.icon_key,
    )


def _iso(dt: datetime | None) -> str | None:
    """datetime → ISO 8601 строка (витрина отдаёт строки, не ORM)."""
    return dt.isoformat() if dt is not None else None


@router.get("/catalog", response_model=list[AchievementCatalogOut])
async def achievements_catalog(db: ReadDBSession) -> list[AchievementCatalogOut]:
    """Публичный каталог достижений (спека §4.2), сортировка sort_order."""
    rows = (
        (
            await db.execute(
                select(Achievement).order_by(Achievement.sort_order, Achievement.id)
            )
        )
        .scalars()
        .all()
    )
    return [
        AchievementCatalogOut(
            id=a.id,
            slug=a.slug,
            title=a.title,
            description=a.description,
            group=a.group,
            rarity=a.rarity,
            sector_slug=a.sector_slug,
            threshold=a.threshold,
            ugt_level=a.ugt_level,
            secret=a.secret,
            sort_order=a.sort_order,
            icon_key=a.icon_key,
        )
        for a in rows
    ]


@router.get("/mine", response_model=list[UserAchievementOut])
async def achievements_mine(
    db: ReadDBSession,
    user: CurrentUser,
) -> list[UserAchievementOut]:
    """Персональная витрина (спека §4.6): медали + прогресс + история."""
    rows = (
        await db.execute(
            select(UserAchievement, Achievement, Project.name)
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .outerjoin(Project, UserAchievement.project_id == Project.id)
            .where(UserAchievement.user_id == user.id)
            .order_by(UserAchievement.awarded_at.desc(), UserAchievement.id.desc())
        )
    ).all()

    # Прогресс групп: пороговые ступени каталога и последний подтверждённый
    # порог по times выданных ступеней (doc-5 → times=5 и т.д.).
    catalog_rows = (
        (
            await db.execute(
                select(Achievement).order_by(Achievement.sort_order, Achievement.id)
            )
        )
        .scalars()
        .all()
    )
    steps_by_group: dict[str, list[Achievement]] = {}
    for a in catalog_rows:
        if a.group in PROGRESS_GROUPS and a.threshold is not None:
            steps_by_group.setdefault(a.group, []).append(a)
    for steps in steps_by_group.values():
        steps.sort(key=lambda s: s.threshold or 0)

    current_by_group: dict[str, int] = {}
    for ua, a, _project_name in rows:
        if a.group in steps_by_group and a.threshold is not None:
            current_by_group[a.group] = max(
                current_by_group.get(a.group, 0), ua.times
            )

    result: list[UserAchievementOut] = []
    for ua, a, project_name in rows:
        progress: AchievementProgressOut | None = None
        if a.group in steps_by_group and a.threshold is not None:
            current = current_by_group[a.group]
            next_step = next(
                (s for s in steps_by_group[a.group] if (s.threshold or 0) > current),
                None,
            )
            progress = AchievementProgressOut(
                current_count=current,
                next_threshold=next_step.threshold if next_step is not None else None,
            )
        result.append(
            UserAchievementOut(
                achievement=_achievement_out(a),
                times=ua.times,
                awarded_at=_iso(ua.awarded_at) or "",
                project_id=ua.project_id,
                project_name=project_name,
                progress=progress,
            )
        )
    return result


project_router = APIRouter(prefix="/projects", tags=["achievements"])


@project_router.get(
    "/{project_id}/achievements", response_model=list[ProjectAchievementOut]
)
async def project_achievements(
    project_id: int,
    db: DBSession,
    user: CurrentUserOptional,
) -> list[ProjectAchievementOut]:
    """Командные медали проекта («Достижения команды», спека §4.6).

    Анонимам медали видны только для публичного проекта (is_public=True);
    нарушителям — 404, чтобы не раскрывать существование закрытого проекта.
    """
    project = await get_project_or_404(db, project_id)
    if user is None:
        if not project.is_public:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    elif not await can_access_project(db, project, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")

    rows = (
        await db.execute(
            select(ProjectAchievement, Achievement)
            .join(Achievement, ProjectAchievement.achievement_id == Achievement.id)
            .where(ProjectAchievement.project_id == project_id)
            .order_by(
                ProjectAchievement.awarded_at.desc(), ProjectAchievement.id.desc()
            )
        )
    ).all()
    return [
        ProjectAchievementOut(
            achievement=_achievement_out(a),
            awarded_at=_iso(pa.awarded_at) or "",
        )
        for pa, a in rows
    ]
