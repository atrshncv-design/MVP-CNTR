# Аудит репозитория «Технозрелость» — глубокий технический отчёт

Baseline: `e87267d7c6840ce7d4ec153d7d183731bf5f32e4` (ветка `audit/deep-repository-20260910`).
Worktree SHA на момент сборки: `aa82ab525b62701877af5a9397400ff8db52e1e3`.
Дата сборки: 2026-09-11.
Продуктовый код не изменялся; секреты не читались и не выводятся (только имена переменных).
Консолидация таска 10: дедупликация по `interfaces.md` и `state.js` concerns/reviewers, без новых продуктовых правок, без коммита.

Источники: `.autopilot/2026-09-10-deep-repository-audit--wip/evidence/01..09`, `interfaces.md`, `spec.md` (Результат/Метод/Безопасность/Формат находки/Критерии качества/Вне рамок/Открытые места), `manifest.md`, `state.js`, тикет 10. Suites из evidence 01..09 приняты «по ссылке» (см. §Запуск), свежие прогоны в таске 10 не выполнялись кроме валидации JSON.

Итог: 66 находок AUD-001..AUD-066. Blocker: 0. Critical: 1 (AUD-058, reachable Next advisory). High: 25. Medium: 35. Low: 5. Confirmed: 58. Probable: 7. Suspicious: 1. Нулевые домены без находок отсутствуют как отдельные домены — все 11 направлений имеют хотя бы одну находку либо явный marginal-риск; выдумывание находок ради количества не выполнялось; Ruff E501/B007 как тулинг-дефект в находки не переносился.

## 1. Ответы на 10 вопросов брифа

1. Можно ли запускать в production? Нет безусловного «да». Сборки проходят (frontend build с CI env, backend package), но есть блокирующие эксплуатацию риски: reachable Critical Next advisory (AUD-058), красный mypy-gate (AUD-059), BOLA-утечка pending-join (AUD-011), transfer-race (AUD-012), отсутствие offsite/нотификаций как допустимое состояние (AUD-052), rollback без схемы (AUD-049), root-контейнеры с backup-полномочиями (AUD-050), self-signed TLS за health-gate (AUD-054), потери/блокировки миграций (AUD-035/037/039), unbounded AI/RAG amplification (AUD-014), ClamAV без deadline (AUD-046), Redis-leak (AUD-063), file event-loop/RAM (AUD-062). Production допустим только после remediation plan P0 и повторных gates.
2. Топ-10 наиболее опасных: AUD-058, AUD-011, AUD-012, AUD-014, AUD-042, AUD-043, AUD-046, AUD-001, AUD-002/AUD-003 (бизнес-целостность), AUD-052 (невосстановимость). Полный топ-10 см. §2.
3. Исправить немедленно (P0): AUD-058, AUD-059 (gate), AUD-011, AUD-012, AUD-014 (bounds), AUD-042 (DLP), AUD-046, AUD-052, AUD-049/050/054, AUD-035/039.
4. До MVP: AUD-002, AUD-003, AUD-004, AUD-005, AUD-009/010/026, AUD-013/015, AUD-017/028, AUD-029/030/041, AUD-043/044/045, AUD-019/020/027, AUD-060.
5. Можно отложить (после MVP, плановый долг): AUD-008, AUD-016, AUD-023/024/025, AUD-036/038, AUD-055/057/061, AUD-064/065/066 (частями), AUD-022 (после решения канона), AUD-009-гипотеза.
6. Что мешает масштабированию: AUD-014, AUD-032/033, AUD-041 (длинные транзакции + fan-out), AUD-056, AUD-062/063/064/065/066, AUD-019/020, AUD-004.
7. Заявлено, но фактически не работает: proposal через ЦНТР (AUD-002); KT-персистентность/маппинг (AUD-003); template-download (AUD-005); saved-filters server-persistence (AUD-006); news-media delivery (AUD-007); goals/tasks/results как сущность (AUD-009); canvas durability (AUD-010); generation UI (AUD-026); offline retry (AUD-027); document body analysis/OCR (AUD-043); degraded-контракт (AUD-044); technology-канон (AUD-022).
8. Уровень безопасности: средний-низкий для B2B/B2G. Сильные стороны: JWT verify + актуальная роль из User, allowlist саморегистрации, project-guard с 404-маскировкой, signature/MIME/UUID/scan fail-closed download, SSE ticket одноразовый, registry/auth limiters, централизованные errors. Системные слабости: BOLA (AUD-011), race (AUD-012), browser-LLM обход gateway (AUD-001), отсутствие value-DLP (AUD-042), unbounded amplification (AUD-014), audit gaps (AUD-015), dev-expose (AUD-048), root/blast-radius (AUD-050), сеть без сегментации (AUD-051), алерты без retry (AUD-053).
9. Уровень тестового покрытия: количественно большой (backend collection 520 по ссылке, frontend 182 по ссылке, alerter 30 по ссылке, LLM gateway 7/7 + matching 7/7 по ссылке, KT 8/8 + routes 7/7 по ссылке, offline 10/10 по ссылке, RBAC/security 36/36 по ссылке), качественно неравномерный: нет browser E2E/component-render/axe/keyboard, нет composed browser→API journey, нет ASGI smoke, нет nginx/alembic-syntax gates, нет clean-DB upgrade/downgrade/head→base→head, нет load/soak/failover, source-grep контракты завышают сигнал (AUD-061), destructive shared harness блокирует параллельность (AUD-060), mypy красный (AUD-059).
10. Действия на 7 дней: обновить Next/transitives + пересобрать lock (AUD-058); починить mypy (AUD-059); ввести disposable DB/schema harness (AUD-060); закрыть BOLA pending-join DTO + limiter (AUD-011); atomic transfer + partial-unique (AUD-012); bounds top_k/query/message + quotas (AUD-014); убрать browser-LLM, только backend gateway (AUD-001); server DLP/delimiters (AUD-042); ClamAV deadlines + quarantine-before-commit (AUD-046); strict-DR preflight + offsite/Telegram probe (AUD-052); expand/contract + one-shot migrator (AUD-049); non-root/cap_drop/scoped creds (AUD-050); staging-TLS preflight без -k (AUD-054); quarantine для 0031-подобных миграций (AUD-035); model-version + reindex gate (AUD-039); Redis lifecycle/aclose (AUD-063); streaming file path (AUD-062).

## 2. Топ-10 рисков

1. AUD-058 — locked frontend содержит reachable unauthenticated RCE advisory (Critical, Confirmed).
2. AUD-011 — pending join раскрывает закрытую карточку и договорные поля (High, Confirmed).
3. AUD-012 — конкурентный transfer создаёт двух project_admin (High, Confirmed).
4. AUD-014 — неограниченные AI/RAG входы: CPU/DB/response/cost amplification (High, Confirmed; cost-slope Probable).
5. AUD-042 — allowlist полей не обезличивает значения; нет prompt-границ (High, Confirmed).
6. AUD-043 — загруженные PDF/DOCX/XLSX/изображения не анализируются; LLM видит только имя (High, Confirmed).
7. AUD-046 — ClamAV без deadline; объект пишется до сканирования (High, Confirmed).
8. AUD-052 — production без offsite и канала уведомлений как валидное состояние (High, Confirmed).
9. AUD-001 — LLM-секрет в browser bundle + обход backend gateway (High, Confirmed; Critical при реально настроенном ключе).
10. AUD-003 — KT: failed-решение как accepted + фабрикация CP/требований (High, Confirmed; backend остаётся авторитетом, reload правит — operator-deception).

## 3. Карта системы

Browser → nginx `:443` → `frontend:3000` / `backend:8000` (×2 реплики). Frontend Next.js 16.3.0 + React 19 + NextAuth Credentials + next-intl; rewrites same-origin `/api/v1/*` → `API_URL_INTERNAL`. Backend FastAPI composition root `app/main.py`; 25 router-модулей, 111 маршрутов, префикс `/api/v1`. Auth JWT HS256 + refresh-family rotation; роль из актуального User. Primary (запись `get_db`) + опциональная Replica (чтение `get_read_db`). Files: private MinIO + сигнатурный MIME + ClamAV INSTREAM fail-closed. Realtime: Redis/SSE одноразовые tickets. Фон: in-process news scheduler с advisory lock; sidecars backup/WAL/offsite/alerts; Prometheus/Grafana. Критический путь: edge/auth → project lifecycle (assessment→draft→manager→publish→stages→promotion→audit) → public registry (consent→Replica→pagination) → files → AI (RAG/matching/stage-eval) → operations (backup/deploy/readiness/metrics/alerts).

## 4. Методика

Базой зафиксирован SHA/ветка/дата; `.env` не читались; только имена переменных и `.env.example`. Комментарий/ADR/README — заявление до подтверждения кодом/тестом/конфигом. Confirmed — прямая трасса к строкам + исполнимый/логически полный сценарий. Probable — сильное доказательство с недоступной внешней предпосылкой (нагрузка, browser timing, каноничность API, prod-ключ). Suspicious — сигнал для проверки. Live exploitation, рестарт `:3000/:8000`, `compose up/down`, миграции/seed на постоянной БД, deploy/publish, изменение зависимостей — запрещены и не выполнялись; недоступность сети/стенда — ограничение уверенности, не pass. Дедупликация по interfaces + concerns (детали в evidence/10): FE03-01/03/04/05/12 с IA; FE03-16 с IA-10 (FE03-07 отдельно); DB-05 с B02-004 (только unbounded-large); P08-03/04 с DB-14/DB-03 (отдельных AUD нет); P08-07 в B06-009; P08-06/08 как отдельные с зависимостью от T06; B06-010 отдельно от BTD07-01 (digest-prod vs lock-advisory); DB-09/13 склеены; DB-14 один текст; DB-02 split на 2; suites по ссылке.

## 5. Ограничения

Нет production-доступа/credentials/безопасного стенда: RPS/p95/RSS/CPU/pool-wait/FD/Redis-clients/EXPLAIN/lag/drain — не измерены, capacity tiers расчётные. Нет live LLM/MinIO/ClamAV/Redis/Telegram/offsite smoke. Нет browser E2E, ASGI smoke, nginx/alembic-syntax gates, clean-DB migration cycle. DB-зависимые pytest и downgrade/upgrade — BLOCKED отсутствием disposable harness (AUD-060, T04-blocker). FE03-14/15/19 и части DB-09/10/B06-009/05-05-cost — Probable/Suspicious по этой причине. Ruff FAIL (E501/B007) — тулинг, в находки не переносится.

## 6. Запуск (безопасная верификация)

По ссылке из evidence (не свежие прогоны таска 10): frontend `npm test` 182 passed (T03); `routes-matrix` 7/7, `matching` 7/7, `kt-panel` 8/8 (T01); RBAC/security focused 36/36 (T02, актуально, не BLOCKED); LLM gateway 7/7 + matching 7/7 (T05); offline 10/10 (T09); alerter 30 + collection 520 (только collect, T07); `npm run lint` PASS по ссылке; `npm run build` PASS только с CI env `API_URL_INTERNAL` по ссылке; `uv build` PASS по ссылке; `uv pip check` PASS по ссылке; `npm audit` FAIL 6 vulns по ссылке; `mypy` FAIL 2 errors по ссылке; `ruff` PASS по ссылке (T07) / FAIL 10 errors в узком DB-наборе (T04 — тулинг, не находка); `compose config --quiet` dev+prod PASS по ссылке; `alerter --self-check` PASS по ссылке; no-network alerter sequence CONFIRMED B06-006 по ссылке. В таске 10 свежие suite-прогоны не выполнялись; выполнена только валидация `AUDIT_FINDINGS.json` (`python3 -m json.tool`) и сверка ID/severity/confidence MD↔JSON (результат в evidence/10).

## 7. Домены 1–11 (сводка)

1. Карта/архитектура: ядро lifecycle/реестры/файлы/AI/operations связано; главные швы — browser-LLM обход (AUD-001), fake-proposal (AUD-002), KT-искажение (AUD-003), registry-курсор (AUD-004), template/filters/media/docs-drift/aggregates/canvas (AUD-005..010).
2. Воспроизводимость: locked-install/build/package по ссылке зелёные; mypy красный (AUD-059); Next advisory (AUD-058); harness разрушает общую БД (AUD-060); source-grep тесты (AUD-061); ASGI/nginx/alembic gaps — ограничение.
3. Backend/API/доступ: 111 маршрутов/25 роутеров; BOLA (AUD-011), transfer-race (AUD-012), notify-loss (AUD-013), unbounded RAG (в AUD-014), audit gaps (AUD-015), MinIO detail (AUD-016); mass-assignment/SQLi/SSRF/RCE не подтверждены.
4. Frontend: 44 pages + 3 layouts + 1 handler; UI-скрытие не авторитет; refresh-race (AUD-017), register-mismatch (AUD-018), executor-cap (AUD-019), stale-race (AUD-020), duplicates (AUD-021), tech-split Probable (AUD-022), team-errors (AUD-023), preview Probable (AUD-024), callback Suspicious (AUD-025), generation-UI (AUD-026), offline (AUD-027), session-race Probable (AUD-028).
5. Данные: 36 mapped-классов + 3 association + 35 линейных revisions; FK-конфликт (AUD-029), version-race/orphan split (AUD-030/031), N+1 Medium (AUD-032), unbounded-группа (AUD-033), upsert-дубли (AUD-034), 0031 loss/lock (AUD-035), 0012 no-downgrade (AUD-036), questionnaire-цепь склеена (AUD-037), 0037 checks (AUD-038), reindex-gap (AUD-039), schema-guard (AUD-040), long-tx один текст (AUD-041).
6. Security: см. §1 п.8; центральные: AUD-001/011/012/014/042/048/050/051/058.
7. Производительность/надёжность: tiers расчётные; ключи AUD-014/032/033/041/056/062/063/064/065/066.
8. AI: gateway default-off по ссылке; разрывы AUD-001/042/043/044/045/014/046/047; не-AI не падает при LLM-отказе (позитив в AUD-044).
9. Тесты: см. §1 п.9; missing — browser/auth/RBAC/E2E, migration clean-cycle, AI capture/cost/quota, file timeout/quarantine/lifecycle, proposal/generation/template/offline journeys.
10. Эксплуатация: AUD-048..057 + AUD-065/066; позитивы — exposure только nginx, rotation, secret-guards, migration/backup locks, logical+physical+WAL, `/health` vs `/ready`, JSON logs + request-id.
11. Бизнес-трассировка: B-01 ok-ядро/разрывы-обвязка; B-02 missing (в AUD-009); B-03 ok-read/display; B-04 ok-ядро/краевые утечки; B-05 ok-ядро/races; B-06 разрыв UI vs авторитет; B-07 частично; B-08 ok с оговоркой; B-09 статусы/курсор разрыв, executors частич., tech Probable, filters UI-only; B-10 поиск есть/медиация-граница разрыв; B-11 ok-ядро/точечные утечки. Новых ID от T09: 0.

## 8. Детальные записи AUD-001..AUD-066

### AUD-001 — Browser LLM обходит центр и публикует credential
- Категория: security/architecture. Severity: High. Confidence: Confirmed (Critical при реально настроенном публичном ключе в prod).
- Files: `technozrelost-frontend/.env.example:16-24`; `technozrelost-frontend/src/features/matching/llm.ts:43-65,147-176,236-255`; `technozrelost-frontend/src/features/matching/MatchingMode.tsx:259-273`; `technozrelost-backend/app/api/v1/match.py:20-29`; `technozrelost-frontend/src/middleware.ts:16-30`; `technozrelost-frontend/src/features/matching/sanitize.ts:59-108,135-153`.
- Evidence: `.env.example` предлагает `NEXT_PUBLIC_LLM_API_KEY`; client-модуль ставит его в browser `Authorization: Bearer` к внешнему URL после серверного `POST /match`; серверный gateway/semaphore/аудит не участвуют; `assertNoPii` ловит только email-подобные значения; CSP connect-src self+API_BASE блокирует чужой host (configured-feature недоступна).
- Reproduction (safe): прочитать строки; `git grep NEXT_PUBLIC_LLM_API_KEY`; сравнить post-`matchOrganizations` вызов с backend `/match`; сборку с секретом не выполнять.
- Impact: компрометация ключа/расходы, обход gateway-policy/аудита, двойной rerank, неконтролируемая передача ПДн.
- Remediation: удалить browser-LLM/публичные ключи; один backend rerank с server-side secret, policy/consent/rate-limit/audit + content-DLP.
- Tests: build-контракт отсутствия ключа/host в client chunks; phone/FIO/email rejection; same-origin контракт.
- Depends_on: AUD-042.

### AUD-002 — «Предложить через ЦНТР» сообщает успех без создания
- Категория: business completeness/data integrity. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/features/matching/MatchingMode.tsx:182-192`; `technozrelost-frontend/src/features/matching/MatchCard.tsx:72-85`; `technozrelost-backend/app/services/matching.py:3-11`.
- Evidence: handler только логирует ID + toast 3с, сети нет; `MatchRequest` отсутствует в ORM/схемах/API (только комментарий backend про MatchRequest→модерация→Notification).
- Reproduction: inspect handler; `git grep MatchRequest|match_requests` → empty.
- Impact: ложное подтверждение; нет durable request/модерации/аудита/уведомления.
- Remediation: persisted idempotent proposal aggregate + create/status API + транзакционная модерация/нотификация; успех только по 2xx.
- Tests: create→duplicate/retry→manager→notify journey; frontend asserts payload/error, не строки.
- Depends_on: нет.

### AUD-003 — KT: failed-решение показывается как accepted; CP фабрикуются под неверный UGT
- Категория: integrity/business workflow. Severity: High. Confidence: Confirmed (backend остаётся авторитетом; reload правит — operator-deception, не persisted-compromise).
- Files: `technozrelost-frontend/src/features/project/KtPanel.tsx:30-70,70-119,123-180,187-214,241-258,298-323`; `technozrelost-backend/app/api/v1/projects.py:656-703`; `technozrelost-backend/app/api/v1/stages.py:52-63,184-197`.
- Evidence: любой non-403 exception мутирует локальный CP в approved/rejected; добивка до 4 CP с client-IDs; `currentLevel` игнорируется; requirements `level=kt` с acknowledged non-1:1 «simplify»; кнопки по role-slug, backend требует assignment + запрет self-verify.
- Reproduction: isolated component test с reject без status; supply 1 CP + currentLevel=7 → 3 synthetic + levels 1..4.
- Impact: ложный Go/No-Go, решения по выдуманным доказательствам, неверный maturity-переход.
- Remediation: не коммитить decision при failed-write; distinct retry/pending; только server CP/stage; empty/error вместо моков.
- Tests: 404/409/500/network сохраняют prior status + alert; 7→8 fixture без synthetic IDs.
- Depends_on: нет.

### AUD-004 — Реестр: keyset-курсор ломается пересортировкой; фильтры теряют записи
- Категория: data correctness/search. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/app/api/v1/projects.py:228-280`; `technozrelost-frontend/src/features/registry/useRegistry.ts:13-22,72-111`; `technozrelost-frontend/src/lib/api-client.ts:109-132`.
- Evidence: backend order/cursor `(current_level,updated_at,id)`; client пересортировывает страницу по updated/created и берёт last-ID как курсор; backend не принимает status/search/region/tags; status фильтруется только внутри страницы 20.
- Reproduction: mixed-UGT страница → неверный курсор пропускает rows; search шлёт ignored query; status показывает empty при matches на later pages.
- Impact: неполные реестры/exports/technology discovery без индикации.
- Remediation: preserve backend order + opaque cursor; supported filters server-side.
- Tests: >20 mixed rows exact-once traversal + search/status/region semantics.
- Depends_on: AUD-033.

### AUD-005 — Template-download отсутствует; fallback клеит текст как PDF
- Категория: incomplete integration/document integrity. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/features/project/template.ts:1-15,46-90,105-120`; `technozrelost-backend/app/api/v1/rag.py:10-65`; `technozrelost-frontend/src/features/project/KtPanel.tsx:216-219`.
- Evidence: frontend `GET /templates/{id}`; backend только `/rag/templates` create/list; любой 404/500/network скачивает text-Blob с MIME `application/pdf` (первые байты не `%PDF-`).
- Reproduction: сравнить декораторы; mocked 404 → inspect Blob head ≠ `%PDF-`.
- Impact: core document action деградирован; неофициальные файлы при верификации.
- Remediation: один authenticated template-download API с bytes/content-disposition; убрать fake-PDF; failures видимы.
- Tests: `%PDF-`/headers; 404/503 без файла + error.
- Depends_on: нет.

### AUD-006 — Saved filters: server-persistence отсутствует; молчаливый localStorage
- Категория: incomplete integration/persistence. Severity: Medium. Confidence: Confirmed (намеренный localStorage оценивать отдельно от backend-gap).
- Files: `technozrelost-frontend/src/lib/api-client.ts:517-559`; `technozrelost-frontend/src/features/registry/saved-filters/storage.ts:1-63`; `technozrelost-frontend/src/features/registry/saved-filters/useSavedFilters.ts:75-179`.
- Evidence: `/filters/saved*` без backend route (negative grep empty); 404 → unbounded localStorage; quota swallow; BLOCKED-маркер в source.
- Reproduction: `git grep filters/saved` backend empty; mock 404 → local-only.
- Impact: нет cross-device, потеря при очистке, silent stop на quota; UI implies server durability.
- Remediation: user-owned CRUD с size/count limits либо explicit local-label; не глотать failures.
- Tests: ownership/isolation/limits; 404/quota error states.
- Depends_on: нет.

### AUD-007 — News media хранится по key, но delivery route отсутствует
- Категория: incomplete integration/content. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/app/api/v1/news.py:100-140,551-633`; `technozrelost-frontend/src/components/landing/news-card.tsx:7-20`; `technozrelost-frontend/src/components/dashboard/news-card.tsx:20-46`.
- Evidence: upload/delete + `storage_key`/`cover_key` в ответе, download route нет; обе карточки рендерят placeholders.
- Reproduction: enumerate news декораторы vs card implementation.
- Impact: storage тратится, показать cover/gallery нельзя.
- Remediation: authorized/public-by-publication delivery (или short-lived URLs) без raw keys.
- Tests: unpublished deny; published cover + MIME/cache; delete + render.
- Depends_on: AUD-047.

### AUD-008 — Root quick-start/status claims stale
- Категория: documentation/reproducibility. Severity: Low. Confidence: Confirmed (impact не преувеличивать — documentation drift).
- Files: `README.md:1-59`; `technozrelost-backend/alembic/versions/0037_status_checks.py:1-20`; `.github/workflows/ci.yml:53-107`.
- Evidence: README 22/22 snapshot + `head=0027` + 334/39 counts; текущий head 0037; CI gates иные.
- Reproduction: сравнить файлы.
- Impact: неверная ревизия миграций, доверие к старым counts.
- Remediation: revision-independent quick-start; убрать volatile counts или генерировать в release evidence.
- Tests: docs-контракт head/commands vs CI.
- Depends_on: нет.

### AUD-009 — Ряд заявленных capabilities без first-class persistence/API
- Категория: business completeness/extensibility. Severity: Medium. Confidence: Probable (отсутствие Confirmed; гипотеза «должны существовать» отделена и понижена).
- Files: `technozrelost-backend/app/schemas.py:75-123`; `technozrelost-backend/app/db/models.py:158-205,501-528,668-687`; `technozrelost-backend/app/services/matching.py:3-11`; `technozrelost-frontend/src/features/project/CanvasBlocks.tsx:69-154`.
- Evidence: нет Goal/Task/Result коллекций; competencies — JSONB `Organization.competencies`; MatchRequest только в комментарии; greps `goals|tasks|results|competencies|match_requests|canvas` пусты для ORM/router.
- Reproduction: inspect Project/Create контракты + ORM inventory + table greps.
- Impact: нельзя own/version/authorize/query/integrate; ad-hoc JSON создаст несовместимые контракты.
- Remediation: подтвердить границы с product owner; versioned DTO + normalized aggregates только для подтверждённых capabilities.
- Tests: lifecycle/authorization/audit + upgrade/downgrade + schema-compat на подтверждённое.
- Depends_on: нет.

### AUD-010 — Canvas «autosave» только browser-local; навигация не защищена
- Категория: persistence/navigation loss. Severity: Medium. Confidence: Confirmed (отдельно от AUD-009).
- Files: `technozrelost-frontend/src/features/project/ProjectCard.tsx:69-123`; `technozrelost-frontend/src/features/project/CanvasBlocks.tsx:69-172`; `technozrelost-frontend/src/features/project/ActionsPanel.tsx:153-167`; `technozrelost-frontend/src/features/project/useAutosave.ts:33-69`.
- Evidence: absent PATCH заменён localStorage + debug log при UI «saved»; `beforeunload` only, SPA route changes не observed; interval пересоздаётся на каждое value change.
- Reproduction: edit → «saved» → другой browser: пусто; internal nav до 30с без confirm.
- Impact: misleading durability, нет collaboration/audit, PII в script-readable storage бессрочно.
- Remediation: versioned canvas API + conflict handling; distinct local-draft vs saved; intercept internal nav; clear по commit/logout-policy.
- Tests: refresh/device reload; conflicting edits; route-leave confirm.
- Depends_on: AUD-009.

### AUD-011 — Pending join раскрывает закрытую карточку и договорные поля
- Категория: BOLA/information disclosure. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/app/api/v1/membership.py:40-62,136-191`; `technozrelost-backend/app/api/v1/projects.py:169-195`; `technozrelost-backend/app/schemas.py:77-100`.
- Evidence: join без HMAC создаёт `pending`, но возвращает полный `ProjectOut` incl. `budget/join_token/legal_owner/rights_holder/contract_*`; общий guard признаёт только `active`.
- Reproduction (safe): auth user `POST /projects/join` с `TZ-*` без `share_sig` → 200 содержит закрытые поля; тот же actor `GET /projects/{id}` → 404.
- Impact: утечка коммерческих/договорных атрибутов до модерации; нет rate-limit → перебор токена.
- Remediation: pending → минимальный DTO `{status,project_id,project_name}`; без capability/legal/budget; limiter user/IP/token.
- Tests: pending без token/budget/legal; pending detail 404; неверные токены → 429.
- Depends_on: нет.

### AUD-012 — Конкурентный transfer project_admin даёт двух админов
- Категория: authorization race/privilege integrity. Severity: High. Confidence: Confirmed (инвариант «не более одного», не «ровно один»).
- Files: `technozrelost-backend/app/api/v1/invites.py:66-87,236-258`; `technozrelost-backend/db/migrations/sql/0017_project_invites_admin.sql:5-7`.
- Evidence: read-modify-write без `FOR UPDATE`/conditional update/unique; только boolean.
- Reproduction: два параллельных `POST .../transfer-admin` на разных active members → оба 200, оба `is_project_admin=true`.
- Impact: размножение полномочий; последующий transfer неожиданно отзывает.
- Remediation: locked transfer в одной транзакции + partial unique `project_id WHERE is_project_admin`.
- Tests: concurrent transfers → один success/conflict + ровно один admin.
- Depends_on: нет.

### AUD-013 — Решение по draft теряет notification/outbox после 200
- Категория: transaction/background failure. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/app/api/v1/manager.py:115-177`; `technozrelost-backend/app/services/notifications.py:24-46`; `technozrelost-backend/app/core/database.py:51-54`.
- Evidence: `decide_draft` commit проект+audit (`:167`), затем `notify_user` только `flush` без commit; dependency закрывает сессию без commit → rollback.
- Reproduction: manager decide → 200; новая сессия: `draft.decided` в notifications/outbox отсутствует.
- Impact: владелец без решения; событие невосстановимо; изменение необратимо.
- Remediation: `notify_user` до единственного commit либо явный второй commit с компенсацией.
- Tests: approve/reject → notification+outbox из новой сессии.
- Depends_on: AUD-041.

### AUD-014 — Неограниченные AI/RAG входы: CPU/DB/response/cost amplification
- Категория: validation/resource exhaustion. Severity: High. Confidence: Confirmed (cost-часть Probable без нагрузки; только unbounded-large, неверный negative-LIMIT сценарий отброшен).
- Files: `technozrelost-backend/app/schemas.py:308-323,372-375`; `technozrelost-backend/app/api/v1/rag.py:36-64`; `technozrelost-backend/app/services/rag.py:115-212`; `technozrelost-backend/app/core/embeddings.py:196-261`; `technozrelost-backend/app/services/ai_assistant.py:76-103`; `technozrelost-backend/app/main.py:105-171`.
- Evidence: `query/raw_text/top_k/message/history` без length/range; `top_k` → `fetch_k=top_k*4` + полные `raw_text`; `GET /rag/templates` без pagination; 32MiB ограничивает request, не DB/response; `max_tokens=2000` только output; limiter process-local chat-only; `EMBEDDING_CONCURRENCY` только в example.
- Reproduction: auth `POST /rag/search` с huge `top_k`/multi-MB query → validation принимает до CPU/DB/provider work; нагрузку не выполнять.
- Impact: истощение CPU/RAM/DB/workers обычной учёткой; выгрузка corpus; рост provider input cost; multi-worker умножает limit.
- Remediation: `query` max-length, `top_k=Field(ge=1,le=N)`, bounded pagination + summary DTO без raw_text; shared Redis quotas; input-token budget/spend ceilings; bounded embedding pool; 429 handling.
- Tests: 422 boundaries; cap; bounded list page; quota/token-budget contracts.
- Depends_on: нет.

### AUD-015 — Критичные мутации без полного audit trail
- Категория: auditability/access governance. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/app/api/v1/projects.py:306-395`; `technozrelost-backend/app/api/v1/invites.py:90-113,221-282`; `technozrelost-backend/app/api/v1/profiles.py:294-345`; `technozrelost-backend/app/api/v1/news.py:425-633`.
- Evidence: publish/hide/archive/delete, invite create/revoke/transfer, legal-changes, profile/org moderation, все news mutations — commit без `AuditTrailEntry`; покрыты лишь project/user/control-point flows.
- Reproduction: transfer/legal-change → `GET /admin/audit?project_id=` без actor/diff/time.
- Impact: расследование privilege/contract/content incidents невозможно.
- Remediation: обязательная матрица events; audit в той же транзакции с actor/target/diff (без токенов).
- Tests: по одному contract-test на класс мутации + rollback atomicity.
- Depends_on: нет.

### AUD-016 — Ошибки MinIO раскрывают internal detail
- Категория: error handling/internal disclosure. Severity: Low. Confidence: Confirmed.
- Files: `technozrelost-backend/app/services/file_storage.py:95-122,226-244`; `technozrelost-backend/app/core/errors.py:144-147`.
- Evidence: `str(exc)` SDK дословно в `FileStorageError` → публичный `STORAGE_UNAVAILABLE.detail` (endpoint/bucket/сеть/SDK).
- Reproduction: synthetic SDK exception → 503 содержит исходный текст.
- Impact: разведка инфры; чувствительные части SDK-сообщений.
- Remediation: наружу стабильное общее message/code; полный exception только в server log + request ID.
- Tests: synthetic exception отсутствует в body, есть в log.
- Depends_on: нет.

### AUD-017 — Конкурентные Auth.js refreshes ревокуют новое семейство (logout)
- Категория: auth/reliability. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/auth.config.ts:21-22,61-102`; `technozrelost-backend/app/api/v1/auth.py:112-164`; `technozrelost-backend/app/core/config.py:63-64`.
- Evidence: нет single-flight; два callback шлют один refresh; backend допускает одного winner, второй — reuse → revoke family; frontend 55-мин константа vs configurable backend TTL.
- Reproduction: two-tab concurrent refresh → один 401 + revoke; winner недолговечен; cookie overwrite error-token.
- Impact: недетерминированный logout, обрыв drafts; окно 401 при коротком backend TTL.
- Remediation: serialize refresh по family / session-side owner; expiry из JWT `exp`.
- Tests: concurrent refresh → один shared success + валидное rotated family.
- Depends_on: нет.

### AUD-018 — Регистрация предлагает 3 роли, backend всегда 403
- Категория: RBAC/business flow. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/app/register/page.tsx:40-43,204-220`; `technozrelost-backend/app/core/deps.py:94-109`; `technozrelost-backend/app/api/v1/auth.py:44-60`.
- Evidence: frontend исключает только `cntr_*` → предлагает auditor/regulating_organization/investor; backend allowlist 4 базовые → privileged 403.
- Reproduction: выбрать auditor → заполнить → terminal 403 без onboarding-пути.
- Impact: гарантированный провал для advertised personas.
- Remediation: shared contract опций либо staff-mediated request workflow.
- Tests: UI-контракт каждого slug vs registration acceptance.
- Depends_on: нет.

### AUD-019 — Executor-каталоги не показывают beyond первые 20
- Категория: pagination/growth. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/app/dashboard/executors/page.tsx:146-207`; `technozrelost-backend/app/api/v1/executors.py:252-327`.
- Evidence: UI без limit/after_id/offset + client-slice + claim «backend возвращает все»; backend default 20 + keyset/offset; search/tags/region только по 20.
- Reproduction: 21 verified specialists → 21-й absent, «load more» нет.
- Impact: валидные исполнители undiscoverable при росте.
- Remediation: endpoint-specific server pagination/filters.
- Tests: 21+ rows оба tabs + match только после page one.
- Depends_on: AUD-033.

### AUD-020 — NIOKTR/org/executor поиски со stale-response race
- Категория: async state. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/app/dashboard/nioktr/page.tsx:131-178`; `technozrelost-frontend/src/app/dashboard/organizations/page.tsx:128-173`; `technozrelost-frontend/src/app/dashboard/executors/page.tsx:149-182`; `technozrelost-frontend/src/features/registry/useRegistry.ts:69-83,112-121`.
- Evidence: нет abort/generation (в отличие от shared project registry со stale-reject).
- Reproduction: A then B; B first, slow A overwrites при URL/input=B; realtime refresh аналогично.
- Impact: действия/экспорт по несоответствующим фильтрам.
- Remediation: AbortController / monotonic request IDs.
- Tests: B-before-A → только B.
- Depends_on: нет.

### AUD-021 — Profile/project-admin мутации без duplicate guard
- Категория: forms/idempotency. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/app/dashboard/profile/page.tsx:114-185,280-360`; `technozrelost-frontend/src/components/project-team-panel.tsx:132-220,276-366`.
- Evidence: нет pending-guard; buttons disable только по static validity; нет client idempotency key.
- Reproduction: double-click create org/invite на latency → два POST + два append.
- Impact: дубли orgs/invites, конфликтующие submit/save.
- Remediation: in-flight guard + disabled + server idempotency/uniqueness.
- Tests: delayed double-click → один request.
- Depends_on: нет.

### AUD-022 — Technology UI в обход Technology registry (split source of truth)
- Категория: business completeness. Severity: Medium. Confidence: Probable (до решения каноничности Project vs Technology).
- Files: `technozrelost-frontend/src/app/dashboard/technologies/page.tsx:25-45`; `technozrelost-backend/app/api/v1/technologies.py:13-88`; `technozrelost-backend/app/db/models.py:668-686`.
- Evidence: UI намеренно Projects UGT≥7; backend отдельный paginated/filterable Technology ORM/endpoint.
- Reproduction: Technology row без published Project → API возвращает, UI никогда; high-UGT project labeled technology без регистрации.
- Impact: две несовместимые truth; неверный discovery.
- Remediation: выбрать канон, migrate/join, UI↔canon equality.
- Tests: UI IDs/count/filters == canonical endpoint.
- Depends_on: нет.

### AUD-023 — Team-панель схлопывает 403/404/500 в пусто/скрытие
- Категория: error/empty state. Severity: Low. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/components/project-team-panel.tsx:94-129,224-229`.
- Evidence: только `.ok` check + always clear error; 403/404/500 не throw; network → whole panel null.
- Reproduction: invites 500 + detail 200 → empty invites + editable legal вместо partial failure.
- Impact: неразличимы no-data/no-permission/failure.
- Remediation: classify per-response; hide только explicit 403/404; partial + retry.
- Tests: split-response combos.
- Depends_on: нет.

### AUD-024 — News editor preview рендерит unsanitized draft HTML
- Категория: XSS/content safety. Severity: Low. Confidence: Probable (stored санитизируется; CSP блокирует inline/event, но future CSP/browser reopen).
- Files: `technozrelost-frontend/src/components/dashboard/news-editor.tsx:580-605`; `technozrelost-backend/app/api/v1/news.py:375-445`; `technozrelost-backend/app/services/html_sanitizer.py:20-74`.
- Evidence: raw textarea → `dangerouslySetInnerHTML`; stored/public чистится allowlist `html_sanitizer`.
- Reproduction: staff paste attacker HTML → preview в privileged DOM.
- Impact: defense-in-depth gap staff-only; stored public XSS не найден.
- Remediation: тот же allowlist перед preview (лучше server preview).
- Tests: event handlers/unsafe schemes/iframe/object/malformed.
- Depends_on: нет.

### AUD-025 — Login потребляет невалидированный navigation target
- Категория: navigation security. Severity: Low. Confidence: Suspicious (требует browser-подтверждения Next/browser/CSP handling).
- Files: `technozrelost-frontend/src/app/login/page.tsx:17-42`; `technozrelost-frontend/src/middleware.ts:82-88`.
- Evidence: arbitrary `callbackUrl` → `router.push` после login; middleware values safe paths, attacker URLs не constrained; regression test нет.
- Reproduction (browser): `/login?callbackUrl=<external-or-script>` → зависит от Next/CSP (может block).
- Impact: potential open-redirect/phishing.
- Remediation: только normalized same-origin ` single-/`, reject `//`/schemes/controls.
- Tests: browser malicious callback values.
- Depends_on: нет.

### AUD-026 — Document generation backend-only, из UI недостижима
- Категория: business completeness. Severity: Medium. Confidence: Confirmed (distinct от AUD-005).
- Files: `technozrelost-backend/app/api/v1/generation.py:14-35`; `technozrelost-frontend/src/features/docs/AiDocConsultant.tsx:56-90`.
- Evidence: `POST /projects/{id}/generate/{doc_type}` есть; frontend grep `/generate/` empty; consultant только chat/RAG; panels только upload/download/rescan/verification-metadata.
- Reproduction: открыть все project/document surfaces — control генерации нет.
- Impact: UI→API→persistence/auth цепь неполна; server capability неиспользуема.
- Remediation: authorized generation action + pending/error/result + file linkage.
- Tests: каждый doc_type + denial/timeout/retry integration.
- Depends_on: AUD-047.

### AUD-027 — Offline queue ни к чему не подключена
- Категория: reliability/business completeness. Severity: Medium. Confidence: Confirmed (distinct; очереди unit 10/10 по ссылке, потребителей 0).
- Files: `technozrelost-frontend/src/features/offline/queue.ts:11-153,189-289`; `technozrelost-frontend/src/features/offline/useOfflineQueue.ts:102-109`; `technozrelost-frontend/src/components/providers.tsx:27-34`.
- Evidence: `enqueue(` только declaration/wrapper; providers монтируют только `OfflineBanner`.
- Reproduction: offline submit assessment/profile/project → raw fetch reject, queue length 0, reconnect нечего retry.
- Impact: advertised offline retry не защищает реальные действия.
- Remediation: idempotent mutation allowlist через queue-aware transport + user/resource identity.
- Tests: offline→reload→login→online one authorized replay, no cross-account replay.
- Depends_on: AUD-017.

### AUD-028 — Global refresh-error sign-out гонит modal сохранения drafts
- Категория: auth/navigation loss. Severity: Medium. Confidence: Probable (browser timing не исполнен).
- Files: `technozrelost-frontend/src/components/providers.tsx:10-22`; `technozrelost-frontend/src/app/dashboard/layout.tsx:118-125`; `technozrelost-frontend/src/features/notifications/SessionExpiredModal.tsx:41-95,187-205`.
- Evidence: root `SessionExpiryWatcher` сразу `signOut({callbackUrl:"/login"})`; dashboard modal обещает save-draft + defer до confirm; нет ordering contract; кроме canvas у форм нет draft hook.
- Reproduction: refresh-fail с dirty assessment/profile/news → watcher навигирует раньше save.
- Impact: «без потери draft» ненадёжно и покрывает только canvas.
- Remediation: один session-expiry owner; save registered drafts → explicit transition.
- Tests: browser refresh-failure с dirty forms.
- Depends_on: AUD-017, AUD-010.

### AUD-029 — `questionnaire_results.user_id` NOT NULL + ON DELETE SET NULL
- Категория: integrity/privacy lifecycle. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/app/db/models.py:218-245`; `technozrelost-backend/db/migrations/sql/0030_questionnaire_per_user.sql:5-25`; `technozrelost-backend/db/migrations/sql/0032_questionnaire_read_isolation.sql:8-20`.
- Evidence: FK `ON DELETE SET NULL` затем `NOT NULL`; ORM та же пара; DELETE user с анкетой → `NotNullViolation`.
- Reproduction: сопоставить SQL 0030:7 vs 0032:15; disposable: create user/project/result → delete user → NotNullViolation.
- Impact: удаление/анонимизация ПДн блокируется; retention/hard-delete не атомарен.
- Remediation: nullable+SET NULL либо NOT NULL+RESTRICT/CASCADE + явная анонимизация владельца.
- Tests: `pg_constraint`/`information_schema` contract + delete-user lifecycle.
- Depends_on: нет.

### AUD-030 — Параллельные загрузки получают одинаковую версию документа (race)
- Категория: concurrency/document integrity. Severity: High. Confidence: Confirmed (split часть A).
- Files: `technozrelost-backend/app/api/v1/files.py:55-62,85-109`; `technozrelost-backend/app/db/models.py:410-446`; `technozrelost-backend/db/migrations/sql/0018_file_storage.sql:27-32`.
- Evidence: `max(version)+1` отдельным SELECT без lock; индекс `(project_id,version)` неуникален, без `title`.
- Reproduction: barrier concurrent uploads после `_next_version` → обе N+1.
- Impact: неоднозначный immutable history/snapshot.
- Remediation: UNIQUE `(project_id,title,version)` + retry/locked counter.
- Tests: barrier concurrent upload.
- Depends_on: нет.

### AUD-031 — Orphan object при commit-fail после storage put
- Категория: storage lifecycle. Severity: Medium. Confidence: Confirmed (split часть B).
- Files: `technozrelost-backend/app/api/v1/files.py:85-109`; `technozrelost-backend/app/services/file_storage.py:356-393`.
- Evidence: объект во внешнее хранилище до DB commit; rollback без compensating delete.
- Reproduction: inject commit error после `store_project_file` → лишний storage key.
- Impact: расход storage, усложнение удаления ПДн.
- Remediation: compensating delete при rollback либо transactional upload state.
- Tests: commit-failure cleanup.
- Depends_on: AUD-030.

### AUD-032 — Менеджерская очередь: N+1 анкет без pagination
- Категория: query performance/reliability. Severity: Medium. Confidence: Confirmed (High→Medium по craft).
- Files: `technozrelost-backend/app/api/v1/manager.py:69-80,99-112`; `technozrelost-backend/db/migrations/sql/0004_projects_and_questionnaire.sql:77-83`.
- Evidence: все drafts + per-project `_draft_row` SELECT questionnaire; N drafts → N+1 + unbounded response.
- Reproduction: N=1000 → 1001 SELECT; query-counter linear.
- Impact: latency/pool линейно; один запрос держит worker/pool.
- Remediation: bounded keyset page + batch/selectin.
- Tests: query-count invariant + max-page.
- Depends_on: AUD-033.

### AUD-033 — Группа unbounded лент без order-index (групповая)
- Категория: query performance/availability. Severity: Medium. Confidence: Confirmed (группа; DB-04 не разбита на отдельные ID).
- Files: `technozrelost-backend/app/api/v1/projects.py:147-157,198-225`; `technozrelost-backend/app/api/v1/notifications.py:27-40`; `technozrelost-backend/app/api/v1/news.py:239-307`; `technozrelost-backend/app/services/rag.py:215-224`; `technozrelost-backend/db/migrations/sql/0010_new_core.sql:101-102`.
- Evidence: projects/notifications/own-admin news/RAG templates `.all()` без limit; notifications order `(created_at,id)` при индексе `(user_id,is_read)` → per-user sort; project listing + два IN-aggregate over full result.
- Reproduction: 100k rows EXPLAIN: cardinality=data; sort uncovered.
- Impact: memory/serialization/sort unbounded.
- Remediation: keyset pagination + predicate/order indexes, notably `(user_id,created_at DESC,id DESC)`.
- Tests: max-page + EXPLAIN fixture.
- Depends_on: нет.

### AUD-034 — RAG upsert допускает дубликаты при конкуренции + partial без вектора
- Категория: uniqueness/RAG integrity. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/app/services/rag.py:49-98`; `technozrelost-backend/app/db/models.py:472-498`; `technozrelost-backend/db/migrations/sql/0002_rag_documents.sql:6-25`.
- Evidence: dedup `(content_hash,doc_type,contour)` check-then-insert; только неуникальный hash index; первый commit до embedding → ошибка оставляет `embedding IS NULL`.
- Reproduction: concurrent `POST /rag/templates` same text/type/contour → две rows; monkeypatch embed после commit → NULL vector.
- Impact: duplicate retrieval, расход index/storage, неполные документы.
- Remediation: unique B-tree на 3 поля + single-transaction upsert либо processing state + retry.
- Tests: concurrent upsert + embedding-failure atomicity.
- Depends_on: нет.

### AUD-035 — Миграция 0031: безвозвратная замена дат на NULL + долгая блокировка
- Категория: migration data loss/locks. Severity: High. Confidence: Confirmed для loss; lock-duration Probable без volume-rehearsal (один ID).
- Files: `technozrelost-backend/db/migrations/sql/0031_perf_p14_created_date.sql:7-42`; `technozrelost-backend/alembic/versions/0031_perf_p14_created_date.py:28-40`; `technozrelost-backend/tests/test_migration_remediation.py:32-105`.
- Evidence: не-ISO/невалидные UPDATE→NULL без quarantine; downgrade не возвращает значения; PL/pgSQL row-by-row + `ALTER TYPE` rewrite + ACCESS EXCLUSIVE; индекс не CONCURRENTLY; существующий тест ожидает потерю 5 значений.
- Reproduction: snapshot non-null/raw до/после + lock wait (disposable; не запускалось на постоянной БД).
- Impact: потеря provenance НИОКТР-дат; deploy блокирует reads/writes.
- Remediation: quarantine original, set-based validated conversion, staged nullable/backfill, concurrent index, lock/timeout plan.
- Tests: preservation/quarantine + volume lock rehearsal.
- Depends_on: нет.

### AUD-036 — Data-fix 0012 с пустым downgrade
- Категория: migration reversibility. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/db/migrations/sql/0012_fix_gost_mojibake.sql:10-32`; `technozrelost-backend/alembic/versions/0012_fix_gost_mojibake.py:26-35`.
- Evidence: upgrade перезаписывает `title/source_uri` сотен строк; downgrade `pass`.
- Reproduction: diff: pre-upgrade значение невыводимо из post.
- Impact: rollback не возвращает data contract; forensic origin потерян.
- Remediation: backup mapping/audit либо forward-only + preflight backup/rollback procedure.
- Tests: round-trip fixture или irreversible-migration gate.
- Depends_on: нет.

### AUD-037 — Questionnaire upgrade/downgrade цепь 0030/0032 (склеена)
- Категория: migration backward compatibility/downgrade. Severity: High. Confidence: Probable для upgrade-block (нужен disposable); downgrade-loss Confirmed (один склеенный ID из DB-09/DB-13).
- Files: `technozrelost-backend/alembic/versions/0030_questionnaire_per_user.py:39-46`; `technozrelost-backend/alembic/versions/0032_questionnaire_read_isolation.py:40-44`; `technozrelost-backend/db/migrations/sql/0030_questionnaire_per_user.sql:9-25`; `technozrelost-backend/db/migrations/sql/0032_questionnaire_read_isolation.sql:8-15`; `technozrelost-backend/app/db/models.py:188-190`.
- Evidence: `projects.created_by` nullable → backfill NULL → 0032 `SET NOT NULL` падает на legacy; downgrade 0032 удаляет 0030-owned indexes (0031 degraded); downgrade 0030 удаляет `user_id` → restore UNIQUE `(project,level)` падает при multi-user rows.
- Reproduction: disposable 0031 + project(created_by=NULL)+result(user NULL) → upgrade 0032 NotNullViolation; head + 2 users same project/level → downgrade 0029 UniqueViolation + missing indexes на 0031.
- Impact: deploy/rollback останавливаются посередине; per-user данные несохранимы.
- Remediation: preflight/count + sentinel/owner policy перед NOT NULL; 0032 не удалять 0030-indexes; 0030 downgrade — lossy merge/archive либо non-reversible.
- Tests: nullable-owner upgrade fixture + multi-user round-trip + per-revision schema assertions.
- Depends_on: AUD-029.

### AUD-038 — 0037 CHECK-валидация больших таблиц без preflight/NOT VALID
- Категория: migration reliability/locks. Severity: Medium. Confidence: Probable (нужен disposable + prod-inventory).
- Files: `technozrelost-backend/db/migrations/sql/0037_status_checks.sql:12-37`; `technozrelost-backend/alembic/versions/0037_status_checks.py:30-35`.
- Evidence: 4 `ADD CONSTRAINT CHECK` подряд со scan + lock; legacy `unknown` валит head; нет preflight/cleanup/`NOT VALID`+validate.
- Reproduction: disposable 0036 + legacy status → head CheckViolation; объёмная копия → lock/scans.
- Impact: surprise deploy failure / долгая блокировка hot writes.
- Remediation: preflight invalid + mapping; `NOT VALID` + controlled `VALIDATE` с lock timeout.
- Tests: legacy-status upgrade + lock-budget rehearsal.
- Depends_on: нет.

### AUD-039 — Head semantic-v2 без переиндексации сохранённых векторов
- Категория: vector data compatibility. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/alembic/versions/0036_semantic_embeddings_reindex.py:7-49`; `technozrelost-backend/db/migrations/sql/0036_semantic_embeddings_reindex.sql:1-19`; `technozrelost-backend/app/services/rag.py:167-211`.
- Evidence: только COMMENT + старые indexes; пересчёт в ручном script без вызова из migration/deploy/CI (repo-wide grep empty); после head старые vectors прежней модели + новые v2 в одном KNN-пространстве.
- Reproduction: snapshot old embedding → upgrade 0036 → bytes unchanged; new doc → mixed retrieval.
- Impact: недостоверный ranking/RAG после штатного deploy до ручного reindex.
- Remediation: model-version в строке; dual-index/backfill + cutover; resumable reindex + readiness gate.
- Tests: old/new model fixture + post-head version invariant.
- Depends_on: нет.

### AUD-040 — Test-schema guard объявлен, но не используется
- Категория: schema isolation/test safety. Severity: Medium. Confidence: Confirmed (High→Medium по craft).
- Files: `technozrelost-backend/app/core/config.py:33-34`; `technozrelost-backend/app/db/models.py:35-67`; `technozrelost-backend/alembic/env.py:28-48`; `technozrelost-backend/tests/conftest.py:48-107`.
- Evidence: `db_schema_public/db_schema_test` только declaration; metadata/SQL жёстко `public`; fixture мигрирует/TRUNCATE `public`; `schema_translate_map` нет; изоляция только именем DB.
- Reproduction: grep настроек → только declaration; `metadata.schema` == `public` при любом env.
- Impact: ошибочный test DSN применяет migrations/TRUNCATE к `public` выбранной БД.
- Remediation: fail-closed test DSN/guard + реальное schema mapping/test schema.
- Tests: test-env metadata/search_path assertion + refusal on non-test DB.
- Depends_on: AUD-060.

### AUD-041 — Внешняя оценка/скан внутри транзакции после flush (один текст)
- Категория: long transaction/lock contention. Severity: High. Confidence: Confirmed (склеены stage/file/fan-out + P08-03 scheduler fan-out; один канонический текст).
- Files: `technozrelost-backend/app/api/v1/stages.py:212-379`; `technozrelost-backend/app/api/v1/files.py:78-109`; `technozrelost-backend/app/services/notifications.py:105-154`; `technozrelost-backend/app/services/news_scheduler.py:20-51`; `technozrelost-backend/app/main.py:67-89`.
- Evidence: stage INSERT/flush PromotionRequest → await `_evaluate` → commit; file access-SELECT → body/storage/ClamAV → commit; news fan-out все active IDs + per-user Notification/Outbox в одной транзакции; scheduler tick `fetchall()` due без limit + per-post broadcast + advisory lock/connection.
- Reproduction: barrier `_evaluate`/scanner + competing UPDATE → blocked writer до release; 100 posts×10k users → расчётно 1M+1M rows в одной tx.
- Impact: LLM/AV latency занимает pool, lock waits, pool exhaustion; WAL/rollback burst, пропуск ticks.
- Remediation: закрыть read-tx до external I/O; pending job/outbox + async evaluate + short conditional commit; claim batches + bulk insert + per-batch commit + queue/backpressure.
- Tests: tx-duration/competing-writer; bounded fan-out batches; interruption/resume idempotency.
- Depends_on: нет.

### AUD-042 — Value-level DLP и prompt-границы отсутствуют
- Категория: security/PII/prompt injection. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/app/core/config.py:71-79`; `technozrelost-backend/app/schemas.py:372-398`; `technozrelost-backend/app/services/ai_assistant.py:56-180`; `technozrelost-backend/app/services/matching.py:199-235`; `technozrelost-frontend/src/features/matching/sanitize.ts:59-153`.
- Evidence: gateway дословно шлёт `ChatIn.message`, до 1500 символов RAG, matching title/annotation/region/competencies; нет consent/классификации/redaction/provider-allowlist; user query вне untrusted boundary; matching без delimiters.
- Reproduction: capture-stub `ask_llm`/`fetch` + маркер `ФИО+телефон+игнорируй правила` в message/title/annotation → capture дословно; реальному провайдеру не отправлять.
- Impact: вывод ПДн/закрытых описаний; injection управляет ответом/объяснениями; flag-off закрывает контур только пока выключен.
- Remediation: server-only egress policy + consent/purpose + DLP/redaction + RAG-классификация/tenant-labels + allowlist + delimiters; deny confidential classes.
- Tests: capture PII/secret/delimiter-breakout; consent-denied; confidential never egresses.
- Depends_on: AUD-001.

### AUD-043 — Бинарное тело документов не читается; оценка по имени
- Категория: business completeness/document AI. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/app/api/v1/stages.py:131-172,412-456`; `technozrelost-backend/app/services/file_storage.py:133-393`; `technozrelost-backend/app/db/seed_gost.py:70-113`; `technozrelost-backend/app/schemas.py:488-498`.
- Evidence: upload хранит bytes, `ProjectDocument.file_url=None`; `_evaluate` evidence `title+str(file_url)`; runtime PDF/table/OCR нет; PyMuPDF только offline seed text-layer; XLSX/scans/images unsupported; 20k chars только отдельный text-path.
- Reproduction: два PDF same title opposite body + stub `ask_llm` → captured prompt identical без body; scanned PDF без OCR-пути.
- Impact: analysis/checking не различает valid/empty/contradictory; LLM `pending_manager` по titles; manager-review смягчает, не снимает.
- Remediation: quarantined extraction (PDF/OOXML/XLSX/OCR/provenance/limits) + `unreadable`; evaluation только по verified content.
- Tests: same-title/opposite-body; scanned/OCR/XLSX/corrupt/encrypted/zip-bomb; extractor-down → degraded, не evaluate.
- Depends_on: AUD-047.

### AUD-044 — `AI_APICallError` → None → 200 как обычный успех
- Категория: reliability/API contract/observability. Severity: Medium. Confidence: Confirmed (не-AI не падает — позитив).
- Files: `technozrelost-backend/app/services/ai_assistant.py:56-196`; `technozrelost-backend/app/schemas.py:382-384`; `technozrelost-backend/app/api/v1/chat.py:29-49`; `technozrelost-backend/tests/test_ai_assistant.py:68-78`; `technozrelost-frontend/src/app/dashboard/ai-assistant/page.tsx:78-97`.
- Evidence: non-200/timeout/malformed/connection/any-exception (вкл. upstream класс) → None; в production кода класса нет; `/chat` 200 тот же `ChatOut` без `mode/degraded/error_code`; frontend показывает fallback как answer; counters process-local без correlation.
- Reproduction: monkeypatch `httpx.AsyncClient.post` ConnectError/timeout/503/invalid JSON → каждый 200 без degradation.
- Impact: неотличимость модели от fallback; неверный retry/escalate; ложный успех.
- Remediation: typed provider result/error mapping + `mode/degraded/error_code`/versions/correlation без prompt content.
- Tests: connect/timeout/401/429/5xx/schema assertions + degraded UI; не-AI доступен.
- Depends_on: нет.

### AUD-045 — Свободный текст модели как валидный rerank/explanation
- Категория: AI correctness/hallucination/repeatability. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/app/services/matching.py:110-276`; `technozrelost-frontend/src/features/matching/llm.ts:186-337`; `technozrelost-frontend/src/features/matching/MatchingMode.tsx:259-273`.
- Evidence: backend `method="llm"` при любом non-empty до parsing; invalid ranking сохраняет order, но подменяет reasons; frontend второй LLM не парсит IDs (5 строк по позиции); нет JSON schema/ID-binding/grounding/calibration/citation; `temperature=0.3`, mutable env; versions/seed не возвращаются/хранятся.
- Reproduction: stub `Ignore candidates / fabricated claim` → `method=llm` + fabricated reason без order/source proof.
- Impact: ложная объяснимость, несогласованные два прохода, невоспроизводимость/аудит невозможен.
- Remediation: один backend rerank; strict JSON `{candidate_id,rank,reason,evidence}` + unique-ID validation + grounding + deterministic config + persisted versions; invalid → script reasons/method.
- Tests: malformed/duplicate/unknown/partial IDs; reordered; hallucinated field; repeatability; one-call invariant.
- Depends_on: AUD-001.

### AUD-046 — ClamAV без deadline; put до scan
- Категория: file security/availability/lifecycle. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/app/services/file_storage.py:178-393`; `technozrelost-backend/app/api/v1/files.py:70-110`; `technozrelost-backend/app/api/v1/stages.py:412-448`.
- Evidence: `open_connection/drain/read`/total без timeout; upload MinIO `put` → await scan → commit metadata; clamd-hang держит request + in-memory file; disconnect/cancel/DB-fail → object без row; sync `put` в async endpoint; download fail-closed только для ingestion не помогает; quarantine wording без separate namespace/bucket.
- Reproduction: fake clamd accept-no-reply + harness timeout → не завершается сам; DB-fail после stub put → no remove.
- Impact: workers/memory consumption; orphan/quarantine bytes; provider outage = upload outage.
- Remediation: connect/write/read/total deadlines + cancellation-safe close; scan-before-promotion (temp quarantine key); async path; compensation delete; background scanner + dead-letter опционально.
- Tests: hanging/partial/oversized replies; cancel; DB-failure cleanup; unavailable/infected lifecycle; concurrent uploads.
- Depends_on: AUD-041.

### AUD-047 — File validation/lifecycle неполны при хороших ACL/download-guard
- Категория: file security/retention. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/app/services/file_storage.py:30-316`; `technozrelost-backend/app/api/v1/files.py:91-181`; `technozrelost-backend/app/api/v1/requests.py:225-290`; `technozrelost-backend/app/db/models.py:410-446`.
- Evidence: PDF/PNG/JPEG только magic, не structure; OOXML central names без entry/compression/encrypted limits; `file_name`/`title` unbounded → VARCHAR(255) после put → overlength orphan; infected/error latest indefinite; cleanup только non-latest; нет project-file delete/cascade hook; versioning best-effort без retention/expiry. Позитивы: UUID keys (no traversal), ACL first, keys не exposed, download fail-closed non-clean.
- Reproduction: >255 filename/title после stub put → DB reject + orphan; `%PDF-` garbage принят.
- Impact: exhaustion, невозможность deletion/retention, retained infected/confidential bytes, misleading MIME.
- Remediation: lengths до put; bounded structural checks; compensation/outbox; explicit delete/retention (latest/infected/orphan/versions); reconciliation + metrics.
- Tests: overlong zero-objects; malformed/polyglot/bomb; delete/project-delete; infected TTL; purge; ACL/IDOR regressions.
- Depends_on: AUD-031.

### AUD-048 — Dev Compose публикует хранилища со слабыми defaults
- Категория: internal exposure/insecure defaults. Severity: Medium. Confidence: Confirmed (Medium dev-only по craft, не High).
- Files: `technozrelost-backend/infra/docker-compose.yml:8-113`.
- Evidence: PG Primary/Replica, MinIO API/console, Redis, ClamAV short-form `HOST:CONTAINER` (0.0.0.0); PG/replication/MinIO `change_me` defaults; Redis без auth.
- Reproduction: `compose config` published ports; сосед в LAN → `<ip>:6379/9000/5432` с known default; live не выполнялось.
- Impact: чтение/изменение dev-данных/Redis/SSE/rate-limit/файлов; опасно с копией prod ПДн.
- Remediation: bind `127.0.0.1`; не публиковать ClamAV/Redis; случайные local creds / opt-in insecure profile.
- Tests: resolved dev Compose `host_ip=127.0.0.1`; negative `change_me` при external bind.
- Depends_on: нет.

### AUD-049 — Автоматический rollback оставляет новую схему
- Категория: deployment/rollback integrity. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/infra/backend-entrypoint.sh:84-125`; `technozrelost-backend/infra/deploy.sh:320-396`; `technozrelost-backend/infra/README-DEPLOY.md:141-149`.
- Evidence: каждая replica `alembic upgrade head` до Uvicorn; `automatic_rollback` только `compose up -d --no-build` старых images; revision/downgrade/restore нет; runbook требует separate restore/PITR для breaking schema.
- Reproduction: release rename/drop + startup defect → migration pass, health-fail, old image vs new contract.
- Impact: rollback сообщает ошибку/не возвращает сервис; RTO зависит от ручного DR.
- Remediation: только expand/contract + окно совместимости; one-shot migrator перед replicas; store old/new revision; запретить auto-rollback при incompatible либо autocompensation.
- Tests: shell harness fake compose + revision; old-image contract после upgrade.
- Depends_on: AUD-037.

### AUD-050 — Публичный backend совмещает runtime с root и backup/offsite полномочиями
- Категория: container privilege/blast radius. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/Dockerfile:14-57`; `technozrelost-backend/infra/docker-compose.prod.yml:206-289`; `technozrelost-frontend/Dockerfile:24-34`.
- Evidence: нет `USER`/`user`/`cap_drop`/`no-new-privileges`/read-only rootfs; backend replica получает DB/MinIO-root/replication/Redis/rclone env + RW `backups-prod-data`; миграции/backup тем же image.
- Reproduction: RCE в HTTP/parser → root, чтение creds/rclone, изменение backups, admin Primary/MinIO.
- Impact: compromise app → все данные + recovery plane; удаление копий перед порчей.
- Remediation: non-root UID/GID, `cap_drop:[ALL]`, `no-new-privileges`, read-only+tmpfs; one-shot migrator/backup identities; убрать REPLICATION/rclone/backups-RW; scoped MinIO account.
- Tests: image UID≠0; resolved Compose policy; negative backup/replication creds + RW mount.
- Depends_on: нет.

### AUD-051 — Сегментация допускает lateral movement edge→data plane
- Категория: network isolation. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/infra/docker-compose.prod.yml:64-605`.
- Evidence: DB/MinIO/Redis/ClamAV в `tz-app-db`; туда же nginx+frontend; нет `internal:true`; `tz-edge` не boundary.
- Reproduction: RCE frontend/nginx → scan `db:5432/redis:6379/minio:9000/clamav:3310` не блокируется.
- Impact: расширенный blast radius; атаки на внутренние protocols (host ports закрыты корректно).
- Remediation: proxy network nginx↔frontend/backend; backend-only internal deps; monitoring-only net; не подключать edge к DB/storage net.
- Tests: adjacency matrix запрещает edge→DB/Redis/MinIO/ClamAV.
- Depends_on: нет.

### AUD-052 — Deploy без offsite и уведомлений как валидное состояние
- Категория: disaster recovery/production guard. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/infra/docker-compose.prod.yml:241-436`; `technozrelost-backend/infra/deploy.sh:186-205`; `technozrelost-backend/infra/cron/wal-offsite-sync.sh:94-104`; `technozrelost-backend/infra/.env.production.example:77-109`.
- Evidence: example `BACKUP_OFFSITE_REMOTE`/`TELEGRAM_*` empty; preflight не требует; WAL sidecar success+warning при absent; health/deploy-gate pass; volumes на одном host/domain.
- Reproduction: shipped example + required passwords + empty 3 vars → resolved valid; потеря host уничтожает Primary/MinIO/WAL/snapshots.
- Impact: accepted unrecoverable loss + silent operator; противоречит zero-loss/RPO.
- Remediation: `PRODUCTION_STRICT_DR=1` default (crypt remote + notifier), fail deploy до write/read probe artifact; local backup/WAL на отдельном device.
- Tests: strict preflight reject; external smoke upload/download/verify + restore drill artifacts.
- Depends_on: AUD-053.

### AUD-053 — Неудачная Telegram-эскалация critical не повторяется
- Категория: alert delivery reliability. Severity: High. Confidence: Confirmed (executable no-network sequence).
- Files: `technozrelost-backend/infra/alerter/alerter.py:680-731`; `technozrelost-backend/infra/alerter/test_alerter.py:456-476`.
- Evidence: warning sent → critical send-fail ветка сохраняет `notification_sent=True` + severity=critical; следующий identical critical не escalation → event None; тест только success-case.
- Reproduction: `warning(send=True)→critical(send=False)→critical(send=True)` → third `event=None`.
- Impact: единственный critical об outage теряется до recovery/new severity.
- Remediation: обновлять sent/severity только после delivery; pending severity + bounded retry + attempts/timestamps.
- Tests: failed warning→critical retry до success; restart pending resume; rate bound.
- Depends_on: нет.

### AUD-054 — Health-gate принимает self-signed TLS
- Категория: transport security/deploy guard. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/infra/deploy.sh:260-400`; `technozrelost-backend/infra/nginx/nginx.prod.conf:70-78`; `technozrelost-backend/infra/README-DEPLOY.md:231-238`.
- Evidence: отсутствие certs → генерация self-signed RSA; readiness `curl -k` без trust/hostname/expiry; deploy warning, но release pass; nginx HSTS одновременно.
- Reproduction: чистый server без certs → CN `technozrelost`, health pass via `-k`, browser interstitial.
- Impact: небезопасный transport как production-ready; привычка bypass → MITM; HSTS осложняет recovery.
- Remediation: self-signed только explicit staging flag; preflight SAN/chain/expiry/key-perms; readiness без `-k`.
- Tests: clean prod без trusted cert fails; wrong SAN/expiry fails.
- Depends_on: нет.

### AUD-055 — Restore оставляет БД и MinIO в разных состояниях
- Категория: restore atomicity/recovery correctness. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/infra/restore.sh:147-262`.
- Evidence: полный `pg_restore` затем MinIO; Python fallback сначала delete all target objects, затем по одному; нет staging/rollback/partial-marker.
- Reproduction: valid snapshot → pg success → MinIO обрыв 2-го object → DB restored, bucket partial/wiped; повтор требует DB re-wipe.
- Impact: аварийная процедура создаёт inconsistent deployment; нет safe resume.
- Remediation: staging targets + counts/checksums + cutover либо idempotent resume/compensation + partial marker.
- Tests: fault на N-м object → live target unchanged; resume success.
- Depends_on: AUD-052.

### AUD-056 — Resource budget отсутствует у большинства prod-сервисов + SPOF
- Категория: infra/capacity. Severity: Medium. Confidence: Probable (расчётный, без load-стенда; включает P08-07).
- Files: `technozrelost-backend/infra/docker-compose.prod.yml:25-605`; `technozrelost-frontend/Dockerfile:12-34`; `technozrelost-backend/infra/nginx/nginx.prod.conf:159-175`.
- Evidence: limits только ClamAV 4GiB/2CPU + 2 backend ×2GiB/1CPU (уже 8GiB из minimum 12GiB); DB/MinIO/Redis/frontend/nginx/sidecars/Prom/Grafana без limits/reservations/pids; frontend heap только build; нет worker_connections/ulimits/Redis maxmemory/eviction/maxclients/stop_grace; SSE до 3600с; frontend/nginx/Redis/MinIO/DB-role singletons.
- Reproduction (расчёт): Prometheus/SSR/MinIO I/O/runaway → host OOM выбирает DB/backend/alerter; 5k/10k sockets без FD budget; RPS/p95 не приписываются.
- Impact: host-wide outage, нет admission/capacity contract.
- Remediation: измерить RSS/CPU/I/O; limits+reservations+pids; budget ≤ host с OS reserve; HA/load-balancing либо RTO/RPO.
- Tests: budget checker; load/soak + OOM/fill-disk drills.
- Depends_on: нет.

### AUD-057 — Supply-chain/CI не доказывают immutable prod artifact
- Категория: CI/CD/version pinning/parity. Severity: Medium. Confidence: Confirmed (отдельно от AUD-058: digest-prod vs lock-advisory).
- Files: `technozrelost-backend/Dockerfile:2-30`; `technozrelost-frontend/Dockerfile:2-24`; `technozrelost-backend/infra/docker-compose.prod.yml:26-544`; `.github/workflows/ci.yml:13-107`.
- Evidence: app/DB/Redis/nginx/Prom/Grafana mutable tags без digest (только MinIO/ClamAV pinned); apt at-build; actions major tags; runner `ubuntu-latest`; CI Python 3.11 vs image 3.12; только backend image build; нет resolved prod Compose/`nginx -t`/frontend-image/scan/SBOM/signing/deploy-contract/publish-digest.
- Reproduction: rebuild same SHA после upstream move → layers differ; frontend/nginx-only regression merges зелёным.
- Impact: local SHA tag ≠ immutable bytes; prod-only failures в manual deploy.
- Remediation: digest-pin bases/services/actions; Renovate/Dependabot; build both images + scan/SBOM/sign + publish digest + Compose/nginx gates; promote same digest; Python 3.12 matrix.
- Tests: CI policy rejects unpinned + asserts image/config/scanner gates; provenance per release.
- Depends_on: AUD-058.

### AUD-058 — Locked frontend с reachable unauthenticated RCE advisory
- Категория: supply chain. Severity: Critical. Confidence: Confirmed (reachable: default `/_next/image` через nginx, AVIF-часть применима; Windows-часть неприменима).
- Files: `technozrelost-frontend/package.json:12-21`; `technozrelost-frontend/package-lock.json:6846-6874`.
- Evidence: lock Next 16.3.0; `npm audit --audit-level=high` относит `16.0.0–16.3.2` к critical GHSA-p293-qw3h-jr36 + GHSA-2xp9-vwfh-vxw4 (unauth RCE incl. Image Optimization/AVIF); также high `browserslist/sharp`, moderate `baseline-browser-mapping/uuid` (`npm ls` chains по ссылке).
- Reproduction (safe): `npm ci && npm audit --audit-level=high`; без `npm audit fix`.
- Impact: remote unauth атака на image path; transitives DoS/crash/image-parsing.
- Remediation: обновить Next/transitives до fixed, пересобрать lock, повторить audit/build/tests + malicious-AVIF regression.
- Tests: audit clean; build/tests green; AVIF regression.
- Depends_on: AUD-057.

### AUD-059 — Обязательный backend mypy gate красный на CI Python
- Категория: build/CI. Severity: High. Confidence: Confirmed (gate блокирует релиз).
- Files: `technozrelost-backend/app/api/v1/realtime.py:102-113`; `technozrelost-backend/app/main.py:305-307`; `.github/workflows/ci.yml:53-69`.
- Evidence: `uv sync --python 3.11 --extra dev --locked; uv run mypy app` → exit 1: untyped Redis `from_url` + incompatible validation handler signature; 61 files checked по ссылке.
- Reproduction: exact CI Python команда выше.
- Impact: required CI не зелёный независимо от runtime tests; типовые регрессии не фильтруются.
- Remediation: типизировать Redis factory; adapt/annotate handler к Starlette protocol; regression на 3.11+3.12.
- Tests: exact CI mypy green.
- Depends_on: нет.

### AUD-060 — Pytest harness разрушает разделяемую test DB
- Категория: test isolation/data safety. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/tests/conftest.py:11-106`; `technozrelost-backend/tests/test_migration_remediation.py:13-115`.
- Evidence: константное имя, ambient host/creds, всегда `public`; session `upgrade head`; function TRUNCATE 34+ tables `RESTART IDENTITY CASCADE`; migration test downgrade/upgrade той же БД.
- Reproduction: два параллельных suite → data loss/races/deadlocks/false results.
- Impact: потеря test data; ложные результаты; риск remote test-named DB.
- Remediation: unique disposable DB/schema per run/worker + denylist remote + ownership marker + teardown; параллельный suite без пересечений.
- Tests: parallel suites isolation.
- Depends_on: AUD-040.

### AUD-061 — Большинство frontend «behavior/WCAG» проверок — source-grep
- Категория: test quality. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-frontend/package.json:5-10`; `technozrelost-frontend/tests/wcag.test.mjs:1-183`; `technozrelost-frontend/tests/matching.test.mjs:41-131`; `technozrelost-frontend/tests/routes-matrix.test.mjs:73-92`.
- Evidence: script только `node --test`; ≥21/27 читают source via `readFileSync`; WCAG «static axe» без DOM/axe (`axe 0` claim); PII snapshot без вызова sanitizer; Playwright не direct dep; 0 skips.
- Reproduction: `npm ls @playwright/test --depth=0` empty; inspect suites.
- Impact: 182/182 завышают сигнал; broken flows/render/hydration/keyboard/contrast/redirects/payload-leak проходят.
- Remediation: component/browser tests + real axe/keyboard; E2E login/refresh/RBAC/forms/registry/offline/contract; source checks только narrow invariants.
- Tests: render/axe/keyboard/E2E suites.
- Depends_on: нет.

### AUD-062 — File paths блокируют event loop, держат объекты в RAM, без e2e timeout
- Категория: performance/resilience. Severity: High. Confidence: Confirmed.
- Files: `technozrelost-backend/app/api/v1/files.py:70-163`; `technozrelost-backend/app/api/v1/stages.py:390-431`; `technozrelost-backend/app/services/file_storage.py:184-275,376-464`; `technozrelost-backend/app/core/database.py:51-54`.
- Evidence: upload читает целиком + sync `store_project_file` из async (async wrapper существует, не используется); MinIO `put_object` sync; ClamAV без timeout; download целиком bytes; DB dependency весь request.
- Reproduction: trace `POST /files` при slow MinIO/ClamAV → worker event-loop stall; N×25MiB пересекают 2GiB (нижняя граница chunks+join; peak выше).
- Impact: process-wide latency, OOM/restart, удержание DB session, потеря половины backend при одном slow dependency.
- Remediation: streaming multipart→quarantine→ClamAV с bounded spool; `StreamingResponse`; async/thread wrapper + bounded executor/semaphore; deadlines; освободить DB-tx до I/O.
- Tests: concurrency с slow storage + fast `/health`; 25MiB RSS/timeout; streaming download.
- Depends_on: AUD-041, AUD-046.

### AUD-063 — Realtime создаёт Redis client/pool на вызов; SSE client не закрывается
- Категория: Redis/SSE/leak. Severity: High. Confidence: Confirmed (leak Confirmed; slope-экспонента без soak Probable-нотация в evidence, здесь leak фиксирован).
- Files: `technozrelost-backend/app/api/v1/realtime.py:39-139,156-254`; `technozrelost-backend/app/main.py:92-102`.
- Evidence: `_get_redis_async()` каждый раз `from_url`; ticket store/consume/publish/stream каждый новый; stream закрывает pubsub, не `rclient`; lifespan отменяет только scheduler; комментарий про кэш пула не реализован shared объектом.
- Reproduction: 10k connect/disconnect без `aclose()` → pools/sockets рост до GC; 10k active = 10k pubsubs; Redis-error → per-process fallback split-brain (ticket A ≠ B, события теряются).
- Impact: Redis/FD exhaustion, RSS slope; realtime деградирует независимо на репликах.
- Remediation: один lifecycle-managed client/pool per process + `aclose`; bounded pool/metrics; при configured Redis fail-closed вместо split-brain.
- Tests: fake `from_url/aclose` count; two-replica loss contract; 10k soak FD/RSS.
- Depends_on: нет.

### AUD-064 — Prometheus scrape перечисляет весь MinIO bucket каждые 15с
- Категория: observability/self-load. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-backend/app/api/v1/metrics.py:78-96`; `technozrelost-backend/app/services/file_storage.py:297-305`; `technozrelost-backend/infra/prometheus/prometheus.yml:11-22`.
- Evidence: каждый `/metrics` → `storage.object_count` → recursive `list_objects`; scrape обеих реплик каждые 15с → 2× listing; timeout вокруг `to_thread` нет.
- Reproduction: при M objects monitoring O(2M/15s); hung SDK → worker thread; pending накапливаются, усиливая outage.
- Impact: растущая scrape-стоимость, threadpool starvation, нет метрик в инцидент.
- Remediation: DB/counter metric или медленный cached collector; bounded timeout + stale/unknown; не дублировать global gauge per replica.
- Tests: call ≤ cache TTL; timeout bounded; cost ≠ M.
- Depends_on: нет.

### AUD-065 — Readiness связывает весь edge со всеми зависимостями и может висеть
- Категория: failure domains/readiness. Severity: Medium. Confidence: Confirmed (зависимость от T06 prod-policy).
- Files: `technozrelost-backend/app/api/v1/health.py:41-107`; `technozrelost-backend/infra/docker-compose.prod.yml:250-503`; `technozrelost-backend/app/services/file_storage.py:288-295`.
- Evidence: sequential DBs/Redis/storage/ClamAV; любая Replica/Redis/MinIO/ClamAV → 503; storage health без app-timeout; Compose healthcheck 5с, frontend/nginx ждут healthy backend; runtime-эвикции unhealthy из nginx нет.
- Reproduction: отказ ClamAV/Replica при живом Primary CRUD → обе replicas not-ready → блокировка старта/recovery; edge продолжает слать на unhealthy; slow MinIO занимает probe дольше timeout без cancel sync I/O.
- Impact: локальный file/read outage блокирует deploy/recovery всего edge; readiness не различает обязательное/деградируемое.
- Remediation: parallel bounded probes; readiness только core-контракт; component health/feature gates + fallback reads; orchestrator routing вместо startup-only depends_on.
- Tests: fault-matrix с ожидаемыми маршрутами; hung probe < healthcheck timeout.
- Depends_on: AUD-052.

### AUD-066 — Timeout/cancellation/shutdown без сквозного контракта
- Категория: timeout/retry/shutdown. Severity: Medium. Confidence: Confirmed.
- Files: `technozrelost-frontend/src/lib/api-client.ts:48-57`; `technozrelost-frontend/src/auth.config.ts:37-101`; `technozrelost-backend/infra/nginx/nginx.prod.conf:128-157`; `technozrelost-backend/app/core/database.py:21-32`; `technozrelost-backend/app/main.py:92-102`; `technozrelost-backend/infra/backend-entrypoint.sh:134-135`.
- Evidence: browser 5с vs nginx 120с vs DB default (только size/overflow) vs ClamAV/file overall none; NextAuth login/refresh без timeout; lifespan не закрывает engines/Redis/storage; uvicorn без graceful timeout; Compose без `stop_grace_period`.
- Reproduction: client abandon 5с при upstream/DB дольше → duplicate/in-flight; deploy с long SSE/file/scheduler без max drain.
- Impact: queues после timeout, nondeterministic deploy, interrupted writes.
- Remediation: propagated deadline/cancellation per route-class; DB statement/pool timeouts < edge; idempotency keys; explicit shutdown order/budgets (stop accept→drain→cancel→close).
- Tests: disconnect cancel до DB/storage mock; no duplicate после retry; SIGTERM harness в budget.
- Depends_on: AUD-065.

## 9. Сводные таблицы и списки

### 9.1 Полная таблица (66)

| ID | Название | Severity | Confidence |
|---|---|---|---|
| AUD-001 | Browser LLM обход + credential | High | Confirmed |
| AUD-002 | Proposal false-success | High | Confirmed |
| AUD-003 | KT false/fabricted | High | Confirmed |
| AUD-004 | Registry cursor/filter | Medium | Confirmed |
| AUD-005 | Template absent + fake PDF | Medium | Confirmed |
| AUD-006 | Saved filters local-only | Medium | Confirmed |
| AUD-007 | News media no delivery | Medium | Confirmed |
| AUD-008 | Docs drift | Low | Confirmed |
| AUD-009 | Missing aggregates | Medium | Probable |
| AUD-010 | Canvas local-only | Medium | Confirmed |
| AUD-011 | Pending join leak | High | Confirmed |
| AUD-012 | Transfer race | High | Confirmed |
| AUD-013 | Draft notify loss | Medium | Confirmed |
| AUD-014 | AI/RAG unbounded | High | Confirmed |
| AUD-015 | Audit gaps | Medium | Confirmed |
| AUD-016 | MinIO detail leak | Low | Confirmed |
| AUD-017 | Refresh race | High | Confirmed |
| AUD-018 | Register mismatch | Medium | Confirmed |
| AUD-019 | Executor 20 cap | Medium | Confirmed |
| AUD-020 | Stale race | Medium | Confirmed |
| AUD-021 | Duplicate submit | Medium | Confirmed |
| AUD-022 | Tech split | Medium | Probable |
| AUD-023 | Team errors collapse | Low | Confirmed |
| AUD-024 | News preview HTML | Low | Probable |
| AUD-025 | Login callback | Low | Suspicious |
| AUD-026 | Generation UI-less | Medium | Confirmed |
| AUD-027 | Offline disconnected | Medium | Confirmed |
| AUD-028 | Session race | Medium | Probable |
| AUD-029 | Questionnaire FK | High | Confirmed |
| AUD-030 | Version race | High | Confirmed |
| AUD-031 | Orphan object | Medium | Confirmed |
| AUD-032 | Manager N+1 | Medium | Confirmed |
| AUD-033 | Unbounded feeds | Medium | Confirmed |
| AUD-034 | RAG upsert dup | Medium | Confirmed |
| AUD-035 | 0031 loss/lock | High | Confirmed |
| AUD-036 | 0012 no-downgrade | Medium | Confirmed |
| AUD-037 | Questionnaire chain 0030/32 | High | Probable |
| AUD-038 | 0037 checks | Medium | Probable |
| AUD-039 | Semantic reindex gap | High | Confirmed |
| AUD-040 | Schema guard gap | Medium | Confirmed |
| AUD-041 | Long-tx single | High | Confirmed |
| AUD-042 | DLP/boundary | High | Confirmed |
| AUD-043 | Binary-blind eval | High | Confirmed |
| AUD-044 | Degraded 200 | Medium | Confirmed |
| AUD-045 | Rerank hallucination | Medium | Confirmed |
| AUD-046 | ClamAV no deadline | High | Confirmed |
| AUD-047 | File validation/lifecycle | Medium | Confirmed |
| AUD-048 | Dev expose | Medium | Confirmed |
| AUD-049 | Rollback schema | High | Confirmed |
| AUD-050 | Root+backup powers | High | Confirmed |
| AUD-051 | Segmentation | Medium | Confirmed |
| AUD-052 | No offsite/notify | High | Confirmed |
| AUD-053 | Alerter no-retry | High | Confirmed |
| AUD-054 | Self-signed gate | High | Confirmed |
| AUD-055 | Restore non-atomic | Medium | Confirmed |
| AUD-056 | Resource budget/SPOF | Medium | Probable |
| AUD-057 | Supply-chain parity | Medium | Confirmed |
| AUD-058 | Next RCE reachable | Critical | Confirmed |
| AUD-059 | Mypy red | High | Confirmed |
| AUD-060 | Harness destructive | High | Confirmed |
| AUD-061 | Source-grep tests | Medium | Confirmed |
| AUD-062 | File event-loop/RAM | High | Confirmed |
| AUD-063 | Redis leak | High | Confirmed |
| AUD-064 | Metrics listing | Medium | Confirmed |
| AUD-065 | Readiness coupling | Medium | Confirmed |
| AUD-066 | Timeout/shutdown | Medium | Confirmed |

### 9.2 Confirmed (58)
AUD-001..008, AUD-010..021, AUD-023, AUD-026/027, AUD-029..036, AUD-039..055, AUD-057..066.

### 9.3 Potential — Probable/Suspicious (8: Probable 7 + Suspicious 1)
Probable (7): AUD-009 (гипотеза необходимости), AUD-022 (канон), AUD-024 (preview exploitability), AUD-028 (timing), AUD-037 (upgrade-блок; downgrade-часть Confirmed внутри ID), AUD-038, AUD-056. Плюс Probable-части внутри Confirmed-ID: AUD-014-cost, AUD-035-lock. Suspicious (1): AUD-025.

### 9.4 Missing tests
RBAC/browser-E2E/component-render/axe/keyboard/hydration/mobile; composed browser→API retry journeys; proposal/generation/template/offline journeys; AI capture-PII/delimiter/429/schema/cost/multi-worker quota; file timeout/quarantine/lifecycle/malformed/purge; migration clean base→head/head→base→head + per-revision data-safety + lock-budget; concurrent transfer/upload/upsert/refresh/session races; registry exact-once/cursor/filter/pagination at volume; notification retention/`after_id`; metrics cache/timeout; readiness fault-matrix; SIGTERM drain; restore resume; offsite/Telegram smoke; AVIF regression; mypy regression 3.11+3.12; image/config/scanner gates + provenance. Coverage-процент не заявляется (tool/gate отсутствует).

### 9.5 Архитектурные риски
Двойной LLM-ранг и два парсера (AUD-001/045); frontend-синтез успеха/данных при отказе зависимостей vs backend fail-closed (AUD-002/003/005/006); две org-агрегации без sync (AUD-009-часть); Alembic+SQL companions + `target_metadata=None` drift (долг); fetch напрямую мимо `api-client` (долг); grep-маркеры в проде (долг); transaction до external I/O (AUD-041); per-process limiters/queues/fallback split-brain (AUD-014/063); unbounded reads/fan-out (AUD-032/033/041); edge→data flat network (AUD-051); singletons + нет budgets (AUD-056).

### 9.6 Security-риски
AUD-001, 011, 012, 014, 016, 017, 018, 022-канон, 024, 025, 042, 046, 047, 048, 050, 051, 052-оповещение, 054, 058. Акторы/сценарии — в детальных записях; секретов в отчёте ноль.

### 9.7 Performance-риски
AUD-004, 014, 019, 020, 032, 033, 041, 056, 062, 063, 064, 065, 066. Tiers 100/500/1000/5000/10000 — только расчётные (см. §5 evidence/08 по ссылке): 100 — pool-wait + upload RAM; 500 — CPU/queues + AI 8/overflow-fallback; 1000 — single frontend/nginx + FD/SSE cardinality; 5000 — leak/fan-out/SPOF; 10000 — топология без запаса. Измерения BLOCKED.

### 9.8 Незавершённые функции
AUD-002, 003 (частично), 005, 006, 007, 009, 010, 022, 026, 027, 043, 044-контракт, 045-качество. Маркеры: UI-only (proposal/canvas-durability/template-blob/saved-persistence/tech-канон), API-only (`/generate`, `/technologies`), schema-only (competencies JSONB, MatchRequest комментарий, canvas без таблицы), testless (Goal/Task/Result, proposal journey, template `%PDF-`, saved cross-device, generation-UI, offline replay).

### 9.9 Приоритетный remediation plan
P0 (блокеры prod): AUD-058 → 057 → 059 → 011 → 012 → 014-bounds/quotas → 001 → 042 → 046 → 052+053 → 049 → 050 → 054 → 035-quarantine → 039-version-gate → 063 → 062-streaming.
P1 (до MVP): AUD-002/003/004/005/006/009-канон/010/013/015/017/026/027/028/029/030/032/033-bounds/041-phase1/043-pipeline/044-contract/045-single-rerank/019/020/040/060-harness/061-real-tests/065-core-readiness.
P2 (закалка/долг): AUD-007/008/016/021/022-канон/023/024/025/031-purge/034-unique/036-forward-only/037-merge-policy/038-NOT-VALID/047-retention/048-localhost/051-segment/055-staging-restore/056-budgets/064-cache/066-deadlines.
Каждый пункт — с тестами из детальных записей; после — §9.10.

### 9.10 Recheck commands (только безопасные; секретов нет)
```
git diff --check
git rev-parse HEAD
cd technozrelost-backend && uv run ruff check app tests infra/alerter scripts/udgu_ingest
cd technozrelost-backend && uv run mypy app
cd technozrelost-backend && uv run pytest tests/test_rbac_projects.py tests/test_privileged_roles.py tests/test_upload_hardening.py tests/test_refresh_atomic.py tests/test_invite_race.py tests/test_sse_ticket.py -q
cd technozrelost-backend && uv run pytest tests/test_llm_gateway.py -q
cd technozrelost-backend && uv run pytest infra/alerter/test_alerter.py -q
cd technozrelost-frontend && npm test
cd technozrelost-frontend && npm run lint
API_URL_INTERNAL=http://backend:8000 npm run build
docker compose --env-file infra/.env.production.example -f infra/docker-compose.prod.yml config --quiet
docker compose -f infra/docker-compose.yml config --quiet
python3 -m json.tool AUDIT_FINDINGS.json > /dev/null
```
State-changing (compose up/down, миграции/seed на постоянной БД, load/prod smoke, external delivery) — не запускать без отдельной команды и disposable стенда.
