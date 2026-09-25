# T11 — CODE-02 atomic AI metrics

## Result

AI metric increments now pass through `ai_metrics.increment(metric, amount=1)` under one process-local lock; `snapshot()` copies the counters under the same lock. All app writes use that API. Existing names, numeric values, in-memory lifetime, rate policy, and API behavior are unchanged.

The committed regression test runs 5,000 increments across eight threads and asserts an exact snapshot delta. The test was RED before the implementation and GREEN afterward.

## Independent validation

- `uv run pytest tests/test_ai_wiring.py tests/test_ai_assistant.py tests/test_ai_relevance.py -q` → 46 passed, 1 pre-existing Starlette/httpx deprecation warning.
- `uv run ruff check app tests infra/alerter scripts/udgu_ingest` → all checks passed.
- `/private/tmp/t04-backend-venv/bin/mypy app` (Python 3.11.15) → 62 source files, no issues.
- `uv run pytest -q` after the T10 repair and with T11 changes → 748 passed, 1 pre-existing Starlette/httpx deprecation warning in 474.66s.
- `git diff --check` passed; direct counter mutation search found only the centralized assignment in `ai_metrics.increment()`.
- Independent Manifest/Spec and Craft reviews → clean; no blocking findings.

The OpenCode session stopped before returning its final contract; the orchestrator independently reviewed the diff and reran the required gates. No live AI provider, production system, or credentials were used.
