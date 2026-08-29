# ADR 0010: RAG-контур Туно/Каба — row-level изоляция tuno/kaba (R22)

**Tier:** T2 — безопасность контура / data isolation, reversal = утечка реестров в ГОСТ-контекст
**Date:** 2026-08-28
**Status:** accepted

## Title
Изоляция RAG-хранилища по контуру contour CHECK(tuno,kaba) с частичными ivfflat-индексами

## Context
RAG хранил один vector(1536) и один ivfflat-индекс на все документы — реестры НИОКТР (Туно) и методология ГОСТ (Каба) смешивались в одном KNN-поиске. LLM получал нерелевантный контекст, а при gateway_enabled=false существовал риск кросс-контурного смешения. Требуется физическая изоляция на уровне БД и API.

## Decision
- Таблица `rag_documents` получает столбец `contour VARCHAR(16) NOT NULL DEFAULT 'tuno' CHECK(tuno,kaba)` (миграция 0029, backfill старых строк → 'tuno').
- Два частичных индекса `USING ivfflat (embedding vector_cosine_ops) WHERE contour='tuno'/'kaba'` (lists=100) — планировщик выбирает нужный по WHERE.
- `RagSearchIn.contour` → SQL `AND (CAST(:contour AS text) IS NULL OR contour = ...)` (app/services/rag.py:26).
- `POST /chat/tuno|kaba` изолируют RAG-контекст по контуру; `POST /rag/templates` принимает `contour` (default tuno, интерфейс 0029).

## Consequences
**Положительные:** поиск KNN идёт по релевантному частичному индексу (быстрее, без кросс-загрязнения); LLM-промпт получает только свой контур; обратная совместимость (default tuno) не ломает старые документы.

**Отрицательные:** два индекса вместо одного — +память/время обслуживания; `DEFAULT tuno` требует договорённости для ingest Каба (явный `contour=kaba`).

**Что отвергли:** один индекс без WHERE — отвергнуто (кросс-контурная утечка); отдельные таблицы tuno/kaba — отвергнуто (дубль схемы, сложнее миграции).

## References
- интервью 04-реестры-и-Туно-Каба, 13-очереди, spec.md R22, тикет 06
- `app/db/models.py` RagDocument.contour, `alembic/versions/0029_rag_contour.py`, `db/migrations/sql/0029_rag_contour.sql`
- `app/services/rag.py:26`, `app/schemas.py:311` RagSearchIn.contour, `app/api/v1/rag.py`, `app/api/v1/chat.py` /tuno|kaba
