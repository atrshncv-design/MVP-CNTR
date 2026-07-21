from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.core.deps import CurrentUser, DBSession
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User, stmt_role_by_slug, stmt_user_by_email
from app.schemas import LoginIn, RegisterIn, RoleOut, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn, db: DBSession) -> TokenOut:
    role = await db.scalar(stmt_role_by_slug(payload.role_slug))
    if role is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Неизвестная роль: {payload.role_slug}")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        organization=payload.organization,
        roles=[role],
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Пользователь с таким email уже существует"
        ) from exc
    await db.refresh(user, attribute_names=["roles"])

    token = create_access_token(user.id, extra={"roles": [r.slug for r in user.roles]})
    return TokenOut(access_token=token, user=_user_out(user))


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: DBSession) -> TokenOut:
    user = await db.scalar(stmt_user_by_email(payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт деактивирован")
    await db.refresh(user, attribute_names=["roles"])
    token = create_access_token(user.id, extra={"roles": [r.slug for r in user.roles]})
    return TokenOut(access_token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return _user_out(user)


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        organization=user.organization,
        is_active=user.is_active,
        roles=[RoleOut(role_no=r.role_no, slug=r.slug, name=r.name) for r in user.roles],
    )
