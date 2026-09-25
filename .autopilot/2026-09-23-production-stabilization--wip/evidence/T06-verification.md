# T06 — SEC-02 explicit CORS allowlist

- Executor: fresh OpenCode `opencode/space-bunny-free`, variant `max`; no executor commit/push. Initial session stopped partway after misreading a status-only message; a fresh session completed the ticket.
- RED: preflight tests confirmed wildcard methods allowed disallowed `TRACE` and wildcard headers allowed `X-Admin-Override`.
- Implementation: `CORSMiddleware` explicitly permits `GET, POST, PUT, PATCH, DELETE` and request headers `Authorization, Content-Type`. `allow_origins` and `allow_credentials=True` unchanged. Reviewer scan found no other frontend custom request headers or API route methods in scope.
- Reviews: Manifest+Spec PASS; Craft/security PASS, no findings.
- Independent checks: `uv run pytest tests/test_security_headers.py -q` → 3 passed, 1 pre-existing dependency warning; `uv run ruff check app/main.py tests/test_security_headers.py` → PASS; `/private/tmp/t04-backend-venv/bin/python -m mypy app` → 62 source files, no issues. Executor reports RED → GREEN (3 passed), relevant backend tests 7 passed, Ruff PASS, Python 3.11 mypy PASS.
- Full backend `uv run pytest -q` from executor exceeded 300 seconds. Per ticket, full backend suite remains due at wave regression; this is not represented as passed. Canonical mypy under repository Python 3.14 remains blocked by numpy stub syntax; compatible Python 3.11 mypy passes.
- Production untouched. Code commit `02f1a36`, pushed to `origin/autopilot/production-stabilization`.
