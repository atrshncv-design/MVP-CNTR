# T32 — readiness Redis test isolation

- Код: `ed4586e`, только `technozrelost-backend/tests/test_health.py`, 8 добавленных строк. Ветка `autopilot/production-stabilization`; commit отправлен в `origin`.
- До изменения один readiness-тест воспроизводимо падал при локальном `REDIS_URL=redis://127.0.0.1:6381/0`: ожидал `redis=not_configured`, получал `ok`.
- После изменения: `pytest -q tests/test_health.py` с указанным test Redis — 4 passed; с `REDIS_URL=` — 4 passed.
- Независимый полный локальный прогон с test Redis: `uv run --python 3.11 pytest -q infra/alerter/test_alerter.py tests --tb=line` — 751 passed, 2 dependency warnings, 704.23 s. Использованы изолированная test DB и временный Redis; production не затронут.
- Ruff: `ruff check app tests infra/alerter scripts/udgu_ingest` — exit 0. Mypy: `mypy app` — exit 0, 62 files. `git diff --check` — exit 0.
- Manifest+Spec review: PASS, блокирующих замечаний нет. Craft review: PASS с неблокирующим замечанием о дублировании маленькой тестовой заглушки.
- Граница доказательства: macOS-проход T32 не закрывает Linux CI failures D10/D11; GitHub backend job нужно повторно оценить после T33/T34.
