# 03 — Local gates (все пять; ошибки не скрыты)

Дата прогона: 2026-09-21 (UTC), worktree `production-technical-audit`,
HEAD `f364388`. Вывод усечён по правилу исполнителя (`| tail -30`).

| # | Gate | Команда | Итог | Причина |
|---|------|---------|------|---------|
| 1 | Backend lint | `cd technozrelost-backend && uv run ruff check app tests infra/alerter scripts/udgu_ingest` | PASS | `All checks passed!` |
| 2 | Backend types | `cd technozrelost-backend && uv run mypy app` | BLOCKED | `numpy/__init__.pyi:737: Type statement is only supported in Python 3.12 and greater [syntax]; Found 1 error in 1 file (errors prevented further checking)` — падает тулчейн/стабы до анализа `app/` (локальный venv Python 3.14 vs пины CI Python 3.11); код продукта этим прогоном не оценён |
| 3 | Backend tests | `cd technozrelost-backend && uv run pytest -q` | BLOCKED | Каноничный baseline: `31 passed, 720 setup errors` — все 720 ошибок setup/fixture (`psycopg.OperationalError`, session autouse-фикстура `tests/conftest.py:58` требует живую тестовую БД; включая `tests/test_ci_gates.py`, 5 errors за 0.06с). Продуктовых падений ноль; локальный повтор 2026-09-21 в этой среде воспроизвёл те же 720 setup-ошибок того же класса (тестовая БД недоступна) |
| 4 | Frontend tests | `cd technozrelost-frontend && npm test` | BLOCKED | Наблюдаемое: `171 passed / 38 import errors / total 209` — все 38 ошибок импорта (`ERR_MODULE_NOT_FOUND: Cannot find package 'next-intl'` из `src/lib/translators.ts`, `node_modules` отсутствует). Продуктовой регрессии не доказано; молча ставить зависимость запрещено (`npm ci` — только решением оркестратора, не этого тикета) |
| 5 | Frontend build | `cd technozrelost-frontend && npm run build` | BLOCKED | `sh: next: command not found` — зависимости не установлены; сборка не началась |

Вывод для gate-решения: единственный зелёный шов — Ruff. Mypy и backend-тесты
требуют каноничного окружения (CI Python 3.11 + тестовая БД); фронт-гейты
(BLOCKED по окружению, не FAIL продукта) требуют `npm ci` решением
оркестратора. Повтор — после подготовки окружения, без изменения кода.
Ролевой runtime и production-поведение — `UNKNOWN` (R36).
