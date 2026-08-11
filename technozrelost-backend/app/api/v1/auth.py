from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.deps import CNTR_STAFF_SLUGS, CurrentUser, DBSession, is_cntr_staff
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.db.models import (
    AuditTrailEntry,
    ConsentAcceptance,
    ConsentVersion,
    MfaChallenge,
    MfaCredential,
    RefreshToken,
    User,
    stmt_role_by_slug,
    stmt_user_by_email,
)
from app.schemas import (
    ChangePasswordIn,
    ForgotPasswordIn,
    LoginIn,
    MfaLoginOut,
    RefreshTokenIn,
    RegisterIn,
    ResendVerificationIn,
    ResetPasswordIn,
    RoleOut,
    TokenOut,
    UserOut,
    VerifyEmailIn,
)
from app.services import security_metrics
from app.services.consent_service import (
    REQUIRED_CONSENT_SLUGS,
    get_consent_version,
    latest_consent_version,
)
from app.services.email_service import get_email_service
from app.services.kill_switches import ensure_enabled

router = APIRouter(prefix="/auth", tags=["auth"])

email_delivery = get_email_service()

_GENERIC_EMAIL_MESSAGE = "Если аккаунт с таким email существует, инструкции отправлены"


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


async def _change_password(db, user: User, new_password: str) -> None:
    """Смена пароля + отзыв всех активных refresh-сессий + аудит (тикет 01)."""
    user.password_hash = hash_password(new_password)
    user.login_attempts = 0
    user.locked_until = None
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="password.changed",
            details={"target_user_id": user.id},
        )
    )
    await db.commit()


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn, db: DBSession) -> TokenOut:
    ensure_enabled("registration")  # kill switch: регистрация off → 503
    if payload.role_slug in CNTR_STAFF_SLUGS:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Роли работников ЦНТР назначаются администратором центра",
        )

    role = await db.scalar(stmt_role_by_slug(payload.role_slug))
    if role is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Неизвестная роль: {payload.role_slug}")

    # ─── Обязательные согласия (тикет 04) ──────────────────────────────────
    # Без принятия актуальных версий terms/privacy регистрация невозможна (400).
    # Валидация ДО создания пользователя — не создаём осиротевшие аккаунты.
    accepted: dict[str, int] = {
        c.slug: c.version for c in payload.consents if c.accepted
    }
    missing = [s for s in REQUIRED_CONSENT_SLUGS if s not in accepted]
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Необходимо принять обязательные согласия: "
            + ", ".join(REQUIRED_CONSENT_SLUGS),
        )
    consent_versions: list[ConsentVersion] = []
    for slug, version in accepted.items():
        consent = await get_consent_version(db, slug, version)
        if consent is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Неизвестная версия согласия {slug} v{version}",
            )
        latest = await latest_consent_version(db, slug)
        if latest is None or latest.version != version:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Принята устаревшая версия согласия {slug}: актуальная "
                f"v{latest.version if latest else '?'}",
            )
        consent_versions.append(consent)

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        organization=payload.organization,
        roles=[role],
        status="unverified",
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Пользователь с таким email уже существует"
        ) from exc
    for consent in consent_versions:
        db.add(ConsentAcceptance(user_id=user.id, consent_version_id=consent.id))
    await db.commit()
    await db.refresh(user, attribute_names=["roles"])

    # Verification-токен (одноразовый, 24ч) → тестовая доставка.
    token = secrets.token_urlsafe(32)
    user.email_verification_token_hash = hash_token(token)
    user.email_verification_token_expires_at = datetime.now(UTC) + timedelta(
        hours=settings.email_verification_ttl_hours
    )
    await db.commit()
    await email_delivery.send_verification(db, user.email, token)

    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="auth.register",
            details={"role_slug": payload.role_slug},
        )
    )
    await db.commit()

    # Токены выдаются, но чувствительные операции заблокированы до verified (403).
    security_metrics.auth_register()
    return await _issue_tokens(db, user)


@router.post("/login", response_model=TokenOut | MfaLoginOut)
async def login(payload: LoginIn, db: DBSession) -> TokenOut | MfaLoginOut:
    """Вход с throttling: >= 5 неудачных попыток → блокировка входа на 15 минут.

    MFA (тикет 02): у служебного пользователя (cntr_admin/cntr_manager/superuser)
    с включённой MFA токены НЕ выдаются — возвращается {mfa_required, challenge_token}
    (одноразовый, 5 минут, хеш в mfa_challenges); завершение входа — /auth/mfa/verify.
    """
    now = datetime.now(UTC)
    user = await db.scalar(stmt_user_by_email(payload.email))
    if user is None:
        security_metrics.auth_login_failed()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")

    if user.locked_until is not None and user.locked_until > now:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много попыток входа. Попробуйте позже"
        )

    if not verify_password(payload.password, user.password_hash):
        user.login_attempts += 1
        security_metrics.auth_login_failed()
        db.add(
            AuditTrailEntry(
                project_id=None,
                user_id=user.id,
                action="auth.login_failed",
                details={"attempts": user.login_attempts},
            )
        )
        if user.login_attempts >= settings.login_max_attempts:
            locked_until = now + timedelta(minutes=settings.login_lock_minutes)
            user.locked_until = locked_until
            db.add(
                AuditTrailEntry(
                    project_id=None,
                    user_id=user.id,
                    action="auth.locked",
                    details={"locked_until": locked_until.isoformat()},
                )
            )
            security_metrics.auth_login_locked()
        await db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")

    if user.status == "blocked":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт заблокирован")
    if user.status == "deleted":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт удалён")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт деактивирован")

    # Успешный вход: сбрасываем счётчик попыток.
    user.login_attempts = 0
    user.locked_until = None
    security_metrics.auth_login_success()
    await db.refresh(user, attribute_names=["roles"])

    # MFA-этап для служебных аккаунтов (вместо выдачи токенов).
    if is_cntr_staff(user) or user.is_superuser:
        cred = await db.scalar(
            select(MfaCredential).where(MfaCredential.user_id == user.id)
        )
        if cred is not None and cred.enabled:
            challenge = secrets.token_urlsafe(32)
            db.add(
                MfaChallenge(
                    user_id=user.id,
                    token_hash=hash_token(challenge),
                    expires_at=now + timedelta(minutes=settings.mfa_challenge_ttl_minutes),
                )
            )
            await db.commit()
            return MfaLoginOut(mfa_required=True, challenge_token=challenge)

    await db.commit()
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="auth.login_success",
            details={},
        )
    )
    await db.commit()
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
    if user.status in ("blocked", "deleted"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт заблокирован")

    # Ротация: отзываем старый, выдаём новую пару
    row.revoked_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(user, attribute_names=["roles"])
    return await _issue_tokens(db, user)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return _user_out(user)


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailIn, db: DBSession) -> dict:
    """Одноразовое подтверждение email: токен сгорает после успеха (тикет 01)."""
    user = await db.scalar(
        select(User).where(User.email_verification_token_hash == hash_token(payload.token))
    )
    if user is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Недействительный или истёкший токен подтверждения"
        )
    now = datetime.now(UTC)
    if (
        user.email_verification_token_expires_at is None
        or user.email_verification_token_expires_at < now
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Недействительный или истёкший токен подтверждения"
        )
    if user.status in ("blocked", "deleted"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт заблокирован")

    user.email_verified_at = now
    user.status = "verified"
    user.email_verification_token_hash = None
    user.email_verification_token_expires_at = None
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="email.verified",
            details={"email": user.email},
        )
    )
    await db.commit()
    return {"detail": "Email подтверждён", "status": "verified"}


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
async def resend_verification(payload: ResendVerificationIn, db: DBSession) -> dict:
    """Повторная отправка verification-письма (throttle 1 раз в N минут).

    Ответ безопасен: для несуществующего/подтверждённого/заблокированного email
    возвращается тот же 202 (без enumeration). Throttle применяется только к
    реально существующим неподтверждённым аккаунтам.
    """
    user = await db.scalar(stmt_user_by_email(payload.email))
    if user is None or user.status != "unverified":
        return {"detail": _GENERIC_EMAIL_MESSAGE}

    now = datetime.now(UTC)
    if user.email_verification_token_expires_at is not None:
        issued_at = user.email_verification_token_expires_at - timedelta(
            hours=settings.email_verification_ttl_hours
        )
        if now - issued_at < timedelta(minutes=settings.resend_verification_minutes):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Письмо уже отправлено. Повторите попытку позже",
            )

    token = secrets.token_urlsafe(32)
    user.email_verification_token_hash = hash_token(token)
    user.email_verification_token_expires_at = now + timedelta(
        hours=settings.email_verification_ttl_hours
    )
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="email.resent",
            details={"email": user.email},
        )
    )
    await db.commit()
    await email_delivery.send_verification(db, user.email, token)
    return {"detail": _GENERIC_EMAIL_MESSAGE}


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(payload: ForgotPasswordIn, db: DBSession) -> dict:
    """Запрос сброса пароля: всегда 202, без enumeration (тикет 01)."""
    user = await db.scalar(stmt_user_by_email(payload.email))
    if user is not None and user.status not in ("blocked", "deleted"):
        token = secrets.token_urlsafe(32)
        user.password_reset_token_hash = hash_token(token)
        user.password_reset_token_expires_at = datetime.now(UTC) + timedelta(
            minutes=settings.password_reset_ttl_minutes
        )
        db.add(
            AuditTrailEntry(
                project_id=None,
                user_id=user.id,
                action="password.reset_requested",
                details={"email": user.email},
            )
        )
        await db.commit()
        await email_delivery.send_reset(db, user.email, token)
    return {"detail": _GENERIC_EMAIL_MESSAGE}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordIn, db: DBSession) -> dict:
    """Сброс пароля по одноразовому токену + отзыв всех refresh-сессий (тикет 01)."""
    user = await db.scalar(
        select(User).where(User.password_reset_token_hash == hash_token(payload.token))
    )
    now = datetime.now(UTC)
    if (
        user is None
        or user.password_reset_token_expires_at is None
        or user.password_reset_token_expires_at < now
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Недействительный или истёкший токен сброса пароля"
        )
    if user.status in ("blocked", "deleted"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт заблокирован")

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_token_expires_at = None
    user.login_attempts = 0
    user.locked_until = None
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="password.reset_completed",
            details={"email": user.email},
        )
    )
    await db.commit()
    return {"detail": "Пароль изменён"}


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(payload: ChangePasswordIn, db: DBSession, user: CurrentUser) -> None:
    """Смена пароля авторизованным пользователем (требует старый пароль)."""
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный текущий пароль")
    await _change_password(db, user, payload.new_password)


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        organization=user.organization,
        is_active=user.is_active,
        status=user.status,
        roles=[RoleOut(role_no=r.role_no, slug=r.slug, name=r.name) for r in user.roles],
    )
