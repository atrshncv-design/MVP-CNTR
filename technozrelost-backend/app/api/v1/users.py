"""Профиль пользователя и администрирование (RBAC) — тикет 15.

- PATCH  /users/me          — профиль (ФИО, организация)
- POST   /users/me/password — смена пароля (проверка старого)
- GET    /users             — список пользователей (админ ЦНТР)
- PATCH  /users/{id}        — роли и активность (админ ЦНТР)
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.api.v1.auth import _user_out
from app.core.deps import PRIVILEGED_ROLE_SLUGS, CurrentUser, DBSession, require_role
from app.core.errors import raise_error
from app.core.security import hash_password, verify_password
from app.db.models import AuditTrailEntry, RefreshToken, Role, User, user_roles_tbl
from app.schemas import (
    PasswordChangeIn,
    RoleOut,
    UserAdminOut,
    UserOut,
    UserRoleUpdateIn,
    UserUpdateIn,
)

router = APIRouter(prefix="/users", tags=["users"])

AdminUser = Annotated[User, Depends(require_role("cntr_admin"))]


def _admin_out(user: User) -> UserAdminOut:
    return UserAdminOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        organization=user.organization,
        is_active=user.is_active,
        roles=[RoleOut(role_no=r.role_no, slug=r.slug, name=r.name) for r in user.roles],
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


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
    payload: PasswordChangeIn, request: Request, db: DBSession, user: CurrentUser
) -> None:
    # Q-01 bcrypt в threadpool — не блокирует event loop при смене пароля
    if not await asyncio.to_thread(verify_password, payload.old_password, user.password_hash):
        raise raise_error("AUTH_WRONG_PASSWORD", request=request)
    user.password_hash = await asyncio.to_thread(hash_password, payload.new_password)
    # R15: смена пароля (утеря ноутбука) обязана убить ВСЕ сессии —
    # ревоким каждый живой refresh пользователя одним запросом.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()


# ─── Администрирование (админ ЦНТР) ───────────────────────────────────────────


@router.get("", response_model=list[UserAdminOut])
async def list_users(
    db: DBSession,
    user: AdminUser,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[UserAdminOut]:
    """Список пользователей постранично (P2, таск 14).

    limit/offset с верхней границей: 10k записей не отдаются одним ответом.
    Сортировка стабильна (created_at, id), страницы не пересекаются.
    """
    rows = await db.execute(
        select(User).order_by(User.created_at.desc(), User.id.desc()).limit(limit).offset(offset)
    )
    return [_admin_out(u) for u in rows.scalars().all()]


@router.patch("/{user_id}", response_model=UserAdminOut)
async def update_user(
    user_id: int,
    payload: UserRoleUpdateIn,
    request: Request,
    db: DBSession,
    user: AdminUser,
) -> UserAdminOut:
    target = await db.get(User, user_id)
    if target is None:
        raise raise_error("USER_NOT_FOUND", request=request)

    # R04i (таск 03): срез привилегированных ролей до изменения — для аудита
    # выдачи/отзыва. Прямой SQL по user_roles: identity-map после raw DML ниже
    # отдаёт stale-объект, поэтому срез делаем заранее тем же путём.
    _privileged = set(PRIVILEGED_ROLE_SLUGS)
    old_privileged: set[str] = set()
    if payload.roles:
        old_rows = await db.execute(
            select(Role.slug)
            .join(user_roles_tbl, user_roles_tbl.c.role_id == Role.id)
            .where(user_roles_tbl.c.user_id == target.id)
        )
        old_privileged = set(old_rows.scalars().all()) & _privileged

    if payload.roles:
        roles = (
            (await db.execute(select(Role).where(Role.slug.in_(payload.roles))))
            .scalars()
            .all()
        )
        found = {r.slug for r in roles}
        missing = set(payload.roles) - found
        if missing:
            raise raise_error(
                "USER_UNKNOWN_ROLES",
                {"roles": ", ".join(sorted(missing))},
                request=request,
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
    # R04i (таск 03): выдача/отзыв привилегированной роли — отдельными
    # append-only записями, чтобы аудит отвечал «кто кому выдал/снял».
    if payload.roles:
        new_privileged = set(payload.roles) & _privileged
        for slug in sorted(new_privileged - old_privileged):
            db.add(
                AuditTrailEntry(
                    project_id=None,
                    user_id=user.id,
                    action="user.role.granted",
                    details={"target_user_id": target.id, "role": slug},
                )
            )
        for slug in sorted(old_privileged - new_privileged):
            db.add(
                AuditTrailEntry(
                    project_id=None,
                    user_id=user.id,
                    action="user.role.revoked",
                    details={"target_user_id": target.id, "role": slug},
                )
            )
    await db.commit()
    # Роли могли быть изменены напрямую (raw DML) — перечитываем свежим запросом,
    # обходя identity-map (populate_existing), иначе вернётся старый объект.
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
        .execution_options(populate_existing=True)
    )
    fresh = result.scalar_one()
    return _admin_out(fresh)
