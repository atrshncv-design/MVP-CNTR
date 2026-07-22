# Reproducible development environment

This ledger contains reproducible equivalents of the commands used during the
2026-07-22 recovery. Global agent tools are development dependencies, not
application runtime dependencies.

## Agent harness

```bash
python3 /Users/aleksandrtrisenkov/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo affaan-m/ECC --path skills/autonomous-loops skills/backend-patterns skills/coding-standards skills/continuous-learning-v2 skills/fastapi-patterns skills/frontend-patterns skills/nextjs-turbopack skills/postgres-patterns skills/security-review skills/strategic-compact skills/tdd-workflow skills/verification-loop
python3 /Users/aleksandrtrisenkov/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo vercel-labs/agent-browser --path skills/agent-browser
python3 /Users/aleksandrtrisenkov/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo DietrichGebert/ponytail --path skills/ponytail skills/ponytail-review skills/ponytail-audit skills/ponytail-debt skills/ponytail-gain skills/ponytail-help
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
npm install --global agent-browser @google/design.md @animaapp/anima-sdk
uv tool install 'headroom-ai[all]'
uv tool install cli-anything-hub
git clone --depth 1 https://github.com/alchaincyf/huashu-design.git /tmp/huashu-design
npm install --prefix /tmp/huashu-design
cp -R /tmp/huashu-design /Users/aleksandrtrisenkov/.codex/skills/huashu-design
test -f /Users/aleksandrtrisenkov/.codex/skills/huashu-design/SKILL.md
git clone --depth 1 https://github.com/HKUDS/CLI-Anything.git /tmp/cli-anything
bash /tmp/cli-anything/codex-skill/scripts/install.sh
git clone --depth 1 https://github.com/ai-forever/harness-bench-fast.git /tmp/harness-bench-fast
uv sync --directory /tmp/harness-bench-fast
headroom init -g codex
headroom proxy
graphify codex install --project
```

Huashu Design and CLI-Anything skills were installed from their official
repository release archives/installers after reading their `SKILL.md` files.
Harness Bench Fast remains isolated from the product checkout.

Restart Codex once after installing skills/plugins and changing Headroom
routing. Never place Anima, Figma, GigaChat, or database credentials in this
file or in version control.

## Verification gates

```bash
design.md lint DESIGN.md
headroom doctor
headroom audit-reads --codex --format json
graphify portable-check .graphify
agent-browser open http://localhost:3001/login
agent-browser snapshot -i
```

Frontend:

```bash
cd /private/tmp/mvp-cntr-recovery-frontend
npm run lint
NEXT_PUBLIC_API_URL=http://localhost:8001 npm run build
AUTH_TRUST_HOST=true AUTH_SECRET=local-development-only-change-me-32chars NEXTAUTH_URL=http://localhost:3001 NEXT_PUBLIC_API_URL=http://localhost:8001 npm run start -- -p 3001
```

Backend:

```bash
cd /private/tmp/mvp-cntr-recovery-backend
uv run ruff check .
uv run pytest -q
CORS_ORIGINS=http://localhost:3001 POSTGRES_REPLICA_HOST=127.0.0.1 uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Live probes:

```bash
curl -sS -i http://localhost:3001/api/auth/session
curl -sS -i http://localhost:8001/api/v1/health
```

The `/ready` endpoint executes `SELECT 1` against Primary and the configured
Replica and fails closed with HTTP 503 if either configured database is down.
