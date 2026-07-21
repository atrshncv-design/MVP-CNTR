# STATUS / CURRENT STATE

**Текущая фаза:** Фаза 1 завершена (Шаги 1.1–1.4). Ожидаю проверки Functional Validator перед Фазой 2.

## Новый push-контракт (CLAUDE.md §6)
- Remote `origin` → `https://github.com/atrshncv-design/MVP-CNTR.git` задан.
- Все ветки `main`, `feat/frontend`, `feat/backend` отправляются на GitHub после каждого коммита.

## Что сделано (Шаг 1.1 — Git worktrees)
Изолированные worktree (`git worktree list`):
- `../technozrelost-frontend` → `feat/frontend` — Next.js 16.2.10 (App Router, TS, Tailwind v4, ESLint, Turbopack).
- `../technozrelost-backend`  → `feat/backend`  — FastAPI (uv, SQLAlchemy async+asyncpg, Alembic, pgvector, psycopg3, ruff, mypy-strict).

## Что сделано (Шаг 1.2 — PostgreSQL + pgvector)
- `infra/docker-compose.yml`: Primary `:5432` + hot-standby Replica `:5433` (streaming replication, слот `tz_replica_slot`).
- Схемы `public`/`test`, расширения `vector 0.8.0`, `pg_trgm`.
- Миграции: `0001_init_schemas`, `0002_rag_documents` (BigSerial PK + Hash/B-Tree/ivfflat индексы).

## Что сделано (Шаг 1.4 — RBAC в БД)
- Миграция `0003_rbac.sql` / Alembic `0003_rbac.py`:
  - `public.roles` (Serial PK) — **9 ролей из PRD §3** с си́дами: ГосКомпания-заказчик, R&D-исполнитель, Научная организация (P2), Серийный производитель, Эксперт УГТ, Аудитор (P2), Инвестор, Администратор ЦНТР, Менеджер ЦНТР.
  - `public.permissions` (Serial PK) + `public.role_permissions` (many-to-many) — гранулярные права по PRD.
  - `public.users` (BigSerial PK): `password_hash` (bcrypt), `is_active`, `is_superuser`, `last_login_at`. Hash-индекс по `email` (lookup) + B-Tree unique по `email`.
  - `public.user_roles` (many-to-many), `is_primary` с partial-unique индексом (одна primary role на пользователя).
- SQLAlchemy-модели (`app/db/models.py`) — единственный путь обращения к БД в рантайме (152-ФЗ).

## Что сделано (Шаг 1.3 — NextAuth.js + Middleware)
- Backend: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`; JWT (HS256), bcrypt; зависимость `require_role(*slugs)` для защиты эндпоинтов. CORS на фронт.
- Frontend: NextAuth.js v5 (beta.32), Credentials-провайдер → POST на FastAPI `/auth/login`; стратегия JWT; session.user.roles + accessToken.
- Серверные страницы: `/login` (формас Suspense), `/register` (выбор роли из 9), `/dashboard` (диспетчер по primary-роли), 9 кабинетов `/dashboard/<role_slug>`, `/forbidden` (страница запрета), home с навигацией по статусу сессии.
- **Middleware (`src/middleware.ts`):**
  - `/dashboard/*` без сессии → редирект на `/login?callbackUrl=...`.
  - `/dashboard/<role>` с чужой ролью → `rewrite('/forbidden')`.
  - `/login`/`/register` при залогиненной сессии → редирект в primary-кабинет.

## Smoke-тесты (E2E пройдены)
1. `/dashboard`, `/dashboard/cntr_admin` без сессии → 307 на `/login`. ✅
2. Регистрация `gk_customer` через фронт→бэк → 201. ✅
3. Login через NextAuth (csrf+credentials) → 302 в `/dashboard`. ✅
4. `/api/auth/session` содержит `roles:['gk_customer']` и `accessToken`. ✅
5. `/dashboard/gk_customer` со своей ролью → 200. ✅
6. `/dashboard/cntr_admin` GK-юзером → контент `Доступ запрещён`. ✅
7. `/dashboard/gk_customer`, `/dashboard/cntr_admin` R&D-юзером → `Доступ запрещён`. ✅
8. `/login` при залогиненной сессии → 307 в `/dashboard/<primary_role>`. ✅
- Backend health-checks: `ruff check`/`mypy --strict` чисто; `npm run lint`/`tsc`/`next build` чисто.

## Актуальные проблемы / Блокеры
- Нет. Docker-compose поднимается из worktree `feat/backend`: `docker compose -f infra/docker-compose.yml up -d` (данные в volumes сохраняются).

## Следующий шаг для агента
Фаза 2 (Plan.md):
- Шаг 2.1 — интеграция кода из `КОД MVP "0" 210726 - ТОЛЬКО ФРОНТЭНД` (шкала УГТ 1–9, опросник) в новый Next.js App Router.
- Шаг 2.2/2.3 — базовый UI ЛК для ролей «ГосКомпания» и «Исполнитель».

## Артефакты для проверки Functional Validator
- Ветки на GitHub: `main`, `feat/frontend`, `feat/backend` (см. https://github.com/atrshncv-design/MVP-CNTR).
- Запуск локально: из worktree `feat/backend` поднять БД (`docker compose ... up -d`), затем `uv run alembic upgrade head`, `uv run uvicorn app.main:app --port 8000`; из worktree `feat/frontend` `npm install && npm run dev` (`.env.local` уже задан, но не в git — см. `.env.example`-аналоги).
- Проверить роли: `docker exec tz-pg-primary psql -U technoz -d technozrelost -c "SELECT role_no, slug, name FROM public.roles ORDER BY role_no;"`
- Проверить RBAC-сессию: `curl -s -X POST http://localhost:8000/api/v1/auth/register ...` и `.../auth/login`.