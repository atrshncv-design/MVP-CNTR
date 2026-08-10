# Технозрелость — монорепо (MVP платформы ЦНТР УР, ГОСТ Р 58048-2017)

Каноническая структура репозитория зафиксирована в [`docs/canonical-layout.md`](docs/canonical-layout.md).

## Канонические приложения

| Приложение | Путь | Ветка | Стек |
|---|---|---|---|
| Frontend | `technozrelost-frontend/` | `codex/recovery-frontend` | Next.js (App Router), next-auth |
| Backend | `technozrelost-backend/` | `release/friday-rc` | FastAPI, SQLAlchemy 2.0 async, Alembic, pgvector, uv |

> Единственные источники кода. Legacy-архив «КОД MVP "0" 210726 - ТОЛЬКО ФРОНТЭНД» и прочие конкурирующие деревья для разработки не используются.

## Setup / test / build

### Frontend (`technozrelost-frontend/`)

```bash
cd technozrelost-frontend
npm ci                     # установка зависимостей по lock-файлу
```

> Файл `.env.local` для сборки, линта, typecheck и тестов **не требуется** — подтверждено clean-clone gate (тикет 04): `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm test` работают без окружения. Шаблон `.env.local.example` в репозитории отсутствует и не поставляется. Если нужно локальное окружение (например, `NEXT_PUBLIC_API_URL` для URL API из браузера, `NEXTAUTH_SECRET` для сборки с auth) — создайте `.env.local` вручную; значения не должны попадать в git (`.env.local` игнорируется корневым `.gitignore`).

- Dev-сервер: `npm run dev`
- Сборка: `npm run build` → прод-режим: `npm start`
- Линт: `npm run lint`
- Тесты: `npm test` (`node --test tests/*.test.mjs`)
- Typecheck: `npx tsc --noEmit` (отдельного npm-скрипта нет; tsc запускается вручную)

> Известный пифолл: `npm run build` при живом dev-сервере ломает NextAuth-роуты — останавливайте dev перед build и перезапускайте после `rm -rf .next`.

### Backend (`technozrelost-backend/`)

```bash
cd technozrelost-backend
uv sync --all-extras                 # установка зависимостей
cp .env.example .env                 # окружение (шаблон остаётся в git)
docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica   # БД
uv run alembic upgrade head          # миграции
```

- Dev-сервер: `uv run uvicorn app.main:app --reload --port 8000`
- Тесты: `uv run pytest`
- Линт: `uv run ruff`

### Инфраструктура (`technozrelost-backend/infra/`)

Production-развёртывание и резервное копирование — `infra/deploy.sh`, `infra/backup.sh`, `infra/restore.sh`, `infra/docker-compose.prod.yml` (подробнее — `infra/README-DEPLOY.md`).

## Документация и процесс

- Мастер-спека и пакетные спеки: `.scratch/`
- Трекер тикетов: `.scratch/<feature>/issues/` (см. `docs/agents/issue-tracker.md`)
- Статус проекта: `Status.md`, `Plan.md`
- Канонические пути: `docs/canonical-layout.md`

## Замечания по окружению

- Локальные данные (`ГОСТЫ/`, `Данные для тестового реестра/`) не версионируются — правила в корневом `.gitignore`.
- `.env`-файлы не коммитятся; в git остаются только шаблоны `.env.example` / `.env.production.example`.
