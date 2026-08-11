"""Карточка организации по ИНН (тикет 03 identity-organizations).

Карточка живёт в таблице user_organizations (та же, что и legacy /orgs в
profiles.py — дополняем, не дублируем). Новый контур:
  * POST /organizations            — создание карточки (draft), ИНН обязателен,
                                     дубликат ИНН → 409 (безопасный ответ);
  * POST /organizations/{id}/join  — привязка пользователя ТОЛЬКО к verified;
  * POST /organizations/{id}/submit— отправка на проверку (draft/rejected → pending);
  * GET  /organizations/{id}       — публичные поля всем, внутренние — staff;
  * POST /manager/orgs/{id}/verify — ручная верификация менеджером Центра
                                     (verified|rejected + аудит).

IDOR: непубличная карточка (draft/pending/rejected) не раскрывается чужим
пользователям — 404; внутренние поля (review_comment, verification_decision,
reviewed_by/at, created_by) видны только сотрудникам Центра.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.deps import (
    CurrentUser,
    CurrentUserOptional,
    DBSession,
    ManagerWithMFA,
    VerifiedUser,
    is_cntr_staff,
)
from app.core.validators import is_valid_ogrn, validate_inn
from app.db.models import AuditTrailEntry, OrganizationMember, UserOrganization
from app.schemas import OrgCardIn, OrgCardPublicOut, OrgVerifyIn

router = APIRouter(tags=["organizations"])

EDITABLE_STATES = ("draft", "rejected")


def _audit(db: DBSession, user_id: int, action: str, **details) -> None:
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user_id,
            action=action,
            details={"org_id": details.pop("org_id", None), **details},
        )
    )


def _card_out(
    org: UserOrganization,
    *,
    member_role: str | None = None,
    is_primary: bool = False,
    staff: bool = False,
) -> OrgCardPublicOut:
    """Публичное представление карточки; staff=True заполняет внутренние поля."""
    return OrgCardPublicOut(
        id=org.id,
        name=org.name,
        short_name=org.short_name,
        inn=org.inn,
        ogrn=org.ogrn,
        kpp=org.kpp,
        org_type=org.org_type,
        region=org.region,
        description=org.description,
        contacts=org.contacts or [],
        state=org.state,
        created_at=org.created_at.isoformat() if org.created_at else None,
        member_role=member_role,
        is_primary=is_primary,
        # staff-only:
        review_comment=org.review_comment if staff else None,
        verification_decision=org.verification_decision if staff else None,
        reviewed_by=org.reviewed_by if staff else None,
        reviewed_at=org.reviewed_at.isoformat() if staff and org.reviewed_at else None,
        created_by=org.created_by if staff else None,
    )


async def _get_membership(db: DBSession, org_id: int, user_id: int) -> OrganizationMember | None:
    return (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()


async def _require_admin_membership(
    db: DBSession, org: UserOrganization, user_id: int
) -> OrganizationMember:
    membership = await _get_membership(db, org.id, user_id)
    if membership is None or membership.role_in_org != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Действие доступно только администратору организации"
        )
    return membership


async def _inn_conflict(db: DBSession, inn: str, exclude_id: int | None = None) -> bool:
    stmt = select(UserOrganization.id).where(UserOrganization.inn == inn)
    if exclude_id is not None:
        stmt = stmt.where(UserOrganization.id != exclude_id)
    return (await db.execute(stmt)).first() is not None


@router.post("/organizations", response_model=OrgCardPublicOut, status_code=status.HTTP_201_CREATED)
async def create_organization_card(
    payload: OrgCardIn, db: DBSession, user: CurrentUser
) -> OrgCardPublicOut:
    """Создание карточки организации по ИНН (черновик).

    ИНН нормализуется (только цифры) и проверяется контрольной суммой.
    Дубликат ИНН → 409 с безопасным ответом (без раскрытия чужой карточки).
    """
    try:
        inn = validate_inn(payload.inn)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if payload.ogrn is not None and not is_valid_ogrn(payload.ogrn):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "ОГРН должен содержать 13 цифр"
        )
    if await _inn_conflict(db, inn):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Организация с таким ИНН уже предложена или проверяется",
        )
    org = UserOrganization(
        name=payload.name,
        short_name=payload.short_name,
        inn=inn,
        ogrn=payload.ogrn,
        kpp=payload.kpp,
        org_type=payload.org_type,
        region=payload.region,
        description=payload.description,
        contacts=payload.contacts,
        state="draft",
        created_by=user.id,
    )
    db.add(org)
    try:
        await db.flush()
        db.add(
            OrganizationMember(
                user_id=user.id, organization_id=org.id, role_in_org="admin", is_primary=True
            )
        )
        await db.flush()
    except IntegrityError:
        # Гонка: параллельное создание карточки с тем же ИНН.
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Организация с таким ИНН уже предложена или проверяется",
        ) from None
    _audit(db, user.id, "org.created", org_id=org.id, inn=inn, name=org.name)
    await db.commit()
    return _card_out(org, member_role="admin", is_primary=True)


@router.post("/organizations/{org_id}/join", response_model=OrgCardPublicOut)
async def join_organization_card(org_id: int, db: DBSession, user: CurrentUser) -> OrgCardPublicOut:
    """Привязка пользователя к verified-организации.

    К непубличной карточке (draft/pending/rejected) привязка чужих закрыта:
    404 — существование карточки не раскрывается (IDOR).
    """
    org = await db.get(UserOrganization, org_id)
    if org is None or org.state != "verified":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")
    existing = await _get_membership(db, org.id, user.id)
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Вы уже состоите в этой организации")
    db.add(OrganizationMember(user_id=user.id, organization_id=org.id, role_in_org="member"))
    await db.flush()
    _audit(db, user.id, "org.joined", org_id=org.id)
    await db.commit()
    return _card_out(org, member_role="member", is_primary=False)


@router.post("/organizations/{org_id}/submit", response_model=OrgCardPublicOut)
async def submit_organization_card(
    org_id: int, db: DBSession, user: VerifiedUser
) -> OrgCardPublicOut:
    """Отправка карточки на проверку менеджеру Центра (draft/rejected → pending)."""
    org = await db.get(UserOrganization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")
    membership = await _require_admin_membership(db, org, user.id)
    if org.state not in EDITABLE_STATES:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Нельзя отправить организацию в состоянии «{org.state}»"
        )
    if not org.inn:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Укажите ИНН организации перед отправкой на проверку",
        )
    org.state = "pending"
    org.review_comment = None
    await db.flush()
    _audit(db, user.id, "org.submitted", org_id=org.id)
    await db.commit()
    return _card_out(org, member_role=membership.role_in_org, is_primary=membership.is_primary)


@router.get("/organizations/{org_id}", response_model=OrgCardPublicOut)
async def get_organization_card(
    org_id: int, db: DBSession, user: CurrentUserOptional
) -> OrgCardPublicOut:
    """Просмотр карточки организации.

    Публичные поля доступны всем (включая анонимов) только для verified.
    Внутренние поля (review_comment, verification_decision, reviewed_by/at,
    created_by) — только сотрудники Центра. Участники видят свою связь
    (member_role/is_primary). Чужая непубличная карточка — 404 (IDOR).
    """
    org = await db.get(UserOrganization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")
    staff = user is not None and is_cntr_staff(user)
    membership = (
        await _get_membership(db, org.id, user.id) if user is not None else None
    )
    if staff:
        return _card_out(org, staff=True)
    if org.state == "verified":
        return _card_out(
            org,
            member_role=membership.role_in_org if membership else None,
            is_primary=membership.is_primary if membership else False,
        )
    if membership is not None:
        # Участник видит карточку своей (непубличной) организации.
        return _card_out(
            org,
            member_role=membership.role_in_org,
            is_primary=membership.is_primary,
        )
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")


@router.post("/manager/orgs/{org_id}/verify", response_model=OrgCardPublicOut)
async def verify_organization_card(
    org_id: int, payload: OrgVerifyIn, db: DBSession, manager: ManagerWithMFA
) -> OrgCardPublicOut:
    """Ручная верификация карточки организации менеджером Центра.

    Только cntr_manager/cntr_admin (с MFA в проде). Решение verified|rejected
    сохраняется вместе с decision/by/at и внутренним комментарием; аудит
    org.verified / org.rejected. Запрет self-verified: менеджер, состоящий в
    организации (или её создатель), не может верифицировать её сам — 403.
    """
    org = await db.get(UserOrganization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")
    if org.state != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Верифицировать можно только карточку в статусе pending (сейчас «{org.state}»)",
        )
    membership = await _get_membership(db, org.id, manager.id)
    if membership is not None or org.created_by == manager.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Нельзя верифицировать организацию, участником или создателем которой вы являетесь",
        )
    decision = payload.decision
    org.state = decision
    org.verification_decision = decision
    if payload.internal_comment is not None:
        org.review_comment = payload.internal_comment
    org.reviewed_by = manager.id
    org.reviewed_at = datetime.now(UTC)
    await db.flush()
    _audit(
        db,
        manager.id,
        "org.verified" if decision == "verified" else "org.rejected",
        org_id=org.id,
        decision=decision,
        comment=payload.internal_comment,
    )
    await db.commit()
    return _card_out(org, staff=True)
