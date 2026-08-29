from __future__ import annotations

import asyncio
import contextlib
import time
from collections import OrderedDict
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import func, or_, select, true

from app.core.config import settings
from app.core.deps import CurrentUserOptional, ReadDBSession
from app.db.models import NioktrCard, Organization
from app.schemas import NioktrCardOut, OrganizationDetailOut, OrgCardOut

router = APIRouter(prefix="/nioktr", tags=["nioktr"])

# ── N-18: rate limit публичных реестров — Redis fixed window + LRU fallback ──
# Дорогие ILIKE '%…%' защищаем на двух уровнях: nginx limit_req (registry zone
# 100r/s burst 100) + прикладной Redis. Аноним — строже (120/60s), аутентифицированный
# — мягче (10000/60s ≈166r/s) чтобы пилотный loadtest 714 RPS с одного IP
# (все VU аутентифицированы) не падал, но бот-секвенс с ротацией IP резался.
REGISTRY_ANON_LIMIT = 120
REGISTRY_AUTH_LIMIT = 10000
REGISTRY_WINDOW_SECONDS = 60.0
REGISTRY_MAX_ENTRIES = 5000

_registry_attempts: OrderedDict[str, list[float]] = OrderedDict()
_registry_redis_client: Any | None = None
_registry_redis_checked: bool = False


def _registry_get_redis() -> Any | None:
    """Ленивый Redis-клиент для registry limit; None если REDIS_URL пуст/недоступен."""
    global _registry_redis_client, _registry_redis_checked
    url = settings.redis_url
    if not url:
        return None
    try:
        import redis

        if _registry_redis_client is None:
            _registry_redis_client = redis.Redis.from_url(
                url, socket_connect_timeout=1, socket_timeout=1, decode_responses=False
            )
        _registry_redis_client.ping()
        _registry_redis_checked = True
        return _registry_redis_client
    except Exception:  # noqa: BLE001 — fallback на LRU
        _registry_redis_checked = True
        _registry_redis_client = None
        return None


def _registry_source(request: Request) -> str:
    """Источник для лимита: X-Real-IP → последний hop XFF → client.host."""
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        last_hop = [h.strip() for h in forwarded.split(",") if h.strip()]
        if last_hop:
            return last_hop[-1]
    return request.client.host if request.client else "unknown"


async def _enforce_registry_limit(request: Request) -> None:
    """Проверка лимита; при превышении — 429. Redis fixed window, fallback LRU.

    Redis-часть async via to_thread — sync redis не блокирует event loop (H-02a, SPEC-02).
    """
    # Аутентифицированный запрос (loadtest) — лимит выше
    is_authed = bool(request.headers.get("authorization"))
    limit = REGISTRY_AUTH_LIMIT if is_authed else REGISTRY_ANON_LIMIT
    ip = _registry_source(request)
    kind = "auth" if is_authed else "anon"
    rkey = f"registry:{kind}:{ip}"
    # Redis fixed window INCR EXPIRE 60 — async via to_thread (H-02a)
    try:
        client = await asyncio.to_thread(_registry_get_redis)
        if client is not None:
            count = int(await asyncio.to_thread(client.incr, rkey))
            if count == 1:
                await asyncio.to_thread(client.expire, rkey, int(REGISTRY_WINDOW_SECONDS))
            else:
                try:
                    ttl = await asyncio.to_thread(client.ttl, rkey)
                    if ttl == -1:
                        await asyncio.to_thread(client.expire, rkey, int(REGISTRY_WINDOW_SECONDS))
                except Exception:  # noqa: BLE001
                    pass
            if count > limit:
                raise HTTPException(
                    status_code=429, detail="Слишком много запросов к реестру, попробуйте позже"
                )
            return
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001 — fallback
        pass
    # Fallback LRU/TTL in-memory 5k/60s
    now = time.monotonic()
    stamps = _registry_attempts.get(rkey)
    if stamps is None:
        stamps = []
        _registry_attempts[rkey] = stamps
    else:
        while stamps and now - stamps[0] > REGISTRY_WINDOW_SECONDS:
            stamps.pop(0)
        with contextlib.suppress(KeyError):
            _registry_attempts.move_to_end(rkey)
    if len(stamps) >= limit:
        raise HTTPException(
            status_code=429, detail="Слишком много запросов к реестру, попробуйте позже"
        )
    stamps.append(now)
    while len(_registry_attempts) > REGISTRY_MAX_ENTRIES:
        _registry_attempts.popitem(last=False)


def _card_out(card: NioktrCard) -> NioktrCardOut:
    # P-14: created_date теперь DATE — сериализуем в ISO-строку для контракта фронта
    created_date_val: str | None
    if card.created_date is None:
        created_date_val = None
    elif hasattr(card.created_date, "isoformat"):
        created_date_val = card.created_date.isoformat()
    else:
        created_date_val = str(card.created_date)
    return NioktrCardOut(
        id=card.id,
        registration_number=card.registration_number,
        name=card.name,
        annotation=card.annotation,
        keywords=card.keywords or [],
        nioktr_types=card.nioktr_types or [],
        state_program=card.state_program,
        federal_program=card.federal_program,
        created_date=created_date_val,
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
    request: Request,
    db: ReadDBSession,
    user: CurrentUserOptional,
    search: str | None = Query(None),
    ai: bool | None = Query(None),
    type: str | None = Query(None),
    customer: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[NioktrCardOut]:
    await _enforce_registry_limit(request)
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
    request: Request,
    db: ReadDBSession,
    user: CurrentUserOptional,
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[OrgCardOut]:
    await _enforce_registry_limit(request)
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
    request: Request,
    db: ReadDBSession,
    user: CurrentUserOptional,
) -> OrganizationDetailOut:
    await _enforce_registry_limit(request)
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
    # P-07 fix: COUNT, не len(cards) (truncate при LIMIT 20).
    total = await db.scalar(
        select(func.count(NioktrCard.id)).where(NioktrCard.organization_id == org.id)
    )
    return OrganizationDetailOut(
        id=org.id,
        name=org.name,
        short_name=org.short_name,
        ogrn=org.ogrn,
        org_type=org.org_type,
        competencies=list(org.competencies or []),
        projects_count=int(total or 0),
        region=org.region,
        nioktr_cards=[_card_out(card) for card in cards],
    )


@router.get("/{registration_number}", response_model=NioktrCardOut)
async def get_nioktr_card(
    registration_number: str,
    request: Request,
    db: ReadDBSession,
    user: CurrentUserOptional,
) -> NioktrCardOut:
    await _enforce_registry_limit(request)
    card = await db.scalar(
        select(NioktrCard).where(NioktrCard.registration_number == registration_number)
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Карточка НИОКТР не найдена")
    return _card_out(card)
