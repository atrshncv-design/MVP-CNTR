"""Личные профили и пользовательские организации (тикет 03 Friday RC).

Профиль независим от проектных ролей: основная роль аккаунта определяет
профильный реестр, но не проектные полномочия. Профиль/организация
публикуются только в состоянии verified (проверка менеджером центра).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.deps import CurrentUser, DBSession, VerifiedUser, require_verified_role
from app.core.validators import is_valid_ogrn, validate_inn
from app.db.models import (
    AuditTrailEntry,
    OrganizationMember,
    User,
    UserOrganization,
    UserProfile,
)
from app.schemas import ManagerDecideIn, OrgIn, OrgOut, OrgQueueOut, ProfileIn, ProfileOut

Manager = Annotated[User, Depends(require_verified_role("cntr_manager", "cntr_admin"))]

router = APIRouter(tags=["profiles"])

EDITABLE_STATES = ("draft", "rejected")
SUBMITTABLE_STATES = ("draft", "rejected")


def _audit(db: DBSession, user_id: int, action: str, **details) -> None:
    db.add(
        AuditTrailEntry(
            project_id=None,
            user_id=user_id,
            action=action,
            details={"org_id": details.pop("org_id", None), **details},
        )
    )


def _profile_out(p: UserProfile) -> ProfileOut:
    return ProfileOut(
        id=p.id,
        user_id=p.user_id,
        headline=p.headline,
        bio=p.bio,
        region=p.region,
        skills=p.skills or [],
        state=p.state,
        review_comment=p.review_comment,
        reviewed_at=p.reviewed_at.isoformat() if p.reviewed_at else None,
    )


def _org_out(
    o: UserOrganization, member_role: str | None = None, is_primary: bool = False
) -> OrgOut:
    return OrgOut(
        id=o.id,
        name=o.name,
        short_name=o.short_name,
        ogrn=o.ogrn,
        org_type=o.org_type,
        region=o.region,
        description=o.description,
        state=o.state,
        review_comment=o.review_comment,
        created_by=o.created_by,
        member_role=member_role,
        is_primary=is_primary,
    )


async def _get_own_profile(db: DBSession, user: User) -> UserProfile:
    profile = (
        await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    ).scalar_one_or_none()
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
    return profile


async def _memberships(
    db: DBSession, user_id: int
) -> list[tuple[OrganizationMember, UserOrganization]]:
    rows = (
        await db.execute(
            select(OrganizationMember, UserOrganization)
            .join(UserOrganization, OrganizationMember.organization_id == UserOrganization.id)
            .where(OrganizationMember.user_id == user_id)
        )
    ).all()
    return [(row[0], row[1]) for row in rows]


@router.get("/profile", response_model=dict)
async def my_profile(db: DBSession, user: CurrentUser) -> dict:
    """Свой профиль + список своих организаций (профиль создаётся при первом обращении)."""
    profile = await _get_own_profile(db, user)
    orgs = [
        _org_out(org, member.role_in_org, member.is_primary)
        for member, org in await _memberships(db, user.id)
    ]
    return {"profile": _profile_out(profile), "organizations": orgs}


@router.patch("/profile", response_model=ProfileOut)
async def update_my_profile(payload: ProfileIn, db: DBSession, user: CurrentUser) -> ProfileOut:
    profile = await _get_own_profile(db, user)
    if profile.state not in EDITABLE_STATES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Профиль в состоянии «{profile.state}» нельзя редактировать. "
            "Дождитесь решения или верните его в черновик.",
        )
    profile.headline = payload.headline
    profile.bio = payload.bio
    profile.region = payload.region
    profile.skills = payload.skills
    await db.flush()
    await db.commit()
    return _profile_out(profile)


@router.post("/profile/submit", response_model=ProfileOut)
async def submit_my_profile(db: DBSession, user: CurrentUser) -> ProfileOut:
    profile = await _get_own_profile(db, user)
    if profile.state not in SUBMITTABLE_STATES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Нельзя отправить профиль в состоянии «{profile.state}».",
        )
    if not profile.headline:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Укажите должность (headline)")
    profile.state = "pending"
    profile.review_comment = None
    await db.flush()
    await db.commit()
    return _profile_out(profile)


@router.get("/orgs/mine", response_model=list[OrgOut])
async def my_organizations(db: DBSession, user: CurrentUser) -> list[OrgOut]:
    return [
        _org_out(org, member.role_in_org, member.is_primary)
        for member, org in await _memberships(db, user.id)
    ]


@router.post("/orgs", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
async def create_organization(payload: OrgIn, db: DBSession, user: CurrentUser) -> OrgOut:
    inn: str | None = None
    if payload.inn is not None:
        try:
            inn = validate_inn(payload.inn)
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if payload.ogrn is not None and not is_valid_ogrn(payload.ogrn):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "ОГРН должен содержать 13 цифр"
        )
    if inn is not None and await _inn_conflict(db, inn):
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
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Организация с таким ИНН уже предложена или проверяется",
        ) from None
    _audit(db, user.id, "org.created", org_id=org.id, inn=inn)
    await db.commit()
    return _org_out(org, "admin", True)


async def _inn_conflict(db: DBSession, inn: str, exclude_id: int | None = None) -> bool:
    stmt = select(UserOrganization.id).where(UserOrganization.inn == inn)
    if exclude_id is not None:
        stmt = stmt.where(UserOrganization.id != exclude_id)
    return (await db.execute(stmt)).first() is not None


async def _get_membership(db: DBSession, org_id: int, user_id: int) -> OrganizationMember | None:
    return (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()


@router.post("/orgs/{org_id}/join", response_model=OrgOut)
async def join_organization(org_id: int, db: DBSession, user: CurrentUser) -> OrgOut:
    org = await db.get(UserOrganization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")
    existing = await _get_membership(db, org_id, user.id)
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Вы уже состоите в этой организации")
    db.add(OrganizationMember(user_id=user.id, organization_id=org.id, role_in_org="member"))
    await db.flush()
    _audit(db, user.id, "org.joined", org_id=org.id)
    await db.commit()
    return _org_out(org, "member", False)


@router.patch("/orgs/{org_id}", response_model=OrgOut)
async def update_organization(
    org_id: int, payload: OrgIn, db: DBSession, user: VerifiedUser
) -> OrgOut:
    org = await db.get(UserOrganization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")
    membership = await _get_membership(db, org_id, user.id)
    if membership is None or membership.role_in_org != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Редактировать может только администратор организации"
        )
    if org.state not in EDITABLE_STATES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Организация в состоянии «{org.state}» — редактирование закрыто",
        )
    if payload.inn is not None:
        try:
            normalized_inn = validate_inn(payload.inn)
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
        if await _inn_conflict(db, normalized_inn, exclude_id=org.id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Организация с таким ИНН уже предложена или проверяется",
            )
        org.inn = normalized_inn
    if payload.ogrn is not None and not is_valid_ogrn(payload.ogrn):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "ОГРН должен содержать 13 цифр"
        )
    org.name = payload.name
    org.short_name = payload.short_name
    if payload.ogrn is not None:
        org.ogrn = payload.ogrn
    if payload.kpp is not None:
        org.kpp = payload.kpp
    org.org_type = payload.org_type
    org.region = payload.region
    org.description = payload.description
    if payload.contacts:
        org.contacts = payload.contacts
    await db.flush()
    _audit(db, user.id, "org.updated", org_id=org.id)
    await db.commit()
    return _org_out(org, membership.role_in_org, membership.is_primary)


@router.post("/orgs/{org_id}/submit", response_model=OrgOut)
async def submit_organization(org_id: int, db: DBSession, user: VerifiedUser) -> OrgOut:
    org = await db.get(UserOrganization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")
    membership = await _get_membership(db, org_id, user.id)
    if membership is None or membership.role_in_org != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Отправить на проверку может администратор организации"
        )
    if org.state not in SUBMITTABLE_STATES:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Нельзя отправить организацию в состоянии «{org.state}»"
        )
    org.state = "pending"
    org.review_comment = None
    await db.flush()
    _audit(db, user.id, "org.submitted", org_id=org.id)
    await db.commit()
    return _org_out(org, membership.role_in_org, membership.is_primary)


# ── Менеджерская проверка ────────────────────────────────────────────────────


async def _apply_decision(
    obj: UserProfile | UserOrganization, payload: ManagerDecideIn, manager: User
) -> None:
    if obj.state != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Объект не в статусе pending (сейчас «{obj.state}»)",
        )
    obj.state = "verified" if payload.action == "verify" else "rejected"
    obj.review_comment = payload.comment
    obj.reviewed_by = manager.id
    obj.reviewed_at = datetime.now(UTC)


@router.get("/manager/profiles", response_model=list[dict])
async def manager_profile_queue(
    db: DBSession,
    manager: Manager,
    state: str = Query("pending", pattern="^(pending|verified|rejected|draft)$"),
) -> list[dict]:
    from app.db.models import Role, user_roles_tbl

    role_subq = (
        select(user_roles_tbl.c.user_id, Role.slug)
        .join(Role, user_roles_tbl.c.role_id == Role.id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(UserProfile, User, role_subq.c.slug)
            .join(User, UserProfile.user_id == User.id)
            .outerjoin(role_subq, role_subq.c.user_id == User.id)
            .where(UserProfile.state == state)
            .order_by(UserProfile.updated_at.desc())
        )
    ).all()
    out: dict[int, dict] = {}
    for profile, user, slug in rows:
        item = out.setdefault(
            profile.id,
            {
                **dict(_profile_out(profile)),
                "full_name": user.full_name,
                "email": user.email,
                "role_slugs": [],
            },
        )
        if slug:
            item["role_slugs"].append(slug)
    return list(out.values())


@router.post("/manager/profiles/{profile_id}/decide", response_model=ProfileOut)
async def manager_decide_profile(
    profile_id: int, payload: ManagerDecideIn, db: DBSession, manager: Manager
) -> ProfileOut:
    profile = await db.get(UserProfile, profile_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Профиль не найден")
    await _apply_decision(profile, payload, manager)
    await db.flush()
    await db.commit()
    return _profile_out(profile)


@router.get("/manager/orgs", response_model=list[OrgQueueOut])
async def manager_org_queue(
    db: DBSession,
    manager: Manager,
    state: str = Query("pending", pattern="^(pending|verified|rejected|draft)$"),
) -> list[OrgQueueOut]:
    rows = (
        await db.execute(
            select(UserOrganization, User)
            .join(User, UserOrganization.created_by == User.id)
            .where(UserOrganization.state == state)
            .order_by(UserOrganization.updated_at.desc())
        )
    ).all()
    return [
        OrgQueueOut(**dict(_org_out(org)), creator_name=creator.full_name)
        for org, creator in rows
    ]


@router.post("/manager/orgs/{org_id}/decide", response_model=OrgOut)
async def manager_decide_org(
    org_id: int, payload: ManagerDecideIn, db: DBSession, manager: Manager
) -> OrgOut:
    org = await db.get(UserOrganization, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Организация не найдена")
    await _apply_decision(org, payload, manager)
    await db.flush()
    _audit(
        db,
        manager.id,
        "org.verified" if org.state == "verified" else "org.rejected",
        org_id=org.id,
        decision=org.state,
        comment=payload.comment,
    )
    await db.commit()
    return _org_out(org)
