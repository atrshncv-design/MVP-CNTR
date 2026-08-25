"""Доработка проекта уровнями N→N+1: требования этапа, документы, автозаявка (тикет 23).

- GET  /projects/{id}/stage-requirements — требования текущего этапа + статус комплекта
- POST /projects/{id}/stage-documents    — загрузка документа этапа; при полном комплекте
                                           автосоздание заявки на повышение + предварительная
                                           оценка LLM (RAG по ГОСТам)
- POST /projects/{id}/stage-evaluate     — повторный запуск предварительной оценки
"""

from __future__ import annotations

import hashlib
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.v1.manager import notify_managers
from app.api.v1.projects import require_project_access
from app.core.deps import CurrentUser, DBSession
from app.db.models import (
    AuditTrailEntry,
    Project,
    ProjectDocument,
    PromotionRequest,
    PromotionRequestDocument,
    StageRequirement,
)
from app.schemas import (
    StageDocumentIn,
    StageEvaluateOut,
    StageRequirementOut,
)
from app.services.achievements import award_document
from app.services.ai_assistant import ask_llm
from app.services.file_storage import FileStorageError, scanner, store_project_file

router = APIRouter(prefix="/projects", tags=["stages"])

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

    # Принятый документ → персональные медали (doc-first, ступени
    # 5/10/25/50/100, коллекционер). Идемпотентно: повторная версия того же
    # документа не награждает повторно; счётчики ступеней считают уникальные
    # документы пользователя в проекте.
    await award_document(db, project, user, doc.doc_type)

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
