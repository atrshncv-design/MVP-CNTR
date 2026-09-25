# T08 — AI malformed 200 response validation

- Executor: OpenCode `opencode/space-bunny-free`, variant `max`; no executor commit/push. One initial session stopped before implementation; a fresh session completed T08. Craft review asked to consolidate repeated mock-client setup; test-only helper was added and re-reviewed PASS.
- RED/GREEN: synthetic malformed HTTP 200 responses initially failed; after the fix, malformed/non-JSON/empty responses return `None` and increment `malformed_total` plus aggregate `errors_total`. Non-200 and timeout counters remain distinct. Logs contain only response category/type and model metadata; no raw payload, prompt, key, document, or user text.
- API contract remains `ask_llm() -> str | None`; AI metrics snapshot adds monotonic `malformed_total`.
- Reviews: Manifest+Spec PASS; Craft/security PASS after test helper cleanup.
- Independent checks after final test refactor: `uv run pytest tests/test_ai_wiring.py -q` → 30 passed, 1 pre-existing deprecation warning; Ruff on four changed files → PASS; compatible Python 3.11 mypy → 62 files, no issues. Executor reports AI/chat suite 93 passed, full Ruff and mypy PASS.
- Full regression: independent `uv run pytest -q` → 744 passed, 1 pre-existing warning in 497.81s.
- No live-provider calls. Live assistant evaluation remains BLOCKED until owner supplies the replacement key. Production untouched.
