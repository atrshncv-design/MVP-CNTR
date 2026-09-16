# Interfaces — границы и правила для исполнителей

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `backend/auth-sessions` | правила вступления в проект, жизненный цикл refresh-токенов | существующие эндпоинты membership/auth с прежними контрактами (минус доверие `shared_by`, плюс logout) | механику HMAC-ссылок и ревокаций |
| `backend/uploads` | лимитирование чтения загружаемых тел | общий лимитированный читатель (уже существует) для всех точек загрузки | детали потокового чтения/дропа |
| `frontend/access` | источник адреса API + матрица ролей маршрутов | единый модуль экспорта базового URL; карта `роль → маршруты` | способ разрешения URL (rewrites/env) |
| `infra/data-safety` | logical/physical бэкапы, WAL, слот репликации, crypt-only offsite | команды backup/restore/rehearse-pitr; маркеры свежести и offsite | расположение томов и параметры архивации |
| `infra/edge` | деплой, откаты, публикация портов, алертинг | deploy.sh с health-gate; алертер с env-конфигурацией | логику дедупликации аварий |
| `ci` | workflow обоих приложений | зелёный статус на push | — |
| `docs/customer` | техтребования к серверу, импортозамещение | два документа в `docs/` | — |

**Контракт маркера бэкапа (между 04 и 05):** после каждого успешного `backup.sh` пишется файл
по пути из env (напр. `BACKUP_FRESHNESS_MARKER`), содержимое — ISO-8601 с офсетом; отсутствие
файла или устаревание сверх порога из env = авария для алертера. Offsite-шаг при неудаче пишет
второй маркер состояния.

**Контракт URL-модуля фронта (02):** один экспорт базового пути API; браузер — относительный
путь того же origin; SSR — внутренний адрес из env; production-сборка без достаточной
конфигурации падает с понятным сообщением. Никто не импортирует адрес иначе как из этого модуля.

## Правила проекта (не выводить самостоятельно)

- Стек: backend Python 3.11+ / FastAPI / async SQLAlchemy 2.0 / alembic (миграции нумеруются после текущего head); frontend Next.js App Router / TypeScript strict / Tailwind v4.
- Команды проверки backend: `cd technozrelost-backend && uv sync --extra dev && uv run pytest -q && uv run ruff check . && uv run mypy app` — голый `uv sync` без `--extra dev` запрещён (сносит pytest).
- Команды проверки frontend: `cd technozrelost-frontend && npm run lint && npm test && npm run build`; `next build` только при остановленном dev-сервере.
- Тестам бэкенда нужен поднятый dev-postgres (`docker compose -f technozrelost-backend/infra/docker-compose.yml up -d pg-primary pg-replica`); conftest сам создаёт тестовую БД и гоняет миграции.
- Комментарии/докстринги — по-русски, объясняют «почему». ID — serial/bigserial. Индексы под реальные фильтры (Hash — точный поиск, B-Tree — диапазоны).
- Работа на ветке `autopilot/m0-security-hardening` от актуального main; push в origin после каждого таска. На main не коммитить, историю не переписывать.
- Каждый таск тем же коммитом переводит свои строки `docs/BACKLOG.md` в `done` с хешем.
- Секреты никогда не запрашивать и не записывать: только имена переменных окружения; значения из `.env*` не попадают в отчёты, логи и коммиты.
- Недостающая зависимость или доступ — верни `BLOCKED` с именем пакета/что нужно, не устанавливай молча.
- Лимит автономности — 25 итераций на задачу; зацикливание или красные тесты после двух кругов правок — стоп и отчёт.

## Швы для тестов

- Существующий pytest-сьют бэкенда (включая guard-тесты бюджета запросов и прод-гард секретов).
- Существующий node --test фронтенда (`tests/*.test.mjs`).
- Новые базовые швы — регрессионный тест покрытия матрицы маршрутов (frontend, таск 02) и guard-тест формулы пула БД (backend, таск 01); для point repair добавлен статический infra-contract guard без БД.
- Репетиция PITR (таск 04) — одноразовый исполняемый сценарий, результат фиксируется в отчёте таска.

## Что уже построено

### Из таска 01 — безопасность бэкенда

- `GET /api/v1/projects/{id}/share-sig` → `{share_sig}` — только приоритетным участникам; HMAC от jwt_secret, TTL 30 дней
- `POST /api/v1/projects/join`: тело `JoinIn {token, role_in_project, share_sig?}` — поле `shared_by` удалено и игнорируется сервером
- `POST /api/v1/auth/logout` `{refresh_token}` → 204, идемпотентен; смена пароля ревокает все refresh пользователя
- `app/core/security.py`: `sign_share_attribution(project_id, user_id)` / `verify_share_attribution(project_id, value) -> int|None`
- Конфиг пула: `db_pool_size=10`, `db_max_overflow=20`, `db_app_replicas=2`, `db_max_connections=100`, `db_connections_reserve=10`; guard-тест формулы в `tests/test_db_pool.py`

### Из таска 02 — доступ фронта

- `src/lib/public-api.ts`: `CLIENT_API_BASE` («» = тот же origin; NEXT_PUBLIC_API_URL — оверрайд) и `serverApiBase(): string` (API_URL_INTERNAL, без него throw)
- Матрица: `ROUTE_ALLOWED_ROLES: Record<string, RoleSlug[]>`; ключи с `[param]` = один сегмент; порядок объявлений = приоритет; `allowedRolesFor(path)` → null означает запрет (fail-closed); `/dashboard` — только точное совпадение
- Регрессионный обходчик маршрутов: `tests/routes-matrix.test.mjs`; проверка URL-модуля: `tests/api-url-module.test.mjs`

### Из таска 03 — документы для заказчика

- `docs/СЕРВЕР-ТРЕБОВАНИЯ.md`, `docs/ИМПОРТОЗАМЕЩЕНИЕ.md` — автономные документы; факты стека сверены с compose/pyproject

### Из таска 04 — сохранность данных

- Env для таска 05: маркер свежести `BACKUP_FRESHNESS_MARKER` (дефолт `$BACKUP_DIR/.backup-freshness`, ISO-8601 с офсетом, пишется последним шагом полного успеха); offsite-статус снапшота `BACKUP_OFFSITE_MARKER` (дефолт `.offsite-status`, формат `<ok|warn|fail> <ISO> <detail>`; warn = таргет не настроен); свежий WAL-маркер `WAL_OFFSITE_MARKER` (дефолт `.wal-offsite-status`, тот же формат, критичен старше `WAL_OFFSITE_MAX_AGE_SECONDS`); порог `BACKUP_MAX_AGE_HOURS`; расписание `BACKUP_AT` (ЧЧ:ММ) + `BACKUP_SCRIPT`; retention `BACKUP_KEEP`; offsite-таргет `BACKUP_OFFSITE_REMOTE` (rclone remote:bucket/path, remote обязан иметь `type=crypt`); physical base backup использует `REPL_USER`/`REPL_PASSWORD`
- Готовые блоки проводки в прод-compose (sidecar таймера, WAL-offsite sidecar, том wal-archive, archive-настройки db) — `technozrelost-backend/infra/RUNBOOK-DATA.md`, раздел «Подключение в прод-стеке»
- Репетиция PITR: `technozrelost-backend/scripts/rehearse_pitr.sh`, вывод прогона `technozrelost-backend/reports/pitr-rehearsal-2026-08-26.txt` (PASS)

### Из таска 05 — край контура

- `AlerterConfig.from_env() -> AlerterConfig`, проверки возвращают `CheckResult`; state JSON содержит `{active, notification_sent}` для дедупликации аварий; отдельные probes `ALERTER_MINIO_HEALTH_URL` и `ALERTER_CLAMAV_HOST`/`ALERTER_CLAMAV_PORT` входят в aggregate state
- Telegram-конфигурация только через `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`; пустые значения = безопасный warning/no-op
- `deploy.sh rollback TAG` — ручной откат; образы маркируются SHA и `previous`

### Из таска 06 — CI

- GitHub Actions: триггеры `push` и `pull_request`; jobs `backend` (pgvector service, uv/ruff/mypy/pytest) и `frontend` (npm/lint/test/build)
