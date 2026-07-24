# Graph Report - .  (2026-07-24)

## Corpus Check
- Corpus is ~13,769 words - fits in a single context window. You may not need a graph.

## Summary
- 212 nodes · 367 edges · 18 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 120 · ON_BRANCH: 66 · MODIFIES: 49 · inherits: 35 · PARENT_OF: 34 · calls: 26 · references: 14 · imports_from: 11 · rationale_for: 8 · method: 3 · uses: 1


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 44 · Candidates: 67
- Excluded: 3 untracked · 5199 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `4803fb6`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `Base` - 12 edges
2. `get_project_detail()` - 7 edges
3. `public.projects` - 7 edges
4. `Settings` - 6 edges
5. `public.users` - 6 edges
6. `_user_out()` - 4 edges
7. `check_databases()` - 3 edges
8. `list_projects()` - 3 edges
9. `_project_out()` - 3 edges
10. `_qr_out()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Seed RAG templates into the database.  Usage:     uv run python app/db/seed_temp` --uses--> `RagDocument`  [INFERRED]
  app/db/seed_templates.py → app/db/models.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (14): Technozrelost backend package., codex/recovery-backend, feat/backend, 083f89d docs: import MVP-0 frontend source and project context, 298b24f feat(phase4): executors/technologies registries + AI assistant chat, 3484a24 feat(rag): RAG pipeline + document generator, 7887d0b feat(backend): scaffold FastAPI app (uv, SQLAlchemy async, pgvector, alembic, ruff/mypy), 85a2dca chore(backend): isolate worktree from docs baseline (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (24): AuditTrailEntryOut, ChatIn, ChatMessage, ChatOut, ControlPointOut, ExecutorOut, GeneratedDocumentOut, LoginIn (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (11): Alembic environment for the Technozrelost backend.  Миграции используют **синхро, 4803fb6 fix: harden backend readiness and AI transport, ask_gigachat(), build_rag_context(), process_chat(), check_databases(), _check_engine(), ready() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (18): codex/recovery-docs, main, 00f9718 docs: update Plan.md (Phase 2 done) and Status.md (Phase 2 report), 07a0b33 docs: record approved intake and identity decisions, 0859641 docs: record stage 1 UI shell evidence, 088b40c docs: update Plan.md + Status.md — Phase 2 complete, 347b083 docs: define fixed MVP intake workflow, 542daf1 docs: mark Plan 1.1/1.2 done; update Status with Phase-1 progress (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (13): AuditTrailEntry, Base, ControlPoint, Permission, Project, ProjectDocument, ProjectMember, QuestionnaireResult (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.44
Nodes (11): codex/recovery-frontend, feat/frontend, 34f958e chore: establish frontend recovery harness, 366dc36 feat: apply process-first platform shell, 4bf9277 chore(frontend): isolate worktree from docs baseline, 7576f9f feat(auth): NextAuth.js v5 Credentials + JWT; middleware RBAC; /login,/register, 9 role dashboards, /forbidden, a574f11 feat(frontend): Step 2.3 — R&D Исполнитель dashboard, de672d4 feat(frontend): Phase 2 — port UGT scale, questionnaire wizard, GK dashboard (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.35
Nodes (10): _at_out(), _cp_out(), _doc_out(), get_project_detail(), list_projects(), _mem_out(), project_list_stmt(), _project_out() (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.61
Nodes (7): public.audit_trail, public.control_points, public.project_documents, public.project_members, public.projects, public.questionnaire_results, public.users

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (3): BaseSettings, get_settings(), Settings

### Community 9 - "Community 9"
Cohesion: 0.60
Nodes (5): public.permissions, public.role_permissions, public.roles, public.user_roles, public.users

### Community 11 - "Community 11"
Cohesion: 0.70
Nodes (4): login(), me(), register(), _user_out()

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (3): init schemas + pgvector  Revision ID: 0001 Revises: Create Date: 2026-07-21 12:0, _sql(), upgrade()

### Community 13 - "Community 13"
Cohesion: 0.50
Nodes (3): rag_documents table (pgvector, Hash/B-Tree indexes)  Revision ID: 0002 Revises:, _sql(), upgrade()

### Community 14 - "Community 14"
Cohesion: 0.50
Nodes (3): rbac: roles, users, user_roles, permissions, role_permissions  Revision ID: 0003, _sql(), upgrade()

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): rag_metadata: add template_metadata JSONB to rag_documents  Revision ID: 0005 Re, _sql(), upgrade()

### Community 16 - "Community 16"
Cohesion: 0.83
Nodes (3): embed_text(), embed_texts(), tokenize()

### Community 19 - "Community 19"
Cohesion: 1.00
Nodes (2): generate_document(), _resolve_variable()

### Community 20 - "Community 20"
Cohesion: 1.00
Nodes (2): get_executors(), list_executors()

## Knowledge Gaps
- **9 isolated node(s):** `Alembic environment for the Technozrelost backend.  Миграции используют **синхро`, `init schemas + pgvector  Revision ID: 0001 Revises: Create Date: 2026-07-21 12:0`, `rag_documents table (pgvector, Hash/B-Tree indexes)  Revision ID: 0002 Revises:`, `rbac: roles, users, user_roles, permissions, role_permissions  Revision ID: 0003`, `projects, questionnaire_results, project_members, control_points, project_docume` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 19`** (2 nodes): `generate_document()`, `_resolve_variable()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `get_executors()`, `list_executors()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Settings` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `Alembic environment for the Technozrelost backend.  Миграции используют **синхро`, `init schemas + pgvector  Revision ID: 0001 Revises: Create Date: 2026-07-21 12:0`, `rag_documents table (pgvector, Hash/B-Tree indexes)  Revision ID: 0002 Revises:` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11182795698924732 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.10144927536231885 - nodes in this community are weakly interconnected._