# Project authority

- Role: autonomous Maker / Lead Agent for the ЦНТР platform «Технозрелость»;
  the user is the Functional Validator and is never expected to edit code.
- Architecture: Next.js App Router frontend, FastAPI backend, PostgreSQL with
  `pgvector`, Primary/Replica separation, and Nginx in front of servers.
- Work only in isolated git worktrees. Do not modify or destabilize `main`.
- Database schemas must separate production (`public`) and hypotheses/tests
  (`test`). IDs use Serial/BigSerial sequences. Use Hash indexes for exact
  lookup and B-Tree indexes for ranges/default ordering.
- Prevent SQL injection through ORM usage (SQLAlchemy in Python; Prisma/Drizzle
  where Next.js accesses data). Authentication uses NextAuth.js.
- One task is limited to 25 Ralph iterations. Stop and ask the Functional
  Validator after repeated stalls or test failures.
- Read the next step from `Plan.md`; update `Status.md` after every successful
  step. Historical checkboxes are not proof—rerun the relevant gate.
- Every commit must be pushed to `origin` at
  `https://github.com/atrshncv-design/MVP-CNTR.git`; do not leave local commits
  unpushed.
- Never call static fallbacks, mock data, or TODO endpoints production-ready.

## graphify

This project has a graphify knowledge graph at .graphify/.

Rules:
- For codebase or architecture questions, when `.graphify/graph.json` exists, first run `graphify query "<question>"` (or `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`); these return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output
- If .graphify/wiki/index.md exists, navigate it instead of reading raw files
- In Codex, the reliable explicit skill invocation is `$graphify ...`; do not rely on `/graphify ...`
- `$graphify ...` is a Codex skill trigger, not a Bash subcommand like `graphify .`
- A successful TypeScript-backed Codex build should leave `.graphify/.graphify_runtime.json` with `runtime: typescript`
- If .graphify/graph.json is missing but graphify-out/graph.json exists, run `graphify migrate-state --dry-run` first; if tracked legacy artifacts are reported, ask before using the recommended `git mv -f graphify-out .graphify` and commit message
- If .graphify/needs_update exists or .graphify/branch.json has stale=true, warn before relying on semantic results and run the graphify skill with --update when appropriate
- If the user asks to build, update, query, path, or explain the graph, use the installed `graphify` skill instead of ad-hoc file traversal
- Before proposing or committing .graphify artifacts, run `graphify portable-check .graphify`; commit-safe graph artifacts must use repo-relative paths, and never commit .graphify/branch.json, .graphify/worktree.json, .graphify/needs_update, or .graphify/cache/. If a repo already tracks any of them, first add them to .gitignore, then propose `git rm --cached .graphify/branch.json .graphify/worktree.json .graphify/needs_update` and `git rm -r --cached .graphify/cache`; never mutate git state without asking
- Before deep graph traversal, prefer `graphify summary --graph .graphify/graph.json` for compact first-hop orientation
- For review impact on changed files, use `graphify review-delta --graph .graphify/graph.json` instead of generic traversal
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when `query` / `path` / `explain` do not surface enough context
- After modifying code files in this session, run `npx graphify hook-rebuild` to keep the graph current
