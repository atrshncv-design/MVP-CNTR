"""Реестр экспертов и базовое заключение (тикет 02 operations-modules).

Пул экспертов = пользователи с верифицированным профилем
(user_profiles.state='verified'); роль ugt_expert НЕ создаётся (решение
зафиксировано). Назначение на scope материалов делает staff
(cntr_manager/cntr_admin); COI обязателен до доступа к полным материалам
и подачи заключения; lifecycle журналируется в audit (expert.*).

RBAC: эксперт видит ТОЛЬКО свой scope (IDOR чужого назначения → 404);
не-эксперт не видит чужие заключения; staff не назначает не-verified
пользователей.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.v1.projects import get_project_or_404
from app.api.v1.stages import (
    _stage_checkpoints,
    _stage_cp_out,
    _stage_doc_out,
    _stage_full_out,
    _stage_progress,
    _stage_tasks,
)
from app.core.deps import CurrentUser, DBSession, is_cntr_staff
from app.db.models import (
    AuditTrailEntry,
    ControlPoint,
    ExpertAssignment,
    ExpertConclusion,
    Project,
    ProjectDocument,
    ProjectStage,
    User,
    UserProfile,
)
from app.schemas import (
    ExpertAssignIn,
    ExpertAssignmentOut,
    ExpertCoiIn,
    ExpertConclusionIn,
    ExpertConclusionOut,
    ExpertProjectCardOut,
    ExpertProjectDetailOut,
    ExpertReviewIn,
)

router = APIRouter(prefix="/projects", tags=["experts"])
expert_router = APIRouter(prefix="/experts", tags=["experts"])

EXPERT_ACTIVE_STATUSES = ("assigned", "accepted", "submitted", "reviewed")


def _now() -> datetime:
    return datetime.now(UTC)


async def _assignment_out(db: DBSession, a: ExpertAssignment) -> ExpertAssignmentOut:
    project = await db.get(Project, a.project_id)
    conclusion: ExpertConclusionOut | None = None
    if a.conclusion_id is not None:
        c = await db.get(ExpertConclusion, a.conclusion_id)
        if c is not None:
            conclusion = ExpertConclusionOut(
                id=c.id,
                version=c.version,
                status=c.status,
                content=c.content,
                submitted_at=c.submitted_at.isoformat() if c.submitted_at else None,
                reviewed_by=c.reviewed_by,
                reviewed_at=c.reviewed_at.isoformat() if c.reviewed_at else None,
                review_comment=c.review_comment,
                updated_at=c.updated_at.isoformat() if c.updated_at else None,
            )
    return ExpertAssignmentOut(
        id=a.id,
        project_id=a.project_id,
        project_name=project.name if project else None,
        expert_user_id=a.expert_user_id,
        scope=a.scope if isinstance(a.scope, dict) else {},
        status=a.status,
        assigned_by=a.assigned_by,
        coi_declared=a.coi_declared,
        coi_declared_at=a.coi_declared_at.isoformat() if a.coi_declared_at else None,
        conclusion=conclusion,
        created_at=a.created_at.isoformat() if a.created_at else None,
        updated_at=a.updated_at.isoformat() if a.updated_at else None,
    )


def _audit_expert(
    db: DBSession, project_id: int, user: CurrentUser, action: str, **details: object
) -> None:
    db.add(
        AuditTrailEntry(
            project_id=project_id,
            user_id=user.id,
            action=action,
            details=details,
        )
    )


async def _get_own_assignment(
    db: DBSession, assignment_id: int, user: CurrentUser
) -> ExpertAssignment:
    """Назначение эксперта ТОЛЬКО для его владельца (IDOR чужого → 404)."""
    assignment = await db.get(ExpertAssignment, assignment_id)
    if assignment is None or assignment.expert_user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Назначение не найдено")
    return assignment


async def _assignment_conclusion(
    db: DBSession, assignment_id: int
) -> ExpertConclusion | None:
    return await db.scalar(
        select(ExpertConclusion).where(ExpertConclusion.assignment_id == assignment_id)
    )


async def _validate_scope(db: DBSession, project: Project, scope: dict) -> None:
    """scope ссылается на существующие материалы этого проекта (иначе 422)."""
    stage_ids = [int(i) for i in scope.get("stage_ids", [])]
    cp_ids = [int(i) for i in scope.get("checkpoint_ids", [])]
    if stage_ids:
        rows = (
            await db.execute(
                select(ProjectStage.id, ProjectStage.project_id).where(
                    ProjectStage.id.in_(stage_ids)
                )
            )
        ).all()
        found = {int(row[0]) for row in rows}
        if set(stage_ids) - found:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "scope.stage_ids ссылается на несуществующие этапы",
            )
        foreign = {int(row[1]) for row in rows} - {project.id}
        if foreign:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "scope.stage_ids содержит этапы другого проекта",
            )
    if cp_ids:
        rows = (
            await db.execute(
                select(ControlPoint.id, ControlPoint.project_id).where(
                    ControlPoint.id.in_(cp_ids)
                )
            )
        ).all()
        found = {int(row[0]) for row in rows}
        if set(cp_ids) - found:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "scope.checkpoint_ids ссылается на несуществующие контрольные точки",
            )
        foreign = {int(row[1]) for row in rows} - {project.id}
        if foreign:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "scope.checkpoint_ids содержит точки другого проекта",
            )


# ─── Назначение эксперта (staff) ─────────────────────────────────────────────


@router.post(
    "/{project_id}/experts",
    response_model=ExpertAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def assign_expert(
    project_id: int,
    payload: ExpertAssignIn,
    db: DBSession,
    user: CurrentUser,
) -> ExpertAssignmentOut:
    """Назначение эксперта на scope материалов проекта (cntr_manager/cntr_admin)."""
    project = await get_project_or_404(db, project_id)
    if not is_cntr_staff(user) and not user.is_superuser:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Назначать экспертов может только персонал ЦНТР",
        )

    expert = await db.get(User, payload.expert_user_id)
    if expert is None or not expert.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь-эксперт не найден")
    profile = await db.scalar(
        select(UserProfile).where(UserProfile.user_id == payload.expert_user_id)
    )
    if profile is None or profile.state != "verified":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Пул экспертов — пользователи с верифицированным профилем "
            "(user_profiles.state='verified')",
        )

    await _validate_scope(db, project, payload.scope)

    assignment = ExpertAssignment(
        project_id=project.id,
        expert_user_id=expert.id,
        scope=payload.scope,
        status="assigned",
        assigned_by=user.id,
    )
    db.add(assignment)
    await db.flush()
    _audit_expert(
        db,
        project.id,
        user,
        "expert.assigned",
        assignment_id=assignment.id,
        expert_user_id=expert.id,
        scope=payload.scope,
    )
    await db.commit()
    await db.refresh(assignment)
    return await _assignment_out(db, assignment)


# ─── Назначения эксперта ─────────────────────────────────────────────────────


@expert_router.get("/assignments/mine", response_model=list[ExpertAssignmentOut])
async def my_assignments(db: DBSession, user: CurrentUser) -> list[ExpertAssignmentOut]:
    """Свои назначения эксперта (только expert_user_id == user.id)."""
    rows = list(
        (
            await db.execute(
                select(ExpertAssignment)
                .where(ExpertAssignment.expert_user_id == user.id)
                .order_by(ExpertAssignment.created_at.desc(), ExpertAssignment.id.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await _assignment_out(db, a) for a in rows]


@expert_router.post(
    "/assignments/{assignment_id}/accept", response_model=ExpertAssignmentOut
)
async def accept_assignment(
    assignment_id: int,
    db: DBSession,
    user: CurrentUser,
) -> ExpertAssignmentOut:
    """Принятие назначения (журнал expert.accepted)."""
    assignment = await _get_own_assignment(db, assignment_id, user)
    if assignment.status != "assigned":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Назначение в статусе «{assignment.status}»; принять можно только назначенное",
        )
    assignment.status = "accepted"
    assignment.updated_at = _now()
    _audit_expert(
        db, assignment.project_id, user, "expert.accepted", assignment_id=assignment.id
    )
    await db.commit()
    await db.refresh(assignment)
    return await _assignment_out(db, assignment)


@expert_router.post(
    "/assignments/{assignment_id}/decline", response_model=ExpertAssignmentOut
)
async def decline_assignment(
    assignment_id: int,
    db: DBSession,
    user: CurrentUser,
) -> ExpertAssignmentOut:
    """Отказ от назначения (журнал expert.declined)."""
    assignment = await _get_own_assignment(db, assignment_id, user)
    if assignment.status != "assigned":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Назначение в статусе «{assignment.status}»; отказаться можно только от назначенного",
        )
    assignment.status = "declined"
    assignment.updated_at = _now()
    _audit_expert(
        db, assignment.project_id, user, "expert.declined", assignment_id=assignment.id
    )
    await db.commit()
    await db.refresh(assignment)
    return await _assignment_out(db, assignment)


@expert_router.post(
    "/assignments/{assignment_id}/coi", response_model=ExpertAssignmentOut
)
async def declare_coi(
    assignment_id: int,
    payload: ExpertCoiIn,
    db: DBSession,
    user: CurrentUser,
) -> ExpertAssignmentOut:
    """Декларация отсутствия конфликта интересов (журнал expert.coi).

    Обязательна ДО доступа к полным материалам (GET /projects/{id} для
    эксперта) и подачи заключения; без неё — 403.
    """
    assignment = await _get_own_assignment(db, assignment_id, user)
    if assignment.status not in ("assigned", "accepted"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"COI можно подтвердить в статусе assigned/accepted (сейчас «{assignment.status}»)",
        )
    if assignment.coi_declared:
        raise HTTPException(status.HTTP_409_CONFLICT, "COI уже подтверждён")
    assignment.coi_declared = True
    assignment.coi_declared_at = _now()
    assignment.updated_at = _now()
    _audit_expert(db, assignment.project_id, user, "expert.coi", assignment_id=assignment.id)
    await db.commit()
    await db.refresh(assignment)
    return await _assignment_out(db, assignment)


@expert_router.post(
    "/assignments/{assignment_id}/conclusion",
    response_model=ExpertConclusionOut,
    status_code=status.HTTP_201_CREATED,
)
async def save_conclusion(
    assignment_id: int,
    payload: ExpertConclusionIn,
    db: DBSession,
    user: CurrentUser,
) -> ExpertConclusionOut:
    """Создание/обновление черновика заключения (version +1; после COI).

    Подача (submit) журналируется отдельно (expert.submitted); черновики
    при каждом сохранении инкрементируют version.
    """
    assignment = await _get_own_assignment(db, assignment_id, user)
    if assignment.status == "declined":
        raise HTTPException(status.HTTP_409_CONFLICT, "Назначение отклонено")
    if not assignment.coi_declared:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Подтвердите отсутствие конфликта интересов (COI) перед подачей заключения",
        )
    if assignment.status not in ("accepted", "submitted", "reviewed"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Сначала примите назначение (accept) перед подготовкой заключения",
        )

    conclusion = await _assignment_conclusion(db, assignment.id)
    if conclusion is None:
        conclusion = ExpertConclusion(
            assignment_id=assignment.id,
            content=payload.content,
            version=1,
            status="draft",
        )
        db.add(conclusion)
    else:
        if conclusion.status == "approved":
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Заключение утверждено — редактирование недоступно"
            )
        if conclusion.status == "submitted":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Заключение подано; верните его на доработку (review с approved=false)",
            )
        conclusion.content = payload.content
        conclusion.version += 1
        conclusion.updated_at = _now()

    await db.commit()
    await db.refresh(conclusion)
    return ExpertConclusionOut(
        id=conclusion.id,
        version=conclusion.version,
        status=conclusion.status,
        content=conclusion.content,
        submitted_at=conclusion.submitted_at.isoformat() if conclusion.submitted_at else None,
        reviewed_by=conclusion.reviewed_by,
        reviewed_at=conclusion.reviewed_at.isoformat() if conclusion.reviewed_at else None,
        review_comment=conclusion.review_comment,
        updated_at=conclusion.updated_at.isoformat() if conclusion.updated_at else None,
    )


@expert_router.post(
    "/assignments/{assignment_id}/conclusion/submit",
    response_model=ExpertAssignmentOut,
)
async def submit_conclusion(
    assignment_id: int,
    db: DBSession,
    user: CurrentUser,
) -> ExpertAssignmentOut:
    """Подача заключения: draft → submitted (версия фиксируется; журнал expert.submitted)."""
    assignment = await _get_own_assignment(db, assignment_id, user)
    if not assignment.coi_declared:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Подтвердите отсутствие конфликта интересов (COI) перед подачей заключения",
        )
    conclusion = await _assignment_conclusion(db, assignment.id)
    if conclusion is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Сначала сохраните черновик заключения"
        )
    if conclusion.status == "submitted":
        raise HTTPException(status.HTTP_409_CONFLICT, "Заключение уже подано")
    if conclusion.status == "approved":
        raise HTTPException(status.HTTP_409_CONFLICT, "Заключение утверждено")

    conclusion.status = "submitted"
    conclusion.submitted_at = _now()
    conclusion.updated_at = _now()
    assignment.status = "submitted"
    assignment.conclusion_id = conclusion.id
    assignment.updated_at = _now()
    _audit_expert(
        db,
        assignment.project_id,
        user,
        "expert.submitted",
        assignment_id=assignment.id,
        version=conclusion.version,
    )
    await db.commit()
    await db.refresh(assignment)
    return await _assignment_out(db, assignment)


@expert_router.post(
    "/assignments/{assignment_id}/review", response_model=ExpertAssignmentOut
)
async def review_conclusion(
    assignment_id: int,
    payload: ExpertReviewIn,
    db: DBSession,
    user: CurrentUser,
) -> ExpertAssignmentOut:
    """Решение staff по поданному заключению (журнал expert.reviewed).

    approved=true → заключение финально (approved/reviewed); approved=false →
    заключение возвращается в черновик (draft/accepted) на доработку.
    """
    assignment = await db.get(ExpertAssignment, assignment_id)
    if assignment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Назначение не найдено")
    if not is_cntr_staff(user) and not user.is_superuser:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Проверять заключения может только персонал ЦНТР",
        )
    if assignment.status != "submitted":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Заключение в статусе «{assignment.status}»; проверяется только поданное",
        )
    conclusion = await _assignment_conclusion(db, assignment.id)
    if conclusion is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Заключение не найдено")

    if payload.approved:
        conclusion.status = "approved"
        assignment.status = "reviewed"
    else:
        conclusion.status = "draft"
        assignment.status = "accepted"
    conclusion.reviewed_by = user.id
    conclusion.reviewed_at = _now()
    conclusion.review_comment = payload.comment
    conclusion.updated_at = _now()
    assignment.updated_at = _now()
    _audit_expert(
        db,
        assignment.project_id,
        user,
        "expert.reviewed",
        assignment_id=assignment.id,
        approved=payload.approved,
        comment=payload.comment,
    )
    await db.commit()
    await db.refresh(assignment)
    return await _assignment_out(db, assignment)


# ─── Scope-видимость эксперта (GET /projects/{id}) ───────────────────────────


async def expert_scoped_view(
    db: DBSession, project: Project, user: CurrentUser
) -> JSONResponse:
    """Карточка проекта в объёме назначенного эксперту scope.

    Эксперт (не участник проекта) видит ТОЛЬКО назначенные материалы.
    Без COI — 403; без активного назначения — 404 (не раскрываем проект).
    """
    assignment = await db.scalar(
        select(ExpertAssignment)
        .where(
            ExpertAssignment.project_id == project.id,
            ExpertAssignment.expert_user_id == user.id,
        )
        .order_by(ExpertAssignment.id.desc())
    )
    if assignment is None or assignment.status == "declined":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")
    if not assignment.coi_declared:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Подтвердите отсутствие конфликта интересов (COI) до доступа к материалам",
        )

    scope = assignment.scope if isinstance(assignment.scope, dict) else {}
    stage_ids = [int(i) for i in scope.get("stage_ids", [])]
    cp_ids = [int(i) for i in scope.get("checkpoint_ids", [])]

    stages_out = []
    if stage_ids:
        stages = list(
            (
                await db.execute(
                    select(ProjectStage)
                    .where(
                        ProjectStage.id.in_(stage_ids),
                        ProjectStage.project_id == project.id,
                    )
                    .order_by(ProjectStage.id)
                )
            )
            .scalars()
            .all()
        )
        for stage in stages:
            tasks = await _stage_tasks(db, stage.id)
            checkpoints = await _stage_checkpoints(db, stage.id)
            progress = _stage_progress(stage, tasks, checkpoints)
            stages_out.append(await _stage_full_out(db, stage, progress))

    checkpoints_out = []
    if cp_ids:
        checkpoints = list(
            (
                await db.execute(
                    select(ControlPoint)
                    .where(
                        ControlPoint.id.in_(cp_ids),
                        ControlPoint.project_id == project.id,
                    )
                    .order_by(ControlPoint.id)
                )
            )
            .scalars()
            .all()
        )
        checkpoints_out = [_stage_cp_out(cp) for cp in checkpoints]

    documents_out = []
    if stage_ids:
        documents = list(
            (
                await db.execute(
                    select(ProjectDocument)
                    .where(
                        ProjectDocument.stage_id.in_(stage_ids),
                        ProjectDocument.project_id == project.id,
                    )
                    .order_by(ProjectDocument.id)
                )
            )
            .scalars()
            .all()
        )
        documents_out = [_stage_doc_out(d) for d in documents]

    payload = ExpertProjectDetailOut(
        project=ExpertProjectCardOut(
            id=project.id,
            name=project.name,
            description=project.description,
            category=project.category,
            target_level=project.target_level,
            current_level=project.current_level,
            status=project.status,
            is_public=project.is_public,
            created_at=project.created_at.isoformat() if project.created_at else None,
        ),
        stages=stages_out,
        control_points=checkpoints_out,
        documents=documents_out,
        scope=scope,
    )
    return JSONResponse(content=payload.model_dump(mode="json"))
