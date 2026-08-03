"""Экспресс-оценка УГТ: любой пользователь создаёт проект-черновик (тикет 21).

- POST /assessments        — принять ответы опросника, посчитать предварительный УГТ,
                             создать проект-черновик с preliminary_level
- GET  /assessments/mine   — список своих черновиков/оценок
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_, select

from app.api.v1.projects import compute_current_level
from app.core.deps import CurrentUser, DBSession
from app.db.models import AuditTrailEntry, Project, QuestionnaireResult
from app.schemas import (
    AssessmentIn,
    DraftProjectOut,
    QuestionnaireResultOut,
)

router = APIRouter(prefix="/assessments", tags=["assessments"])


def _draft_out(project: Project, results: list[QuestionnaireResult]) -> DraftProjectOut:
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
    )


@router.post("", response_model=DraftProjectOut, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    payload: AssessmentIn, db: DBSession, user: CurrentUser
) -> DraftProjectOut:
    """Экспресс-оценка: черновик с предварительным УГТ (переоценка → 403)."""
    already = await db.scalar(
        select(Project.id).where(
            Project.created_by == user.id,
            or_(Project.current_level > 0, Project.preliminary_level.is_(None)),
        )
    )
    if already is not None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Переоценка недоступна — проект уже оценён; доработка идёт уровнями N→N+1.",
        )

    preliminary = compute_current_level(payload.questionnaire_results)
    project = Project(
        name=payload.name or f"Экспресс-оценка УГТ — {date.today().isoformat()}",
        description=payload.description,
        status="draft",
        preliminary_level=preliminary,
        current_level=0,
        target_level=9,
        created_by=user.id,
    )
    db.add(project)
    await db.flush()

    for answer in payload.questionnaire_results:
        db.add(
            QuestionnaireResult(
                project_id=project.id,
                level_id=answer.level_id,
                checked_items={"items": answer.checked_items},
                percentage=answer.percentage,
            )
        )

    db.add(
        AuditTrailEntry(
            project_id=project.id,
            user_id=user.id,
            action="assessment.created",
            details={"preliminary_level": preliminary},
        )
    )
    await db.commit()
    await db.refresh(project)

    assessment = (
        await db.execute(
            select(QuestionnaireResult).where(QuestionnaireResult.project_id == project.id)
        )
    ).scalars()
    return _draft_out(project, list(assessment))


@router.get("/mine", response_model=list[DraftProjectOut])
async def my_assessments(db: DBSession, user: CurrentUser) -> list[DraftProjectOut]:
    """Свои черновики/оценки (видны только владельцу; менеджер видит в очереди)."""
    rows = await db.execute(
        select(Project, QuestionnaireResult)
        .outerjoin(QuestionnaireResult, QuestionnaireResult.project_id == Project.id)
        .where(Project.created_by == user.id, Project.status == "draft")
        .order_by(Project.created_at.desc(), QuestionnaireResult.level_id)
    )
    grouped: dict[int, tuple[Project, list[QuestionnaireResult]]] = {}
    for project, result in rows:
        entry = grouped.setdefault(project.id, (project, []))
        if result is not None:
            entry[1].append(result)
    return [_draft_out(p, rs) for p, rs in grouped.values()]
