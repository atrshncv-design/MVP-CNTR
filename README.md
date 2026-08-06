# ЦНТР «Технозрелость» — Friday Release Candidate (22/22)

Платформа оценки технологической зрелости по ГОСТ Р 58048-2017.
**Актуальный полный код** (снапшот 06.08.2026): backend + frontend + docs.

## Структура

```
technozrelost-backend/   — FastAPI + PostgreSQL (pgvector) + MinIO + ClamAV
technozrelost-frontend/  — Next.js (App Router) + NextAuth
docs/                    — трекеры тикетов, спека, release-отчёт (.scratch)
```

## Быстрый старт (локально)

Требуется: Docker (PostgreSQL/pgvector), Python 3.11+ (uv), Node 20+.

### Backend

```bash
cd technozrelost-backend
docker compose -f infra/docker-compose.yml up -d pg-primary minio   # БД + хранилище
cp .env.example .env                                                # при необходимости
export PYTHONPATH=.
uv sync && uv run alembic upgrade head                              # миграции (head=0023)
uv run python -m app.db.reset_demo --full                           # демо-данные + НИОКТР (опционально)
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000            # API
```

Гейты: `uv run ruff check app/ tests/ scripts/` · `uv run pytest -q` (191) · `uvx pyright` (0 errors).

### Frontend

```bash
cd technozrelost-frontend
npm ci && npm run dev                                               # http://localhost:3000
```

Гейты: `npm run lint` · `npx tsc --noEmit` · `npm test` (14) · `npm run build`.

### Демо-аккаунты (после reset_demo)

`gk_customer` / `rd_executor` / `cntr_manager` / `cntr_admin` / `investor`, пароль `DemoPass123!`.

## Развёртывание (Linux-сервер)

См. `technozrelost-backend/infra/README-DEPLOY.md` (deploy.sh) и
`technozrelost-backend/infra/README-LOADTEST.md` (нагрузка/security).

## Release gate

`docs/.scratch/friday-release-candidate/release-gate-report.md` — результаты
black-box проверки: 191/191 pytest, frontend гейты зелёные, security ALL PASS,
E2E УГТ 1→9, pyright 0.
