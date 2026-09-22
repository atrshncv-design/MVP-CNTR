# 07 — AI/RAG registry и eval (ticket 07)

Static + local-offline AI-аудит локального checkout `f364388` (EV-001).
Код продукта, схема БД и production не менялись. Секреты — только именами,
значений нет. Живых вызовов провайдера — 0 из разрешённых 200 (cap не тронут);
авторизованный live eval — `UNKNOWN` до safe test accounts (R36, Решение 5:
вызовы без auth или safe prompt не выполняются). Оценки без
production-доказательства помечены static/local (Решение 7).

- `ai-registry.json` — реестр entrypoints/models/prompts/tools/data/RAG/
  output/guardrails/cost/observe/fallback по точной схеме spec R19
  (6 записей: AI-CHAT, AI-CHAT-TUNO, AI-CHAT-KABA, AI-RAG-SEARCH,
  AI-MATCH, AI-GEN). Тексты prompts/responses с риском данных не хранятся —
  только пути к константам и механика ограждений.
- `eval-local.json` — офлайн-eval (0 provider call): 4 retrieval-пробы на
  ГОСТ-публике/синтетике + 3 пробы парсера ранжирования; значения заморожены
  после однократного локального замера 2026-09-22.
- `findings.json` — findings по схеме spec R26 (AI-01…AI-05, с `effort`
  и `risk` как у sibling-зон 05/06).
- `check_ai.py` — in-zone gate (шов: JSON-schema артефактов + CLI gate):
  точная схема реестра, полнота AI-checklist, доказательство cap 0/200,
  ссылки на denylist/contour, отсутствие значений секретов.

## Исполнение (R30/R31)

Тикет исполнен через адаптер autopilot-opencode моделью
`opencode-go/muse-spark-1.3-contributor`. Значения секретов и credentials не
читались и не сохранялись; в артефактах — только имена ключей
(`LLM_API_KEY`, `OPENCODE_API_KEY`, `OPENCODE_ZEN_API_KEY`, `LLM_API_BASE`,
`LLM_MODEL`, `LLM_GATEWAY_ENABLED`, `RAG_CORPUS_DIR`).

## In-zone evidence

Точность меток: исходный прогон записал только дату `2026-09-22` без времени —
exact UTC исходного сбора timestamp unavailable (время не фиксировалось, не
выдумываем); ниже для каждого EV дана доказуемая граница из существующих
metadata (`stat` mtime, +0400 = UTC-4) плюс exact UTC повторной верификации
`2026-09-22T04:46:58Z`–`2026-09-22T04:47:05Z`.

Repair note (root cause): EV-022/023/024 used date-only stamps and conflated 32 checklist tokens with the 32-passed pytest run, omitting exact command/UTC/result.

- EV-022 — static AI inventory: исходная метка `2026-09-22` — timestamp
  unavailable (только дата); доказуемая граница: `check_ai.py` mtime
  `2026-09-22T08:39:01+0400` (= `2026-09-22T04:39:01Z`); повторная
  верификация local `2026-09-22T04:47:05Z` (exit 0): `rg`/read по
  `app/services/ai_assistant.py`, `ai_wiring.py`, `ai_metrics.py`, `rag.py`,
  `matching.py`, `document_generator.py`, `app/api/v1/{chat,rag,match,
  generation}.py`, `app/core/{config,embeddings}.py`,
  `scripts/{rag_import,reindex_rag_embeddings}.py`,
  `alembic/versions/0029_rag_contour.py`,
  `technozrelost-frontend/src/{features/matching/llm.ts,
  features/docs/AiDocConsultant.tsx,app/dashboard/ai-assistant/page.tsx}`
  (exit 0): полный разбор — ниже и в `ai-registry.json`; values `.env`/
  credentials не читались (запрет interfaces).
- EV-023 — local offline eval + gates: исходная метка `2026-09-22` —
  timestamp unavailable (только дата); доказуемая граница: `eval-local.json`
  mtime `2026-09-22T08:40:35+0400` (= `2026-09-22T04:40:35Z`); повторная
  верификация local `2026-09-22T04:46:58Z` (exit 0): `python3 -c`
  (embeddings, без зависимостей) и `uv run python -c` (parse_llm_ranking)
  (exit 0): frozen в `eval-local.json`; `python3 check_ai.py` → OK
  (6 entries, 5 findings, 32 checklist tokens — счётчик статических пунктов,
  НЕ pytest, см. разбор ниже; cap 0/200); `python3 -c
  json.load` обоих JSON → OK. Ни одного provider call, ни одной
  production-мутации.
- EV-024 — cap/denylist/tenant static proof: исходная метка `2026-09-22` —
  timestamp unavailable (только дата); доказуемая граница: `ai.md` mtime
  `2026-09-22T08:41:39+0400` (= `2026-09-22T04:41:39Z`); повторная
  верификация local `2026-09-22T04:46:58Z` (exit 0):
  live_provider_requests=0/cap=200 зафиксировано в `eval-local.json`;
  denylist доказан кодом `is_allowed_corpus_file` + `ensure_allowed_for_external`
  (`scripts/rag_import.py:33-36,134-137`) и `select_external_fragments`
  (`ai_wiring.py:104-116`); tenant boundaries — предикат
  `contour` в `rag.py:55-57,155-159` + CHECK + два частичных ivfflat
  (`0029_rag_contour.py`), CHECK-гейт чата `chat.py:24-61`.
  ПДн и проектные секреты в пробах не использовались.

## Лимит ≤200 (доказательство)

Разрешённый бюджет тикета — 200 запросов, только ГОСТы/синтетика.
Потрачено — 0: `eval-local.json: live_provider_requests=0, cap=200`.
Safe authenticated entrypoint недоступен (нет test accounts, R36), поэтому
live eval — `UNKNOWN`, а не обход auth. HTTP 200 публичных проб (EV-004)
не считается доказательством AI-поведения: все AI-маршруты требуют auth.

## 32 checklist tokens vs 32 passed pytest (разведены явно)

- `32 checklist tokens` — статический счётчик `CHECKLIST_TOKENS` в
  `check_ai.py` (число пунктов AI-checklist spec, найденных в `ai.md`);
  это НЕ результат pytest.
- `32 passed` — фактический прогон shared non-DB acceptance set (те же
  6 файлов, что в T05/EV-018, без изменения/ослабления тестов):
  точная команда `cd technozrelost-backend && uv run pytest --noconftest
  tests/test_html_sanitizer.py tests/test_prod_guard.py tests/test_config.py
  tests/test_ci_gates.py tests/test_upload_hardening.py
  tests/test_error_catalog.py -q`, exact UTC `2026-09-22T04:47:00Z`
  (старт) → `2026-09-22T04:47:01Z` (финиш), результат `32 passed` exit 0.
  AI-специфичные DB-тесты без локальной test DB дают setup-ошибки и остаются
  environment BLOCKED, продуктовых падений 0.

## Denylist и tenant boundaries (без ПДн/секретов)

- Denylist (deny-by-default, два слоя): ingest принимает только
  `ГОСТ*.pdf` (префикс `гост`, суффикс `.pdf`, сигнатура `%PDF-`,
  остальное — `SKIP(not-in-allowlist|damaged)`); наружу уходит только
  фрагмент, прошедший `ensure_allowed_for_external` (имя источника из
  basename `source_uri` или title). Источник без файлового имени наружу
  не уходит никогда. Внутренние документы (интервью, roadmap, код, доступы)
  в корпус не попадают по построению.
- Tenant boundaries: контур `tuno` (реестры/организации) vs `kaba`
  (ГОСТ/методология) изолирован предикатом `WHERE contour = ...` на каждом
  RAG-чтении + CHECK-ограничением + двумя частичными ivfflat-индексами.
  Универсальный `POST /chat` (contour=None) ищет по всем контурам —
  это задокументированная обратная совместимость, а не утечка: внешний
  промпт всё равно фильтруется allowlist-гейтом. RLS нет — изоляция
  application-level (см. DB-02, не дублируется). Рантайм-изоляция при
  скрещенных контурах — UNKNOWN (R36).
- PII-hygiene: вопрос обезличивается (`sanitize_question_for_external`:
  email/телефоны РФ → маркеры, обрезка 2000), наружу — только
  `safe_query` + allowlist-фрагменты; user/project id наружу не уходят
  (только sha256 `stable_session_id` для `x-opencode-session`).

## Покрытие AI-checklist spec (доказательно или UNKNOWN)

| Пункт | Статус |
|-------|--------|
| real provider call | static: ровно одна точка вызова — `ask_llm` → `POST {base}/chat/completions` (`ai_assistant.py:201-280`); live — UNKNOWN (0 calls в аудите, R36) |
| key validity by behavior not value | static: `resolve_llm_api_key` (приоритет `LLM_API_KEY` → `OPENCODE_API_KEY` → `OPENCODE_ZEN_API_KEY`, `change_me`/пусто = отсутствие) + `get_llm_status`/`log_llm_startup_status` (факт наличия, не значение); live-поведение ключа — UNKNOWN (ни одного вызова) |
| timeout | покрыто static: LLM timeout 20.0s, queue timeout 2.0s (`ai_assistant.py:33-34`); deployed-хвосты — UNKNOWN (замер 6–13с в комментарии, не доказательство SLO) |
| retry | покрыто static: повторных попыток нет (single-shot + fallback); отсутствие retry — осознанное решение, не пробел |
| circuit breaker | покрыто static: классического breaker нет; его роль выполняют semaphore-4 + queue-timeout + honest fallback; отсутствие breaker-объекта — зафиксировано, не UNKNOWN |
| fallback | покрыто static + offline: три честные ветки (`NO_SYNTHESIS_LEAD` / `LLM_DOWN_LEAD` / `NO_DOCS_TEXT`), лексический fallback RAG, script-fallback мэтчинга (`method=script`); eval GOST-03/04 доказывают ветку отказа офлайн |
| schema validation | покрыто static: выходы типизированы pydantic (`ChatOut`, `MatchOut`, `RagSearchResult`, `GeneratedDocumentOut`); LLM-текст не валидируется схемой — только парсинг номеров (`parse_llm_ranking`, None → script-порядок); сырой JSON провайдера читается как `choices[0].message.content` без валидации оболочки (см. AI-02) |
| prompt injection | покрыто static: `wrap_untrusted` + `PROMPT_ISOLATION_RULE` (контент между маркерами — только данные); враждебных проб не запускали (fuzz запрещён) — deployed-стойкость UNKNOWN |
| tool permissions | покрыто static: инструментов с побочными эффектами нет (только read-retrieval + один HTTP-вызов чтения-генерации); чат не мутирует проекты/УГТ по построению (`chat.py:43-47`) |
| tenant isolation | покрыто static (см. раздел выше); рантайм — UNKNOWN |
| provider data policy | частично: наружу — только ГОСТ-фрагменты + обезличенный вопрос (G56); договор/политика хранения у провайдера (OpenCode Go) — UNKNOWN, в репо её нет; значение ключа нигде не логируется (только статус/модель) |
| logging | покрыто static: стартовая проба (наличие ключа, модель), warning-и со статусом (без ключа/тела), счётчики fallback/timeout/error; пользовательские тексты в логи не пишутся |
| hallucinations | частично: persona запрещает выдумку разделов/критериев/фактов + честный отказ вне корпуса; генерация документов честно подставляет нейтральные `0%/0/—` вместо выдуманных уровней; deployed-частота галлюцинаций — UNKNOWN (нет eval set с разметкой) |
| citations | покрыто static + offline: ответы несут `sources[]` (id/title/type/ugt/200 chars) + пронумерованные цитаты ≤500 символов с источником (`format_excerpt_quotes`); LLM-синтез цитирует контекст по persona-структуре; live-качество цитат — UNKNOWN |
| grounding | покрыто offline: eval GOST-01/02 (combined 0.65/0.48 ≥ 0.15 → grounded), GOST-03/04 (0.0 → отказ вместо мусора); порог `_is_relevant` (lex>0 или combined≥0.15) + синонимы `syn_*` — статически и замером |
| retrieval | покрыто static + offline: гибрид (KNN fetch ×4 + rerank 0.65vec/0.35lex) + ILIKE-prefilter + lexical fallback; live-recall/precision на размеченной выборке — UNKNOWN |
| chunking | частично: чанкинг явный отсутствует — контекст режется срезом `raw_text[:500]` (промпт) / `[:200]` (sources); перекрытия/метаданных чанков нет → AI-04 (debt) |
| embeddings | покрыто static: офлайн `semantic-ru-v2`, dim 1536, детерминированный (нормализация, стоп-слова, Snowball-RU, каноны синонимов, TF 1+log, биграммы ×0.5, syn ×1.5, L2); внешних embedding-API нет; переиндексация — `scripts/reindex_rag_embeddings.py` (в аудите не запускался, read-only) |
| metadata | покрыто static: `title/doc_type/ugt_level/source_uri/template_metadata/contour/content_hash/created_at`; match-кандидаты несут type/region/competencies; фото/авторства чанков нет |
| staleness | частично: свежесть = `updated_at desc` (первый шаблон побеждает) + sha-манифест + `content_hash`-дедуп; мониторинга staleness/алертов нет → AI-04 |
| prompt version | покрыто static: версионирования нет — промпты = константы кода, версия = git SHA; смена тона без смены ограждений — задокументирована комментарием (R03); future-реестр промптов — не в скоупе (R33) |
| reproducibility | частично: офлайн-путь детерминирован (CTT: тот же текст → тот же вектор/ранг; eval заморожен); LLM-путь — temperature 0.3 без seed → live-воспроизводимость UNKNOWN |
| eval set | частично: этот тикет завёл `eval-local.json` (7 офлайн-кейсов, только ГОСТ-публика/синтетика); размеченного live eval set с human-judgement нет → AI-05 |
| human-in-loop | покрыто static: мэтчинг идёт только через центр (MatchRequest → модерация → Notification, прямых контактов нет); генерация документов — draft v1 + audit entry (человек утверждает); чат — справочный слой без deeds |
| budget | покрыто static: денежного бюджета/лимита трат нет (см. AI-03); единственная количественная крышка — `LLM_MAX_TOKENS=800` |
| rate | покрыто static: chat — 30 req/60s на пользователя (`ai_metrics.py:20,24-35`, превышение → 429 `AI_RATE_LIMITED`); registry/auth — отдельные зоны (EV-017); `/match` и `/rag/*` собственного rate-гейта не имеют (см. AI-03) |
| quota | покрыто static: квот нет — ни per-user сверх rate, ни глобальной; зафиксировано как риск, не UNKNOWN |
| cap | доказан: тикет-cap 200, потрачено 0 (`eval-local.json`); кодовый cap генерации — 800 токенов |
| queue | покрыто static: очередь = in-memory semaphore-4 + queue-timeout 2s (отказ → `timeouts_total++`, fallback); персистентной очереди/DLQ нет (см. operations-зону, не дублируется) |
| cache | покрыто static: явного кэша ответов нет (каждый чат — свежий retrieval + вызов); `x-opencode-session` — маршрутизация/кэш провайдера, не наш; отсутствие cache — зафиксировано |
| context limit | покрыто static: контекст = top-3 × 500 chars + `safe_query` ≤2000 chars + persona; оценка токенов контекста не производится (см. AI-03) |
| outage | покрыто static: отказ провайдера (non-200/timeout/exception) → warning-лог (статус+модель, без секретов) → `fallbacks_total++` → честные выдержки; платформа не деградирует (чат — справочный слой); deployed-поведение при реальном outage — UNKNOWN (не инсценировался) |

## Grounding / citations / retrieval / fallback / timeouts / cost controls / observability / provider outage (сводка для приёмки)

- Grounding: порог релевантности + синонимические каноны доказаны офлайн-замером (GOST-01 0.6475 → grounded; GOST-03 0.0 → отказ). Live-grounding — UNKNOWN.
- Citations: `sources[]` + цитаты ≤500 с источником на каждом ответе (даже fallback). Формат цитат LLM — persona-контракт, live-проверка — UNKNOWN.
- Retrieval: гибридный путь с двойным fallback (вектор → лексика → `[]`, никогда 500). Live-recall — UNKNOWN.
- Fallback: все три AI-поверхности (chat/rag/match) имеют детерминированный честный путь без провайдера; счётчики `fallbacks_total`/`timeouts_total`/`errors_total` — in-memory.
- Timeouts: 20s LLM + 2s очередь + semaphore-4; худший случай ≤24s на запрос (комментарий кода, не SLO-замер).
- Cost controls: 800 токенов, sem-4, rate 30/60s; бюджета/квот/breaker/оценки контекста нет → AI-03 (medium).
- Observability: `GET /chat/metrics/ai` (агрегаты без per-user карты) + стартовый лог; персистентности/сplit-by-contour/трейсов нет → AI-04 (low).
- Provider outage: спроектирован fail-soft (платформа живёт, чат честно деградирует); реальный outage не инсценировался → deployed UNKNOWN, live-план — в AI-05.

## Production-сопоставление (static local vs deployed)

- Локальный HEAD `f364388` ≠ server HEAD `f06b15c` (EV-001/EV-002); любой
  вывод о deployed-AI за пределами каталога EV-013 — UNKNOWN.
- Deployed-факт из каталога: `rag_documents` = 677 строк (EV-013) —
  корпус существует в проде; свежесть/полнота индекса (staleness,
  embedding-версия строк) — UNKNOWN (definitions/checksums не сверялись).
- Имена LLM-ключей в прод-компоузе присутствуют как set/empty (EV-007);
  resolved values и `LLM_GATEWAY_ENABLED` прод-факта — UNKNOWN (запрет).
  Дефолт кода — gateway выключен (F-030 `DISABLED`); включён ли он в проде —
  UNKNOWN, а не факт.
- Авторизованный рантайм всех AI-маршрутов (все роли, оба контура,
  генерация под членством) — UNKNOWN до test accounts (R36).

## UNKNOWN (честно недоступное)

1. Live-синтез/ранг/цитаты/отказы на проде и локально с провайдером
   (0 calls по Решению 5; нужен safe entrypoint + test accounts).
2. Resolved values: `LLM_GATEWAY_ENABLED`, наличие ключа, модель в проде;
   provider data-retention политика.
3. Index freshness/staleness прод-корпуса (677 строк — только count).
4. Ролевой рантайм (все роли × оба контура × генерация) — R36.
5. Де deployed-стойкость к prompt injection / реальный outage-хвост.

Mutations: ни одной (ни одного POST/PUT/DELETE, манифест не писался,
reindex не запускался). LLM-вызовов: 0 (лимит 200 не тронут).
ПДн/секретов/бизнес-строк/транскриптов в артефактах нет.
