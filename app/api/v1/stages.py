"""Доработка проекта уровнями N→N+1: требования этапа, документы, автозаявка (тикет 23).

- GET  /projects/{id}/stage-requirements — требования текущего этапа + статус комплекта
- POST /projects/{id}/stage-documents    — загрузка документа этапа; при полном комплекте
                                           автосоздание заявки на повышение + предварительная
                                           оценка LLM (RAG по ГОСТам)
- POST /projects/{id}/stage-evaluate     — повторный запуск предварительной оценки
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.v1.manager import notify_managers
from app.api.v1.projects import require_project_access
from app.core.deps import CurrentUser, DBSession
from app.db.models import (
    AuditTrailEntry,
    Project,
    ProjectDocument,
    PromotionRequest,
    StageRequirement,
)
from app.schemas import (
    StageDocumentIn,
    StageEvaluateOut,
    StageRequirementOut,
)
from app.services.ai_assistant import ask_llm

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
    uploaded_ids = set(
        (
            await db.execute(
                select(ProjectDocument.stage_requirement_id).where(
                    ProjectDocument.project_id == project.id,
                    ProjectDocument.doc_type == "stage",
                    ProjectDocument.stage_requirement_id.isnot(None),
                )
            )
        )
        .scalars()
        .all()
    )
    return [
        StageRequirementOut(
            id=r.id,
            from_level=r.from_level,
            to_level=r.to_level,
            title=r.title,
            description=r.description,
            uploaded=r.id in uploaded_ids,
        )
        for r in requirements
    ]


async def _evaluate(
    project: Project, stage: StageRequirement, docs: list[ProjectDocument]
) -> tuple[bool, list[str], str]:
    """Предварительная оценка комплекта LLM по ГОСТам (RAG). Fallback без LLM — по полноте."""
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
        # Без LLM-ключа: считаем комплект принятым при полном покрытии требований
        return True, [], "Предварительная оценка: комплект документов принят (без LLM)."

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

    result: dict = {"doc_id": doc.id, "request_id": None, "request_status": None}

    # Автотриггер: комплект полон → создаём заявку на повышение
    stage = await _current_stage(db, project)
    if stage is not None:
        reqs = await _stage_reqs_with_status(db, project, stage)
        if all(r.uploaded for r in reqs):
            previous = await _latest_request(db, project.id)
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
            if success:
                request.status = "pending_manager"
                await notify_managers(
                    db,
                    "promotion.pending",
                    f"Автозаявка на повышение УГТ {project.name}",
                    {"project_id": project.id, "request_id": request.id},
                )
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
