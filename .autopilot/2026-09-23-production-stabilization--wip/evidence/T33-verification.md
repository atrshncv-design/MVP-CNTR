# T33 — synthetic deploy test env isolation

- Код `6aff356`: одна строка в `technozrelost-backend/tests/test_infra_contracts.py`; отправлен в `origin/autopilot/production-stabilization`.
- Исполнитель: отдельная OpenCode-сессия `opencode/space-bunny-free`, вариант `max`; пробный вызов до таска ответил `OK`. Исполнитель не коммитил и не касался production.
- RED до исправления зафиксирован в `CI-backend-pytest-2026-09-24.md`: CI inherited `POSTGRES_PASSWORD=change_me` отвергался действующим production guard. Исполнитель сообщил о локальном воспроизведении RED; оркестратор после правки независимо подтвердил GREEN.
- Независимый positive-case: с синтетическим `POSTGRES_PASSWORD=change_me` — 1 passed; без переменной — 1 passed. Полный `tests/test_infra_contracts.py` с синтетическим CI-default — 70 passed; негативные weak-secret тесты включены.
- Полный локальный backend regression с test Redis и синтетическим CI-default: `uv run --python 3.11 pytest -q infra/alerter/test_alerter.py tests --tb=line` — 751 passed, 2 dependency warnings, 456.74 s. Отдельная test DB; production не затронут.
- Ruff по `app tests infra/alerter scripts/udgu_ingest` — exit 0. Mypy `app` — exit 0, 62 files. `git diff --check` — exit 0.
- Manifest+Spec review: PASS, blocking нет. Craft review: clean, blocking нет. Diff ограничен разрешённым тестовым файлом; `deploy.sh`, guard, CI env и реальные `.env` не менялись.
- Граница доказательства: macOS regression не подтверждает Linux CI; D11/T34 ещё открыт. Backend CI нужно оценить после T34.
