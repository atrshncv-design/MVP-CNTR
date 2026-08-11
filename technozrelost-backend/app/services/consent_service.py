"""Сервис версионируемых согласий и обезличивания аккаунта (тикет 04).

Обязательные согласия: terms, privacy. Принятие фиксируется в
consent_acceptances (неизменяемый след). При публикации новой версии
обязательного документа пользователи, принявшие старую версию, получают
pending-статус, и чувствительные операции (публикация проекта и т.п.)
блокируются 403 до повторного принятия.

Обезличивание (process deletion-request): PII пользователя заменяется
необратимыми значениями (email -> deleted-<id>@invalid.local, пароль —
случайный), а append-only audit_trail, проекты, документы и согласия
СОХРАНЯЮТСЯ с обезличенным автором (FK остаётся). Повторный process — no-op.

Политика PII: обезличенные значения не являются персональными данными и не
логируются; исходный email в новые audit-записи этого модуля не попадает.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.models import (
    ConsentAcceptance,
    ConsentVersion,
    DeletionRequest,
    MfaChallenge,
    MfaCredential,
    MfaRecoveryCode,
    OrganizationMember,
    RefreshToken,
    User,
    UserProfile,
)

# Обязательные согласия: без принятия актуальной версии — регистрация 400,
# чувствительные операции — 403 (pending).
REQUIRED_CONSENT_SLUGS = ("terms", "privacy")

# Черновики-плейсхолдеры (is_draft=TRUE, текст помечен «ЧЕРНОВИК») до
# утверждения юристом. Дублируется миграцией 0027 (seed) — здесь для тестового
# пере-seed после TRUNCATE (tests/support.seed_consent_versions).
SEED_CONSENTS: tuple[tuple[str, int, str, str], ...] = (
    (
        "terms",
        1,
        "Пользовательское соглашение",
        "ЧЕРНОВИК. Пользовательское соглашение платформы «Технозрелость» (ЦНТР, "
        "ГОСТ Р 58048-2017). Текст не утверждён юристом и не вступает в силу. "
        "Положения будут опубликованы после юридической проверки.",
    ),
    (
        "privacy",
        1,
        "Политика обработки персональных данных",
        "ЧЕРНОВИК. Политика обработки персональных данных платформы «Технозрелость» "
        "(152-ФЗ). Текст не утверждён юристом и не вступает в силу. Положения будут "
        "опубликованы после юридической проверки.",
    ),
)

DELETED_EMAIL_SUFFIX = "@invalid.local"
DELETED_DISPLAY_NAME = "Пользователь удалён"


def is_required_consent(slug: str) -> bool:
    return slug in REQUIRED_CONSENT_SLUGS


def user_display_name(user: User) -> str:
    """Отображаемое имя: для обезличенных аккаунтов — «Пользователь удалён»."""
    if user.status == "deleted":
        return DELETED_DISPLAY_NAME
    return user.full_name


async def latest_consent_version(db: AsyncSession, slug: str) -> ConsentVersion | None:
    """Текущая (максимальная) версия документа по slug."""
    return await db.scalar(
        select(ConsentVersion)
        .where(ConsentVersion.slug == slug)
        .order_by(ConsentVersion.version.desc())
        .limit(1)
    )


async def get_consent_version(
    db: AsyncSession, slug: str, version: int
) -> ConsentVersion | None:
    return await db.scalar(
        select(ConsentVersion).where(
            ConsentVersion.slug == slug, ConsentVersion.version == version
        )
    )


async def acceptance_for(
    db: AsyncSession, user_id: int, consent_version_id: int
) -> ConsentAcceptance | None:
    return await db.scalar(
        select(ConsentAcceptance).where(
            ConsentAcceptance.user_id == user_id,
            ConsentAcceptance.consent_version_id == consent_version_id,
        )
    )


async def latest_accepted_version(
    db: AsyncSession, user_id: int, slug: str
) -> ConsentVersion | None:
    """Версия, принятая пользователем для slug (максимальная среди принятых)."""
    return await db.scalar(
        select(ConsentVersion)
        .join(ConsentAcceptance, ConsentAcceptance.consent_version_id == ConsentVersion.id)
        .where(
            ConsentVersion.slug == slug,
            ConsentAcceptance.user_id == user_id,
        )
        .order_by(ConsentVersion.version.desc())
        .limit(1)
    )


async def pending_consents(db: AsyncSession, user_id: int) -> list[dict]:
    """Обязательные согласия, требующие повторного принятия (новая версия).

    pending = актуальная (максимальная) версия slug не принята пользователем.
    """
    pending: list[dict] = []
    for slug in REQUIRED_CONSENT_SLUGS:
        latest = await latest_consent_version(db, slug)
        if latest is None:
            continue  # seed отсутствует — не блокируем (не должно случаться)
        accepted = await acceptance_for(db, user_id, latest.id)
        if accepted is None:
            pending.append({"slug": slug, "version": latest.version})
    return pending


async def require_current_consents(db: AsyncSession, user_id: int) -> None:
    """403, если пользователь не принял актуальную версию обязательного согласия."""
    pending = await pending_consents(db, user_id)
    if pending:
        slugs = ", ".join(f"{p['slug']} v{p['version']}" for p in pending)
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Требуется повторное подтверждение согласий: {slugs}",
        )


async def record_acceptance(
    db: AsyncSession, user_id: int, slug: str, version: int
) -> ConsentAcceptance:
    """Фиксирует принятие версии (идемпотентно по UNIQUE(user_id, version_id)).

    Версия обязана существовать и быть АКТУАЛЬНОЙ для slug — иначе 400
    (устаревшая версия не снимает pending).
    """
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
            "Принята устаревшая версия согласия "
            f"{slug}: актуальная v{latest.version if latest else '?'}",
        )
    existing = await acceptance_for(db, user_id, consent.id)
    if existing is not None:
        return existing
    acceptance = ConsentAcceptance(user_id=user_id, consent_version_id=consent.id)
    db.add(acceptance)
    await db.flush()
    return acceptance


async def create_deletion_request(
    db: AsyncSession, user: User
) -> tuple[DeletionRequest, bool]:
    """Создаёт pending-запрос на удаление и отзывает все сессии пользователя.

    Идемпотентность: существующий pending/processing запрос возвращается как есть
    (created=False); завершённый (completed) — 409 (повторный запрос после
    обработки). Аудит должен писаться только при фактическом создании
    (created=True) — без дублей при повторных вызовах.
    """
    existing = await db.scalar(
        select(DeletionRequest).where(DeletionRequest.user_id == user.id)
    )
    if existing is not None:
        if existing.state in ("pending", "processing"):
            return existing, False
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Запрос на удаление аккаунта уже обработан",
        )

    request = DeletionRequest(user_id=user.id, state="pending", requested_by="self")
    db.add(request)
    await db.flush()
    # Отзыв всех сессий: refresh-токены и MFA-челленджи (access-токены живут до
    # истечения — JWT не отзывается; refresh-ротация после этого невозможна).
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.execute(delete(MfaChallenge).where(MfaChallenge.user_id == user.id))
    return request, True


async def anonymize_user(db: AsyncSession, user: User) -> None:
    """Необратимое обезличивание PII пользователя (process deletion-request).

    - email      -> deleted-<id>@invalid.local (уникально, необратимо)
    - password   -> случайный (вход невозможен)
    - full_name  -> пусто, organization -> NULL (display-имя — «Пользователь удалён»)
    - status     -> 'deleted', is_active -> False
    - сессии     -> refresh-токены и MFA-данные удалены
    - профиль    -> headline/bio/region/skills очищены
    - membership -> членства в организациях разорваны

    СОХРАНЯЮТСЯ: users-строка (FK проектов/аудита), audit_trail (append-only),
    проекты/документы/сообщения (автор-ссылка остаётся, профиль пуст),
    consent_acceptances (минимальный след), user_organizations (созданные
    организационные карточки с created_by на обезличенного пользователя).
    """
    user.email = f"deleted-{user.id}{DELETED_EMAIL_SUFFIX}"
    user.password_hash = hash_password(secrets.token_urlsafe(48))
    user.full_name = ""
    user.organization = None
    user.status = "deleted"
    user.is_active = False
    user.email_verified_at = None
    user.email_verification_token_hash = None
    user.email_verification_token_expires_at = None
    user.password_reset_token_hash = None
    user.password_reset_token_expires_at = None
    user.login_attempts = 0
    user.locked_until = None

    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.execute(delete(MfaChallenge).where(MfaChallenge.user_id == user.id))
    await db.execute(delete(MfaCredential).where(MfaCredential.user_id == user.id))
    await db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user.id))

    profile = await db.scalar(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    if profile is not None:
        profile.headline = None
        profile.bio = None
        profile.region = None
        profile.skills = []

    # Членства разрываются; созданные организационные карточки сохраняются
    # (created_by остаётся на обезличенного пользователя — история организации).
    await db.execute(
        delete(OrganizationMember).where(OrganizationMember.user_id == user.id)
    )


async def process_deletion_request(
    db: AsyncSession, request: DeletionRequest, processed_by: int
) -> DeletionRequest:
    """Обработка запроса администратором: обезличивание + завершение.

    Идемпотентность: повторный вызов для completed-запроса — no-op
    (состояние и данные не меняются).
    """
    if request.state == "completed":
        return request

    user = await db.get(User, request.user_id)
    if user is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Пользователь запроса не найден"
        )

    request.state = "processing"
    await db.flush()
    await anonymize_user(db, user)
    request.state = "completed"
    request.processed_at = datetime.now(UTC)
    # Аудит: без PII (email/имя не пишутся) — только идентификаторы.
    from app.db.models import AuditTrailEntry  # noqa: PLC0415 — локальный импорт

    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="account.deletion_processed",
            details={
                "request_id": request.id,
                "processed_by": processed_by,
                "user_status": "deleted",
            },
        )
    )
    return request
