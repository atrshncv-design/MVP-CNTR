# Graph Report - .  (2026-07-22)

## Corpus Check
- Corpus is ~8,580 words - fits in a single context window. You may not need a graph.

## Summary
- 168 nodes · 212 edges · 21 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 117 · inherits: 35 · calls: 23 · references: 14 · imports_from: 11 · rationale_for: 8 · method: 3 · uses: 1


## Input Scope
- Requested: all
- Resolved: all (source: cli)
- Included files: 42 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed

## Graph Freshness
- Built from Git commit: `298b24f`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `Base` - 12 edges
2. `public.projects` - 7 edges
3. `get_project_detail()` - 6 edges
4. `Settings` - 6 edges
5. `public.users` - 6 edges
6. `_user_out()` - 4 edges
7. `check_databases()` - 3 edges
8. `_qr_out()` - 3 edges
9. `embed_text()` - 3 edges
10. `RagDocument` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Seed RAG templates into the database.  Usage:     uv run python app/db/seed_temp` --uses--> `RagDocument`  [INFERRED]
  app/db/seed_templates.py → app/db/models.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (24): AuditTrailEntryOut, ChatIn, ChatMessage, ChatOut, ControlPointOut, ExecutorOut, GeneratedDocumentOut, LoginIn (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (13): AuditTrailEntry, Base, ControlPoint, Permission, Project, ProjectDocument, ProjectMember, QuestionnaireResult (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.61
Nodes (7): public.audit_trail, public.control_points, public.project_documents, public.project_members, public.projects, public.questionnaire_results, public.users

### Community 4 - "Community 4"
Cohesion: 0.46
Nodes (7): _at_out(), _cp_out(), _doc_out(), get_project_detail(), _mem_out(), _qr_out(), save_questionnaire()

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (3): BaseSettings, get_settings(), Settings

### Community 6 - "Community 6"
Cohesion: 0.60
Nodes (5): public.permissions, public.role_permissions, public.roles, public.user_roles, public.users

### Community 8 - "Community 8"
Cohesion: 0.70
Nodes (4): login(), me(), register(), _user_out()

### Community 9 - "Community 9"
Cohesion: 0.60
Nodes (3): check_databases(), _check_engine(), ready()

### Community 10 - "Community 10"
Cohesion: 0.50
Nodes (3): init schemas + pgvector  Revision ID: 0001 Revises: Create Date: 2026-07-21 12:0, _sql(), upgrade()

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (3): rag_documents table (pgvector, Hash/B-Tree indexes)  Revision ID: 0002 Revises:, _sql(), upgrade()

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (3): rbac: roles, users, user_roles, permissions, role_permissions  Revision ID: 0003, _sql(), upgrade()

### Community 13 - "Community 13"
Cohesion: 0.50
Nodes (3): projects, questionnaire_results, project_members, control_points, project_docume, _sql(), upgrade()

### Community 14 - "Community 14"
Cohesion: 0.50
Nodes (3): rag_metadata: add template_metadata JSONB to rag_documents  Revision ID: 0005 Re, _sql(), upgrade()

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (1): Alembic environment for the Technozrelost backend.  Миграции используют **синхро

### Community 16 - "Community 16"
Cohesion: 0.83
Nodes (3): embed_text(), embed_texts(), tokenize()

### Community 17 - "Community 17"
Cohesion: 0.83
Nodes (3): ask_gigachat(), build_rag_context(), process_chat()

### Community 21 - "Community 21"
Cohesion: 1.00
Nodes (2): generate_document(), _resolve_variable()

### Community 22 - "Community 22"
Cohesion: 1.00
Nodes (2): get_executors(), list_executors()

### Community 23 - "Community 23"
Cohesion: 1.00
Nodes (1): Technozrelost backend package.

### Community 25 - "Community 25"
Cohesion: 1.00
Nodes (1): public.db_migration_log

### Community 26 - "Community 26"
Cohesion: 1.00
Nodes (1): public.rag_documents

## Knowledge Gaps
- **9 isolated node(s):** `Alembic environment for the Technozrelost backend.  Миграции используют **синхро`, `init schemas + pgvector  Revision ID: 0001 Revises: Create Date: 2026-07-21 12:0`, `rag_documents table (pgvector, Hash/B-Tree indexes)  Revision ID: 0002 Revises:`, `rbac: roles, users, user_roles, permissions, role_permissions  Revision ID: 0003`, `projects, questionnaire_results, project_members, control_points, project_docume` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (1 nodes): `Alembic environment for the Technozrelost backend.  Миграции используют **синхро`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `generate_document()`, `_resolve_variable()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `get_executors()`, `list_executors()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `Technozrelost backend package.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `public.db_migration_log`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `public.rag_documents`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Alembic environment for the Technozrelost backend.  Миграции используют **синхро`, `init schemas + pgvector  Revision ID: 0001 Revises: Create Date: 2026-07-21 12:0`, `rag_documents table (pgvector, Hash/B-Tree indexes)  Revision ID: 0002 Revises:` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11182795698924732 - nodes in this community are weakly interconnected._