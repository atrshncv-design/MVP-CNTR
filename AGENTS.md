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
# Платформа «Технозрелость» — памятка агенту

B2B/B2G платформа ЦНТР по ГОСТ Р 58048-2017 (НИОКР-проекты, оценка технозрелости UGT, реестры участников, новости/достижения): frontend Next.js 16 + backend FastAPI + PostgreSQL primary/replica; перед первой правкой прочитай «Структуру», чтобы не редактировать чужой чекаут.

## Команды (проверены на этой ветке)
- Тесты backend: `cd technozrelost-backend && uv sync --extra dev && uv run pytest -q` → 268 passed; голый `uv sync` без `--extra dev` сносит dev-экстры (исчезает pytest).
- Проверка frontend: `cd technozrelost-frontend && npm run lint && npm test && npm run build` — build только при остановленном dev-сервере.
- Dev-БД: `docker compose -f technozrelost-backend/infra/docker-compose.yml up -d pg-primary pg-replica` (сервисы называются именно так; порты 5432/5433).
- Прод-контур локально: `cd technozrelost-backend/infra && cp .env.production.example .env.production && ./deploy.sh`; после подъёма — `curl -sk https://localhost/api/v1/health`.

## Структура и география репозитория
- Это ОДИН git-репозиторий со множеством worktrees; актуальная консолидированная ветка — `autopilot/deploy-readiness-code`, её чекаут — `.worktrees/deploy-readiness/`: ВСЕ правки только там, далее пути от него.
- В корне репо лежат чекауты ДРУГИХ веток: `technozrelost-backend/` (`release/friday-rc`) и `technozrelost-frontend/` (`codex/frontend-design-baseline-2026-08-11`) — их не редактировать.
- `app/`, `alembic/`, `db/`, `tests/` в корне worktree — архивная линия первого бэкенда (только чтение); канонический код — `technozrelost-backend/` и `technozrelost-frontend/`.
- Карта веток и их судьба — `docs/version-map.md`; спеки и прогоны агента — `.autopilot/` в корне репо.
- Backend: `app/main.py` собирает приложение и монтирует ~25 роутеров `app/api/v1/*`, сервисный слой `app/services/*`, все ORM-модели в `app/db/models.py`, миграции `alembic/versions/0001…0027`.
- Frontend: `src/app/(landing)/` — публичный сайт, `src/app/dashboard/<роль>/` — кабинеты ролей, серверные клиенты API — `src/lib/`.

## Ключевые файлы
- Backend: `technozrelost-backend/app/core/config.py` — все env-настройки + прод-гард JWT_SECRET; `app/core/database.py` — engine Primary и read-engine Replica, зависимости `get_db`/`get_read_db`.
- `app/services/auth_throttle.py` — троттлинг логина; `html_sanitizer.py` — nh3-санитизация HTML новостей на обеих точках записи; `file_storage.py` — MinIO+ClamAV; `news_scheduler.py` — планировщик публикаций внутри процесса приложения.
- Инфраструктура: `infra/docker-compose.yml` (dev-БД/MinIO/ClamAV), `docker-compose.prod.yml` + `nginx/nginx.prod.conf` + `backend-entrypoint.sh` (прод-стек, entrypoint сам применяет миграции), `deploy.sh`/`backup.sh`/`restore.sh`, `.env.production.example`.
- Утилиты: `scripts/loadtest.py` (флаги `--insecure`, `--bench-login`; методика в `infra/README-LOADTEST.md`), `scripts/security_check.py`.
- Frontend: `next.config.ts` — CSP+security-заголовки и rewrites `/api/v1/*` → FastAPI; `src/auth.config.ts` — NextAuth credentials против `/api/v1/auth/login` с авто-refresh access за 5 мин до истечения; `src/middleware.ts` + `src/lib/roles.ts` (`ROUTE_ALLOWED_ROLES`) — ролевые гейты маршрутов; `src/lib/api-client.ts` — серверные запросы с Bearer-токеном.

## Архитектура
- Прод-путь запроса: nginx (TLS из `nginx/certs/`) → upstream `technozrelost_api` round-robin по 2 репликам FastAPI (`deploy.replicas: 2`); SSR/статика — контейнер `frontend:3000`.
- Граница primary/replica: запись всегда через Primary (:5432); безопасные чтения реестров/каталогов — через `get_read_db` на Replica (:5433); реплика hot standby (мутации отклоняет), при отсутствии конфигурации read-сессии падают на Primary.
- Файлы: загрузка в MinIO, ClamAV fail-closed — при pending/ошибке скана отдача запрещена (409), oversize upload = 413.
- Аутентификация: JWT HS256, access 60 мин / refresh 14 дней; фронт держит сессию в NextAuth JWT; ключ троттлинга логина — X-Real-IP → последний hop XFF → client.host (за nginx не подделать).
- Security-заголовки разделены источников: для фронта CSP+5 заголовков задаёт `next.config.ts headers()`, nginx ставит свои и `proxy_hide_header` вырезает дубли FastAPI; HSTS ровно один, 63072000.
- news_scheduler живёт в процессе uvicorn — поэтому масштабирование наивным `--workers` дублирует планировщик.
- LLM-функции (RAG, генерация документов, чат) ходят в OpenAI-совместимый API; без ключа недоступны, но не мешают старту; наблюдаемость — Prometheus-middleware, Grafana/Prometheus в prod-стеке.

## Соглашения кода
- Backend Python 3.11+, async SQLAlchemy 2.0, pydantic-settings; ruff (line-length 100, правила E/F/I/UP/B/SIM) и mypy strict настроены в `pyproject.toml`; pytest asyncio_mode=auto.
- Комментарии/докстринги — по-русски и объясняют «почему»; ID — serial/bigserial; индексы создаются под реальные фильтры (миграция 0027 — образец).
- Frontend TypeScript strict, App Router, Tailwind v4; данные тянут серверные компоненты через `src/lib/*`, клиентские ходят относительным `/api/v1` через rewrites.

## Окружение (только имена; значения секретов никогда не копировать)
- Backend `.env` (`app/core/config.py`): APP_ENV (dev/test/production; в test пул = NullPool, в production дефолтный JWT_SECRET запрещён), POSTGRES_USER/PASSWORD/DB/HOST/PORT, POSTGRES_REPLICA_HOST/PORT либо полные DATABASE_URL/DATABASE_REPLICA_URL, DB_POOL_SIZE/DB_MAX_OVERFLOW, JWT_SECRET, CORS_ORIGINS, LLM_API_BASE/LLM_API_KEY/LLM_MODEL, MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/SECURE, CLAMAV_HOST/PORT/CLAMAV_ENABLED, MAX_FILE_SIZE_MB/MAX_REQUEST_BODY_MB.
- Прод-шаблон `infra/.env.production.example`: POSTGRES_*, REPL_USER/REPL_PASSWORD/REPL_SLOT, JWT_SECRET, NEXTAUTH_URL/NEXTAUTH_SECRET, CORS_ORIGINS, LLM_*, MINIO_*, GRAFANA_ADMIN_USER/GRAFANA_ADMIN_PASSWORD, BACKUP_BEFORE_MIGRATIONS/BACKUP_KEEP.
- Frontend `.env.example`: AUTH_SECRET/AUTH_URL (NextAuth), API_URL_INTERNAL (сервер→бэкенд, не инлайнится в бандл), NEXT_PUBLIC_API_URL (клиент→бэкенд напрямую; из неё собирается CSP connect-src).

## Тесты
- Backend: conftest сам создаёт БД `technozrelost_test` и гонит `alembic upgrade head`; нужен поднятый pg-primary на :5432; guard-тесты фиксируют бюджет N+1 карточки проекта (≤14 запросов), security-заголовки, fail-closed скан, прод-гард секретов.
- Frontend: `npm test` = node --test по `tests/*.test.mjs` (api-client, security-headers, ui-shell, news); `npm run build` дополнительно проверяет типы и роуты.

## Подводные камни
- `npm run build` при живом `next dev` ломает NextAuth-роуты — сначала останови dev-сервер.
- Голый `uv sync` вместо `uv sync --extra dev` удаляет pytest/ruff/mypy.
- Dev-compose сервисы БД называются `pg-primary`/`pg-replica`, prod-compose — `db`/`db-replica`; конфиги compose ради тестов не менять.
- Не коммить самостоятельно: изменения остаются в рабочем дереве, коммитит оркестратор; на `main` не коммитить, историю не переписывать.
- Значения из `.env*` никогда не попадают в отчёты/логи/коммиты — только имена переменных; неотслеживаемые файлы пользователя не удалять и не перемещать.
- Недостающая зависимость — возвращай BLOCKED с именем пакета, а не устанавливай молча.

## Как здесь работает Autopilot

Проект: цифровая платформа «Технозрелость» (B2B/B2G для ЦНТР, ГОСТ Р 58048-2017).
Frontend — Next.js (`technozrelost-frontend/`), Backend — FastAPI (`technozrelost-backend/`).

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Правило: требование из `manifest.md`
может снять только пользователь.

Если работа продолжается — скажи «продолжи автопилот»: состояние поднимется
из `.autopilot/state.js`, переспрашивать ничего не нужно.
<!-- autopilot:end -->
