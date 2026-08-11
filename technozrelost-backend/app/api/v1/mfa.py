"""MFA endpoints (тикет 02 identity-organizations).

- POST /auth/mfa/enroll          — только cntr_admin/cntr_manager; секрет один раз
- POST /auth/mfa/confirm         — TOTP-проверка + выдача 10 recovery-кодов (один раз)
- POST /auth/mfa/disable         — отключение только с валидным TOTP-кодом
- POST /auth/mfa/verify          — challenge_token + TOTP или recovery-код → токены
- POST /auth/mfa/recovery-codes  — повторный показ (ротация набора) только после TOTP

Безопасность: секрет шифруется Fernet; challenge-токены одноразовые (5 мин),
хешированные; >= 5 неверных попыток → challenge locked; rate-limit на verify.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select

from app.api.v1.auth import _issue_tokens
from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.security import hash_token
from app.db.models import (
    AuditTrailEntry,
    MfaChallenge,
    MfaCredential,
    MfaRecoveryCode,
    User,
)
from app.schemas import (
    MfaConfirmIn,
    MfaDisableIn,
    MfaEnrollOut,
    MfaRecoveryCodesIn,
    MfaRecoveryCodesOut,
    MfaVerifyIn,
    TokenOut,
)
from app.services.mfa_service import (
    decrypt_secret,
    encrypt_secret,
    generate_recovery_codes,
    generate_secret,
    hash_recovery_code,
    otpauth_url,
    verify_totp,
)

router = APIRouter(prefix="/auth/mfa", tags=["auth"])

_MFA_NOT_CONFIGURED = "MFA не настроена"
_MFA_NOT_CONFIRMED = "MFA не подтверждена (завершите настройку TOTP)"
_MFA_ALREADY_ACTIVE = "MFA уже активна"
_GENERIC_BAD_CODE = "Неверный код подтверждения"
_MFA_LOCKED = "Слишком много неверных попыток. Повторите вход заново"


async def _get_credential(db, user_id: int) -> MfaCredential | None:
    return await db.scalar(select(MfaCredential).where(MfaCredential.user_id == user_id))


async def _audit(db, user_id: int, action: str, **details) -> None:
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user_id,
            action=action,
            details={"target_user_id": user_id, **details},
        )
    )


def _require_staff(user: User) -> None:
    slugs = {r.slug for r in user.roles}
    if not (slugs & {"cntr_admin", "cntr_manager"} or user.is_superuser):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Только сотрудники ЦНТР могут управлять MFA"
        )


# ─── Enroll / Confirm / Disable ──────────────────────────────────────────────


@router.post("/enroll", response_model=MfaEnrollOut)
async def mfa_enroll(db: DBSession, user: CurrentUser) -> MfaEnrollOut:
    """Начало настройки MFA: создаёт TOTP-секрет (если нет активной MFA).

    Секрет возвращается ОДИН раз: повторный enroll при активной MFA — 409;
    до confirm секрет (при повторном enroll) возвращается снова — MFA ещё не
    активна, иначе пользователь потерял бы возможность завершить настройку.
    """
    _require_staff(user)
    cred = await _get_credential(db, user.id)
    if cred is not None and cred.enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, _MFA_ALREADY_ACTIVE)

    if cred is not None:
        secret = decrypt_secret(cred.secret_encrypted)
    else:
        secret = generate_secret()
        db.add(
            MfaCredential(user_id=user.id, secret_encrypted=encrypt_secret(secret))
        )
        await _audit(db, user.id, "mfa.enrolled")
        await db.commit()

    return MfaEnrollOut(secret=secret, otpauth_url=otpauth_url(secret, user.email))


@router.post("/confirm", response_model=MfaRecoveryCodesOut)
async def mfa_confirm(
    payload: MfaConfirmIn, db: DBSession, user: CurrentUser
) -> MfaRecoveryCodesOut:
    """Подтверждение TOTP: enabled=true + выдача 10 recovery-кодов ОДИН раз."""
    _require_staff(user)
    cred = await _get_credential(db, user.id)
    if cred is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _MFA_NOT_CONFIGURED)
    if cred.enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, _MFA_ALREADY_ACTIVE)

    if not verify_totp(decrypt_secret(cred.secret_encrypted), payload.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _GENERIC_BAD_CODE)

    cred.enabled = True
    codes = generate_recovery_codes()
    await db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user.id))
    db.add_all(
        MfaRecoveryCode(user_id=user.id, code_hash=hash_recovery_code(c))
        for c in codes
    )
    await _audit(db, user.id, "mfa.confirmed", recovery_codes_count=len(codes))
    await db.commit()
    return MfaRecoveryCodesOut(recovery_codes=codes)


@router.post("/disable", status_code=status.HTTP_204_NO_CONTENT)
async def mfa_disable(payload: MfaDisableIn, db: DBSession, user: CurrentUser) -> None:
    """Отключение MFA только с валидным TOTP-кодом (recovery — не принимается)."""
    _require_staff(user)
    cred = await _get_credential(db, user.id)
    if cred is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _MFA_NOT_CONFIGURED)
    if not cred.enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, _MFA_NOT_CONFIRMED)
    if not verify_totp(decrypt_secret(cred.secret_encrypted), payload.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _GENERIC_BAD_CODE)

    await db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user.id))
    await db.delete(cred)
    await _audit(db, user.id, "mfa.disabled")
    await db.commit()


# ─── Verify (challenge) ──────────────────────────────────────────────────────


@router.post("/verify", response_model=TokenOut)
async def mfa_verify(payload: MfaVerifyIn, db: DBSession) -> TokenOut:
    """Завершение входа: challenge_token + TOTP-код ИЛИ recovery-код → токены.

    Одноразовый challenge (used_at), TTL 5 минут; attempts >= 5 → locked (403);
    глобальный rate-limit на verify (по числу mfa.failed за окно).
    """
    now = datetime.now(UTC)
    challenge = await db.scalar(
        select(MfaChallenge).where(
            MfaChallenge.token_hash == hash_token(payload.challenge_token)
        )
    )
    if challenge is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Challenge-токен недействителен")
    if challenge.used_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Challenge-токен уже использован")
    if challenge.expires_at < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Challenge-токен истёк")
    if challenge.attempts >= settings.mfa_max_attempts:
        raise HTTPException(status.HTTP_403_FORBIDDEN, _MFA_LOCKED)

    # Rate-limit: <= mfa_verify_rate_limit неудачных попыток за окно (по user).
    recent_failures = await db.scalar(
        select(func.count(AuditTrailEntry.id)).where(
            AuditTrailEntry.user_id == challenge.user_id,
            AuditTrailEntry.action == "mfa.failed",
            AuditTrailEntry.created_at
            >= now - timedelta(seconds=settings.mfa_verify_rate_window_seconds),
        )
    )
    if (recent_failures or 0) >= settings.mfa_verify_rate_limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Слишком много неверных попыток. Попробуйте позже",
        )

    cred = await _get_credential(db, challenge.user_id)
    if cred is None or not cred.enabled:
        challenge.used_at = now
        await db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "MFA не активна")

    code_ok = False
    recovery_row: MfaRecoveryCode | None = None
    if verify_totp(decrypt_secret(cred.secret_encrypted), payload.code, now):
        code_ok = True
    else:
        recovery_row = await db.scalar(
            select(MfaRecoveryCode).where(
                MfaRecoveryCode.user_id == challenge.user_id,
                MfaRecoveryCode.code_hash == hash_recovery_code(payload.code),
                MfaRecoveryCode.used_at.is_(None),
            )
        )
        code_ok = recovery_row is not None

    if not code_ok:
        challenge.attempts += 1
        await _audit(db, challenge.user_id, "mfa.failed", attempts=challenge.attempts)
        if challenge.attempts >= settings.mfa_max_attempts:
            # Brute force: 5-я неудача блокирует challenge (403 + аудит locked).
            challenge.used_at = now
            await _audit(db, challenge.user_id, "mfa.locked")
            await db.commit()
            raise HTTPException(status.HTTP_403_FORBIDDEN, _MFA_LOCKED)
        await db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _GENERIC_BAD_CODE)

    challenge.used_at = now
    if recovery_row is not None:
        recovery_row.used_at = now
        action = "mfa.recovery_used"
    else:
        action = "mfa.verified"
    await _audit(db, challenge.user_id, action)
    await db.commit()

    user = await db.get(User, challenge.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь неактивен")
    await db.refresh(user, attribute_names=["roles"])
    return await _issue_tokens(db, user)


# ─── Recovery-коды (повторный показ, только после TOTP) ─────────────────────


@router.post("/recovery-codes", response_model=MfaRecoveryCodesOut)
async def mfa_recovery_codes(
    payload: MfaRecoveryCodesIn, db: DBSession, user: CurrentUser
) -> MfaRecoveryCodesOut:
    """Повторный показ recovery-кодов при действующей сессии + валидный TOTP.

    Открытые коды в БД не хранятся (только sha256-хеши), поэтому «повторный
    показ» реализован как ротация: старый набор отзывается, выдаётся новый
    (одноразовый показ, аудит mfa.recovery_codes_reissued).
    """
    _require_staff(user)
    cred = await _get_credential(db, user.id)
    if cred is None or not cred.enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "MFA не активна")
    if not verify_totp(decrypt_secret(cred.secret_encrypted), payload.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _GENERIC_BAD_CODE)

    codes = generate_recovery_codes()
    await db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user.id))
    db.add_all(
        MfaRecoveryCode(user_id=user.id, code_hash=hash_recovery_code(c))
        for c in codes
    )
    await _audit(db, user.id, "mfa.recovery_codes_reissued", count=len(codes))
    await db.commit()
    return MfaRecoveryCodesOut(recovery_codes=codes)
