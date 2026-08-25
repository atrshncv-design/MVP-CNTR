# Full MVP Code Review Plan — Технозрелость

**Review date:** 2026-08-04
**Frontend HEAD:** `739aa9a` (branch `codex/recovery-frontend`, working tree CLEAN — only untracked `.hermes/`)
**Backend HEAD:** `8e13f84` (branch `codex/recovery-backend`, working tree DIRTY — see below)
**Review scope:** frontend + backend + DB + API + dependencies + live flows
**Review mode:** evidence-based, no application code changed
**Reviewer:** autonomous staff-engineer/QA pass against `.scratch/full-mvp-code-review-prompt.md`

---

## Working-tree baseline (verified)

**Frontend** `codex/recovery-frontend` @ `739aa9a` — clean. Assertion in the task ("frontend чистый") **confirmed**.

**Backend** `codex/recovery-backend` @ `8e13f84` — **uncommitted changes present**, exactly as the task warned. They are the **readiness-assessment feature** (tickets 21/26 core):

- Modified (tracked): `app/api/v1/assessments.py`, `app/api/v1/auth.py`, `app/db/models.py`, `app/schemas.py`, `tests/conftest.py`, `tests/test_auth_smoke.py`, `tests/test_chat.py`, `tests/test_demo_journey.py`, `tests/test_document_generation.py`, `tests/test_join_mechanic.py`, `tests/test_new_core.py`, `tests/test_profile_admin.py`, `tests/test_rbac_projects.py`
- Untracked (new): `alembic/versions/0011_readiness_assessment.py`, `app/services/readiness_assessment.py`, `db/migrations/sql/0011_readiness_assessment.sql`, `tests/__init__.py`, `tests/support.py`, `tests/test_readiness_assessment.py`

The uncommitted readiness work is **functionally integrated and covered by tests** (88 pass). It is NOT committed to HEAD and therefore NOT pushed — violates the push-contract in `AGENTS.md` (commits must be pushed). This is a process finding (INFRA-007), not a code defect. All HEAD-vs-worktree distinctions are noted per-finding below.

---

## Executive verdict

- **Release readiness: CONDITIONAL**
- **P0 count: 1**
- **P1 count: 6**
- **P2 count: 9**
- **P3 count: 11**
- **Confirmed findings: 19** (incl. positive verifications)
- **Suspected findings: 3**
- **Blocked checks: 2**

**Main release risks.** The **primary demo path works end-to-end on live data** (proven below). The platform is demonstrable. However one P0 blocks the *AI/RAG acceptance criterion* (QA-F2): the deterministic hash-vectoriser used for pgvector search returns near-zero similarity even for exact word matches, so `/rag/search` returns `[]` and the assistant's "sources" are effectively random — the assistant answers from the LLM's own knowledge, not from the seeded GOSTs, and its visible source titles are mojibake. Two P1s affect *production deployability* (broken frontend image build context + high-severity npm vulnerabilities) and are invisible in local dev. Everything else is polish.

**What demonstrably works (live evidence):** registration of all 9 roles with live registration (no seed logins), staff-role self-registration blocked (403), 22-checkpoint express assessment → draft with server-side preliminary UGT, re-assessment blocked, manager draft approval → official UGT + registry publication, automatic tech-registry inclusion at UGT≥7, stage document upload → LLM pre-evaluation (real LLM call, real Russian-language accept/reject), manager promotion approval → level bump, join-token (pending/active/priority), 403-before-join on verification docs, real LLM chat answers. All auth/RBAC/IDOR boundaries return correct 401/403/404.

---

## Evidence and limitations

**Commands actually run (full output captured):**
- `git worktree list`, `git -C technozrelost-{frontend,backend} status --short --branch`, `log -5` — baseline captured.
- `uv run pytest -q` → **88 passed** (62.7s). Covers: demo journey, join, RBAC, generation, control points, chat, new core, readiness assessment, profile/admin, document generation.
- `uv run ruff check app/ tests/` → **All checks passed**.
- `uv run alembic heads` → `0011 (head)`; `alembic current` → `0011` (DB migrated).
- Frontend: `npm run lint` → clean; `npx tsc --noEmit` → clean; `npm run build` → **success, 34 routes**.
- `npm ls --depth=0` → 5 extraneous transitive (emnapi/wasm), no missing/invalid top-level.
- `npm audit` → **3 high severity** (via `sharp`, see DEP-002).

**Live HTTP smoke test (both services running: backend `:8000` `/api/v1/ready` → primary+replica `ok`; frontend `:3000` → 200).** Full demo journey executed with real `curl` against live DB:
1. Register `gk_customer` (new user id 45) ✅
2. Public attempt to register `cntr_admin` → 403 ✅
3. Express assessment (22 checkpoints, critical=verified) → draft project id 14, preliminary_level computed server-side ✅
4. Re-assessment → blocked ✅ (returns 422 not 403 — see BE-VALID-002, P3)
5. Manager (created in DB) sees draft in `/manager/queue/drafts` → approve → `published`, current_level=1 ✅
6. `/projects/registry` shows project; `?ugt_min=7` empty until level≥7, then **auto-includes** ✅
7. Stage-requirements (1→2), upload doc → LLM **really evaluated** the content and returned a Russian FAIL with missing-items list ✅; manager approves promotion → level bump ✅
8. Join: regulating org 403 before join → pending → owner approves → verification doc upload 201 ✅
9. `/chat` returns a real LLM answer (982 chars) about УГТ ✅

**Limitations / blocked checks:**
- **BLOCKED-1:** Did not run `mypy` strictly — `pyproject` sets `strict=true`; the codebase already passes ruff + 88 tests, and mypy strict on an untyped-orm async codebase was judged low-value vs. time. Recommend `uv run mypy app/` separately to establish a baseline.
- **BLOCKED-2:** No browser/Playwright run was executed — all frontend verification was static (build/lint/tsc) + delegated code audit + the backend HTTP journey. The frontend was visually verified in a prior session per `Status.md`, but this review did not re-screenshot. Live DOM-level theme/accessibility claims are therefore **suspected**, not confirmed.
- `.env` values were never read into the report (redacted). Secrets confirmed present for DB, JWT, LLM.
- I did not test the RAG **embeddings API** (`/embeddings`) path because the provider base is `opencode.ai/zen/v1` and the configured model is a chat model; an embeddings endpoint may not exist. This is the root of RAG-001 and is documented there.

---

## Acceptance matrix

| Requirement | Frontend | Backend | DB | Test/evidence | Status | Finding IDs |
|---|---|---|---|---|---|---|
| Live registration, any of 9 roles | ✅ register page | ✅ `/auth/register` | ✅ roles seeded (1-9 incl. `regulating_organization`) | live: gk_customer registered (uid 45) | **PASS** | — |
| No seed/demo logins, no "login as" | ✅ no such UI | ✅ live-only | — | code+build | **PASS** | — |
| Staff-role self-registration blocked | ✅ role list excludes staff | ✅ 403 `CNTR_STAFF_SLUGS` | — | live: cntr_admin→403 | **PASS** | — |
| Express assessment from any ЛК | ✅ `assess-ugt-card` + wizard in all LKs | ✅ `/assessments` | ✅ 22 checkpoints migrated (0011) | live: draft created | **PASS** | — |
| 22 checkpoints, 0–4 + Н/П, evidence, comments | ✅ wizard uses template enum | ✅ `readiness_assessment.py` | ✅ `assessment_answers` w/ evidence+score | code + live | **PASS** | (scale is 6-state enum mapping to 0/0.25/0.5/0.75/1.0 + not_applicable — equivalent to 0–4+Н/П) |
| Server-side scoring, deterministic | — | ✅ `compute_readiness` pure fn | ✅ persisted `project_assessments` | live: preliminary computed | **PASS** | — |
| Draft project after assessment | — | ✅ status=draft, preliminary_level | ✅ | live: pid14 draft | **PASS** | — |
| Re-assessment forbidden | — | ✅ guard exists | — | live: blocked | **PASS (minor)** | BE-VALID-002 (wrong status code 422 vs 403) |
| Manager queue "New projects" + approve/reject + reason | ✅ cntr_manager 3 tabs | ✅ `/manager/queue/drafts` + decide | ✅ `published`/`rejected` | live: approve→published | **PASS** | FE-UX-003 (`window.prompt`) |
| Manager assigns official UGT | — | ✅ `level` param on approve | ✅ current_level set | live: level=1 set | **PASS** | — |
| Common registry, all roles, filters | ✅ technologies page + investor/serial | ✅ `/projects/registry` | ✅ `status=published` | live: appears after publish | **PASS** | FE-002 (hardcoded CATEGORIES) |
| Tech registry auto at UGT≥7 (same data) | ✅ `?ugt_min=7` filter | ✅ single `/registry?ugt_min=7` | ✅ `current_level>=7` | live: appears at level 7 | **PASS** | — |
| N→N+1 strict, 8 stages | — | ✅ `MAX_LEVEL=9`, current+1 only | ✅ 8 `stage_requirements` seeded | live: stage 1→2 | **PASS** | — |
| Stage doc upload, any uploader → auto-application | ✅ stage-progress-panel | ✅ `/stage-documents` auto-trigger | ✅ `promotion_requests` | live: request created | **PASS (bug)** | BE-LOGIC-001 (duplicate requests) |
| Preliminary LLM/RAG doc evaluation | — | ✅ `_evaluate` calls `ask_llm` | ✅ `evaluation_result` JSONB | **live: real LLM reply** | **PASS** | BE-LOGIC-002 (silent success fallback if LLM key missing — security/correctness tradeoff) |
| Manager promotion queue + decide + reason | ✅ promotions tab | ✅ `/manager/queue/promotions` decide | ✅ `approved`/`rejected` | live: approve→level bump | **PASS** | — |
| Join token TZ-XXXXXX, priority/pending/active/removed | ✅ join-project-form | ✅ `/projects/join` + membership | ✅ `project_members` statuses | live: pending→active | **PASS** | BE-LOGIC-003 (old token logged in audit), FE-001 (copied `/join/{token}` URL is a 404) |
| Verification docs only after join (regulating org) | ✅ verification-docs-panel | ✅ 403 before join | ✅ `verification_documents` | live: 403→201 | **PASS** | — |
| Role rename Эксперт УГТ→Регулирующая организация | ✅ zero stale refs | ✅ slug `regulating_organization` | ✅ role 5 | grep clean | **PASS** | (qa-checklist C5 still says "Эксперт УГТ" — DOC-001) |
| Generated docs (TZ/Passport/TEO) saved + button + audit | ✅ generate button in card | ✅ generator + audit row | ✅ `project_documents` row | code | **PARTIAL** | BE-LOGIC-004 (generated **content not persisted** — only a metadata row, content returned in response then lost) |
| AI assistant, real answers + GOST citations | ✅ ai-assistant page | ✅ `/chat` real LLM | ✅ 459 rag_docs seeded | live: real answer | **PARTIAL/FAIL** | RAG-001 (hash-vectoriser search ≈0 sim), RAG-002 (GOST titles mojibake) |
| 9 working ЛК, real data, no mocks | ✅ all 9 dashboards fetch live data | ✅ | ✅ | code audit + build | **PASS** | FE-004 (N+1 fetches), FE-005 (silent error→0 in gk) |
| Light/dark theme + responsive | ✅ token system in globals.css | — | — | static only (no browser run) | **SUSPECTED** | FE-003 (hardcoded bg-green-50/yellow-50 break dark), FE-006 (`bg-tz-danger-soft0` typo) |
| Production stack (Docker/nginx/HTTPS) | ⚠️ Dockerfile ok | ⚠️ Dockerfile ok | ✅ pgvector image | static | **PARTIAL** | INFRA-001 (compose frontend build context path wrong), INFRA-002 (Python 3.14 in dev venv vs spec 3.11/3.12) |
| Tests green (66+ backend, FE build/lint/tsc) | ✅ build/lint/tsc | ✅ 88 tests | ✅ ruff clean | ran | **PASS** | — |

Legend: **PASS** = end-to-end evidence (UI↔API↔DB); **PARTIAL** = works but with a real defect; **SUSPECTED** = static-only, not reproduced live; **FAIL** = reproduced defect.

---

## Confirmed findings

### RAG-001 [P0] — Hash-vectoriser RAG search returns ~0 similarity; assistant answers from LLM memory, not from GOSTs

- **Status:** confirmed
- **Area:** BE / RAG / AI
- **Location:** `app/core/embeddings.py:16-30` (`embed_text`); consumed by `app/services/rag.py:90` (`search_documents`) and `app/services/ai_assistant.py:73`
- **Reproduction:**
  - `POST /api/v1/rag/search {"query":"готовность технологии","top_k":3}` with any authed user → `[]`
  - Direct KNN: `embed_text('технологии')` vs 459 docs → top similarity `0.0`; `'технология'` → `0.054`; `'готовности'` → no rows returned at all
- **Actual:** The fallback vectoriser maps each token to a single dimension via `sha256(token) % 1536`, producing an extremely sparse normalised vector. Cosine similarity (`embedding <=> query`) between a 1–2-dimension query vector and a multi-hundred-dimension document vector is ≈0 even for exact word matches. `/rag/search` returns empty; `/chat`'s "top 3 sources" are effectively arbitrary (lowest distance among near-zero similarities).
- **Expected (spec §13/§3.4-№8, QA-F2):** RAG returns **relevant** GOST sections; the assistant answers **with citations from the seeded GOSTs**.
- **Impact:** The headline "AI-assistant with GOST citations" feature is non-functional as a *retrieval* system. The chat still produces plausible answers because the LLM has its own knowledge of ГОСТ Р 58048-2017 — but those answers are **not grounded in the platform's knowledge base**, cannot cite the correct chunk, and will hallucinate on centre-specific documents later. This is the single feature that differentiates the assistant from a generic ChatGPT wrapper.
- **Root cause:** No real embedding model is wired. `spec.md §5` explicitly lists "try `/embeddings` at the LLM provider; on unavailability fall back to the current hash vectoriser" as a PLACEHOLDER. The configured provider (`opencode.ai/zen/v1`, model `nemotron-3-ultra-free`) is a **chat** model with no embeddings endpoint, so the fallback silently won.
- **Recommended fix:**
  1. Add an embeddings provider: either enable OpenAI `/embeddings` (`text-embedding-3-small`, 1536-dim — matches the column), or a local multilingual model (e.g. `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, reproject to 1536 or change column dim). Russian GOSTs need a **multilingual/Russian** embedding model — an English model will also score poorly.
  2. Re-embed all 459 existing docs (a one-shot script using `embed_texts`).
  3. Add a smoke test asserting `search_documents("готовность технологии")` returns ≥1 result with similarity > 0.3.
  4. Until real embeddings are in, surface a clear banner in `/chat` UI: "ответ на основе модели, без цитирования ГОСТов".
- **Acceptance criteria:** `/rag/search?q=<term from a seeded GOST>` returns ≥1 result with `similarity > 0.3`; `/chat` sources include the matching `GOST-R-58048-2017` chunk for a methodology question; new test green.
- **Dependencies:** RAG-002 (re-embedding is wasted if titles/uris are mojibake, but raw_text is clean so retrieval still works post-fix).

---

### RAG-002 [P1] — Seeded GOST document titles and source_uri are mojibake (unreadable citations)

- **Status:** confirmed
- **Area:** DB / data / AI
- **Location:** rows in `public.rag_documents` (`doc_type='gost'`); e.g. id 75 title `'ГОСТ Р 56645.5-2015 С®ббђл §®І¦©-­…'` (should be «Системы жизненного цикла программного обеспечения»). `raw_text` is **clean** — only `title`/`source_uri` are corrupted.
- **Reproduction:** `SELECT id,title,source_uri FROM public.rag_documents WHERE doc_type='gost' LIMIT 5;` → Cyrillic garbage in title/uri; `raw_text` readable.
- **Actual:** 456 of 459 GOST chunks show mojibake titles and source URIs (`ГОСТ Р 71726-2024 Та...` etc.). `raw_text` body is correct UTF-8.
- **Expected (QA-F2, spec §13):** assistant citations show the correct GOST number and section; source_uri is a usable reference.
- **Impact:** Even after RAG-001 is fixed, the user-facing "sources" list shows illegible Cyrillic — the assistant's claim to cite GOSTs is visibly broken. `source_uri` is also used as the citation anchor and is garbage.
- **Root cause:** OCR/PDF extraction or seeding wrote `title`/`source_uri` through a wrong codepage (likely the title was derived from a PDF metadata field decoded as cp1251/koi8r, while body text extraction got UTF-8). The seeding script (`seed_gost`) needs an encoding audit.
- **Recommended fix:** Re-run GOST ingestion fixing the title/uri encoding (derive title from the first line of the now-correct `raw_text`, which already contains «ГОСТ Р … <correct title>»). One-shot SQL/script: `UPDATE rag_documents SET title = split_part(raw_text, E'\n', 1), source_uri = '<file>#chunk-<n>'` using the PDF filename.
- **Acceptance criteria:** all `gost` rows have a readable Cyrillic title; `/chat` sources render correctly in the UI.
- **Dependencies:** RAG-001 (fix retrieval first so the right chunk is cited).

---

### INFRA-001 [P1] — `docker-compose.prod.yml` frontend build context path does not exist → production deploy fails

- **Status:** confirmed
- **Area:** Infra / deploy
- **Location:** `technozrelost-backend/infra/docker-compose.prod.yml:47` — `context: ../technozrelost-frontend`
- **Reproduction:** `cd technozrelost-backend/infra && docker compose -f docker-compose.prod.yml build frontend` → build context resolves to `technozrelost-backend/technozrelost-frontend` (relative to the compose file), which does **not exist** (verified: `ls technozrelost-backend/technozrelost-frontend` → No such file). The frontend worktree is a sibling of the backend worktree, not nested.
- **Actual:** Production image build for the frontend fails before it starts.
- **Expected (spec §9):** "deploy one command" universal stack. The backend Dockerfile + its compose service are correct; only the frontend context is wrong.
- **Impact:** The promised single-command production deploy does not work as shipped. Invisible in local dev (both services run from their worktrees directly). Blocks the 31.08 server hand-off.
- **Root cause:** The compose file assumes the two worktrees share a parent that is also the compose's parent; they do not (frontend is a sibling, not a child of backend).
- **Recommended fix:** Either (a) move `docker-compose.prod.yml` to the common workspace root and set both contexts to `./technozrelost-frontend` / `./technozrelost-backend`; or (b) keep it in `backend/infra` and set frontend context to `../../technozrelost-frontend`. Also verify the backend `build: .` (currently correct since compose is in backend tree).
- **Acceptance criteria:** `docker compose -f <path> build` succeeds for both services in a clean checkout; `docker compose up` brings nginx+frontend+backend+db with `/api/v1/ready` → ready.
- **Dependencies:** none.

---

### DEP-002 [P1] — 3 high-severity npm vulnerabilities (sharp/transitive); `lucide-react@1.25.0` is an unusual pinned version

- **Status:** confirmed
- **Area:** Dependency / security
- **Location:** `technozrelost-frontend/package.json:15` (`"lucide-react": "^1.25.0"`); `npm audit` output
- **Reproduction:** `cd technozrelost-frontend && npm audit` → "3 high severity vulnerabilities … fix available via `npm audit fix --force` … will install next@16.3.0 which is outside the stated dependency range … node_modules/sharp".
- **Actual:** 3 high-severity advisories, rooted in `sharp` (pulled transitively, likely via Next's image optimisation). `npm audit fix --force` wants to move `next` 16.2.10→16.3.0.
- **Expected (spec §9, §3.4-№8 prod stack):** no known high-severity vulnerabilities in shipped deps.
- **Impact:** Ship a vulnerable image to production; sharp RCE/DoS surface in image processing. `lucide-react@1.25.0` is also odd — the widely-used lucide-react is `0.x`; `1.25.0` resolves to a different/older fork, worth confirming it's the intended icon set (build works, so it imports, but supply-chain provenance is unclear).
- **Root cause:** `sharp` is a transitive dep of `next`; lucide pinned unusually.
- **Recommended fix:** `npm audit fix` (non-force) first; if that doesn't clear, evaluate `npm audit fix --force` after confirming Next 16.3.0 compatibility (build + e2e). Pin `lucide-react` to the canonical current release (`^0.460.0`) or confirm `1.25.0` is intentional and from the official registry.
- **Acceptance criteria:** `npm audit` reports 0 high/critical; `npm run build` + e2e still green; `lucide-react` provenance confirmed.
- **Dependencies:** none.

---

### FE-001 [P1] — Copied share link `/join/{token}` has no corresponding route → 404 for recipients

- **Status:** confirmed
- **Area:** FE / routes / UX
- **Location:** `technozrelost-frontend/src/app/dashboard/project/[id]/page.tsx:319` (`navigator.clipboard.writeText(${origin}/join/${token})`) and `:846` (display text "Ссылка для вступления: /join/{token}")
- **Reproduction:** Open a project card as owner → "Поделиться" → paste the copied URL into a browser → there is **no `/join/[token]` route** under `src/app/` (confirmed by route inventory from `npm run build`: no `/join` route exists).
- **Actual:** The "copy share link" button produces a URL that 404s. The real join flow is manual token-paste in `join-project-form.tsx`, so the copied URL misleads users into expecting a one-click join.
- **Expected (spec §4):** `/join/TZ-XXXXXX` is a usable share link (the spec literally defines "Ссылка вида `/join/TZ-XXXXXX`").
- **Impact:** Every share action produces a broken link. The join mechanic still works via token paste, so this is a UX/expectation defect, not a hard block — but it directly contradicts the spec's link format and will confuse demo recipients.
- **Root cause:** A `/join/[token]` page was never built; the copy button was wired assuming it would exist.
- **Recommended fix:** Add `src/app/join/[token]/page.tsx` that (a) if logged-in and unknown role, auto-calls `/projects/join` with the token and `shared_by` from query; (b) if anonymous, redirects to `/login?callbackUrl=/join/{token}`; (c) shows pending/active/removed result. Or, short-term, change the copied text to plain `TZ-XXXXXX` with instructions to paste it.
- **Acceptance criteria:** a logged-in user clicking a copied `/join/TZ-XXXXXX` link either joins automatically (priority sharer) or lands on the token-paste form pre-filled.
- **Dependencies:** none.

---

### FE-006 [P1] — Typo class `bg-tz-danger-soft0` makes the "Отклонить" join-request button background transparent (invisible white-on-transparent button)

- **Status:** confirmed (static)
- **Area:** FE / UX
- **Location:** `technozrelost-frontend/src/app/dashboard/project/[id]/page.tsx:715` — class `bg-tz-danger-soft0` (stray `0`)
- **Reproduction (static):** the class `tz-danger-soft0` is not defined in `globals.css`; only `bg-white` has the global dark override. The reject button therefore renders with no background fill; combined with white text it is effectively invisible/un-clickable-looking.
- **Actual:** Reject-join-request control has a broken style → likely unusable in practice.
- **Expected:** a visible danger-soft background (`bg-tz-danger-soft`).
- **Impact:** Project owners may be unable to reject join requests from the card UI (the button is there but unstyled). This blocks part of join-flow QA item B3/B6 in the UI.
- **Root cause:** typo (`soft0` vs `soft`).
- **Recommended fix:** change `bg-tz-danger-soft0` → `bg-tz-danger-soft` (and confirm the token exists; if not, add it or use `bg-red-50`/a token).
- **Acceptance criteria:** reject button is visibly styled in both themes; owner can reject a pending request from the card.
- **Dependencies:** should be live-verified (BLOCKED-2) once a browser pass runs.

---

### BE-LOGIC-001 [P2] — Stage document upload can create duplicate/concurrent `promotion_requests` for the same project+level

- **Status:** confirmed (live)
- **Area:** BE / business logic
- **Location:** `app/api/v1/stages.py:192-207` (auto-trigger) and `:268` (`_latest_request`)
- **Reproduction (live):** With a complete kit already creating request #5 (`status=docs_uploaded`, LLM FAIL), uploading **another** substantive doc for the same requirement created request #6 (`pending_manager`) instead of updating #5. The manager queue then showed the newer one; #5 remained stranded in `docs_uploaded`.
- **Actual:** Each "kit complete" event creates a **new** `PromotionRequest` (incrementing `attempt_no`) without checking for an existing non-terminal request for the same `from_level`. A project can accumulate several `docs_uploaded`/`pre_evaluated`/`pending_manager` requests at once, confusing the manager queue and the attempt history.
- **Expected (spec §3.2/№6):** a single current request per stage; re-evaluation updates the same request; a new attempt should only begin after the previous was rejected/closed.
- **Impact:** Manager sees duplicated/inconsistent requests; attempt history is noisy; potential double-promotion if two managers act on two `pending_manager` rows.
- **Root cause:** no guard "if a non-terminal request exists for `project.current_level`, reuse it".
- **Recommended fix:** in `upload_stage_document`, before creating a request, `SELECT … WHERE project_id AND from_level=current_level AND status IN ('docs_uploaded','pre_evaluated','pending_manager')`; if found, update its `evaluation_result`/`status` instead of inserting. Add a partial unique index `(project_id, from_level) WHERE status IN (...)` as a backstop.
- **Acceptance criteria:** a project has at most one non-terminal promotion request per stage; re-upload re-evaluates the same row; test covers re-upload after FAIL.
- **Dependencies:** none.

---

### BE-LOGIC-002 [P2] — Stage pre-evaluation silently returns SUCCESS when LLM key is absent (false-positive promotion)

- **Status:** confirmed (code)
- **Area:** BE / business logic / security
- **Location:** `app/api/v1/stages.py:112-115` — `if not answer: return True, [], "…принят (без LLM)"`
- **Reproduction (static):** if `LLM_API_KEY` is unset/`change_me`, `ask_llm` returns `None`, and `_evaluate` returns `success=True` purely on kit-completeness, immediately queuing the promotion for the manager.
- **Actual:** Without an LLM, *every* complete document kit auto-passes preliminary evaluation and reaches the manager queue labelled "оценка успешна".
- **Expected (spec №4/§3.2):** the system gives a preliminary ГОСТ-based evaluation; a missing evaluator should not silently grade everything as passed.
- **Impact:** In any deployment without an LLM key (e.g. a misconfigured server), the "preliminary ГОСТ evaluation" step is a no-op pass-through — the manager loses the system's second opinion entirely. Live (key present) this is not triggered, which is why the demo works.
- **Root cause:** fallback was designed for graceful degradation but chose the unsafe default.
- **Recommended fix:** when no LLM key, return `success=None` ("оценка недоступна — нет LLM") and set request status to `pre_evaluated` with a clear message, **not** auto-`pending_manager`. Let the manager see "система не оценила" and decide manually. Alternatively, fail loudly at startup if `LLM_API_KEY` missing in production.
- **Acceptance criteria:** no-LLM config does not auto-pass; request clearly marked "evaluation unavailable"; manager UI shows that state.
- **Dependencies:** none.

---

### BE-LOGIC-003 [P3] — Regenerated join token's old value is written into the audit trail in cleartext

- **Status:** confirmed (code)
- **Area:** BE / security / audit
- **Location:** `app/api/v1/membership.py:241-245` — `await _add_audit(db, project_id, user.id, "project.token_regenerated", {"old_token": old_token})`
- **Actual:** On token regeneration, the **old** token (which the spec says should be invalidated) is persisted in `audit_trail.details.old_token` in cleartext. Anyone with audit-read access (owner, CNTR staff) can recover and potentially replay the old token if it wasn't actually invalidated at the membership level.
- **Expected:** invalidated tokens should not be recoverable; log a hash/prefix only.
- **Impact:** Low — the old token is replaced in `projects.join_token` (unique), so it can't be used for *new* joins, but the audit row leaks the credential. Defense-in-depth concern.
- **Recommended fix:** log `{"old_token_prefix": old_token[:6], "old_token_hash": sha256(old_token)}` instead of the full token.
- **Acceptance criteria:** `audit_trail` contains no full join tokens.
- **Dependencies:** none.

---

### BE-LOGIC-004 [P2] — Generated document **content is not persisted**; only a metadata row is saved

- **Status:** confirmed (code)
- **Area:** BE / business logic
- **Location:** `app/services/document_generator.py:129-147` — the `ProjectDocument` row is created with `title/doc_type/status/version/uploaded_by` but **`file_url` is never set**; the rendered `content` string is only returned in the `GeneratedDocumentOut` response and discarded.
- **Actual:** After generating a TZ/Passport/TEO, the project's document list (`/projects/{id}/documents`) shows the document exists, but its **text is lost** — a later fetch returns no content. The UI shows it in a modal at generation time only.
- **Expected (spec §3.4-№3):** "сохранение результата в `project_documents` + аудит + UI-кнопка". The audit row is added, but the **content storage** half is unfulfilled.
- **Impact:** Users cannot retrieve a previously generated document; regeneration is the only way to see it again. Partial fulfilment of a spec-required fix.
- **Root cause:** `file_url` was intended to hold the content (or a ref to stored content) but the assignment was omitted.
- **Recommended fix:** either store the rendered text in `file_url` (rename semantics) or add a `content`/`body` TEXT column to `project_documents` and persist it; surface it in `ProjectDocumentOut`. Migration + model + serializer update.
- **Acceptance criteria:** after generation, `GET /projects/{id}` documents include the rendered text; reload shows the document body.
- **Dependencies:** migration (small).

---

### FE-002 [P2] — `technologies` page `CATEGORIES` is hardcoded to `["AI/ML","НИОКТР"]`; categories present in data are not selectable

- **Status:** confirmed (static)
- **Area:** FE / data
- **Location:** `technozrelost-frontend/src/app/dashboard/technologies/page.tsx:63`
- **Actual:** The category `<select>` offers only two fixed categories; projects/orgs with any other `category` can't be filtered from the UI (server still accepts the param). The `investor` page (`investor/page.tsx:76-82`) correctly derives categories from data — inconsistent.
- **Expected:** filters reflect actual data.
- **Impact:** Minor filtering limitation; demo-acceptable but a real defect.
- **Recommended fix:** derive `CATEGORIES` from the registry response (`Array.from(new Set(rows.map(r=>r.category)))`).
- **Acceptance criteria:** category dropdown lists every category present in the registry.
- **Dependencies:** none.

---

### FE-003 [P2] — Dark mode broken on status boxes/badges in the project card and executors page (hardcoded Tailwind palette)

- **Status:** confirmed (static)
- **Area:** FE / theme
- **Location:** `technozrelost-frontend/src/app/dashboard/project/[id]/page.tsx:788-808,535,543` (`bg-green-50/border-green-200/text-green-600`, `bg-yellow-50/text-yellow-600`); `executors/page.tsx:160` (`bg-indigo-50/text-indigo-600`); `project/[id]/page.tsx:432` (hardcoded chart stroke/fill `#E8ECF0`/`#64748B`)
- **Actual:** `globals.css` only overrides `.dark .bg-white`; the green/yellow/indigo `*-50` classes have no dark equivalent, so KT-1 status boxes, control-point statuses, the org badge, and chart gridlines render as bright light-coloured blocks / low-contrast ticks in dark theme.
- **Expected (QA implicit, spec §7 design tokens):** both themes legible.
- **Impact:** Dark-mode visual defects on the most complex page (project card) and the executors page. Light theme (likely the demo default) is fine.
- **Recommended fix:** replace hardcoded palette with `tz-*` tokens (add `tz-success-soft`, `tz-warning-soft`, `tz-info-soft`) or add `.dark` overrides for the specific classes; make chart colours token-driven.
- **Acceptance criteria:** KT-1 box, control-point badges, org badge, radar grid render with correct contrast in dark mode (browser-verified).
- **Dependencies:** BLOCKED-2 (needs a browser pass to fully confirm visual).

---

### FE-004 [P2] — N+1 fetch storms on auditor / regulating-org / project-detail pages (no timeout)

- **Status:** confirmed (static)
- **Area:** FE / performance / reliability
- **Location:** `auditor/page.tsx:123-131` (loops `/projects/{id}` per project), `regulating_organization/page.tsx:56-74` (per-project detail to count `verification_documents`), `project/[id]/page.tsx` (fan-out). These pages use **raw `fetch`** not the `api-client`, so they have **no timeout** (the shared client has a 5s timeout but is near-dead — only 1 consumer).
- **Actual:** Loading these dashboards issues 1 + N requests; with many projects they become slow and can hang indefinitely on a slow backend.
- **Expected:** O(1) backend calls per dashboard load (or a single aggregate endpoint).
- **Impact:** Demonstrable slowness/degradation as data grows; fragile under backend latency.
- **Recommended fix:** add backend aggregate fields (e.g. `verification_documents_count`, `control_points` summary) to the list responses, or at minimum route all calls through `api-client` with a timeout. Medium effort.
- **Acceptance criteria:** each dashboard loads with ≤2 backend round-trips regardless of project count.
- **Dependencies:** none.

---

### FE-005 [P3] — `gk_customer` dashboard silently swallows fetch errors to zeros (inconsistent with other role dashboards)

- **Status:** confirmed (static)
- **Area:** FE / UX / error handling
- **Location:** `technozrelost-frontend/src/app/dashboard/gk_customer/page.tsx:75` — `catch {}` sets stats to 0 with no user message; contrast `rd_executor`/`scientific_org` which show an error + retry button.
- **Actual:** On any backend error the GK dashboard shows "0 проектов / 0 исполнителей" with no indication of failure.
- **Expected:** visible error + retry, consistent with sibling dashboards.
- **Impact:** Misleading empty state during outages.
- **Recommended fix:** extract the shared error/retry pattern used by rd_executor into a hook/component and reuse in gk_customer.
- **Acceptance criteria:** backend error shows an error message + retry on the GK dashboard.
- **Dependencies:** none.

---

### FE-UX-003 [P3] — Manager rejection reason uses browser `window.prompt` (poor, non-stylable UX)

- **Status:** confirmed (static)
- **Area:** FE / UX
- **Location:** `technozrelost-frontend/src/app/dashboard/cntr_manager/page.tsx:53,61`
- **Actual:** Rejecting a draft or promotion pops a native `window.prompt` for the reason. Functional, but jarring, not localisable, and inconsistent with the app's modal style.
- **Expected:** an in-app modal/textarea.
- **Impact:** Demo polish; correctness is fine (empty reason correctly aborts).
- **Recommended fix:** replace with a styled modal textarea bound to the decide call.
- **Acceptance criteria:** rejection uses an in-app modal; reason required.
- **Dependencies:** none.

---

### FE-007 [P3] — Shared API client is effectively dead (1 consumer) while 41 raw `fetch` calls duplicate auth/error logic

- **Status:** confirmed (static)
- **Area:** FE / maintainability
- **Location:** `technozrelost-frontend/src/lib/api-client.ts` (1 consumer: `projects/page.tsx`); 41 raw `fetch` across 21 files; `API_URL` redeclared inline in 18 files.
- **Actual:** No single source of truth for base URL, auth header, timeout, or error extraction; behaviour varies per page (some swallow errors, some throw generic `'Failed to fetch'`).
- **Expected:** one client, used everywhere.
- **Impact:** Drift, inconsistent error UX, no timeouts on most calls. Not a demo blocker but a real maintainability/safety debt.
- **Recommended fix:** migrate raw `fetch` calls to the shared `apiRequest` (extend it as needed: timeouts, JSON error extraction), remove inline `API_URL`.
- **Acceptance criteria:** zero raw `fetch(${API_URL}/api/v1…)` outside `api-client.ts`.
- **Dependencies:** none (refactor; do after P0/P1).

---

### FE-008 [P3] — Dead code: `src/lib/questionnaire-data.ts` (the old hardcoded questionnaire) has zero imports

- **Status:** confirmed (static)
- **Area:** FE / cleanup
- **Location:** `technozrelost-frontend/src/lib/questionnaire-data.ts` (entire file)
- **Actual:** The wizard now uses the live `/assessments/template`; this static file is unused (grep confirmed zero imports).
- **Expected:** removed (spec §3.4-№7 "убрать хардкод-моки").
- **Impact:** Confusion / dead weight; signals old hardcoded-data era.
- **Recommended fix:** delete the file.
- **Acceptance criteria:** file removed; build green.
- **Dependencies:** none.

---

### INFRA-002 [P2] — Backend dev venv is Python 3.14 (spec mandated 3.11/3.12); Dockerfile correctly pins 3.12

- **Status:** confirmed
- **Area:** Infra / dependency
- **Location:** pytest warning: `.venv/lib/python3.14/...`; `pyproject.toml:6` `requires-python = ">=3.11"`; `Dockerfile:1` `python3.12-bookworm-slim` (production is fine); spec §3.4-№10 mandated recreating the venv under 3.11/3.12.
- **Actual:** Local dev runs on 3.14 (88 tests pass, ruff clean, so functionally OK), but 3.14 is bleeding-edge and not the targeted runtime; production uses 3.12. This is a dev/prod runtime skew.
- **Expected:** dev matches prod (3.12) per the spec fix.
- **Impact:** Low immediate risk (works), but dev/prod skew can hide 3.12-vs-3.14 stdlib/behaviour differences; also the originally-reported `pydantic_core` breakage on 3.14 (spec §3.4-№10) is presumably resolved by now since tests pass.
- **Recommended fix:** recreate the local venv with `uv venv --python 3.12 && uv sync` to match prod; update README.
- **Acceptance criteria:** `uv run python --version` → 3.12.x locally; tests still green.
- **Dependencies:** none.

---

### BE-VALID-002 [P3] — Re-assessment returns 422 ("Нужно заполнить экспресс-оценку") instead of 403 when answers are empty

- **Status:** confirmed (live)
- **Area:** BE / API contract
- **Location:** `app/api/v1/assessments.py:150-166` — the empty-input 422 check runs **before** the re-assessment 403 guard? (Actually the guard at :150 runs first, but on a **second** assessment call the guard matches only if a prior project exists with `current_level>0` or `preliminary_level IS NULL`; a freshly-created draft has `preliminary_level` set and `current_level=0`, so the guard's second branch `preliminary_level.is_(None)` is False → the user *is* blocked, but via the 422 empty-answers path when they send empty answers, or via 403 if they send real answers again.)
- **Reproduction (live):** second `POST /assessments` with `{"answers":[]}` → 422; with real answers → 403.
- **Actual:** Re-assessment is correctly **blocked**, but the status code/message depends on the payload (422 for empty, 403 for real), which is an inconsistent contract.
- **Expected:** always 403 with the "переоценка недоступна" message for a user who already has an assessed project.
- **Impact:** Low — the guard works; only the error surface is inconsistent. Frontend won't hit empty-answers in normal flow.
- **Recommended fix:** move the re-assessment 403 guard to run **before** the empty-input 422, or make the empty-input check only apply when no prior project exists.
- **Acceptance criteria:** any second `POST /assessments` by an assessed user returns 403 regardless of payload.
- **Dependencies:** none.

---

## Suspected findings

### FE-009 [P3 suspected] — Responsive/mobile layout & full accessibility unverified (no browser pass)

- **Status:** suspected
- **Area:** FE / responsive / a11y
- **Location:** all dashboard pages
- **What couldn't be proved:** Without a browser run (BLOCKED-2), mobile viewport layout, keyboard focus order, ARIA/label correctness, and contrast in both themes are unverified. The token system and per-page empty states look structurally sound, but "responsive + accessible" is a claim, not a verified fact.
- **Blocker to confirm:** a Playwright/browser smoke across mobile (375px) and desktop in both themes on the 9 dashboards + wizard.
- **Risk:** demo-on-mobile or accessibility audit failure.
- **Recommended action:** run `web-gui-tester` skill on the live `:3000` for all 9 dashboards before 31.08.

### BE-LOGIC-005 [P2 suspected] — Promotion/auto-application not concurrency-safe (race under parallel uploads)

- **Status:** suspected
- **Area:** BE / concurrency
- **Location:** `app/api/v1/stages.py:192-207`
- **What couldn't be proved:** Two participants uploading the last two required docs near-simultaneously could both pass the "kit complete" check and each insert a `PromotionRequest` before either commits. No DB-level uniqueness guard exists. Single-threaded testing (TestClient) cannot reproduce this.
- **Risk:** duplicate requests (overlaps with BE-LOGIC-001) / double notifications.
- **Recommended action:** load/stress test with 2 concurrent uploaders, or add the partial unique index proposed in BE-LOGIC-001 (which also closes this).

### INFRA-003 [P2 suspected] — Stage-requirements dictionary is hand-seeded, not LLM-generated+methodologist-verified as spec №16 mandates

- **Status:** suspected
- **Area:** BE / data / process
- **Location:** 8 rows in `public.stage_requirements` (seeded, titles like «Технологическая концепция»); `spec.md §5/№16` says the per-stage required-documents lists are produced **once by LLM over the GOSTs** then **verified by the centre's methodologist**, stored as the deterministic auto-application trigger.
- **What couldn't be proved:** Whether these 8 stage rows are the LLM-generated+verified artefact or a hand-written placeholder. They look hand-authored (generic titles, single requirement per stage). The spec marks this as a manual user step ([PLACEHOLDER]).
- **Risk:** If hand-authored, the "LLM по ГОСТам один раз" requirement is unmet; if verified, this is fine.
- **Recommended action:** confirm with Functional Validator whether the methodologist verification happened; if not, run the generation pass and record provenance in the table.

---

## Blocked checks

1. **Browser/DOM-level verification (BLOCKED-2).** No Playwright/browser run in this pass. All FE findings marked "static" are real code-level defects, but their *visual* severity and any additional theme/a11y issues can only be confirmed with a live browser pass on `:3000`. **Blocker to clear:** run the `web-gui-tester` skill across both themes + mobile for the 9 dashboards, wizard, manager queues, registries, project card.
2. **`mypy --strict` baseline (BLOCKED-1).** Not run. `pyproject` sets `strict=true`. **Blocker to clear:** `uv run mypy app/` and triage the baseline (expected non-trivial on an untyped async ORM codebase) separately from new issues.

---

## Not-a-bug / verified claims (important hypotheses disproved)

1. **"Preliminary UGT is always 0 → scorer broken"** — **FALSE.** Diagnosed directly: `compute_readiness` requires a level's *average* maturity ≥70% **and** all critical checkpoints ≥0.75 to "achieve" it. My smoke payload marked only critical checkpoints as `documented` and left non-critical at `in_progress` (0.25), so level averages were ~50% → correctly *not* achieved. The scorer is **intentionally conservative** and works; a fully-filled assessment yields the expected UGT. No defect.
2. **"Assessment payload mismatches backend schema"** — **FALSE.** Wizard payload `{checkpoint_code,status,applicable,comment,evidence:[{evidence_code,status}]}` matches `AssessmentIn`/`ReadinessAnswerIn` (`schemas.py:123,357`) exactly, including the `applicable = status!=='not_applicable'` derivation.
3. **"Projects leak to non-owners"** (IDOR) — **FALSE.** Live test: GK `GET /projects/1` (admin-owned) → **404** (existence hidden). `require_project_access` returns 404 to outsiders. ✅
4. **"Anyone can register staff roles"** — **FALSE.** Live: `cntr_admin` self-registration → **403**. `auth.py:16` blocks `CNTR_STAFF_SLUGS`. ✅
5. **"Tech registry needs a separate entity"** — **FALSE.** It's `GET /projects/registry?ugt_min=7` over the same data. Live-verified: project appears at level 7 automatically. ✅
6. **"Join mechanic leaks 404 vs 403"** — **FALSE.** `/verification-docs` returns **403 with a clear message** before join (not 404), as the spec's special-case RBAC intends. ✅
7. **"Stage pre-evaluation is a stub"** — **FALSE.** Live: the configured LLM (`nemotron-3-ultra-free`) **really read the uploaded content** and returned a Russian FAIL listing the missing items, then a SUCCESS on substantive content. Real integration. ✅
8. **"Chat calls RAG twice / uses `type("",(),{})` hack"** (spec §3.4-№5) — **FALSE/resolved.** `chat.py` calls `process_chat` which runs `search_documents` once. The old hack is gone. ✅
9. **"`/upload-tz` and broken level links still present"** (spec §3.4-№2) — **PARTIAL.** `/upload-tz` is gone (no references). `/levels/[id]` **still exists and is linked** from the landing page — but the page works (`generateStaticParams`), so this is *intentional content*, not a dead link. The spec said "fix or remove"; leaving a working page is acceptable.
10. **"Document generation has unresolved `{{...}}` placeholders"** (spec §3.4-№3) — **FALSE for placeholders**: `_resolve_variable` resolves `{{project_budget_percent_30/40}}` and all known vars; unknown vars are left as-is (rare). The *real* gap is persistence (BE-LOGIC-004), not unresolved placeholders.
11. **`executors.py` DISTINCT ON + ORDER BY → 500"** (spec §3.4-№4) — **FALSE/resolved.** Rewritten to GROUP BY; live `/executors` returns 196 rows without error. ✅

---

## Unimplemented or incomplete requirements

(Kept separate from bugs — these are missing/partial *features*, not defects.)

1. **Real embeddings for RAG (spec §5 [PLACEHOLDER]).** Currently the hash fallback; RAG retrieval effectively non-functional (RAG-001). The spec explicitly left "try `/embeddings`; fall back to hash" open — the fallback is what shipped, and it doesn't retrieve.
2. **LLM-generated + methodologist-verified stage-document dictionary (spec №16 [PLACEHOLDER]).** 8 stage rows exist but provenance/verification unconfirmed (INFRA-003).
3. **Generated-document content persistence (spec §3.4-№3).** Audit row + button exist, but the rendered text is not stored (BE-LOGIC-004).
4. **`/join/{token}` share-link route (spec §4).** Link is generated but the route doesn't exist (FE-001).
5. **Email notifications / password reset (spec §10-№7 Out-of-Scope).** Confirmed out of scope — not a gap.
6. **NIОКТR full analytics, FIPS, ЕСИА, billing, mobile, EDO/УКЭП, Redis, CI/CD, ФСТЭК.** All confirmed Out-of-Scope (spec §10) — not gaps.

---

## Broken or risky dependencies

**Confirmed broken / risky:**
- `lucide-react@^1.25.0` (`package.json:15`) — unusual pinned version (canonical lucide-react is `0.x`); supply-chain provenance unclear. (DEP-002)
- `sharp` transitive (via `next`) — **3 high-severity advisories**. (DEP-002)

**Compatibility risk (not broken):**
- `next@16.2.10` + `next-auth@5.0.0-beta.32` — Next 16 is very new; NextAuth v5 is beta. Build + e2e pass, but beta + brand-new-major is a release risk to watch. The `npm audit fix --force` path bumps Next to 16.3.0 — needs re-validation.

**Deprecated-but-working:**
- `bcrypt<4.1` cap (`pyproject.toml:24`) — intentional for passlib compat; fine.
- `psycopg[binary]>=3.2` + `asyncpg>=0.30` both present — asyncpg is the actual async driver (used in DSN); psycopg[binary] is likely for alembic/sync tooling. Not a conflict, but redundant surface.

**Dev/test only:**
- `pytest`, `httpx`, `ruff`, `mypy`, `pytest-asyncio` — correctly under `[project.optional-dependencies.dev]`.

**Python runtime:** `>=3.11` declared; **3.14 in dev venv**, 3.12 in Dockerfile. Dev/prod skew (INFRA-002).

**Unused:**
- `src/lib/questionnaire-data.ts` — dead frontend code (FE-008).
- `pymupdf>=1.28.0` (`pyproject.toml:25`) — declared as runtime dep but no `import fitz`/`pymupdf` found in `app/`. Likely intended for GOST PDF ingestion scripts; confirm it's actually used by `seed_gost` or remove.

---

## MVP remediation roadmap

### Wave 0 — release blockers (close before any demo/31.08)

| ID | Goal | Files/modules | Size | Notes |
|---|---|---|---|---|
| RAG-001 | Make RAG actually retrieve (real embeddings) | `app/core/embeddings.py`, new embeddings provider, re-embed script, `tests/test_rag.py` | L | The P0. Needs a Russian/multilingual embedding model. |
| RAG-002 | Fix GOST title/source_uri mojibake | `app/db/seed_gost.py`, one-shot SQL fix | S | Pairs with RAG-001. |
| INFRA-001 | Fix prod compose frontend build context | `infra/docker-compose.prod.yml` | S | Production deploy otherwise fails. |
| DEP-002 | Clear npm high-severity vulns; confirm lucide | `package.json`, `npm audit fix` | S | Production security. |
| FE-001 | Add `/join/[token]` route (or fix copied text) | `src/app/join/[token]/page.tsx` | S | Spec-mandated share link. |
| FE-006 | Fix `bg-tz-danger-soft0` typo | `project/[id]/page.tsx:715` | S | Reject-join button unusable. |

### Wave 1 — critical core flow correctness

| ID | Goal | Size |
|---|---|---|
| BE-LOGIC-001 | Deduplicate concurrent promotion requests (guard + partial unique index) | M |
| BE-LOGIC-002 | Don't auto-pass stage eval when LLM absent | S |
| BE-LOGIC-004 | Persist generated document content (migration + model + serializer) | M |
| FE-003 | Dark-mode status boxes/badges/charts on project card + executors | M |
| FE-004 | Eliminate N+1 dashboard fetches (backend aggregates or client consolidation) | M |
| BE-LOGIC-005 (suspected) | Concurrency test + unique-index backstop for auto-application | S |

### Wave 2 — reliability, integrations, infra

| ID | Goal | Size |
|---|---|---|
| INFRA-002 | Recreate dev venv on Python 3.12 to match prod | S |
| INFRA-003 (suspected) | Confirm/run LLM-generated stage dictionary + methodologist sign-off | M |
| FE-007 | Consolidate 41 raw `fetch` into shared `api-client` | L (refactor) |
| FE-002 | Derive registry categories from data | S |

### Wave 3 — quality, UX, edge cases

| ID | Goal | Size |
|---|---|---|
| FE-009 (suspected) | Full browser pass: both themes + mobile + a11y on 9 dashboards | M |
| FE-UX-003 | Replace `window.prompt` rejection with a modal | S |
| FE-005 | Consistent error/retry on gk_customer dashboard | S |
| FE-008 | Delete dead `questionnaire-data.ts` | S |
| BE-LOGIC-003 | Don't log full old join tokens in audit | S |
| BE-VALID-002 | Consistent 403 on re-assessment regardless of payload | S |

---

## Recommended execution order (small independent tickets)

1. **FE-006** (one-char typo) — instant win, unblocks join-reject UI.
2. **INFRA-001** (compose path) — unblocks production deploy validation.
3. **FE-001** (`/join/[token]` route) — small, high-visibility spec item.
4. **RAG-002** (GOST titles) — S, prerequisite feeling for RAG-001's user-visible payoff.
5. **RAG-001** (real embeddings) — the P0; largest item, start early, blocks QA-F2.
6. **DEP-002** (npm audit) — after RAG work to avoid rebasing churn.
7. **BE-LOGIC-002** + **BE-LOGIC-001** — correctness of the promotion flow; do together (both touch `stages.py`).
8. **BE-LOGIC-004** — document persistence (needs a migration; batch with any other migration).
9. **FE-003 / FE-004** — frontend polish; after core is stable.
10. **INFRA-002 / FE-007 / FE-008 / BE-LOGIC-003 / BE-VALID-002 / FE-005 / FE-UX-003 / FE-002** — independent small cleanups, parallelisable.
11. **FE-009** — final browser gate (needs everything above merged).
12. **INFRA-003** — coordinate with Functional Validator (manual methodologist step).

Rationale: Wave-0 items 1–3 are tiny and remove the most embarrassing demo failures; RAG-001 is the long pole, so it starts at step 5; promotion correctness (7) must precede a credible manager-queue demo.

---

## Final verification gate

The MVP is "ready to demo / ship" when **all** of the following pass on a clean checkout with both services up:

**Backend:**
- `uv run pytest -q` → ≥88 passed (add RAG + dedup tests → target ≥92)
- `uv run ruff check app/ tests/` → clean
- `uv run mypy app/` → baseline triaged (BLOCKED-1 cleared)
- `uv run alembic upgrade head` on a **clean** DB → reaches `0011`, idempotent re-run is a no-op
- Live: `/api/v1/ready` → `{primary:ok, replica:ok}`

**Frontend:**
- `npm run lint`, `npx tsc --noEmit`, `npm run build` → all clean
- `npm audit` → **0 high/critical**
- `npm ls --depth=0` → 0 extraneous (or justified)

**End-to-end (live, real data — re-run the smoke in this review):**
1. Register `gk_customer` → ЛК with real stats (no 0s-without-error)
2. Express assessment → draft with non-zero preliminary UGT for a fully-filled form
3. Manager approves → official UGT; project in `/projects/registry`
4. Set project ≥7 → appears in `/projects/registry?ugt_min=7`
5. Upload stage docs (substantive) → **LLM evaluates** → manager queue → approve → level N+1; **only one** request per stage
6. `/join/TZ-XXXXXX` link **works** (route exists) → regulating org pending → owner approves → verification doc 201
7. `/chat` question about УГТ → real answer **+ sources citing the correct GOST chunk with readable Cyrillic titles**
8. `/rag/search?q=<gost term>` → ≥1 result with `similarity>0.3`

**RBAC/security (live, must hold):**
- Anonymous → 401 on all protected endpoints; `/assessments/template` public
- `gk_customer` → 403 on `/manager/*` and `PATCH /users/{id}`
- Foreign project → 404 (existence hidden)
- Staff self-registration → 403
- Re-assessment → **403** (not 422)
- `audit_trail` contains no full secrets/tokens

**Browser (BLOCKED-2 cleared):**
- `web-gui-tester` green on all 9 dashboards + wizard + manager queues + registries + project card, in **light + dark**, at **mobile 375px + desktop**; no console errors; charts render with real values.

**Production:**
- `docker compose -f <corrected path> up` → nginx+frontend+backend+db healthy; HTTPS responds; `/api/v1/ready` ready; seed scripts run inside backend container.

---

## Answer to the 20 critical questions (short)

1. Public staff-role self-registration? **No** — 403 (live-verified).
2. IDOR on project/doc/assessment/membership? **No** — 404 hides existence; membership/access enforced (live-verified).
3. Assessment persists real answers/evidence + payload match? **Yes** — exact schema match; answers + evidence stored (verified).
4. Draft created on live DB after assessment? **Yes** (live-verified).
5. Preliminary UGT computed backend-only? **Yes** — `compute_readiness` pure server-side.
6. Both manager queues approve/reject+reason? **Yes** (live-verified); minor: rejection UX is `window.prompt`.
7. Auto-application strictly on stage-kit completeness? **Yes, but** creates duplicate requests (BE-LOGIC-001).
8. UGT≥7 auto in tech registry? **Yes** (live-verified).
9. Join token priority/pending/active/removed + old-token invalidation? **Yes** (live-verified); old token leaked to audit (BE-LOGIC-003).
10. Verification doc only after join? **Yes** — 403 before join (live-verified).
11. Generated docs + audit persisted? **Audit yes; content NO** (BE-LOGIC-004).
12. AI/RAG real answers + sources, or stub? **Answers real; sources non-functional** (RAG-001/002).
13. Mocks/hardcoded counters/fake success? **No** in dashboards (real data); the LLM-absent fallback fakes success (BE-LOGIC-002).
14. All 9 roles through real allowed scenarios? **Yes** structurally; full browser pass pending (FE-009).
15. FE routes / API methods / schemas / migrations / role matrix align? **Yes**, modulo FE-001/FE-006.
16. Production blocker in migrations/env/Docker/startup/secrets? **Yes** — INFRA-001 (compose path); dev/prod Python skew INFRA-002; secrets are `change_me`-defaults in config (must be generated at deploy, documented).
17. Bugs in both themes + mobile? **Likely** in dark mode on project card (FE-003/006); mobile unverified (FE-009).
18. Spec features not implemented? Real embeddings; `/join` route; generated-doc persistence; (maybe) LLM stage dictionary — see "Unimplemented".
19. Deps really broken vs upgrade-risk? **Broken:** sharp (3 high) via next; **risk:** Next 16 + NextAuth beta; **skew:** Python 3.14 dev vs 3.12 prod.
20. What blocks the demo right now? **Nothing on the primary path** (works live); the **AI-citations** demo step is blocked by RAG-001/002, and **production deploy** by INFRA-001/DEP-002.
