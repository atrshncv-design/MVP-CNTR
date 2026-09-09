# Границы — из спецификации (копия раздела «Границы и швы», не редизайн)

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `auth` | регистрация, refresh-ротация, троттлинг входа | `POST /auth/*` | хранилище попыток, семейство токенов |
| `registry` | публичные реестры и их лимиты | `GET /nioktr/*`, `GET /executors/*`, `GET /projects/registry` | классификацию anon/auth, счётчики |
| `realtime` | ticket и SSE-поток | `POST /notifications/sse-ticket -> {ticket}`, `GET /notifications/stream?ticket=` | pubsub-транспорт, очереди fallback |
| `files` | загрузка, MIME, скан, скачивание | `POST /projects/{id}/files`, `GET /files/{id}/download` | ключи объектов, ответы ClamAV |
| `ai` | чат, RAG, matching, stage-оценка | `POST /chat/*`, `POST /rag/search`, `POST /match` | промпты, провайдер, очередь |
| `frontend-auth` | токены в браузере, offline-очередь | очередь без секретов, инъекция токена в момент отправки | сессия NextAuth |
| `landing` | витрина | страница на живых данных реестра | demo-заглушку (удалить) |
| `infra-backup` | бэкап перед миграциями | fail-closed гейт «бэкап готов → мигрируем» | lock-идентификаторы |
| `infra-observe` | метрики, алерты, прокси, пробы | `/metrics`, `/ready`, правила nginx | кардинальность, тексты алертов |
| `db` | миграции и целостность | линейные ревизии с upgrade/downgrade | SQL-диалект |

## Из таска 01 — Redis обязателен в проде

- prod требует `REDIS_URL` (Settings fail-fast, ошибка называет `REDIS_URL`); `REDIS_URL` в `.env.example` (prod-обязателен, dev-optional)
- `GET /api/v1/ready` → `{"status", "databases", "redis": ok|unavailable|not_configured}`, 503 при unavailable

## Из таска 04 — SSE по ticket

- `POST /notifications/sse-ticket -> {ticket}` (Bearer, TTL 30с, одноразовый)
- `GET /notifications/stream?ticket=`; access_token в query → 400 `SSE_TOKEN_IN_URL`; нет/чужой/used/expired ticket → 401 `SSE_TICKET_INVALID`
- ticket-store: Redis + in-memory fallback в dev/test; nginx пишет sse-лог без query

## Из таска 05 — честные лимиты реестров

- `enforce_registry_limit(request, user)` в `app/api/v1/nioktr.py`; классификация anon/auth по валидированному user
- `/executors/specialists`: limit (20, ≤100) + after_id; `/executors/organizations`: limit (20, ≤100) + offset

## Из таска 02 — кардинальность метрик

- `build_route_templates(routes) -> dict[int, str]` в `app.services.metrics`; карта строится после подключения роутеров
- метка `route="unmatched"` для несопоставленных путей (bounded); значения меток экранируются
- per-instance скрап двух реплик требует `prometheus.yml` dns_sd — перенесено в таск 16 (infra-зона)

## Из таска 03 — allowlist привилегий

- `POST /auth/register`: непривилегированный allowlist, иначе 403 `AUTH_PRIVILEGED_ROLE_FORBIDDEN`
- `PATCH /users/{id}` (cntr_admin): выдача/снятие ролей + аудит `user.role.granted/revoked`
- `PATCH /projects/{id}/control-points/{cp_id}`: посторонним 404, участнику без роли 403, свой КТ владельцу 403, staff/superuser bypass
- миграция `0033_revoke_self_registered_privileges`: отзыв самозарегистрированных привилегий

## Из таска 06 — атомарная ротация refresh

- `POST /auth/refresh`: атомарный `UPDATE ... WHERE revoked_at IS NULL AND expires_at >= now() RETURNING user_id`; коды 401 без смены

## Из таска 07 — лимит тела 32m

- nginx `client_max_body_size 32m` == backend `max_request_body_mb` 32MiB; лимит файла 25MiB без изменений; источник — `app/core/config.py`

## Из таска 09 — fail-closed бэкапа

- `backup-lock.py`: коды 0 готово/дедуп, 3 занято, 1 ошибка, 2 usage; `--manual`/`--force` и `BACKUP_FORCE=1` обходят deploy-маркеры
- entrypoint при rc=3 пишет «backup-lock занят» и блокирует alembic; timer при rc=3 — benign skip

## Из таска 10 — очередь без секретов

- `sanitizeOfflineHeaders(headers)`; `syncOfflineQueue(fetcher?, fn | {accessToken} | {getAccessToken})`; типы `OfflineTokenProvider`, `SyncOfflineQueueOptions`
- очередь хранит действия без Authorization, токен инжектится в момент отправки

## Из таска 11 — изоляция LLM

- `ai_assistant.wrap_untrusted(text)`, `UNTRUSTED_BEGIN/END`, `PROMPT_ISOLATION_RULE`, `LLM_TIMEOUT_SECONDS=8.0`, `LLM_QUEUE_TIMEOUT_SECONDS=2.0`, `LLM_MAX_CONCURRENCY=4`
- `stages._parse_stage_success(answer) -> bool` (первая непустая строка ровно SUCCESS)
- matching.py не тронут (rerank — таск 12)

## Из таска 13 — витрина на реестре

- `getPublicRegistry(params) -> RegistryProjectOut[]` (публичный GET /projects/registry без Authorization)
- `mergeRegistryPage/toShowcaseCard/buildPublicRegistryQuery/SHOWCASE_PAGE_SIZE=9` из `lib/landing-registry`; `ProjectsShowcase(props initialItems/initialError)`

## Из таска 12 — семантика без внешних API

- `embeddings.EMBEDDING_MODEL/EMBEDDING_DIM`, `expanded_terms(text) -> set`, `lexical_score(q, d) -> float`, `ru_stem(w) -> str`, `token_to_canonical(t, s) -> str|None`
- `matching.parse_llm_ranking(text, n) -> list|None`; `scripts.reindex_rag_embeddings.reindex_all(batch) -> int`
- миграция `0036_semantic_embeddings_reindex`; синонимический словарь техдомена (офлайн, без внешних API)

## Из таска 14 — пакет P2

- `GET /users?limit=100&offset=0` (≤1000); `GET /admin/audit?limit=200&offset=0`; `GET join-requests?limit=100&offset=0`; `GET /projects/{id}/requests?limit=100&offset=0`
- `GET /ready` → `+storage ok|unavailable`, `+clamav ok|unavailable|disabled`, 503 при unavailable
- CHECK на статусы projects/project_documents/promotion_requests/control_points; prod-guard отклоняет `change_me` пароли БД/MinIO
- миграция `0037_status_checks` поверх `0036` (порядок цепочки зафиксирован)

## Из таска 08 — гейты CI

- CI: Ruff + `scripts/udgu_ingest`, сборка backend-образа, проверка клиентских библиотек прод-зависимостей, readiness-smoke, red-gate без `continue-on-error`
- шов-тест `tests/test_ci_gates.py` (проверяет текст ci.yml)

## Из таска 17 — локаль zh

- локаль `zh` (cookie `NEXT_LOCALE`, default ru прежний); словари `src/messages/zh.json` + `messages/zh.json`, паритет EN 100%
- `translatorFor(..., "zh")` с fallback zh→EN; кнопка ZH `data-testid="locale-zh"`

## Из таска 18 — локаль hi

- локаль `hi` (cookie `NEXT_LOCALE`, default ru прежний); словари `src/messages/hi.json` + `messages/hi.json`, паритет EN 100%
- `translatorFor(..., "hi")` с fallback hi→EN; кнопка `data-testid="locale-hi`
## Из таска 19 — закрывающие гейты zh

- новых сигнатур нет; три гейта в `tests/locale-zh.test.mjs`: пины витрины, без-английский рендер 4 неймспейсов, карточка на языке ввода
- паритет zh/EN 2614/2614, BAD 0; живой curl подтвердил zh-рендер методологии/уровней/лендинга/roadmap
- прецедент: ядерные ключи переводятся, длинные технические строки остаются на EN осознанно

Швы для тестов — публичная HTTP-граница API плюс существующие гейты (`pytest`,
`npm test`, линт, сборки). Идеал — один шов: поведение проверяется через HTTP.

## Правила прогона (не выводятся из кода)

- Стек: Python FastAPI + Next.js + PostgreSQL/pgvector + MinIO/ClamAV/Redis/nginx.
- Команды: `uv run ruff check app tests infra/alerter scripts/udgu_ingest`,
  `uv run pytest -q` (только на изолированном стенде с тестовой БД),
  `npm run lint && npm test && npm run build` из `technozrelost-frontend/`.
- Не трогать без явной нужды: прод-сиды, `infra/docker-compose.prod.yml` вне своего таска.
- Зависимость отсутствует в окружении → `BLOCKED: <имя>` + причина, молча не ставить.
- Секреты — только именами в `.env.example`, никогда значениями в код/коммиты/логи.
- Работа — в изолированном worktree, ветку `main` не ломать.
- Demo-guard (демо-стенд для показа): НЕ перезапускать/останавливать `next dev :3000`, `uvicorn :8000`, docker-контейнеры; НЕ занимать их порты; миграции и сиды — только на тестовой БД; правки — аддитивно, поведение ru/en по умолчанию не меняется.
