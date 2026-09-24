# T27 — validation exception handler typing

Дата: 2026-09-24. Code commit `9f7791a`, отправлен в `origin/autopilot/production-stabilization`.

- RED до T27: совместимый Python 3.11 `mypy app` → одна ошибка `app/main.py:311 [arg-type]`, 62 файла проанализированы (`T26-verification.md`).
- Минимальный diff: `validation_exception_handler` принимает `Exception` по типизированному контракту Starlette и сужает до `RequestValidationError` через `isinstance` до `.errors()`. Регистрация, локализация и JSON 422 не менялись.
- Независимые проверки: `mypy app` → exit 0, 62 файла без ошибок; полный Ruff → exit 0; `pytest tests/test_api_error_locale.py -q` → 8 passed; полный `pytest -q` → **720 passed, 2 dependency warnings**, 663.07s (Python 3.11, локальная test DB). `git diff --check` чисто.
- Независимое read-only review: PASS, блокирующих замечаний нет; Starlette/FastAPI contract и fallback 500 подтверждены.
- Production, lock, CI, ключи и публичные API не менялись. Два warnings: Starlette TestClient/httpx и passlib `crypt` deprecation.
