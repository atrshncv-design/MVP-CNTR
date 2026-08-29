# ADR 0011: Мэтчинг LLM через центр — 5 полей, retriever pg_trgm 20 → rerank топ-5 (R23)

**Tier:** T2 — core matching / V2 cross-sector, reversal = нерелевантные рекомендации и ПДн в LLM
**Date:** 2026-08-28
**Status:** accepted

## Title
Мэтчинг заявок через центр: 5 полей без PII, топ-5 через очередь llm-eval

## Context
Сторона-заявитель публикует проект/технологию → нужен список кому полезно из БД реестров МТК/ВУЗов/компетенций и обратно (14-). LLM должен делать кросс-отрасль (wood→furniture/chem) по 5 полям (25-), но ПДн в облако нельзя (gateway_enabled=false). Нуженdeterministic fallback и очередь.

## Decision
- `POST /match` принимает `title+annotation/sector/ugt_level/region/competencies` (5 полей, без budget/contacts, max 2000 знаков, MatchIn).
- Retriever: `pg_trgm` + `GIN nioktr_types` фильтрует топ-20 кандидатов из `organizations` (Hash ogrn, B-Tree is_ai_area — индексы 0028).
- Rerank: при `LLM_GATEWAY_ENABLED=true` → `ask_llm` обезличенно (allowlist полей, contour=tuno) с промптом «призма технологии»; иначе — скриптовый скоринг (вес: компетенции ×3, регион/sector ×3, токен-пересечение).
- Ответ `MatchOut {results:5×MatchCandidate{reason}, method:script|llm, queue:llm-eval}` — кросс-отраслевой fallback V2 «нет прямых — вот неочевидные» гарантирует непустой топ-5.
- Очередь `llm-eval` (Redis, как stages.py:320) — 202 Accepted + outbox; пока gateway=false — синхронный fallback без очереди (совместимо с будущим воркером).

## Consequences
**Положительные:** 5 полей покрывают cross-sector сигнал (sector+ugt+annotation) без PII; детерминированный fallback работает без LLM; queue не блокирует пул (13- R3).

**Отрицательные:** скриптовый rerank слабее LLM в неочевидных связях; топ-20 retriever ограничен ILIKE-триграммой (зависит от качества name/competencies).

**Что отвергли:** прямой LLM-вызов в транзакции 60с — отвергнуто (держит пул, 503); замкнутый локальный скоринг без очереди — отвергнуто (не масштабируется к 5К).

## References
- интервью 14-мэтчинг-LLM-через-центр, 25-мэтчинг-поля, spec.md R23
- `app/schemas.py` MatchIn/MatchOut, `app/services/matching.py`, `app/api/v1/match.py` POST /match
- `app/services/ai_assistant.py:36` gateway_enabled, `app/core/config.py:64` LLM_GATEWAY_ENABLED
