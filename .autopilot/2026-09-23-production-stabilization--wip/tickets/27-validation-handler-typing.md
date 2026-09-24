# 27 — Типизация обработчика RequestValidationError

**Требование:** D04. **Зона:** `technozrelost-backend/app/main.py`, связанные узкие тесты. **После:** T04 diagnosis.

RED: `uv run mypy --python-version 3.12 app` → `app/main.py:311: Argument 2 to add_exception_handler ... incompatible type [arg-type]` (`evidence/T04-verification.md`).

Проверь фактический контракт FastAPI/Starlette для error handler и все регистрации. Минимально согласуй сигнатуру с типами без `Any`/широкого `type: ignore` и без изменения JSON error response. Добавь/обнови узкий regression test, затем Ruff, диагностический mypy и релевантные pytest. Канонический Python 3.11 gate остаётся отдельной проверкой T04. Не трогай `.autopilot`, production, секреты, не коммить.
