"""Наградчики достижений (тикет 02, спека §4.3; тикет 06 — полный каталог).

Автоматическое начисление медалей по подтверждённым событиям. Все функции
асинхронные, принимают сессию БД и параметры события; вызываются из хуков
существующих флоу (assessments.create_assessment, stages._trigger_application,
manager.decide_draft/decide_promotion, files.upload_project_file,
document_generator.generate_document, projects.decide_control_point).

Правила:
- Медаль существует в каталоге (achievements) → иначе событие молча
  пропускается (каталог мог быть не посеян).
- Дедупликация: запись (user_id, achievement_id) уже существует → повторно
  не выдаём (UNIQUE (user_id, achievement_id, event_ref) защищает от гонок
  «одна медаль за одно событие»; т.к. PostgreSQL считает NULL-значения
  event_ref различными, логическую проверку выполняет сервис).
- `times` для ступеней хранит значение порога (doc-5 → times=5).
- Команда проекта = активные участники ProjectMember (status='active') на
  момент события.
- Уведомление каждой новой медали — notify_user (персональное + outbox).
- get_db НЕ коммитит: наградчики делают flush, коммит выполняет вызывающий
  эндпоинт (или тест).

Отзыв: revoke_for_event удаляет user_achievements по event_ref и командные
project_achievements для тех же (project_id, achievement_id). Наградчики не
коммитят — отзыв и начисление атомарны с событием в транзакции вызывающего.

Честность недостижимого (тикет 06, аудит 2026-09-17):
- q-leap: скачок N→N+2 невозможен в decide_promotion (строго N→N+1), поэтому
  засчитывается первичное подтверждение сразу на УГТ 2+ (скачок 0→L) в
  award_draft_approved; проверка _q_leap оставлена для будущих флоу.
- proj-collector: требует ≥2 типов документов в проекте; второй тип дают
  /files (doc_type='file') и /generate (tz/passport/teo) — хуки выдачи
  стоят во всех трёх точках загрузки, stages пишет только 'stage'.
- ugt-1/ugt-2: decide_promotion подтверждает только 3+, поэтому первичное
  подтверждение на уровень L засчитывает уровни 1..L (анкета покрывает все
  уровни до заявленного) — через award_draft_approved и автоконфирм в
  award_project_created.
- s-legend: 100+ уникальных медалей при 66 слагов в каталоге недостижимо;
  легенда = собраны все открытые (несекретные) медали каталога.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Achievement,
    AuditTrailEntry,
    ControlPoint,
    OrganizationMember,
    Project,
    ProjectAchievement,
    ProjectDocument,
    ProjectMember,
    PromotionRequest,
    User,
    UserAchievement,
    UserOrganization,
)
from app.services.notifications import notify_user

# Ступени документов: порог → slug медали (catalog-66.md, group documents).
DOC_STEPS: list[tuple[int, str]] = [
    (5, "doc-5"),
    (10, "doc-10"),
    (25, "doc-25"),
    (50, "doc-50"),
    (100, "doc-100"),
]

# Ступени мета-медалей: число медалей → slug (catalog-66.md, group member).
META_STEPS: list[tuple[int, str]] = [
    (5, "m-5-medals"),
    (15, "m-15-medals"),
    (30, "m-30-medals"),
]

# Порог q-sprint: интервал между подтверждениями соседних уровней меньше
# 30 суток считается «спринтом». Порог выбран как разумный для платформы:
# цикл подтверждения уровня в среднем занимает 1–3 месяца, быстрее 30 дней —
# высокая скорость. Документированное решение (тикет 02).
UGT_SPRINT_DELTA = timedelta(days=30)

# Категория проекта (Project.category, свободная строка) → sector_slug
# каталога. Принимаются и русские наименования, и англ. слаги (нормализация:
# strip + lower).
SECTOR_CATEGORY_MAP: dict[str, str] = {
    "сельское хозяйство": "agriculture",
    "agriculture": "agriculture",
    "нефтедобыча": "oil",
    "oil": "oil",
    "машиностроение": "machinery",
    "machinery": "machinery",
    "it/цифровые платформы": "it",
    "цифровые платформы": "it",
    "it": "it",
    "медицина": "medicine",
    "medicine": "medicine",
    "энергетика": "energy",
    "energy": "energy",
    "транспорт": "transport",
    "transport": "transport",
}

# sector_slug → slug медали (catalog-66.md, group sector).
SECTOR_MEDAL_MAP: dict[str, str] = {
    "agriculture": "sector-agri",
    "oil": "sector-oil",
    "machinery": "sector-machinery",
    "it": "sector-it",
    "medicine": "sector-medicine",
    "energy": "sector-energy",
    "transport": "sector-transport",
}

# ─── Пороги честности (тикет 06) ────────────────────────────────────────────
# q-fast-start: первый принятый документ в первые дни жизни проекта.
FAST_START_DAYS = 7
# q-marathon: проект в работе дольше года.
MARATHON_DAYS = 365
# role-fast-check: решение менеджера быстрее трёх суток.
FAST_CHECK_DAYS = 3
# s-comet: полный путь 1→9 быстрее года — «рекордное время».
COMET_DAYS = 365

# Ступени верификаций менеджера: число подтверждений → slug (group role).
ROLE_VERIFY_STEPS: list[tuple[int, str]] = [
    (1, "role-verify-1"),
    (10, "role-verify-10"),
    (50, "role-verify-50"),
]

# Ступени экспертиз: число решений по контрольным точкам → slug (group role).
ROLE_EXPERT_STEPS: list[tuple[int, str]] = [
    (1, "role-expert-1"),
    (25, "role-expert-25"),
]

# Вехи проекта: уровень УГТ → slug медали (group project).
PROJ_MILESTONES: dict[int, str] = {
    3: "proj-ugt3",
    4: "proj-ugt4",
    6: "proj-ugt6",
    7: "proj-ugt7",
    8: "proj-ugt8",
}

# Все УГТ-медали (полный путь 1→9 для proj-ugt9 / s-epic-collection).
UGT_SLUGS: list[str] = [f"ugt-{level}" for level in range(1, 10)]

# Карта покрытия каталога триггерами (тикет 06, критерий «слаги каталога минус
# слаги с триггерами — пусто»): slug → кодовый путь получения. Тест
# test_every_catalog_slug_has_trigger сверяет полноту со seed-каталогом.
SLUG_TRIGGERS: dict[str, str] = {
    # ugt: первичное подтверждение засчитывает 1..L, далее N→N+1
    "ugt-1": "award_draft_approved:1..L | award_project_created:auto_confirmed",
    "ugt-2": "award_draft_approved:1..L | award_project_created:auto_confirmed",
    "ugt-3": "award_ugt:level",
    "ugt-4": "award_ugt:level",
    "ugt-5": "award_ugt:level",
    "ugt-6": "award_ugt:level",
    "ugt-7": "award_ugt:level",
    "ugt-8": "award_ugt:level",
    "ugt-9": "award_ugt:level",
    # documents: принятый документ (stages/files/generate)
    "doc-first": "award_document:accepted",
    "doc-5": "award_document:steps",
    "doc-10": "award_document:steps",
    "doc-25": "award_document:steps",
    "doc-50": "award_document:steps",
    "doc-100": "award_document:steps",
    # project: вехи жизненного цикла
    "proj-first": "award_project_created:first-by-creator",
    "proj-first-request": "award_first_request:attempt-1",
    "proj-ugt3": "award_ugt:milestone",
    "proj-ugt4": "award_ugt:milestone",
    "proj-ugt6": "award_ugt:milestone",
    "proj-ugt7": "award_ugt:milestone",
    "proj-ugt8": "award_ugt:milestone",
    "proj-ugt9": "award_ugt:full-path-1..9",
    "proj-collector": "award_document:multi-type(stage+file+tz/passport/teo)",
    "proj-3-sectors": "award_ugt:team-breadth-3plus",
    # quality: проверки прохождения
    "q-clean": "award_ugt:no-rejections-to-4",
    "q-first-try": "award_ugt:no-rejections-for-level",
    "q-leap": "award_draft_approved:leap-0-to-L",
    "q-sprint": "award_ugt:level-interval-lt-30d",
    "q-marathon": "award_ugt:project-age-gt-1y",
    "q-comeback": "award_ugt:rejection-then-7plus",
    "q-perfect-set": "award_ugt:no-rework-all-docs-v1",
    "q-fast-start": "award_document:first-doc-within-7d",
    # sector: отрасль проекта + межотраслевость команды
    "sector-agri": "award_ugt:sector | award_draft_approved",
    "sector-oil": "award_ugt:sector | award_draft_approved",
    "sector-machinery": "award_ugt:sector | award_draft_approved",
    "sector-it": "award_ugt:sector | award_draft_approved",
    "sector-medicine": "award_ugt:sector | award_draft_approved",
    "sector-energy": "award_ugt:sector | award_draft_approved",
    "sector-transport": "award_ugt:sector | award_draft_approved",
    "sector-polyglot": "award_ugt:team-breadth-3plus",
    # role: действия менеджеров/экспертов
    "role-verify-1": "award_role_verify:manager-decision",
    "role-verify-10": "award_role_verify:manager-decision",
    "role-verify-50": "award_role_verify:manager-decision",
    "role-expert-1": "award_expert_check:control-point-decision",
    "role-expert-25": "award_expert_check:control-point-decision",
    "role-mentor": "award_ugt:creator-at-4plus",
    "role-fast-check": "decide_promotion:decision-lt-3d",
    # member: персональные мета-медали
    "m-first-medal": "award_meta:first",
    "m-5-medals": "award_meta:steps",
    "m-15-medals": "award_meta:steps",
    "m-30-medals": "award_meta:steps",
    "m-3-projects": "award_meta:distinct-projects",
    "m-longhaul": "award_ugt:member-holds-ugt1-and-4plus",
    "m-5-projects": "award_meta:distinct-projects",
    # organization: достижения организации участника
    "org-first": "award_organization:first-project",
    "org-5-projects": "award_organization:5-projects",
    "org-3-sectors": "award_organization:3-sectors",
    "org-10-docs": "award_organization:10-docs",
    "org-ugt6": "award_organization:project-at-6plus",
    # secret: скрыты из публичного каталога, выдаются на общих событиях
    "s-ghost": "award_ugt:full-path-no-rejections",
    "s-comet": "award_ugt:full-path-under-1y",
    "s-pioneer": "award_project_created:first-in-sector",
    "s-phoenix": "award_ugt:2plus-rejections-then-7plus",
    "s-epic-collection": "award_meta:holds-ugt-1..9",
    "s-legend": "award_meta:holds-all-open-medals",
}


async def _get_achievement(db: AsyncSession, slug: str) -> Achievement | None:
    """Медаль каталога по slug; None — каталог не содержит (событие молча пропускается)."""
    return cast(
        Achievement | None,
        await db.scalar(select(Achievement).where(Achievement.slug == slug)),
    )


async def _active_member_ids(db: AsyncSession, project_id: int) -> list[int]:
    """Активные участники проекта на момент события (спека §4.1)."""
    rows = await db.execute(
        select(ProjectMember.user_id).where(
            ProjectMember.project_id == project_id,
            ProjectMember.status == "active",
        )
    )
    return list(rows.scalars().all())


async def _user_id(user: User | int) -> int:
    return user.id if isinstance(user, User) else user


async def _award(
    db: AsyncSession,
    user_id: int,
    achievement: Achievement,
    *,
    project_id: int | None = None,
    event_ref: str | None = None,
    times: int = 1,
    run_meta: bool = True,
) -> UserAchievement | None:
    """Выдать персональную медаль (дедупликация по user_id + achievement_id).

    Возвращает созданную запись или None, если медаль уже выдана.
    Уведомляет пользователя и запускает оценку мета-медалей (run_meta=False —
    внутри award_meta, чтобы не рекурсировать).
    """
    existing = await db.scalar(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == achievement.id,
        )
    )
    if existing is not None:
        return None
    row = UserAchievement(
        user_id=user_id,
        achievement_id=achievement.id,
        project_id=project_id,
        event_ref=event_ref,
        times=times,
    )
    db.add(row)
    await db.flush()
    await notify_user(
        db,
        user_id,
        "achievement.awarded",
        f"Новая медаль: {achievement.title}",
        {
            "achievement_id": achievement.id,
            "slug": achievement.slug,
            "title": achievement.title,
            "project_id": project_id,
        },
    )
    if run_meta:
        await award_meta(db, user_id)
    return row


async def _award_project(
    db: AsyncSession,
    project_id: int,
    achievement: Achievement,
    *,
    event_ref: str | None = None,  # noqa: ARG002 — симметрия интерфейса; хранится в user_achievements
) -> ProjectAchievement | None:
    """Командная медаль проекта (дедупликация по project_id + achievement_id)."""
    existing = await db.scalar(
        select(ProjectAchievement).where(
            ProjectAchievement.project_id == project_id,
            ProjectAchievement.achievement_id == achievement.id,
        )
    )
    if existing is not None:
        return None
    row = ProjectAchievement(project_id=project_id, achievement_id=achievement.id)
    db.add(row)
    await db.flush()
    return row


async def _award_team(
    db: AsyncSession,
    project_id: int,
    slug: str,
    *,
    event_ref: str,
    times: int = 1,
) -> str | None:
    """Командная медаль: project_achievements + всем активным участникам.

    Возвращает slug, если командная медаль выдана (новая), иначе None.
    Мета-медали участников оцениваются автоматически внутри _award.
    """
    achievement = await _get_achievement(db, slug)
    if achievement is None:
        return None
    project_row = await _award_project(db, project_id, achievement, event_ref=event_ref)
    for member_id in await _active_member_ids(db, project_id):
        await _award(
            db,
            member_id,
            achievement,
            project_id=project_id,
            event_ref=event_ref,
            times=times,
        )
    return slug if project_row is not None else None


async def _award_personal(
    db: AsyncSession,
    user_id: int,
    slug: str,
    *,
    project_id: int | None = None,
    event_ref: str | None = None,
    times: int = 1,
) -> str | None:
    """Персональная медаль по slug; возвращает slug при новом награждении."""
    achievement = await _get_achievement(db, slug)
    if achievement is None:
        return None
    row = await _award(
        db,
        user_id,
        achievement,
        project_id=project_id,
        event_ref=event_ref,
        times=times,
    )
    return slug if row is not None else None


def _ensure_aware(value: datetime) -> datetime:
    """Naive datetime из БД считаем UTC, чтобы вычитания не падали."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _sector_of(project: Project) -> str | None:
    """Отраслевой slug проекта по свободной строке category."""
    return SECTOR_CATEGORY_MAP.get((project.category or "").strip().lower())


async def _user_slugs(db: AsyncSession, user_id: int) -> set[str]:
    """Слаги персональных медалей пользователя."""
    rows = await db.execute(
        select(Achievement.slug)
        .join(UserAchievement, UserAchievement.achievement_id == Achievement.id)
        .where(UserAchievement.user_id == user_id)
    )
    return set(rows.scalars().all())


async def _member_project_ids(db: AsyncSession, member_ids: list[int]) -> set[int]:
    """Проекты людей: созданные ими или с их активным участием."""
    ids: set[int] = set()
    if not member_ids:
        return ids
    for row in await db.execute(
        select(ProjectMember.project_id).where(
            ProjectMember.user_id.in_(member_ids),
            ProjectMember.status == "active",
        )
    ):
        ids.add(int(row[0]))
    for row in await db.execute(
        select(Project.id).where(Project.created_by.in_(member_ids))
    ):
        ids.add(int(row[0]))
    return ids


async def _sectors_of_projects(db: AsyncSession, project_ids: set[int]) -> set[str]:
    """Отраслевые слаги набора проектов (категории маппятся в Python)."""
    if not project_ids:
        return set()
    rows = await db.execute(
        select(Project.category).where(Project.id.in_(sorted(project_ids)))
    )
    out: set[str] = set()
    for (category,) in rows.all():
        slug = SECTOR_CATEGORY_MAP.get((category or "").strip().lower())
        if slug is not None:
            out.add(slug)
    return out


async def _accepted_doc_keys(
    db: AsyncSession, project_ids: set[int]
) -> set[tuple[int, str]]:
    """Принятые документы набора проектов (пары project_id + title, без версий).

    «Принят» = clean-файл либо legacy-текст без storage_key — та же логика,
    что в _accepted_doc_count.
    """
    if not project_ids:
        return set()
    rows = (
        await db.execute(
            select(ProjectDocument.project_id, ProjectDocument.title)
            .where(
                ProjectDocument.project_id.in_(sorted(project_ids)),
                (ProjectDocument.storage_key.is_(None))
                | (ProjectDocument.scan_status == "clean"),
            )
            .distinct()
        )
    ).all()
    return {(int(pid), str(title)) for pid, title in rows}


async def _rejected_count(db: AsyncSession, project_id: int) -> int:
    """Число отклонённых заявок на повышение УГТ проекта."""
    return int(
        await db.scalar(
            select(func.count(PromotionRequest.id)).where(
                PromotionRequest.project_id == project_id,
                PromotionRequest.status == "rejected",
            )
        )
        or 0
    )


async def _project_has_full_path(db: AsyncSession, project_id: int) -> bool:
    """Полный путь 1→9: у проекта есть все 9 командных УГТ-медалей."""
    rows = await db.execute(
        select(Achievement.slug)
        .join(
            ProjectAchievement,
            ProjectAchievement.achievement_id == Achievement.id,
        )
        .where(ProjectAchievement.project_id == project_id)
    )
    return set(UGT_SLUGS) <= set(rows.scalars().all())


async def _user_org_ids(db: AsyncSession, user_id: int) -> list[int]:
    """Организации пользователя (user_organizations через членство)."""
    rows = await db.execute(
        select(OrganizationMember.organization_id).where(
            OrganizationMember.user_id == user_id
        )
    )
    return [int(v) for v in rows.scalars().all()]


async def _org_member_ids(db: AsyncSession, org_id: int) -> list[int]:
    """Все члены организации."""
    rows = await db.execute(
        select(OrganizationMember.user_id).where(
            OrganizationMember.organization_id == org_id
        )
    )
    return [int(v) for v in rows.scalars().all()]


async def _accepted_doc_count(db: AsyncSession, project_id: int, user_id: int) -> int:
    """Число принятых документов пользователя в проекте (уникальные названия).

    «Принят» = clean-файл либо legacy-текст без storage_key (та же логика,
    что в _stage_reqs_with_status). Повторные версии одного документа
    (одинаковый title) считаются один раз.
    """
    count = await db.scalar(
        select(func.count(func.distinct(ProjectDocument.title))).where(
            ProjectDocument.project_id == project_id,
            ProjectDocument.uploaded_by == user_id,
            (ProjectDocument.storage_key.is_(None))
            | (ProjectDocument.scan_status == "clean"),
        )
    )
    return int(count or 0)


async def _user_accepted_types(db: AsyncSession, project_id: int, user_id: int) -> set[str]:
    """Типы документов, по которым у пользователя есть принятые документы."""
    rows = await db.execute(
        select(ProjectDocument.doc_type)
        .where(
            ProjectDocument.project_id == project_id,
            ProjectDocument.uploaded_by == user_id,
            (ProjectDocument.storage_key.is_(None))
            | (ProjectDocument.scan_status == "clean"),
        )
        .distinct()
    )
    return set(rows.scalars().all())


async def _project_doc_types(db: AsyncSession, project_id: int) -> set[str]:
    """Все типы документов проекта (любые версии/статусы)."""
    rows = await db.execute(
        select(ProjectDocument.doc_type)
        .where(ProjectDocument.project_id == project_id)
        .distinct()
    )
    return set(rows.scalars().all())


# ─── Наградчики событий ─────────────────────────────────────────────────────


async def award_document(
    db: AsyncSession, project: Project, user: User | int, doc_type: str
) -> dict[str, Any]:
    """Документ принят → персональные медали (спека §4.3.1).

    - doc-first — первый принятый документ пользователя в проекте;
    - doc-5..doc-100 — ступени по числу принятых документов (times = порог);
    - proj-collector — «Коллекционер»: у пользователя есть принятые документы
      всех типов, представленных в проекте (требуется ≥2 типов; второй тип
      дают /files 'file' и /generate 'tz/passport/teo' — хуки стоят во всех
      трёх точках загрузки, stages пишет только 'stage');
    - q-fast-start — первый принятый документ в первые FAST_START_DAYS дней
      жизни проекта (командная).
    После документных медалей обновляются орг-счётчики (org-10-docs и др.).
    """
    user_id = await _user_id(user)
    awarded: list[str] = []
    count = await _accepted_doc_count(db, project.id, user_id)
    if count <= 0:
        return {"doc_type": doc_type, "awarded": awarded}

    first = await _get_achievement(db, "doc-first")
    if first is not None and await _award(db, user_id, first, project_id=project.id):
        awarded.append("doc-first")

    for threshold, slug in DOC_STEPS:
        if count >= threshold:
            achievement = await _get_achievement(db, slug)
            if achievement is not None and await _award(
                db, user_id, achievement, project_id=project.id, times=threshold
            ):
                awarded.append(slug)

    project_types = await _project_doc_types(db, project.id)
    if len(project_types) >= 2:
        user_types = await _user_accepted_types(db, project.id, user_id)
        if project_types.issubset(user_types):
            collector = await _get_achievement(db, "proj-collector")
            if collector is not None and await _award(
                db, user_id, collector, project_id=project.id
            ):
                awarded.append("proj-collector")

    if project.created_at is not None and _ensure_aware(
        datetime.now(UTC)
    ) - _ensure_aware(project.created_at) <= timedelta(days=FAST_START_DAYS):
        medal = await _award_team(
            db,
            project.id,
            "q-fast-start",
            event_ref=f"project:{project.id}:fast-start",
        )
        if medal:
            awarded.append(medal)

    org = await award_organization(db, user_id, project)
    awarded.extend(org["awarded"])

    return {"doc_type": doc_type, "awarded": awarded}


async def _q_first_try(db: AsyncSession, project_id: int, level: int) -> bool:
    """q-first-try: нет отклонённых заявок на этот уровень."""
    rejected = await db.scalar(
        select(func.count(PromotionRequest.id)).where(
            PromotionRequest.project_id == project_id,
            PromotionRequest.to_level == level,
            PromotionRequest.status == "rejected",
        )
    )
    return int(rejected or 0) == 0


async def _q_leap(db: AsyncSession, project_id: int) -> bool:
    """q-leap: подтверждён переход на 2+ уровня за один цикл (по promotion_requests).

    В decide_promotion разрешён только N→N+1, поэтому достижимый путь рывка —
    первичное подтверждение сразу на УГТ 2+ (скачок 0→L), его выдаёт
    award_draft_approved. Проверка по заявкам оставлена для будущих флоу
    (например, первичное подтверждение выше заявленного).
    """
    leap = await db.scalar(
        select(func.count(PromotionRequest.id)).where(
            PromotionRequest.project_id == project_id,
            PromotionRequest.status == "approved",
            PromotionRequest.to_level - PromotionRequest.from_level >= 2,
        )
    )
    return int(leap or 0) > 0


async def _q_clean(db: AsyncSession, project_id: int) -> bool:
    """q-clean: нет возвратов (отклонённых заявок) до УГТ 4."""
    rejected = await db.scalar(
        select(func.count(PromotionRequest.id)).where(
            PromotionRequest.project_id == project_id,
            PromotionRequest.status == "rejected",
            PromotionRequest.to_level <= 4,
        )
    )
    return int(rejected or 0) == 0


async def _q_sprint(db: AsyncSession, project_id: int, level: int) -> bool:
    """q-sprint: интервал между подтверждениями соседних уровней < 30 суток.

    Сравниваются created_at последнего подтверждённого запроса уровня N и
    последнего подтверждённого запроса уровня N−1.
    """
    current = cast(
        PromotionRequest | None,
        await db.scalar(
            select(PromotionRequest)
            .where(
                PromotionRequest.project_id == project_id,
                PromotionRequest.to_level == level,
                PromotionRequest.status == "approved",
            )
            .order_by(PromotionRequest.id.desc())
            .limit(1)
        ),
    )
    if current is None or current.created_at is None:
        return False
    previous = cast(
        PromotionRequest | None,
        await db.scalar(
            select(PromotionRequest)
            .where(
                PromotionRequest.project_id == project_id,
                PromotionRequest.to_level == level - 1,
                PromotionRequest.status == "approved",
            )
            .order_by(PromotionRequest.id.desc())
            .limit(1)
        ),
    )
    if previous is None or previous.created_at is None:
        return False
    interval = current.created_at - previous.created_at
    return interval < UGT_SPRINT_DELTA


async def award_ugt(db: AsyncSession, project: Project, level: int) -> dict[str, Any]:
    """УГТ подтверждён → командные медали (спека §4.3.2 + тикет 06).

    - ugt-N — вся команда проекта на момент события (project_achievements +
      user_achievements участников с project_id);
    - sector-* — отраслевая медаль по Project.category;
    - q-first-try / q-leap / q-clean / q-sprint — проверки качества прохождения;
    - proj-ugt3/4/6/7/8 — вехи проекта; proj-ugt9 + s-ghost + s-comet — при
      замыкании полного пути 1→9 (все 9 командных УГТ-медалей);
    - proj-3-sectors + sector-polyglot — команда ведёт проекты в 3+ отраслях;
    - q-marathon — проекту больше MARATHON_DAYS дней (свой event_ref);
    - q-comeback / s-phoenix — уровень 7+ после 1+ / 2+ отказов (отклонённых
      заявок; отклонение заявки — выводимый в API аналог отката);
    - q-perfect-set — ни одного возврата и все документы проекта в версии 1;
    - role-mentor — создателю проекта при достижении УГТ 4+;
    - m-longhaul — участникам, держащим ugt-1 и текущий ugt-N (4+);
    - s-pioneer — первый проект платформы в отрасли (запасной путь, основной —
      award_project_created);
    - орг-медали членов команды — через award_ общих событием.
    Все проверки идемпотентны: повторное подтверждение уровня не дублирует
    записи (дедупликация по user+achievement / project+achievement).
    """
    awarded: list[str] = []
    event_ref = f"ugt:{project.id}:{level}"

    ugt = await _award_team(db, project.id, f"ugt-{level}", event_ref=event_ref)
    if ugt:
        awarded.append(ugt)

    sector_slug = _sector_of(project)
    if sector_slug is not None:
        sector = await _award_team(
            db,
            project.id,
            SECTOR_MEDAL_MAP[sector_slug],
            event_ref=event_ref,
        )
        if sector:
            awarded.append(sector)

    if await _q_first_try(db, project.id, level):
        medal = await _award_team(db, project.id, "q-first-try", event_ref=event_ref)
        if medal:
            awarded.append(medal)

    if await _q_leap(db, project.id):
        medal = await _award_team(db, project.id, "q-leap", event_ref=event_ref)
        if medal:
            awarded.append(medal)

    if level >= 4 and await _q_clean(db, project.id):
        medal = await _award_team(db, project.id, "q-clean", event_ref=event_ref)
        if medal:
            awarded.append(medal)

    if await _q_sprint(db, project.id, level):
        medal = await _award_team(db, project.id, "q-sprint", event_ref=event_ref)
        if medal:
            awarded.append(medal)

    milestone = PROJ_MILESTONES.get(level)
    if milestone is not None:
        medal = await _award_team(db, project.id, milestone, event_ref=event_ref)
        if medal:
            awarded.append(medal)

    if await _project_has_full_path(db, project.id):
        medal = await _award_team(db, project.id, "proj-ugt9", event_ref=event_ref)
        if medal:
            awarded.append(medal)
        if await _rejected_count(db, project.id) == 0:
            medal = await _award_team(db, project.id, "s-ghost", event_ref=event_ref)
            if medal:
                awarded.append(medal)
        if project.created_at is not None and _ensure_aware(
            datetime.now(UTC)
        ) - _ensure_aware(project.created_at) <= timedelta(days=COMET_DAYS):
            medal = await _award_team(db, project.id, "s-comet", event_ref=event_ref)
            if medal:
                awarded.append(medal)

    member_ids = await _active_member_ids(db, project.id)
    breadth = await _sectors_of_projects(
        db, await _member_project_ids(db, member_ids)
    )
    if len(breadth) >= 3:
        for slug in ("proj-3-sectors", "sector-polyglot"):
            medal = await _award_team(db, project.id, slug, event_ref=event_ref)
            if medal:
                awarded.append(medal)

    if project.created_at is not None and _ensure_aware(
        datetime.now(UTC)
    ) - _ensure_aware(project.created_at) > timedelta(days=MARATHON_DAYS):
        medal = await _award_team(
            db,
            project.id,
            "q-marathon",
            event_ref=f"project:{project.id}:marathon",
        )
        if medal:
            awarded.append(medal)

    rejected = await _rejected_count(db, project.id)
    if level >= 7 and rejected >= 1:
        medal = await _award_team(db, project.id, "q-comeback", event_ref=event_ref)
        if medal:
            awarded.append(medal)
        if rejected >= 2:
            medal = await _award_team(db, project.id, "s-phoenix", event_ref=event_ref)
            if medal:
                awarded.append(medal)

    if rejected == 0:
        versions = (
            await db.execute(
                select(ProjectDocument.version).where(
                    ProjectDocument.project_id == project.id
                )
            )
        ).scalars().all()
        if versions and all(int(v) == 1 for v in versions):
            medal = await _award_team(
                db, project.id, "q-perfect-set", event_ref=event_ref
            )
            if medal:
                awarded.append(medal)

    if level >= 4:
        if project.created_by is not None:
            medal = await _award_personal(
                db,
                project.created_by,
                "role-mentor",
                project_id=project.id,
                event_ref=event_ref,
            )
            if medal:
                awarded.append(medal)
        for member_id in member_ids:
            slugs = await _user_slugs(db, member_id)
            if "ugt-1" in slugs and f"ugt-{level}" in slugs:
                medal = await _award_personal(
                    db,
                    member_id,
                    "m-longhaul",
                    project_id=project.id,
                    event_ref=event_ref,
                )
                if medal:
                    awarded.append(medal)

    if sector_slug is not None:
        rows = await db.execute(
            select(Project.category).where(Project.id != project.id)
        )
        other = {
            SECTOR_CATEGORY_MAP.get((c or "").strip().lower()) for (c,) in rows.all()
        }
        if sector_slug not in other:
            medal = await _award_team(db, project.id, "s-pioneer", event_ref=event_ref)
            if medal:
                awarded.append(medal)

    for member_id in member_ids:
        org = await award_organization(db, member_id, project, event_ref=event_ref)
        awarded.extend(org["awarded"])

    return {"level": level, "awarded": awarded}


async def award_project_created(
    db: AsyncSession, project: Project, creator_id: int
) -> dict[str, Any]:
    """Проект создан → proj-first, автоподтверждение, s-pioneer (тикет 06).

    - proj-first — первый проект создателя (по created_by), командная;
    - auto_confirmed (экспресс-оценка ≤2): официальное подтверждение
      засчитывает уровни 1..official — единственный путь к ugt-1/ugt-2;
    - s-pioneer — первый проект платформы в отрасли (по category).
    """
    awarded: list[str] = []
    created_ref = f"project:{project.id}:created"

    total = int(
        await db.scalar(
            select(func.count(Project.id)).where(Project.created_by == creator_id)
        )
        or 0
    )
    if total >= 1:
        medal = await _award_team(db, project.id, "proj-first", event_ref=created_ref)
        if medal:
            awarded.append(medal)

    if project.status == "auto_confirmed" and project.current_level >= 1:
        for lvl in range(1, project.current_level + 1):
            res = await award_ugt(db, project, lvl)
            awarded.extend(res["awarded"])

    sector_slug = _sector_of(project)
    if sector_slug is not None:
        rows = await db.execute(
            select(Project.category).where(Project.id != project.id)
        )
        other = {
            SECTOR_CATEGORY_MAP.get((c or "").strip().lower()) for (c,) in rows.all()
        }
        if sector_slug not in other:
            medal = await _award_team(
                db, project.id, "s-pioneer", event_ref=created_ref
            )
            if medal:
                awarded.append(medal)

    return {"project_id": project.id, "awarded": awarded}


async def award_first_request(db: AsyncSession, project: Project) -> dict[str, Any]:
    """Первая заявка на переход УГТ → proj-first-request команде."""
    medal = await _award_team(
        db,
        project.id,
        "proj-first-request",
        event_ref=f"project:{project.id}:first-request",
    )
    return {"project_id": project.id, "awarded": [medal] if medal else []}


async def award_draft_approved(
    db: AsyncSession, project: Project, level: int
) -> dict[str, Any]:
    """Черновик подтверждён менеджером → уровни 1..L + рывок (тикет 06).

    Первичное подтверждение на уровень L засчитывает уровни 1..L (анкета
    покрывает все уровни до заявленного) — через award_ugt каждый. Скачок
    0→L при L≥2 — это достижимый q-leap (decide_promotion разрешает только
    N→N+1, там рывок невозможен; проверка _q_leap оставлена для будущих
    флоу с многоуровневыми переходами).
    """
    awarded: list[str] = []
    for lvl in range(1, max(level, 0) + 1):
        res = await award_ugt(db, project, lvl)
        awarded.extend(res["awarded"])
    if level >= 2:
        medal = await _award_team(
            db, project.id, "q-leap", event_ref=f"draft:{project.id}:{level}"
        )
        if medal:
            awarded.append(medal)
    return {"level": level, "awarded": awarded}


async def award_role_verify(
    db: AsyncSession, manager_id: int, event_ref: str
) -> dict[str, Any]:
    """Решение менеджера → ступени верификаций (тикет 06).

    Считаются подтверждённые переходы (approved с manager_id) и опубликованные
    черновики (audit project.published). times = порог; event_ref решения —
    чтобы откат отзывал именно эту верификацию.
    """
    awarded: list[str] = []
    promos = int(
        await db.scalar(
            select(func.count(PromotionRequest.id)).where(
                PromotionRequest.manager_id == manager_id,
                PromotionRequest.status == "approved",
            )
        )
        or 0
    )
    drafts = int(
        await db.scalar(
            select(func.count(AuditTrailEntry.id)).where(
                AuditTrailEntry.user_id == manager_id,
                AuditTrailEntry.action == "project.published",
            )
        )
        or 0
    )
    total = promos + drafts
    if total <= 0:
        return {"user_id": manager_id, "awarded": awarded}
    for threshold, slug in ROLE_VERIFY_STEPS:
        if total >= threshold:
            medal = await _award_personal(
                db, manager_id, slug, times=threshold, event_ref=event_ref
            )
            if medal:
                awarded.append(medal)
    return {"user_id": manager_id, "awarded": awarded}


async def award_expert_check(
    db: AsyncSession, user_id: int, event_ref: str
) -> dict[str, Any]:
    """Решение по контрольной точке → ступени экспертиз (тикет 06).

    КТ-решение — выводимый в API аналог «проверки документа экспертом»;
    times = порог; event_ref решения — для отзыва.
    """
    awarded: list[str] = []
    total = int(
        await db.scalar(
            select(func.count(ControlPoint.id)).where(
                ControlPoint.decided_by == user_id
            )
        )
        or 0
    )
    if total <= 0:
        return {"user_id": user_id, "awarded": awarded}
    for threshold, slug in ROLE_EXPERT_STEPS:
        if total >= threshold:
            medal = await _award_personal(
                db, user_id, slug, times=threshold, event_ref=event_ref
            )
            if medal:
                awarded.append(medal)
    return {"user_id": user_id, "awarded": awarded}


async def award_fast_check(
    db: AsyncSession,
    user_id: int,
    created_at: datetime | None,
    decided_at: datetime | None,
    event_ref: str,
) -> dict[str, Any]:
    """Решение быстрее FAST_CHECK_DAYS суток → role-fast-check (тикет 06)."""
    awarded: list[str] = []
    if created_at is not None and decided_at is not None:
        delta = _ensure_aware(decided_at) - _ensure_aware(created_at)
        if delta < timedelta(days=FAST_CHECK_DAYS):
            medal = await _award_personal(
                db, user_id, "role-fast-check", event_ref=event_ref
            )
            if medal:
                awarded.append(medal)
    return {"user_id": user_id, "awarded": awarded}


async def award_organization(
    db: AsyncSession,
    user_id: int,
    project: Project,
    *,
    event_ref: str | None = None,
) -> dict[str, Any]:
    """Медали организаций пользователя (тикет 06).

    Проект приписывается организациям действующего пользователя (членство в
    user_organizations): статистика считается по проектам всех членов каждой
    организации (созданные ими или с их активным участием).
    - org-first — первый проект организации;
    - org-5-projects — 5 проектов (times=5);
    - org-3-sectors — проекты в 3+ отраслях;
    - org-10-docs — 10 принятых документов по проектам (times=10);
    - org-ugt6 — проект организации достиг УГТ 6+.
    Вызывается из создания проекта, приёма документов и подтверждения УГТ.
    """
    awarded: list[str] = []
    for org_id in await _user_org_ids(db, user_id):
        if await db.get(UserOrganization, org_id) is None:
            continue
        member_ids = await _org_member_ids(db, org_id)
        if not member_ids:
            continue
        pids = await _member_project_ids(db, member_ids)
        if project.id not in pids:
            continue
        medal = await _award_personal(
            db, user_id, "org-first", project_id=project.id, event_ref=event_ref
        )
        if medal:
            awarded.append(medal)
        if len(pids) >= 5:
            medal = await _award_personal(
                db,
                user_id,
                "org-5-projects",
                project_id=project.id,
                event_ref=event_ref,
                times=5,
            )
            if medal:
                awarded.append(medal)
        if len(await _sectors_of_projects(db, pids)) >= 3:
            medal = await _award_personal(
                db,
                user_id,
                "org-3-sectors",
                project_id=project.id,
                event_ref=event_ref,
            )
            if medal:
                awarded.append(medal)
        if len(await _accepted_doc_keys(db, pids)) >= 10:
            medal = await _award_personal(
                db,
                user_id,
                "org-10-docs",
                project_id=project.id,
                event_ref=event_ref,
                times=10,
            )
            if medal:
                awarded.append(medal)
        ugt6 = await db.scalar(
            select(func.count(Project.id)).where(
                Project.id.in_(sorted(pids)),
                Project.current_level >= 6,
            )
        )
        if int(ugt6 or 0) > 0:
            medal = await _award_personal(
                db, user_id, "org-ugt6", project_id=project.id, event_ref=event_ref
            )
            if medal:
                awarded.append(medal)
    return {"user_id": user_id, "awarded": awarded}


async def award_meta(db: AsyncSession, user_id: int) -> dict[str, Any]:
    """Мета-медали (спека §4.3.5 + тикет 06): первая медаль, ступени 5/15/30,
    3+/5+ проектов, эпическая коллекция (все 9 УГТ-медалей), легенда (все
    открытые медали каталога — 100+ уникальных при 66 слагов недостижимо).
    Вызывается автоматически при каждой новой медали (и явно из хука
    decide_promotion для всех участников — идемпотентно).
    """
    awarded: list[str] = []
    total = int(
        await db.scalar(
            select(func.count(UserAchievement.id)).where(
                UserAchievement.user_id == user_id
            )
        )
        or 0
    )
    if total <= 0:
        return {"user_id": user_id, "awarded": awarded}

    first = await _get_achievement(db, "m-first-medal")
    if total == 1 and first is not None and await _award(
        db, user_id, first, run_meta=False
    ):
        awarded.append("m-first-medal")

    for threshold, slug in META_STEPS:
        if total >= threshold:
            achievement = await _get_achievement(db, slug)
            if achievement is not None and await _award(
                db, user_id, achievement, times=threshold, run_meta=False
            ):
                awarded.append(slug)

    projects_count = int(
        await db.scalar(
            select(func.count(func.distinct(UserAchievement.project_id))).where(
                UserAchievement.user_id == user_id,
                UserAchievement.project_id.isnot(None),
            )
        )
        or 0
    )
    if projects_count >= 3:
        medal = await _get_achievement(db, "m-3-projects")
        if medal is not None and await _award(db, user_id, medal, run_meta=False):
            awarded.append("m-3-projects")
    if projects_count >= 5:
        medal = await _get_achievement(db, "m-5-projects")
        if medal is not None and await _award(db, user_id, medal, run_meta=False):
            awarded.append("m-5-projects")

    held = await _user_slugs(db, user_id)
    if set(UGT_SLUGS) <= held:
        medal = await _get_achievement(db, "s-epic-collection")
        if medal is not None and await _award(db, user_id, medal, run_meta=False):
            awarded.append("s-epic-collection")
            held.add("s-epic-collection")

    open_total = int(
        await db.scalar(
            select(func.count(Achievement.id)).where(Achievement.secret.is_(False))
        )
        or 0
    )
    if open_total > 0:
        open_held = int(
            await db.scalar(
                select(func.count(UserAchievement.id))
                .join(Achievement, UserAchievement.achievement_id == Achievement.id)
                .where(
                    UserAchievement.user_id == user_id,
                    Achievement.secret.is_(False),
                )
            )
            or 0
        )
        if open_held >= open_total:
            medal = await _get_achievement(db, "s-legend")
            if medal is not None and await _award(db, user_id, medal, run_meta=False):
                awarded.append("s-legend")

    return {"user_id": user_id, "awarded": awarded}


async def revoke_for_event(db: AsyncSession, event_ref: str) -> dict[str, int]:
    """Отзыв медалей при отмене подтверждённого события (спека §4.3.8).

    Удаляет user_achievements по event_ref; командные project_achievements
    отзываются для тех же (project_id, achievement_id) — у командной таблицы
    нет колонки event_ref, пары восстанавливаются из персональных записей.
    """
    rows = (
        (
            await db.execute(
                select(UserAchievement.project_id, UserAchievement.achievement_id).where(
                    UserAchievement.event_ref == event_ref
                )
            )
        )
        .all()
    )
    pairs = {(int(r[0]), int(r[1])) for r in rows if r[0] is not None}
    result = await db.execute(
        delete(UserAchievement).where(UserAchievement.event_ref == event_ref)
    )
    user_records = result.rowcount if isinstance(result, CursorResult) else 0
    project_records = 0
    for project_id, achievement_id in pairs:
        res = await db.execute(
            delete(ProjectAchievement).where(
                ProjectAchievement.project_id == project_id,
                ProjectAchievement.achievement_id == achievement_id,
            )
        )
        project_records += res.rowcount if isinstance(res, CursorResult) else 0
    return {"user_records": user_records, "project_records": project_records}


# ─── Админ-аналитика достижений (тикет 09, спека §4.7) ─────────────────────


async def achievement_stats(db: AsyncSession) -> dict[str, Any]:
    """Агрегаты начислений для админ-панели (GET /admin/achievements/stats).

    Читает фактические таблицы начислений; пустая БД отдаёт нули и пустые
    списки без ошибок. Все срезы по времени считаются в UTC (явный
    ``timezone('UTC', ...)`` — результат не зависит от timezone сессии БД),
    недели — с понедельника (ISO).

    Время проверки менеджера: отдельного столбца decided_at в схеме нет,
    момент решения ≈ updated_at заявки (onupdate=func.now() срабатывает в
    decide_promotion). Единица — календарные часы между created_at и
    updated_at (календаря рабочих часов на платформе нет; документированное
    решение тикета 09).
    """
    from datetime import timedelta

    now = datetime.now(UTC)

    # ── сводные счётчики ────────────────────────────────────────────────────
    total_awards = int(
        await db.scalar(select(func.count(UserAchievement.id))) or 0
    )
    awards_last_week = int(
        await db.scalar(
            select(func.count(UserAchievement.id)).where(
                UserAchievement.awarded_at >= now - timedelta(days=7)
            )
        )
        or 0
    )
    unique_users = int(
        await db.scalar(select(func.count(func.distinct(UserAchievement.user_id))))
        or 0
    )
    project_ids: set[int] = set()
    for row in await db.execute(
        select(func.distinct(UserAchievement.project_id)).where(
            UserAchievement.project_id.isnot(None)
        )
    ):
        if row[0] is not None:
            project_ids.add(int(row[0]))
    for row in await db.execute(
        select(func.distinct(ProjectAchievement.project_id))
    ):
        project_ids.add(int(row[0]))

    # ── динамика: 30 дней и 12 недель (пустые периоды — нули) ───────────────
    day_trunc = func.date_trunc(
        "day", func.timezone("UTC", UserAchievement.awarded_at)
    )
    day_rows = await db.execute(
        select(day_trunc.label("bucket"), func.count(UserAchievement.id)).group_by(
            "bucket"
        )
    )
    day_counts = {row[0].date(): int(row[1]) for row in day_rows}
    by_day: list[dict[str, Any]] = []
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).date()
        by_day.append({"date": day.isoformat(), "count": day_counts.get(day, 0)})

    week_trunc = func.date_trunc(
        "week", func.timezone("UTC", UserAchievement.awarded_at)
    )
    week_rows = await db.execute(
        select(week_trunc.label("bucket"), func.count(UserAchievement.id)).group_by(
            "bucket"
        )
    )
    week_counts = {row[0].date(): int(row[1]) for row in week_rows}
    this_monday = (now - timedelta(days=now.weekday())).date()
    by_week: list[dict[str, Any]] = []
    for i in range(11, -1, -1):
        start = this_monday - timedelta(weeks=i)
        by_week.append({"date": start.isoformat(), "count": week_counts.get(start, 0)})

    # ── распределения по группам и редкости (join каталога) ─────────────────
    by_group: list[dict[str, Any]] = []
    by_rarity: list[dict[str, Any]] = []
    if total_awards > 0:
        group_rows = await db.execute(
            select(Achievement.group, func.count(UserAchievement.id))
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .group_by(Achievement.group)
            .order_by(func.count(UserAchievement.id).desc())
        )
        by_group = [
            {
                "key": group_,
                "count": int(count),
                "percent": round(count * 100.0 / total_awards, 1),
            }
            for group_, count in group_rows
        ]
        rarity_rows = await db.execute(
            select(Achievement.rarity, func.count(UserAchievement.id))
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .group_by(Achievement.rarity)
            .order_by(func.count(UserAchievement.id).desc())
        )
        by_rarity = [
            {
                "key": rarity,
                "count": int(count),
                "percent": round(count * 100.0 / total_awards, 1),
            }
            for rarity, count in rarity_rows
        ]

    # ── отраслевые срезы: командные медали по category проектов ─────────────
    sector_rows = await db.execute(
        select(
            Project.category,
            func.count(ProjectAchievement.id),
            func.count(func.distinct(ProjectAchievement.project_id)),
        )
        .join(Project, ProjectAchievement.project_id == Project.id)
        .group_by(Project.category)
        .order_by(func.count(ProjectAchievement.id).desc())
    )
    by_sector: list[dict[str, Any]] = []
    for category, count, projects in sector_rows:
        label = (category or "").strip() or "Без категории"
        by_sector.append(
            {"category": label, "count": int(count), "projects": int(projects)}
        )

    # ── топ-10 медалей по числу персональных начислений ─────────────────────
    top_rows = await db.execute(
        select(
            Achievement.slug,
            Achievement.title,
            Achievement.group,
            Achievement.rarity,
            func.count(UserAchievement.id),
        )
        .join(Achievement, UserAchievement.achievement_id == Achievement.id)
        .group_by(
            Achievement.slug,
            Achievement.title,
            Achievement.group,
            Achievement.rarity,
        )
        .order_by(func.count(UserAchievement.id).desc(), Achievement.slug)
        .limit(10)
    )
    top_achievements = [
        {
            "slug": slug,
            "title": title,
            "group": group_,
            "rarity": rarity,
            "count": int(count),
        }
        for slug, title, group_, rarity, count in top_rows
    ]

    # ── застрявшие проекты: published, уровень 1..8, без обновлений 90+ дней ─
    stalled_rows = await db.execute(
        select(Project.id, Project.name, Project.current_level, Project.updated_at)
        .where(
            Project.status == "published",
            Project.current_level >= 1,
            Project.current_level < 9,
            Project.updated_at < now - timedelta(days=90),
        )
        .order_by(Project.updated_at.asc())
    )
    stalled_projects = [
        {
            "id": project_id,
            "name": name,
            "current_level": level,
            "days": (now - updated).days,
        }
        for project_id, name, level, updated in stalled_rows
    ]

    # ── время проверки менеджеров: среднее (updated_at - created_at) ────────
    review_row = await db.execute(
        select(
            func.extract(
                "epoch",
                func.avg(PromotionRequest.updated_at - PromotionRequest.created_at),
            )
            / 3600,
            func.count(PromotionRequest.id),
        ).where(PromotionRequest.status.in_(("approved", "rejected")))
    )
    avg_epoch_hours, decided_count = review_row.one()
    manager_review = {
        "avg_hours": (
            round(float(avg_epoch_hours), 1) if avg_epoch_hours is not None else None
        ),
        "decided_count": int(decided_count),
    }

    return {
        "totals": {
            "total_awards": total_awards,
            "awards_last_week": awards_last_week,
            "unique_users": unique_users,
            "unique_projects": len(project_ids),
        },
        "by_day": by_day,
        "by_week": by_week,
        "by_group": by_group,
        "by_rarity": by_rarity,
        "by_sector": by_sector,
        "top_achievements": top_achievements,
        "stalled_projects": stalled_projects,
        "manager_review": manager_review,
    }
