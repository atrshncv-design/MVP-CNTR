"""Детерминированный расчёт статусов, просрочек и прогресса этапа (без LLM).

Тикет 01 operations-modules. Все функции — чистые: от дат и весов, без
внешних сервисов. Граничное правило: «сегодня» НЕ считается просрочкой —
просрочка наступает начиная со вчерашнего дня (due_date < today).

Производный статус этапа не хранится в БД — вычисляется на каждый запрос.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

# Хранимые статусы этапа (workflow, управляются владельцем/сотрудником)
STAGE_STATUS_PLANNED = "planned"
STAGE_STATUS_IN_PROGRESS = "in_progress"
STAGE_STATUS_COMPLETED = "completed"
# Производный статус (не хранится): срок прошёл, работа не завершена
STAGE_STATUS_OVERDUE = "overdue"

STAGE_STATUSES = {STAGE_STATUS_PLANNED, STAGE_STATUS_IN_PROGRESS, STAGE_STATUS_COMPLETED}

TASK_STATUS_TODO = "todo"
TASK_STATUS_IN_PROGRESS = "in_progress"
TASK_STATUS_DONE = "done"

TASK_STATUSES = {TASK_STATUS_TODO, TASK_STATUS_IN_PROGRESS, TASK_STATUS_DONE}

CHECKPOINT_STATUS_PENDING = "pending"
CHECKPOINT_STATUS_APPROVED = "approved"
CHECKPOINT_STATUS_REJECTED = "rejected"

CHECKPOINT_DONE_STATUSES = {CHECKPOINT_STATUS_APPROVED}


@dataclass(frozen=True)
class StageSnapshot:
    """Срез хранимых полей этапа (не ORM-объект — юнит-тесты без БД)."""

    status: str = STAGE_STATUS_PLANNED
    planned_start: date | None = None
    planned_end: date | None = None
    actual_start: date | None = None
    actual_end: date | None = None


@dataclass(frozen=True)
class TaskSnapshot:
    """Срез задачи этапа для расчёта."""

    status: str = TASK_STATUS_TODO
    due_date: date | None = None


@dataclass(frozen=True)
class CheckpointSnapshot:
    """Срез контрольной точки этапа для расчёта (вес — вклад в прогресс)."""

    status: str = CHECKPOINT_STATUS_PENDING
    due_date: date | None = None
    weight: int = 1


@dataclass(frozen=True)
class StageProgress:
    """Итог детерминированного расчёта: статус, просрочки, прогресс."""

    status: str
    overdue: bool
    overdue_days: int
    progress_pct: float
    tasks_total: int
    tasks_done: int
    tasks_overdue: int
    checkpoints_total: int
    checkpoints_done: int
    checkpoints_overdue: int


def is_overdue(due_date: date | None, done: bool, today: date) -> bool:
    """Просрочено ⇔ срок был раньше сегодня и работа не завершена.

    Границы: due_date == today → НЕ просрочено; due_date == yesterday →
    просрочено; due_date is None → не просрочено; done → не просрочено.
    """
    if due_date is None or done:
        return False
    return due_date < today


def compute_stage_status(stage: StageSnapshot, today: date) -> str:
    """Итоговый статус этапа: completed > (in_progress/overdue по датам).

    Правила (детерминированные):
    1. Фактически завершён (actual_end или хранимый status=completed) → completed.
    2. Фактически начат (actual_start или хранимый status=in_progress):
       in_progress (просрочка считается отдельно).
    3. Не начат, но плановый конец был раньше сегодня → overdue.
    4. Не начат, плановый старт ≤ сегодня → in_progress.
    5. Иначе → planned.
    """
    if stage.status == STAGE_STATUS_COMPLETED or stage.actual_end is not None:
        return STAGE_STATUS_COMPLETED
    if stage.status == STAGE_STATUS_IN_PROGRESS or stage.actual_start is not None:
        return STAGE_STATUS_IN_PROGRESS
    if stage.planned_end is not None and stage.planned_end < today:
        return STAGE_STATUS_OVERDUE
    if stage.planned_start is not None and stage.planned_start <= today:
        return STAGE_STATUS_IN_PROGRESS
    return STAGE_STATUS_PLANNED


def _task_overdue_days(task: TaskSnapshot, today: date) -> int:
    if is_overdue(task.due_date, task.status == TASK_STATUS_DONE, today):
        assert task.due_date is not None
        return (today - task.due_date).days
    return 0


def _checkpoint_overdue_days(cp: CheckpointSnapshot, today: date) -> int:
    if is_overdue(cp.due_date, cp.status in CHECKPOINT_DONE_STATUSES, today):
        assert cp.due_date is not None
        return (today - cp.due_date).days
    return 0


def compute_progress(
    stage: StageSnapshot,
    tasks: list[TaskSnapshot],
    checkpoints: list[CheckpointSnapshot],
    today: date,
) -> StageProgress:
    """Прогресс этапа: статус + просрочки + прогресс-процент (детерминированно).

    Прогресс: задачи — 50%, контрольные точки — 50% (точки взвешиваются
    по weight). При отсутствии одного из компонентов вес переносится на
    другой; при отсутствии обоих — 0.0.
    """
    status = compute_stage_status(stage, today)

    tasks_total = len(tasks)
    tasks_done = sum(1 for t in tasks if t.status == TASK_STATUS_DONE)
    tasks_overdue = sum(1 for t in tasks if _task_overdue_days(t, today) > 0)

    cps_total = len(checkpoints)
    cps_done = sum(
        1 for cp in checkpoints if cp.status in CHECKPOINT_DONE_STATUSES
    )
    cps_overdue = sum(1 for cp in checkpoints if _checkpoint_overdue_days(cp, today) > 0)
    cps_weight_total = sum(cp.weight for cp in checkpoints)
    cps_weight_done = sum(
        cp.weight for cp in checkpoints if cp.status in CHECKPOINT_DONE_STATUSES
    )

    tasks_pct = (tasks_done / tasks_total) if tasks_total else None
    cps_pct = (cps_weight_done / cps_weight_total) if cps_weight_total else None

    if tasks_pct is not None and cps_pct is not None:
        progress_pct = 0.5 * tasks_pct + 0.5 * cps_pct
    elif tasks_pct is not None:
        progress_pct = tasks_pct
    elif cps_pct is not None:
        progress_pct = cps_pct
    else:
        progress_pct = 0.0

    # Просрочка этапа: плановый конец прошёл (не завершён) ИЛИ любая
    # задача/точка просрочена. Количество дней — максимум по всем просрочкам.
    overdue = False
    overdue_days = 0
    if stage.actual_end is None and stage.planned_end is not None and stage.planned_end < today:
        overdue = True
        overdue_days = max(overdue_days, (today - stage.planned_end).days)
    for t in tasks:
        overdue_days = max(overdue_days, _task_overdue_days(t, today))
    for cp in checkpoints:
        overdue_days = max(overdue_days, _checkpoint_overdue_days(cp, today))
    overdue = overdue or overdue_days > 0

    if overdue and status != STAGE_STATUS_COMPLETED:
        status = STAGE_STATUS_OVERDUE

    return StageProgress(
        status=status,
        overdue=overdue,
        overdue_days=overdue_days,
        progress_pct=round(progress_pct * 100, 1),
        tasks_total=tasks_total,
        tasks_done=tasks_done,
        tasks_overdue=tasks_overdue,
        checkpoints_total=cps_total,
        checkpoints_done=cps_done,
        checkpoints_overdue=cps_overdue,
    )
