from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select, true

from app.core.deps import CurrentUserOptional, ReadDBSession
from app.db.models import NioktrCard, Organization
from app.schemas import NioktrCardOut, OrganizationDetailOut, OrgCardOut

router = APIRouter(prefix="/nioktr", tags=["nioktr"])


def _card_out(card: NioktrCard) -> NioktrCardOut:
    return NioktrCardOut(
        id=card.id,
        registration_number=card.registration_number,
        name=card.name,
        annotation=card.annotation,
        keywords=card.keywords or [],
        nioktr_types=card.nioktr_types or [],
        state_program=card.state_program,
        federal_program=card.federal_program,
        created_date=card.created_date,
        start_date=card.start_date,
        end_date=card.end_date,
        is_ai_area=card.is_ai_area,
        is_ai_usage=card.is_ai_usage,
        executor_name=card.executor_name,
        executor_short_name=card.executor_short_name,
        executor_ogrn=card.executor_ogrn,
        executor_territory=card.executor_territory,
        customer_name=card.customer_name,
        budgets=card.budgets or [],
        organization_id=card.organization_id,
        created_at=card.created_at.isoformat() if card.created_at else None,
        source=card.source,
        imported_at=card.imported_at.isoformat() if card.imported_at else None,
    )


@router.get("", response_model=list[NioktrCardOut])
async def list_nioktr_cards(
    db: ReadDBSession,
    user: CurrentUserOptional,
    search: str | None = Query(None),
    ai: bool | None = Query(None),
    type: str | None = Query(None),
    customer: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[NioktrCardOut]:
    stmt = select(NioktrCard).order_by(
        NioktrCard.created_date.desc().nullslast(), NioktrCard.id.desc()
    )
    if search:
        stmt = stmt.where(NioktrCard.name.ilike(f"%{search}%"))
    if ai is not None:
        stmt = stmt.where(NioktrCard.is_ai_area == ai)
    if type:
        stmt = stmt.where(NioktrCard.nioktr_types.contains([type]))
    if customer:
        stmt = stmt.where(NioktrCard.customer_name.ilike(f"%{customer}%"))
    stmt = stmt.limit(limit).offset(offset)
    rows = await db.execute(stmt)
    return [_card_out(card) for card in rows.scalars()]


@router.get("/organizations", response_model=list[OrgCardOut])
async def list_organizations(
    db: ReadDBSession,
    user: CurrentUserOptional,
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[OrgCardOut]:
    # P-06: LATERAL вместо коррелированного scalar_subquery O(N) —
    # один проход по индексу ix_nioktr_cards_organization_id.
    card_count_lateral = (
        select(func.count(NioktrCard.id).label("cnt"))
        .where(NioktrCard.organization_id == Organization.id)
        .correlate(Organization)
        .lateral("card_count")
    )
    stmt = (
        select(Organization, card_count_lateral.c.cnt.label("nioktr_count"))
        .select_from(Organization)
        .outerjoin(card_count_lateral, true())
        .where(or_(Organization.projects_count > 0, card_count_lateral.c.cnt > 0))
        .order_by(card_count_lateral.c.cnt.desc())
    )
    if search:
        stmt = stmt.where(Organization.name.ilike(f"%{search}%"))
    stmt = stmt.limit(limit).offset(offset)
    rows = await db.execute(stmt)
    return [
        OrgCardOut(
            id=org.id,
            name=org.name,
            short_name=org.short_name,
            ogrn=org.ogrn,
            org_type=org.org_type,
            competencies=list(org.competencies or []),
            projects_count=count,
            region=org.region,
        )
        for org, count in rows
    ]


@router.get("/organizations/{ogrn}", response_model=OrganizationDetailOut)
async def get_organization(
    ogrn: str,
    db: ReadDBSession,
    user: CurrentUserOptional,
) -> OrganizationDetailOut:
    org = await db.scalar(select(Organization).where(Organization.ogrn == ogrn))
    if org is None:
        raise HTTPException(status_code=404, detail="Организация не найдена")
    # P-07: ограниченная выборка карточек организации — не более 20 (защита от unbounded payload).
    cards_stmt = (
        select(NioktrCard)
        .where(NioktrCard.organization_id == org.id)
        .order_by(NioktrCard.created_date.desc().nullslast(), NioktrCard.id.desc())
        .limit(20)
    )
    cards = (await db.execute(cards_stmt)).scalars().all()
    return OrganizationDetailOut(
        id=org.id,
        name=org.name,
        short_name=org.short_name,
        ogrn=org.ogrn,
        org_type=org.org_type,
        competencies=list(org.competencies or []),
        projects_count=len(cards),
        region=org.region,
        nioktr_cards=[_card_out(card) for card in cards],
    )


@router.get("/{registration_number}", response_model=NioktrCardOut)
async def get_nioktr_card(
    registration_number: str,
    db: ReadDBSession,
    user: CurrentUserOptional,
) -> NioktrCardOut:
    card = await db.scalar(
        select(NioktrCard).where(NioktrCard.registration_number == registration_number)
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Карточка НИОКТР не найдена")
    return _card_out(card)
