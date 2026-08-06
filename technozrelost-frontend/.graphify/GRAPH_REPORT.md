# Graph Report - .  (2026-08-04)

## Corpus Check
- Corpus is ~47,207 words - fits in a single context window. You may not need a graph.

## Summary
- 405 nodes · 738 edges · 21 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 241 · MODIFIES: 158 · ON_BRANCH: 131 · PARENT_OF: 99 · imports_from: 55 · imports: 46 · calls: 7 · method: 1


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 73 · Candidates: 91
- Excluded: 1 untracked · 34716 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `28dff83`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `AssessUgTCard()` - 9 edges
2. `RoleDashboard()` - 7 edges
3. `UGT_LEVELS` - 7 edges
4. `ROLES` - 6 edges
5. `ugtTone()` - 4 edges
6. `ApiError` - 4 edges
7. `RoleSlug` - 4 edges
8. `ROLE_DASHBOARD` - 4 edges
9. `pluralCriteria()` - 3 edges
10. `UGTBadge()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `083f89d docs: import MVP-0 frontend source and project context` --ON_BRANCH--> `codex/recovery-backend`  [EXTRACTED]
  git → git  _Bridges community 1 → community 2_
- `083f89d docs: import MVP-0 frontend source and project context` --ON_BRANCH--> `codex/recovery-docs`  [EXTRACTED]
  git → git  _Bridges community 1 → community 5_
- `083f89d docs: import MVP-0 frontend source and project context` --ON_BRANCH--> `codex/recovery-frontend`  [EXTRACTED]
  git → git  _Bridges community 1 → community 7_
- `0e7389a feat(frontend): working LKs for 8 roles — real data, JoinProjectForm, expert/auditor control-point decisions, admin user management (ticket 13)` --ON_BRANCH--> `codex/recovery-frontend`  [EXTRACTED]
  git → git  _Bridges community 13 → community 7_
- `0e7389a feat(frontend): working LKs for 8 roles — real data, JoinProjectForm, expert/auditor control-point decisions, admin user management (ticket 13)` --PARENT_OF--> `f0e87a4 feat(frontend): assistant sources with УГТ/GOST sections, executors competencies+badges, technologies org+level filter (ticket 14)`  [EXTRACTED]
  git → git  _Bridges community 13 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (33): metadata, POINTS, 11a7a1c design: дизайн-система 3.0 — ink-blue, Manrope, двойная тема, живой радар (D1–D10), 775ec99 feat(landing): публичный посадочный многостраничник — hero с УТП, как это работает, 9 ролей, уровни УГТ (9 карточек + детальные страницы), о центре, методика, заказчики, исполнители, дорожная карта; дизайн-система 2.0, RSC, auth-aware навигация, CUSTOMERS, metadata, MORE_LINKS, PRIMARY_LINKS (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (24): INITIAL_ASSISTANT_MESSAGE, Message, Source, jetbrainsMono, manrope, metadata, feat/frontend, 083f89d docs: import MVP-0 frontend source and project context (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (36): codex/recovery-backend, feat/backend, 03899ac test: isolate LLM from external API in tests (empty key in test env) (ticket 09 follow-up), 0b76eae feat(registries): technologies from new table (+organization, filters), executors = НИОКТР orgs + users (ticket 11), 0bd935f fix(users): role assignment via raw DML + populate_existing reload (single primary role per user), 2055a48 feat(rag): GOST ingest script — PDF/DOCX/TXT, recursive ГОСТЫ folder, chunker tests, skip empty files (ticket 09), 298b24f feat(phase4): executors/technologies registries + AI assistant chat, 3001baa feat(deploy): production stack — Dockerfiles, compose, nginx+HTTPS, deploy.sh, README (ticket 18) (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (27): AnswerState, AnswerStatus, AssessmentTemplate, CATEGORY_CONFIG, ChecklistItem, Checkpoint, Dimension, DIMENSION_CONFIG (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (19): 23480bb feat(frontend): verification-docs panel live source, ЛК регулирующей организации, verification_documents в карточке проекта (QA open-design), 9586d79 feat(frontend): привязка дизайн-слоя к API нового ядра, Evaluation, Requirement, Project, VerificationDoc, DOC_TYPES, GeneratedDocument (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (30): codex/recovery-docs, main, 00f9718 docs: update Plan.md (Phase 2 done) and Status.md (Phase 2 report), 058ba9d docs(status): verification-docs visibility fix (80 tests, backend live), 07a0b33 docs: record approved intake and identity decisions, 0859641 docs: record stage 1 UI shell evidence, 088b40c docs: update Plan.md + Status.md — Phase 2 complete, 28b8fda docs: спека 03.08 — 19 решений интервью (экспресс-оценка УГТ, очереди менеджера, автозаявка, регулирующая организация) + журнал + статус (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (16): 4daf351 feat(frontend): GK flow — wizard saves project, doc generation, token sharing, join requests, real stats, fix broken links (ticket 12), bbc853d feat: connect scoped project workspace, de672d4 feat(frontend): Phase 2 — port UGT scale, questionnaire wizard, GK dashboard, ApiError, apiRequest(), getProjects(), ProjectSummary, EVALUATION_THRESHOLDS (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (20): codex/recovery-frontend, 060b463 fix(landing): радар крупнее (svg ~320px в паддинг-желобе с метками), луч вращается вокруг центра радара (translate+origin 0,0) по часовой стрелке, 12ae5ea fix(landing): метка «Производственная» за край контейнера (-left-2), 28dff83 fix(auth-ui): контраст login, корпоративный стиль register, публичные роли, 3764bf6 fix(landing): метки радара — HTML вместо SVG-текста (не обрезаются, центрируются по осям), убрана подпись «Радар зрелости · 4 категории», 395efcb fix(landing): радар крупнее — hero-колонка 360→560px, svg ~384px, метки в желобе px-14 вне колец, 4c5a526 fix(landing): метки радара 12px, желоб px-20, колонка 620px — слова гарантированно вне колец (правка CSS-кэша: right-4 не генерировался до чистого перезапуска), 7507304 fix(landing): метки радара крупнее (11px) и дальше от колец (px-16, колонка 600px); из футера убрано «MVP1 · сдача 31.08.2026» (+12 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (10): allowedRolesFor(), isAuthRoute(), isProtectedRoute(), ROLE_DASHBOARD, ROLES, RoleSlug, ROUTE_ALLOWED_ROLES, PUBLIC_REGISTRATION_ROLES (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (8): badge, budget(), CntrManagerDashboard(), Draft, Project, Promotion, statusLabels, Tab

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (4): 7576f9f feat(auth): NextAuth.js v5 Credentials + JWT; middleware RBAC; /login,/register, 9 role dashboards, /forbidden, RoleDashboard(), Technology, UGT_OPTIONS

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (10): CATEGORIES, levelOptions(), ProjectSummary, RegistryTab, STATUS_BADGE, STATUS_COLORS, STATUS_LABELS, TechnologiesPage() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (7): ControlPoint, CP_STATUS_COLORS, CP_STATUS_LABELS, DECIDED_STATUSES, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, ProjectDetail

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (5): 0e7389a feat(frontend): working LKs for 8 roles — real data, JoinProjectForm, expert/auditor control-point decisions, admin user management (ticket 13), ce6c270 design: тёмная тема 2.0 — дизайн-система платформы (токены, glass, свечения, УГТ-шкала, роллаут в ЛК), JOIN_ROLES, JoinResponse, Technology

### Community 14 - "Community 14"
Cohesion: 0.20
Nodes (8): AssessUgTCard(), containerVariants, easeOut, itemVariants, ProjectSummary, statCards, Stats, STATUS_LABELS

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (9): AVAILABLE_TASKS, COMPETENCE_AREAS, containerVariants, DOCUMENT_TEMPLATES, easeOut, itemVariants, Project, STATUS_COLORS (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (1): AdminUser

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (2): 366dc36 feat: apply process-first platform shell, Status

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (3): Project, STATUS_COLORS, STATUS_LABELS

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (2): 99046bf fix(audit): контракты и тема — investor/serial_manufacturer → projects/registry?ugt_min=7 (RegistryProjectOut, бюджет), маршрут роли ugt_expert→regulating_organization, единый API_URL fallback 127.0.0.1:8000, JoinedProject

### Community 20 - "Community 20"
Cohesion: 0.50
Nodes (2): 5d24097 design: дизайн-система v1 + дизайн-слой тикетов 26–30 (демо-маршрут №18), navigation

## Knowledge Gaps
- **144 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `metadata`, `POINTS` (+139 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 16`** (1 nodes): `AdminUser`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `366dc36 feat: apply process-first platform shell`, `Status`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `99046bf fix(audit): контракты и тема — investor/serial_manufacturer → projects/registry?ugt_min=7 (RegistryProjectOut, бюджет), маршрут роли ugt_expert→regulating_organization, единый API_URL fallback 127.0.0.1:8000`, `JoinedProject`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `5d24097 design: дизайн-система v1 + дизайн-слой тикетов 26–30 (демо-маршрут №18)`, `navigation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UGT_LEVELS` connect `Community 0` to `Community 4`, `Community 7`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `AssessUgTCard()` connect `Community 14` to `Community 12`, `Community 16`, `Community 10`, `Community 15`, `Community 19`, `Community 18`, `Community 13`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _144 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.055152394775036286 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11746031746031746 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._