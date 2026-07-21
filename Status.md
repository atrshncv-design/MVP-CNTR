# STATUS / CURRENT STATE

**Текущая фаза:** Фаза 1 завершена по Шагам 1.1–1.2. Ожидаю проверки Functional Validator перед Шагом 1.3.

**Что сделано (Шаг 1.1 — Git worktrees):**
- Инициализирован git-репозиторий на ветке `main`; baseline-коммиты с CLAUDE.md/Plan.md/PRD.md/Status.md и импортом исходников MVP 0 (вложенный `.git` переименован в `.git_backup_mvp0`, исключён из индекса).
- Созданы два изолированных worktree (sibling-директории, не ломают `main`):
  - `../technozrelost-frontend`  → ветка `feat/frontend` — скаффолд Next.js 16.2.10 (App Router, TypeScript, Tailwind v4, ESLint, Turbopack, src-dir). `tsc --noEmit` и `eslint` — чисто.
  - `../technozrelost-backend`   → ветка `feat/backend`  — скаффолд FastAPI (uv, Python 3.14 venv, SQLAlchemy 2 async + asyncpg, Alembic, pgvector, psycopg3, ruff, mypy). Health-эндпоинты `/api/v1/health` и `/api/v1/ready` отвечают 200; `ruff check` и `mypy --strict` — чисто.

**Что сделано (Шаг 1.2 — PostgreSQL + pgvector):**
- `infra/docker-compose.yml`: PostgreSQL 16 + pgvector 0.8.0, Primary (`:5432`) и hot-standby Replica (`:5433`) через streaming replication (`pg_basebackup` + физический слот `tz_replica_slot`).
- Миграции (Alembic + эквивалентный SQL-слой в `db/migrations/sql/`):
  - `0001_init_schemas.sql`: схемы `public` (продакшн) и `test` (гипотезы); расширения `vector` и `pg_trgm`; журнал `db_migration_log` (Serial PK, Hash + B-Tree).
  - `0002_rag_documents.sql`: `public.rag_documents` — BigSerial PK, `embedding vector(1536)`, Hash-индекс по `content_hash`, B-Tree по `(doc_type, created_at)` и `ugt_level`, ivfflat по `embedding` (cosine).
- **Валидация пройдена:** схемы public/test существуют; `vector 0.8.0` и `pg_trgm 1.6` подключены; индексы hash/btree/ivfflat созданы; sequences Serial/BigSerial на месте; Primary принимает запись, Replica read-only (INSERT отвергается); строка реплицируется, lag ~0; KNN-поиск по векторам работает.
- Заготовлен `infra/nginx/nginx.conf` — балансировщик перед API-серверами (активируется в Фазе 3).

**Актуальные проблемы / Блокеры:**
- Нет. (Docker Desktop был поднят автоматически; если daemon упадёт — `docker compose -f infra/docker-compose.yml up -d` из worktree backend поднимет стек заново, данные сохранятся в volumes.)

**Следующий шаг для агента:**
Шаг 1.3 (Plan.md) — интеграция NextAuth.js на стороне Next.js (регистрация, логин, защита маршрутов через Middleware). Затем Шаг 1.4 — RBAC-таблицы для 9 ролей (`Users`, `Roles`, `Projects`) в worktree `feat/backend`.

**Артефакты для проверки Functional Validator:**
- `git worktree list` (из корня проекта).
- Ветки: `main`, `feat/frontend`, `feat/backend` (`git log --oneline --all`).
- Контейнеры: `docker ps` → `tz-pg-primary`, `tz-pg-replica`.
- БД: `docker exec tz-pg-primary psql -U technoz -d technozrelost -c "\dt public.*"` и `\dx`.
