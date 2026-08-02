from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import Select, or_, select

from app.core.deps import CurrentUser, DBSession, is_cntr_staff
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
    ProjectCreateIn,
    ProjectDetailOut,
    ProjectDocumentOut,
    ProjectMemberOut,
    ProjectOut,
    QuestionnaireAnswerIn,
    QuestionnaireResultIn,
    QuestionnaireResultOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])

QUESTIONNAIRE_PASS_THRESHOLD = 70.0


def compute_current_level(results: list[QuestionnaireAnswerIn]) -> int:
    """Текущий УГТ = максимальный непрерывный уровень с процентом ≥ 70 (как в визарде)."""
    by_level = {r.level_id: r.percentage for r in results}
    level = 0
    for i in range(1, 10):
        if by_level.get(i, 0.0) >= QUESTIONNAIRE_PASS_THRESHOLD:
            level = i
        else:
            break
    return level


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreateIn,
    db: DBSession,
    user: CurrentUser,
) -> ProjectOut:
    project = Project(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        target_level=payload.target_level,
        current_level=compute_current_level(payload.questionnaire_results),
        budget=payload.budget,
        created_by=user.id,
    )
    db.add(project)
    await db.flush()  # нужен project.id для вложенных записей

    # Создатель — приоритетный участник с ролью из своей платформенной роли
    primary_role = user.roles[0].slug if user.roles else "participant"
    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=user.id,
            role_in_project=primary_role,
            status="active",
            is_priority=True,
        )
    )

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
            action="project.created",
            details={"name": project.name, "target_level": project.target_level},
        )
    )

    await db.commit()
    await db.refresh(project)
    return _project_out(project)


def project_list_stmt(user: CurrentUser) -> Select[tuple[Project]]:
    statement = select(Project).order_by(Project.updated_at.desc(), Project.id.desc())
    if user.is_superuser or is_cntr_staff(user):
        return statement
    joined_projects = select(ProjectMember.project_id).where(
        ProjectMember.user_id == user.id,
        ProjectMember.status == "active",
    )
    return statement.where(
        or_(Project.created_by == user.id, Project.id.in_(joined_projects))
    )


async def get_project_or_404(db: DBSession, project_id: int) -> Project:
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    return project


async def can_access_project(db: DBSession, project: Project, user: CurrentUser) -> bool:
    """Доступ: суперпользователь, персонал ЦНТР, создатель или активный участник.

    Возвращает 404 (а не 403) наружителю, чтобы не раскрывать существование проекта.
    """
    if user.is_superuser or is_cntr_staff(user) or project.created_by == user.id:
        return True
    membership = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
            ProjectMember.status == "active",
        )
    )
    return membership is not None


async def require_project_access(db: DBSession, project_id: int, user: CurrentUser) -> Project:
    project = await get_project_or_404(db, project_id)
    if not await can_access_project(db, project, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: DBSession, user: CurrentUser) -> list[ProjectOut]:
    result = await db.execute(project_list_stmt(user))
    return [_project_out(project) for project in result.scalars().all()]


@router.get("/{project_id}", response_model=ProjectDetailOut)
async def get_project_detail(
    project_id: int,
    db: DBSession,
    user: CurrentUser,
) -> ProjectDetailOut:
    project = await require_project_access(db, project_id, user)

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
        project=_project_out(project),
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
    await require_project_access(db, payload.project_id, user)

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


def _project_out(project: Project) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        category=project.category,
        target_level=project.target_level,
        current_level=project.current_level,
        status=project.status,
        budget=project.budget,
        join_token=project.join_token,
        created_by=project.created_by,
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None,
    )


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
