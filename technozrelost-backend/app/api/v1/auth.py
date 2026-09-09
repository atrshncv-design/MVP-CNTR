from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.deps import SELF_REGISTER_ALLOWED_SLUGS, CurrentUser, DBSession
from app.core.errors import raise_error
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


async def _issue_tokens(db: AsyncSession, user: User) -> TokenOut:
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
async def register(payload: RegisterIn, request: Request, db: DBSession) -> TokenOut:
    # N-08 троттлинг register как login (10/60s) — per email+IP, как login
    client_host = auth_throttle.source_from_request(request)
    if await auth_throttle.is_blocked(payload.email, client_host):
        raise raise_error("AUTH_REGISTER_LIMIT", request=request)
    # R04i (таск 03): саморегистрация только по allowlist непривилегированных
    # ролей; auditor/regulating_organization/investor/staff → 403, выдача только
    # администратором через PATCH /users/{id}. Неизвестный slug проверяется ниже
    # (400 AUTH_UNKNOWN_ROLE) — allowlist не раскрывает существование ролей.
    if payload.role_slug not in SELF_REGISTER_ALLOWED_SLUGS:
        role_known = await db.scalar(stmt_role_by_slug(payload.role_slug))
        if role_known is None:
            raise raise_error(
                "AUTH_UNKNOWN_ROLE", {"role": payload.role_slug}, request=request
            )
        raise raise_error("AUTH_PRIVILEGED_ROLE_FORBIDDEN", request=request)

    role = await db.scalar(stmt_role_by_slug(payload.role_slug))
    if role is None:
        raise raise_error(
            "AUTH_UNKNOWN_ROLE", {"role": payload.role_slug}, request=request
        )

    user = User(
        email=payload.email,
        # bcrypt синхронный и дорогой — в threadpool, иначе блокирует event loop
        # (таск 06: всплеск логинов/регистраций сериализовался на одном ядре).
        password_hash=await run_in_threadpool(hash_password, payload.password),
        full_name=payload.full_name,
        organization=payload.organization,
        roles=[role],
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        await auth_throttle.record_failure(payload.email, client_host)
        raise raise_error("AUTH_EMAIL_EXISTS", request=request) from exc
    await db.refresh(user, attribute_names=["roles"])
    await auth_throttle.record_success(payload.email, client_host)

    return await _issue_tokens(db, user)


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, request: Request, db: DBSession) -> TokenOut:
    # Брутфорс: после серии неудачных попыток с одного источника — 429 (R05.5);
    # источник — X-Real-IP (ставит наш nginx из $remote_addr) или last hop
    # X-Forwarded-For ($proxy_add_x_forwarded_for дописывает реальный IP
    # последним, первые хопы клиент подделывает), иначе client.host
    client_host = auth_throttle.source_from_request(request)
    if await auth_throttle.is_blocked(payload.email, client_host):
        raise raise_error("AUTH_LOGIN_LIMIT", request=request)
    user = await db.scalar(stmt_user_by_email(payload.email))
    if user is None or not await run_in_threadpool(
        verify_password, payload.password, user.password_hash
    ):
        await auth_throttle.record_failure(payload.email, client_host)
        raise raise_error("AUTH_INVALID", request=request)
    await auth_throttle.record_success(payload.email, client_host)
    if not user.is_active:
        raise raise_error("AUTH_ACCOUNT_DISABLED", request=request)
    await db.refresh(user, attribute_names=["roles"])
    return await _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenOut)
async def refresh(payload: RefreshTokenIn, request: Request, db: DBSession) -> TokenOut:
    """Ротация refresh-токена: старый отзывается, выдаётся новая пара.

    R05i (таск 06): ротация — одним атомарным UPDATE с условием «ещё не
    отозван и не истёк». Почему так: check-then-act (SELECT, затем UPDATE)
    в двух параллельных запросах проигрывает гонку всегда — оба видят
    токен валидным и выдают по паре (два 200). Атомарный UPDATE берёт
    строковую блокировку: побеждает один (200), второй видит 0 строк (401).

    Повторное использование уже отозванного токена — компрометация семьи:
    отзываем все refresh-токены пользователя (N-09) и отклоняем запрос (401).
    Проигравший гонку тоже отзывает семью, если пара победителя уже
    закоммитилась, — reuse есть reuse; гонка проверяется кодами 200/401.
    """
    try:
        claims = decode_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise ValueError("not a refresh token")
        int(claims["sub"])
    except Exception as exc:  # noqa: BLE001
        raise raise_error("AUTH_REFRESH_INVALID", request=request) from exc

    token_hash = hash_token(payload.refresh_token)
    now = datetime.now(UTC)
    # Атомарная заявка: «забери, если ещё не отозван и не истёк».
    # Строка блокируется до коммита — второй конкурент ждёт, затем видит
    # 0 обновлённых строк и уходит в ветку reuse/expired, а не выдаёт пару.
    claimed = await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at >= now,
        )
        .values(revoked_at=now)
        .returning(RefreshToken.user_id)
    )
    claimed_row = claimed.fetchone()
    if claimed_row is not None:
        winner_user_id = int(claimed_row[0])
        user = await db.get(User, winner_user_id)
        if user is None or not user.is_active:
            # Как раньше: неактивному пару не выдаём и токен не потребляем —
            # откатываем заявку, чтобы не менять семантику ошибок.
            await db.rollback()
            raise raise_error("AUTH_USER_INACTIVE", request=request)
        await db.refresh(user, attribute_names=["roles"])
        # Коммит внутри сохраняет ревок старого и выпуск нового атомарно.
        return await _issue_tokens(db, user)

    # Заявка не удалась: причину отдаём тем же швом ошибок, что раньше.
    row = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if row is None:
        raise raise_error("AUTH_REFRESH_REVOKED", request=request)
    if row.revoked_at is not None:
        # N-09: reuse отозванного токена → ревок всей семьи пользователя.
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == row.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
        await db.commit()
        raise raise_error("AUTH_REFRESH_REVOKED", request=request)
    raise raise_error("AUTH_REFRESH_EXPIRED", request=request)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshTokenIn, db: DBSession) -> None:
    """Выход: ревок текущего refresh-токена (R15).

    Access доживает до истечения (≤60 минут) — принятый компромисс без
    stateful-блоклиста access-токенов. Ответ 204 даже для неизвестного токена:
    не раскрываем валидность чужих значений, выход идемпотентен.
    """
    token_hash = hash_token(payload.refresh_token)
    row = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if row is not None and row.revoked_at is None:
        row.revoked_at = datetime.now(UTC)
        await db.commit()


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
