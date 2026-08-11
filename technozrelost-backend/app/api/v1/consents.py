"""Согласия (тикет 04 identity-organizations): каталог версий, принятие, mine, revoke.

- GET  /consents            — публичный каталог версий (is_draft в ответе:
                              launch gate BLOCKED, пока есть черновики).
- POST /consents/accept     — повторное принятие актуальной версии {slug, version}.
- GET  /consents/mine       — свои согласия: версия, дата, required, pending.
- POST /consents/{id}/revoke — отзыв согласия: опциональные — отзываются;
                              обязательные (terms/privacy) — инициируют
                              deletion-request (отзыв невозможен без удаления
                              аккаунта — зафиксированное решение).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.db.models import (
    AuditTrailEntry,
    ConsentAcceptance,
    ConsentVersion,
)
from app.schemas import (
    ConsentAcceptIn,
    ConsentAcceptOut,
    ConsentMineOut,
    ConsentVersionOut,
    DeletionRequestOut,
)
from app.services.consent_service import (
    create_deletion_request,
    is_required_consent,
    record_acceptance,
)

router = APIRouter(prefix="/consents", tags=["consents"])


@router.get("", response_model=list[ConsentVersionOut])
async def list_consents(db: DBSession) -> list[ConsentVersionOut]:
    """Все версии согласий (публично): черновики помечены is_draft=True."""
    rows = (
        (
            await db.execute(
                select(ConsentVersion).order_by(
                    ConsentVersion.slug, ConsentVersion.version
                )
            )
        )
        .scalars()
        .all()
    )
    return [
        ConsentVersionOut(
            id=v.id,
            slug=v.slug,
            version=v.version,
            title=v.title,
            text=v.text,
            is_draft=v.is_draft,
            published_at=v.published_at.isoformat() if v.published_at else None,
        )
        for v in rows
    ]


@router.post("/accept", response_model=ConsentAcceptOut)
async def accept_consent(
    payload: ConsentAcceptIn, db: DBSession, user: CurrentUser
) -> ConsentAcceptOut:
    """Повторное принятие версии согласия (только актуальная версия).

    Устаревшая версия отклоняется 400: она не снимает pending. Повторное
    принятие той же версии — идемпотентно (200).
    """
    if not payload.accepted:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Согласие можно только принять (accepted=true)",
        )
    acceptance = await record_acceptance(db, user.id, payload.slug, payload.version)
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="consent.accepted",
            details={"slug": payload.slug, "version": payload.version},
        )
    )
    await db.commit()
    return ConsentAcceptOut(
        slug=payload.slug,
        version=payload.version,
        accepted=True,
        accepted_at=acceptance.accepted_at.isoformat(),
    )


@router.get("/mine", response_model=list[ConsentMineOut])
async def my_consents(db: DBSession, user: CurrentUser) -> list[ConsentMineOut]:
    """Свои согласия: версия, дата принятия, обязательность, pending.

    pending=True у обязательного согласия, актуальная версия которого не
    принята (появилась новая версия) — чувствительные операции блокируются 403.
    """
    versions = (
        (
            await db.execute(
                select(ConsentVersion).order_by(
                    ConsentVersion.slug, ConsentVersion.version
                )
            )
        )
        .scalars()
        .all()
    )
    acceptances = {
        a.consent_version_id: a
        for a in (
            await db.execute(
                select(ConsentAcceptance).where(
                    ConsentAcceptance.user_id == user.id
                )
            )
        )
        .scalars()
        .all()
    }
    latest_by_slug: dict[str, int] = {}
    for v in versions:
        latest_by_slug[v.slug] = v.version

    result: list[ConsentMineOut] = []
    for v in versions:
        acc = acceptances.get(v.id)
        required = is_required_consent(v.slug)
        pending = (
            required
            and latest_by_slug.get(v.slug) == v.version
            and acc is None
        )
        result.append(
            ConsentMineOut(
                id=v.id,
                slug=v.slug,
                version=v.version,
                title=v.title,
                is_draft=v.is_draft,
                required=required,
                accepted=acc is not None,
                accepted_at=acc.accepted_at.isoformat() if acc else None,
                pending=pending,
            )
        )
    return result


@router.post("/{consent_version_id}/revoke", response_model=dict)
async def revoke_consent(
    consent_version_id: int, db: DBSession, user: CurrentUser
) -> dict:
    """Отзыв принятого согласия.

    Решение (зафиксировано): опциональные согласия отзываются (запись
    удаляется); обязательные (terms/privacy) отозвать нельзя — отзыв
    равносилен отказу от платформы и инициирует deletion-request.
    """
    consent = await db.get(ConsentVersion, consent_version_id)
    if consent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Согласие не найдено")
    acceptance = await db.scalar(
        select(ConsentAcceptance).where(
            ConsentAcceptance.user_id == user.id,
            ConsentAcceptance.consent_version_id == consent_version_id,
        )
    )
    if acceptance is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Согласие не было принято — отзывать нечего"
        )

    if is_required_consent(consent.slug):
        # Отзыв обязательного согласия = запрос на удаление аккаунта.
        request, _created = await create_deletion_request(db, user)
        db.add(
            AuditTrailEntry(
                project_id=None,
                user_id=user.id,
                action="consent.revoked",
                details={
                    "slug": consent.slug,
                    "version": consent.version,
                    "deletion_request_id": request.id,
                },
            )
        )
        await db.commit()
        return {
            "detail": (
                "Обязательное согласие отозвать нельзя: инициирован запрос на "
                "удаление аккаунта"
            ),
            "revoked": False,
            "deletion_request": DeletionRequestOut(
                id=request.id,
                user_id=request.user_id,
                requested_at=request.requested_at.isoformat(),
                processed_at=request.processed_at.isoformat()
                if request.processed_at
                else None,
                state=request.state,
                requested_by=request.requested_by,
            ),
        }

    await db.delete(acceptance)
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user.id,
            action="consent.revoked",
            details={"slug": consent.slug, "version": consent.version},
        )
    )
    await db.commit()
    return {
        "detail": "Согласие отозвано",
        "revoked": True,
        "slug": consent.slug,
        "version": consent.version,
    }
