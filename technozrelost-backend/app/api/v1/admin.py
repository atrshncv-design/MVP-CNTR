"""Администрирование: глобальный append-only аудит (тикет 13), обезличивание
(тикет 04), операционная аналитика (ops/05) и kill switches (security/03).

Аналитика: GET /admin/analytics (только cntr_admin/cntr_manager; внешние
роли → 403) — сводка показателей по данным БД с метаданными
(definition/source/computed_at) и фильтрами (period_from/to, status);
GET /admin/analytics/export (staff; CSV/JSON) — те же агрегаты без PII.

Kill switches: GET/POST /admin/kill-switches — runtime-переключение контуров
(только staff), каждое переключение в append-only аудите (без секретов).
"""

from __future__ import annotations

import csv
import io
import json
from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, require_role, require_staff_mfa
from app.db.models import AuditTrailEntry, DeletionRequest, User
from app.schemas import (
    AnalyticsSummaryOut,
    AuditTrailEntryOut,
    DeletionRequestOut,
    KillSwitchIn,
    KillSwitchOut,
)
from app.services import kill_switches
from app.services.analytics import compute_analytics
from app.services.consent_service import process_deletion_request

router = APIRouter(prefix="/admin", tags=["admin"])

AdminOnly = require_role("cntr_admin")

# Аналитика и kill switches доступны только сотрудникам Центра.
AnalyticsStaff = require_role("cntr_admin", "cntr_manager")
StaffOnly = require_role("cntr_admin", "cntr_manager")


def _at_out(entry: AuditTrailEntry, user_name: str | None = None) -> AuditTrailEntryOut:
    return AuditTrailEntryOut(
        id=entry.id,
        project_id=entry.project_id,
        user_id=entry.user_id,
        user_name=user_name or "—",
        action=entry.action,
        details=entry.details or {},
        created_at=entry.created_at.isoformat() if entry.created_at else None,
    )


@router.get("/audit", response_model=list[AuditTrailEntryOut])
async def global_audit(
    db: DBSession,
    user: CurrentUser,
    project_id: int | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
) -> list[AuditTrailEntryOut]:
    """Глобальный аудит append-only: все события платформы (администратор).

    Записи не редактируются и не удаляются — только чтение; новые события
    дописываются бизнес-логикой (AuditTrailEntry в assessment/manager/stages).
    """
    await AdminOnly(user)
    await require_staff_mfa(user, db)  # MFA-гейт служебного кабинета (тикет 02)
    stmt = (
        select(AuditTrailEntry, User.full_name)
        .outerjoin(User, AuditTrailEntry.user_id == User.id)
        .order_by(AuditTrailEntry.id.desc())
        .limit(limit)
    )
    if project_id is not None:
        stmt = stmt.where(AuditTrailEntry.project_id == project_id)
    if action:
        stmt = stmt.where(AuditTrailEntry.action == action)
    rows = await db.execute(stmt)
    return [_at_out(entry, name) for entry, name in rows]


# ─── Удаление/обезличивание аккаунтов (тикет 04) ────────────────────────────


def _deletion_out(request: DeletionRequest) -> DeletionRequestOut:
    return DeletionRequestOut(
        id=request.id,
        user_id=request.user_id,
        requested_at=request.requested_at.isoformat(),
        processed_at=request.processed_at.isoformat() if request.processed_at else None,
        state=request.state,
        requested_by=request.requested_by,
    )


@router.get("/deletion-requests", response_model=list[DeletionRequestOut])
async def list_deletion_requests(
    db: DBSession,
    user: CurrentUser,
    state: str | None = Query(None, description="pending | processing | completed | rejected"),
    limit: int = Query(100, ge=1, le=500),
) -> list[DeletionRequestOut]:
    """Очередь запросов на удаление (администратор; MFA-гейт служебного кабинета)."""
    await AdminOnly(user)
    await require_staff_mfa(user, db)
    stmt = select(DeletionRequest).order_by(DeletionRequest.requested_at.desc()).limit(limit)
    if state:
        stmt = stmt.where(DeletionRequest.state == state)
    rows = (await db.execute(stmt)).scalars().all()
    return [_deletion_out(r) for r in rows]


@router.post("/deletion-requests/{request_id}/process", response_model=DeletionRequestOut)
async def process_request(
    request_id: int, db: DBSession, user: CurrentUser
) -> DeletionRequestOut:
    """Обработка запроса: необратимое обезличивание PII пользователя.

    Аудит account.deletion_processed (без PII); audit_trail/проекты/документы
    сохраняются с обезличенным автором. Идемпотентность: повторный process
    завершённого запроса — no-op (200, данные не меняются).
    """
    await AdminOnly(user)
    await require_staff_mfa(user, db)
    request = await db.get(DeletionRequest, request_id)
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запрос на удаление не найден")
    request = await process_deletion_request(db, request, processed_by=user.id)
    await db.commit()
    await db.refresh(request)
    return _deletion_out(request)


# ─── Операционная аналитика (ops/05) ────────────────────────────────────────


@router.get("/analytics", response_model=AnalyticsSummaryOut)
async def analytics_summary(
    db: DBSession,
    user: CurrentUser,
    period_from: Annotated[date | None, Query(description="Начало периода (по created_at)")] = None,
    period_to: Annotated[date | None, Query(description="Конец периода (по created_at)")] = None,
    status_filter: Annotated[
        str | None, Query(alias="status", description="Фильтр проектов по статусу")
    ] = None,
) -> dict:
    """Операционная аналитика Центра: сводка показателей с метаданными.

    Только cntr_admin/cntr_manager; внешние роли → 403. Показатели — чистые
    SQL-агрегаты по данным БД (детерминированно, без LLM); каждый показатель
    несёт definition/source/computed_at. Фильтры: period_from/to — по
    created_at соответствующих таблиц, status — по projects.status.
    """
    await AnalyticsStaff(user)
    return await compute_analytics(
        db,
        period_from=period_from,
        period_to=period_to,
        status=status_filter,
    )


@router.get("/analytics/export")
async def analytics_export(
    db: DBSession,
    user: CurrentUser,
    format: Annotated[str, Query(pattern="^(json|csv)$")] = "json",
    period_from: Annotated[date | None, Query()] = None,
    period_to: Annotated[date | None, Query()] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> Response:
    """Экспорт аналитики (staff): те же агрегаты, без PII-списков.

    format=json — структура сводки; format=csv — плоская таблица
    metric,value,definition,source,computed_at. Внешние роли → 403.
    Экспорт содержит ТОЛЬКО агрегаты — ни списков пользователей, ни email.
    """
    await AnalyticsStaff(user)
    summary = await compute_analytics(
        db,
        period_from=period_from,
        period_to=period_to,
        status=status_filter,
    )
    metrics: dict = summary["metrics"]

    if format == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["metric", "value", "definition", "source", "computed_at"])
        for key in sorted(metrics):
            m = metrics[key]
            value = m["value"]
            if isinstance(value, dict):
                value = json.dumps(value, ensure_ascii=False, sort_keys=True)
            writer.writerow([key, value, m["definition"], m["source"], m["computed_at"]])
        filename = f"analytics-{date.today().isoformat()}.csv"
        return Response(
            content=buffer.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return Response(content=json.dumps(summary, ensure_ascii=False), media_type="application/json")


# ─── Kill switches (security/03) ─────────────────────────────────────────────


@router.get("/kill-switches", response_model=list[KillSwitchOut])
async def kill_switches_status(
    db: DBSession,
    user: CurrentUser,
) -> list[KillSwitchOut]:
    """Текущее состояние контуров (тикет 03): только staff.

    Runtime-переопределения видны сразу; после рестарта процесс возвращается
    к значениям settings (REGISTRATION_ENABLED и т.п.).
    """
    await StaffOnly(user)
    return [
        KillSwitchOut(name=name, enabled=enabled)
        for name, enabled in kill_switches.snapshot().items()
    ]


@router.post("/kill-switches/{name}", response_model=KillSwitchOut)
async def set_kill_switch(
    name: str,
    payload: KillSwitchIn,
    db: DBSession,
    user: CurrentUser,
) -> KillSwitchOut:
    """Переключает контур на лету (тикет 03): только staff.

    Каждое переключение фиксируется в append-only аудите
    (kill_switch.changed — без секретов). Отключённый контур отвечает 503.
    """
    await StaffOnly(user)
    if name not in kill_switches.CIRCUITS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Неизвестный контур: {name}. Допустимые: {', '.join(kill_switches.CIRCUITS)}",
        )
    kill_switches.set_enabled(name, payload.enabled)
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="kill_switch.changed",
            details={"name": name, "enabled": payload.enabled},
        )
    )
    await db.commit()
    return KillSwitchOut(name=name, enabled=payload.enabled)
