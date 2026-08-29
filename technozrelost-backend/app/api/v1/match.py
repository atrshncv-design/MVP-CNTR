"""POST /match — мэтчинг LLM через центр (тикеты 06, интервью 14/V2, 25-)."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import CurrentUser, DBSession
from app.schemas import MatchIn, MatchOut
from app.services.matching import match_organizations

router = APIRouter(prefix="/match", tags=["match"])


@router.post("", response_model=MatchOut)
async def match(
    payload: MatchIn,
    db: DBSession,
    user: CurrentUser,
) -> MatchOut:
    """Топ-5 кандидатов через центр (retriever pg_trgm 20 → LLM rerank 5).

    5 полей без PII (25-): title+annotation/sector/ugt/region/competencies.
    Очередь llm-eval: при gateway_enabled=false — детерминированный скриптовый
    fallback с объяснением «почему» (интервью 14- V2). При gateway_enabled=true —
    LLM rerank обезличенно, contour=tuno.

    Доступ — любой аутентифицированный пользователь (реестры открытые, но
    рекомендация идёт только через центр, без прямых контактов).
    """

    return await match_organizations(db, payload)
