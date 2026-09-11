# Evidence 05: AI, RAG и файлы

## Объект и метод

- Снимок: `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, ветка
  `audit/deep-repository-20260910`, проверка 2026-09-10.
- Проверены публичные швы `POST /api/v1/chat`, `POST /api/v1/chat/{tuno,kaba}`,
  `POST /api/v1/match`, `POST /api/v1/rag/{templates,search}`,
  `POST /api/v1/projects/{id}/generate/{type}`, загрузка/list/download/rescan файлов,
  stage-document flow и клиентский matching rerank.
- `.env` не читались; рассмотрены только имена и пустые примеры переменных. Внешние LLM,
  MinIO и ClamAV не вызывались. Product/dependency/data changes не выполнялись.
- Узкие проверки: `cd technozrelost-backend && uv run pytest tests/test_llm_gateway.py -q`
  -> `7 passed, 2 warnings in 6.07s`; `cd technozrelost-frontend && node --test
  tests/matching.test.mjs` -> `7 passed`. Эти тесты подтверждают disabled-gateway и наличие
  UI-кода, но не опровергают находки ниже.

## 05-01: LLM-секрет публикуется в браузерном bundle, а вызов обходит backend gateway

- Category: Security / confidential egress / credential exposure
- Proposed severity: **Critical**
- Confidence: **Confirmed**
- Files: `technozrelost-frontend/.env.example:17-23`;
  `technozrelost-frontend/src/features/matching/llm.ts:48-65,71-76,147-176,186-255`;
  `technozrelost-frontend/src/features/matching/MatchingMode.tsx:259-267`.
- Evidence: `.env.example` предлагает `NEXT_PUBLIC_LLM_API_KEY`; client module получает его
  из `process.env.NEXT_PUBLIC_LLM_API_KEY` и ставит в `Authorization: Bearer` прямого
  browser `fetch` к настраиваемому LLM URL. После серверного `POST /match` UI безусловно
  запускает второй `rerankWithLlm`. Серверные `LLM_GATEWAY_ENABLED`, semaphore, метрики и
  аудит при этом не участвуют.
- Safe reproduction: собрать frontend с фиктивным уникальным значением
  `NEXT_PUBLIC_LLM_API_KEY`, открыть JS bundle или перехватить browser request и найти это
  значение/`Authorization`. В текущем аудите сборка с секретом намеренно не выполнялась.
- Actor/preconditions/effect: любой получатель frontend при настроенном public key извлекает
  credential и использует его вне платформы; любой пользователь matching отправляет данные
  провайдеру мимо централизованного gateway. Возможны неограниченные расходы, отзыв ключа и
  неконтролируемая передача данных.
- Remediation: удалить browser LLM client и все `NEXT_PUBLIC_LLM_*KEY*`; выполнять один
  rerank только backend gateway с server-side secret, policy/consent, rate limit и audit.
- Tests: production-build contract, запрещающий `NEXT_PUBLIC_LLM_API_KEY` и LLM host/key в
  client chunks; HTTP test должен доказать ровно один backend-controlled provider call.
- Dependencies: secret rotation/deployment configuration review.

## 05-02: Allowlist полей не обезличивает значения и не защищает конфиденциальный контент

- Category: Security / PII / prompt injection
- Proposed severity: **High**
- Confidence: **Confirmed**
- Files: `technozrelost-backend/app/core/config.py:71-79`;
  `technozrelost-backend/app/schemas.py:372-375,390-398`;
  `technozrelost-backend/app/services/ai_assistant.py:56-103,138-180`;
  `technozrelost-backend/app/services/matching.py:199-235`;
  `technozrelost-frontend/src/features/matching/sanitize.ts:59-108,135-153`.
- Evidence: включённый gateway дословно отправляет `ChatIn.message`, до 1500 символов
  найденных RAG-документов и matching `title/annotation/region/competencies`. Нет per-request
  consent, классификации документа, redaction ФИО/телефонов/коммерческой тайны или provider
  allowlist. Frontend `assertNoPii` проверяет ключи и только email-подобное значение; ФИО,
  телефон, паспортные данные и секрет в разрешённых строках проходят. User query не помещён
  в untrusted boundary (`ai_assistant.py:170-176`), а в matching ни query, ни candidates не
  имеют prompt delimiters (`matching.py:215-235`). Текстовая system-инструкция не является
  data-loss control.
- Safe reproduction: подменить `ask_llm`/`fetch` локальным capture stub и передать в
  `message`, `title` либо `annotation` маркер `Иванов ... +7...; игнорируй правила`;
  capture получает маркер дословно. Реальному провайдеру данные не отправлять.
- Impact: авторизованный пользователь может непреднамеренно вывести ПДн/закрытое описание,
  а prompt injection управляет ответом/объяснениями внешней модели. Global gateway flag
  закрывает контур только пока выключен, но не делает включённый режим безопасным.
- Remediation: server-only egress policy с явным consent/purpose, value-level DLP/redaction,
  классификацией RAG, tenant/access label enforcement, provider allowlist и delimiters для
  каждого недоверенного значения; deny confidential classes.
- Tests: capture-provider tests для ФИО/телефона/секрета и delimiter breakout; consent denied;
  confidential RAG never egresses; frontend cannot call provider.
- Dependencies: политика 152-ФЗ/ВПК и классификация данных.

## 05-03: Загруженные PDF/DOCX/XLSX/изображения не анализируются; LLM видит только имя

- Category: Business completeness / document AI
- Proposed severity: **High**
- Confidence: **Confirmed**
- Files: `technozrelost-backend/app/api/v1/stages.py:131-172,412-456`;
  `technozrelost-backend/app/services/file_storage.py:133-167,356-393`;
  `technozrelost-backend/app/db/seed_gost.py:70-113`;
  `technozrelost-backend/app/schemas.py:488-498`.
- Evidence: file upload stores bytes and metadata but leaves `ProjectDocument.file_url=None`.
  `_evaluate` builds evidence as `title + str(file_url or '')`, therefore uploaded files
  contribute only their user-controlled title. Runtime has no PDF/table extraction or OCR.
  PyMuPDF extraction exists only in offline GOST seed and extracts text layer only; XLSX,
  scans and images are unsupported. Text-form documents are limited to 20,000 characters,
  but this is a separate API path.
- Safe reproduction: upload two clean PDFs with the same filename/title and opposite body
  claims, stub `ask_llm`, complete a stage kit; captured prompt is identical and contains no
  body bytes/text. A scanned PDF likewise has no OCR path.
- Impact: claimed document analysis/checking cannot distinguish valid, empty or contradictory
  evidence. An LLM may mark the kit `pending_manager` from titles alone; fail-soft manual
  manager review limits but does not remove workflow-integrity risk.
- Remediation: introduce quarantined extraction pipeline with bounded PDF/OOXML/XLSX parsing,
  OCR status/provenance, table representation, extraction limits and explicit `unreadable`;
  evaluation must require verified extracted content, never title-only evidence.
- Tests: same-title/opposite-body public workflow test; scanned PDF/OCR, XLSX table, corrupt/
  encrypted/zip-bomb cases; unavailable extractor must return degraded state, not evaluate.
- Dependencies: safe parser/OCR choice, resource sandbox and document-classification policy.

## 05-04: `AI_APICallError` исчезает в `None`, а chat выдаёт деградацию как обычный успех

- Category: Reliability / API contract / observability
- Proposed severity: **Medium**
- Confidence: **Confirmed**
- Files: `technozrelost-backend/app/services/ai_assistant.py:56-109,180-196`;
  `technozrelost-backend/app/schemas.py:382-384`;
  `technozrelost-backend/app/api/v1/chat.py:29-49`;
  `technozrelost-backend/tests/test_ai_assistant.py:68-78`;
  `technozrelost-frontend/src/app/dashboard/ai-assistant/page.tsx:78-97`.
- Evidence: HTTP non-200, timeout, malformed provider payload, connection failure and any
  exception (включая класс upstream `AI_APICallError`) схлопываются в `None`. В production
  code класс/код `AI_APICallError` отсутствует. `/chat` возвращает HTTP 200 с тем же `ChatOut`,
  где нет `method/degraded/error_code`; frontend показывает fallback как assistant answer.
  Существующий тест намеренно утверждает только 200 и роль assistant. Ошибка учитывается
  лишь в volatile process-local counters, без status/provider/model/request correlation.
- Safe reproduction: monkeypatch `httpx.AsyncClient.post` на `httpx.ConnectError`, timeout,
  503 и invalid JSON; каждый путь даёт 200 без machine-readable degradation. Проверенный
  тест provider-down прошёл, но закрепляет именно это поведение.
- Impact: клиент, аудит и оператор не отличают модельный ответ от fallback и не могут
  корректно retry/escalate; unavailable может выглядеть ложным успехом. Не-AI функции не
  падают, что является подтверждённой положительной частью fail-soft поведения.
- Remediation: типизированный provider result/error mapping; добавить `mode`, `degraded`,
  `error_code`, provider/model/prompt versions и request correlation без prompt content.
- Tests: отдельные assertions для connect/timeout/401/429/5xx/schema error и отображения
  degraded UI; не-AI endpoint остаётся доступен.
- Dependencies: стабильный публичный AI response contract.

## 05-05: Неограниченные AI/RAG входы позволяют CPU, DB, response и LLM-cost amplification

- Category: Security / availability / cost control
- Proposed severity: **High**
- Confidence: **Confirmed**
- Files: `technozrelost-backend/app/schemas.py:308-323,372-375`;
  `technozrelost-backend/app/services/rag.py:115-160,163-212`;
  `technozrelost-backend/app/core/embeddings.py:196-261`;
  `technozrelost-backend/app/services/ai_assistant.py:76-103`;
  `technozrelost-backend/app/services/ai_metrics.py:9-35`;
  `technozrelost-backend/app/main.py:105-171`.
- Evidence: `ChatIn.message/history`, RAG title/raw_text/query and `top_k` имеют no length/
  range constraints. Общий body limit допускает 32 MiB. `embed_text` и lexical rerank
  синхронно токенизируют/хешируют вход внутри async request; `top_k` напрямую определяет
  SQL LIMIT, Python result count и полный `raw_text` response. `max_tokens=2000` ограничивает
  только output; input token budget/cost quota отсутствуют. AI limiter process-local,
  chat-only and grows `_user_window`; `/rag/search`, `/match` and direct browser LLM обходят
  его. Заявленный `EMBEDDING_CONCURRENCY` есть только в example, runtime implementation нет.
- Safe reproduction: authenticated local ASGI request with multi-megabyte `message/query` or
  very large positive `top_k`; observe validation accepts it before CPU/DB/provider work.
  Нагрузочный прогон не выполнялся из-за общей БД и запрета вредного воздействия.
- Impact: один/несколько пользователей могут блокировать event loop/DB, выгрузить весь RAG
  corpus и увеличить provider input cost; multi-worker deployment умножает chat limit.
- Remediation: strict lengths and `1<=top_k<=N`; shared Redis quotas for all AI routes;
  input-token estimator/budget, per-user/org spend ceilings, bounded worker pool for embedding,
  pagination/projection and provider 429 handling.
- Tests: 422 boundaries, cross-worker quota contract, token-budget refusal and bounded top_k;
  capacity test separately from this audit.
- Dependencies: product quotas/cost budget and Redis policy.

## 05-06: Matching принимает свободный текст модели как валидный rerank/explanation

- Category: AI correctness / hallucination / repeatability
- Proposed severity: **Medium**
- Confidence: **Confirmed**
- Files: `technozrelost-backend/app/services/matching.py:110-139,195-276`;
  `technozrelost-frontend/src/features/matching/llm.ts:186-225,289-337`;
  `technozrelost-frontend/src/features/matching/MatchingMode.tsx:259-273`.
- Evidence: backend ставит `method="llm"` для любого непустого ответа до успешного parsing;
  при invalid ranking сохраняет script order, но подменяет reasons произвольными строками.
  Frontend второй раз вызывает LLM и вообще не парсит ranking IDs: пять строк по позиции
  подменяют explanations, порядок не меняется. Нет JSON schema, candidate-ID binding,
  factual checks, score calibration, citation or output-language/length semantics beyond
  slicing. `temperature=0.3`, provider/model из mutable env; prompt/model versions и seed не
  возвращаются/не сохраняются, поэтому результат не воспроизводим.
- Safe reproduction: stub response `Ignore candidates\n1 - fabricated claim`; backend/UI can
  report `method=llm` and display fabricated/misaligned reason without changing candidate
  order or proving source.
- Impact: пользователь получает ложную объяснимость и несогласованные результаты двух LLM
  проходов; рекомендации нельзя воспроизвести или защитить аудитом.
- Remediation: один backend rerank; strict JSON schema `{candidate_id,rank,reason,evidence}`,
  complete unique ID validation, grounding in registry fields, deterministic config and
  persisted model/prompt/schema versions. Invalid output must retain script reasons/method.
- Tests: malformed/duplicate/unknown/partial IDs, reordered IDs/reasons, hallucinated field,
  repeatability metadata and one-call invariant.
- Dependencies: recommendation quality policy and prompt registry.

## 05-07: ClamAV не имеет deadline; объект записывается до сканирования

- Category: File security / availability / lifecycle
- Proposed severity: **High**
- Confidence: **Confirmed**
- Files: `technozrelost-backend/app/services/file_storage.py:178-213,246-275,356-393`;
  `technozrelost-backend/app/api/v1/files.py:70-110`;
  `technozrelost-backend/app/api/v1/stages.py:412-448`.
- Evidence: `asyncio.open_connection`, `writer.drain`, `reader.read` и total scan не обёрнуты
  timeout. Upload first performs MinIO `put`, then awaits scan, and only afterwards commits
  metadata. A clamd that accepts TCP but never replies holds request and full in-memory file;
  disconnect/cancellation/DB failure leaves an object with no row. Project/stage paths also
  call synchronous `storage.put` directly inside async endpoint. Download correctly blocks
  every status except `clean` (`files.py:128-163`), but this does not bound ingestion.
- Safe reproduction: local fake clamd accepts connection and sends no reply; await `scan`
  under a short harness timeout and verify it does not finish itself. Not run against live
  services. For orphan, make DB commit fail after a stub storage put and observe no remove path.
- Impact: project member can consume workers/memory and accumulate orphan/quarantined bytes;
  provider outage becomes upload outage. Objects are not actually placed in a separate
  quarantine namespace/bucket despite quarantine wording.
- Remediation: connect/write/read/total deadlines, cancellation-safe close, scan before final
  promotion (temporary quarantine key), async storage path, and compensation delete on every
  failure. Persist pending before scan only if a background scanner owns retries/dead-letter.
- Tests: hanging/partial/oversized clamd replies, cancellation, DB failure cleanup, scanner
  unavailable, infected quarantine deletion/promotion and concurrent uploads.
- Dependencies: MinIO lifecycle/quarantine policy and AV SLO.

## 05-08: File validation/lifecycle is incomplete despite good ACL and fail-closed download

- Category: File security / retention
- Proposed severity: **Medium**
- Confidence: **Confirmed**
- Files: `technozrelost-backend/app/services/file_storage.py:30-42,133-167,277-316`;
  `technozrelost-backend/app/api/v1/files.py:91-110,113-181`;
  `technozrelost-backend/app/api/v1/requests.py:225-290`;
  `technozrelost-backend/app/db/models.py:410-446`.
- Evidence: PDF/PNG/JPEG acceptance checks only leading magic bytes, not structural validity;
  OOXML checks central names but no entry-count/compression-ratio/encrypted/archive limits.
  `file_name` and optional `title` are unbounded request values written into `VARCHAR(255)`
  after object creation, so overlength DB failure can orphan storage. Infected/error latest
  versions remain indefinitely; cleanup deletes only non-latest stored versions, and there is
  no project-file delete endpoint or project-cascade object hook. Bucket versioning is
  best-effort and exceptions are suppressed, with no retention/expiry contract.
- Safe reproduction: local upload with >255-character filename/title after stub storage put;
  DB rejects row and object has no compensating delete. Prefix-only `%PDF-` garbage is accepted
  by MIME detector. No malicious archive or persistent data was created during audit.
- Impact: storage exhaustion, inability to honour deletion/retention, retained infected or
  confidential bytes and misleading MIME. Positive controls: UUID keys prevent filename path
  traversal (`file_storage.py:365-367`), ACL precedes upload/list/download, storage keys are not
  exposed, and download is fail-closed for non-clean files (`files.py:78-110,113-163`).
- Remediation: validate metadata lengths before put; parser-based bounded structural checks;
  transaction compensation/outbox; explicit delete/retention for latest, infected, orphan and
  bucket versions; reconciliation job and metrics.
- Tests: overlong metadata leaves zero objects, malformed/polyglot/archive-bomb boundaries,
  delete/project-delete retention, infected TTL, versioned-object purge and ACL/IDOR regressions.
- Dependencies: legal retention schedule and MinIO version-expiry policy.

## Возможности и бизнес-трасса

| Заявление | UI | API/service | Storage/model | Authorization | Test/evidence | Verdict |
|---|---|---|---|---|---|---|
| AI chat + sources | `ai-assistant/page.tsx:60-101,128-190` | `chat.py:36-73`; `ai_assistant.py:128-196` | RAG raw text | authenticated | `test_ai_assistant.py:52-78`; `test_llm_hardening.py:206-238` | Частично: sources/fallback есть; нет degraded contract, consent/DLP |
| RAG/semantic search | API client/UI indirect | `rag.py:36-65`; service `rag.py:163-224` | pgvector 1536 + lexical 65/35 | search/list: любой authenticated; write: manager/admin | `test_semantic_embeddings.py:76-100,193-216` | Работает на curated synonyms; no bounds/tenant labels/learned reranker |
| Partner matching | `MatchingMode.tsx:194-305` | `match.py:14-31`; `matching.py:182-276` | organizations registry | любой authenticated | backend rerank test `test_semantic_embeddings.py:147-190`; frontend test mostly source grep `matching.test.mjs:41-72,124-131` | Двойной LLM, false explanations; propose is mock only (`MatchingMode.tsx:182-191`) |
| Document generation | route/UI API | `generation.py:14-40`; `document_generator.py:83-157` | template substitution into `file_url` | project access | `test_document_generation.py:73-110` | Только deterministic text template; no LLM wording/checking/export artifact |
| Document checking | stage UI/API | `stages.py:131-172,212-380` | evaluation JSON + audit | project access, manager final decision | injection/parser tests `test_llm_hardening.py:59-137` | Text input bounded; uploaded binary body never read, no OCR/table/PDF runtime |
| File upload/download | document UI/API | `files.py:65-181`; `file_storage.py:133-213,356-464` | private MinIO/local test | project ACL | `test_file_storage.py:102-233`; `test_scan_failclosed.py:53-70` | MIME/size/UUID/ACL/download guard present; AV timeout/quarantine/lifecycle incomplete |

## AI/RAG контрольная карта

- Gateway: backend default-off and no-call without key are directly tested
  (`config.py:71-79`; `test_llm_gateway.py:19-158`), but frontend direct provider path defeats it.
- Timeout/queue/concurrency: backend LLM has queue 2 s, call 8 s, semaphore 4 and no retries
  (`ai_assistant.py:21-28,68-111`). Это bounded fail-soft; semaphore is per process, not a
  durable queue, and `MatchOut.queue="llm-eval"` is only a label (`schemas.py:413-419`).
- Retry/fallback: backend performs no retry/backoff (good against retry storms, weak for transient
  failure); frontend offers manual retry and does a direct second call. RAG vector/model errors
  fall back to lexical (`rag.py:175-212`).
- Token/cost: outputs capped at 2000 backend and 1200 browser, inputs/aggregate spend are not;
  no usage/cost/provider-rate telemetry. Metrics are in-memory counters only
  (`ai_metrics.py:9-41`).
- Parsing/schema/hallucination: stage verdict first-token parser is fail-closed
  (`stages.py:113-128`); matching and chat are free text without schema/grounding. Chat advises
  model to answer from own knowledge when RAG is insufficient (`ai_assistant.py:160-167`).
- Repeatability/versioning: offline embeddings are deterministic and named `semantic-ru-v2`
  (`embeddings.py:22-24,246-261`); LLM prompt/model/version/response are not persisted or returned.
- Logging/storage: application log formatter redacts bearer/key-value secrets and emails
  (`logging_config.py:47-78`); AI code does not log prompt/response, but provider stores/processes
  them under an unrepresented policy. Stage stores summary/missing, not prompt/model version
  (`stages.py:345-370`). Browser console logs endpoint/status but not key/payload.
- RAG reranking: local feature hashing + curated synonyms is not a neural embedding model;
  KNN candidates are combined with lexical score 0.65/0.35 (`rag.py:167-212`). No learned
  reranker or quality evaluation beyond five golden synonym pairs.
- PDF/table/OCR: only offline text-layer PDF and DOCX extraction in GOST seed
  (`seed_gost.py:70-113`); no runtime OCR, image understanding, XLSX extraction or table model.
- Generation/checking: generation is string substitution and stores text in `file_url`
  (`document_generator.py:99-156`); no template contour/version pin in selection, unknown
  variables remain unresolved (`document_generator.py:49-80`). Human manager remains final
  stage decision, but AI precheck provenance is inadequate.

## Глубинные состояния

| Состояние | Результат |
|---|---|
| Первый запуск / dependencies absent | LLM/key absent -> chat/matching fallback; RAG DB/pgvector and document templates still required. External provider/MinIO/ClamAV smoke **BLOCKED** by no credentials/live-state rule. |
| Пустые данные | Chat returns no-results text; matching can return empty; generation maps missing template to 404; no false LLM call required. |
| Неверный/предельный ввод | File size and basic signatures bounded; Chat/RAG lengths/top_k, filename/title and archive complexity are not safely bounded (05-05, 05-08). |
| Отказ зависимости | LLM and vector search have fallback; degradation is ambiguous. ClamAV hanging dependency has no deadline; MinIO errors map 503. |
| Прерывание/повтор | LLM no automatic retry; browser manual retry. Upload cancellation/DB failure can orphan object; generation/recommendation lack idempotency/version provenance. |
| Рост объёма | LLM semaphore 4/process; no durable queue, shared quotas, embedding worker bound, token/cost budgets or safe large-RAG response bound. |
| Роли/организации | File project ACL and RAG-write admin checks present. RAG search/list expose every contour to every authenticated user (`rag.py:36-65`); contour is taxonomy, not tenant/clearance. |
| Последствия/обратимость | AI decisions mostly advisory/manual-final, but recommendation provenance absent. Stored infected/orphan/versioned objects lack complete purge/retention evidence. |

## Ограничения и missing tests

- Live provider behavior, provider retention/training terms, real `AI_APICallError` SDK origin,
  ClamAV signature freshness/effectiveness, MinIO bucket policy/version expiry and production
  deletion are unverified external assumptions, not passes.
- Existing AI tests stub `ask_llm`; no capture test for enabled-gateway PII, no provider schema/
  429/invalid JSON test, no cost or multi-worker quota test. Frontend matching suite chiefly
  asserts source substrings and does not execute `rerankWithLlm` or inspect a built bundle.
- File tests use `APP_ENV=test`, where scanner returns clean (`file_storage.py:181-187`), so they
  do not exercise real INSTREAM, timeout, quarantine, infected lifecycle, malformed parser or
  object compensation. No production data or secret value was inspected.
