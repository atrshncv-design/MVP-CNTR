"""Приглашения в проект, project_admin и договорные поля (тикет 04 Friday RC).

- project_admin — отдельное полномочие участника; создатель получает его при
  создании проекта и может передать другому участнику.
- Одноразовые приглашения: случайный токен, срок действия, допустимые роли.
- Массовые приглашения: лимит использований и отзыв администратором.
- Договорные поля (владелец, правообладатель, договор) меняет только менеджер.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.api.v1.projects import get_project_or_404, require_project_access
from app.core.deps import CurrentUser, DBSession, require_role
from app.db.models import Project, ProjectInvite, ProjectMember, User
from app.schemas import (
    InviteAcceptIn,
    InviteIn,
    InviteOut,
    LegalIn,
    LegalOut,
    TransferAdminIn,
)

Manager = Annotated[User, Depends(require_role("cntr_manager", "cntr_admin"))]

router = APIRouter(tags=["invites"])


def _invite_out(invite: ProjectInvite) -> InviteOut:
    return InviteOut(
        id=invite.id,
        project_id=invite.project_id,
        token=invite.token,
        invite_type=invite.invite_type,
        allowed_roles=invite.allowed_roles or [],
        max_uses=invite.max_uses,
        used_count=invite.used_count,
        expires_at=invite.expires_at.isoformat() if invite.expires_at else None,
        revoked_at=invite.revoked_at.isoformat() if invite.revoked_at else None,
        created_at=invite.created_at.isoformat() if invite.created_at else None,
    )


async def _membership(
    db: DBSession, project_id: int, user_id: int
) -> ProjectMember | None:
    return cast(
        ProjectMember | None,
        await db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        ),
    )


async def require_project_admin(
    db: DBSession, project_id: int, user: CurrentUser
) -> Project:
    """Полномочие project_admin: участник с флагом admin.

    Создатель получает флаг при создании проекта и может передать полномочие;
    после передачи создатель теряет право. Legacy-проекты без единого
    администратора сохраняют право за создателем.
    """
    project = await require_project_access(db, project_id, user)
    membership = await _membership(db, project_id, user.id)
    if membership is not None and membership.is_project_admin:
        return project
    admin_count = await db.scalar(
        select(func.count(ProjectMember.id)).where(
            ProjectMember.project_id == project_id,
            ProjectMember.is_project_admin.is_(True),
        )
    )
    if (admin_count or 0) == 0 and project.created_by == user.id:
        return project
    raise HTTPException(
        status.HTTP_403_FORBIDDEN, "Требуется полномочие project_admin"
    )


@router.post(
    "/projects/{project_id}/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED
)
async def create_invite(
    project_id: int, payload: InviteIn, db: DBSession, user: CurrentUser
) -> InviteOut:
    await require_project_admin(db, project_id, user)
    token = "INV-" + secrets.token_urlsafe(16).replace("-", "").replace("_", "").upper()
    invite = ProjectInvite(
        project_id=project_id,
        created_by=user.id,
        token=token,
        invite_type=payload.invite_type,
        allowed_roles=payload.allowed_roles,
        max_uses=payload.max_uses if payload.invite_type == "bulk" else 1,
        expires_at=(
            datetime.now(UTC) + timedelta(hours=payload.expires_in_hours)
            if payload.expires_in_hours
            else None
        ),
    )
    db.add(invite)
    await db.commit()
    return _invite_out(invite)


@router.get("/projects/{project_id}/invites", response_model=list[InviteOut])
async def list_invites(
    project_id: int, db: DBSession, user: CurrentUser
) -> list[InviteOut]:
    await require_project_admin(db, project_id, user)
    invites = (
        await db.execute(
            select(ProjectInvite)
            .where(ProjectInvite.project_id == project_id)
            .order_by(ProjectInvite.created_at.desc())
        )
    ).scalars().all()
    return [_invite_out(i) for i in invites]


@router.post("/invites/accept")
async def accept_invite(
    payload: InviteAcceptIn, db: DBSession, user: CurrentUser
) -> dict[str, Any]:
    token = payload.token.strip().upper()
    invite = await db.scalar(select(ProjectInvite).where(ProjectInvite.token == token))
    if invite is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Приглашение не найдено")

    now = datetime.now(UTC)
    if invite.revoked_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Приглашение отозвано")
    if invite.expires_at is not None and invite.expires_at < now:
        raise HTTPException(status.HTTP_409_CONFLICT, "Срок приглашения истёк")
    if invite.used_count >= invite.max_uses:
        raise HTTPException(status.HTTP_409_CONFLICT, "Лимит использований приглашения исчерпан")
    if invite.allowed_roles and payload.role_in_project not in invite.allowed_roles:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Роль «{payload.role_in_project}» не разрешена приглашением",
        )

    project = await get_project_or_404(db, invite.project_id)
    existing = await _membership(db, project.id, user.id)
    if existing is not None:
        if existing.status == "active":
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Вы уже состоите в проекте"
            )
        existing.status = "active"
        existing.role_in_project = payload.role_in_project
        existing.invited_by = invite.created_by
    else:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=user.id,
                role_in_project=payload.role_in_project,
                status="active",
                invited_by=invite.created_by,
            )
        )

    invite.used_count += 1
    await db.commit()
    return {
        "status": "active",
        "project_id": project.id,
        "project_name": project.name,
        "role_in_project": payload.role_in_project,
    }


@router.post("/projects/{project_id}/invites/{invite_id}/revoke", response_model=InviteOut)
async def revoke_invite(
    project_id: int, invite_id: int, db: DBSession, user: CurrentUser
) -> InviteOut:
    await require_project_admin(db, project_id, user)
    invite = await db.get(ProjectInvite, invite_id)
    if invite is None or invite.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Приглашение не найдено")
    if invite.revoked_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Приглашение уже отозвано")
    invite.revoked_at = datetime.now(UTC)
    await db.commit()
    return _invite_out(invite)


@router.post("/projects/{project_id}/transfer-admin")
async def transfer_project_admin(
    project_id: int, payload: TransferAdminIn, db: DBSession, user: CurrentUser
) -> dict[str, Any]:
    await require_project_admin(db, project_id, user)
    target = await _membership(db, project_id, payload.user_id)
    if target is None or target.status != "active":
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Участник не найден в проекте"
        )

    # текущий администратор снимает полномочие (создатель тоже)
    admins = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.is_project_admin.is_(True),
            )
        )
    ).scalars().all()
    for admin in admins:
        admin.is_project_admin = False
    target.is_project_admin = True
    await db.commit()
    return {"status": "ok", "admin_user_id": target.user_id}


@router.patch("/projects/{project_id}/legal", response_model=LegalOut)
async def update_legal_fields(
    project_id: int, payload: LegalIn, db: DBSession, manager: Manager
) -> LegalOut:
    """Договорные поля меняет только менеджер центра (по основанию договора)."""
    project = await get_project_or_404(db, project_id)
    project.legal_owner = payload.legal_owner
    project.rights_holder = payload.rights_holder
    project.contract_number = payload.contract_number
    project.contract_basis = payload.contract_basis
    project.legal_updated_by = manager.id
    updated_at = datetime.now(UTC)
    project.legal_updated_at = updated_at
    await db.commit()
    return LegalOut(
        legal_owner=project.legal_owner,
        rights_holder=project.rights_holder,
        contract_number=project.contract_number,
        contract_basis=project.contract_basis,
        legal_updated_by=project.legal_updated_by,
        legal_updated_at=updated_at.isoformat(),
    )
