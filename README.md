# Backend

FastAPI-сервис для цифровой платформы «Технозрелость» (MVP v2).

## Стек
- Python ≥ 3.11, FastAPI, Uvicorn
- SQLAlchemy 2.0 (async) + asyncpg
- Alembic (миграции)
- pgvector (векторное хранилище RAG)
- Pydantic v2 / pydantic-settings

## Быстрый старт

```bash
uv sync --all-extras          # установить зависимости
cp .env.example .env          # сконфигурировать окружение
docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica  # поднять БД
uv run alembic upgrade head   # применить миграции
uv run uvicorn app.main:app --reload --port 8000
```

## Структура
- `app/` — исходный код сервиса
  - `main.py` — точка входа FastAPI
  - `core/` — конфигурация, БД-сессии, логирование
  - `api/v1/` — HTTP-маршруты
- `db/migrations/` — SQL-миграции (схемы, pgvector, индексы)
- `alembic/` — Alembic-окружение
- `infra/` — docker-compose, Nginx, скрипты

## Соглашения БД (CLAUDE.md)
- Схемы: `public` (продакшн), `test` (тестирование гипотез)
- ID: `Serial` / `BigSerial`
- Hash Index — точный поиск (email, ID)
- B-Tree Index — диапазонные запросы (даты, уровни УГТ)
- ORM (SQLAlchemy) обязательно; сырой SQL — только в миграциях