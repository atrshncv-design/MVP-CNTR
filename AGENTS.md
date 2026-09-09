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
# Платформа «Технозрелость» — памятка агенту (tier T3, верифицировано 2026-09-09)
Память из кода + `.autopilot/2026-09-08-audit-remediation/interfaces.md`, не из spec/tickets/manifest; стек Next.js 16 + FastAPI + PostgreSQL 16/pgvector + MinIO/ClamAV/Redis/nginx; УдГУ CLI офлайн без БД.
## Заголовок и строка
Tier T3, slug `audit-remediation`; 10 границ (auth/registry/realtime/files/ai/frontend-auth/landing/infra-backup/infra-observe/db); швы — публичная HTTP-граница API + `pytest`/`npm test`/линт/сборки.
## Команды
- Полные сюиты (верифицировано 2026-09-09): `cd technozrelost-backend && uv run pytest -q` → 489 passed; `cd technozrelost-frontend && npm test` → 180 passed, `npm run build` → success; `uv run ruff check app tests infra/alerter scripts/udgu_ingest` → чисто.
- Один файл backend: `cd technozrelost-backend && uv run pytest tests/test_ci_gates.py -q` → 5 passed.
- Один файл frontend: `cd technozrelost-frontend && node --test tests/offline.test.mjs` → 10 passed.
- Голый `uv sync` без `--extra dev` сносит dev-зависимости — запрещён; `python` может отсутствовать — использовать `uv run python` или `python3`.
## Ключевые файлы
- Точка входа: `technozrelost-backend/app/main.py`; конфиг-гард: `technozrelost-backend/app/core/config.py`; Primary/Replica: `technozrelost-backend/app/core/database.py`.
- Каталог ошибок: `technozrelost-backend/app/core/errors.py` (`ERROR_HEADER="X-Error-Code"`, `CATALOG` ru/en, `raise_error`).
- Auth/реестры/SSE/пробы: `technozrelost-backend/app/api/v1/auth.py`, `technozrelost-backend/app/api/v1/nioktr.py`, `technozrelost-backend/app/api/v1/executors.py`, `technozrelost-backend/app/api/v1/realtime.py`, `technozrelost-backend/app/api/v1/health.py`, `technozrelost-backend/app/api/v1/files.py`, `technozrelost-backend/app/api/v1/metrics.py`.
- Сервисы: `technozrelost-backend/app/services/metrics.py` (`build_route_templates`, `UNMATCHED_ROUTE`), `technozrelost-backend/app/services/ai_assistant.py` (`wrap_untrusted`, `UNTRUSTED_BEGIN`), `technozrelost-backend/app/services/matching.py` (`parse_llm_ranking`), `technozrelost-backend/app/services/file_storage.py`, `technozrelost-backend/app/core/embeddings.py` (`EMBEDDING_MODEL`, `expanded_terms`, `lexical_score`).
- Миграции: `technozrelost-backend/alembic/versions/0033_revoke_self_registered_privileges.py`, `technozrelost-backend/alembic/versions/0036_semantic_embeddings_reindex.py`, `technozrelost-backend/alembic/versions/0037_status_checks.py`; реиндекс: `technozrelost-backend/scripts/reindex_rag_embeddings.py`; УдГУ: `technozrelost-backend/scripts/udgu_ingest/ingest.py`, `technozrelost-backend/scripts/udgu_ingest/models.py`.
- Инфра: `technozrelost-backend/infra/nginx/nginx.prod.conf`, `technozrelost-backend/infra/docker-compose.yml`, `technozrelost-backend/infra/docker-compose.prod.yml`, `technozrelost-backend/infra/backup-lock.py`, `technozrelost-backend/infra/alerter/alerter.py`, `technozrelost-backend/infra/prometheus/prometheus.yml`; CI: `.github/workflows/ci.yml`.
- Фронт: `technozrelost-frontend/next.config.ts`, `technozrelost-frontend/src/lib/landing-registry.ts` (`SHOWCASE_PAGE_SIZE=9`), `technozrelost-frontend/src/lib/translators.ts` (`translatorFor`), `technozrelost-frontend/src/lib/public-api.ts`, `technozrelost-frontend/src/lib/api-client.ts`, `technozrelost-frontend/src/features/offline/queue.ts` (`sanitizeOfflineHeaders`, `syncOfflineQueue`).
## Архитектура
- Поток: browser → nginx `:443` → `frontend:3000` / `backend:8000` (×2 реплики, Docker DNS + `resolver 127.0.0.11`); запись Primary `get_db`, чтение Replica `get_read_db` (`technozrelost-backend/app/core/database.py`).
- Auth: JWT HS256 + NextAuth Credentials; `POST /auth/register` — allowlist непривилегированных, иначе 403 `AUTH_PRIVILEGED_ROLE_FORBIDDEN`; `PATCH /users/{id}` и `PATCH /projects/{id}/control-points/{cp_id}` — staff-bypass, чужим 404/403.
- Refresh: атомарный `UPDATE ... WHERE revoked_at IS NULL AND expires_at >= now()` в `technozrelost-backend/app/api/v1/auth.py`; троттлинг входа/регистрации через Redis с in-memory fallback.
- Registry: `enforce_registry_limit` в `technozrelost-backend/app/api/v1/nioktr.py` (anon `registry_anon_limit`, auth `registry_auth_limit`, окно `registry_window_seconds`, LRU `registry_max_entries`); `/executors/specialists` limit 20≤100 + after_id, `/executors/organizations` limit + offset; nginx zone registry 100r/s + auth 10r/s.
- Realtime: `POST /notifications/sse-ticket` → одноразовый ticket TTL 30с, `GET /notifications/stream?ticket=`; токен в query → 400 `SSE_TOKEN_IN_URL`, чужой/used/expired → 401 `SSE_TICKET_INVALID`; Redis pubsub + in-memory fallback; nginx пишет SSE отдельным логом без query.
- Files: сигнатурный MIME (pdf/docx/xlsx/png/jpeg) до 25МБ, UUID-имена, MinIO закрытый бакет + ClamAV INSTREAM fail-closed (`technozrelost-backend/app/services/file_storage.py`).
- Ready: `GET /ready` в `technozrelost-backend/app/api/v1/health.py` → `{status,databases,redis,storage,clamav}`, 503 при любом unavailable; Redis prod обязателен (fail-fast в `technozrelost-backend/app/core/config.py`), dev/test `not_configured`.
- Observe: метки `(method,route,status)`, несопоставленное → `route="unmatched"` bounded + экранирование (`technozrelost-backend/app/services/metrics.py`); тело 32m (`client_max_body_size 32m` == `max_request_body_mb`), файл 25МБ.
- Backup: `technozrelost-backend/infra/backup-lock.py` коды 0 готово/дедуп, 3 занято (блокирует alembic), 1 ошибка, 2 usage; `--manual`/`--force`/`BACKUP_FORCE=1` обходят deploy-маркеры.
- AI: `wrap_untrusted` + `UNTRUSTED_BEGIN/END`, `LLM_TIMEOUT_SECONDS=8.0`, `LLM_QUEUE_TIMEOUT_SECONDS=2.0`, `LLM_MAX_CONCURRENCY=4`; `_parse_stage_success` — первая непустая строка с токеном SUCCESS и границей слова; семантика офлайн 1536 (синонимы техдомена, без внешних API) + `reindex_all`.
- Frontend-auth: очередь `technozrelost-frontend/src/features/offline/queue.ts` хранит действия без Authorization, токен инжектится в момент отправки.
- Landing: `getPublicRegistry` → `GET /projects/registry` без Authorization, `mergeRegistryPage/buildPublicRegistryQuery` в `technozrelost-frontend/src/lib/landing-registry.ts`.
- DB: линейные ревизии alembic с upgrade/downgrade; P2 CHECK статусов + prod-guard отклоняет `change_me` пароли БД/MinIO.
## Соглашения кода
- Линт `technozrelost-backend/pyproject.toml`: ruff `E,F,I,UP,B,SIM` line-length 100, `mypy --strict`, `pytest asyncio_mode=auto pythonpath=[.]`.
- Только ORM SQLAlchemy; `Serial/BigSerial`, Hash для exact, B-Tree default/range; раздельные схемы `public`/`test`.
- Ошибки только `raise raise_error(CODE,params,request=request)`; `detail` строка, код в `X-Error-Code`; локаль из `Accept-Language`, default ru; склейка в местах вызова запрещена.
- Комментарии «почему», pydantic>=2.5; отсутствующая зависимость → `BLOCKED: <имя>` + причина, молча не ставить.
- Работа в изолированном worktree, `main` не ломать; прод-сиды и `technozrelost-backend/infra/docker-compose.prod.yml` вне своего таска не трогать.
## Окружение
- Backend (`technozrelost-backend/.env.example` + `technozrelost-backend/app/core/config.py`): `APP_ENV/APP_NAME/APP_HOST/APP_PORT/LOG_LEVEL`, `POSTGRES_USER/PASSWORD/DB/HOST/PORT`, `POSTGRES_REPLICA_HOST/PORT`, `DATABASE_URL/DATABASE_REPLICA_URL`, `DB_SCHEMA_PUBLIC/DB_SCHEMA_TEST`, `DB_POOL_SIZE/DB_MAX_OVERFLOW/DB_APP_REPLICAS/DB_MAX_CONNECTIONS/DB_CONNECTIONS_RESERVE`, `VECTOR_DIMENSION`, `JWT_SECRET/JWT_ALGORITHM/ACCESS_TOKEN_TTL_MINUTES/REFRESH_TOKEN_TTL_DAYS/CORS_ORIGINS`, `REDIS_URL/SSE_TICKET_TTL_SECONDS`, `REGISTRY_ANON_LIMIT/REGISTRY_AUTH_LIMIT/REGISTRY_WINDOW_SECONDS/REGISTRY_MAX_ENTRIES`, `LLM_API_BASE/LLM_API_KEY/LLM_MODEL/LLM_GATEWAY_ENABLED`, `MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/SECURE`, `CLAMAV_HOST/PORT/CLAMAV_ENABLED/CVD_MAX_AGE_SECONDS`, `MAX_FILE_SIZE_MB/MAX_REQUEST_BODY_MB`.
- Frontend (`technozrelost-frontend/.env.example`): `AUTH_SECRET/AUTH_URL`, `API_URL_INTERNAL`, `NEXT_PUBLIC_API_URL`.
- Prod (`technozrelost-backend/infra/.env.production.example`): `REPL_USER/REPL_PASSWORD/REPL_SLOT`, `GRAFANA_ADMIN_USER/GRAFANA_ADMIN_PASSWORD`, `BACKUP_*`, `WAL_*`, `ALERTER_*`, `TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID`.
## Тесты
- Backend `technozrelost-backend/tests/test_*.py`: один файл `cd technozrelost-backend && uv run pytest tests/test_ci_gates.py -q`; УдГУ-четвёрка без БД, остальные требуют тестовую БД. Общая тестовая БД одна на всех — короткие файлы, при дедлоке подождать и повторить.
- Фронт `technozrelost-frontend/tests/*.test.mjs`: один файл `cd technozrelost-frontend && node --test tests/offline.test.mjs`; локали `locale-zh/locale-hi`, витрина `landing-registry`, офлайн `offline`.
- Гейты: `technozrelost-backend/tests/test_ci_gates.py` сверяет текст `.github/workflows/ci.yml`; `technozrelost-backend/tests/test_nginx_body_size.py` сверяет равенство 32m.
## Подводные камни
- SSE ticket в access-логе отсутствует осознанно (отдельный лог без query); JWT в query запрещён.
- Метки метрик никогда не содержат сырой path (кардинальность); per-instance скрап требует dns_sd в `technozrelost-backend/infra/prometheus/prometheus.yml`.
- Sentinel пустого раздела УдГУ — `нет данных` в первом столбце; `__MACOSX`/`__*` вне `raw_refs`; `00_опись.pdf` только placeholder.
- Demo-guard: не перезапускать `next dev :3000`, `uvicorn :8000`, docker-контейнеры; не занимать их порты; миграции/сиды только на тестовой БД.
- Prod-guard падает на `change_me`/пустых секретах и пустом `REDIS_URL`; dev-дефолт `http://127.0.0.1:8000` только для dev (`technozrelost-frontend/next.config.ts`).
- CSP/nonce и security-заголовки — источник nginx, дубли upstream вырезаются `proxy_hide_header`.
- Флейки общей тестовой БД под параллельными прогонами лечатся повтором.
## Как здесь работает Autopilot
- Память собирается из кода + `interfaces.md` этого прогона; spec/tickets/manifest не открывать.
- Состояние поднимается чтением `.autopilot/state.js` и `dashboard.html` прогона, затем код по швам выше.
- Пуш каждого коммита в `origin https://github.com/atrshncv-design/MVP-CNTR.git`; секреты только именами, никогда значениями.
<!-- autopilot:end -->
