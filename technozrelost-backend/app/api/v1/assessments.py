"""Экспресс-оценка УГТ: любой пользователь создаёт проект-черновик (тикет 21).

- POST /assessments        — принять ответы опросника, посчитать предварительный УГТ,
                             создать проект-черновик с preliminary_level
- GET  /assessments/mine   — список своих черновиков/оценок
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from app.api.v1.projects import compute_current_level
from app.core.deps import CurrentUser, DBSession
from app.db.models import (
    AssessmentAnswer,
    AssessmentCheckpoint,
    AssessmentTemplate,
    AuditTrailEntry,
    Project,
    ProjectAssessment,
    ProjectMember,
    QuestionnaireResult,
)
from app.schemas import (
    AssessmentIn,
    DraftProjectOut,
    QuestionnaireResultOut,
    ReadinessResultOut,
)
from app.services.readiness_assessment import (
    READINESS_CHECKPOINTS,
    READINESS_TEMPLATE_VERSION,
    compute_readiness,
    template_payload,
)

router = APIRouter(prefix="/assessments", tags=["assessments"])


def _readiness_from_model(assessment: ProjectAssessment | None) -> dict[str, Any] | None:
    if assessment is None:
        return None
    return {
        "template_version": assessment.template_version,
        "preliminary_ugt": assessment.preliminary_ugt,
        "completion_pct": assessment.completion_pct,
        "evidence_pct": assessment.evidence_pct,
        "confidence_pct": assessment.confidence_pct,
        "latest_checkpoint": assessment.latest_checkpoint,
        "not_applicable_count": assessment.not_applicable_count,
        "dimension_scores": assessment.dimension_scores or {},
        "level_scores": assessment.level_scores or [],
        "blockers": assessment.blockers or [],
        "checkpoint_results": [],
    }


def _draft_out(
    project: Project,
    results: list[QuestionnaireResult],
    readiness: dict[str, Any] | None = None,
    assessment_version: str | None = None,
) -> DraftProjectOut:
    return DraftProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        category=project.category,
        preliminary_level=project.preliminary_level,
        current_level=project.current_level,
        target_level=project.target_level,
        status=project.status,
        rejection_reason=project.rejection_reason,
        created_at=project.created_at.isoformat() if project.created_at else None,
        questionnaire_results=[
            QuestionnaireResultOut(
                id=r.id,
                project_id=r.project_id,
                level_id=r.level_id,
                checked_items=(r.checked_items or {}).get("items", []),
                percentage=r.percentage,
                created_at=r.created_at.isoformat() if r.created_at else None,
                updated_at=r.updated_at.isoformat() if r.updated_at else None,
            )
            for r in results
        ],
        readiness_result=ReadinessResultOut.model_validate(readiness) if readiness else None,
        assessment_version=assessment_version,
    )


async def _ensure_template(db: DBSession) -> tuple[AssessmentTemplate, list[AssessmentCheckpoint]]:
    template = await db.scalar(
        select(AssessmentTemplate).where(AssessmentTemplate.version == READINESS_TEMPLATE_VERSION)
    )
    if template is None:
        template = AssessmentTemplate(
            version=READINESS_TEMPLATE_VERSION,
            title="Опросник готовности проекта — 22 контрольных рубежа",
        )
        db.add(template)
        await db.flush()
        for item in READINESS_CHECKPOINTS:
            db.add(
                AssessmentCheckpoint(
                    template_id=template.id,
                    code=item.code,
                    order_no=item.number,
                    ugt_level=item.ugt_level,
                    title=item.title,
                    explanation=item.explanation,
                    dimensions=list(item.dimensions),
                    critical=item.critical,
                    evidence=[
                        {
                            "code": evidence.code,
                            "title": evidence.title,
                            "required": evidence.required,
                        }
                        for evidence in item.evidence
                    ],
                )
            )
        await db.flush()
    checkpoints = list(
        (
            await db.execute(
                select(AssessmentCheckpoint)
                .where(AssessmentCheckpoint.template_id == template.id)
                .order_by(AssessmentCheckpoint.order_no)
            )
        ).scalars()
    )
    return template, checkpoints


@router.get("/template")
async def assessment_template() -> dict[str, Any]:
    """Публичный versioned-контракт вопросов для клиента экспресс-оценки."""
    return template_payload()


@router.post("", response_model=DraftProjectOut, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    payload: AssessmentIn, db: DBSession, user: CurrentUser
) -> DraftProjectOut:
    """Экспресс-оценка: черновик с предварительным УГТ (переоценка → 403)."""
    already = await db.scalar(
        select(Project.id).where(
            Project.created_by == user.id,
            or_(Project.current_level > 0, Project.preliminary_level.is_(None)),
            Project.status != "rejected",  # отклонённый draft можно переоценить (тикет 22)
        )
    )
    if already is not None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Переоценка недоступна — проект уже оценён; доработка идёт уровнями N→N+1.",
        )

    if not payload.answers and not payload.questionnaire_results:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Нужно заполнить экспресс-оценку.",
        )

    readiness_result: dict[str, Any] | None = None
    template: AssessmentTemplate | None = None
    checkpoints: list[AssessmentCheckpoint] = []
    if payload.answers:
        if payload.template_version and payload.template_version != READINESS_TEMPLATE_VERSION:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Версия анкеты устарела — обновите страницу и заполните актуальный шаблон.",
            )
        try:
            readiness_result = compute_readiness(
                [answer.model_dump() for answer in payload.answers]
            )
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
        template, checkpoints = await _ensure_template(db)
        preliminary = readiness_result["preliminary_ugt"]
    else:
        preliminary = compute_current_level(payload.questionnaire_results)

    # Тикет 05: официальный УГТ подтверждается автоматически максимум до 2.
    # preliminary 1–2 → current_level = preliminary (auto_confirmed);
    # preliminary 3–9 → официальный УГТ 2, первичное подтверждение выше — менеджер.
    if preliminary <= 2:
        official_level = preliminary
        project_status = "auto_confirmed"
    else:
        official_level = 2
        project_status = "draft"

    project = Project(
        name=payload.name or f"Экспресс-оценка УГТ — {date.today().isoformat()}",
        description=payload.description,
        category=payload.category,
        status=project_status,
        preliminary_level=preliminary,
        current_level=official_level,
        target_level=payload.target_level,
        created_by=user.id,
    )
    db.add(project)
    await db.flush()
    db.add(
        AuditTrailEntry(
            project_id=project.id,
            user_id=user.id,
            action=(
                "project.auto_confirmed"
                if project_status == "auto_confirmed"
                else "project.capped_at_2"
            ),
            details={
                "preliminary_level": preliminary,
                "official_level": official_level,
            },
        )
    )
    await db.flush()
    # Создатель — первый участник с полномочием project_admin (тикет 04)
    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=user.id,
            role_in_project="owner",
            status="active",
            is_priority=True,
            is_project_admin=True,
        )
    )
    await db.flush()

    if readiness_result is not None and template is not None:
        detailed_by_code = {
            item["checkpoint_code"]: item for item in readiness_result["checkpoint_results"]
        }
        answer_by_code = {answer.checkpoint_code: answer for answer in payload.answers}
        db.add(
            ProjectAssessment(
                project_id=project.id,
                template_id=template.id,
                template_version=readiness_result["template_version"],
                preliminary_ugt=readiness_result["preliminary_ugt"],
                completion_pct=readiness_result["completion_pct"],
                evidence_pct=readiness_result["evidence_pct"],
                confidence_pct=readiness_result["confidence_pct"],
                latest_checkpoint=readiness_result["latest_checkpoint"],
                not_applicable_count=readiness_result["not_applicable_count"],
                dimension_scores=readiness_result["dimension_scores"],
                level_scores=readiness_result["level_scores"],
                blockers=readiness_result["blockers"],
            )
        )
        await db.flush()
        saved_assessment = await db.scalar(
            select(ProjectAssessment).where(ProjectAssessment.project_id == project.id)
        )
        assert saved_assessment is not None
        checkpoint_by_code = {checkpoint.code: checkpoint for checkpoint in checkpoints}
        for checkpoint in READINESS_CHECKPOINTS:
            answer = answer_by_code.get(checkpoint.code)
            item_result = detailed_by_code[checkpoint.code]
            status_value = answer.status if answer else "not_started"
            is_applicable = bool(answer and answer.applicable and status_value != "not_applicable")
            evidence = [item.model_dump() for item in answer.evidence] if answer else []
            db.add(
                AssessmentAnswer(
                    assessment_id=saved_assessment.id,
                    checkpoint_id=checkpoint_by_code[checkpoint.code].id,
                    checkpoint_code=checkpoint.code,
                    status=status_value,
                    applicable=is_applicable,
                    comment=answer.comment if answer else None,
                    evidence=evidence,
                    score_pct=item_result["score_pct"],
                    evidence_pct=item_result["evidence_pct"],
                )
            )
        for level in readiness_result["level_scores"]:
            checked = [
                code
                for code in level["checkpoint_codes"]
                if detailed_by_code[code]["score_pct"] is not None
                and detailed_by_code[code]["score_pct"] >= 75
            ]
            db.add(
                QuestionnaireResult(
                    project_id=project.id,
                    user_id=user.id,
                    level_id=level["ugt_level"],
                    checked_items={"items": checked, "source": "readiness_v1"},
                    percentage=level["percentage"],
                )
            )
    else:
        for questionnaire_answer in payload.questionnaire_results:
            db.add(
                QuestionnaireResult(
                    project_id=project.id,
                    user_id=user.id,
                    level_id=questionnaire_answer.level_id,
                    checked_items={"items": questionnaire_answer.checked_items},
                    percentage=questionnaire_answer.percentage,
                )
            )

    db.add(
        AuditTrailEntry(
            project_id=project.id,
            user_id=user.id,
            action="assessment.created",
            details={
                "preliminary_level": preliminary,
                "assessment_version": (
                    readiness_result["template_version"] if readiness_result else None
                ),
                "completion_pct": readiness_result["completion_pct"] if readiness_result else None,
            },
        )
    )
    await db.commit()
    await db.refresh(project)

    results = (
        await db.execute(
            select(QuestionnaireResult).where(QuestionnaireResult.project_id == project.id)
        )
    ).scalars()
    return _draft_out(
        project,
        list(results),
        readiness=readiness_result,
        assessment_version=readiness_result["template_version"] if readiness_result else None,
    )


@router.get("/mine", response_model=list[DraftProjectOut])
async def my_assessments(db: DBSession, user: CurrentUser) -> list[DraftProjectOut]:
    """Свои черновики/оценки (видны только владельцу; менеджер видит в очереди)."""
    rows = await db.execute(
        select(Project, QuestionnaireResult, ProjectAssessment)
        .outerjoin(QuestionnaireResult, QuestionnaireResult.project_id == Project.id)
        .outerjoin(ProjectAssessment, ProjectAssessment.project_id == Project.id)
        .where(Project.created_by == user.id, Project.status == "draft")
        .order_by(Project.created_at.desc(), QuestionnaireResult.level_id)
    )
    grouped: dict[int, tuple[Project, list[QuestionnaireResult], ProjectAssessment | None]] = {}
    for project, result, readiness in rows:
        entry = grouped.setdefault(project.id, (project, [], readiness))
        if result is not None:
            entry[1].append(result)
    return [
        _draft_out(
            project,
            results,
            _readiness_from_model(readiness),
            readiness.template_version if readiness else None,
        )
        for project, results, readiness in grouped.values()
    ]
