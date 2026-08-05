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

## Демо-среда (seed/reset, тикет 19)

Повторяемая демонстрационная среда создаётся одной командой:

```bash
uv run python -m app.db.reset_demo --full        # полный сброс (TRUNCATE) + seed
uv run python -m app.db.reset_demo --seed-only   # только seed поверх данных (идемпотентно)
```

`--full` очищает все таблицы приложения (кроме справочников ролей/прав и
служебных таблиц миграций) и заново создаёт:

- **демо-аккаунты ролей** (общий пароль `DemoPass123!` — синтетический, dev-only):
  `demo.gk@example.com` (gk_customer), `demo.rd@example.com` (rd_executor),
  `demo.manager@example.com` (cntr_manager), `demo.admin@example.com` (cntr_admin),
  `demo.investor@example.com` (investor);
- **9 опубликованных проектов с УГТ 1–9** — для проверки реестров и фильтров;
- **один проект для последовательного пути 1→9** (`current_level=1`, `target_level=9`);
- **импорт НИОКТР** из `data/nioktr_all.json` (16 582 карточки, идемпотентно).

Повторный запуск `--seed-only` идемпотентен: пользователи дедуплицируются по
email, проекты — по названию, НИОКТР — по registration_number; счётчики не
растут, дубликатов не создаётся (покрыто тестом `tests/test_demo_reset.py`).

В production-профиле (`APP_ENV=production`) reset заблокирован (спека, US 101).
