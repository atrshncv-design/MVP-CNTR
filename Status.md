# STATUS / CURRENT STATE

## Recovery session — 2026-07-22

- Iteration 20/25: Graphify-сверка PRD, frontend и backend преобразована в новый доказательный план до 31 августа. План строится из шести вертикальных этапов, отзывает историческую «готовность», ставит реальные gates для UX, RBAC, проекта/УГТ, 22 документов, реестров/RAG и production hardening, а также явно фиксирует решения Functional Validator и v3-out-of-scope.
- Iteration 21/25: независимый Checker отклонил первый календарь как необоснованный. План усилен capacity-моделью и Core cut line, P0 traceability matrix, полным state machine 7+8 с четырьмя возвратами, ранними шаблонными зависимостями, измерением бизнес-метрики −30%, AI Maker–Checker/redaction/cost limits, Redis/FIPS reconciliation и сценарными release gates.
- Iteration 22/25: повторный Checker выявил арифметическую и scope-коллизию. Capacity пересчитан в 56 валовых Maker-дней (43 scope + 13 reserve), RAG/AI переоценён до 8 дней, state machine начат 3 августа, а Full MVP v2 и fallback Core Pilot v1 получили разные traceability tiers, названия и release gates.
- Iteration 23/25: финальный Checker вернул `READY`: capacity, критический путь, Full/Core scope и gates были согласованы; оставшихся плановых блокеров на той итерации не было. Последующая Functional Validation уточнила документный scope.
- Iteration 24/25: Functional Validator уточнил августовскую цель и утвердил доменную модель: тип организации, системная роль и роль в проекте разделены; организация может выступать в разных проектных качествах. Умная заявка оценивается правилами + AI, но окончательное принятие/отказ остаётся за менеджером ЦНТР. Августовский scope документов сокращён до 3–5, а внешние интеграции перенесены на октябрь–декабрь.

- Iteration 1/25: atomic state restored from `CLAUDE.md`, `Plan.md`, `Status.md`, and `PRD.md`.
- Found stale worktree metadata and untracked frontend/backend copies inside `main`; no code was changed there.
- Created isolated branches/worktrees: `codex/recovery-docs`, `codex/recovery-frontend`, and `codex/recovery-backend`.
- Added `.agents/TOOLING.md` to reify the ECC/Ralph/Ponytail/Headroom operating contract and added a baseline `DESIGN.md` token contract.
- External-tool limitation ledger is explicit: token-gated, Claude-specific, benchmark-only, or unverifiable tools are not injected into application runtime.
- Iteration 2/25: Graphify generated AST graphs for frontend (135 nodes/142 edges) and backend (113 nodes/137 edges); `DESIGN.md` lint completed without findings.
- PostgreSQL Primary/Replica containers started. Frontend lint passed, while build exposed an offline Google Fonts dependency; recovery fix switched the root layout to a local system font stack.
- Iteration 3/25: both PostgreSQL containers are healthy. A sandbox-only Turbopack port-binding denial requires an unrestricted verification rerun. Backend Ruff found two formatting defects in Alembic files; the long migration statement was corrected and imports are being normalized.
- Iteration 4/25: frontend production build succeeded (TypeScript + 22 routes); backend Ruff passed; Alembic upgrades `0004 -> 0005` applied and FastAPI imported with 13 documented API paths. `pytest` found zero tests (exit 5), so the historical claim of tested completion is not accepted as evidence.
- Iteration 5/25: ports 3000/8000 belonged to an unrelated project and were preserved. Technozrelost is running on frontend `http://localhost:3001` and API `http://localhost:8001`; Auth.js session, API liveness, accessibility-tree login UI, PostgreSQL Primary, and Replica passed live checks. The then-static `/ready` response is not accepted as readiness evidence.
- Iteration 6/25: environment recovery moved from inventory to active integration. Installed the ECC skill subset, Graphify project skill/hook, Headroom, Agent Browser, Huashu Design, Design.md, Anima SDK, Ponytail, CLI-Anything Hub, and the isolated Harness Bench Fast environment. `design.md lint` passed; Anima SDK import and Huashu verifier entry point passed; Headroom `audit-reads` measured 3.86 MB of shell transcript output with 133 same-path rereads.
- Iteration 7/25: Headroom loopback proxy started and passed `headroom doctor` outside the sandbox; Codex user routing is present. Startup-bound integrations (Headroom routing, Ponytail hooks, newly installed skills) are explicitly marked restart-required instead of being claimed active in the current process. Graphify is now project-scoped through `.codex/hooks.json` and `.agents/skills/graphify`.
- Iteration 8/25: Harness Bench Fast smoke gate passed (`task-set 0.13.0`, 351 mechanically verified tasks available). Portable Graphify code graphs were regenerated for frontend (133 nodes/140 edges/17 communities) and backend (113 nodes/137 edges/25 communities); both pass `graphify portable-check`. Local cache/studio/lifecycle files are excluded from version control.
- Iteration 9/25: the strategic 50+ page project context and all repository Markdown planning/rule files were read. The docs graph now contains 15 named architecture/business nodes and 13 evidence-linked edges and passes `graphify portable-check`. A verification run exposed that ESLint traversed Graphify's generated third-party studio bundle; `.graphify/**` is now explicitly outside the application lint boundary.
- Iteration 10/25: historical `Status.md` claimed backend validation although pytest collected zero tests. Added executable FastAPI contract tests for liveness identity and OpenAPI exposure; the unresolved readiness TODO remains visible for the forthcoming architecture/stub audit rather than being hidden by a fake assertion.
- Iteration 11/25: frontend ESLint passed and the production build completed with 22 routes (sandbox-only Turbopack port binding required the documented unrestricted rerun). Backend Ruff passed and the new contract suite passed `2/2`; Starlette emits one upstream TestClient deprecation warning. The environment now has executable gates instead of a zero-test claim.
- Iteration 12/25: live servers on `localhost:3001` and `localhost:8001` were process-identified and health-checked. Agent Browser verified the login accessibility tree (heading, two required fields, submit button, registration link). It also confirms the current page still carries the generic `Create Next App` title; this is recorded evidence for the upcoming MVP 0 visual adaptation, not silently accepted as finished UI.
- Iteration 13/25: replaced the generator metadata (`Create Next App`) with the product name and ГОСТ-oriented description. This is a bounded product-identity correction; the visual redesign remains gated by the Huashu three-direction review and the Functional Validator's selection.
- Iteration 14/25: added `.agents/ENVIRONMENT.md` with the exact install, activation, build, test, launch, browser, Graphify, Headroom, and health-probe commands. Credential and restart boundaries are explicit; the static `/ready` response is explicitly excluded from readiness evidence.
- Iteration 15/25: independent Checker returned `NOT READY` and confirmed the user's concern: mock frontend data, a static readiness response, insecure GigaChat TLS bypass, weakened AGENTS enforcement, incorrect Graphify roots, and a design-token mismatch. Historical completion checkboxes are now explicitly classified as unverified assertions.
- Iteration 16/25: TDD readiness cycle completed: two new tests first failed (`2 failed, 2 passed`) because no DB checker existed, then passed (`4 passed`) after `/ready` began executing `SELECT 1` against configured Primary/Replica engines and returning HTTP 503 on failure. GigaChat now uses async HTTP, default TLS verification, bounded timeouts, Basic OAuth credentials, and unique request IDs; `verify=False` was removed.
- Iteration 17/25: frontend/backend Graphify graphs were rebuilt from repository roots, restoring real `src/` and `app/` paths (frontend 139 nodes/143 edges before hook enrichment; backend 168/212). Project authority rules were merged into all three `AGENTS.md` files, and the Arial design token now matches the offline-safe CSS implementation.
- Iteration 18/25: restarted the corrected production servers. Live `/api/v1/ready` now returns `primary=ok` and `replica=ok` from real SQL probes; Agent Browser confirms the product title and the accessible login controls on `localhost:3001`. The explicit `Mock data` in the R&D dashboard remains a confirmed product gap for the subsequent MVP 0 adaptation, so the historical MVP-complete claim remains revoked.
- Iteration 19/25: repeat Checker validated all technical corrections and reduced blockers to Huashu reproduction documentation plus commit/push. The Huashu commands now include the actual Codex skill installation destination and `SKILL.md` existence check. Final gates pass: frontend lint/build (22 routes), backend Ruff/pytest (`4 passed`), all three Graphify portable checks, Design.md lint, live Primary/Replica readiness, and Agent Browser login inspection.
- Runtime-only local settings: frontend uses `AUTH_TRUST_HOST=true`, a non-production `AUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3001`, and the build targets `NEXT_PUBLIC_API_URL=http://localhost:8001`; backend CORS targets `http://localhost:3001`.

---

**HISTORICAL STATUS — NOT YET REVALIDATED (Фазы 1–4)**

## Push-контракт
- Remote `origin` → `https://github.com/atrshncv-design/MVP-CNTR.git`
- `main` (dd91a07), `feat/frontend` (e8805f2), `feat/backend` (298b24f) — все отправлены.

---

## Фаза 1 — Инфраструктура ✅
- **Шаг 1.1:** Git worktrees (Next.js 16 + FastAPI, uv)
- **Шаг 1.2:** PostgreSQL Primary/Replica + pgvector + схемы public/test
- **Шаг 1.3:** NextAuth.js v5 + FastAPI JWT + middleware RBAC
- **Шаг 1.4:** RBAC: 9 ролей, permissions, users, user_roles (Alembic 0003)

## Фаза 2 — Адаптация MVP 0 + ЛК ✅
- **Шаг 2.1–2.3:** УГТ-данные, опросник ~350 вопросов, Wizard, УГТ-шкала, дашборды ГК и R&D

## Фаза 3 — Дашборд проекта + RAG + Генератор ✅
- **Шаг 3.1:** `/dashboard/project/[id]` — радар УГТ, прогресс-бары, КТ, документы, команда, бюджет (RBAC), аудит
- **Шаг 3.2:** 6 таблиц (projects, questionnaire_results, project_members, control_points, project_documents, audit_trail); `GET /api/v1/projects/{id}` + `POST /api/v1/projects/questionnaire`
- **Шаг 3.3:** RAG-пайплайн: hash-based embedding (1536-dim), KNN-поиск pgvector `<=>`, `POST /api/v1/rag/templates`, `POST /api/v1/rag/search`
- **Шаг 3.4:** Генератор документов: `POST /api/v1/projects/{id}/generate/{tz|passport|teo}`, шаблоны с `{{variable}}`, seed-скрипт

## Фаза 4 — Реестры + AI-ассистент ✅

### Шаг 4.1 (Fullstack): Реестры
**Backend:**
- `GET /api/v1/executors` — каталог исполнителей (rd_executor, scientific_org, serial_manufacturer) с фильтром по роли и количеством проектов
- `GET /api/v1/technologies` — реестр проектов с фильтрацией по статусу, категории, уровню УГТ

**Frontend:**
- `/dashboard/executors` — сетка карточек исполнителей с поиском и фильтром по ролям
- `/dashboard/technologies` — сетка карточек технологий с прогресс-барами УГТ, фильтрами по статусу/категории

### Шаг 4.2 (Fullstack): AI-ассистент
**Backend:**
- `POST /api/v1/chat` — принимает вопрос, делает семантический поиск по RAG-базе, возвращает ответ
- `app/services/ai_assistant.py` — GigaChat OAuth/completion + RAG orchestration with graceful fallback when credentials are absent
- `app/services/ai_assistant.py` — построитель RAG-контекста + оркестратор чата
- `GIGACHAT_CREDENTIALS` в `app/core/config.py` (добавить в `.env` для включения GigaChat)

**Frontend:**
- `/dashboard/ai-assistant` — интерфейс чата с пузырьками сообщений, отображением источников из RAG, индикатором загрузки

### Валидация
- Backend: `ruff check app/` — чисто ✅
- Frontend: `tsc --noEmit` чисто ✅, `eslint` чисто ✅, `next build` чисто ✅ (22 роута)

---

## Итоговая архитектура MVP v2

```
Frontend (Next.js 16, App Router, 22 роута)
├── /dashboard/gk_customer          — ЛК ГосКомпании
├── /dashboard/rd_executor          — ЛК R&D-исполнителя
├── /dashboard/scientific_org       — ЛК Научной организации
├── /dashboard/serial_manufacturer  — ЛК Производителя
├── /dashboard/ugt_expert           — ЛК Эксперта УГТ
├── /dashboard/auditor              — ЛК Аудитора
├── /dashboard/investor             — ЛК Инвестора
├── /dashboard/cntr_admin           — ЛК Админа ЦНТР
├── /dashboard/cntr_manager         — ЛК Менеджера ЦНТР
├── /dashboard/gk_customer/projects — УГТ-шкала
├── /dashboard/gk_customer/projects/new — Опросник
├── /dashboard/project/[id]         — Дашборд проекта
├── /dashboard/executors            — Каталог исполнителей
├── /dashboard/technologies         — Реестр технологий
├── /dashboard/ai-assistant         — AI-ассистент
├── /login, /register, /forbidden
└── Middleware RBAC (все 9 ролей)

Backend (FastAPI, 15+ эндпоинтов)
├── POST /api/v1/auth/register
├── POST /api/v1/auth/login
├── GET  /api/v1/auth/me
├── GET  /api/v1/health
├── GET  /api/v1/projects/{id}
├── POST /api/v1/projects/questionnaire
├── POST /api/v1/projects/{id}/generate/{doc_type}
├── POST /api/v1/rag/templates
├── POST /api/v1/rag/search
├── GET  /api/v1/rag/templates
├── GET  /api/v1/executors
├── GET  /api/v1/technologies
└── POST /api/v1/chat

Database (PostgreSQL + pgvector)
├── public.users, roles, permissions, user_roles, role_permissions
├── public.projects, questionnaire_results, project_members
├── public.control_points, project_documents, audit_trail
└── public.rag_documents (pgvector, ivfflat index)
```

## Следующие шаги (пост-MVP)
- Загрузка настоящих документов/шаблонов в RAG (через `POST /api/v1/rag/templates`)
- Подключение GigaChat (установить `GIGACHAT_CREDENTIALS` в `.env`)
- Populate БД реальными пользователями и проектами
- Unit-тесты / интеграционные тесты
- CI/CD pipelines
