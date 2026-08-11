"""Операционная аналитика сотрудников Центра (тикет 05 operations-modules).

Чистые воспроизводимые функции: показатели считаются ТОЛЬКО по данным БД
(SQL-агрегаты), без LLM и без внешних сервисов. Те же данные → те же числа.
Каждый показатель сопровождается метаданными: definition (что именно
считается), source (таблица/колонка-источник), computed_at (дата расчёта).

Просрочки — детерминированно по датам (граница: due_date < today → просрочено;
сегодня — ещё нет), инъекция `today` для юнит-тестов (как в stage_progress).

Зависимость requests-matching/02: метрики tech_requests и решений менеджера
читают таблицы tech_requests/tech_request_moderation_log, созданные спекой
requests-matching (готово в своём worktree, в эту ветку не влито). Сервис
детектирует наличие таблиц в схеме: если таблицы нет — метрика возвращает 0
с тем же source (честно: данных нет). После слияния веток код не меняется.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func, inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    ControlPoint,
    Project,
    ProjectStage,
    StageTask,
    UserOrganization,
)

# ─── Метаданные показателей ────────────────────────────────────────────────

METRIC_DEFINITIONS: dict[str, str] = {
    "projects_total": "Всего проектов (все статусы).",
    "projects_by_status": "Распределение проектов по статусу (projects.status).",
    "projects_by_ugt":
        ("Распределение проектов по целевому УГТ — уровню готовности"
            " технологии (projects.target_level)."),
    "organizations_total": "Всего организаций пользователей (user_organizations).",
    "organizations_verified":
        "Организации, прошедшие проверку Центра (user_organizations.state='verified').",
    "organizations_pending":
        "Организации, ожидающие решения Центра (user_organizations.state='pending').",
    "tech_requests_total": "Всего технологических запросов (tech_requests).",
    "tech_requests_submitted":
        "Технологические запросы, отправленные заказчиком (tech_requests.status='submitted').",
    "tech_requests_approved":
        ("Технологические запросы, одобренные менеджером"
            " (tech_requests.moderation_status='approved')."),
    "tech_requests_by_visibility":
        ("Распределение технологических запросов по режиму видимости"
            " (tech_requests.visibility: public/platform/private)."),
    "checkpoints_total": "Всего контрольных точек (control_points).",
    "checkpoints_overdue":
        ("Контрольные точки со сроком раньше today и без принятого решения"
            " (control_points.due_date < today, статус не approved/rejected)."),
    "checkpoints_decided":
        "Контрольные точки с принятым решением (control_points.status в approved/rejected).",
    "stages_total": "Всего этапов сопровождения (project_stages).",
    "stages_by_status":
        "Распределение этапов по статусу (project_stages.status: planned/in_progress/completed).",
    "manager_decisions_approve":
        "Решения менеджера approve (tech_request_moderation_log.action='approve').",
    "manager_decisions_reject":
        "Решения менеджера reject (tech_request_moderation_log.action='reject').",
    "tasks_total": "Всего задач этапов (stage_tasks).",
    "tasks_by_status":
        "Распределение задач по статусу (stage_tasks.status: todo/in_progress/done).",
    "tasks_overdue":
        ("Задачи со сроком раньше today и не завершённые"
            " (stage_tasks.due_date < today, статус не done)."),
}

METRIC_SOURCES: dict[str, str] = {
    "projects_total": "projects.id",
    "projects_by_status": "projects.status",
    "projects_by_ugt": "projects.target_level",
    "organizations_total": "user_organizations.id",
    "organizations_verified": "user_organizations.state",
    "organizations_pending": "user_organizations.state",
    "tech_requests_total": "tech_requests.id",
    "tech_requests_submitted": "tech_requests.status",
    "tech_requests_approved": "tech_requests.moderation_status",
    "tech_requests_by_visibility": "tech_requests.visibility",
    "checkpoints_total": "control_points.id",
    "checkpoints_overdue": "control_points.due_date, control_points.status",
    "checkpoints_decided": "control_points.status",
    "stages_total": "project_stages.id",
    "stages_by_status": "project_stages.status",
    "manager_decisions_approve": "tech_request_moderation_log.action",
    "manager_decisions_reject": "tech_request_moderation_log.action",
    "tasks_total": "stage_tasks.id",
    "tasks_by_status": "stage_tasks.status",
    "tasks_overdue": "stage_tasks.due_date, stage_tasks.status",
}

# Статусы, которые считаются «решёнными» для контрольной точки (decide endpoint).
CHECKPOINT_DECIDED_STATUSES = ("approved", "rejected")
TASK_DONE_STATUS = "done"

# Таблицы-зависимости requests-matching/02 (в этой ветке могут отсутствовать).
TECH_REQUESTS_TABLE = "tech_requests"
TECH_REQUESTS_LOG_TABLE = "tech_request_moderation_log"


@dataclass(frozen=True)
class MetricResult:
    """Показатель: значение + метаданные (definition/source/computed_at)."""

    value: int | dict[str, int]
    definition: str
    source: str
    computed_at: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "value": self.value,
            "definition": self.definition,
            "source": self.source,
            "computed_at": self.computed_at,
        }


@dataclass(frozen=True)
class AnalyticsFilters:
    """Фильтры сводки: период создания (created_at) и статус проектов."""

    period_from: date | None = None
    period_to: date | None = None
    status: str | None = None


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _period_bounds(
    filters: AnalyticsFilters,
) -> tuple[datetime | None, datetime | None]:
    """Границы периода как [from, to) по UTC — полуинтервал, детерминированно."""
    lo: datetime | None = None
    hi: datetime | None = None
    if filters.period_from is not None:
        lo = datetime.combine(filters.period_from, time.min, tzinfo=UTC)
    if filters.period_to is not None:
        hi = datetime.combine(
            filters.period_to + timedelta(days=1), time.min, tzinfo=UTC
        )
    return lo, hi


async def _table_exists(db: AsyncSession, table_name: str) -> bool:
    """Проверка наличия таблицы в схеме public (dependency-детект)."""

    def _has(sync_conn: Any) -> bool:
        # run_sync передаёт sync-сессию; inspect() ожидает engine/connection.
        return inspect(sync_conn.bind).has_table(table_name, schema="public")

    return await db.run_sync(_has)


async def _count_scalar(
    db: AsyncSession,
    statement: Any,
) -> int:
    row = await db.execute(statement)
    return int(row.scalar_one())


async def _grouped_counts(
    db: AsyncSession,
    statement: Any,
) -> dict[str, int]:
    rows = await db.execute(statement)
    return {str(key): int(count) for key, count in rows}


def _metric(
    key: str,
    value: int | dict[str, int],
    computed_at: str,
) -> MetricResult:
    return MetricResult(
        value=value,
        definition=METRIC_DEFINITIONS[key],
        source=METRIC_SOURCES[key],
        computed_at=computed_at,
    )


async def _projects_metrics(
    db: AsyncSession,
    filters: AnalyticsFilters,
    today: date,
    computed_at: str,
) -> dict[str, MetricResult]:
    lo, hi = _period_bounds(filters)
    base = select(Project.id)
    if lo is not None:
        base = base.where(Project.created_at >= lo)
    if hi is not None:
        base = base.where(Project.created_at < hi)
    if filters.status is not None:
        base = base.where(Project.status == filters.status)

    total = await _count_scalar(db, select(func.count()).select_from(base.subquery()))

    by_status_stmt = (
        select(Project.status, func.count(Project.id))
        .group_by(Project.status)
        .order_by(Project.status)
    )
    by_ugt_stmt = (
        select(Project.target_level, func.count(Project.id))
        .group_by(Project.target_level)
        .order_by(Project.target_level)
    )
    # Фильтры применяются и к распределениям (согласованность сводки).
    if lo is not None:
        by_status_stmt = by_status_stmt.where(Project.created_at >= lo)
        by_ugt_stmt = by_ugt_stmt.where(Project.created_at >= lo)
    if hi is not None:
        by_status_stmt = by_status_stmt.where(Project.created_at < hi)
        by_ugt_stmt = by_ugt_stmt.where(Project.created_at < hi)
    if filters.status is not None:
        by_status_stmt = by_status_stmt.where(Project.status == filters.status)
        by_ugt_stmt = by_ugt_stmt.where(Project.status == filters.status)

    return {
        "projects_total": _metric("projects_total", total, computed_at),
        "projects_by_status": _metric(
            "projects_by_status",
            await _grouped_counts(db, by_status_stmt),
            computed_at,
        ),
        "projects_by_ugt": _metric(
            "projects_by_ugt",
            await _grouped_counts(db, by_ugt_stmt),
            computed_at,
        ),
    }


async def _organizations_metrics(
    db: AsyncSession,
    filters: AnalyticsFilters,
    computed_at: str,
) -> dict[str, MetricResult]:
    lo, hi = _period_bounds(filters)
    base = select(UserOrganization.id)
    if lo is not None:
        base = base.where(UserOrganization.created_at >= lo)
    if hi is not None:
        base = base.where(UserOrganization.created_at < hi)

    total = await _count_scalar(db, select(func.count()).select_from(base.subquery()))

    async def _count_state(state: str) -> int:
        stmt = base.where(UserOrganization.state == state)
        return await _count_scalar(
            db, select(func.count()).select_from(stmt.subquery())
        )

    return {
        "organizations_total": _metric("organizations_total", total, computed_at),
        "organizations_verified": _metric(
            "organizations_verified",
            await _count_state("verified"),
            computed_at,
        ),
        "organizations_pending": _metric(
            "organizations_pending",
            await _count_state("pending"),
            computed_at,
        ),
    }


async def _checkpoints_metrics(
    db: AsyncSession,
    filters: AnalyticsFilters,
    today: date,
    computed_at: str,
) -> dict[str, MetricResult]:
    lo, hi = _period_bounds(filters)
    base = select(ControlPoint.id)
    if lo is not None:
        base = base.where(ControlPoint.created_at >= lo)
    if hi is not None:
        base = base.where(ControlPoint.created_at < hi)

    total = await _count_scalar(db, select(func.count()).select_from(base.subquery()))

    overdue_stmt = base.where(
        ControlPoint.due_date.is_not(None),
        ControlPoint.due_date < today,
        ControlPoint.status.notin_(CHECKPOINT_DECIDED_STATUSES),
    )
    decided_stmt = base.where(
        ControlPoint.status.in_(CHECKPOINT_DECIDED_STATUSES)
    )

    return {
        "checkpoints_total": _metric("checkpoints_total", total, computed_at),
        "checkpoints_overdue": _metric(
            "checkpoints_overdue",
            await _count_scalar(
                db, select(func.count()).select_from(overdue_stmt.subquery())
            ),
            computed_at,
        ),
        "checkpoints_decided": _metric(
            "checkpoints_decided",
            await _count_scalar(
                db, select(func.count()).select_from(decided_stmt.subquery())
            ),
            computed_at,
        ),
    }


async def _stages_metrics(
    db: AsyncSession,
    filters: AnalyticsFilters,
    computed_at: str,
) -> dict[str, MetricResult]:
    lo, hi = _period_bounds(filters)
    base = select(ProjectStage.id)
    if lo is not None:
        base = base.where(ProjectStage.created_at >= lo)
    if hi is not None:
        base = base.where(ProjectStage.created_at < hi)

    total = await _count_scalar(db, select(func.count()).select_from(base.subquery()))

    by_status_stmt = (
        select(ProjectStage.status, func.count(ProjectStage.id))
        .group_by(ProjectStage.status)
        .order_by(ProjectStage.status)
    )
    if lo is not None:
        by_status_stmt = by_status_stmt.where(ProjectStage.created_at >= lo)
    if hi is not None:
        by_status_stmt = by_status_stmt.where(ProjectStage.created_at < hi)

    return {
        "stages_total": _metric("stages_total", total, computed_at),
        "stages_by_status": _metric(
            "stages_by_status",
            await _grouped_counts(db, by_status_stmt),
            computed_at,
        ),
    }


async def _tasks_metrics(
    db: AsyncSession,
    filters: AnalyticsFilters,
    today: date,
    computed_at: str,
) -> dict[str, MetricResult]:
    lo, hi = _period_bounds(filters)
    base = select(StageTask.id)
    if lo is not None:
        base = base.where(StageTask.created_at >= lo)
    if hi is not None:
        base = base.where(StageTask.created_at < hi)

    total = await _count_scalar(db, select(func.count()).select_from(base.subquery()))

    by_status_stmt = (
        select(StageTask.status, func.count(StageTask.id))
        .group_by(StageTask.status)
        .order_by(StageTask.status)
    )
    if lo is not None:
        by_status_stmt = by_status_stmt.where(StageTask.created_at >= lo)
    if hi is not None:
        by_status_stmt = by_status_stmt.where(StageTask.created_at < hi)

    overdue_stmt = base.where(
        StageTask.due_date.is_not(None),
        StageTask.due_date < today,
        StageTask.status != TASK_DONE_STATUS,
    )

    return {
        "tasks_total": _metric("tasks_total", total, computed_at),
        "tasks_by_status": _metric(
            "tasks_by_status",
            await _grouped_counts(db, by_status_stmt),
            computed_at,
        ),
        "tasks_overdue": _metric(
            "tasks_overdue",
            await _count_scalar(
                db, select(func.count()).select_from(overdue_stmt.subquery())
            ),
            computed_at,
        ),
    }


async def _tech_requests_metrics(
    db: AsyncSession,
    filters: AnalyticsFilters,
    computed_at: str,
) -> dict[str, MetricResult]:
    """Метрики технологических запросов (зависимость requests-matching/02).

    Если таблица tech_requests не развёрнута в схеме (ветка без слияния) —
    возвращаются нули с честным source: данных в текущей схеме нет. После
    слияния веток метрики начнут считать реальные значения без изменений кода.
    """
    lo, hi = _period_bounds(filters)
    has_table = await _table_exists(db, TECH_REQUESTS_TABLE)
    has_log = await _table_exists(db, TECH_REQUESTS_LOG_TABLE)

    def _period_clause(alias: str) -> str:
        parts: list[str] = []
        if lo is not None:
            parts.append(f"{alias}.created_at >= :lo")
        if hi is not None:
            parts.append(f"{alias}.created_at < :hi")
        return " AND ".join(parts)

    params: dict[str, Any] = {}
    if lo is not None:
        params["lo"] = lo
    if hi is not None:
        params["hi"] = hi

    async def _count_sql(sql: str, **extra: Any) -> int:
        merged = {**params, **extra}
        result = await db.execute(text(sql), merged)
        return int(result.scalar_one())

    async def _fetch_groups(sql: str) -> dict[str, int]:
        result = await db.execute(text(sql), params)
        return {str(key): int(count) for key, count in result}

    total = submitted = approved = 0
    by_visibility: dict[str, int] = {}
    if has_table:
        where = _period_clause("tr")
        cond = f" WHERE {where}" if where else ""
        total = await _count_sql(
            f"SELECT count(*) FROM public.tech_requests AS tr{cond}"
        )
        submitted = await _count_sql(
            f"SELECT count(*) FROM public.tech_requests AS tr{cond}"
            + (" AND " if cond else " WHERE ")
            + "tr.status = 'submitted'"
        )
        approved = await _count_sql(
            f"SELECT count(*) FROM public.tech_requests AS tr{cond}"
            + (" AND " if cond else " WHERE ")
            + "tr.moderation_status = 'approved'"
        )
        by_visibility = await _fetch_groups(
            f"SELECT tr.visibility, count(*) FROM public.tech_requests AS tr{cond}"
            + " GROUP BY tr.visibility ORDER BY tr.visibility"
        )

    approve = reject = 0
    if has_log:
        where = _period_clause("lg")
        cond = f" WHERE {where}" if where else ""
        approve = await _count_sql(
            f"SELECT count(*) FROM public.tech_request_moderation_log AS lg{cond}"
            + (" AND " if cond else " WHERE ")
            + "lg.action = 'approve'"
        )
        reject = await _count_sql(
            f"SELECT count(*) FROM public.tech_request_moderation_log AS lg{cond}"
            + (" AND " if cond else " WHERE ")
            + "lg.action = 'reject'"
        )

    return {
        "tech_requests_total": _metric(
            "tech_requests_total", total, computed_at
        ),
        "tech_requests_submitted": _metric(
            "tech_requests_submitted", submitted, computed_at
        ),
        "tech_requests_approved": _metric(
            "tech_requests_approved", approved, computed_at
        ),
        "tech_requests_by_visibility": _metric(
            "tech_requests_by_visibility", by_visibility, computed_at
        ),
        "manager_decisions_approve": _metric(
            "manager_decisions_approve", approve, computed_at
        ),
        "manager_decisions_reject": _metric(
            "manager_decisions_reject", reject, computed_at
        ),
    }


async def compute_analytics(
    db: AsyncSession,
    *,
    period_from: date | None = None,
    period_to: date | None = None,
    status: str | None = None,
    today: date | None = None,
    computed_at: datetime | None = None,
) -> dict[str, Any]:
    """Сводка операционной аналитики: показатели с метаданными.

    Детерминированно: те же данные БД + те же фильтры + тот же `today` →
    те же значения. `today`/`computed_at` инъектируются для воспроизводимых
    тестов (по умолчанию — текущая дата/время UTC).
    """
    filters = AnalyticsFilters(
        period_from=period_from, period_to=period_to, status=status
    )
    ref_date = today or date.today()
    stamp = (computed_at or _utc_now()).isoformat()

    metrics: dict[str, MetricResult] = {}
    metrics.update(await _projects_metrics(db, filters, ref_date, stamp))
    metrics.update(await _organizations_metrics(db, filters, stamp))
    metrics.update(await _checkpoints_metrics(db, filters, ref_date, stamp))
    metrics.update(await _stages_metrics(db, filters, stamp))
    metrics.update(await _tasks_metrics(db, filters, ref_date, stamp))
    metrics.update(await _tech_requests_metrics(db, filters, stamp))

    return {
        "computed_at": stamp,
        "filters": {
            "period_from": period_from.isoformat() if period_from else None,
            "period_to": period_to.isoformat() if period_to else None,
            "status": status,
        },
        "metrics": {key: m.as_dict() for key, m in metrics.items()},
    }
