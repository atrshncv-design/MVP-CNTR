# Graph Report - .  (2026-07-22)

## Corpus Check
- Corpus is ~2,821 words - fits in a single context window. You may not need a graph.

## Summary
- 15 nodes · 13 edges · 4 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output
- Edge kinds: implements: 10 · conceptually_related_to: 2 · references: 1


## Input Scope
- Requested: tracked
- Resolved: tracked (source: cli)
- Included files: 4 · Candidates: 346
- Excluded: 11 untracked · 1 ignored · 0 sensitive · 341 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `b462f39`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `Платформа Технозрелость` - 6 edges
2. `Frontend Next.js App Router` - 3 edges
3. `Loop Engineering` - 2 edges
4. `Ralph Loop` - 2 edges
5. `Изолированные git worktrees` - 2 edges
6. `Backend FastAPI` - 2 edges
7. `ГОСТ Р 58048-2017` - 1 edges
8. `Атомарная память` - 1 edges
9. `PostgreSQL и pgvector` - 1 edges
10. `RBAC девяти ролей` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Платформа Технозрелость` --implements--> `Backend FastAPI`  [EXTRACTED]
  PRD.md → CLAUDE.md
- `Loop Engineering` --implements--> `Изолированные git worktrees`  [INFERRED]
  PRD.md → CLAUDE.md
- `Платформа Технозрелость` --implements--> `Frontend Next.js App Router`  [EXTRACTED]
  PRD.md → CLAUDE.md
- `Платформа Технозрелость` --implements--> `PostgreSQL и pgvector`  [EXTRACTED]
  PRD.md → CLAUDE.md
- `Ralph Loop` --implements--> `Атомарная память`  [EXTRACTED]
  PRD.md → CLAUDE.md

## Hyperedges (group relationships)
- **Трёхуровневая архитектура платформы** — frontend_nextjs, backend_fastapi, postgres_pgvector [EXTRACTED 1.00]
- **Автономный цикл поставки** — loop_engineering, ralph_loop, atomic_memory, isolated_git_worktrees, push_contract [EXTRACTED 0.95]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.40
Nodes (5): Атомарная память, Изолированные git worktrees, Loop Engineering, Обязательный push-контракт, Ralph Loop

### Community 1 - "Community 1"
Cohesion: 0.40
Nodes (5): ГОСТ Р 58048-2017, Платформа Технозрелость, PostgreSQL и pgvector, RAG и генерация документов, RBAC девяти ролей

### Community 2 - "Community 2"
Cohesion: 0.67
Nodes (3): Frontend Next.js App Router, MVP 0 frontend source, NextAuth.js authentication

### Community 3 - "Community 3"
Cohesion: 1.00
Nodes (2): Backend FastAPI, ORM SQL safety

## Knowledge Gaps
- **9 isolated node(s):** `ГОСТ Р 58048-2017`, `Атомарная память`, `PostgreSQL и pgvector`, `RBAC девяти ролей`, `NextAuth.js authentication` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 3`** (2 nodes): `Backend FastAPI`, `ORM SQL safety`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Платформа Технозрелость` connect `Community 1` to `Community 3`, `Community 2`?**
  _High betweenness centrality (0.352) - this node is a cross-community bridge._
- **Why does `Frontend Next.js App Router` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.165) - this node is a cross-community bridge._
- **Why does `Backend FastAPI` connect `Community 3` to `Community 1`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `ГОСТ Р 58048-2017`, `Атомарная память`, `PostgreSQL и pgvector` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._