# T13 verification — SEC-01 container hardening

## Scope and result

- Only ticket-zone files changed: backend/frontend Dockerfiles, dev/prod Compose manifests, one static regression test, and a future-only operations runbook.
- No public API, database schema/data, production config/secrets, dependency lock, or runtime container was changed. No container build, pull, start, restart, deploy, or migration was performed.
- Production nginx `restart: unless-stopped` is preserved. Dev ClamAV image identity is described without unsupported entrypoint claims; runtime behavior remains `UNKNOWN`.
- Runbook change plan is explicitly future-only and requires separate written approval; it includes component commands, preconditions/staging, expected impact and downtime measurement, health/stop criteria, and rollback commands.

## Independent checks

- `uv run pytest tests/test_container_hardening.py -q` → 1 passed, 1 existing Starlette/httpx deprecation warning.
- `uv run ruff check app tests infra/alerter scripts/udgu_ingest` → PASS.
- `/private/tmp/t04-backend-venv/bin/python -m mypy app` → PASS, 62 source files. Local Python 3.14 mypy remains incompatible with the installed numpy stub syntax; this is a known toolchain limitation, not a T13 regression.
- Synthetic-only `docker compose -f infra/docker-compose.yml config --quiet` → PASS.
- Synthetic-only `docker compose -f infra/docker-compose.prod.yml config --quiet` → PASS.
- `uv run pytest -q` → 753 passed, 1 existing warning, 461.16s (independent orchestrator run).
- Executor full suite after final repair → 753 passed, 1 warning, 453.37s.
- `git diff --check` → PASS; reviewed modified/untracked product paths match the ticket zone.

## Review

- Manifest/Spec review initially found the nginx restart policy removal, an unsupported dev ClamAV description, and an incomplete change plan. All three were repaired.
- Targeted Manifest/Spec re-review → clean; the three blocking conditions are closed.
- Craft re-review: no blocking finding. Non-blocking concern remains: the static exception test should assert each exception's specific reason, writable surface, and compensating isolation, not only service-name/heading presence. Carry to final triage.
- Runtime entrypoint, UID/GID, volume ownership, and live health behavior were intentionally not executed; staging evidence requires separate approval.
