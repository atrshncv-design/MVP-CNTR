# Graph Report - .  (2026-07-24)

## Corpus Check
- Corpus is ~27,035 words - fits in a single context window. You may not need a graph.

## Summary
- 183 nodes · 292 edges · 13 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 105 · ON_BRANCH: 66 · MODIFIES: 47 · PARENT_OF: 34 · imports: 21 · imports_from: 18 · calls: 1


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 48 · Candidates: 65
- Excluded: 11 untracked · 33589 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `366dc36`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `RoleDashboard()` - 8 edges
2. `ROLES` - 4 edges
3. `RoleSlug` - 4 edges
4. `ROLE_DASHBOARD` - 4 edges
5. `UGT_LEVELS` - 3 edges
6. `getLevelColor()` - 2 edges
7. `QuestionnaireWizardClient()` - 2 edges
8. `isProtectedRoute()` - 2 edges
9. `isAuthRoute()` - 2 edges
10. `allowedRolesFor()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `083f89d docs: import MVP-0 frontend source and project context` --ON_BRANCH--> `codex/recovery-backend`  [EXTRACTED]
  git → git  _Bridges community 1 → community 6_
- `083f89d docs: import MVP-0 frontend source and project context` --ON_BRANCH--> `codex/recovery-docs`  [EXTRACTED]
  git → git  _Bridges community 1 → community 4_
- `7576f9f feat(auth): NextAuth.js v5 Credentials + JWT; middleware RBAC; /login,/register, 9 role dashboards, /forbidden` --ON_BRANCH--> `codex/recovery-frontend`  [EXTRACTED]
  git → git  _Bridges community 3 → community 1_
- `7576f9f feat(auth): NextAuth.js v5 Credentials + JWT; middleware RBAC; /login,/register, 9 role dashboards, /forbidden` --PARENT_OF--> `de672d4 feat(frontend): Phase 2 — port UGT scale, questionnaire wizard, GK dashboard`  [EXTRACTED]
  git → git  _Bridges community 3 → community 2_
- `de672d4 feat(frontend): Phase 2 — port UGT scale, questionnaire wizard, GK dashboard` --ON_BRANCH--> `codex/recovery-frontend`  [EXTRACTED]
  git → git  _Bridges community 2 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (24): DeliverableDoc, RiskItem, UGI_LEVELS, UGILevel, UGP_LEVELS, UGPLevel, UGS_LEVELS, UGSLevel (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (16): Message, metadata, codex/recovery-frontend, feat/frontend, 083f89d docs: import MVP-0 frontend source and project context, 34f958e chore: establish frontend recovery harness, 366dc36 feat: apply process-first platform shell, 4bf9277 chore(frontend): isolate worktree from docs baseline (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (13): de672d4 feat(frontend): Phase 2 — port UGT scale, questionnaire wizard, GK dashboard, containerVariants, easeOut, itemVariants, statCards, EVALUATION_THRESHOLDS, QUESTIONNAIRE, QuestionnaireItem (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (3): 7576f9f feat(auth): NextAuth.js v5 Credentials + JWT; middleware RBAC; /login,/register, 9 role dashboards, /forbidden, navigation, RoleDashboard()

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (18): codex/recovery-docs, main, 00f9718 docs: update Plan.md (Phase 2 done) and Status.md (Phase 2 report), 07a0b33 docs: record approved intake and identity decisions, 0859641 docs: record stage 1 UI shell evidence, 088b40c docs: update Plan.md + Status.md — Phase 2 complete, 347b083 docs: define fixed MVP intake workflow, 542daf1 docs: mark Plan 1.1/1.2 done; update Status with Phase-1 progress (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (9): allowedRolesFor(), isAuthRoute(), isProtectedRoute(), ROLE_DASHBOARD, ROLES, RoleSlug, ROUTE_ALLOWED_ROLES, Status (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.49
Nodes (10): codex/recovery-backend, feat/backend, 298b24f feat(phase4): executors/technologies registries + AI assistant chat, 3484a24 feat(rag): RAG pipeline + document generator, 4803fb6 fix: harden backend readiness and AI transport, 7887d0b feat(backend): scaffold FastAPI app (uv, SQLAlchemy async, pgvector, alembic, ruff/mypy), 85a2dca chore(backend): isolate worktree from docs baseline, b8f79ed feat(db): PostgreSQL primary/replica (pgvector), schemas public/test, Serial/BigSerial, Hash/B-Tree/ivfflat indexes, Alembic migrations (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (6): AVAILABLE_TASKS, COMPETENCE_AREAS, containerVariants, DOCUMENT_TEMPLATES, easeOut, itemVariants

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (4): ProjectData, STATUS_COLORS, STATUS_LABELS, UGT_LEVEL_NAMES

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (5): ApiUser, { handlers, signIn, signOut, auth }, LoginResponse, Session, User

### Community 10 - "Community 10"
Cohesion: 0.33
Nodes (4): CATEGORIES, STATUS_COLORS, STATUS_LABELS, Technology

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (3): Executor, ROLE_COLORS, ROLE_NAMES

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (1): Status

## Knowledge Gaps
- **65 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `Message`, `Executor` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (1 nodes): `Status`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UGT_LEVELS` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `ROLES` connect `Community 5` to `Community 3`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07389162561576355 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._