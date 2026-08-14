"""Наградчики достижений (тикет 02, спека §4.3).

Автоматическое начисление медалей по подтверждённым событиям. Все функции
асинхронные, принимают сессию БД и параметры события; вызываются из хуков
существующих флоу (stages._trigger_application, manager.decide_promotion).

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
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, cast

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Achievement,
    Project,
    ProjectAchievement,
    ProjectDocument,
    ProjectMember,
    PromotionRequest,
    User,
    UserAchievement,
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
      всех типов, представленных в проекте. Чтобы эпик-медаль была осмысленной,
      требуется не менее двух типов документов в проекте (документированное
      решение тикета 02; в текущем флоу единственный тип — 'stage').
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

    В текущем флоу decide_promotion разрешает только N→N+1, поэтому через API
    медаль не выпадает; проверка реализована на случай будущих флоу (например,
    первичное подтверждение выше заявленного).
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
    """УГТ подтверждён → командные медали (спека §4.3.2).

    - ugt-N — вся команда проекта на момент события (project_achievements +
      user_achievements участников с project_id);
    - sector-* — отраслевая медаль по Project.category;
    - q-first-try / q-leap / q-clean / q-sprint — проверки качества прохождения.
    Все проверки идемпотентны: повторное подтверждение уровня не дублирует
    записи (дедупликация по user+achievement / project+achievement).
    """
    awarded: list[str] = []
    event_ref = f"ugt:{project.id}:{level}"

    ugt = await _award_team(db, project.id, f"ugt-{level}", event_ref=event_ref)
    if ugt:
        awarded.append(ugt)

    sector_slug = SECTOR_CATEGORY_MAP.get((project.category or "").strip().lower())
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

    return {"level": level, "awarded": awarded}


async def award_meta(db: AsyncSession, user_id: int) -> dict[str, Any]:
    """Мета-медали (спека §4.3.5): первая медаль, ступени 5/15/30, 3+/5+
    проектов, легенда (100+). Вызывается автоматически при каждой новой медали
    (и явно из хука decide_promotion для всех участников — идемпотентно).
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

    if total >= 100:
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
