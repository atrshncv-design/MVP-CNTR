# EV-005 — CI/CD, deploy events, образы

- Дата: UTC 2026-09-21T13:28Z
- Targets: локально `.github/workflows/ci.yml`; сервер `~/deploy.log`,
  `~/seed.log`, `~/load.log`, `~/load.json` (только metadata: имена,
  размеры, даты, число строк — содержимое не копировалось)
- Команды: `grep -E "name:|run:|jobs:" .github/workflows/ci.yml`;
  сервер: `ls -la --time-style=long-iso ~/deploy.log ~/seed.log
  ~/load.log ~/load.json; wc -l ~/deploy.log`
- Exit: 0

## CI (имена джоб и шагов, без секретов)

- Workflow `CI`, джобы: `backend`, `frontend` (триггер `push`, `contents: read`)
- Backend-шаги (именами): Checkout, Set up Python (3.11), Set up uv,
  Install (`uv sync --locked --extra dev`), Dependency audit (pip-audit),
  Ruff (`ruff check app tests infra/alerter scripts/udgu_ingest`), Mypy
  (`mypy app`), Pytest (`pytest -q infra/alerter/test_alerter.py tests`),
  Backend image build (`docker build -f Dockerfile -t backend:ci`),
  Prod client libs, Readiness smoke
  (`pytest -q tests/test_health.py tests/test_redis_obligatory.py
  tests/test_scan_failclosed.py`)
- Frontend-шаги (именами): Checkout, Set up Node.js, Install (`npm ci`),
  Dependency audit (`npm audit --audit-level=high`), Lint (`npm run lint`),
  Tests (`npm test`), Production build (`npm run build`)
- Сервисы CI: `redis:7-alpine`, `pgvector/pgvector:0.8.0-pg16`
  (совпадают с prod-образами — EV-003)

## Deploy events (metadata)

| Файл | Размер | Дата | Примечание |
|------|--------|------|------------|
| `~/deploy.log` | 10544 B, 266 строк | 2026-09-17 13:20 | последний deploy за 4 дня до аудита |
| `~/seed.log` | 3177 B | 2026-09-16 15:44 | факт сидирования, содержимое не читалось |
| `~/load.json` / `~/load.log` | 835 B / 226 B | 2026-09-17 06:53 | факт замеров, содержимое не читалось |
| `~/gost.tar` | 63451136 B | 2026-09-16 15:40 | факт корпуса ГОСТов (имя+размер) |
| `~/corpus/` | каталог | 2026-09-16 15:40 | факт корпуса (имена файлов не перечислялись) |

## Образы = deploy-факт

- Запущенные образы приложения `f06b15cb76ef` (EV-003) совпадают с server
  HEAD `f06b15c` (EV-002): deployed-версия доказана тройным совпадением
  (git SHA = image tag = running container).

## Связь со spec

- R06/R24 (CI/CD, deploy events): закрыты на уровне metadata; rollback-оценка —
  operations-отчёт (прошлые теги образов — EV-003).
- Ссылки: `01-environments.md` (CI/CD, Deploy events).
