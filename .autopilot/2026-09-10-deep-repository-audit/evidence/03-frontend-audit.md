# Evidence 03: frontend, routes and client security

## Baseline and method

- Checkout: `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, branch
  `audit/deep-repository-20260910`, inspected 2026-09-10.
- Scope read: every `src/app/**/{page,layout,route}.tsx?`, `src/middleware.ts`, auth/session,
  API client and raw consumers, offline/notifications, registry, matching, project, documents,
  team, profile and news surfaces. Backend endpoints were read where needed to establish the
  HTTP/authorization contract. No `.env`, product file, dependency or lockfile was changed.
- Confidence follows `interfaces.md`: Confirmed means an exact static trace and complete
  scenario; Probable/Suspicious explicitly identifies the missing runtime premise.

### Reproducible inventories

- Route inventory command:
  `git ls-files 'technozrelost-frontend/src/app/layout.tsx' 'technozrelost-frontend/src/app/**/page.tsx' 'technozrelost-frontend/src/app/**/layout.tsx' 'technozrelost-frontend/src/app/**/route.ts'`.
  Output: **48 tracked App Router surfaces**: 44 pages, three layouts and one route handler.
- Complete page output, converted from source paths to runtime routes:
  `/`, `/about`, `/customers`, `/performers`, `/projects`, `/roadmap`, `/methodology`,
  `/levels`, `/levels/[id]`, `/news`, `/news/[id]`, `/login`, `/register`, `/join/[token]`,
  `/assessment/new`, `/forbidden`, `/dashboard`, `/dashboard/ai-assistant`,
  `/dashboard/auditor`, `/dashboard/cntr_admin`, `/dashboard/cntr_manager`,
  `/dashboard/executors`, `/dashboard/gk_customer`, `/dashboard/gk_customer/projects`,
  `/dashboard/gk_customer/projects/new`, `/dashboard/investor`, `/dashboard/matching`,
  `/dashboard/news`, `/dashboard/news/admin`, `/dashboard/news/new`,
  `/dashboard/news/[id]/edit`, `/dashboard/nioktr`,
  `/dashboard/nioktr/[registration_number]`, `/dashboard/notifications`,
  `/dashboard/organizations`, `/dashboard/organizations/[ogrn]`, `/dashboard/profile`,
  `/dashboard/project/[id]`, `/dashboard/projects`, `/dashboard/rd_executor`,
  `/dashboard/regulating_organization`, `/dashboard/scientific_org`,
  `/dashboard/serial_manufacturer`, `/dashboard/technologies`. Layouts are root and landing;
  root, landing and `/dashboard/layout.tsx`; the last is the authenticated shell. The sole route handler is
  `/api/auth/[...nextauth]`.
- Boundary-file negative command:
  `git ls-files 'technozrelost-frontend/src/app/**/loading.tsx' 'technozrelost-frontend/src/app/**/error.tsx' 'technozrelost-frontend/src/app/**/global-error.tsx' 'technozrelost-frontend/src/app/**/not-found.tsx'`.
  Output: **empty**. This proves the absence asserted below rather than inferring it from a sample.
- Backend negative-contract command:
  `git grep -n -E '(prefix="/templates"|@router.*template_id|prefix="/filters"|filters/saved)' -- technozrelost-backend/app`.
  Output: **empty**. `/rag/templates` is a different API and does not satisfy
  frontend `/templates/{id}` or `/filters/saved*`.
- Persisted project-planning command:
  `git grep -n -E '(class .*Canvas|__tablename__ = "(goals|tasks|project_results|canvas)"|@router.*canvas)' -- technozrelost-backend/app`.
  Output: **empty**.
- Matching proposal command:
  `git grep -n -E '(matching.*propos|match.*request|candidate.*request|@router.*propos)' -- technozrelost-backend/app/api technozrelost-backend/app/db/models.py`.
  Output: **empty**.
- Frontend generation command: `git grep -n '/generate/' -- technozrelost-frontend/src`.
  Output: **empty**.
- XSS-sink command:
  `git grep -n -E 'dangerouslySetInnerHTML|innerHTML|eval\(|new Function|document\.write' -- technozrelost-frontend/src`.
  Output: exactly `news-editor.tsx:604` and `landing/news-detail.tsx:81`; both flows are
  adjudicated in FE03-14.

## Complete App Router route / role / API matrix

Role abbreviations: `all9` = all slugs at `src/lib/roles.ts:63-73`; `staff` =
`cntr_admin|cntr_manager`; `exec6` = customer/executor/scientific/manufacturer/staff.
Middleware authentication and fail-closed role enforcement are at
`technozrelost-frontend/src/middleware.ts:44-105`; dynamic segment matching and default deny
are at `technozrelost-frontend/src/lib/roles.ts:181-215`.

To keep every consumer visible without repeating four endpoints in every dashboard row, `D` means
the mounted dashboard layout consumers: conditional Auth.js `POST /auth/refresh`, plus bell
`GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/sse-ticket`, and
`GET /notifications/stream?ticket=` (`dashboard/layout.tsx:40-124`,
`components/notification-bell.tsx:50-163`, `auth.config.ts:61-102`). `E` means the additional
registry realtime connection: `POST /notifications/sse-ticket` and `GET /notifications/stream`
(`features/registry/useRealtime.ts:14-65`). Backend verdict `CurrentUser` means JWT authentication
is repeated server-side; it never relies on the middleware role check alone.

| Route | UI access | All actual route consumers | Backend enforcement verdict |
|---|---|---|---|
| `/` | public | `GET /projects/registry?limit=3` | Optional user; query returns public projects only and is rate-limited (`projects.py:228-303`) |
| `/about` | public | **none**; translations/static content only | No backend seam |
| `/customers` | public | **none**; translations/static content only | No backend seam |
| `/performers` | public | **none**; translations/static content only | No backend seam |
| `/projects` | public | `GET /projects/registry` | Optional user; public-only rows and registry rate limit |
| `/roadmap` | public | **none**; local methodology dictionary | No backend seam |
| `/methodology` | public | **none**; local methodology content | No backend seam |
| `/levels` | public | **none**; local UGT dictionary | No backend seam |
| `/levels/[id]` | public | **none**; local UGT dictionary | No backend seam; unknown ID handled by page |
| `/news` | public | `GET /news`, `GET /news/categories` | Public feed exposes only published posts/categories (`news.py:190-238,310-338`) |
| `/news/[id]` | public | `GET /news/{id}` (also metadata render) | Public request receives only published post; missing/unpublished is 404 (`news.py:341-372`) |
| `/login` | anonymous; authenticated user redirected | Auth.js credentials -> `POST /auth/login`; later JWT callback may `POST /auth/refresh` | Login validates credentials; refresh validates and atomically rotates refresh family |
| `/register` | anonymous; authenticated user redirected | `POST /auth/register` | Server allowlists self-registerable roles and rejects privileged slugs (`auth.py:44-60`) |
| `/join/[token]` | public URL; unauthenticated user redirected to login | authenticated action chooses `POST /invites/accept` for `INV-*`, otherwise `POST /projects/join` | `CurrentUser`; server validates token, role and membership/invite state |
| `/assessment/new` | public alias | **none**; immediate redirect to `/dashboard/gk_customer/projects/new` | Destination is independently middleware-guarded |
| `/forbidden` | public 403 target | **none** | Middleware rewrites denied dashboard request with status 403 |
| `/dashboard` | `all9` | **none**; server redirects to primary-role dashboard | Middleware authenticates and role target is selected from server session |
| `/dashboard/ai-assistant` | `exec6` | `D`; `POST /chat` | Chat requires `CurrentUser`; middleware narrows UI roles |
| `/dashboard/auditor` | `auditor` | `D`; `GET /projects`, `POST /projects/join` | `CurrentUser`; projects scoped to creator/membership/staff, join validates token/role |
| `/dashboard/cntr_admin` | `cntr_admin` | `D`; `GET /projects`, `POST /projects/join`; `GET /manager/{profiles,orgs}`, `POST /manager/{profiles,orgs}/{id}/decide`; `GET /admin/achievements/stats`, `GET /nioktr/organizations` | All authenticated; manager/admin guards on queues/stats, project and registry server scopes remain authoritative |
| `/dashboard/cntr_manager` | `cntr_manager` | `D`; `GET /projects` (shell and analytics), `POST /projects/join`; `GET /manager/{profiles,orgs}`, `POST /manager/{profiles,orgs}/{id}/decide` | `CurrentUser`; manager/admin guard on verification, project scope and join validation server-side |
| `/dashboard/executors` | `exec6` | `D` + `E`; tab-dependent `GET /executors/specialists` or `GET /executors/organizations` | Optional-user public verified catalogs, rate-limited and paginated (`executors.py:252-327`) |
| `/dashboard/gk_customer` | `gk_customer` | `D`; `GET /projects`, `POST /projects/join` | `CurrentUser`; project membership/creator scope and join validation |
| `/dashboard/gk_customer/projects` | inherited customer prefix | **none**; immediate redirect to `/dashboard/projects` | Destination is independently `all9`-guarded |
| `/dashboard/gk_customer/projects/new` | `all9` specific override | `D`; public `GET /assessments/template`, authenticated `POST /assessments` | Template is intentionally public; create requires `CurrentUser` and validates questionnaire/version (`assessments.py:142-175`) |
| `/dashboard/investor` | `investor` | `D`; `GET /projects`, `POST /projects/join` | `CurrentUser`; project membership/creator scope and join validation |
| `/dashboard/matching` | `all9` | `D`; `GET /projects`, `POST /match`; optional browser call to configured external LLM provider; proposal CTA has **no consumer** | Project/match APIs require `CurrentUser`; external provider bypasses backend; proposal has no enforcement/persistence |
| `/dashboard/news` | `all9` | `D`; role-dependent `GET /news` and/or `GET /news/admin-list`; staff actions `POST /news/{id}/publish|unpublish` | Feed public/published-only; admin-list requires staff; writes require author or admin (`news.py:190-264,459-527`) |
| `/dashboard/news/admin` | `staff` | `D`; `GET /news/admin-list`, `GET /news/categories`; `POST /news/{id}/publish|schedule|unpublish`; `DELETE /news/{id}` | Admin-list requires staff; mutations enforce author/admin (`news.py:264-338,459-551`) |
| `/dashboard/news/new` | `staff` | `D`; `GET /news/categories`; `POST /news`, then possible `PATCH /news/{id}`, publish/schedule and media upload/delete | Create requires staff; later writes enforce author/admin and file validation (`news.py:375-633`) |
| `/dashboard/news/[id]/edit` | `staff` | `D`; `GET /news/categories`, `GET /news/{id}`; `PATCH /news/{id}`, publish/schedule and media upload/delete | Non-public detail and every mutation enforce author/admin; middleware adds staff route guard |
| `/dashboard/nioktr` | `all9` | `D` + `E`; `GET /nioktr` | Optional user; public registry rate limit and bounded paging (`nioktr.py:163-189`) |
| `/dashboard/nioktr/[registration_number]` | `all9` | `D`; `GET /nioktr/{registration_number}` | Optional-user public detail; server 404/rate-limit contract (`nioktr.py:272-285`) |
| `/dashboard/notifications` | `all9` | `D`; page independently repeats `GET /notifications`, `POST /notifications/{id}/read`, ticket and stream | Every list/read/ticket is `CurrentUser`; notification ownership and one-time ticket are server-enforced |
| `/dashboard/organizations` | `all9` | `D` + `E`; `GET /nioktr/organizations` | Optional-user public registry with rate limit/paging (`nioktr.py:192-232`) |
| `/dashboard/organizations/[ogrn]` | `all9` | `D`; `GET /nioktr/organizations/{ogrn}` | Optional-user public detail and server 404/rate-limit contract (`nioktr.py:235-269`) |
| `/dashboard/profile` | `all9` | `D`; `GET/PATCH /profile`, `POST /profile/submit`, `POST /orgs`, `POST /orgs/{id}/join`, `GET /achievements/mine` | All require `CurrentUser`; profile state and organization membership/creation rules enforced server-side |
| `/dashboard/project/[id]` | `all9` route | `D`; `GET /projects/{id}`, draft-only `GET /assessments/mine`; `GET /gost-requirements`, `GET /projects/{id}/stage-requirements`; stage document upload and evaluation APIs; verification-document load/create APIs; request load/comment/conclusion-PDF APIs; team load/invite/revoke/ownership-transfer/legal-status APIs; `POST /rag/search`, `POST /chat/kaba`; `PATCH /projects/{id}/control-points/{cp}`; nonexistent `GET /templates/{id}`; `GET/POST /projects/{id}/files`, `GET /files/{id}/download`, `POST /files/{id}/rescan`; `PUT /projects/{id}/publish`, `POST /projects/{id}/archive`, `GET /projects/{id}/export`, `POST /projects/{id}/regenerate-token` | Real APIs require `CurrentUser`; stage evaluation, verification documents, request comments/conclusion, and team invite/transfer/legal APIs enforce project access plus stage/verifier/project-admin rules as applicable; other project/file/actions enforce membership/owner/staff/assigned-verifier as applicable; `/templates/{id}` has no backend route |
| `/dashboard/projects` | `all9` | `D`; `GET /projects/registry` | Optional-user public-only registry; this is not private `/projects` membership scope |
| `/dashboard/rd_executor` | `rd_executor` | `D`; `GET /projects`, `POST /projects/join` | `CurrentUser`; project membership/creator scope and join validation |
| `/dashboard/regulating_organization` | `regulating_organization` | `D`; `GET /projects`, `POST /projects/join` | `CurrentUser`; project membership/creator scope and join validation |
| `/dashboard/scientific_org` | `scientific_org` | `D`; `GET /projects`, `POST /projects/join` | `CurrentUser`; project membership/creator scope and join validation |
| `/dashboard/serial_manufacturer` | `serial_manufacturer` | `D`; `GET /projects`, `POST /projects/join` | `CurrentUser`; project membership/creator scope and join validation |
| `/dashboard/technologies` | `all9` | `D`; `GET /projects/registry?ugt_min=7` | Optional-user public project registry; implemented authenticated `/technologies` API is not consumed |

The non-page App Router handler `/api/auth/[...nextauth]` exposes Auth.js actions/session to the
browser and consumes backend `POST /auth/login` and `POST /auth/refresh`; credential and refresh-token
validation is server-side (`src/auth.config.ts:25-102`, `app/api/v1/auth.py:65-164`). Thus the table
accounts for all 44 pages while retaining the sole route-handler seam separately.

There are no `loading.tsx`, `error.tsx`, `global-error.tsx`, or `not-found.tsx` files under
`src/app`. Client-heavy domain pages generally implement local loading/error/empty UI; server
landing failures therefore fall through to the framework-level production error response.

## Domain / business chain coverage

| Capability | UI -> API -> persistence/auth -> tests | Verdict |
|---|---|---|
| Project lifecycle | assessment wizard -> `POST /assessments` -> Project/questionnaire rows; manager queue -> decisions; publish/archive/export -> Project + audit, backend owner/member/staff checks | **Partial**: principal lifecycle persists; canvas and planning entities do not (F07/F16), KT can misstate failure (F03) |
| Goals and tasks | roadmap has static dictionary tasks; project canvas has free-text transition plan only -> no goal/task HTTP -> no Goal/Task ORM -> no authorization/test seam | **Missing persisted function**, F16 |
| Results | assessment readiness result persists; project “results” is a local canvas string -> no project-result HTTP/ORM/auth/test | **Partial**, F07/F16 |
| Achievements | profile/project cards -> `GET /achievements/mine`, `/projects/{id}/achievements`, admin stats -> Achievement/UserAchievement/ProjectAchievement (`models.py:981-1087`) -> current-user/project-access/admin guards; frontend tests exercise rendering | **Implemented read/display chain**; awarding is backend event-driven, not a frontend mutation |
| Publication/moderation | project actions -> `PUT /projects/{id}/publish`; news editor/admin -> create/update/publish/schedule/unpublish/delete -> Project/NewsPost and audit; owner/staff and author/admin guards | **Implemented**, with news raw-preview defense gap F14 |
| Teams/roles | role dashboards + join/invite/transfer/legal/profile verification -> membership/invite/profile APIs -> membership tables -> project-admin/manager checks | **Partial**: backend enforcement is present; registration options, duplicate submit and error states disagree (F06/F10/F13) |
| TRL/UGT and control points | assessment + UGT panels -> assessment/stage/control-point APIs -> Project/Assessment/ControlPoint -> current-user, project assignment and staff checks | **Partial**: authoritative backend exists; production UI fabricates fallback state (F03) |
| Document upload/check | project docs/stage/checklists -> file/stage/verification-doc APIs -> ProjectDocument/verification data -> project access, MIME/AV/storage and verifier checks | **Implemented core upload/check**, but missing template API falls back locally (F12) |
| Document generation | backend exposes `POST /projects/{id}/generate/{doc_type}` (`app/api/v1/generation.py:14-35`) -> generated document persistence/project access; no frontend call to `/generate/` exists | **Backend-only / missing UI chain**, F17 |
| Organizations | profile org CRUD + organization registry/detail -> `/orgs*`, `/nioktr/organizations*` -> Organization/OrganizationMember -> membership-admin/current-user or public-registry limits | **Implemented**, with stale race/double submit defects F09/F10 |
| Project registry | landing/dashboard -> `/projects/registry` -> public Projects + optional-user rate limit | **Broken at scale/filtering**, F04 |
| Organization registry | `/dashboard/organizations` -> `/nioktr/organizations` -> Organization + NIOKTR count, optional-user rate limit | **Implemented**, stale race F09 |
| Technology registry | `/dashboard/technologies` -> Project projection while `/technologies` -> separate Technology ORM/current-user | **Split source of truth**, F11 |
| Competency/executor registry | `/dashboard/executors` + matching filters -> executor specialist/org endpoints -> verified User/Profile/Organization data, public registry limit | **Partial**: first 20 only, F08 |
| Search/filter/sort/pagination | URL filters -> project/NIOKTR/org/executor consumers -> respective query contracts | **Partial/broken**: unsupported filters, incorrect cursor and stale races F04/F08/F09 |
| Matching/recommendations | form -> authenticated `/match` -> verified candidates; optional browser rerank; proposal CTA | **Partial**: match works, proposal is false success F05, LLM boundary unsafe F01 |
| AI assistant | `/dashboard/ai-assistant` -> authenticated `/chat`; doc consultant -> authenticated chat/RAG -> backend gateway with queue/timeout | **Implemented gateway path**; direct matching LLM bypasses it (F01) |
| Confidentiality/offline | Auth.js JWT cookie/session -> Bearer APIs; queue removes Authorization at write and injects current token at sync; server BOLA checks protect records | **Partial**: no queue token persistence found, but queue is disconnected and session draft flow races; public LLM key/free-text PII and local canvas data remain F01/F07/F18/F19 |

## Complete form and mutation inventory

The inventory started from all `<form`/`onSubmit` occurrences and all async handlers that call
`fetch`/`api-client`; button-only mutations are included so “forms” does not hide non-form writes.
Reproduction: `git grep -n -E '(<form|onSubmit=|type="submit")' -- 'technozrelost-frontend/src/**/*.tsx' | wc -l`
returned **13 textual form/submit seams**; the async mutation-handler expression recorded in the
audit command log returned **29 handlers**. The table resolves those seams to user-visible surfaces,
including non-form buttons and shared components rather than treating raw match count as coverage.

| Surface / source | Mutation and validation | Double submit / loss / state verdict |
|---|---|---|
| Login `app/login/page.tsx:17-90` | Credentials sign-in; native email/required | loading disables submit; fields survive API error; callback target unvalidated F15 |
| Register `app/register/page.tsx:44-93,151-260` | `POST /auth/register`; required/email/minLength 8 | loading guard present; backend error shown; offered roles mismatch F06 |
| Join token page/form `app/join/[token]/join-token-client.tsx:53-90`, `components/join-project-form.tsx:43-150` | `POST /projects/join`; token/role UI checks + backend authority | joining/loading guards present; pending/error states explicit |
| Role-dashboard join `features/dashboard/RoleDashboardShell.tsx:208-259,340-366` | token normalized and regex-validated, `POST /projects/join` | joinLoading disables; success reload/navigation; no draft involved |
| Assessment wizard `questionnaire-wizard-client.tsx:290-343,391-403` | name, NA-comment and server template/version checks; `POST /assessments` | saving guard present; answers retained after error; **no internal-navigation/unload draft protection** |
| Profile save/submit `app/dashboard/profile/page.tsx:114-153,280-295` | PATCH/POST profile; no HTML constraints beyond backend schema | no pending guard; duplicate/conflicting writes F10; unsaved navigation unguarded |
| Organization create/join `profile/page.tsx:155-185,328-360` | POST org/join; name/nonempty ID only client-side | no pending guard, duplicate append/write F10; form data retained on error |
| Profile/org verification `components/profile-verification-queue.tsx:67-120,103-120,200-282` | manager decision endpoints; backend staff guard | per-item busy guard and forbidden/error/empty/retry states present |
| News create/edit/publish/schedule/media `components/dashboard/news-editor.tsx:231-357,429-781` | API payload validation + backend sanitizer/author guard | one global busy guard; errors preserve fields; raw preview F14; no route-leave guard |
| News admin delete `app/dashboard/news/admin/page.tsx:196-230` | delete confirmation + backend author/admin | busy/confirmation present; list reload after success |
| Dashboard news publish/unpublish `app/dashboard/news/page.tsx:122-148` | staff actions; backend author/admin | per-card busy supplied; API error state present |
| Project canvas `features/project/CanvasBlocks.tsx:90-172`, `ProjectCard.tsx:69-123` | local edits/tags only | local draft/autosave, no server mutation; internal navigation and durability F07 |
| Project publish/archive/export/token/share `features/project/ActionsPanel.tsx:56-143,177-220` | authorized API actions except local share/copy | per-action busy for writes; no synchronous re-entry guard, but disabled after render; errors visible |
| Project files `features/project/DocsPanel.tsx:93-181`, `components/project-files-panel.tsx:36-115` | multipart upload, download; backend size/MIME/AV/project access | upload guard/error/loading/empty; duplicate legacy panels use same contract |
| Stage document/evaluate `components/stage-progress-panel.tsx:30-88` | file upload + evaluation; backend access/stage checks | shared busy guard; error/loading present |
| Verification documents `components/verification-docs-panel.tsx:88-108,199-220` | POST metadata; native form submit + backend check | loading disables; explicit success/error; values retained on failure |
| Request comments/conclusion `components/request-comments-panel.tsx:90-205,213-316` | POST comment, GET PDF; backend project/request access | sending guard and empty/error states; draft retained on failure |
| Team invites/transfer/legal `components/project-team-panel.tsx:132-220,276-366` | POST invite/revoke/transfer, PATCH legal; server project-admin | no mutation busy guards F10; HTTP load errors misclassified F13 |
| KT decision/template `features/project/KtPanel.tsx:137-219,298-320` | PATCH decision, template download; backend assignment/staff | per-CP busy exists, but failed write becomes local success and requirements/template are fabricated F03/F12 |
| Matching/retry/proposal `features/matching/MatchingMode.tsx:194-362,562-580,625-758` | sanitized match/rerank; minimum-input check | match/retry loading guards and stale badge; concurrent rerun button is not disabled while stale; proposal has no mutation F05 |
| Saved filters `features/registry/saved-filters/SavedFilters.tsx:35-65,100-165` | save/delete API attempted then local fallback | save guard; delete lacks per-item busy; backend persistence absent F12 |
| Notifications `features/notifications/useNotifications.ts`, `NotificationsPage.tsx:40-140` | mark read | API error/reload/empty; repeated read is server-idempotent state change |
| AI/document consultant `app/dashboard/ai-assistant/page.tsx:48-91`, `features/docs/AiDocConsultant.tsx:56-90` | POST chat/RAG | loading guard and error state; no document generation call F17 |
| Sign-out `app/dashboard/layout.tsx:99-107` | Auth.js server action | framework pending state not surfaced; no domain data mutation |

## Findings

### FE03-01: Browser LLM integration publishes the provider credential and does not actually guarantee de-identification

- Category: Security / privacy; proposed severity **High**; confidence **Confirmed**. Severity is
  conditional on deployment setting the explicitly documented public key; absent that setting the
  runtime takes a script fallback, so this is not proposed as platform-wide Critical.
- Evidence: `.env.example:16-24` explicitly offers `NEXT_PUBLIC_LLM_API_KEY`;
  `src/features/matching/llm.ts:48-65,157-176,236-255` reads it in a client-imported module and
  sends it as Bearer from the browser. `src/features/matching/sanitize.ts:59-108,135-153`
  allowlists field *names* but only detects email-like string values; names, phones and other
  PII typed into title/annotation/region survive. Candidate organization names are added at
  `llm.ts:176-220`. CSP connect-src only allows self and `CLIENT_API_BASE`
  (`src/middleware.ts:16-30`), so a distinct configured LLM host is also blocked at runtime.
- Scenario: configure the documented `NEXT_PUBLIC_LLM_API_KEY`; any visitor with matching-page
  access extracts it from the public JS bundle/devtools and calls the provider at platform
  expense. A user pastes a phone/FIO into annotation; `assertNoPii` returns null and the browser
  sends it to that external provider. With the default CSP, the request instead fails and silently
  degrades, making the configured feature unavailable.
- Impact: credential compromise/cost abuse, uncontrolled third-party disclosure and misleading
  privacy claim.
- Remediation/test: remove all public key variables and browser provider calls; call the existing
  authenticated backend AI gateway with server-held secrets and enforce content-level DLP there.
  Build-test that no credential name/value enters client chunks; contract-test phone/FIO/email
  rejection and CSP-compatible same-origin traffic.
- Dependencies: deduplicate with `IA-01`; backend AI gateway/DLP, deployment secret ownership and
  frontend CSP configuration must be resolved together.

### FE03-02: Concurrent Auth.js refreshes can revoke the newly issued token family and log out an active user

- Category: Auth/reliability; proposed severity **High**; confidence **Confirmed**.
- Evidence: `src/auth.config.ts:61-102` has no single-flight/lock and every JWT callback nearing
  expiry posts the same refresh token. Backend intentionally permits one winner and treats the
  second as reuse, revoking the family (`app/api/v1/auth.py:112-125,135-164`). Frontend also
  hardcodes a 55-minute inferred expiry (`src/auth.config.ts:21-22,62-76,94-96`) while backend TTL
  is configurable (`app/core/config.py:63-64`).
- Scenario: two tabs/server renders invoke the callback together in the refresh window. Both read
  the same cookie; one receives a new pair, the loser receives 401 and triggers family revocation,
  so the winning refresh is no longer durable and one response can overwrite the cookie with an
  error token.
- Impact: nondeterministic logout across tabs and avoidable draft interruption; a shorter configured
  backend access TTL also creates a window of repeated API 401s before frontend refresh.
- Remediation/test: serialize refresh by token family or use a backend/session-side refresh owner;
  derive expiry from JWT `exp`, not a duplicated constant. Add a two-tab concurrent refresh test
  asserting one shared successful result and a still-valid rotated family.
- Dependencies: Auth.js JWT callback and backend refresh-family rotation are one atomic contract;
  implementation requires coordinated frontend-auth and backend-auth tests.

### FE03-03: KT UI fabricates requirements and displays failed decisions as if accepted

- Category: Integrity/business workflow; proposed severity **Medium**; confidence **Confirmed**.
  Backend state remains authoritative and reload corrects the badge, so impact is serious operator
  deception rather than persisted integrity compromise.
- Evidence: `src/features/project/KtPanel.tsx:120-180` pads real control points to four and converts
  empty/404/409/other failures into mock requirements. On decision failure, every error except an
  extracted 403 mutates local status to approved/rejected (`KtPanel.tsx:187-213`). Route buttons
  are shown from role slug alone (`KtPanel.tsx:60-68,298-323`), whereas backend additionally
  requires project assignment and forbids owner self-verification (`app/api/v1/projects.py:656-703`).
- Scenario: assigned auditor clicks Go during a timeout/500; an error appears but the KT badge
  becomes approved until reload. A requirements dependency failure displays generated checklist
  rows indistinguishably from persisted requirements.
- Impact: false regulatory/workflow state and decisions made against invented evidence.
- Remediation/test: never mutate decision state on failed writes; distinguish unavailable/empty
  from mock fixtures and remove mocks from production. Test 500/network keeps prior KT status and
  dependency failure renders a blocking error; test owner/unaligned auditor controls are hidden.
- Dependencies: deduplicate failed-decision evidence with `IA-03` and fabricated/wrong-stage data
  with `IA-04`; template behavior additionally intersects `FE03-12`/`IA-05`.

### FE03-04: Project/technology registry keyset and filter contracts lose or hide records

- Category: Data correctness/search; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: backend orders/cursors on `(current_level DESC, updated_at DESC, id DESC)`
  (`app/api/v1/projects.py:243-280`). Client re-sorts each page by updated/created then uses that
  reordered last ID as the next cursor (`src/features/registry/useRegistry.ts:24-29,81-111`).
  Client sends `search`, `status`, `region`, and repeated `tags`
  (`src/lib/api-client.ts:109-132`), but backend signature accepts only UGT/category/budget/cursor
  (`app/api/v1/projects.py:228-240`); status is filtered only within the fetched page
  (`useRegistry.ts:19-20,84-111`), and search/region are not filtered locally.
- Scenario: a page contains mixed UGT levels whose creation/update ordering differs. The frontend
  chooses a cursor that was not the backend page tail; the next keyset predicate skips legitimate
  rows. Searching a project name sends an ignored query and displays the unsearched page; a status
  filter can show empty while matching rows exist on later pages.
- Impact: incomplete registries, exports and technology discovery with no visible indication.
- Remediation/test: preserve backend order and cursor explicitly (opaque cursor preferred); make
  supported filters server-side or clearly client-side over a complete dataset. Seed >20 mixed-level
  rows and assert exact-once traversal plus search/status/region semantics.
- Dependencies: deduplicate the status-after-pagination subset with `IA-06`; final fix needs one
  frontend/backend registry ordering, cursor and filter contract.

### FE03-05: “Propose through CNTR” reports success without creating anything

- Category: Business completeness; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: `src/features/matching/MatchingMode.tsx:182-192` only logs candidate data and shows the
  translated success toast. No matching proposal endpoint is called; backend `requests.py` exposes
  project promotion comments/conclusions, not candidate proposals.
- Scenario: user chooses a recommendation and clicks proposal; UI says it was sent, but refresh,
  recipient notifications and backend storage contain no request.
- Impact: lost commercial/coordination intent and false user assurance.
- Remediation/test: define an idempotent authenticated proposal endpoint and persisted status;
  show success only after 2xx. Test recipient/audit notification and retry/double-click behavior.
- Dependencies: deduplicate with `IA-02`; requires matching API, persisted request aggregate,
  authorization, moderation and notification/realtime ownership.

### FE03-06: Public registration offers three roles the backend always rejects

- Category: RBAC/business flow; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: frontend excludes only `cntr_*`, therefore offers `auditor`,
  `regulating_organization`, and `investor` (`src/app/register/page.tsx:40-43,204-220`). Backend
  self-registration allowlist contains only four basic roles (`app/core/deps.py:94-109`) and returns
  privileged-role 403 (`app/api/v1/auth.py:44-60`).
- Scenario: a new auditor selects the visible role, completes all fields, and receives a terminal
  authorization error with no supported onboarding path.
- Impact: guaranteed registration failure for advertised personas.
- Remediation/test: derive public options from a shared contract or show a staff-mediated request
  workflow; UI contract-test every offered slug against registration acceptance.
- Dependencies: backend self-registration allowlist and product-owned role onboarding policy; no
  frontend-only correction can define how privileged personas are admitted.

### FE03-07: Canvas “autosave” is browser-local only and route navigation is not protected

- Category: Persistence/navigation loss; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: `src/features/project/ProjectCard.tsx:69-93` explicitly replaces the absent PATCH with
  localStorage and a debug log, while UI reports saved through `ActionsPanel.tsx:153-167`.
  `useAutosave.ts:33-69` protects only `beforeunload`; its own comment notes route changes are not
  observed, and the interval effect is recreated on every value change. No backend canvas model or
  endpoint was found.
- Scenario: edit canvas, see “saved”, then open the project on another browser/device: no changes.
  Edit and click internal navigation before 30 seconds: SPA navigation has no confirmation; only
  the separate draft effect happens to preserve data on the same origin/device.
- Impact: misleading durability, no collaboration/audit trail, local PII/business data remains in
  script-readable storage indefinitely.
- Remediation/test: persist versioned canvas via authorized API with conflict handling; distinguish
  local draft from server saved, clear drafts after commit/logout policy, and intercept internal
  navigation. Test refresh/device reload, conflicting edits and route-leave confirmation.
- Dependencies: overlaps `FE03-16` and the goals/tasks/results portion of `IA-10`; also depends on
  session/draft ownership used by `FE03-19` and a backend canvas persistence/versioning contract.

### FE03-08: Executor catalogs can never display beyond the first 20 backend rows

- Category: Pagination/growth; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: UI calls both endpoints without `limit`, `after_id`, or `offset`, then slices the returned
  array client-side and claims the backend returns all (`src/app/dashboard/executors/page.tsx:146-167,203-207`).
  Backend defaults each endpoint to 20 and requires keyset/offset for later pages
  (`app/api/v1/executors.py:252-288,291-312`). Search/tags/region are consequently applied only to
  those first 20 (`page.tsx:187-205`).
- Scenario: create 21 verified specialists; the 21st is absent and “load more” is not offered.
- Impact: valid executors and organizations are undiscoverable at normal growth volumes.
- Remediation/test: implement endpoint-specific server pagination and filters; integration-test 21+
  rows for both tabs and a match that exists only after page one.
- Dependencies: backend executor specialist/organization pagination and filter contracts; matching
  discovery inherits the corrected catalog coverage.

### FE03-09: NIOKTR/organization/executor searches have stale-response races

- Category: Async state; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: NIOKTR and organization `fetchPage` calls have neither abort nor request generation
  (`src/app/dashboard/nioktr/page.tsx:131-178`, `organizations/page.tsx:128-173`); executors is the
  same at `executors/page.tsx:149-182`. In contrast, the shared project registry correctly rejects
  stale request IDs (`src/features/registry/useRegistry.ts:69-83,112-121`).
- Scenario: type query A then B; B returns first, then slow A overwrites `items` while URL/input show B.
  A concurrent realtime refresh can likewise replace a filtered result.
- Impact: users act on/export data inconsistent with visible filters.
- Remediation/test: AbortController or monotonically checked request IDs per query/page; deferred
  fetch test resolves B before A and asserts only B remains.
- Dependencies: shared registry async/realtime behavior and endpoint-specific pagination semantics;
  no schema or migration dependency.

### FE03-10: Profile and project-admin mutations permit duplicate submission

- Category: Forms/idempotency; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: profile save/submit/create/join functions have no pending guard
  (`src/app/dashboard/profile/page.tsx:114-185`), and their buttons disable only on static validity
  (`profile/page.tsx:280-295,328-360`). Invite/transfer/legal functions and buttons likewise have no
  busy state (`src/components/project-team-panel.tsx:132-220,276-366`).
- Scenario: double-click “create organization” or “create invite” on latency; two POSTs are sent.
  The UI appends each success and there is no client idempotency key.
- Impact: duplicate organizations/invites, conflicting submit/save operations and confusing errors.
- Remediation/test: synchronous in-flight guard plus disabled state and server idempotency/uniqueness
  where appropriate; delayed-fetch double-click tests must observe one request.
- Dependencies: profile, organization and project-team APIs need explicit uniqueness/idempotency
  guarantees in addition to frontend pending-state guards.

### FE03-11: Technology UI bypasses the implemented Technology registry

- Category: Business completeness; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: page states it intentionally uses public Projects with UGT>=7
  (`src/app/dashboard/technologies/page.tsx:25-45`), while backend has a separate paginated,
  filterable `Technology` ORM endpoint (`app/api/v1/technologies.py:13-88`).
- Scenario: a Technology row not represented by a published Project exists in DB; API returns it,
  but `/dashboard/technologies` can never display it. Conversely a high-UGT project is labeled a
  technology regardless of Technology registration.
- Impact: UI/API/ORM business chain is split into two incompatible sources of truth.
- Remediation/test: choose and document one canonical model/projection, migrate or join explicitly,
  and assert UI IDs/count/filter results equal the canonical endpoint.
- Dependencies: functional validation of Project versus Technology ownership, followed by aligned
  backend API/data migration and frontend registry work.

### FE03-12: Missing template/saved-filter APIs degrade into local artifacts instead of honest failure

- Category: Error handling/business completeness; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: API client calls nonexistent `/templates/{id}` and `/filters/saved*`
  (`src/lib/api-client.ts:469-559`); no corresponding backend route was found. Project KT/checklist
  turns template failure into a local blob/mock (`src/features/project/KtPanel.tsx:216-219` and
  `src/features/project/template.ts`), while saved filters fall back to unlimited localStorage.
- Scenario: user downloads a required official template while backend lacks it and receives locally
  synthesized content; saved filters appear successful but disappear on another device/browser.
- Impact: unofficial documents can enter verification and persistence is misrepresented.
- Remediation/test: implement/version authorized endpoints or visibly label local-only demo data;
  never synthesize official artifacts after 404/500. Cross-device and checksum tests are required.
- Dependencies: deduplicate template evidence with `IA-05` and saved-filter evidence with `IA-07`;
  requires backend generation/RAG plus user-owned filter persistence decisions.

### FE03-13: Project-admin panel collapses dependency and HTTP failures into misleading UI

- Category: Error/empty state; proposed severity **Low**; confidence **Confirmed**.
- Evidence: `src/components/project-team-panel.tsx:94-123` checks only `.ok` before selectively
  applying responses and then always clears error; HTTP 403/404/500 do not throw. Only network
  errors set error, and then the entire panel returns null (`:224-229`).
- Scenario: invites returns 500 and project detail 200; panel displays an empty invites list and
  editable legal form rather than partial failure. A network outage hides the whole feature.
- Impact: operators cannot distinguish no data, no permission and dependency failure.
- Remediation/test: classify each response, hide only explicit 403/404, preserve partial data with
  an error/retry state, and test split-response combinations.
- Dependencies: project detail/invite backend error contracts and the project-admin frontend panel;
  independent of persistence migrations.

### FE03-14: News editor renders unsanitized draft HTML in the privileged origin

- Category: XSS/content safety; proposed severity **Low**; confidence **Probable**.
- Evidence: raw textarea state flows directly to `dangerouslySetInnerHTML`
  (`src/components/dashboard/news-editor.tsx:580-605`). Stored/public content is correctly cleaned
  on create/update (`app/api/v1/news.py:375-445`) by the allowlist at
  `app/services/html_sanitizer.py:20-74`, so this is confined to preview before persistence.
- Scenario: staff pastes attacker-supplied HTML into the editor and opens preview. Current CSP
  blocks common inline-script/event-handler payloads, limiting exploitability, but raw active HTML
  remains in a privileged DOM and future CSP/browser changes reopen execution/phishing vectors.
- Impact: defense-in-depth gap in a staff-only context; no stored public XSS was found.
- Remediation/test: run the same allowlist sanitizer before preview (prefer server preview endpoint)
  and test event handlers, unsafe schemes, iframe/object and malformed markup.
- Dependencies: backend HTML sanitizer policy, frontend preview rendering and CSP/browser behavior;
  exploitability remains subject to browser confirmation.

### FE03-15: Login consumes an unvalidated navigation target

- Category: Navigation security; proposed severity **Low**; confidence **Suspicious**.
- Evidence: arbitrary query `callbackUrl` is read and passed to `router.push` after successful login
  (`src/app/login/page.tsx:17-42`). Middleware-generated values are safe paths
  (`src/middleware.ts:82-88`), but direct attacker URLs are not constrained; no regression test exists.
- Scenario requiring browser confirmation: victim authenticates through attacker-crafted
  `/login?callbackUrl=<external-or-script-scheme>`. Depending on Next/browser URL handling and CSP,
  this may navigate off-origin or be blocked.
- Impact: potential post-login open redirect/phishing; script-scheme impact is reduced by current CSP.
- Remediation/test: accept only normalized same-origin paths beginning with a single `/`, reject
  `//`, schemes and control characters; browser-test malicious callback values.
- Dependencies: Next.js router/browser URL handling and Auth.js callback semantics; middleware's
  generated callback remains the trusted-input baseline.

### FE03-16: Project goals, tasks and durable results have no application contract

- Category: Business completeness; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: project UI models `results` and `transitionPlan` only as fields in local `CanvasValue`
  (`src/features/project/CanvasBlocks.tsx:69-87,104-126,137-154`); their only outward flow is the
  localStorage autosave in `ProjectCard.tsx:69-123`. The reproducible backend grep in the inventory
  returns no goal/task/project-result/canvas model or endpoint. Roadmap tasks/results are static
  methodology dictionary content (`src/components/landing/roadmap-content.tsx:425-502`), not project
  records.
- Scenario: a team records project objectives, transition tasks and achieved results in the card;
  another team member/device cannot retrieve, assign, complete, authorize or audit any of them.
- Impact: the declared end-to-end project-management chain stops at browser-local text and cannot
  support accountability or result acceptance.
- Remediation/test: define persisted ProjectGoal/ProjectTask/ProjectResult contracts with ownership,
  assignee/status/version/audit rules, then bind canvas/roadmap UI to them. Test multi-user create,
  assignment, completion, conflict and audit retrieval.
- Dependencies: deduplicate the missing aggregate/domain-contract finding with `IA-10`; preserve
  `FE03-07` separately for the concrete misleading local autosave/navigation behavior.

### FE03-17: Document generation is backend-only and unreachable from the frontend

- Category: Business completeness; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: backend exposes authenticated `POST /projects/{project_id}/generate/{doc_type}`
  (`app/api/v1/generation.py:14-35`), but exhaustive frontend search for `/generate/` finds no API
  consumer. `AiDocConsultant` only sends chat/RAG requests; project document panels only upload,
  download, rescan or submit verification metadata.
- Scenario: an authorized project member opens every project/document surface; no control invokes
  generation, so the existing server capability cannot be used through the product UI.
- Impact: the required UI -> API -> persistence/auth chain for generated documents is incomplete.
- Remediation/test: add an explicitly authorized generation action with pending/error/result state
  and generated-file linkage; integration-test each supported doc type, denial, timeout and retry.
- Dependencies: existing backend generation route, project authorization and generated-file/storage
  lifecycle; no duplicate candidate is recorded in task 01 evidence.

### FE03-18: Offline queue is not connected to any product mutation

- Category: Reliability/business completeness; proposed severity **Medium**; confidence **Confirmed**.
- Evidence: exhaustive call-site search for `enqueue(` / `enqueueOfflineAction(` finds only its own
  declaration and the wrapper in `src/features/offline/queue.ts:134-153` and
  `useOfflineQueue.ts:102-109`; no login, assessment, project, profile, team, document, news,
  notification or matching consumer invokes it. Root providers mount only `OfflineBanner`
  (`src/components/providers.tsx:27-34`).
- Scenario: disconnect network and submit an assessment, profile edit or project mutation. Its raw
  fetch rejects and local component error handling runs; queue length remains zero, so reconnect has
  nothing to retry despite the global offline feature.
- Impact: advertised offline retry does not protect any real user action; interruption loses the
  intended mutation unless manually repeated.
- Remediation/test: define the exact idempotent mutation allowlist and route those consumers through
  queue-aware transport with user/resource identity; end-to-end offline -> reload -> login -> online
  tests must prove one authorized replay and no cross-account replay.
- Dependencies: offline transport must coordinate with authentication/session identity and each
  opted-in mutation's backend idempotency contract; no task-01 duplicate was found.

### FE03-19: Global refresh-error sign-out races the draft-preserving session modal

- Category: Auth/navigation loss; proposed severity **Medium**; confidence **Probable**.
- Evidence: root `SessionExpiryWatcher` immediately invokes `signOut({callbackUrl:"/login"})` on a
  protected route (`src/components/providers.tsx:10-22`). Dashboard simultaneously mounts a modal
  whose contract is to save a draft and defer sign-out until user confirmation
  (`src/app/dashboard/layout.tsx:118-125`,
  `src/features/notifications/SessionExpiredModal.tsx:41-95,187-205`). Both are effects under the
  same provider tree; there is no ordering/coordination contract.
- Scenario: an access refresh fails while unsaved assessment/profile/news data is in component state.
  Root watcher begins sign-out/navigation before the modal can save anything except project canvas;
  those other forms have no draft hook and are lost. Browser timing is the unexecuted premise, hence
  Probable rather than Confirmed.
- Impact: the UI promise “session expired without losing draft” is unreliable and excludes most forms.
- Remediation/test: make one session-expiry owner; save registered drafts first, then require an
  explicit transition. Browser-test refresh failure with dirty project, assessment, profile and news forms.
- Dependencies: `FE03-02` supplies the refresh-failure trigger and `FE03-07` the only implemented
  durable draft hook; Auth.js provider, root watcher, dashboard modal and form draft owners must coordinate.

## Dependency and deduplication mapping

| Candidate | Consolidation mapping | Dependency boundary |
|---|---|---|
| `FE03-01` | Merge with `IA-01` | One browser-LLM credential/privacy/CSP finding |
| `FE03-03` | Merge with `IA-03` + `IA-04` | Preserve two mechanisms: false failed-write success and fabricated/wrong-stage requirements |
| `FE03-04` | Merge status/pagination subset with `IA-06`; retain additional cursor/search/region evidence | One registry contract finding may enumerate distinct failure modes |
| `FE03-05` | Merge with `IA-02` | One false-success/missing MatchRequest chain |
| `FE03-12` | Split/merge template with `IA-05`, saved filters with `IA-07` | Do not collapse two independent missing APIs into one remediation owner |
| `FE03-16` | Merge missing goals/tasks/results aggregate claim into `IA-10`; do not merge away `FE03-07` | `IA-10` owns absent first-class domain/API chain; `FE03-07` owns observable local-only autosave, misleading saved state and navigation/data-retention defects |
| `FE03-17` | Keep as distinct frontend reachability finding | Depends on existing backend generation/files seam; `IA-05` concerns template download, not document generation UI |
| `FE03-18` | Keep distinct | Offline implementation exists but has zero product mutation consumers; no equivalent `IA-*` candidate |
| `FE03-19` | Keep distinct, cross-reference `FE03-02` and `FE03-07` | Session-owner race is separate from refresh-family cause and canvas-only draft persistence |

## Deep-state matrix by frontend direction

| Direction | First launch | Empty data | Invalid / boundary input | Dependency failure | Interruption / repeat | Growth | Role / organization boundary | Consequence / reversibility |
|---|---|---|---|---|---|---|---|---|
| App Router / auth | Middleware and Auth.js load without DB; API login still required | anonymous protected request -> login; unknown dashboard route -> 403 | native required/email; callback unvalidated F15 | failed refresh -> login/error token | concurrent refresh revokes family F02 | cookie/JWT size bounded by small role list | fail-closed route matrix; backend remains authority | logout reversible by login, but watcher can preempt draft modal |
| Role dashboards | skeleton then `GET /projects` | explicit no-project CTA | join token regex before backend | error + retry | join busy guard | user project endpoint is unpaginated; large payload risk not separately proven | exact role route; shared project list server scoped | pending/active join status shown |
| Assessment/project canvas | public template then authenticated save | empty answers rejected backend | name, NA reason, version + backend schema | template/save error retained; canvas local-only F07 | assessment has no unload draft; canvas no SPA leave guard F07 | questionnaire fixed at nine levels; quota failures ignored | any current user assesses; project BOLA enforced | assessment durable, canvas not F07/F16 |
| Project lifecycle/KT | Project detail fans out to panels | file/team/history empty states | backend validates publish/stage/decision | mock/fake state F03/F12/F13 | most actions busy; team duplicates F10 | nested collections expose no complete paging UI | owner/member/staff/assigned-verifier server checks; KT UI mismatch F03 | archive/publish durable; failed KT resets only on reload |
| Registries/search | URL/default filters issue first request | explicit empty/error/retry | numeric URL parser accepts `NaN` (`src/lib/filters.ts:89-104`) | errors shown; stale responses F09 | request ID only in project registry; realtime races F09 | cursor loss F04; executor cap F08; unbounded local filters | backend registries public/rate-limited; executor UI narrower | read-only; exports inherit incomplete visible set |
| Matching/recommendations/AI | project list + initial guidance | insufficient/zero/weak/stale explicit | allowlist/min content; PII check incomplete F01 | script fallback; CSP/provider mismatch F01 | main action guarded; stale rerun/retry may overlap | top five bounded; selector inherits full project list | matching all9, assistant exec6; backend CurrentUser | proposal has no persisted effect F05 |
| Profiles/org/team | skeleton then profile/org fetch | no-org/invite explicit | thin UI checks; backend schemas/admin checks | profile errors shown; team HTTP failures hidden F13 | duplicate writes and unsaved navigation F10 | org/member lists have no paging UI | membership admin/staff backend checks; registration mismatch F06 | state transitions durable; duplicates need cleanup |
| Documents/generation | file/stage requirements fetched | no-file explicit; missing requirements become mock | accept hints; backend MIME/size/AV authority | upload errors; synthetic template F12 | upload/evaluate busy; no generation action | server file limits; nested paging absent | project/verifier checks server-side | uploads durable; generation UI absent F17 |
| News/XSS | SSR feed and staff editor load | feed/admin/media empty states | backend schema + nh3; preview bypass F14 | feed/editor retry; no route error boundary | editor busy; unsaved route navigation unguarded | page/per_page feed | staff route plus author/admin backend checks | publication durable; raw preview not stored |
| Notifications/offline/session | queue restores; SSE ticket starts, but no mutation enqueues F18 | notification empty + hidden empty queue | shape checked, action URL not allowlisted | SSE -> polling; failed actions retained only for synthetic callers | merge handles concurrent enqueue; auth watcher/modal race F19 | queue/drafts lack age/count/storage limits | replay uses current user token without recorded originating user | manual clear/remove; max-retry rows persist |

## Tests and limitations

- `npm test` -> **182 passed, 0 failed** on the current worktree.
- `node --test tests/routes-matrix.test.mjs` -> **7 passed, 0 failed**: real dashboard route
  discovery, default deny, news editor role guard and public-page refresh behavior pass.
- No live browser, production LLM/provider, DB, service restart, migration, seed or state-changing
  smoke was used. FE03-14/15/19 remain Probable/Suspicious for that reason; all other findings have a
  complete code-level scenario.
