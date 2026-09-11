# Evidence 09: сквозная бизнес-трассируемость

## База и метод

- Checkout: ветка `audit/deep-repository-20260910`, commit `e87267d7c6840ce7d4ec153d7d183731bf5f32e4` (проверено `git rev-parse HEAD` 2026-09-11; worktree содержит только `.autopilot/`-изменения, продукт не менялся).
- Read-only: статический разбор `technozrelost-backend/app/api/v1/*.py`, `app/db/models.py`, `app/schemas.py`, `app/services/matching.py`, `app/services/ai_assistant.py`, `app/services/rag.py`, `technozrelost-frontend/src/app/**/page.tsx`, `src/features/{project,matching,registry,offline}/*`, `src/middleware.ts`, `src/lib/roles.ts`, `src/lib/api-client.ts`. `.env` не читались (только имена из `.env.example`); секретные значения не выводились.
- Входы T01–T05 использованы только для дедупликации: `evidence/01` (IA-01..IA-10), `evidence/02` (B02-001..B02-006), `evidence/03` (FE03-01..FE03-19), `evidence/04` (DB-01..DB-14), `evidence/05` (05-01..05-08). Исторические отчёты/`Plan.md`/`Status.md` как источник находок не использовались.
- Правило spec §11 + Метод доказательства п.3: расхождение docs/UI-строки с кодом без фактического шва (маршрут/DTO/ORM/auth/test) дефектом не считается; такие строки помечены `docs-only`.
- Craft-корректировки из `state.js` применены при ссылках (см. §Дедупликация): IA-09 только doc-drift; IA-10 гипотеза отделена; IA-07 localStorage отдельно; B02-004 только unbounded-large; admin-инвариант «не более одного»; FE03-01 High (не Critical); FE03-04 Medium; FE03-11 Probable до решения каноничности; DB-03 Medium; DB-07 loss Confirmed/lock Probable; DB-12 Medium; DB-02 split; DB-05 dedup B02-004; DB-04 группа; DB-09/DB-13 склеить; DB-14 один текст; 05-01 Critical только при реальном ключе; 05-05 cost Probable.
- DB-зависимые pytest намеренно не запускались (harness T04 `tests/conftest.py:48-62,73-107` меняет ambient `technozrelost_test`, безопасного disposable lifecycle нет — BLOCKED по T04). Запущен только безопасный frontend `node --test tests/offline.test.mjs` → 10 passed (см. §Верификация).

## Сквозная матрица UI/docs → API → DB → authorization → test

Легенда verdict: `ok` — все 5 звеньев связаны и подтверждены строками; `разрыв` — отсутствует/фальсифицировано хотя бы одно звено. Роли: `all9` = все слаги `technozrelost-frontend/src/lib/roles.ts:63-73`; `staff` = `cntr_admin|cntr_manager`; backend — авторитет (`technozrelost-backend/app/core/deps.py:20-113`).

### B-01. Жизненный цикл проекта (assessment → draft → manager → publish → stages → promotion → archive/export)

| Звено | Точные path:lines |
|---|---|
| UI/docs | `technozrelost-frontend/src/app/dashboard/gk_customer/projects/new` + wizard `src/features/../questionnaire-wizard-client.tsx:290-343,391-403`; деталь `src/app/dashboard/project/[id]/page.tsx:6`; `src/features/project/ProjectCard.tsx:66-123`; `src/features/project/ActionsPanel.tsx:56-143,177-220`; дашборды `src/features/dashboard/RoleDashboardShell.tsx:208-259` |
| API | `technozrelost-backend/app/api/v1/assessments.py:142-175` create; `app/api/v1/projects.py:80` create, `:306-351` publish, `:354-397` delete/archive, `:398` export, `:505-550` detail, `:610-650` questionnaire, `:656-703` control-point decide; `app/api/v1/manager.py:99-177` drafts queue/decide, `:224-260` promotions, `:337` history; `app/api/v1/stages.py:184-197` requirements, `:383-550` docs/evaluate; `app/api/v1/requests.py:65-190` requests/conclusion |
| DB | `technozrelost-backend/app/db/models.py:158-215` Project (+status-check `:201-203`), `:218-245` QuestionnaireResult, `:248-326` Assessment*, `:329-407` Member/Invite/ControlPoint, `:531-612` StageRequirement/Promotion*, `:449-461` AuditTrailEntry, `:410-446` ProjectDocument |
| Authorization | `app/api/v1/projects.py:169-195` can_access/require (creator/active-member/staff, чужой→404); publish owner/project-admin/staff `projects.py:327-329`; control-point assignment+staff, запрет self-verify `:656-703`; manager queues `cntr_manager\|cntr_admin`; middleware fail-closed `technozrelost-frontend/src/middleware.ts:44-105` + `src/lib/roles.ts:181-215` (UI-скрытие не авторитет) |
| Tests | backend `test_demo_journey.py`, `test_full_ugt_journey.py`, `test_control_points.py`, `test_manager_verification.py`, `test_archive_audit_export.py`, `test_project_create.py`, `test_project_scope.py`, `test_rbac_projects.py`; frontend `tests/routes-matrix.test.mjs:50-92` (7/7, shape-контракт, не живой NextAuth), `tests/kt-panel.test.mjs` (8/7+1, принимают mock/fallback) |
| Verdict | **ok-ядро / разрыв-обвязка**: персистентный lifecycle связан; разрывы вынесены: KT-ложный успех + фабрикация (→ IA-03/IA-04/FE03-03), draft-уведомление теряется (→ B02-003), аудит критичных мутаций неполон (→ B02-005), manager-очередь N+1+unbounded (→ DB-03/DB-04 Medium по craft), длинные транзакции stage/file/fan-out (→ DB-14 один текст) |

### B-02. Цели / задачи (project goals & tasks)

| Звено | Точные path:lines |
|---|---|
| UI/docs | `technozrelost-frontend/src/features/project/CanvasBlocks.tsx:62-87,104-172` (`results`/`transitionPlan` — поля локального `CanvasValue`); roadmap — статический словарь `src/components/landing/roadmap-content.tsx:425-502`, не записи проекта |
| API | **нет**: воспроизводимый негатив T03 `git grep -n -E '(class .*Canvas\|__tablename__ = "(goals\|tasks\|project_results\|canvas)"\|@router.*canvas)'` → empty (`evidence/03:43-44`); `POST /assessments` принимает только name/description/category/levels/budget/questionnaire (`technozrelost-backend/app/schemas.py:77-116`) |
| DB | **нет**: полный inventory ORM T04 (`evidence/04:46-86`) не содержит Goal/Task; `app/db/models.py:158-205` Project не имеет коллекций целей/задач |
| Authorization | шва нет (нечего защищать) |
| Tests | **testless**: жизненного цикла Goal/Task нет ни в backend `tests/`, ни во frontend `tests/` |
| Verdict | **разрыв — missing as first-class** → dedup IA-10 (часть) + FE03-16. Craft: отсутствие агрегатов Confirmed; продуктовая гипотеза «должны существовать» — отдельно, confidence понижен, отдельным дефектом не раздувать. Маркер: **schema-only отсутствует / testless** |

### B-03. Достижения и результаты (achievements vs project results)

| Звено | Точные path:lines |
|---|---|
| UI/docs | профиль/проект-карточки → `GET /achievements/mine`, `/projects/{id}/achievements`, admin stats (матрица T03 `evidence/03:135`); «results» проекта — только локальная canvas-строка (см. B-02) |
| API | `technozrelost-backend/app/api/v1/achievements.py:61-113` catalog (public+ETag), `:116-180` mine, `:186-223` project achievements; награждение — backend event-driven, не frontend-мутация |
| DB | `technozrelost-backend/app/db/models.py:981-1087` Achievement/UserAchievement/ProjectAchievement; awarded-нагрузка `app/services/achievements.py:559-731` (тяжёлые агрегаты без awarded-индекса — см. T04 heavy-JOIN) |
| Authorization | catalog public; mine `CurrentUser`; project: anon только `is_public`, иначе `can_access_project`, нарушителям 404 (`achievements.py:200-205`); admin stats staff |
| Tests | `test_achievements.py`, `test_achievement_catalog_sync.py`, `test_achievements_stats.py`; frontend rendering-контракты |
| Verdict | **ok (achievements read/display)** / **разрыв (project results как сущность — см. B-02)** → dedup IA-10 + FE03-16 (results-часть), FE03-07 (canvas-autosave отдельно). Новых кандидатов нет |

### B-04. Публикация / модерация / confidentiality проекта

| Звено | Точные path:lines |
|---|---|
| UI/docs | `ActionsPanel.tsx:56-143` publish/archive/export/token/share; manager queues `src/components/profile-verification-queue.tsx:67-120,200-282`; news editor/admin `src/components/dashboard/news-editor.tsx:231-357,429-781`, `src/app/dashboard/news/admin/page.tsx:196-230` |
| API | `app/api/v1/projects.py:306-351` publish (auto_confirmed для УГТ1-2 / approved для УГТ3-9 / published после апрува драфта); `app/api/v1/manager.py:115-177` decide_draft; `app/api/v1/news.py:459-551` publish/schedule/unpublish/delete; `app/api/v1/profiles.py:294-345` manager decide |
| DB | `Project.status/is_public/show_preliminary/published_at` (`models.py:169-203`); `NewsPost.status` (`models.py:910,947-952`); `PromotionRequest.status` (`models.py:592-610`) |
| Authorization | publish owner/project-admin/staff (`projects.py:327-329`); news author/admin (`news.py:375-527`); manager staff-guard; реестр — только `is_public` (`projects.py:243-246`) + optional-user |
| Tests | `test_publication_privacy.py`, `test_news.py`, `test_news_contract.py`, `test_news_schedule.py`, `test_manager_verification.py`, `test_archive_audit_export.py` |
| Verdict | **ok-ядро / разрывы по краям**: B02-001 pending-join раскрывает `ProjectOut` целиком incl. `budget/join_token/legal_owner/rights_holder/contract_*` (`membership.py:160-191` vs guard `projects.py:176-183`) — High Confirmed; B02-003 draft-решение теряет notification/outbox после commit (`manager.py:167-175` vs `services/notifications.py:35-46`, `core/database.py:51-54`) — Medium Confirmed; B02-005 критичные мутации без `AuditTrailEntry` (`projects.py:306-395`, `invites.py:90-113,221-282`, `profiles.py:294-345`, `news.py:425-633`) — Medium Confirmed; FE03-14 raw-preview Probable Low (stored санитизируется `news.py:375-445`+`html_sanitizer.py:20-74`) |

### B-05. Команды, роли, join/invite/transfer

| Звено | Точные path:lines |
|---|---|
| UI/docs | `src/components/project-team-panel.tsx:132-220,276-366` invites/transfer/legal; `src/app/join/[token]/join-token-client.tsx:53-90`, `src/components/join-project-form.tsx:43-150`, `RoleDashboardShell.tsx:208-259,340-366` join; регистрация `src/app/register/page.tsx:44-93,204-220` |
| API | `app/api/v1/invites.py:90-113` create, `:116-130` list, `:131-212` accept (conditional atomic UPDATE), `:221-282` revoke/transfer, `:261` legal; `app/api/v1/membership.py:119` share-sig, `:136-191` join, `:197-317` join-requests/decide/regenerate/priority |
| DB | `models.py:329-351` ProjectMember (`(project,user)` unique), `:354-380` ProjectInvite (token unique), `:750-770` OrganizationMember |
| Authorization | `require_project_admin` (`invites.py:66-87`); transfer read-modify-write без `FOR UPDATE`/partial-unique (`invites.py:236-258`); join pending≠active (`projects.py:176-183`); allowlist саморегистрации 4 базовые роли (`core/deps.py:88-109`, `api/v1/auth.py:44-60`); user-role mutation только `cntr_admin` (`users.py:35,105-112`) |
| Tests | `test_invites.py`, `test_invite_race.py` (slot-claim atomic), `test_join_mechanic.py`, `test_privileged_roles.py`, `test_rbac_projects.py` |
| Verdict | **ok-ядро / разрывы**: B02-001 (см. B-04); B02-002 конкурентный transfer → два admin (High Confirmed; craft: индекс даёт «не более одного», не «ровно один», remediation — partial unique + locked transfer); FE03-06 регистрация предлагает `auditor/regulating_organization/investor`, backend всегда 403 — Medium Confirmed; FE03-10 дубли без pending-guard — Medium Confirmed; FE03-13 схлопывание 403/404/500 в пусто/скрытие — Low Confirmed |

### B-06. TRL / готовность / control points

| Звено | Точные path:lines |
|---|---|
| UI/docs | `src/features/project/KtPanel.tsx:30-70,120-219` (currentLevel игнорируется, добивка до 4, `level=kt`), `ChecklistPanel.tsx:183-193`, `GostChecklist.tsx:229-239` (копии фолбэка); UGT-словари `/levels`, `/levels/[id]` — локальные |
| API | `app/api/v1/assessments.py:142-175` (template public, create CurrentUser); `app/api/v1/stages.py:52-63,184-197` (requirements от persist `project.current_level`), `:131-172,212-380` docs/evaluate flow; `app/api/v1/projects.py:656-703` decide (resource+role+audit в транзакции) |
| DB | `models.py:248-326` Template/Checkpoint/Assessment/Answer (DB uniques/checks богаче metadata), `:383-407` ControlPoint (status-check), `:531-542` StageRequirement (pair-unique только в DB), `Project.current_level` |
| Authorization | CurrentUser + project access + assigned-verifier/staff; owner self-verify запрещён (backend), но UI показывает кнопки по role-slug (`KtPanel.tsx:60-68,298-323`) |
| Tests | `test_official_ugt.py`, `test_full_ugt_journey.py`, `test_readiness_assessment.py`, `test_requirement_sets.py`, `test_control_points.py`, `test_seed_gost.py`; frontend `kt-panel.test.mjs` 8/8 (принимает fallback — покрытие слабое, T01) |
| Verdict | **разрыв UI vs авторитет**: IA-03 failed-decision→локальный approved/rejected (High Confirmed); IA-04 фабрикация CP + неверный UGT-маппинг (High Confirmed); FE03-03 объединённый Medium Confirmed (craft: backend остаётся авторитетом, reload корректирует — operator-deception, не persisted-compromise). Серверное ядро ok |

### B-07. Документы: upload/check + генерация + шаблоны

| Звено | Точные path:lines |
|---|---|
| UI/docs | `src/features/project/DocsPanel.tsx:93-181`, `src/components/project-files-panel.tsx:36-115` (дубли одной семантики), `src/components/stage-progress-panel.tsx:30-88`, `src/components/verification-docs-panel.tsx:88-220`, `src/components/request-comments-panel.tsx:90-316`; шаблон `src/features/project/template.ts:1-120`; генерации в UI **нет** (`git grep '/generate/' -- src` → empty, `evidence/03:48-49`) |
| API | files `app/api/v1/files.py:65-109` upload, `:113-163` list/download (fail-closed кроме `clean`), `:166-181` rescan; stages `:459-550` stage-documents/evaluate; requests `:162-290` comments/conclusion-PDF/cleanup; generation `app/api/v1/generation.py:14-35` `POST /projects/{id}/generate/{doc_type}` allowlist `{tz,passport,teo}`; rag templates `app/api/v1/rag.py:13-65` |
| DB | `models.py:410-446` ProjectDocument (version-uniqueness gap), `:615-630` VerificationDocument, `:565-580` PromotionRequestDocument; `file_url` остаётся `None` после byte-upload (→ 05-03) |
| Authorization | `require_project_access` везде; download после clean-scan; generation — project access; verifier/staff для evaluation/final |
| Tests | `test_file_storage.py:102-233`, `test_scan_failclosed.py:53-70`, `test_upload_hardening.py`, `test_document_generation.py:73-110` (deterministic substitution), `test_comments_pdf_retention.py`; frontend download-тест отсутствует |
| Verdict | **частично**: upload-core ok; разрывы → IA-05 template-download отсутствует + fallback клеит text-blob как `application/pdf` (Medium Confirmed); FE03-17 генерация **API-only** (Medium Confirmed, distinct от IA-05); 05-03 бинарное тело не читается, `_evaluate` видит только title (`stages.py:131-172,412-456`, `file_storage.py:133-167,356-393`, `seed_gost.py:70-113`) — High Confirmed; 05-07 ClamAV без deadline + put-до-scan (High Confirmed); 05-08 lifecycle/retention gaps (Medium Confirmed); DB-02 split по craft: (а) race одинаковых версий Confirmed High + (б) orphan при commit-fail Confirmed (см. T04); DB-14 file/stage/fan-out длинные транзакции (один текст по craft) |

### B-08. Организации (справочник vs пользовательские)

| Звено | Точные path:lines |
|---|---|
| UI/docs | `/dashboard/organizations`, `/dashboard/organizations/[ogrn]`; profile CRUD/join `src/app/dashboard/profile/page.tsx:114-185,280-360`; verification queue (см. B-04) |
| API | `app/api/v1/profiles.py:141-255` orgs create/join/patch/submit, `:256-345` manager queues; `app/api/v1/nioktr.py:192-269` organizations list/detail (public registry) |
| DB | `models.py:501-528` Organization (импорт, read-only) vs `:719-747` UserOrganization (модерируемая, OGRN intentionally nonunique) + `:750-770` OrganizationMember (pair-unique только в DB); competencies — JSONB-поле `Organization.competencies` (`models.py:510`), не сущность |
| Authorization | org edit/submit — membership/admin; review — manager; публичный реестр — optional-user + limiter |
| Tests | `test_profiles.py`, `test_profile_admin.py`, `test_nioktr.py`, `test_registries.py` |
| Verdict | **ok с оговоркой**: две агрегатные таблицы задокументированы, канонического merge/sync-сервиса нет (→ IA-10 часть); race/double-submit (→ FE03-09/FE03-10 Medium). Отдельного дефекта сверх T01/T03 нет |

### B-09. Реестры: проекты / организации / технологии / компетенции-исполнители + поиск/фильтры/пагинация

| Подреестр | Цепочка | Verdict |
|---|---|---|
| Проекты | UI `/`, `/projects`, `/dashboard/projects`, `/dashboard/technologies(?ugt_min=7)` → `GET /projects/registry?ugt_min/ugt_max/category/budget/cursor/limit` (`projects.py:228-303`: keyset `(current_level,updated_at,id)`, limit 20..100, `enforce_registry_limit`) → `Project.is_public` + Replica (`projects.py:228-240`) → optional-user + registry limiter (anon/auth окна) + nginx registry 100r/s → тесты `test_registries.py`, `test_registry_hardening.py`, frontend `landing-registry`/`registry`/`registry-table` | **разрыв фильтров/курсора**: backend не принимает `status/search/region/tags` (`projects.py:228-240`), UI шлёт и фильтрует status локально по странице 20 (`useRegistry.ts:13-22,72-111`, `api-client.ts:109-132`) → IA-06 Confirmed Medium; + клиентская пересортировка ломает keyset-курсор → FE03-04 Medium Confirmed (craft: FE03-04 High→Medium; IA-06 subset внутри, cursor/search/region-часть retained отдельно) |
| Организации | UI `/dashboard/organizations` → `GET /nioktr/organizations` (`nioktr.py:192-232`, lateral card-count, Replica, limiter) → `Organization` + NIOKTR-count → optional-user | **ok-ядро / stale-race**: FE03-09 Medium Confirmed (abort/request-id нет в nioktr/orgs/executors, в отличие от `useRegistry.ts:69-83`) |
| Технологии | UI `/dashboard/technologies` (`page.tsx:25-45` намеренно Projects UGT≥7) vs API `GET /technologies` (`technologies.py:13-88`, пагинация+фильтры → `Technology` ORM `models.py:668-687`) | **разрыв split-source-of-truth** → FE03-11; craft: **Probable** до решения каноничности (Project-проекция vs Technology-реестр); remediation — выбрать канон, join/migrate, UI↔canon equality-test. Маркер: **API-only** (`/technologies` без потребителя) |
| Компетенции/исполнители | UI `/dashboard/executors` + matching-фильтры → `GET /executors/specialists\|/organizations` (`executors.py:252-327`, default 20, keyset/offset) → verified User/Profile/Organization; компетенции — только JSONB-поле, отдельного реестра нет | **частично**: FE03-08 первые-20-навсегда Medium Confirmed (UI без limit/after_id/offset + client-slice); standalone competency-registry отсутствует → IA-10 часть (Confirmed отсутствие; гипотеза о необходимости — отдельно по craft). Маркер: **schema-only** (competencies как JSONB) |
| Поиск/фильтры/сорт/пагинация (сквозное) | URL-фильтры → consumers выше; saved-filters `SavedFilters.tsx:35-165` → `api-client.ts:517-553` `/filters/saved*` → **backend route отсутствует** (негатив `evidence/03:38-41`) → fallback unbounded localStorage (`saved-filters/storage.ts:1-63`, quota swallow) + BLOCKED-маркер | → IA-07 Medium Confirmed (craft: backend-gap и намеренный localStorage раздельно) + FE03-12 часть (template/split: template→IA-05, filters→IA-07, не схлопывать). Маркер: **UI-only** (server-persistence) |

### B-10. Matching / recommendations / AI-assistant / RAG

| Звено | Точные path:lines |
|---|---|
| UI/docs | `src/features/matching/MatchingMode.tsx:194-362,562-758` (match/rerank/proposal), `src/features/matching/llm.ts:48-255` (browser provider), `src/features/matching/sanitize.ts:59-153` (PII-check), `src/app/dashboard/ai-assistant/page.tsx:48-97`, `src/features/docs/AiDocConsultant.tsx:56-90` |
| API | `POST /match` (`match.py:14-31`, CurrentUser); `POST /chat{,/tuno,/kaba}` (`chat.py:36-76`, per-user limiter); `POST /rag/search`, `GET /rag/templates` (`rag.py:13-65`); gateway `app/services/ai_assistant.py:48-111` (queue 2s/call 8s/sem 4, default-off `core/config.py:71-79`) |
| DB | `Organization` retrieval + `RagDocument` pgvector-1536 (`models.py:464-498`, миграции `0002/0005/0029/0036`); эмбеддинги офлайн `semantic-ru-v2` (`embeddings.py:22-24,246-261`) |
| Authorization | match/chat/rag-search — любой authenticated; rag-write — manager/admin; registry-limiter на публичных; contour — таксономия, не clearance (`rag.py:36-65` отдаёт все contour всем auth — T05) |
| Tests | `test_semantic_embeddings.py:76-216` (synonyms/rerank), `test_llm_gateway.py` 7/7 (disabled-path), `test_llm_hardening.py:59-238` (injection/parser), `test_ai_assistant.py:52-78` (200-fallback), `test_chat.py`; frontend `matching.test.mjs` 7/7 (source-grep, `rerankWithLlm` не исполняется, bundle с секретом не инспектируется) |
| Verdict | **поиск/ранжирование существует; медиация и граница — разрывы**: IA-01/FE03-01/05-01 browser-LLM credential+bypass (`llm.ts:48-65,157-176,236-255`, `MatchingMode.tsx:259-273`, `.env.example:16-24`) — **High** по craft (Critical только если ключ реально настраивался; CSP `middleware.ts:16-30` блокирует чужой host → configured-feature недоступна); IA-02/FE03-05 proposal-логирует и тостит без сети (`MatchingMode.tsx:182-192`, `MatchCard.tsx:72-85`, `services/matching.py:3-11` MatchRequest только в комментарии) — false-success (Backend-doc обещает MatchRequest→модерация→Notification); 05-02 value-level DLP/prompt-delimiters отсутствуют (`ai_assistant.py:56-180`, `matching.py:199-235`, `sanitize.ts`) — High; 05-04 `AI_APICallError`→None→200 без `mode/degraded/error_code` (`ai_assistant.py:56-196`, `schemas.py:382-384`, `chat.py:29-49`) — Medium; 05-05 unbounded `message/history/query/top_k` (`schemas.py:308-323,372-375`, `rag.py:115-212`, `embeddings.py:196-261`) + B02-004/DB-05 dedup (только unbounded-large по craft; cost-часть Probable без нагрузки); 05-06 свободный текст как rerank/explanation (`matching.py:110-276`, `llm.ts:186-337`) — Medium; FE03-02 конкурентный refresh revokes family (`auth.config.ts:61-102` vs `auth.py:112-164` + захардкоженные 55 мин vs `config.py:63-64`) — High; FE03-18 очередь ни к чему не подключена (`queue.ts:134-153`, `useOfflineQueue.ts:102-109`, providers только `OfflineBanner`) — Medium distinct; FE03-19 watcher-vs-modal race (`providers.tsx:10-22` vs `dashboard/layout.tsx:118-125`, `SessionExpiredModal.tsx:41-205`) — Probable Medium |

### B-11. Конфиденциальность, PII, offline/auth-граница

| Звено | Точные path:lines |
|---|---|
| UI/docs | Auth.js Credentials (`auth.config.ts:24-119`, access+refresh в JWT), JWT-cookie→Bearer; очередь `queue.ts:11-153,189-289` (Authorization вычищается при записи, инжектится при sync; originating-user не записывается); canvas/PII в localStorage (`ProjectCard.tsx:69-123`) |
| API | Bearer-JWT (не cookie → cookie-CSRF не подтверждён, T02); BOLA-guard + 404-маскировка (`projects.py:169-195`); notifications строго `user.id` (`notifications.py:43-53`); SSE одноразовый ticket, token-in-URL→400 (`realtime.py:142-184`); login/refresh throttle (Redis+in-memory) |
| DB | tenant_id нет — граница creator/membership/staff; `QuestionnaireResult.user_id` NOT NULL+SET NULL → delete-user блокируется (→ DB-01 High); `0032` read-isolation; audit каскадно удаляется с проектом (`models.py:449-460`) — operational log, не immutable |
| Authorization | middleware fail-closed + backend авторитет (см. B-01); publish/project/achievements/news ниши выше; RAG search всем auth без clearance-меток (T05, не отдельный ID — taxonomy) |
| Tests | `test_rbac_projects.py`, `test_privileged_roles.py`, `test_project_scope.py`, `test_publication_privacy.py`, `test_questionnaire_isolation.py`, `test_auth_refresh.py`, `test_refresh_atomic.py`, `test_auth_throttle.py`, `test_sse_ticket.py`, `test_realtime_notifications.py`; frontend `offline.test.mjs` 10/10 (данный таск, queue-sanitize/merge), `routes-matrix` 7/7 |
| Verdict | **ok-ядро / точечные утечки**: B02-001 (High), B02-006 MinIO-detail→`STORAGE_UNAVAILABLE.detail` (`file_storage.py:95-244`, `errors.py:144-147`) — Low; FE03-01/05-01 PII-egress через browser-LLM — High (условно); 05-02 server-DLP — High; FE03-07 локальная PII без TTL/clear — Medium (в составе). Offline-replay без записанного originating-user — отмечено как ограничение, отдельным ID не выносится (нет T01–T05 покрытия? см. ниже — решено не выносить: это следствие FE03-18 disconnected + отсутствие auth-binding, confidence Suspicious без runtime; по правилу «не создавать ради количества» — ноль новых) |

## Отдельные маркеры неполных цепей

- **UI-only** (нет API/ORM): proposal-CTA успех (`MatchingMode.tsx:182-192`); canvas-autosave durability (`ProjectCard.tsx:69-123` + `ActionsPanel.tsx:153-167` «saved»); template-fallback PDF-blob (`template.ts:46-120`); saved-filters server-persistence (`api-client.ts:517-553` vs пустой backend-grep); technology-канон выбор (UI-проекция без binding к `/technologies`).
- **API-only** (нет UI-потребителя): `POST /projects/{id}/generate/{doc_type}` (`generation.py:14-35`, frontend-grep empty); `GET /technologies` (`technologies.py:13-88`, UI ходит в registry-projection).
- **Schema-only** (нет API/UI-цепи): `competencies` как JSONB (`models.py:510`) без registry-сущности; `MatchRequest` только в комментариях (`services/matching.py:3-11`, `MatchingMode.tsx:183`); canvas-поля без таблицы/эндпоинта.
- **Testless** (нет контракта нигде): Goal/Task/Result lifecycle; proposal journey create→retry→moderation→notify; template `%PDF-`/content-disposition интеграция; saved-filter cross-device/ownership/limits HTTP; generation denial/timeout/retry UI-интеграция (backend `test_document_generation.py` покрывает только substitution, не UI-цепь); offline replay для реальных мутаций (очередь покрыта unit 10/10, потребители отсутствуют).
- **Docs-only** (не дефект без шва): root `README.md:1-59` quick-start `head=0027`/счётчики 334/39 против head `0037`/CI-gates → IA-09 Low Confirmed doc-drift (craft: impact не преувеличивать); browser-matrix pending-семьи (`browser-matrix.md:7-21`) — заявленное ограничение, не находка.

## Дедупликация с T01–T05 и craft-применение

| Строка B-* | Существующий ID (канон) | Применение |
|---|---|---|
| B-01 KT | IA-03, IA-04, FE03-03 | merge; FE03-03 Medium (backend авторитет, reload правит) |
| B-01 draft-notify | B02-003 | Medium Confirmed, без изменений |
| B-01 audit | B02-005 | Medium Confirmed |
| B-01 perf | DB-03 (Medium N+1 по craft), DB-04 (группа unbounded+order-index), DB-14 (один текст long-tx) | DB-03 High→Medium; DB-14 склеен |
| B-02/B-03 results | IA-10 (часть), FE03-16, FE03-07 | IA-10: отсутствие Confirmed, гипотеза необходимости отдельно/понижена; FE03-07 local-autosave отдельно от IA-10 |
| B-04 join-leak | B02-001 | High Confirmed |
| B-04 news-preview | FE03-14 | Probable Low (stored санитизируется) |
| B-05 transfer | B02-002 | High Confirmed; инвариант «≤1 admin», не «=1» |
| B-05 register | FE03-06 | Medium Confirmed (зависимость backend-allowlist+product-policy) |
| B-05 dup/errors | FE03-10 (Medium), FE03-13 (Low) | без изменений |
| B-06 | IA-03/IA-04/FE03-03 | см. B-01 |
| B-07 template | IA-05 + FE03-12 (часть) | Medium; split template vs filters, не схлопывать |
| B-07 generation-UI | FE03-17 | Medium distinct (IA-05 — про download, не generation) |
| B-07 binary-blind | 05-03 | High Confirmed |
| B-07 AV/lifecycle | 05-07 (High), 05-08 (Medium), DB-02 split (race + orphan) | DB-02 разбит по craft |
| B-08 two-orgs | IA-10 (часть) + FE03-09/10 | без нового ID |
| B-09 registry-status | IA-06 + FE03-04 | FE03-04 Medium по craft; IA-06 subset внутри, cursor/search retained |
| B-09 executors-20 | FE03-08 | Medium Confirmed |
| B-09 tech-split | FE03-11 | **Probable** по craft до канонизации API |
| B-09 saved-filters | IA-07 + FE03-12 (часть) | Medium; localStorage-намеренность отдельно |
| B-09 races | FE03-09 | Medium Confirmed |
| B-10 browser-LLM | IA-01 + FE03-01 + 05-01 | **High** по craft (Critical только при реально настроенном ключе); CSP-часть retained |
| B-10 proposal | IA-02 + FE03-05 | merge в одну false-success цепь |
| B-10 DLP | 05-02 | High Confirmed |
| B-10 degraded-200 | 05-04 | Medium Confirmed (не-AI не падает — позитив) |
| B-10 unbounded-AI | 05-05 + B02-004 + DB-05 | dedup тройки; только unbounded-large; cost Probable |
| B-10 rerank-hallu | 05-06 | Medium Confirmed |
| B-10 refresh | FE03-02 | High Confirmed (frontend+backend один контракт) |
| B-10 offline/session | FE03-18 (Medium distinct), FE03-19 (Probable, cross-ref FE03-02/07) | без слияния |
| B-11 minio-detail | B02-006 | Low Confirmed |
| B-11 questionnaire-FK | DB-01 | High Confirmed (NOT NULL vs SET NULL) |
| B-11 docs-drift | IA-09 | Low doc-drift, impact не преувеличивать |

**Новых кандидатов: 0.** Все наблюдаемые разрывы покрыты IA/B02/FE03/DB/05-ID выше. Кандидаты из непокрытых зон (RAG-всем-auth без clearance, offline-replay без originating-user) не выносятся: первое — таксономия без tenant-модели по дизайну (нужен product-policy вход), второе — следствие FE03-18 с Suspicious-уверенностью без runtime; по Критериям качества («не создавать ради количества») и правилу docs-vs-шов — ноль новых ID, честно.

## Глубинные состояния (сводно по §11-направлению)

- Первый запуск: public probes/registry/templates-read пустые ответы ok; README `head=0027` вводит в заблуждение (IA-09); LLM/key absent → fallback ok, но CSP делает configured-LLM недоступным (FE03-01-часть).
- Пустые данные: списки/empty-states представлены; matching fallback при пустом фильтре неотличим от слабых совпадений (`matching.py:142-179`, T01) — product-валидация нужна, не отдельный ID.
- Ввод/границы: Pydantic-bounds + 25МБ/32МБ есть; gaps — RAG/chat lengths/top_k, filename/title, archive-complexity (05-05/05-08, B02-004/DB-05 dedup).
- Отказ зависимости: readiness fail-closed (`health.py:86-107`); frontend синтезирует данные/успех (IA-02/03/04/05/07) — главный архитектурный риск (T01); ClamAV-hang без deadline (05-07); деградация AI неразличима (05-04).
- Прерывание/повтор: refresh/invite-claim/task-claim атомарны; transfer/draft-notify нет (B02-002/B02-003); дубли submit (FE03-10); offline-retry ни к чему не подключён (FE03-18); composed browser→API retry-journey отсутствует в CI.
- Рост: registry keyset есть, но курсор/фильтры сломаны (IA-06/FE03-04/FE03-08/FE03-09); unbounded очереди/листы (DB-04); AI без quotas (05-05 Probable-cost).
- Роли/организации: resource-scoped backend-тесты + route-matrix shape-тест (не живой NextAuth); доказанная BOLA — B02-001; RAG всем-auth — дизайн-ограничение без tenant-модели.
- Последствия/обратимость: audit/version/snapshots есть, но B02-005 неполон; archive без unarchive-API; delete/object-remove необратимы; downgrade-пути DB-08/09/11/13 (склейка DB-09/13 по craft); live PITR/offsite/browser-matrix — не заявлены как пройденные.

## Верификация

- `git rev-parse HEAD` → `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`; продукт неизменён (только `.autopilot/`).
- `cd technozrelost-frontend && node --test tests/offline.test.mjs` → **10 passed, 0 failed** (queue sanitize/merge; подтверждает B-11 механизм, не покрытие потребителей — FE03-18 остаётся).
- Read-only greps: route inventory 111 маршрутов/25 роутеров сверён с T02; App Router 44 pages + 3 layouts + 1 handler сверён с T03; ORM 36 классов + 3 association + 35 revisions сверены с T04; `/generate/`-потребители empty, `/templates/{id}`+`/filters/saved` empty, canvas/goal greps empty — подтверждены.
- DB-рантайм (EXPLAIN/counts/downgrade/upgrade, live MinIO/ClamAV/LLM, browser smoke, composed HTTP journey): **BLOCKED** — нет безопасного disposable harness/кредов; зафиксировано как ограничение уверенности, не pass (Метод п.6).
- Существующие suites приняты по evidence T01–T05 без перезапуска DB-пулов: frontend 182 green (T03), backend focused 36/36 RBAC/security (актуально по craft, не BLOCKED), LLM-gateway 7/7 + matching 7/7 (T05, capture-stub), KT-panel 8/8 + routes 7/7 (T01, со слабым source-grep покрытием).

## Статус требований

- R34 (заявленное vs фактическое): done — каждая доменная способность классифицирована ok/частично/missing с трассой выше.
- R35 (матрица UI/docs→API→ORM/DB→authorization→test): done — B-01..B-11 + отдельные маркеры UI-only/API-only/schema-only/testless.
- R03–R16 (карта-контекст по тикету): covered by reference — языки/точки входа/границы/хранилища/роли/наблюдаемость/CI из T01 (`evidence/01`), здесь только бизнес-следы.
- R36–R40 (формат): N/A для T09 — новых AUD-кандидатов нет; дедуп-таблица даёт вход консолидации T10.
