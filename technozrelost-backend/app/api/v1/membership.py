"""Механика вступления в проект по join-токену (спека mvp1-release §4).

- Приоритетный шаринг (создатель / персонал ЦНТР / участник с is_priority) → авто-вступление.
- Ручной ввод токена или шаринг неприоритетным участником → заявка (pending),
  одобряет приоритетный участник.
- Менеджер ЦНТР выдаёт/снимает is_priority любому участнику.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.v1.projects import get_project_or_404, require_project_access
from app.core.deps import CNTR_STAFF_SLUGS, CurrentUser, DBSession, has_role, require_role
from app.core.security import sign_share_attribution, verify_share_attribution
from app.db.models import AuditTrailEntry, Project, ProjectMember, User, generate_join_token
from app.schemas import (
    JoinDecisionIn,
    JoinIn,
    JoinRequestOut,
    JoinResultOut,
    MemberPriorityIn,
    ProjectOut,
    RegenerateTokenOut,
    ShareSigOut,
)

router = APIRouter(prefix="/projects", tags=["membership"])

ManagerUser = Annotated[User, Depends(require_role("cntr_manager"))]


# ─── Вспомогательные ──────────────────────────────────────────────────────────


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
        legal_owner=project.legal_owner,
        rights_holder=project.rights_holder,
        contract_number=project.contract_number,
        contract_basis=project.contract_basis,
        legal_updated_by=project.legal_updated_by,
        legal_updated_at=project.legal_updated_at.isoformat()
        if project.legal_updated_at
        else None,
        created_at=project.created_at.isoformat() if project.created_at else None,
        updated_at=project.updated_at.isoformat() if project.updated_at else None,
    )


async def _add_audit(
    db: DBSession,
    project_id: int,
    user_id: int,
    action: str,
    details: dict[str, object],
) -> None:
    db.add(
        AuditTrailEntry(
            project_id=project_id, user_id=user_id, action=action, details=details
        )
    )


async def _is_priority_member(db: DBSession, project_id: int, user_id: int) -> bool:
    membership = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.status == "active",
        )
    )
    return membership is not None and membership.is_priority


async def require_priority_access(
    db: DBSession, project_id: int, user: CurrentUser
) -> Project:
    """Доступ к модерации вступления: создатель, персонал ЦНТР или приоритетный участник."""
    project = await require_project_access(db, project_id, user)
    if user.is_superuser or has_role(user, *CNTR_STAFF_SLUGS) or project.created_by == user.id:
        return project
    if await _is_priority_member(db, project_id, user.id):
        return project
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав для модерации вступления")


async def _sharer_is_priority(
    db: DBSession, project: Project, shared_by: int
) -> bool:
    """True, если ссылкой поделился приоритетный участник → авто-вступление."""
    if project.created_by == shared_by:
        return True
    sharer = await db.get(User, shared_by)
    if sharer is None:
        return False
    if sharer.is_superuser or has_role(sharer, *CNTR_STAFF_SLUGS):
        return True
    return await _is_priority_member(db, project.id, shared_by)


@router.get("/{project_id}/share-sig", response_model=ShareSigOut)
async def share_signature(
    project_id: int, db: DBSession, user: CurrentUser
) -> ShareSigOut:
    """Выдаёт подписанную атрибуцию «поделился ссылкой» (N-01).

    Только приоритетные (создатель/персонал/участник с is_priority) — ровно те,
    кто вправе авто-одобрять вступление. Подпись живёт ограниченный срок,
    поэтому «вечных» приглашений не остаётся.
    """
    project = await require_priority_access(db, project_id, user)
    return ShareSigOut(share_sig=sign_share_attribution(project.id, user.id))


# ─── Вступление ───────────────────────────────────────────────────────────────


@router.post("/join", response_model=JoinResultOut)
async def join_project(payload: JoinIn, db: DBSession, user: CurrentUser) -> JoinResultOut:
    token = payload.token.strip().upper()
    project = await db.scalar(select(Project).where(Project.join_token == token))
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Токен недействителен")

    existing = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        )
    )
    if existing is not None:
        if existing.status == "active":
            return JoinResultOut(status="active", project=_project_out(project))
        if existing.status == "pending":
            raise HTTPException(status.HTTP_409_CONFLICT, "Заявка уже отправлена на рассмотрение")
        raise HTTPException(status.HTTP_409_CONFLICT, "Вы были исключены из проекта")

    # N-01: авторство ссылки подтверждает только серверная HMAC-подпись;
    # всё, что клиент пришлёт сверх этого (в т.ч. бывший shared_by), игнорируется.
    auto_accept = False
    attributed_to: int | None = None
    if payload.share_sig:
        sharer_id = verify_share_attribution(project.id, payload.share_sig)
        if sharer_id is not None:
            auto_accept = await _sharer_is_priority(db, project, sharer_id)
            attributed_to = sharer_id

    member_status = "active" if auto_accept else "pending"
    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=user.id,
            role_in_project=payload.role_in_project,
            status=member_status,
            invited_by=attributed_to,
        )
    )
    await _add_audit(
        db,
        project.id,
        user.id,
        "project.joined" if auto_accept else "project.join_requested",
        {
            "token": token,
            "auto_accept": auto_accept,
            "role": payload.role_in_project,
            "attributed": attributed_to is not None,
        },
    )
    await db.commit()
    return JoinResultOut(status=member_status, project=_project_out(project))


# ─── Модерация заявок ─────────────────────────────────────────────────────────


@router.get("/{project_id}/join-requests", response_model=list[JoinRequestOut])
async def list_join_requests(
    project_id: int, db: DBSession, user: CurrentUser
) -> list[JoinRequestOut]:
    await require_priority_access(db, project_id, user)

    rows = await db.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(
            ProjectMember.project_id == project_id,
            ProjectMember.status == "pending",
        )
        .order_by(ProjectMember.joined_at)
    )
    result: list[JoinRequestOut] = []
    for member, member_user in rows:
        invited_by_name: str | None = None
        if member.invited_by is not None:
            sharer = await db.get(User, member.invited_by)
            invited_by_name = sharer.full_name if sharer else None
        result.append(
            JoinRequestOut(
                id=member.id,
                user_id=member.user_id,
                user_name=member_user.full_name,
                user_email=member_user.email,
                role_in_project=member.role_in_project,
                status=member.status,
                invited_by=member.invited_by,
                invited_by_name=invited_by_name,
                joined_at=member.joined_at.isoformat() if member.joined_at else None,
            )
        )
    return result


@router.post("/{project_id}/join-requests/{member_id}/decide", response_model=JoinRequestOut)
async def decide_join_request(
    project_id: int,
    member_id: int,
    payload: JoinDecisionIn,
    db: DBSession,
    user: CurrentUser,
) -> JoinRequestOut:
    await require_priority_access(db, project_id, user)

    member = await db.get(ProjectMember, member_id)
    if member is None or member.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заявка не найдена")
    if member.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "Заявка уже рассмотрена")

    member.status = "active" if payload.approve else "removed"
    if payload.approve and payload.role_in_project:
        member.role_in_project = payload.role_in_project

    await _add_audit(
        db,
        project_id,
        user.id,
        "project.join_approved" if payload.approve else "project.join_rejected",
        {"member_id": member.user_id, "role": member.role_in_project},
    )
    await db.commit()
    await db.refresh(member)

    member_user = await db.get(User, member.user_id)
    return JoinRequestOut(
        id=member.id,
        user_id=member.user_id,
        user_name=member_user.full_name if member_user else str(member.user_id),
        user_email=member_user.email if member_user else "",
        role_in_project=member.role_in_project,
        status=member.status,
        invited_by=member.invited_by,
        joined_at=member.joined_at.isoformat() if member.joined_at else None,
    )


# ─── Токен и приоритет ────────────────────────────────────────────────────────


@router.post("/{project_id}/regenerate-token", response_model=RegenerateTokenOut)
async def regenerate_token(
    project_id: int, db: DBSession, user: CurrentUser
) -> RegenerateTokenOut:
    project = await require_priority_access(db, project_id, user)

    old_token = project.join_token
    project.join_token = generate_join_token()
    await _add_audit(
        db, project_id, user.id, "project.token_regenerated", {"old_token": old_token}
    )
    await db.commit()
    await db.refresh(project)
    return RegenerateTokenOut(join_token=project.join_token)


@router.patch("/{project_id}/members/{user_id}/priority", response_model=JoinRequestOut)
async def set_member_priority(
    project_id: int,
    user_id: int,
    payload: MemberPriorityIn,
    db: DBSession,
    user: ManagerUser,
) -> JoinRequestOut:
    await get_project_or_404(db, project_id)  # проверка существования проекта
    member = await db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.status == "active",
        )
    )
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Активный участник не найден")

    member.is_priority = payload.is_priority
    await _add_audit(
        db,
        project_id,
        user.id,
        "project.priority_granted" if payload.is_priority else "project.priority_revoked",
        {"member_id": user_id},
    )
    await db.commit()
    await db.refresh(member)
    return JoinRequestOut(
        id=member.id,
        user_id=member.user_id,
        user_name="",
        user_email="",
        role_in_project=member.role_in_project,
        status=member.status,
        invited_by=member.invited_by,
        is_priority=member.is_priority,
        joined_at=member.joined_at.isoformat() if member.joined_at else None,
    )
