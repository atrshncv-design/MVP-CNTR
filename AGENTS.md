# AGENTS.md  
  
```
# MISSION STATEMENT
Ты — Автономный AI-Агент (Maker / Lead Agent). Твоя задача — разработка и реализация кода цифровой платформы «Технозрелость» (B2B/B2G инфраструктура для ЦНТР по ГОСТ Р 58048-2017).
Твой пользователь выступает ИСКЛЮЧИТЕЛЬНО в роли Functional Validator. Он не пишет код и не правит его руками. Любой запрос пользователя на исправление ошибки означает, что ТЫ должен провести анализ, написать код и протестировать его.

# ARCHITECTURE & STACK
- **Frontend (Уровень приложения):** Next.js (App Router). Существующий код MVP 0 лежит в папке `КОД MVP "0" 210726 - ТОЛЬКО ФРОНТЭНД`. Его нужно адаптировать под новую архитектуру.
- **Backend (Уровень логики и ИИ):** Python + FastAPI. Разделение слоев необходимо для независимого масштабирования и отказоустойчивости.
- **Database (Уровень хранения):** PostgreSQL. 
  - Реляционные данные: Пользователи, Роли, Статусы проектов.
  - Векторные данные (для RAG): Расширение `pgvector`.
- **Инфраструктура:** Разделение БД на Primary (запись) и Replica (чтение). Перед серверами должен стоять балансировщик (Nginx).

# RULES ENFORCEMENT (КРИТИЧЕСКИЕ ЗАПРЕТЫ)
1. **Изоляция:** Вся работа ведется строго в изолированных `git worktrees`. Не ломай ветку `main`.
2. **Базы Данных и Индексы:** 
   - Всегда используй раздельные схемы (schemas), например `public` для продакшена и `test` для тестирования гипотез.
   - Для идентификаторов (ID) используй тип `Serial` (или `BigSerial`) для автогенерации последовательностей (sequences).
   - При проектировании таблиц обязательно создавай индексы: используй **Hash Index** для точного поиска (например, по ID или конкретному email) и **B-Tree Index** по умолчанию для запросов с неравенствами (например, возраст или диапазоны дат).
3. **Безопасность (152-ФЗ и ВПК):** Защита от SQL-инъекций обеспечивается строгим использованием ORM (Prisma/Drizzle для Next.js, SQLAlchemy для Python). Для аутентификации используй NextAuth.js.
4. **Контракт Автономности:** Установлен жесткий лимит — 25 итераций на одну задачу. В случае зацикливания рассуждений (Stall Detection) или падения тестов — немедленно остановись и запроси помощь у Functional Validator.
5. **Атомарная память:** После каждого успешного шага ТЫ ОБЯЗАН обновить файл `Status.md`. Контекст следующих шагов читай из `Plan.md`.
6. **Удалённый репозиторий (Push-контракт):** Все зафиксированные изменения (коммиты) должны в обязательном порядке отправляться (push) в удаленный репозиторий: `https://github.com/atrshncv-design/MVP-CNTR.git`. Remote命名为 `origin` (если ещё не задан). Запрещено оставлять локальные коммиты не отправленными.

```

<!-- autopilot:start -->
# Платформа «Технозрелость» — памятка агенту (tier T2, верифицировано 2026-08-28)

B2B/B2G платформа ЦНТР по ГОСТ Р 58048-2017 (НИОКР-проекты, оценка технозрелости UGT, реестры участников, новости/достижения). Стек: Next.js 16 (App Router) + FastAPI (async) + PostgreSQL 16 + pgvector + MinIO + ClamAV + Redis + nginx. Память — из кода и `interfaces.md`, не из плана/манифеста.

## Стек
- **Backend:** Python 3.11+, FastAPI ≥0.115, async SQLAlchemy 2.0 + asyncpg, alembic 1.14, pgvector 0.3.6, pydantic/pydantic-settings, python-jose+passlib/bcrypt, httpx, nh3, minio, pymupdf, reportlab. Инструменты: `uv`, `ruff` (line-length 100, правила E/F/I/UP/B/SIM), `mypy --strict`, `pytest` (asyncio_mode=auto, 57 тестовых файлов). Конфиг — `technozrelost-backend/pyproject.toml:1`.
- **Frontend:** Next.js 16.3 + React 19.2, TypeScript strict, Tailwind v4, next-auth 5.0.0-beta.32, framer-motion, recharts, lucide-react. Скрипты — `technozrelost-frontend/package.json:6`. Линт — eslint-config-next.
- **DB/Infra:** PostgreSQL 16 (образ `pgvector/pgvector:0.8.0-pg16`), Redis (pub/sub realtime), MinIO, ClamAV, nginx 1.27-alpine, Prometheus 2.54, Grafana 11.2. Node 22, uv 0.12.1.

## Архитектура
- **Запрос:** browser → `nginx:443` (TLS `nginx/certs/`) → `frontend:3000` (SSR) / `backend:8000` (upstream `technozrelost_api`, round-robin по 2 репликам FastAPI `deploy.replicas:2`). Браузер ходит по относительному `/api/v1/*` (rewrites `next.config.ts:headers()/rewrites()`), SSR — по абсолютному `API_URL_INTERNAL` из `src/lib/public-api.ts:30`. CSP `connect-src 'self'` + опциональный `NEXT_PUBLIC_API_URL`.
- **Primary/Replica:** запись — только Primary (`:5432`), безопасные чтения реестров/каталогов — `get_read_db()` на Replica (`:5433`, hot standby). Реализация — `technozrelost-backend/app/core/database.py:1` (`engine`/`read_engine`, `SessionLocal`/`read_session_factory`, `poolclass=NullPool` при `APP_ENV=test`). `read_session_factory` падает на Primary если `replica_dsn` не задан.
- **Пул БД** (R14): `db_pool_size=10`, `db_max_overflow=20`, `db_app_replicas=2`, `db_max_connections=100`, `db_connections_reserve=10`; формула guard-тест `tests/test_db_pool.py`.
- **Аутентификация:** JWT HS256 (`app/core/config.py:48`): access 60 мин / refresh 14 дней; `POST /api/v1/auth/login` → NextAuth Credentials (`src/auth.config.ts:22`) с авто-refresh за 5 мин до истечения; `/auth/logout` идемпотентен (204), смена пароля ревокает refresh. Троттлинг логина — `app/services/auth_throttle.py` (ключ X-Real-IP → последний hop XFF → client.host).
- **Безопасность файлов:** MinIO + ClamAV fail-closed (`app/services/file_storage.py`): pending/ошибка скана → 409, oversize → 413 (`max_request_body_mb=32`, `max_file_size_mb=25`). HTML новостей — nh3-санитизация на обеих точках записи (`app/services/html_sanitizer.py`).
- **Security-заголовки:** фронт — `next.config.ts` (CSP + X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS 63072000); nginx дублирует и `proxy_hide_header` гасит дубли FastAPI.
- **Особенности:** `news_scheduler` живёт внутри процесса uvicorn (`app/main.py:_news_scheduler_loop`, раз в 60с) — `--workers` дублирует планировщик; LLM/RAG/чат — OpenAI-совместимый API (`LLM_API_BASE/LLM_API_KEY/LLM_MODEL`), без ключа — no-op; метрики — `PrometheusMetricsMiddleware` + `install_db_listeners`.
- **Новости/достижения:** лента — все роли, консоль — только `cntr_admin/cntr_manager`; планировщик публикует отложенные.

## Ключевые файлы
- **Backend config/DB:** `technozrelost-backend/app/core/config.py:11` — все env-настройки + прод-гард `jwt_secret` (`_production_secrets_guard`), DSN `primary_dsn`/`replica_dsn`, `cors_origin_list`; `app/core/database.py:1` — engines и `get_db`/`get_read_db`; `app/core/security.py` — `sign_share_attribution`/`verify_share_attribution` (HMAC, share_sig TTL 30д).
- **Backend API:** `technozrelost-backend/app/main.py:1` — собирает FastAPI, монтирует ~25 роутеров `app/api/v1/*` (`health.py:12` — liveness `/health`, readiness `/ready` проверяет оба engine; `auth.py`, `projects.py` с `GET /projects/{id}/share-sig` + `POST /projects/join` без `shared_by`, `membership.py` и т.д.); `app/db/models.py` — все ORM-модели; `alembic/versions/0001…0027`.
- **Backend сервисы:** `app/services/auth_throttle.py`, `html_sanitizer.py`, `file_storage.py`, `news_scheduler.py`, `metrics.py`, `rag.py`, `document_generator.py`, `notifications.py`.
- **Инфраструктура:** `technozrelost-backend/infra/docker-compose.yml:1` (dev: pg-primary/pg-replica/minio/clamav) и `docker-compose.prod.yml:1` (prod: db/db-replica/minio/clamav/redis/backend×2/frontend/nginx/prometheus/grafana/backup-timer/wal-offsite/alerter); `nginx/nginx.prod.conf`, `backend-entrypoint.sh` (миграции под advisory lock), `deploy.sh`/`backup.sh`/`restore.sh`, `postgres/*.conf`+`*.sh`, `alerter/alerter.py`, `.env.production.example`, `infra/README-LOADTEST.md`.
- **Утилиты:** `scripts/loadtest.py` (профиль 70/20/8/2 на 1000 VUs, флаги `--insecure`/`--bench-login`) + `scripts/security_check.py` (5 групп: secrets/deps/RBAC/IDOR/file-security); доки заказчика `docs/СЕРВЕР-ТРЕБОВАНИЯ.md` и `docs/ИМПОРТОЗАМЕЩЕНИЕ.md`; карта веток `docs/version-map.md`.
- **Frontend:** `technozrelost-frontend/next.config.ts:1` — CSP+5 заголовков + rewrites `/api/v1/*`; `src/lib/public-api.ts:1` — единый модуль URL (`CLIENT_API_BASE` = `NEXT_PUBLIC_API_URL` или `""`, `serverApiBase()` — `API_URL_INTERNAL` с fail-closed); `src/lib/roles.ts:46` — `ROUTE_ALLOWED_ROLES` + `allowedRolesFor()` (ключи `[param]`=один сегмент, порядок=приоритет, `/dashboard` только точно, отсутствие записи → `null`=запрет); `src/middleware.ts:1` + `src/auth.config.ts:1` (NextAuth credentials против `/api/v1/auth/login`); `src/lib/api-client.ts`; `src/app/(landing)/` (публичный сайт) и `src/app/dashboard/<роль>/` (9 кабинетов), тесты `tests/*.test.mjs` (routes-matrix, api-url-module, security-headers и т.д.).

## Инфраструктура
- **Dev:** `docker compose -f technozrelost-backend/infra/docker-compose.yml up -d pg-primary pg-replica` (порты 5432/5433, pgvector, healthcheck `pg_is_in_recovery + streaming`), плюс minio :9000/:9001 и clamav :3310.
- **Prod:** `technozrelost-backend/infra/docker-compose.prod.yml` — сервисы `db`/`db-replica` (WAL-archive том `wal-archive-prod-data`, `postgresql-pitr.conf`, `repl_slot`), `backend` (2 реплики, `backend-entrypoint.sh` гонит миграции), `frontend`, `nginx` (80/443, certs в `nginx/certs/`), `redis`, `minio`, `clamav`, `prometheus`, `grafana`, `backup-timer`+`wal-offsite` sidecars, `alerter`. Сеть `tz-prod-network` 172.30.0.0/24. Деплой — `./deploy.sh` (генерит `JWT_SECRET`/`NEXTAUTH_SECRET` если плейсхолдер, health-gate по `HEALTH_SERVICES`, `rollback TAG` на `previous`).
- **Бэкапы (04/05):** `backup.sh` пишет маркеры — `BACKUP_FRESHNESS_MARKER` (дефолт `/backups/.backup-freshness`, ISO-8601 с офсетом) + `BACKUP_OFFSITE_MARKER` (`ok|warn|fail <ISO> <detail>`, warn=таргет не настроен) + `WAL_OFFSITE_MARKER`; алертер сверяет возраст с `BACKUP_MAX_AGE_HOURS`/`WAL_OFFSITE_MAX_AGE_SECONDS`. Offsite — `BACKUP_OFFSITE_REMOTE` (rclone `type=crypt` обязателен), physical base через `REPL_USER`/`REPL_PASSWORD`. Репетиция PITR — `scripts/rehearse_pitr.sh` → `reports/pitr-rehearsal-2026-08-26.txt` (PASS), runbook — `infra/RUNBOOK-DATA.md`.
- **Алертинг:** `infra/alerter/alerter.py` — `AlerterConfig.from_env()` + `CheckResult` + `alerter-state.json` (`{active,notification_sent}` дедупликация); Telegram только через `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (пусто=no-op); probes `ALERTER_MINIO_HEALTH_URL`/`ALERTER_CLAMAV_HOST+PORT`, проверка слотов/WAL/disk.
- **Наблюдаемость:** `/api/v1/metrics` → Prometheus → Grafana (внутри compose, наружу — SSH-туннель).
- **CI:** `.github/workflows/` — `push`+`pull_request`, jobs `backend` (pgvector service, uv/ruff/mypy/pytest) и `frontend` (npm lint/test/build) — из `interfaces.md:76`.

## Окружение (только имена переменных, без значений)
- **Backend `.env` (`app/core/config.py` + `.env.example`):** `APP_ENV` (dev/test/production; test→NullPool, production запрещает дефолтный `JWT_SECRET`), `APP_NAME/HOST/PORT/LOG_LEVEL`, `POSTGRES_USER/PASSWORD/DB/HOST/PORT`, `POSTGRES_REPLICA_HOST/PORT` либо `DATABASE_URL`/`DATABASE_REPLICA_URL`, `DB_SCHEMA_PUBLIC/DB_SCHEMA_TEST`, `DB_POOL_SIZE/DB_MAX_OVERFLOW/DB_APP_REPLICAS/DB_MAX_CONNECTIONS/DB_CONNECTIONS_RESERVE`, `VECTOR_DIMENSION`, `JWT_SECRET/JWT_ALGORITHM/ACCESS_TOKEN_TTL_MINUTES/REFRESH_TOKEN_TTL_DAYS/CORS_ORIGINS`, `REDIS_URL/SSE_TICKET_TTL_SECONDS`, `RATE_LIMIT_ENABLED/RATE_LIMIT_*_PER_MINUTE/EMBEDDING_CONCURRENCY`, `LLM_API_BASE/LLM_API_KEY/LLM_MODEL/GIGACHAT_CREDENTIALS`, `MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/SECURE`, `CLAMAV_HOST/PORT/CLAMAV_ENABLED`, `MAX_FILE_SIZE_MB/MAX_REQUEST_BODY_MB`.
- **Prod-шаблон `infra/.env.production.example`:** `POSTGRES_USER/PASSWORD/DB`, `REPL_USER/REPL_PASSWORD/REPL_SLOT`, `JWT_SECRET`, `CORS_ORIGINS`, `LLM_API_BASE/LLM_MODEL/LLM_API_KEY`, `MINIO_ACCESS_KEY/SECRET_KEY/BUCKET`, `NEXTAUTH_URL/NEXTAUTH_SECRET`, `API_URL_INTERNAL/NEXT_PUBLIC_API_URL`, `GRAFANA_ADMIN_USER/GRAFANA_ADMIN_PASSWORD`, `BACKUP_BEFORE_MIGRATIONS/BACKUP_KEEP/BACKUP_AT/BACKUP_SCRIPT/BACKUP_DIR/BACKUP_FRESHNESS_MARKER/BACKUP_MAX_AGE_HOURS/BACKUP_STRICT_MINIO/BACKUP_OFFSITE_REMOTE/BACKUP_OFFSITE_MARKER/WAL_OFFSITE_MARKER/WAL_OFFSITE_MAX_AGE_SECONDS`, `ALERTER_MINIO_HEALTH_URL/ALERTER_CLAMAV_HOST/ALERTER_CLAMAV_PORT/ALERTER_INTERVAL_SECONDS/.../ALERTER_SLOT_LAG_*`, `TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID`, `IMAGE_TAG`.
- **Frontend `.env.example`:** `AUTH_SECRET`/`AUTH_URL` (NextAuth), `API_URL_INTERNAL` (SSR, не инлайнится), `NEXT_PUBLIC_API_URL` (клиентский оверрайд, инлайнится и попадает в CSP `connect-src`).

## Команды запуска и тестов (верифицировано 2026-08-28, non-destructive)
- **Backend deps (dry-run):** `cd technozrelost-backend && uv sync --extra dev --dry-run` → `Would use project environment at: .venv / Resolved 70 packages / Checked 68 packages / Would make no changes`. Голый `uv sync` без `--extra dev` сносит pytest/ruff/mypy — запрещён (`interfaces.md:27`).
- **Backend качество:** `cd technozrelost-backend && uv run ruff check app` → `All checks passed!`; `uv run mypy app` — strict (`pyproject.toml:tool.mypy`); полная цепь — `uv sync --extra dev && uv run pytest -q && uv run ruff check . && uv run mypy app`.
- **Frontend:** `cd technozrelost-frontend && npm run lint` → `eslint` EXIT 0; `npm test` (`node --test tests/*.test.mjs`) → `tests 39 / pass 39 / fail 0` (routes-matrix, api-url-module, security-headers, ui-shell, news и т.д.); полная цепь — `npm run lint && npm test && npm run build` — `next build` только при остановленном `next dev`.
- **Dev-БД:** `docker compose -f technozrelost-backend/infra/docker-compose.yml up -d pg-primary pg-replica` — сервисы `pg-primary`/`pg-replica`/`minio`/`clamav` (проверено `config --services` → `clamav, minio, pg-primary, pg-replica`, порты 5432/5433). Тестам нужен поднятый `pg-primary` на :5432; `conftest` сам создаёт `technozrelost_test` и гонит `alembic upgrade head`.
- **Prod-контур локально:** `cd technozrelost-backend/infra && cp .env.production.example .env.production && ./deploy.sh` (генерит секреты, health-gate до 300с); после — `curl -sk https://localhost/api/v1/health` и `curl -sk https://localhost/api/v1/ready`.
- **Нагрузка/security harness:** `export PYTHONPATH=.` из `technozrelost-backend` → `uv run python scripts/security_check.py --base-url http://127.0.0.1:8000` (или `--skip-live`); `uv run python scripts/loadtest.py --prepare-users 1000 --seed-manager && uv run python scripts/loadtest.py --users 1000 --duration 120` (цели: success ≥99%, p95 read ≤500ms, p95 write ≤1s, отчёт `reports/loadtest_report.json`) — методика `infra/README-LOADTEST.md:44`.

## Структура и география репозитория
- **Моно-репозиторий с worktrees:** ветка `autopilot/m0-security-hardening` (текущий чекаут — корень проекта), prod-ветка `autopilot/deploy-readiness-code` (бывший `.worktrees/deploy-readiness`), `release/friday-rc` и `codex/frontend-design-baseline-2026-08-11` — чекауты не редактировать. Remote `origin` = `https://github.com/atrshncv-design/MVP-CNTR.git` (ветка `main` @ `a8f85c6`). На `main` не коммитить, историю не переписывать.
- **Корень:** `AGENTS.md`/`CLAUDE.md` (эта памятка), `README.md`, `PROGRESS.md`, `docs/` (`version-map.md`, `СЕРВЕР-ТРЕБОВАНИЯ.md`, `ИМПОРТОЗАМЕЩЕНИЕ.md`, `BACKLOG.md`, `PRD.md`, `DESIGN.md`), `.autopilot/` (спеки/состояние `state.js` tier T2, `interfaces.md`, `dashboard.html`), `.github/workflows/`.
- **Backend канонический:** `technozrelost-backend/` (`app/main.py`, `app/api/v1/*.py` ~25 роутеров, `app/services/*.py`, `app/db/models.py`, `alembic/versions/0001…0027`, `infra/`, `scripts/`, `tests/`). Архивная линия первого бэкенда (`app/`, `alembic/` в корне worktree) — только чтение.
- **Frontend канонический:** `technozrelost-frontend/` (`src/app/(landing)/`, `src/app/dashboard/<роль>/` 9 кабинетов, `src/lib/` — `public-api.ts`/`roles.ts`/`api-client.ts`, `src/middleware.ts`, `src/auth.config.ts`, `next.config.ts`, `tests/*.test.mjs`, `Dockerfile`).
- **Графы знаний:** `.graphify/` (`graph.json`, `GRAPH_REPORT.md`) — для вопросов по архитектуре первым делом `graphify query`.

## Подводные камни
- `npm run build` при живом `next dev` ломает NextAuth-роуты — сначала останови dev-сервер.
- Голый `uv sync` без `--extra dev` удаляет pytest/ruff/mypy — всегда `uv sync --extra dev`.
- Dev-compose сервисы называются `pg-primary`/`pg-replica` (порты 5432/5433), prod-compose — `db`/`db-replica` (внутри `tz-prod-network`); конфиги compose ради тестов не менять; prod `config --services` без `.env.production` падает `REPL_PASSWORD обязателен` — это норма.
- Не коммить самостоятельно: изменения остаются в рабочем дереве, коммитит оркестратор; на `main` не коммитить, историю не переписывать.
- Значения из `.env*` никогда не попадают в отчёты/логи/коммиты — только имена переменных; неотслеживаемые файлы пользователя не удалять и не перемещать.
- Недостающая зависимость/доступ — верни `BLOCKED` с именем пакета, не устанавливай молча.
- ID — `Serial`/`BigSerial`; индексы — Hash для точного поиска, B-Tree по умолчанию для диапазонов (миграция 0027 — образец); комментарии/докстринги — по-русски, объясняют «почему».
- `news_scheduler` — в процессе uvicorn, не масштабировать `--workers` без выноса.
- Security-заголовки: фронт — CSP из `next.config.ts`, nginx — свои + `proxy_hide_header` для дублей FastAPI; HSTS ровно один.
- Лимит автономности — 25 итераций на задачу; зацикливание или красные тесты после двух кругов правок — стоп и отчёт.

## Как здесь работает Autopilot
- Проект — цифровая платформа «Технозрелость» (B2B/B2G, ГОСТ Р 58048-2017). Сборка — навыком `/autopilot` (требования/спека/таски в `.autopilot/`, прогресс `dashboard.html`). Требование из `manifest.md` может снять только пользователь.
- Если работа продолжается — скажи «продолжи автопилот»: состояние поднимется из `.autopilot/state.js` (текущий tier T2, slug `m0-security-hardening`, mode semi), переспрашивать ничего не нужно.
<!-- autopilot:end -->
