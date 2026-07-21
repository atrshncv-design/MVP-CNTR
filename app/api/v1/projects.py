from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.db.models import (
    AuditTrailEntry,
    ControlPoint,
    Project,
    ProjectDocument,
    ProjectMember,
    QuestionnaireResult,
)
from app.schemas import (
    AuditTrailEntryOut,
    ControlPointOut,
    ProjectDetailOut,
    ProjectDocumentOut,
    ProjectMemberOut,
    ProjectOut,
    QuestionnaireResultIn,
    QuestionnaireResultOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/{project_id}", response_model=ProjectDetailOut)
async def get_project_detail(
    project_id: int,
    db: DBSession,
    user: CurrentUser,
) -> ProjectDetailOut:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")

    # Fetch all related data
    qr_stmt = select(QuestionnaireResult).where(QuestionnaireResult.project_id == project_id)
    qr_result = await db.execute(qr_stmt)
    questionnaire_results = qr_result.scalars().all()

    cp_stmt = select(ControlPoint).where(ControlPoint.project_id == project_id)
    cp_result = await db.execute(cp_stmt)
    control_points = cp_result.scalars().all()

    doc_stmt = select(ProjectDocument).where(ProjectDocument.project_id == project_id)
    doc_result = await db.execute(doc_stmt)
    documents = doc_result.scalars().all()

    mem_stmt = select(ProjectMember).where(ProjectMember.project_id == project_id)
    mem_result = await db.execute(mem_stmt)
    members = mem_result.scalars().all()

    at_stmt = select(AuditTrailEntry).where(AuditTrailEntry.project_id == project_id)
    at_result = await db.execute(at_stmt)
    audit_trail = at_result.scalars().all()

    return ProjectDetailOut(
        project=ProjectOut(
            id=project.id,
            name=project.name,
            description=project.description,
            category=project.category,
            target_level=project.target_level,
            current_level=project.current_level,
            status=project.status,
            budget=project.budget,
            created_by=project.created_by,
        ),
        questionnaire_results=[_qr_out(r) for r in questionnaire_results],
        control_points=[_cp_out(cp) for cp in control_points],
        documents=[_doc_out(d) for d in documents],
        members=[_mem_out(m) for m in members],
        audit_trail=[_at_out(a) for a in audit_trail],
    )


@router.post(
    "/questionnaire",
    response_model=QuestionnaireResultOut,
    status_code=status.HTTP_201_CREATED,
)
async def save_questionnaire(
    payload: QuestionnaireResultIn,
    db: DBSession,
    user: CurrentUser,
) -> QuestionnaireResultOut:
    project = await db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")

    stmt = select(QuestionnaireResult).where(
        QuestionnaireResult.project_id == payload.project_id,
        QuestionnaireResult.level_id == payload.level_id,
    )
    existing = await db.scalar(stmt)

    if existing:
        existing.checked_items = {"items": payload.checked_items}
        existing.percentage = payload.percentage
        result = existing
    else:
        result = QuestionnaireResult(
            project_id=payload.project_id,
            level_id=payload.level_id,
            checked_items={"items": payload.checked_items},
            percentage=payload.percentage,
        )
        db.add(result)

    await db.commit()
    await db.refresh(result)

    return _qr_out(result)


def _qr_out(r: QuestionnaireResult) -> QuestionnaireResultOut:
    return QuestionnaireResultOut(
        id=r.id,
        project_id=r.project_id,
        level_id=r.level_id,
        checked_items=r.checked_items.get("items", []) if isinstance(r.checked_items, dict) else [],
        percentage=r.percentage,
    )


def _cp_out(cp: ControlPoint) -> ControlPointOut:
    return ControlPointOut(
        id=cp.id,
        project_id=cp.project_id,
        title=cp.title,
        description=cp.description,
        point_type=cp.point_type,
        status=cp.status,
        decision=cp.decision,
        decided_by=cp.decided_by,
    )


def _doc_out(d: ProjectDocument) -> ProjectDocumentOut:
    return ProjectDocumentOut(
        id=d.id,
        project_id=d.project_id,
        title=d.title,
        doc_type=d.doc_type,
        file_url=d.file_url,
        status=d.status,
        version=d.version,
        uploaded_by=d.uploaded_by,
    )


def _mem_out(m: ProjectMember) -> ProjectMemberOut:
    return ProjectMemberOut(
        id=m.id,
        project_id=m.project_id,
        user_id=m.user_id,
        role_in_project=m.role_in_project,
    )


def _at_out(a: AuditTrailEntry) -> AuditTrailEntryOut:
    return AuditTrailEntryOut(
        id=a.id,
        project_id=a.project_id,
        user_id=a.user_id,
        action=a.action,
        details=a.details if isinstance(a.details, dict) else {},
    )
