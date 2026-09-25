# T07 — SEC-03 production API docs policy

- Executor: OpenCode `opencode/space-bunny-free`, variant `max`; no executor commit/push.
- RED: isolated `create_app()` with `APP_ENV=production` exposed `/docs` as 200 before the code change.
- Implementation: FastAPI docs, ReDoc and OpenAPI URLs are `None` for `production`; existing defaults stay enabled for `dev` and `test`. No API routes, middleware, nginx, compose, or deployment changed.
- Reviews: Manifest+Spec PASS; Craft/security PASS, no findings.
- Independent checks: `uv run pytest tests/test_api_docs_policy.py -q` → 2 passed, 1 pre-existing dependency warning; `uv run ruff check app/main.py tests/test_api_docs_policy.py` → PASS; `/private/tmp/t04-backend-venv/bin/python -m mypy app` → 62 source files, no issues. Executor reports affected backend tests 14 passed and same Ruff/Python 3.11 mypy results.
- Full regression: independent `uv run pytest -q` → 725 passed, 1 pre-existing Starlette/httpx deprecation warning in 485.84s. Executor's 300s-limited attempt was stopped and not counted.
- Deployed `/docs`, `/redoc`, `/openapi.json` remain **UNKNOWN**; no production request was made. Production was not changed.
