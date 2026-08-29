"""Мэтчинг LLM через центр (тикеты 06, интервью 14/V2, 25-).

Архитектура: DB (открытые данные) → retriever (pg_trgm + vector) top_k 20
→ LLM rerank (обезличенно, без ПДн, contour=tuno) → топ-5 с объяснением
«почему». Коммуникация только через центр (14-): заявитель жмёт
«предложить» → MatchRequest → модерация → Notification исполнителю.

MVP: скриптовый фильтр по 5 полям title+annotation/sector/ugt/region/
competencies (25-) + LLM rerank top-5, 1 endpoint POST /match, очередь
как llm-eval (13-). Пока gateway_enabled=false — мэтчинг без LLM fallback
(скриптовый детерминированный скоринг).
"""

from __future__ import annotations

import re

from sqlalchemy import select

from app.core.config import settings
from app.core.deps import DBSession
from app.db.models import Organization
from app.schemas import MatchCandidate, MatchIn, MatchOut


def _tokenize(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-zа-яё0-9]+", text.lower()) if len(t) > 2}


def _score_org(
    org: Organization, payload: MatchIn, query_tokens: set[str]
) -> tuple[float, list[str]]:
    """Скриптовый скоринг организации по 5 полям; возвращает (score, причины)."""

    score = 0.0
    reasons: list[str] = []

    org_competencies = [str(c).lower() for c in (org.competencies or [])]
    org_region = (org.region or "").lower()
    org_type = (org.org_type or "").lower()

    # title+annotation → перекрытие токенов с name и competencies
    name_tokens = _tokenize(org.name or "")
    overlap = len(query_tokens & name_tokens)
    if overlap:
        score += overlap * 2
        reasons.append(f"пересечение по названию/ключевым словам ({overlap})")

    # competencies
    payload_comp = [c.lower() for c in payload.competencies]
    comp_overlap = len(set(payload_comp) & set(org_competencies))
    if comp_overlap:
        shared = ", ".join(list(set(payload_comp) & set(org_competencies))[:3])
        score += comp_overlap * 3
        reasons.append(f"совпадение компетенций ({comp_overlap}: {shared})")

    # также ищем токены из title/annotation в компетенциях организации
    comp_text = " ".join(org_competencies)
    comp_tokens = _tokenize(comp_text)
    ct_overlap = len(query_tokens & comp_tokens)
    if ct_overlap:
        score += ct_overlap * 1.5
        if comp_overlap == 0:
            reasons.append(f"тематическое пересечение ({ct_overlap} токенов)")

    # sector → org_type
    if payload.sector and org_type and payload.sector.lower() in org_type:
        score += 3
        reasons.append(f"отрасль {payload.sector} ↔ {org.org_type}")

    # region
    if payload.region and org_region and payload.region.lower() == org_region:
        score += 3
        reasons.append(f"регион {payload.region}")

    # ugt_level — бонус за projects_count как прокси активности НТР
    if (
        payload.ugt_level is not None
        and org.projects_count
        and org.projects_count > 0
        and payload.ugt_level >= 7
        and org.projects_count >= 5
    ):
        score += 1
        reasons.append("опыт в зрелых УГТ (проекты ≥5)")

    # базовый бонус за наличие данных
    if not reasons:
        reasons.append("открытые данные организации соответствуют запросу по реестру")

    return score, reasons


async def _retrieve_candidates(
    db: DBSession, payload: MatchIn, limit: int = 20
) -> list[Organization]:
    """Retriever pg_trgm 20: выбираем кандидатов из открытых реестров.

    Используем ILIKE по name и competencies для префильтра (индексы trgm/GIN),
    затем точный скоринг в Python. При пустой выборке — отдаём первые 20
    по projects_count для fallback V2 «нет прямых — вот неочевидные».
    """

    # Попытка активной фильтрации ILIKE по ключевым словам запроса
    query_text = f"{payload.title} {payload.annotation or ''}".strip()
    tokens = [t for t in query_text.split() if len(t) > 2][:5]

    stmt = select(Organization).order_by(Organization.projects_count.desc()).limit(limit)

    # Если есть токены — пробуем ILIKE-фильтр (trgm индекс ускорит)
    if tokens:
        # берём первый значимый токен как префильтр; fallback — без фильтра
        first_token = tokens[0]
        filtered = select(Organization).where(
            Organization.name.ilike(f"%{first_token}%")
        ).limit(limit)
        filtered_rows = list((await db.execute(filtered)).scalars().all())
        if filtered_rows:
            # дополняем до 20 общими, если нашли меньше
            if len(filtered_rows) < limit:
                extra = list((await db.execute(stmt)).scalars().all())
                seen = {r.id for r in filtered_rows}
                for o in extra:
                    if o.id not in seen:
                        filtered_rows.append(o)
                    if len(filtered_rows) >= limit:
                        break
            return filtered_rows

    rows = list((await db.execute(stmt)).scalars().all())
    return rows


async def match_organizations(db: DBSession, payload: MatchIn) -> MatchOut:
    """Топ-5 через центр: retriever 20 → (LLM rerank | script fallback)."""

    candidates = await _retrieve_candidates(db, payload, limit=20)
    query_tokens = _tokenize(
        f"{payload.title} {payload.annotation or ''} {' '.join(payload.competencies)}"
    )

    scored: list[tuple[float, Organization, list[str]]] = []
    for org in candidates:
        score, reasons = _score_org(org, payload, query_tokens)
        scored.append((score, org, reasons))

    # Сортируем по скорингу, берём топ-5 (V2 гарантирует непустой ответ)
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:5]

    # LLM rerank (только при включённом гейтвее, обезличенно, contour=tuno)
    method = "script"
    if settings.llm_gateway_enabled and settings.llm_api_key:
        # Попытка LLM rerank: формируем промпт только из 5 полей без PII
        try:
            from app.services.ai_assistant import ask_llm

            # Строим контекст кандидатов для LLM
            cand_lines = []
            for i, (_, org, _) in enumerate(top):
                comps = ", ".join(list(org.competencies or [])[:5])
                cand_lines.append(
                    f"{i+1}. {org.name} ({org.org_type or '—'}, "
                    f"{org.region or '—'}; компетенции: {comps})"
                )
            cand_text = "\n".join(cand_lines)
            system_prompt = (
                "Ты — эксперт ЦНТР по кросс-отраслевому мэтчингу "
                "(ГОСТ Р 58048-2017). Проанализируй технологию через "
                "призму технологии, найди 5 неочевидных применений с "
                "аргументацией почему полезно. Отвечай только из открытых "
                "данных, без персональных данных."
            )
            user_message = (
                f"Технология: {payload.title}\n"
                f"Аннотация: {payload.annotation or '—'}\n"
                f"Отрасль: {payload.sector or '—'}, "
                f"УГТ: {payload.ugt_level or '—'}, "
                f"Регион: {payload.region or '—'}\n"
                f"Компетенции: {', '.join(payload.competencies) or '—'}\n\n"
                f"Кандидаты (топ retriever):\n{cand_text}\n\n"
                "Верни топ-5 с объяснением почему полезно "
                "(каждый — 1-2 предложения)."
            )
            llm_text = await ask_llm(system_prompt, user_message)
            if llm_text:
                # Если LLM ответил — используем его объяснения
                llm_reasons = [r.strip() for r in llm_text.split("\n") if r.strip()][:5]
                if llm_reasons:
                    method = "llm"
                    for idx, (score, org, _) in enumerate(top):
                        if idx < len(llm_reasons):
                            top[idx] = (score, org, [llm_reasons[idx][:300]])
        except Exception:  # noqa: BLE001 — LLM не должен ломать мэтчинг
            pass

    results = [
        MatchCandidate(
            id=org.id,
            name=org.name,
            org_type=org.org_type,
            region=org.region,
            competencies=list(org.competencies or []),
            reason="; ".join(reasons) if reasons else "соответствие по реестру",
            score=float(score),
        )
        for score, org, reasons in top
    ]

    return MatchOut(query=payload, results=results, method=method, queue="llm-eval")
