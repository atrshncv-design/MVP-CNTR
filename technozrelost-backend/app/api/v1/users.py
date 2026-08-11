"""Профиль пользователя и администрирование (RBAC) — тикет 15.

- PATCH  /users/me          — профиль (ФИО, организация)
- POST   /users/me/password — смена пароля (проверка старого, отзыв сессий)
- GET    /users             — список пользователей (админ ЦНТР)
- PATCH  /users/{id}        — роли и активность (админ ЦНТР)
- POST   /users/{id}/block  — блокировка аккаунта (админ ЦНТР, тикет 01)
- POST   /users/{id}/unblock — разблокировка аккаунта (админ ЦНТР, тикет 01)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.auth import _change_password, _user_out
from app.core.deps import (
    AdminWithMFA,
    CurrentUser,
    DBSession,
)
from app.core.security import verify_password
from app.db.models import (
    AuditTrailEntry,
    MfaCredential,
    MfaRecoveryCode,
    RefreshToken,
    Role,
    User,
    user_roles_tbl,
)
from app.schemas import (
    PasswordChangeIn,
    RoleOut,
    UserAdminOut,
    UserOut,
    UserRoleUpdateIn,
    UserUpdateIn,
)

router = APIRouter(prefix="/users", tags=["users"])

AdminUser = AdminWithMFA


def _admin_out(user: User) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        organization=user.organization,
        is_active=user.is_active,
        status=user.status,
        roles=[RoleOut(role_no=r.role_no, slug=r.slug, name=r.name) for r in user.roles],
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


async def _fresh_user(db: AsyncSession, user_id: int) -> User:
    """Перечитывает пользователя свежим запросом (обход identity-map)."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


# ─── Профиль ──────────────────────────────────────────────────────────────────


@router.patch("/me", response_model=UserOut)
async def update_profile(
    payload: UserUpdateIn, db: DBSession, user: CurrentUser
) -> UserOut:
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.organization is not None:
        user.organization = payload.organization
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: PasswordChangeIn, db: DBSession, user: CurrentUser
) -> None:
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный текущий пароль")
    # Отзыв refresh-сессий + аудит password.changed (тикет 01).
    await _change_password(db, user, payload.new_password)


# ─── Администрирование (админ ЦНТР) ───────────────────────────────────────────


@router.get("", response_model=list[UserAdminOut])
async def list_users(db: DBSession, user: AdminUser) -> list[UserAdminOut]:
    rows = await db.execute(select(User).order_by(User.created_at.desc()))
    return [_admin_out(u) for u in rows.scalars().all()]


@router.patch("/{user_id}", response_model=UserAdminOut)
async def update_user(
    user_id: int,
    payload: UserRoleUpdateIn,
    db: DBSession,
    user: AdminUser,
) -> UserAdminOut:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")

    if payload.roles:
        roles = (
            (await db.execute(select(Role).where(Role.slug.in_(payload.roles))))
            .scalars()
            .all()
        )
        found = {r.slug for r in roles}
        missing = set(payload.roles) - found
        if missing:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Неизвестные роли: {', '.join(sorted(missing))}"
            )
        # Частичный уникальный индекс user_roles_primary_uq допускает только
        # одну primary-роль — первая становится primary, остальные нет.
        await db.execute(user_roles_tbl.delete().where(user_roles_tbl.c.user_id == target.id))
        for idx, role in enumerate(roles):
            await db.execute(
                user_roles_tbl.insert().values(
                    user_id=target.id, role_id=role.id, is_primary=(idx == 0)
                )
            )
    if payload.is_active is not None:
        target.is_active = payload.is_active

    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="user.updated",
            details={
                "target_user_id": target.id,
                "roles": payload.roles,
                "is_active": payload.is_active,
            },
        )
    )
    await db.commit()
    # Роли могли быть изменены напрямую (raw DML) — перечитываем свежим запросом,
    # обходя identity-map (populate_existing), иначе вернётся старый объект.
    return _admin_out(await _fresh_user(db, user_id))


@router.post("/{user_id}/block", response_model=UserAdminOut)
async def block_user(user_id: int, db: DBSession, user: AdminUser) -> UserAdminOut:
    """Блокировка аккаунта: status='blocked', отзыв refresh-сессий (тикет 01)."""
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")
    if target.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя заблокировать собственный аккаунт")

    target.status = "blocked"
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == target.id))
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="user.blocked",
            details={"target_user_id": target.id, "email": target.email},
        )
    )
    await db.commit()
    return _admin_out(await _fresh_user(db, user_id))


@router.post("/{user_id}/unblock", response_model=UserAdminOut)
async def unblock_user(user_id: int, db: DBSession, user: AdminUser) -> UserAdminOut:
    """Разблокировка: status='verified' (если email подтверждён), иначе 'unverified'."""
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")

    target.status = "verified" if target.email_verified_at is not None else "unverified"
    target.locked_until = None
    target.login_attempts = 0
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="user.unblocked",
            details={"target_user_id": target.id, "email": target.email},
        )
    )
    await db.commit()
    return _admin_out(await _fresh_user(db, user_id))


@router.post("/{user_id}/mfa-reset", response_model=UserAdminOut)
async def reset_user_mfa(user_id: int, db: DBSession, user: AdminUser) -> UserAdminOut:
    """Административный сброс «потерянной» MFA (тикет 02).

    Удаляет credential и recovery-коды целевого пользователя; после сброса
    пользователь заново проходит enroll/confirm. Аудит mfa.admin_reset.
    """
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")

    await db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == target.id))
    await db.execute(delete(MfaCredential).where(MfaCredential.user_id == target.id))
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="mfa.admin_reset",
            details={"target_user_id": target.id},
        )
    )
    await db.commit()
    return _admin_out(await _fresh_user(db, user_id))
