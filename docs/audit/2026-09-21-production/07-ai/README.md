# 07 — AI/RAG registry и eval (ticket 07)

Полный AI-реестр, static/security/RAG-оценка и безопасный live eval:
потрачено 0 из 200 запросов (только ГОСТ-публика/синтетика офлайн).
Safe authenticated entrypoint недоступен — live eval `UNKNOWN`, а не обход
auth. Код продукта, схема БД и production не менялись. Секреты — только
именами, значений нет. Оценки без production-доказательства помечены
static/local (Решение 7).

- `ai-registry.json` — реестр по точной схеме spec R19 (6 записей:
  AI-CHAT, AI-CHAT-TUNO, AI-CHAT-KABA, AI-RAG-SEARCH, AI-MATCH, AI-GEN).
- `ai.md` — полный AI checklist spec: покрыт static/runtime evidence или
  `UNKNOWN`; HTTP 200 не считается достаточным. Оценены grounding,
  citations, retrieval, fallback, timeouts, cost controls, observability,
  provider outage.
- `eval-local.json` — офлайн-eval (7 кейсов, 0 provider calls, cap 200).
- `findings.json` — findings по схеме spec R26 (5 записей: AI-01…AI-05,
  каждая с обязательными полями `effort` и `risk`).
- `check_ai.py` — in-zone gate (шов: JSON-schema артефактов + CLI gate).
- Базовые доказательства: EV-001…EV-008 (зона ticket 01); EV-013
  (production-каталог: `rag_documents` 677 строк); DB-контур EV-014
  (application-level изоляция, RLS нет) переиспользован, не продублирован.
  Новые факты этого тикета — EV-022…EV-024 ниже (файлы лежат в зоне тикета,
  слияние индекса — шаг оркестратора).

## Исполнение (R30/R31)

Тикет исполнен через адаптер autopilot-opencode моделью
`opencode-go/muse-spark-1.3-contributor`. Значения секретов и credentials не
читались и не сохранялись; в артефактах — только имена ключей.

Repair note (root cause): EV-022/023/024 used date-only stamps and conflated 32 checklist tokens with the 32-passed pytest run, omitting exact command/UTC/result.

## In-zone evidence (контракт: source, timestamp, target, command, exit, sanitized result)

Точность меток: исходный прогон записал только дату `2026-09-22` без времени —
exact UTC исходного сбора timestamp unavailable (время не было зафиксировано,
не выдумываем); ниже для каждого EV дана доказуемая граница из существующих
metadata (`stat` mtime, +0400 = UTC-4) плюс exact UTC повторной верификации
`2026-09-22T04:46:58Z`–`2026-09-22T04:47:05Z`.

- EV-022 — static AI inventory: исходная метка `2026-09-22` — timestamp
  unavailable (записана только дата, время не фиксировалось); доказуемая
  граница из metadata: `check_ai.py` mtime `2026-09-22T08:39:01+0400`
  (= `2026-09-22T04:39:01Z`); повторная верификация local
  `2026-09-22T04:47:05Z` (exit 0): `rg`/read по
  `app/services/{ai_assistant,ai_wiring,ai_metrics,rag,matching,
  document_generator}.py`, `app/api/v1/{chat,rag,match,generation}.py`,
  `app/core/{config,embeddings}.py`,
  `scripts/{rag_import,reindex_rag_embeddings}.py`,
  `alembic/versions/0029_rag_contour.py` и фронту
  (`features/matching/llm.ts`, `features/docs/AiDocConsultant.tsx`,
  `app/dashboard/ai-assistant/page.tsx`): полный разбор — в
  `ai.md` и `ai-registry.json`; values `.env`/credentials/private keys не
  читались (запрет interfaces).
- EV-023 — local offline eval + gates: исходная метка `2026-09-22` —
  timestamp unavailable (только дата); доказуемая граница: `eval-local.json`
  mtime `2026-09-22T08:40:35+0400` (= `2026-09-22T04:40:35Z`); повторная
  верификация local `2026-09-22T04:46:58Z` (exit 0):
  `python3 -c` embeddings-замер (lex/vec/combined, без зависимостей) и
  `uv run python -c` (parse_llm_ranking: полный ранкинг → `[0,1,2,3,4]`,
  проза → `None`, 2 строки из 5 → `None`), frozen в `eval-local.json`;
  `python3 check_ai.py` → OK (6 entries, 5 findings, 32 checklist tokens —
  это счётчик статических пунктов в `check_ai.py`, НЕ pytest; см. разбор
  ниже, cap 0/200); `python3 -c json.load` обоих JSON → OK.
  Provider calls: 0. Production-мутаций: 0 (reindex не запускался,
  манифест не писался).
- EV-024 — cap/denylist/tenant static proof: исходная метка `2026-09-22` —
  timestamp unavailable (только дата); доказуемая граница: `ai.md` mtime
  `2026-09-22T08:41:39+0400` (= `2026-09-22T04:41:39Z`); повторная
  верификация local `2026-09-22T04:46:58Z` (exit 0):
  `live_provider_requests=0/cap=200` в `eval-local.json`; denylist —
  `is_allowed_corpus_file` + `ensure_allowed_for_external`
  (`scripts/rag_import.py:33-36,134-137`) и `select_external_fragments`
  (`ai_wiring.py:104-116`); tenant — предикат `contour` (`rag.py:55-57`),
  CHECK + два частичных ivfflat (`0029_rag_contour.py`); PII-hygiene —
  `sanitize_question_for_external` + `stable_session_id`
  (`ai_wiring.py:66-75`, `ai_assistant.py:49-55`). ПДн и проектные секреты
  не использовались и не сохранялись.

## 32 checklist tokens vs 32 passed pytest (разведены явно)

- `32 checklist tokens` — статический счётчик `CHECKLIST_TOKENS` в
  `check_ai.py` (число пунктов AI-checklist spec, найденных в `ai.md`);
  это НЕ результат pytest.
- `32 passed` — фактический прогон shared non-DB acceptance set (те же
  6 файлов, что в T05/EV-018, без изменения/ослабления тестов; `--noconftest`
  обходит только session-фикстуру тестовой БД, сами тесты те же):
  точная команда `cd technozrelost-backend && uv run pytest --noconftest
  tests/test_html_sanitizer.py tests/test_prod_guard.py tests/test_config.py
  tests/test_ci_gates.py tests/test_upload_hardening.py
  tests/test_error_catalog.py -q`, exact UTC `2026-09-22T04:47:00Z`
  (старт) → `2026-09-22T04:47:01Z` (финиш), результат `32 passed` exit 0.
  AI-специфичные DB-тесты (`client`-фикстура: `test_ai_assistant`,
  `test_ai_relevance`, `test_ai_wiring`, `test_semantic_embeddings`,
  `test_chat_persona`, `test_chat_fallback_gateway`) без локальной test DB
  дают setup-ошибки и остаются environment BLOCKED (унаследовано от
  T01/T04/T05), продуктовых падений 0.

## Покрытие AI checklist spec (доказательно или UNKNOWN)

Полная таблица — в `ai.md` (32 пункта: provider call, key validity,
timeout/retry/circuit breaker/fallback, schema validation, prompt
injection, tool permissions, tenant isolation, data policy, logging,
hallucinations, citations, grounding, retrieval, chunking, embeddings,
metadata, staleness, prompt versions, reproducibility, eval sets,
human-in-loop, budget/rate/quota/cap/queue/cache/context limits, outage).
Каждый пункт покрыт static/offline-доказательством или честно `UNKNOWN`;
live-качество (синтез, rerank, цитаты, outage-хвосты) — `UNKNOWN` (R36).

## Production-сопоставление (static local vs deployed)

- Локальный HEAD `f364388` ≠ server HEAD `f06b15c` (EV-001/EV-002);
  deployed-выводы за пределами каталога EV-013 — UNKNOWN.
- Deployed-факт: `rag_documents` = 677 строк (EV-013); свежесть индекса —
  UNKNOWN. Имена LLM-ключей в прод-компоузе — set/empty (EV-007);
  resolved values и `LLM_GATEWAY_ENABLED` прод-факта — UNKNOWN (запрет).
- Авторизованный рантайм (все роли × оба контура × генерация) — UNKNOWN
  до test accounts (R36).

## UNKNOWN (честно недоступное)

1. Live-синтез/ранг/цитаты/отказы (0 calls по Решению 5).
2. Resolved values (`LLM_GATEWAY_ENABLED`, наличие ключа, модель в проде),
   provider data-retention политика.
3. Index freshness/staleness прод-корпуса.
4. Ролевой рантайм — R36.
5. Deployed-стойкость к prompt injection / реальный outage-хвост.

Mutations: ни одной. LLM-вызовов: 0 (лимит 200 не тронут).
ПДн/секретов/бизнес-строк/транскриптов в артефактах нет.
