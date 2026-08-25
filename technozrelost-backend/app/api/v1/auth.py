from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.deps import CNTR_STAFF_SLUGS, CurrentUser, DBSession
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.models import RefreshToken, User, stmt_role_by_slug, stmt_user_by_email
from app.schemas import LoginIn, RefreshTokenIn, RegisterIn, RoleOut, TokenOut, UserOut
from app.services import auth_throttle

router = APIRouter(prefix="/auth", tags=["auth"])


async def _issue_tokens(db, user: User) -> TokenOut:
    """Выдаёт пару access+refresh и сохраняет refresh (хеш) для отзыва/ротации."""
    access = create_access_token(user.id, extra={"roles": [r.slug for r in user.roles]})
    refresh = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_ttl_days),
        )
    )
    await db.commit()
    return TokenOut(access_token=access, refresh_token=refresh, user=_user_out(user))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn, db: DBSession) -> TokenOut:
    if payload.role_slug in CNTR_STAFF_SLUGS:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Роли работников ЦНТР назначаются администратором центра",
        )

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

    return await _issue_tokens(db, user)


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, request: Request, db: DBSession) -> TokenOut:
    # Брутфорс: после серии неудачных попыток с одного источника — 429 (R05.5);
    # источник — первый IP из X-Forwarded-For (доверенный прокси), иначе client.host
    client_host = auth_throttle.source_from_request(request)
    if auth_throttle.is_blocked(payload.email, client_host):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много попыток входа")
    user = await db.scalar(stmt_user_by_email(payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        auth_throttle.record_failure(payload.email, client_host)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")
    auth_throttle.record_success(payload.email, client_host)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт деактивирован")
    await db.refresh(user, attribute_names=["roles"])
    return await _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenOut)
async def refresh(payload: RefreshTokenIn, db: DBSession) -> TokenOut:
    """Ротация refresh-токена: старый отзывается, выдаётся новая пара.

    Повторное использование уже отозванного токена отклоняется (401).
    """
    try:
        claims = decode_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise ValueError("not a refresh token")
        user_id = int(claims["sub"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидный refresh-токен") from exc

    token_hash = hash_token(payload.refresh_token)
    row = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    if row is None or row.revoked_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh-токен отозван или не найден")
    if row.expires_at < datetime.now(UTC):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh-токен истёк")

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь неактивен")

    # Ротация: отзываем старый, выдаём новую пару
    row.revoked_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(user, attribute_names=["roles"])
    return await _issue_tokens(db, user)


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
