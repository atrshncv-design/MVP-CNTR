"""Очереди менеджера ЦНТР (тикет 22): черновики на апрув и заявки на повышение УГТ.

- GET  /manager/queue/drafts        — черновики на апрув
- POST /manager/queue/drafts/{id}/decide  — approve (публикация + присвоение УГТ) | reject
- GET  /manager/queue/promotions    — заявки на повышение УГТ
- POST /manager/queue/promotions/{id}/decide — approve (N→N+1) | reject
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.v1.projects import CONTROL_POINTS_TEMPLATE, _qr_out
from app.core.deps import DBSession, require_role
from app.db.models import (
    AuditTrailEntry,
    ControlPoint,
    Notification,
    Project,
    ProjectDocument,
    ProjectMember,
    PromotionRequest,
    QuestionnaireResult,
    User,
    VerificationDocument,
)
from app.schemas import (
    DraftDecisionIn,
    DraftProjectOut,
    PromotionDecisionIn,
    PromotionRequestOut,
)
from app.services.achievements import award_meta, award_ugt
from app.services.notifications import notify_user

router = APIRouter(prefix="/manager", tags=["manager"])

ManagerUser = Annotated[User, Depends(require_role("cntr_manager", "cntr_admin"))]


async def notify_managers(db: DBSession, type_: str, title: str, payload: dict) -> None:
    """In-app уведомление всем менеджерам ЦНТР (и администраторам)."""
    managers = (
        (await db.execute(select(User).where(User.roles.any(slug="cntr_manager"))))
        .scalars()
        .all()
    )
    admins = (
        (await db.execute(select(User).where(User.roles.any(slug="cntr_admin"))))
        .scalars()
        .all()
    )
    seen: set[int] = set()
    for user in [*managers, *admins]:
        if user.id in seen:
            continue
        seen.add(user.id)
        db.add(
            Notification(user_id=user.id, type=type_, title=title, payload=payload)
        )


async def _draft_row(db: DBSession, project: Project) -> DraftProjectOut:
    results = (
        (
            await db.execute(
                select(QuestionnaireResult)
                .where(QuestionnaireResult.project_id == project.id)
                .order_by(QuestionnaireResult.level_id)
            )
        )
        .scalars()
        .all()
    )
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
        questionnaire_results=[_qr_out(r) for r in results],
    )


# ─── Очередь «Новые проекты» (черновики) ─────────────────────────────────────


@router.get("/queue/drafts", response_model=list[DraftProjectOut])
async def queue_drafts(db: DBSession, user: ManagerUser) -> list[DraftProjectOut]:
    projects = (
        (
            await db.execute(
                select(Project)
                .where(Project.status == "draft")
                .order_by(Project.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await _draft_row(db, p) for p in projects]


@router.post("/queue/drafts/{project_id}/decide", response_model=DraftProjectOut)
async def decide_draft(
    project_id: int, payload: DraftDecisionIn, db: DBSession, user: ManagerUser
) -> DraftProjectOut:
    project = await db.get(Project, project_id)
    if project is None or project.status != "draft":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Черновик не найден")

    if payload.approve:
        # Тикет 08: первичное подтверждение — на заявленный уровень, не ниже УГТ 2
        level = payload.level or project.preliminary_level or 2
        if level < 2:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Официальный уровень не может быть ниже УГТ 2",
            )
        if project.preliminary_level is not None and level > project.preliminary_level:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Нельзя подтвердить уровень выше предварительного (заявленного)",
            )
        project.status = "published"
        project.current_level = level
        project.rejection_reason = None
        for cp_title, cp_desc in CONTROL_POINTS_TEMPLATE:
            db.add(
                ControlPoint(
                    project_id=project.id,
                    title=cp_title,
                    description=cp_desc,
                    point_type="gate" if cp_title.startswith("КТ-1") else "milestone",
                    status="pending",
                )
            )
        db.add(
            AuditTrailEntry(
                project_id=project.id,
                user_id=user.id,
                action="project.published",
                details={"level": project.current_level},
            )
        )
    else:
        project.status = "rejected"
        project.rejection_reason = payload.reason or "Отклонено менеджером ЦНТР"
        db.add(
            AuditTrailEntry(
                project_id=project.id,
                user_id=user.id,
                action="project.rejected",
                details={"reason": project.rejection_reason},
            )
        )

    await db.commit()
    if project.created_by:
        await notify_user(
            db,
            project.created_by,
            "draft.decided",
            "Решение по вашему проекту принято",
            {"project_id": project.id, "status": project.status},
        )
    await db.refresh(project)
    return await _draft_row(db, project)


# ─── Очередь «Заявки на повышение УГТ» ───────────────────────────────────────


async def _promotion_out(db: DBSession, req: PromotionRequest) -> PromotionRequestOut:
    project = await db.get(Project, req.project_id)
    docs = (
        (
            await db.execute(
                select(ProjectDocument).where(
                    ProjectDocument.project_id == req.project_id,
                    ProjectDocument.doc_type == "stage",
                )
            )
        )
        .scalars()
        .all()
    )
    verif = (
        (
            await db.execute(
                select(VerificationDocument).where(
                    VerificationDocument.project_id == req.project_id
                )
            )
        )
        .scalars()
        .all()
    )
    return PromotionRequestOut(
        id=req.id,
        project_id=req.project_id,
        project_name=project.name if project else "?",
        from_level=req.from_level,
        to_level=req.to_level,
        status=req.status,
        rejection_reason=req.rejection_reason,
        attempt_no=req.attempt_no,
        evaluation_result=req.evaluation_result or {},
        created_at=req.created_at.isoformat() if req.created_at else None,
        stage_docs=[{"id": d.id, "title": d.title} for d in docs],
        verification_docs=[{"id": v.id, "title": v.title} for v in verif],
    )


@router.get("/queue/promotions", response_model=list[PromotionRequestOut])
async def queue_promotions(db: DBSession, user: ManagerUser) -> list[PromotionRequestOut]:
    requests = (
        (
            await db.execute(
                select(PromotionRequest)
                .where(PromotionRequest.status == "pending_manager")
                .order_by(PromotionRequest.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await _promotion_out(db, r) for r in requests]


@router.post("/queue/promotions/{request_id}/decide", response_model=PromotionRequestOut)
async def decide_promotion(
    request_id: int, payload: PromotionDecisionIn, db: DBSession, user: ManagerUser
) -> PromotionRequestOut:
    req = await db.get(PromotionRequest, request_id)
    if req is None or req.status != "pending_manager":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заявка не найдена или уже рассмотрена")

    project = await db.get(Project, req.project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Проект не найден")

    # Тикет 08: повышение строго N→N+1 от текущего уровня проекта
    if project.current_level != req.from_level:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Уровень проекта изменился — переоформите заявку (N→N+1)",
        )
    if req.to_level != req.from_level + 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Подтверждается только следующий уровень (N→N+1)",
        )

    if payload.approve:
        project.current_level = req.to_level
        req.status = "approved"
        req.rejection_reason = None
        req.manager_id = user.id
        db.add(
            AuditTrailEntry(
                project_id=project.id,
                user_id=user.id,
                action="promotion.approved",
                details={"from_level": req.from_level, "to_level": req.to_level},
            )
        )
        # Подтверждение УГТ N → командные медали (ugt-N, отраслевая sector-*,
        # quality-проверки) всем активным участникам проекта + мета-медали.
        # Идемпотентно: повторное подтверждение уровня не дублирует записи;
        # коммит ниже — награды атомарны с решением менеджера.
        await award_ugt(db, project, req.to_level)
        member_ids = (
            (
                await db.execute(
                    select(ProjectMember.user_id).where(
                        ProjectMember.project_id == project.id,
                        ProjectMember.status == "active",
                    )
                )
            )
            .scalars()
            .all()
        )
        for member_id in member_ids:
            await award_meta(db, member_id)
    else:
        req.status = "rejected"
        req.rejection_reason = payload.reason or "Отклонено менеджером ЦНТР"
        req.manager_id = user.id
        if payload.missing:
            req.evaluation_result = {
                **(req.evaluation_result or {}),
                "missing_required": payload.missing,
            }
        db.add(
            AuditTrailEntry(
                project_id=project.id,
                user_id=user.id,
                action="promotion.rejected",
                details={
                    "reason": req.rejection_reason,
                    "missing": payload.missing,
                },
            )
        )

    if project.created_by:
        await notify_user(
            db,
            project.created_by,
            "promotion.decided",
            "Решение по заявке на повышение УГТ",
            {
                "project_id": project.id,
                "request_id": req.id,
                "status": req.status,
                "from_level": req.from_level,
                "to_level": req.to_level,
            },
        )
    await db.commit()
    await db.refresh(req)
    return await _promotion_out(db, req)


# ─── История попыток по проекту (владелец и менеджер) ────────────────────────


@router.get("/queue/history/{project_id}", response_model=list[PromotionRequestOut])
async def promotion_history(
    project_id: int, db: DBSession, user: ManagerUser
) -> list[PromotionRequestOut]:
    requests = (
        (
            await db.execute(
                select(PromotionRequest)
                .where(PromotionRequest.project_id == project_id)
                .order_by(PromotionRequest.attempt_no.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await _promotion_out(db, r) for r in requests]
