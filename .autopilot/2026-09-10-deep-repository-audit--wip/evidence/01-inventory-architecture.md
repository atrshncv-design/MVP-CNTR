# Evidence 01: инвентаризация и архитектура

## База и метод

- Проверенный checkout: ветка `audit/deep-repository-20260910`, commit
  `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, commit time
  `2026-09-09T11:26:34+04:00`; команды `git branch --show-current`,
  `git show -s --format='%H %cI' HEAD`.
- На старте worktree не был чистым: изменены `.autopilot/README.md`,
  `.autopilot/dashboard.html`, `.autopilot/state.js`; присутствовали untracked audit-каталоги.
  Они не анализировались как продуктовые изменения и не изменялись этим аудитом.
- `git ls-files` показывает 1048 tracked-файлов: 292 backend, 348 frontend, 93 `docs`,
  238 `.autopilot`, 40 материалов интервью, 9 дорожной карты, 7 `.graphify`, 3 `reports`,
  1 CI workflow и корневые служебные документы. Generated/secret-bearing содержимое не
  открывалось; категории `.env*`, сертификаты, `.venv`, caches, `node_modules`, `.next`,
  build/output, logs и scratch перечислены правилами исключения `.gitignore:6-54`.
- Версии и topology выведены из текущих manifests/config/code, не из прежних аудитов.
  Исторические `.autopilot`, `docs/remediation*`, `reports` использованы только как категории
  checkout. Значения credentials и `.env` не читались.

## Карта checkout

| Зона | Фактическое назначение и доказательство |
|---|---|
| `technozrelost-backend/app` | FastAPI composition root `app/main.py:281-342`; 26 подключённых router-объектов `app/main.py:309-334`; HTTP middleware для body limit, security headers, metrics, request-id и exception handling `app/main.py:105-278`. |
| `technozrelost-backend/app/api/v1` | 26 tracked Python-файлов, включая `__init__.py`: auth/users/profiles, projects/assessments/stages/requests/invites/membership, registries, files, news/achievements, notifications/SSE/tasks, matching/chat/RAG/generation, admin/manager, probes/metrics. Публичный префикс `/api/v1` задаётся в `app/main.py:309-334`. |
| `technozrelost-backend/app/services` | Доменные сервисы readiness, matching, RAG/AI, generation/PDF, files/scan, achievements, notifications, scheduler and metrics; in-process news scheduler запускается lifespan-ом `app/main.py:67-102`. |
| `technozrelost-backend/app/db` | Один declarative ORM-модуль с 36 mapped-классами от Role до ProjectAchievement (`app/db/models.py:73-1087`) плюс seed/reset/prepare utilities. Основные агрегаты: User/RBAC, Project/Assessment/Stage/Promotion, files/audit, RAG, organizations/technologies/NIIOKTR, news, achievements. |
| `technozrelost-backend/alembic` | 35 tracked revision-файлов; текущая голова `0037`, линейно от `0036_semantic` (`alembic/versions/0037_status_checks.py:1-20`). Alembic использует sync psycopg против Primary, runtime использует asyncpg (`alembic/env.py:1-23`). |
| `technozrelost-backend/db/migrations` | SQL companions/logging для части Alembic revisions; например `0037` загружает SQL по filesystem path (`alembic/versions/0037_status_checks.py:23-34`). Это второй слой миграционных артефактов, который должен оставаться согласованным с revisions. |
| `technozrelost-backend/data`, `scripts`, `app/db/seed_*` | ГОСТ/НИОКТР/template seed-data, reindex/import/security/load/UDGU tooling. Эти команды потенциально меняют DB и в read-only аудите не запускались. |
| `technozrelost-backend/tests` | 79 `test_*.py`; pytest настроен на `tests`, asyncio auto (`pyproject.toml:69-72`). CI отдельно включает `infra/alerter/test_alerter.py` (`.github/workflows/ci.yml:66-79`). |
| `technozrelost-backend/infra` | Development and production Compose, nginx, PostgreSQL replication/PITR, backup/restore/offsite timer, Redis, MinIO, ClamAV, Prometheus/Grafana and Telegram alerter. Production declares 13 services at `infra/docker-compose.prod.yml:25-543`. |
| `technozrelost-frontend/src/app` | Next.js App Router: 44 tracked `page.tsx`, root/dashboard/landing layouts, one NextAuth route handler. Dashboard, landing, auth, join and assessment are separate route groups; route guard is middleware `src/middleware.ts:44-114`. |
| `technozrelost-frontend/src/features`, `components`, `lib` | Feature modules for project/KT/docs, registry/offline/matching/analytics/notifications, shared API/types/roles/i18n. Same-origin client API and server internal API are centralised by `next.config.ts:4-19,57-76`. |
| `technozrelost-frontend/tests` | 26 `node:test` files selected by glob (`package.json:5-10`); no declared Playwright/Cypress/JSDOM/testing-library runner (`package.json:12-36`). Many tests read source and regex-match markers, e.g. `tests/routes-matrix.test.mjs:10-19,73-92` and `tests/matching.test.mjs:26-89`. |
| `.github/workflows/ci.yml` | Two jobs: Python 3.11 + Postgres 16/pgvector + Redis, dependency audit/ruff/mypy/pytest/image/readiness (`.github/workflows/ci.yml:11-79`); Node 22 + npm audit/lint/test/build (`.github/workflows/ci.yml:81-107`). No browser E2E or composed frontend-to-backend journey. |
| `docs`, interviews, roadmap, reports | Product/operations design, ADR, SOPS/DR, backlogs and historical evidence. They are claims until traced to code/config. Browser matrix explicitly leaves six desktop/mobile families pending (`technozrelost-frontend/docs/browser-matrix.md:7-21`). |
| `.autopilot`, `.graphify` | Agent planning/history and generated repository graph. They dominate metadata volume but are not production runtime. |

## Technology and entry points

- Backend package requires Python `>=3.11`, FastAPI 0.139.2, SQLAlchemy 2.0.51,
  asyncpg/psycopg, Alembic, pgvector, Redis, MinIO, ClamAV client and report/data tooling
  (`technozrelost-backend/pyproject.toml:1-50`). CI uses Python 3.11
  (`.github/workflows/ci.yml:53-69`), while both production image stages use Python 3.12
  (`technozrelost-backend/Dockerfile:1-14`); compatibility therefore spans two minors.
- Runtime backend entry is `app.main:app` (`app/main.py:342-354`); container entry performs
  operational startup/migrations and then starts one worker (`Dockerfile:38-57`). Scaling is two
  containers, not multiple workers (`infra/docker-compose.prod.yml:186-205`).
- Frontend uses Next `^16.3.0`, React 19.2.4, NextAuth beta, next-intl, Tailwind 4 and TypeScript 5
  (`technozrelost-frontend/package.json:12-31`); production/CI runtime is Node 22
  (`technozrelost-frontend/Dockerfile:1-24`, `.github/workflows/ci.yml:92-99`). Entrypoints are
  App Router plus `src/app/api/auth/[...nextauth]/route.ts`; production starts `next start`
  (`technozrelost-frontend/Dockerfile:24-34`).
- Browser -> nginx TLS -> frontend or `/api/v1` backend is explicit in nginx
  (`infra/nginx/nginx.prod.conf:70-85,128-194`). Frontend rewrites same-origin `/api/v1/*` to
  `API_URL_INTERNAL` (`technozrelost-frontend/next.config.ts:57-71`).
- NextAuth Credentials sends login/refresh to FastAPI and stores access/refresh tokens in its JWT
  (`technozrelost-frontend/src/auth.config.ts:24-119`). Frontend route authorization is a fail-closed
  role matrix (`src/middleware.ts:82-104`, `src/lib/roles.ts:75-215`); backend remains the
  authoritative resource/RBAC boundary (`app/core/deps.py:20-113`).
- Runtime DB has async Primary and optional Replica engines (`app/core/database.py:35-65`). Read
  routes use `ReadDBSession`, including project registry `app/api/v1/projects.py:228-240`, NIIOKTR
  `app/api/v1/nioktr.py:12-18`, executor registries and public news; writes use `DBSession`.
- Files flow via private MinIO plus signature validation and ClamAV; readiness covers DB, Redis,
  storage and scanner and returns 503 on unavailable dependency (`app/api/v1/health.py:20-107`).
- Realtime uses Redis/SSE tickets; nginx strips query from SSE logs and disables buffering
  (`infra/nginx/nginx.prod.conf:38-47,159-176`). Redis is production-required to avoid per-replica
  fallback (`app/core/config.py:101-133`).
- Background/operations: an in-process singleton news scheduler uses PostgreSQL advisory lock
  (`app/main.py:67-102`); production sidecars handle backup, WAL offsite and alerts
  (`infra/docker-compose.prod.yml:292-446`); Prometheus/Grafana are separate services
  (`infra/docker-compose.prod.yml:514-566`).

## Critical path and critical zones

1. Edge/auth: nginx -> Next middleware/NextAuth -> FastAPI JWT/RBAC. A drift among
   `src/lib/roles.ts`, backend role slugs, NextAuth session claims and endpoint dependencies can
   either block a role or expose a resource.
2. Project lifecycle: assessment creates draft -> manager decision -> owner publication -> stage
   requirements/documents -> optional LLM pre-evaluation -> promotion decision -> audit trail.
   Persistence is distributed across Project, Assessment, ControlPoint, ProjectDocument,
   PromotionRequest and audit/outbox entities (`app/db/models.py:158-449,531-666`).
3. Public registry/read scaling: publication consent -> Replica reads -> keyset/offset pagination ->
   landing/dashboard consumers. Privacy and stale-replica behaviour meet at this boundary.
4. Files: bounded upload -> signature validation -> private object storage -> fail-closed scan -> DB
   reference -> authorized download. MinIO and ClamAV are hard readiness dependencies in prod.
5. AI: RAG/matching/stage evaluation -> optional external gateway. There are currently two matching
   gateway implementations, one server-side and one browser-side; candidate IA-01.
6. Operations: Primary/Replica/WAL/MinIO/Redis volumes -> backup/offsite -> deploy/migration lock ->
   readiness/metrics/alerts. Static contracts exist, but live restore, offsite and multi-browser
   claims cannot be confirmed in this read-only checkout.

## Business trace matrix

| Capability | UI/docs -> API -> ORM/DB -> authorization -> test | Verdict |
|---|---|---|
| Project lifecycle | Questionnaire/project routes; `/assessments`, `/projects`, manager queues, stages; Project/Assessment/ControlPoint/PromotionRequest; resource membership/staff checks; backend journey/project/manager/stage tests. Representative code `app/db/models.py:158-449,583-612`, `app/api/v1/projects.py:198-351`, `app/api/v1/stages.py:184-197,383-550`. | Implemented core; KT UI divergence in IA-03/04. |
| Goals, tasks, business results | Project create/output contract contains name, description, category, levels, budget and questionnaire only (`app/schemas.py:77-116`); Project ORM has the same bounded aggregate (`app/db/models.py:158-205`). No Goal/Task/Result entity, schema or route was found under `app`. | Missing as first-class lifecycle capabilities; IA-10. |
| Achievements | Dashboard components -> `/achievements` and project achievements -> Achievement/UserAchievement/ProjectAchievement (`app/db/models.py:981-1087`) -> authenticated/optional publication rules -> dedicated backend tests. | Implemented. |
| Publication/moderation/confidentiality | UI project cards/manager queues -> publish and manager endpoints -> `Project.status/is_public/show_preliminary` -> owner/project-admin/staff checks (`app/api/v1/projects.py:306-351`) -> publication/privacy/RBAC tests. | Implemented project publication; external production privacy not exercised here. |
| Teams/organizations | Team/profile/org UI -> membership/invites/profiles -> ProjectMember/Invite and separate source/user organization tables (`app/db/models.py:329-380,501-528,689-770`) -> project/admin checks -> invite/join/profile tests. | Implemented, but two organization aggregates require deliberate synchronization. |
| TRL/readiness | Assessment wizard and project stage panels -> `/assessments`, stage/project APIs -> template/checkpoint/answer/stage entities -> project/staff checks -> official/full UGT/readiness tests. | Server core implemented; frontend KT simplification is not authoritative, IA-03/04. |
| Documents/generation/check | File/doc panels -> project files, verification docs, stage docs and `/generate/{doc_type}` -> ProjectDocument/VerificationDocument/RAG templates -> project checks -> file/scan/generation tests. Generation exposes `tz/passport/teo` (`app/api/v1/generation.py:14-39`). | Partial: downloadable template seam absent and fallback is not a PDF, IA-05. |
| Registries | Landing/dashboard -> project/NIIOKTR/org/executor/technology APIs -> Project, NioktrCard, Organization, Technology, profiles -> public/optional/auth rules -> registry tests. | Partial: standalone competency registry absent; status pagination broken, IA-06; saved filters local-only, IA-07. |
| Matching/recommendations | Matching UI -> `POST /match` -> Organization retrieval -> authenticated user -> matching backend/frontend tests. Backend says mediated proposal should create MatchRequest and Notification (`app/services/matching.py:1-11`). | Search/ranking exists; mediated recommendation workflow is fake success, IA-02; browser duplicates gateway, IA-01. |
| News/media | Public/dashboard news UI -> CRUD/schedule/media upload/delete -> NewsPost/Media -> author/staff rules -> backend/news source tests. | Text lifecycle implemented; stored media cannot be rendered/downloaded, IA-08. |

## Deep-state coverage and test gaps

- First checkout: root quick start still directs migration to obsolete `head=0027`; IA-09. После
  выполненного таском 07 locked install оба ранее заблокированных frontend-теста импортируют
  `next-intl` и проходят; результаты приведены в разделе verification.
- Empty data: most list APIs and frontend empty states are represented; matching deliberately returns
  fallback candidates if the filtered query is empty (`app/services/matching.py:142-179`), which needs
  product-level validation because zero semantic matches are not distinguishable from weak matches.
- Invalid/boundary input: backend has Pydantic bounds and upload limits, but frontend tests largely
  inspect source markers instead of mounting forms. There is no browser submission coverage.
- Dependency failure: backend readiness is fail-closed (`app/api/v1/health.py:86-107`), while several
  frontend domains silently synthesize data or success (IA-02/03/04/05/07). These inconsistent failure
  semantics are the principal architectural risk.
- Interruption/retry: refresh rotation, invite races, offline queue, scheduler lock and outbox have
  focused backend/source tests. No composed browser-to-API test proves retry does not duplicate a
  project, document or proposal.
- Growth: project registry has keyset pagination, technologies/organizations use offset, executor list
  has cursors. Client-side status filtering after page fetch breaks global semantics (IA-06); saved
  filters are explicitly unbounded localStorage (`src/features/registry/saved-filters/storage.ts:39-63`).
- Roles/organizations: backend has resource-scoped tests and frontend route matrix, but the route matrix
  test validates source/matrix shape, not a real NextAuth request (`tests/routes-matrix.test.mjs:50-92`).
- Consequences/reversibility: audit trail, version snapshots and backups exist. Live PITR/offsite and
  migration downgrade were not run because they require stateful infrastructure; browser matrix marks
  Firefox/Safari/Edge/Yandex/mobile pending (`technozrelost-frontend/docs/browser-matrix.md:7-21`).
- CI runs unit/contract gates and builds but never starts a composed stack or browser
  (`.github/workflows/ci.yml:10-107`). Thus the main browser -> nginx -> NextAuth -> FastAPI ->
  PostgreSQL/MinIO seam has no automated end-to-end gate.

## Duplication and technical debt

- Matching is reranked server-side and then reranked again client-side through another gateway
  (`MatchingMode.tsx:259-273` versus `app/services/matching.py:182-276`). This violates the stated
  centre-only boundary and creates two parsers, fallbacks and ranking authorities.
- Requirement fallback generation is copied in `KtPanel.tsx:410-421`,
  `ChecklistPanel.tsx:183-193` and `GostChecklist.tsx:229-239`; each copy hardcodes counts and `v1`.
- Organization data is split into imported `organizations` and moderated `user_organizations`
  (`app/db/models.py:501-528,719-747`). The split is documented but no canonical merge/synchronization
  service is visible; registry consumers must know which aggregate they query.
- Migration logic spans Alembic Python plus raw SQL companions; `target_metadata=None` means autogenerate
  cannot detect ORM/schema drift (`alembic/env.py:21-32`). This is maintenance debt, not by itself a defect.
- Frontend API access is partly centralised in `lib/api-client.ts`, but many components call `fetch`
  directly; auth/error/timeout semantics are therefore duplicated across UI modules.
- Source contains comments, hidden DOM markers and aliases whose stated purpose is satisfying grep tests,
  e.g. `KtPanel.tsx:282-330,373-405` and API aliases `api-client.ts:490-515`. This inflates production UI
  and permits tests to pass without exercising behaviour.

## Candidate findings

### IA-01: Browser bypasses the centre and can bundle an LLM credential

- Category: security / architecture / duplication
- Proposed severity: High
- Confidence: Confirmed
- Exact path: `technozrelost-frontend/src/features/matching/llm.ts:43-65,147-176,236-255`;
  `technozrelost-frontend/src/features/matching/MatchingMode.tsx:259-273`;
  `technozrelost-backend/app/api/v1/match.py:20-29`.
- Evidence: after authenticated `POST /match`, the client calls `rerankWithLlm`; that module accepts
  `NEXT_PUBLIC_LLM_API_KEY` and sends it as a browser Authorization bearer directly to the configured
  external URL. Backend simultaneously implements gateway-controlled reranking and promises that the
  recommendation goes only through the centre.
- Safe reproduction: read the cited lines; search frontend `NEXT_PUBLIC_LLM_API_KEY` and direct
  `/chat/completions`, then compare the post-`matchOrganizations` call with backend `/match`.
- Impact: configuring the advertised public key exposes it to every browser and bypasses server-side
  gateway policy, audit, concurrency control and a single ranking authority; results can be reranked twice.
- Remediation: remove browser LLM credentials/network access and consume the final backend `MatchOut`;
  keep gateway policy, sanitization and retry server-side.
- Tests: assert client bundles/source contain no public LLM key or external completion fetch; API contract
  test should prove `/match` selects `llm` or `script` and browser renders that result unchanged.
- Dependencies: security/AI audit should validate data classification and deployment env exposure.

### IA-02: “Предложить через ЦНТР” reports success without creating anything

- Category: business completeness / data integrity
- Proposed severity: High
- Confidence: Confirmed
- Exact path: `technozrelost-frontend/src/features/matching/MatchingMode.tsx:182-192`;
  `technozrelost-frontend/src/features/matching/MatchCard.tsx:72-85`;
  `technozrelost-backend/app/services/matching.py:3-11`;
  `technozrelost-frontend/tests/matching.test.mjs:74-89`.
- Evidence: button handler only logs candidate ID, sets a success toast and clears it after three seconds.
  No network call occurs. Search found no MatchRequest ORM/schema/API/test; backend service documentation
  nevertheless specifies MatchRequest -> moderation -> Notification.
- Safe reproduction: inspect handler and search backend `MatchRequest|match_requests`; no live action needed.
- Impact: user receives a false confirmation; no durable request, moderation task, audit record or
  notification exists, so the central mediated-contact business process is absent.
- Remediation: add a persisted, idempotent proposal aggregate and authenticated create/status API, enqueue
  moderation/notification transactionally, and show success only from a 2xx response.
- Tests: public HTTP journey create -> duplicate/retry -> manager decision -> target notification; frontend
  interaction test must assert request payload and error state, not success strings in source.
- Dependencies: backend/API, data, realtime and frontend auditors.

### IA-03: Failed KT decisions are displayed as persisted Go/No-Go

- Category: data integrity / business workflow
- Proposed severity: High
- Confidence: Confirmed
- Exact path: `technozrelost-frontend/src/features/project/KtPanel.tsx:187-214`;
  `technozrelost-backend/app/api/v1/projects.py:656-703`.
- Evidence: on every non-403 exception, including network error, 404, 409 or 500, the client mutates the
  local control point to approved/rejected even though the authoritative PATCH did not commit. Backend
  permits the decision only after resource and role checks and writes an audit entry in the transaction.
- Safe reproduction: make `decideControlPoint` reject with an Error lacking status in an isolated component
  test; state changes to the requested decision while server state remains unchanged.
- Impact: auditors/operators can act on a false Go/No-Go and the UI loses correspondence with audit trail.
- Remediation: do not commit authoritative decision state on failed requests; show retry/offline-pending as
  a distinct non-authoritative state and reconcile from server.
- Tests: mounted component test with 404/409/500/network rejection must retain prior status and expose an
  alert; success case must re-render server response.
- Dependencies: frontend and backend authorization audit.

### IA-04: KT panel fabricates control points and maps them to the wrong UGT requirements

- Category: business correctness / duplication
- Proposed severity: High
- Confidence: Confirmed
- Exact path: `technozrelost-frontend/src/features/project/KtPanel.tsx:30-70,70-119,123-180,241-258`;
  `technozrelost-backend/app/api/v1/stages.py:52-63,184-197`.
- Evidence: `currentLevel` is explicitly ignored; only four control points are rendered and missing points
  are filled with client-generated IDs. Requirements use `level=kt`; comments acknowledge real mapping is
  not 1:1 and then “simplify” it. Server derives requirements from persisted `project.current_level`.
- Safe reproduction: supply one real control point and `currentLevel=7`; inspect rendered list/load calls:
  three synthetic points are added and requirement levels remain 1..4.
- Impact: users can see requirements and progress for the wrong maturity transition and interact with IDs
  that do not exist; this undermines the GOST readiness workflow.
- Remediation: render only server control points, use persisted stage transitions/from_level, and represent
  absent data as empty/error rather than domain mocks; centralise requirement mapping.
- Tests: mounted component against a 7->8 fixture and partial/empty control points; assert no synthetic IDs
  and that requests use the server-provided stage.
- Dependencies: domain/TRL auditor should confirm canonical KT-to-UGT mapping.

### IA-05: Template download contract is absent and fallback labels plain text as PDF

- Category: incomplete integration / document integrity
- Proposed severity: Medium
- Confidence: Confirmed
- Exact path: `technozrelost-frontend/src/features/project/template.ts:1-15,46-90,105-120`;
  `technozrelost-backend/app/api/v1/rag.py:10-65`;
  `technozrelost-frontend/tests/kt-panel.test.mjs:33-49,129-188`.
- Evidence: frontend calls `/api/v1/templates/{id}`; backend only exposes `/api/v1/rag/templates` create/list.
  Every 404/500/network error downloads a Blob containing plain text with MIME `application/pdf`; it is not
  a PDF byte stream. The test explicitly expects 404 fallback rather than endpoint integration.
- Safe reproduction: compare route decorators; invoke `downloadTemplate` with a mocked 404 and inspect the
  Blob first bytes, which are not `%PDF-`.
- Impact: a core document action is permanently degraded and produces files many PDF readers reject while
  UI treats download as completed.
- Remediation: define one authenticated template-download API returning generated/stored bytes and remove
  fake PDF fallback; failures must remain visible.
- Tests: HTTP response/content-disposition test plus browser download test asserting `%PDF-` signature;
  404/503 must show error and not create a file.
- Dependencies: backend generation/RAG and frontend document audits.

### IA-06: Registry status filter is applied after pagination and cannot represent global results

- Category: correctness / scalability
- Proposed severity: Medium
- Confidence: Confirmed
- Exact path: `technozrelost-frontend/src/features/registry/useRegistry.ts:13-22,72-111`;
  `technozrelost-backend/app/api/v1/projects.py:228-280`;
  `technozrelost-frontend/tests/registry.test.mjs:73-80`.
- Evidence: frontend sends status but backend accepts no status parameter; frontend filters only the fetched
  20-row page while advancing cursor and `hasMore` from the unfiltered page. Its own test requires the TODO.
- Safe reproduction: arrange first server page with no requested status and second page with matches; first
  render is empty although matching records exist, and page semantics/count cannot be correct.
- Impact: registry search can falsely report no projects and requires unnecessary page traversal; behaviour
  worsens with volume.
- Remediation: validate and apply status in backend query before keyset/limit, then remove client filter.
- Tests: HTTP pagination fixture where only later raw rows match status; first filtered page must return them
  and cursor must remain stable.
- Dependencies: backend registry/performance and frontend audits.

### IA-07: Saved filters are an acknowledged local-only backend gap

- Category: incomplete integration / persistence
- Proposed severity: Medium
- Confidence: Confirmed
- Exact path: `technozrelost-frontend/src/lib/api-client.ts:517-553`;
  `technozrelost-frontend/src/features/registry/saved-filters/storage.ts:1-16,26-63`;
  `technozrelost-frontend/src/features/registry/saved-filters/useSavedFilters.ts:75-117,136-179`.
- Evidence: frontend calls `/filters/saved`, but search under backend found no route/model. 404 switches to
  unbounded `localStorage`; quota errors are swallowed. Source exposes an explicit BLOCKED marker.
- Safe reproduction: route inventory/search `filters/saved`; mock 404 and observe local-only record.
- Impact: filters do not follow the user across devices, are lost with browser storage and can silently stop
  saving at quota; authenticated UI implies server persistence that does not exist.
- Remediation: implement user-owned CRUD with size/count constraints or label feature explicitly local;
  avoid swallowing persistence failures.
- Tests: HTTP ownership/isolation/limits plus browser 404/quota error state.
- Dependencies: backend/data and frontend audits.

### IA-08: News media is stored and exposed by key but has no delivery route

- Category: incomplete integration / content
- Proposed severity: Medium
- Confidence: Confirmed
- Exact path: `technozrelost-backend/app/api/v1/news.py:100-140,551-633`;
  `technozrelost-frontend/src/components/landing/news-card.tsx:7-20`;
  `technozrelost-frontend/src/components/dashboard/news-card.tsx:20-46`.
- Evidence: API supports media upload/delete and returns private `storage_key`/`cover_key`, but no media
  download route exists. Both public and dashboard cards explicitly render placeholders for this reason.
- Safe reproduction: enumerate news route decorators and compare response fields with card implementation.
- Impact: uploaded covers/gallery/attachments consume storage but cannot be presented to readers; content
  management appears complete while delivery is absent.
- Remediation: add authorized/public-by-publication media delivery (or short-lived URLs) without exposing raw
  object keys, then render cover/media URLs.
- Tests: unpublished access denial, published cover retrieval, MIME/cache headers, deletion and frontend render.
- Dependencies: files/security/news frontend audits.

### IA-09: Root quick-start and status claims are stale against current checkout

- Category: documentation / reproducibility
- Proposed severity: Low
- Confidence: Confirmed
- Exact path: `README.md:1-5,14-32,41-59`;
  `technozrelost-backend/alembic/versions/0037_status_checks.py:1-20`;
  `.github/workflows/ci.yml:53-71,92-107`.
- Evidence: README calls itself a 22/22 snapshot, instructs `head=0027`, and quotes 334/39 as current local
  results; current migration head is 0037 and CI defines different current full gate commands. The quoted
  counts were not reproduced by this audit and are not valid evidence for the current commit.
- Safe reproduction: compare cited files; no historical report is needed.
- Impact: operators can stop migrations at the wrong revision and validators can mistake old counts/status
  for current evidence.
- Remediation: make quick-start revision-independent, remove volatile pass counts or generate them in release
  evidence, and date/version operational claims.
- Tests: docs contract should assert README does not pin an obsolete migration head and commands match CI.
- Dependencies: reproducibility audit.

### IA-10: Several named business capabilities have no first-class persistence/API chain

- Category: business completeness / extensibility
- Proposed severity: Medium
- Confidence: Confirmed
- Exact path: `technozrelost-backend/app/schemas.py:75-123`;
  `technozrelost-backend/app/db/models.py:158-205,501-528,668-687`;
  `technozrelost-backend/app/services/matching.py:3-11`.
- Evidence: project aggregate has no goals, tasks or outcome/result collection; competencies are embedded
  JSON arrays on Organization instead of a registry entity; recommendations stop at ranked candidates and
  the claimed MatchRequest is absent. Searches found no corresponding ORM table/schema/router.
- Safe reproduction: inspect complete Project/Create contracts and ORM class inventory; search table names
  `goals|tasks|results|competencies|match_requests`.
- Impact: these concepts cannot be independently owned, versioned, authorized, queried or integrated by
  future external systems; JSON/string additions would create incompatible ad-hoc contracts.
- Remediation: validate required domain boundaries with product owner, then introduce versioned public DTOs
  and normalized aggregates/events only for confirmed capabilities.
- Tests: lifecycle contract per confirmed aggregate from create/update through authorization and audit;
  migration upgrade/downgrade and external integration schema compatibility.
- Dependencies: functional validator; backend/data/API audit.

## Verification performed

- `node --test tests/routes-matrix.test.mjs`: 7 passed.
- `node --test tests/matching.test.mjs`: 7 passed after the locked install performed by task 07.
- `node --test tests/kt-panel.test.mjs`: 8 passed after the locked install performed by task 07.
- Selected task-01 total: 22 passed, 0 failed (`routes-matrix` 7 + `matching` 7 + `kt-panel` 8).
  This task did not install dependencies and did not run backend suites, services, migrations, seed,
  deploy, browser smoke or state-changing commands.
- Green source/contract tests do not establish that candidate runtime defects are fixed. Matching and KT
  tests explicitly accept mock/fallback paths, which remains the behavioural coverage gap documented above.

## Requirement status

- R01-R16: done for read-only inventory: languages/versions, entrypoints, modules, boundaries, stores,
  services, background work, roles, observability, CI/CD, test topology, critical path, extension seams,
  duplication/debt and gaps are mapped with current-code evidence.
- R34: done; claimed/current capabilities are classified as implemented/partial/missing without importing
  historical verdicts.
- R35: done; business chain matrix UI/docs -> API -> ORM/DB -> authorization -> tests is included.
- R43i: done with limitation; eight deep-state dimensions are assessed statically, while production/browser/
  restore states are explicitly not claimed.

## Consolidation interface

- Candidate records: `IA-01` through `IA-10`, each with category, proposed severity/confidence, exact lines,
  evidence, safe reproduction, impact, remediation, tests and dependencies.
- Highest-priority cross-task seams: browser LLM bypass (`IA-01`), fake matching success (`IA-02`),
  non-persisted KT decision display (`IA-03`), fabricated/wrong-stage KT data (`IA-04`).
- Confirmed incomplete seams: templates (`IA-05`), registry status (`IA-06`), saved filters (`IA-07`), news
  media (`IA-08`), docs drift (`IA-09`), missing first-class business aggregates (`IA-10`).
- External limitation: no proof of production deployment, restore/offsite, real LLM/MinIO/ClamAV/Redis,
  composed HTTP journey or non-Chromium browsers was produced by this task.
