# 26 — Типизация Redis from_url в realtime

**Требование:** D03. **Зона:** `technozrelost-backend/app/api/v1/realtime.py`, связанные узкие тесты. **После:** T04 diagnosis.

RED: `uv run mypy --python-version 3.12 app` → `app/api/v1/realtime.py:109: Call to untyped function "from_url" in typed context [no-untyped-call]`; 62 файла проанализированы (`evidence/T04-verification.md`).

Проверь точный runtime-contract Redis клиента и всех вызывающих мест. Минимально сделай вызов типобезопасным без глобального отключения strict и без подавления `no-untyped-call` для всего модуля. Сохрани runtime-поведение и failure mode. Фокусный тест + Ruff + диагностический mypy; полный канонический Python 3.11 gate повторит оркестратор после доступности зависимостей. Не трогай `.autopilot`, production, секреты, не коммить.
