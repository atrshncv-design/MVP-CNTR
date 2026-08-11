"""Доработка проекта уровнями N→N+1: требования этапа, документы, автозаявка (тикет 23).

- GET  /projects/{id}/stage-requirements — требования текущего этапа + статус комплекта
- POST /projects/{id}/stage-documents    — загрузка документа этапа; при полном комплекте
                                           автосоздание заявки на повышение + предварительная
                                           оценка LLM (RAG по ГОСТам)
- POST /projects/{id}/stage-evaluate     — повторный запуск предварительной оценки
"""

from __future__ import annotations

import hashlib
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from app.api.v1.manager import notify_managers
from app.api.v1.projects import require_project_access
from app.core.deps import CurrentUser, DBSession, has_role, is_cntr_staff
from app.db.models import (
    AuditTrailEntry,
    ControlPoint,
    Project,
    ProjectDocument,
    ProjectMember,
    ProjectStage,
    PromotionRequest,
    PromotionRequestDocument,
    StageRequirement,
    StageTask,
    User,
)
from app.schemas import (
    StageCheckpointDecideIn,
    StageCheckpointIn,
    StageCheckpointOut,
    StageCreateIn,
    StageDocumentIn,
    StageDocumentOut,
    StageEvaluateOut,
    StageEvidenceIn,
    StageHistoryOut,
    StageListOut,
    StageOut,
    StageProgressOut,
    StageRequirementOut,
    StageTaskIn,
    StageTaskOut,
    StageTaskUpdateIn,
    StageUpdateIn,
)
from app.services.ai_assistant import ask_llm
from app.services.file_storage import FileStorageError, scanner, store_project_file
from app.services.stage_progress import (
    CheckpointSnapshot,
    StageSnapshot,
    TaskSnapshot,
    compute_progress,
)

router = APIRouter(prefix="/projects", tags=["stages"])
stage_router = APIRouter(prefix="/stages", tags=["stages"])

MAX_LEVEL = 9


async def _current_stage(db: DBSession, project: Project) -> StageRequirement | None:
    if project.current_level >= MAX_LEVEL:
        return None
    return await db.scalar(
        select(StageRequirement).where(
            StageRequirement.from_level == project.current_level
        )
    )


async def _stage_reqs_with_status(
    db: DBSession, project: Project, stage: StageRequirement
) -> list[StageRequirementOut]:
    requirements = (
        (
            await db.execute(
                select(StageRequirement).where(
                    StageRequirement.from_level == stage.from_level
                )
            )
        )
        .scalars()
        .all()
    )
    doc_rows = (
        (
            await db.execute(
                select(ProjectDocument).where(
                    ProjectDocument.project_id == project.id,
                    ProjectDocument.doc_type == "stage",
                    ProjectDocument.stage_requirement_id.isnot(None),
                )
            )
        )
        .scalars()
        .all()
    )
    # Учитывается только clean-файл либо legacy-текст без storage_key (тикеты 06/07)
    uploaded_ids = {
        d.stage_requirement_id
        for d in doc_rows
        if d.storage_key is None or d.scan_status == "clean"
    }
    return [
        StageRequirementOut(
            id=r.id,
            from_level=r.from_level,
            to_level=r.to_level,
            title=r.title,
            description=r.description,
            template_version=r.template_version,
            uploaded=r.id in uploaded_ids,
        )
        for r in requirements
    ]


async def _evaluate(
    project: Project, stage: StageRequirement, docs: list[ProjectDocument]
) -> tuple[bool | None, list[str], str]:
    """Оценка комплекта LLM по ГОСТам (RAG). При отсутствии LLM — unavailable (None)."""
    if not docs:
        return False, [stage.title], "Комплект документов этапа не собран."

    docs_text = "\n".join(f"- {d.title}: {str(d.file_url or '')[:600]}" for d in docs)
    system = (
        "Ты — методолог платформы «Технозрелость» (ГОСТ Р 58048-2017). "
        f"Оцени, подтверждают ли документы переход проекта с УГТ "
        f"{stage.from_level} на УГТ {stage.to_level}. "
        "Ответь строго в формате:\n"
        "SUCCESS — если документы достаточны;\n"
        "FAIL — если не хватает материалов;\n"
        "первая строка: SUCCESS или FAIL;\n"
        "затем строка SUMMARY: краткое заключение;\n"
        "затем строки MISSING: <чего не хватает> (по одной)."
    )
    user_msg = (
        f"Проект: {project.name}.\n"
        f"Требование этапа УГТ {stage.from_level}→{stage.to_level}: {stage.title}.\n"
        f"Загруженные документы:\n{docs_text}"
    )

    answer = await ask_llm(system, user_msg)
    if not answer:
        # LLM недоступна — не пропускаем молча
        return None, [], "Оценка недоступна: языковая модель не настроена."

    success = "SUCCESS" in answer.upper()
    missing = [
        line[8:].strip()
        for line in answer.splitlines()
        if line.upper().startswith("MISSING:")
    ]
    summary = next(
        (line[8:].strip() for line in answer.splitlines() if line.upper().startswith("SUMMARY:")),
        "",
    )
    return success, missing, summary


async def _latest_request(db: DBSession, project_id: int) -> PromotionRequest | None:
    return await db.scalar(
        select(PromotionRequest)
        .where(PromotionRequest.project_id == project_id)
        .order_by(PromotionRequest.attempt_no.desc())
    )


@router.get("/{project_id}/stage-requirements", response_model=list[StageRequirementOut])
async def stage_requirements(
    project_id: int, db: DBSession, user: CurrentUser
) -> list[StageRequirementOut]:
    await require_project_access(db, project_id, user)
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    if project.status != "published":
        raise HTTPException(status.HTTP_409_CONFLICT, "Проект ещё не опубликован менеджером")
    stage = await _current_stage(db, project)
    if stage is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Проект достиг максимального УГТ 9")
    return await _stage_reqs_with_status(db, project, stage)


async def _next_version(db: DBSession, project_id: int, title: str) -> int:
    from sqlalchemy import func as sqla_func

    current = await db.scalar(
        select(sqla_func.max(ProjectDocument.version)).where(
            ProjectDocument.project_id == project_id,
            ProjectDocument.title == title,
        )
    )
    return (current or 0) + 1


async def _trigger_application(
    db: DBSession, project: Project, doc: ProjectDocument, user: CurrentUser
) -> dict:
    """Автотриггер: полный комплект → заявка на повышение (снимок версий)."""
    result: dict = {"doc_id": doc.id, "request_id": None, "request_status": None}

    stage = await _current_stage(db, project)
    if stage is not None:
        reqs = await _stage_reqs_with_status(db, project, stage)
        if all(r.uploaded for r in reqs):
            active = await db.scalar(
                select(PromotionRequest)
                .where(
                    PromotionRequest.project_id == project.id,
                    PromotionRequest.from_level == project.current_level,
                    PromotionRequest.status.in_(
                        ["docs_uploaded", "pre_evaluated",
                         "evaluation_unavailable", "pending_manager"]
                    ),
                )
            )
            if active is not None:
                request = active
                attempt = active.attempt_no
            else:
                previous = await _latest_request(db, project.id)
                # US 56: неизменённый отклонённый комплект не создаёт новую заявку.
                # Неизменность определяется по контенту (sha256) на требование.
                if previous is not None and previous.status == "rejected":
                    snapshot_rows = (
                        await db.execute(
                            select(
                                PromotionRequestDocument.project_document_id,
                                PromotionRequestDocument.document_version,
                            ).where(
                                PromotionRequestDocument.promotion_request_id
                                == previous.id
                            )
                        )
                    ).all()
                    snap_docs = {
                        d.id: d
                        for d in (
                            await db.execute(
                                select(ProjectDocument).where(
                                    ProjectDocument.id.in_(
                                        [r.project_document_id for r in snapshot_rows]
                                    )
                                )
                            )
                        ).scalars().all()
                    } if snapshot_rows else {}
                    snapshot = {
                        d.stage_requirement_id: (
                            d.sha256
                            or hashlib.sha256((d.file_url or "").encode()).hexdigest()
                        )
                        for r in snapshot_rows
                        if (d := snap_docs.get(r.project_document_id)) is not None
                    }
                    current_docs = list(
                        (
                            await db.execute(
                                select(ProjectDocument).where(
                                    ProjectDocument.project_id == project.id,
                                    ProjectDocument.doc_type == "stage",
                                    ProjectDocument.stage_requirement_id.isnot(None),
                                )
                            )
                        )
                        .scalars()
                        .all()
                    )
                    current = {
                        d.stage_requirement_id: (
                            d.sha256
                            or hashlib.sha256((d.file_url or "").encode()).hexdigest()
                        )
                        for d in current_docs
                        if d.storage_key is None or d.scan_status == "clean"
                    }
                    if current == snapshot and current:
                        raise HTTPException(
                            status.HTTP_409_CONFLICT,
                            "Комплект не изменён после отклонения — "
                            "загрузите исправленные документы",
                        )
                attempt = (previous.attempt_no + 1) if previous else 1
                request = PromotionRequest(
                    project_id=project.id,
                    from_level=project.current_level,
                    to_level=project.current_level + 1,
                    status="docs_uploaded",
                    attempt_no=attempt,
                )
                db.add(request)
                await db.flush()
                # Снимок версий документов заявки (тикет 07)
                for d in (
                    await db.execute(
                        select(ProjectDocument).where(
                            ProjectDocument.project_id == project.id,
                            ProjectDocument.doc_type == "stage",
                            ProjectDocument.stage_requirement_id.isnot(None),
                        )
                    )
                ).scalars().all():
                    db.add(
                        PromotionRequestDocument(
                            promotion_request_id=request.id,
                            project_document_id=d.id,
                            document_version=d.version,
                        )
                    )

            docs = list(
                (
                    await db.execute(
                        select(ProjectDocument).where(
                            ProjectDocument.project_id == project.id,
                            ProjectDocument.doc_type == "stage",
                        )
                    )
                )
                .scalars()
                .all()
            )
            success, missing, summary = await _evaluate(project, stage, docs)
            request.evaluation_result = {
                "success": success,
                "missing": missing,
                "summary": summary,
            }
            if success is True:
                request.status = "pending_manager"
                await notify_managers(
                    db,
                    "promotion.pending",
                    f"Автозаявка на повышение УГТ {project.name}",
                    {"project_id": project.id, "request_id": request.id},
                )
            elif success is None:
                request.status = "evaluation_unavailable"
            db.add(
                AuditTrailEntry(
                    project_id=project.id,
                    user_id=user.id,
                    action="promotion.requested",
                    details={
                        "attempt": attempt,
                        "success": success,
                        "request_id": request.id,
                    },
                )
            )
            result = {
                "doc_id": doc.id,
                "request_id": request.id,
                "request_status": request.status,
                "evaluation_success": success,
            }
    await db.commit()
    return result


@router.post(
    "/{project_id}/stage-document-file", status_code=status.HTTP_201_CREATED
)
async def upload_stage_document_file(
    project_id: int,
    db: DBSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File()],
    stage_requirement_id: Annotated[int, Form()],
    title: Annotated[str | None, Form()] = None,
) -> dict:
    """Загрузка документа этапа файлом (PDF/DOCX/XLSX/PNG/JPEG ≤25 МБ).

    Только clean-файл засчитывается в комплект и инициирует автозаявку.
    """
    await require_project_access(db, project_id, user)
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    if project.status != "published":
        raise HTTPException(status.HTTP_409_CONFLICT, "Проект ещё не опубликован менеджером")
    if project.current_level >= MAX_LEVEL:
        raise HTTPException(status.HTTP_409_CONFLICT, "Проект достиг максимального УГТ 9")

    requirement = await db.get(StageRequirement, stage_requirement_id)
    if requirement is None or requirement.from_level != project.current_level:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Требование не относится к текущему этапу проекта",
        )

    data = await file.read()
    try:
        stored = store_project_file(project.id, file.filename or "document", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    scan_status, scan_result = await scanner.scan(data)

    doc_title = title or (file.filename or "Документ")
    doc = ProjectDocument(
        project_id=project.id,
        title=doc_title,
        doc_type="stage",
        version=await _next_version(db, project.id, doc_title),
        storage_key=stored.storage_key,
        file_name=file.filename or "document",
        file_size=stored.size,
        mime_type=stored.mime_type,
        sha256=stored.sha256,
        scan_status=scan_status,
        scan_result=scan_result,
        stage_requirement_id=requirement.id,
        status="active",
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.flush()

    if scan_status != "clean":
        # Заражённый/непроверенный файл не инициирует заявку (тикеты 06/07)
        await db.commit()
        return {
            "doc_id": doc.id,
            "request_id": None,
            "request_status": None,
            "scan_status": scan_status,
            "evaluation_success": None,
        }
    return await _trigger_application(db, project, doc, user)


@router.post("/{project_id}/stage-documents", status_code=status.HTTP_201_CREATED)
async def upload_stage_document(
    project_id: int,
    payload: StageDocumentIn,
    db: DBSession,
    user: CurrentUser,
) -> dict:
    """Загрузка документа этапа. Полный комплект → автозаявка на повышение УГТ."""
    await require_project_access(db, project_id, user)
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    if project.status != "published":
        raise HTTPException(status.HTTP_409_CONFLICT, "Проект ещё не опубликован менеджером")
    if project.current_level >= MAX_LEVEL:
        raise HTTPException(status.HTTP_409_CONFLICT, "Проект достиг максимального УГТ 9")

    requirement = await db.get(StageRequirement, payload.stage_requirement_id)
    if requirement is None or requirement.from_level != project.current_level:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Требование не относится к текущему этапу проекта",
        )

    doc = ProjectDocument(
        project_id=project.id,
        title=payload.title,
        doc_type="stage",
        file_url=payload.content,
        stage_requirement_id=requirement.id,
        status="active",
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.flush()

    return await _trigger_application(db, project, doc, user)


@router.post("/{project_id}/stage-evaluate", response_model=StageEvaluateOut)
async def stage_evaluate(
    project_id: int, db: DBSession, user: CurrentUser
) -> StageEvaluateOut:
    """Повторный запуск предварительной оценки комплекта (после дозагрузки)."""
    await require_project_access(db, project_id, user)
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")

    request = await _latest_request(db, project.id)
    if request is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Заявка не создана — загрузите документы этапа"
        )

    stage = await db.scalar(
        select(StageRequirement).where(StageRequirement.from_level == request.from_level)
    )
    if stage is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Этап не найден в словаре")

    docs = list(
        (
            await db.execute(
                select(ProjectDocument).where(
                    ProjectDocument.project_id == project.id,
                    ProjectDocument.doc_type == "stage",
                )
            )
        )
        .scalars()
        .all()
    )
    success, missing, summary = await _evaluate(project, stage, docs)
    request.evaluation_result = {
        "success": success,
        "missing": missing,
        "summary": summary,
    }
    if success and request.status in ("docs_uploaded", "pre_evaluated"):
        request.status = "pending_manager"
        await notify_managers(
            db,
            "promotion.pending",
            f"Автозаявка на повышение УГТ {project.name}",
            {"project_id": project.id, "request_id": request.id},
        )

    await db.commit()
    await db.refresh(request)
    return StageEvaluateOut(
        request_id=request.id,
        success=success,
        missing=missing,
        summary=summary,
    )


# ─── Тикет 01 operations-modules: универсальное сопровождение этапа ─────────
# Сквозной экран этапа: ответственный, задачи, сроки, контрольные точки,
# план/факт, доказательства (versioned), история (audit). Просрочки/прогресс —
# детерминированный расчёт app.services.stage_progress (без LLM).

STAGE_AUDIT_ACTIONS = (
    "stage.created",
    "stage.updated",
    "task.created",
    "task.updated",
    "task.completed",
    "checkpoint.created",
    "checkpoint.decided",
    "stage.document_uploaded",
)


async def _get_stage(db: DBSession, stage_id: int) -> ProjectStage:
    stage = await db.get(ProjectStage, stage_id)
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Этап не найден")
    return stage


async def _stage_project(
    db: DBSession, stage: ProjectStage, user: CurrentUser
) -> Project:
    """Доступ к этапу = доступ к его проекту (require_project_access, IDOR → 404)."""
    return await require_project_access(db, stage.project_id, user)


async def _is_project_owner(db: DBSession, project: Project, user: CurrentUser) -> bool:
    if project.created_by == user.id:
        return True
    membership = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
            ProjectMember.is_project_admin.is_(True),
        )
    )
    return membership is not None


async def _require_stage_manager(
    db: DBSession, project: Project, user: CurrentUser
) -> None:
    """Управление этапом: владелец проекта (создатель/админ) или персонал ЦНТР."""
    if user.is_superuser or is_cntr_staff(user):
        return
    if await _is_project_owner(db, project, user):
        return
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        "Этап управляет владелец проекта или сотрудник ЦНТР",
    )


def _audit_stage(
    db: DBSession,
    stage: ProjectStage,
    user: CurrentUser,
    action: str,
    **details: object,
) -> None:
    db.add(
        AuditTrailEntry(
            project_id=stage.project_id,
            user_id=user.id,
            action=action,
            details={"stage_id": stage.id, **details},
        )
    )


async def _stage_tasks(db: DBSession, stage_id: int) -> list[StageTask]:
    return list(
        (
            await db.execute(
                select(StageTask)
                .where(StageTask.stage_id == stage_id)
                .order_by(StageTask.id)
            )
        )
        .scalars()
        .all()
    )


async def _stage_checkpoints(db: DBSession, stage_id: int) -> list[ControlPoint]:
    return list(
        (
            await db.execute(
                select(ControlPoint)
                .where(ControlPoint.stage_id == stage_id)
                .order_by(ControlPoint.id)
            )
        )
        .scalars()
        .all()
    )


async def _stage_documents(db: DBSession, stage_id: int) -> list[ProjectDocument]:
    return list(
        (
            await db.execute(
                select(ProjectDocument)
                .where(ProjectDocument.stage_id == stage_id)
                .order_by(ProjectDocument.created_at, ProjectDocument.id)
            )
        )
        .scalars()
        .all()
    )


async def _stage_history(db: DBSession, stage: ProjectStage) -> list[AuditTrailEntry]:
    return list(
        (
            await db.execute(
                select(AuditTrailEntry)
                .where(
                    AuditTrailEntry.project_id == stage.project_id,
                    AuditTrailEntry.details["stage_id"].astext == str(stage.id),
                )
                .order_by(AuditTrailEntry.created_at.desc(), AuditTrailEntry.id.desc())
            )
        )
        .scalars()
        .all()
    )


def _stage_progress(
    stage: ProjectStage, tasks: list[StageTask], checkpoints: list[ControlPoint]
) -> StageProgressOut:
    snap = StageSnapshot(
        status=stage.status,
        planned_start=stage.planned_start_date,
        planned_end=stage.planned_end_date,
        actual_start=stage.actual_start_date,
        actual_end=stage.actual_end_date,
    )
    task_snaps = [TaskSnapshot(status=t.status, due_date=t.due_date) for t in tasks]
    cp_snaps = [
        CheckpointSnapshot(status=cp.status, due_date=cp.due_date, weight=cp.weight)
        for cp in checkpoints
    ]
    progress = compute_progress(snap, task_snaps, cp_snaps, date.today())
    return StageProgressOut(
        status=progress.status,
        overdue=progress.overdue,
        overdue_days=progress.overdue_days,
        progress_pct=progress.progress_pct,
        tasks_total=progress.tasks_total,
        tasks_done=progress.tasks_done,
        tasks_overdue=progress.tasks_overdue,
        checkpoints_total=progress.checkpoints_total,
        checkpoints_done=progress.checkpoints_done,
        checkpoints_overdue=progress.checkpoints_overdue,
    )


def _task_out(t: StageTask) -> StageTaskOut:
    return StageTaskOut(
        id=t.id,
        stage_id=t.stage_id,
        title=t.title,
        description=t.description,
        status=t.status,
        assignee_id=t.assignee_id,
        due_date=t.due_date.isoformat() if t.due_date else None,
        completed_at=t.completed_at.isoformat() if t.completed_at else None,
        created_at=t.created_at.isoformat() if t.created_at else None,
        updated_at=t.updated_at.isoformat() if t.updated_at else None,
    )


def _stage_cp_out(cp: ControlPoint) -> StageCheckpointOut:
    return StageCheckpointOut(
        id=cp.id,
        stage_id=cp.stage_id or 0,
        project_id=cp.project_id,
        title=cp.title,
        description=cp.description,
        point_type=cp.point_type,
        status=cp.status,
        decision=cp.decision,
        decided_by=cp.decided_by,
        decided_at=cp.decided_at.isoformat() if cp.decided_at else None,
        due_date=cp.due_date.isoformat() if cp.due_date else None,
        weight=cp.weight,
        created_at=cp.created_at.isoformat() if cp.created_at else None,
    )


def _stage_doc_out(d: ProjectDocument) -> StageDocumentOut:
    return StageDocumentOut(
        id=d.id,
        stage_id=d.stage_id or 0,
        project_id=d.project_id,
        title=d.title,
        doc_type=d.doc_type,
        version=d.version,
        file_url=d.file_url,
        file_name=d.file_name,
        file_size=d.file_size,
        mime_type=d.mime_type,
        scan_status=d.scan_status,
        status=d.status,
        uploaded_by=d.uploaded_by,
        created_at=d.created_at.isoformat() if d.created_at else None,
    )


def _stage_list_out(
    stage: ProjectStage, progress: StageProgressOut
) -> StageListOut:
    return StageListOut(
        id=stage.id,
        project_id=stage.project_id,
        from_level=stage.from_level,
        to_level=stage.to_level,
        title=stage.title,
        description=stage.description,
        status=stage.status,
        responsible_id=stage.responsible_id,
        planned_start_date=(
            stage.planned_start_date.isoformat() if stage.planned_start_date else None
        ),
        planned_end_date=(
            stage.planned_end_date.isoformat() if stage.planned_end_date else None
        ),
        actual_start_date=(
            stage.actual_start_date.isoformat() if stage.actual_start_date else None
        ),
        actual_end_date=(
            stage.actual_end_date.isoformat() if stage.actual_end_date else None
        ),
        plan_result=stage.plan_result if isinstance(stage.plan_result, dict) else {},
        fact_result=stage.fact_result if isinstance(stage.fact_result, dict) else {},
        progress=progress,
        created_by=stage.created_by,
        created_at=stage.created_at.isoformat() if stage.created_at else None,
        updated_at=stage.updated_at.isoformat() if stage.updated_at else None,
    )


async def _stage_full_out(
    db: DBSession, stage: ProjectStage, progress: StageProgressOut
) -> StageOut:
    tasks = await _stage_tasks(db, stage.id)
    checkpoints = await _stage_checkpoints(db, stage.id)
    documents = await _stage_documents(db, stage.id)
    return StageOut(
        **_stage_list_out(stage, progress).model_dump(),
        tasks=[_task_out(t) for t in tasks],
        checkpoints=[_stage_cp_out(cp) for cp in checkpoints],
        documents=[_stage_doc_out(d) for d in documents],
    )


async def _next_stage_doc_version(db: DBSession, stage_id: int, title: str) -> int:
    current = await db.scalar(
        select(func.max(ProjectDocument.version)).where(
            ProjectDocument.stage_id == stage_id,
            ProjectDocument.title == title,
        )
    )
    return (current or 0) + 1


# ─── Создание этапа (в контексте проекта) ────────────────────────────────────


@router.post(
    "/{project_id}/stages", response_model=StageOut, status_code=status.HTTP_201_CREATED
)
async def create_stage(
    project_id: int,
    payload: StageCreateIn,
    db: DBSession,
    user: CurrentUser,
) -> StageOut:
    """Создание этапа сопровождения: владелец проекта или персонал ЦНТР."""
    project = await require_project_access(db, project_id, user)
    await _require_stage_manager(db, project, user)

    if payload.responsible_id is not None:
        responsible = await db.get(User, payload.responsible_id)
        if responsible is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Ответственный не найден"
            )
    from_level = payload.from_level if payload.from_level is not None else project.current_level
    to_level = payload.to_level if payload.to_level is not None else from_level + 1
    if not (0 <= from_level <= 9 and 1 <= to_level <= 9 and to_level > from_level):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Некорректный диапазон этапа: 0 ≤ from_level < to_level ≤ 9",
        )

    stage = ProjectStage(
        project_id=project.id,
        from_level=from_level,
        to_level=to_level,
        title=payload.title,
        description=payload.description,
        status="planned",
        responsible_id=payload.responsible_id,
        planned_start_date=payload.planned_start_date,
        planned_end_date=payload.planned_end_date,
        plan_result=payload.plan_result or {},
        created_by=user.id,
    )
    db.add(stage)
    await db.flush()
    _audit_stage(db, stage, user, "stage.created", title=stage.title)
    await db.commit()
    await db.refresh(stage)
    tasks = await _stage_tasks(db, stage.id)
    checkpoints = await _stage_checkpoints(db, stage.id)
    return await _stage_full_out(db, stage, _stage_progress(stage, tasks, checkpoints))


# ─── Карточка этапа ───────────────────────────────────────────────────────────


@stage_router.get("/{stage_id}", response_model=StageOut)
async def get_stage(
    stage_id: int, db: DBSession, user: CurrentUser
) -> StageOut:
    """Полная карточка этапа: участники проекта видят/меняют свои поля."""
    stage = await _get_stage(db, stage_id)
    await _stage_project(db, stage, user)
    tasks = await _stage_tasks(db, stage.id)
    checkpoints = await _stage_checkpoints(db, stage.id)
    return await _stage_full_out(db, stage, _stage_progress(stage, tasks, checkpoints))


@stage_router.get("/{stage_id}/tasks", response_model=list[StageTaskOut])
async def list_stage_tasks(
    stage_id: int, db: DBSession, user: CurrentUser
) -> list[StageTaskOut]:
    stage = await _get_stage(db, stage_id)
    await _stage_project(db, stage, user)
    return [_task_out(t) for t in await _stage_tasks(db, stage.id)]


@stage_router.get("/{stage_id}/checkpoints", response_model=list[StageCheckpointOut])
async def list_stage_checkpoints(
    stage_id: int, db: DBSession, user: CurrentUser
) -> list[StageCheckpointOut]:
    stage = await _get_stage(db, stage_id)
    await _stage_project(db, stage, user)
    return [_stage_cp_out(cp) for cp in await _stage_checkpoints(db, stage.id)]


@stage_router.get("/{stage_id}/documents", response_model=list[StageDocumentOut])
async def list_stage_documents(
    stage_id: int, db: DBSession, user: CurrentUser
) -> list[StageDocumentOut]:
    stage = await _get_stage(db, stage_id)
    await _stage_project(db, stage, user)
    return [_stage_doc_out(d) for d in await _stage_documents(db, stage.id)]


@stage_router.get("/{stage_id}/history", response_model=list[StageHistoryOut])
async def stage_history(
    stage_id: int, db: DBSession, user: CurrentUser
) -> list[StageHistoryOut]:
    """История этапа: audit-события stage.* / task.* / checkpoint.*."""
    stage = await _get_stage(db, stage_id)
    await _stage_project(db, stage, user)
    return [
        StageHistoryOut(
            id=a.id,
            action=a.action,
            details=a.details if isinstance(a.details, dict) else {},
            user_id=a.user_id,
            created_at=a.created_at.isoformat() if a.created_at else None,
        )
        for a in await _stage_history(db, stage)
    ]


# ─── Обновление этапа (план/факт, ответственный, сроки) ──────────────────────


@stage_router.patch("/{stage_id}", response_model=StageOut)
async def update_stage(
    stage_id: int,
    payload: StageUpdateIn,
    db: DBSession,
    user: CurrentUser,
) -> StageOut:
    """Обновление этапа: владелец проекта или персонал ЦНТР.

    Применяются только переданные поля (частичное обновление); фактические
    даты и план/факт результаты — числовые поля, без LLM.
    """
    stage = await _get_stage(db, stage_id)
    project = await _stage_project(db, stage, user)
    await _require_stage_manager(db, project, user)

    fields = payload.model_fields_set
    if "responsible_id" in fields and payload.responsible_id is not None:
        responsible = await db.get(User, payload.responsible_id)
        if responsible is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Ответственный не найден"
            )
    if "status" in fields and payload.status not in (
        "planned",
        "in_progress",
        "completed",
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Некорректный статус этапа"
        )
    if (
        "planned_end_date" in fields
        and "planned_start_date" in fields
        and payload.planned_start_date is not None
        and payload.planned_end_date is not None
        and payload.planned_end_date < payload.planned_start_date
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Плановый конец раньше планового старта",
        )

    if "title" in fields:
        stage.title = payload.title  # type: ignore[assignment]
    if "description" in fields:
        stage.description = payload.description
    if "status" in fields:
        stage.status = payload.status  # type: ignore[assignment]
    if "responsible_id" in fields:
        stage.responsible_id = payload.responsible_id
    if "planned_start_date" in fields:
        stage.planned_start_date = payload.planned_start_date
    if "planned_end_date" in fields:
        stage.planned_end_date = payload.planned_end_date
    if "actual_start_date" in fields:
        stage.actual_start_date = payload.actual_start_date
    if "actual_end_date" in fields:
        stage.actual_end_date = payload.actual_end_date
    if "plan_result" in fields:
        stage.plan_result = payload.plan_result or {}
    if "fact_result" in fields:
        stage.fact_result = payload.fact_result or {}

    _audit_stage(db, stage, user, "stage.updated", fields=sorted(fields))
    await db.commit()
    await db.refresh(stage)
    tasks = await _stage_tasks(db, stage.id)
    checkpoints = await _stage_checkpoints(db, stage.id)
    return await _stage_full_out(db, stage, _stage_progress(stage, tasks, checkpoints))


@stage_router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stage(
    stage_id: int, db: DBSession, user: CurrentUser
) -> None:
    """Удаление этапа (каскадно — задачи/точки/документы этапа): владелец/staff."""
    stage = await _get_stage(db, stage_id)
    project = await _stage_project(db, stage, user)
    await _require_stage_manager(db, project, user)
    await db.delete(stage)
    await db.commit()


# ─── Задачи этапа ─────────────────────────────────────────────────────────────


@stage_router.post(
    "/{stage_id}/tasks", response_model=StageTaskOut, status_code=status.HTTP_201_CREATED
)
async def create_stage_task(
    stage_id: int,
    payload: StageTaskIn,
    db: DBSession,
    user: CurrentUser,
) -> StageTaskOut:
    """Создание задачи этапа: владелец проекта или персонал ЦНТР."""
    stage = await _get_stage(db, stage_id)
    project = await _stage_project(db, stage, user)
    await _require_stage_manager(db, project, user)

    if payload.assignee_id is not None:
        assignee = await db.get(User, payload.assignee_id)
        if assignee is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Исполнитель не найден")

    task = StageTask(
        stage_id=stage.id,
        title=payload.title,
        description=payload.description,
        status="todo",
        assignee_id=payload.assignee_id,
        due_date=payload.due_date,
        created_by=user.id,
    )
    db.add(task)
    await db.flush()
    _audit_stage(db, stage, user, "task.created", task_id=task.id, title=task.title)
    await db.commit()
    await db.refresh(task)
    return _task_out(task)


@stage_router.patch("/{stage_id}/tasks/{task_id}", response_model=StageTaskOut)
async def update_stage_task(
    stage_id: int,
    task_id: int,
    payload: StageTaskUpdateIn,
    db: DBSession,
    user: CurrentUser,
) -> StageTaskOut:
    """Обновление задачи: владелец/staff — любые поля; исполнитель — свой статус."""
    stage = await _get_stage(db, stage_id)
    project = await _stage_project(db, stage, user)
    task = await db.get(StageTask, task_id)
    if task is None or task.stage_id != stage.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Задача не найдена")

    is_manager = user.is_superuser or is_cntr_staff(user) or await _is_project_owner(
        db, project, user
    )
    if not is_manager:
        # Участник может менять ТОЛЬКО статус своей задачи
        if task.assignee_id != user.id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Можно менять только свою задачу"
            )
        if payload.model_fields_set - {"status"}:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Участник может менять только статус своей задачи",
            )

    fields = payload.model_fields_set
    if "title" in fields:
        task.title = payload.title  # type: ignore[assignment]
    if "description" in fields:
        task.description = payload.description
    if "assignee_id" in fields:
        if payload.assignee_id is not None:
            assignee = await db.get(User, payload.assignee_id)
            if assignee is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Исполнитель не найден"
                )
        task.assignee_id = payload.assignee_id
    if "due_date" in fields:
        task.due_date = payload.due_date
    if "status" in fields and payload.status != task.status:
        if payload.status not in ("todo", "in_progress", "done"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Некорректный статус задачи"
            )
        task.status = payload.status  # type: ignore[assignment]
        task.completed_at = datetime.now(UTC) if payload.status == "done" else None

    _audit_stage(
        db,
        stage,
        user,
        "task.completed" if task.status == "done" else "task.updated",
        task_id=task.id,
        status=task.status,
    )
    await db.commit()
    await db.refresh(task)
    return _task_out(task)


@stage_router.delete(
    "/{stage_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_stage_task(
    stage_id: int,
    task_id: int,
    db: DBSession,
    user: CurrentUser,
) -> None:
    """Удаление задачи этапа: владелец/staff."""
    stage = await _get_stage(db, stage_id)
    project = await _stage_project(db, stage, user)
    await _require_stage_manager(db, project, user)
    task = await db.get(StageTask, task_id)
    if task is None or task.stage_id != stage.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Задача не найдена")
    await db.delete(task)
    await db.commit()


# ─── Контрольные точки этапа ─────────────────────────────────────────────────


@stage_router.post(
    "/{stage_id}/checkpoints",
    response_model=StageCheckpointOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_stage_checkpoint(
    stage_id: int,
    payload: StageCheckpointIn,
    db: DBSession,
    user: CurrentUser,
) -> StageCheckpointOut:
    """Создание контрольной точки этапа: владелец проекта или персонал ЦНТР."""
    stage = await _get_stage(db, stage_id)
    project = await _stage_project(db, stage, user)
    await _require_stage_manager(db, project, user)

    cp = ControlPoint(
        project_id=stage.project_id,
        stage_id=stage.id,
        title=payload.title,
        description=payload.description,
        point_type="milestone",
        status="pending",
        due_date=payload.due_date,
        weight=payload.weight,
    )
    db.add(cp)
    await db.flush()
    _audit_stage(db, stage, user, "checkpoint.created", cp_id=cp.id, title=cp.title)
    await db.commit()
    await db.refresh(cp)
    return _stage_cp_out(cp)


@stage_router.patch(
    "/{stage_id}/checkpoints/{cp_id}", response_model=StageCheckpointOut
)
async def decide_stage_checkpoint(
    stage_id: int,
    cp_id: int,
    payload: StageCheckpointDecideIn,
    db: DBSession,
    user: CurrentUser,
) -> StageCheckpointOut:
    """Решение по контрольной точке этапа: владелец/staff/аудитор. Аудит решения."""
    stage = await _get_stage(db, stage_id)
    project = await _stage_project(db, stage, user)
    is_decider = (
        user.is_superuser
        or is_cntr_staff(user)
        or await _is_project_owner(db, project, user)
        or has_role(user, "regulating_organization", "auditor")
    )
    if not is_decider:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Решение по контрольной точке принимает владелец, сотрудник ЦНТР или аудитор",
        )

    cp = await db.get(ControlPoint, cp_id)
    if cp is None or cp.stage_id != stage.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Контрольная точка не найдена"
        )

    cp.status = payload.status
    cp.decision = payload.decision
    cp.decided_by = user.id
    cp.decided_at = datetime.now(UTC)
    _audit_stage(
        db,
        stage,
        user,
        "checkpoint.decided",
        cp_id=cp.id,
        status=payload.status,
        decision=payload.decision,
    )
    await db.commit()
    await db.refresh(cp)
    return _stage_cp_out(cp)


# ─── Доказательства этапа (документы versioned) ──────────────────────────────


@stage_router.post(
    "/{stage_id}/documents",
    response_model=StageDocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_stage_evidence(
    stage_id: int,
    payload: StageEvidenceIn,
    db: DBSession,
    user: CurrentUser,
) -> StageDocumentOut:
    """Доказательство этапа текстом/ссылкой: любой участник проекта.

    Документ versioned: повторная загрузка с тем же названием создаёт
    следующую версию (история версий сохраняется).
    """
    stage = await _get_stage(db, stage_id)
    await _stage_project(db, stage, user)

    doc = ProjectDocument(
        project_id=stage.project_id,
        stage_id=stage.id,
        title=payload.title,
        doc_type="stage_evidence",
        file_url=payload.content,
        status="active",
        version=await _next_stage_doc_version(db, stage.id, payload.title),
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.flush()
    _audit_stage(
        db,
        stage,
        user,
        "stage.document_uploaded",
        doc_id=doc.id,
        version=doc.version,
        title=doc.title,
    )
    await db.commit()
    await db.refresh(doc)
    return _stage_doc_out(doc)


@stage_router.post(
    "/{stage_id}/documents/file",
    response_model=StageDocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_stage_evidence_file(
    stage_id: int,
    db: DBSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File(description="PDF/DOCX/XLSX/PNG/JPEG до 25 МБ")],
    title: str | None = None,
) -> StageDocumentOut:
    """Доказательство этапа файлом (сканирование, MinIO/диск): любой участник."""
    stage = await _get_stage(db, stage_id)
    await _stage_project(db, stage, user)

    data = await file.read()
    try:
        stored = store_project_file(stage.project_id, file.filename or "document", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    scan_status, scan_result = await scanner.scan(data)

    doc_title = title or (file.filename or "Документ")
    doc = ProjectDocument(
        project_id=stage.project_id,
        stage_id=stage.id,
        title=doc_title,
        doc_type="stage_evidence",
        storage_key=stored.storage_key,
        file_name=file.filename or "document",
        file_size=stored.size,
        mime_type=stored.mime_type,
        sha256=stored.sha256,
        scan_status=scan_status,
        scan_result=scan_result,
        status="active",
        version=await _next_stage_doc_version(db, stage.id, doc_title),
        uploaded_by=user.id,
    )
    db.add(doc)
    await db.flush()
    _audit_stage(
        db,
        stage,
        user,
        "stage.document_uploaded",
        doc_id=doc.id,
        version=doc.version,
        title=doc.title,
        scan_status=scan_status,
    )
    await db.commit()
    await db.refresh(doc)
    return _stage_doc_out(doc)


# ─── Export мониторинга этапа (роль-зависимый объём) ─────────────────────────


@stage_router.get("/{stage_id}/export")
async def export_stage(
    stage_id: int, db: DBSession, user: CurrentUser
) -> JSONResponse:
    """Карточка мониторинга этапа в разрешённом для пользователя объёме.

    - participant: свои задачи + незакреплённые, счётчики, КТ, документы
      (metadata), прогресс; без аудита и имён других пользователей.
    - owner (создатель/админ проекта): + все задачи (assignee_id без имён)
      и история (audit).
    - staff (cntr_*): полное — все задачи/документы с ФИО, аудит, карточка
      проекта (бюджет/юридические поля).
    Экспорт не содержит email и паролей; чужие проекты → 404 (IDOR).
    """
    stage = await _get_stage(db, stage_id)
    project = await _stage_project(db, stage, user)

    is_staff = user.is_superuser or is_cntr_staff(user)
    is_owner = await _is_project_owner(db, project, user)
    scope = "staff" if is_staff else ("owner" if is_owner else "participant")

    tasks = await _stage_tasks(db, stage.id)
    checkpoints = await _stage_checkpoints(db, stage.id)
    documents = await _stage_documents(db, stage.id)
    progress = _stage_progress(stage, tasks, checkpoints)

    # Задачи: participant — свои + незакреплённые; owner — все (id без имён);
    # staff — все с ФИО исполнителя.
    assignee_names: dict[int, str] = {}
    if is_staff:
        assignee_ids = {t.assignee_id for t in tasks if t.assignee_id is not None}
        if assignee_ids:
            rows = (
                await db.execute(select(User).where(User.id.in_(assignee_ids)))
            ).scalars().all()
            assignee_names = {u.id: u.full_name for u in rows}

    task_rows: list[dict] = []
    for t in tasks:
        if not is_staff and not is_owner and t.assignee_id not in (None, user.id):
            continue
        row: dict = {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "assignee_id": t.assignee_id,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "overdue": (
                t.due_date is not None
                and t.due_date < date.today()
                and t.status != "done"
            ),
        }
        if is_staff:
            row["assignee_name"] = (
                assignee_names.get(t.assignee_id) if t.assignee_id is not None else None
            )
        task_rows.append(row)

    uploader_names: dict[int, str] = {}
    if is_staff:
        uploader_ids = {
            d.uploaded_by for d in documents if d.uploaded_by is not None
        }
        if uploader_ids:
            rows = (
                await db.execute(select(User).where(User.id.in_(uploader_ids)))
            ).scalars().all()
            uploader_names = {u.id: u.full_name for u in rows}

    doc_rows = []
    for d in documents:
        row = {
            "id": d.id,
            "title": d.title,
            "version": d.version,
            "file_name": d.file_name,
            "mime_type": d.mime_type,
            "file_size": d.file_size,
            "scan_status": d.scan_status,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        if is_staff:
            row["uploaded_by"] = d.uploaded_by
            row["uploaded_by_name"] = (
                uploader_names.get(d.uploaded_by) if d.uploaded_by is not None else None
            )
        doc_rows.append(row)

    payload: dict = {
        "stage": {
            "id": stage.id,
            "project_id": stage.project_id,
            "from_level": stage.from_level,
            "to_level": stage.to_level,
            "title": stage.title,
            "description": stage.description,
            "status": stage.status,
            "responsible_id": stage.responsible_id if is_staff or is_owner else None,
            "planned_start_date": (
                stage.planned_start_date.isoformat() if stage.planned_start_date else None
            ),
            "planned_end_date": (
                stage.planned_end_date.isoformat() if stage.planned_end_date else None
            ),
            "actual_start_date": (
                stage.actual_start_date.isoformat() if stage.actual_start_date else None
            ),
            "actual_end_date": (
                stage.actual_end_date.isoformat() if stage.actual_end_date else None
            ),
            "plan_result": stage.plan_result if isinstance(stage.plan_result, dict) else {},
            "fact_result": stage.fact_result if isinstance(stage.fact_result, dict) else {},
        },
        "project": {"id": project.id, "name": project.name},
        "progress": {
            "status": progress.status,
            "overdue": progress.overdue,
            "overdue_days": progress.overdue_days,
            "progress_pct": progress.progress_pct,
        },
        "tasks": task_rows,
        "task_counts": {
            "total": len(tasks),
            "done": progress.tasks_done,
            "overdue": progress.tasks_overdue,
            "mine": sum(1 for t in tasks if t.assignee_id == user.id),
        },
        "checkpoints": [
            {
                "id": cp.id,
                "title": cp.title,
                "status": cp.status,
                "decision": cp.decision,
                "due_date": cp.due_date.isoformat() if cp.due_date else None,
                "weight": cp.weight,
                "overdue": (
                    cp.due_date is not None
                    and cp.due_date < date.today()
                    and cp.status == "pending"
                ),
            }
            for cp in checkpoints
        ],
        "documents": doc_rows,
        "exported_at": datetime.now(UTC).isoformat(),
        "exporter": {"user_id": user.id, "scope": scope},
    }
    if is_staff or is_owner:
        history = await _stage_history(db, stage)
        payload["audit"] = [
            {
                "id": a.id,
                "action": a.action,
                "user_id": a.user_id,
                "details": a.details if isinstance(a.details, dict) else {},
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in history
        ]
    if is_staff:
        payload["project"]["budget"] = (
            float(project.budget) if project.budget is not None else None
        )
        payload["project"]["status"] = project.status
        payload["project"]["legal_owner"] = project.legal_owner
        payload["project"]["rights_holder"] = project.rights_holder
        payload["project"]["contract_number"] = project.contract_number

    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": (
                f'attachment; filename="stage-{stage.id}-monitoring.json"'
            )
        },
    )
