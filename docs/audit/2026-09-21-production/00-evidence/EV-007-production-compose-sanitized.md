# EV-007 — production compose: санитизированный config (без values)

- Дата: UTC 2026-09-21T16:49–16:52Z / локально 2026-09-21 20:49–20:52 +0400 / сервер UTC
- Target: `root@213.139.209.165`, проект `technozrelost-prod`,
  working_dir `~/MVP-CNTR/technozrelost-backend/infra`,
  config `infra/docker-compose.prod.yml`, env-file `infra/.env.production`
  (имя файла; содержимое `.env`/credential stores не читалось)
- Команды (read-only, значения никогда не передавались и не сохранялись):
  `docker compose --env-file .env.production -f docker-compose.prod.yml config --no-interpolate`
  (структура/образы); интерполированный `config` piped server-side в awk-редактор,
  печатающий только `service KEY=set|empty`; `docker inspect tz-prod-backend`
  (только labels `project/config_files/environment_file/config-hash`)
- Exit: 0 (редактированный вывод). Прямой `config` без `--env-file` завершается
  требованием `REPL_PASSWORD` — факт метода, поэтому использован `--env-file`
  + серверная маскировка, а не чтение `.env`.

## Структура (без значений)

- Top-level записей в `--no-interpolate`: 25 (12 сервисов + volumes/networks).
- Сервисы (12): `alerter`, `backend`, `backup-timer`, `clamav`, `db`, `frontend`,
  `grafana`, `minio`, `nginx`, `prometheus`, `redis`, `wal-offsite`.
- Container names: `tz-prod-backend`, `tz-prod-frontend`, `tz-prod-db-primary`,
  `tz-prod-redis`, `tz-prod-minio`, `tz-prod-clamav`, `tz-prod-nginx`,
  `tz-prod-grafana`, `tz-prod-prometheus` (+ `backup-timer`/`wal-offsite`/`alerter`
  в проекте `technozrelost-prod`); `restart: unless-stopped` (12/12).
- Образы (`--no-interpolate`, без тегов сборки приложения как значений):
  `technozrelost-backend:${IMAGE_TAG:-local}` (×4 сервиса),
  `technozrelost-frontend:${IMAGE_TAG:-local}` (×1),
  `pgvector/pgvector:0.8.0-pg16`, `redis:7-alpine`, `nginx:1.27-alpine`,
  `grafana/grafana:11.2.0`, `prom/prometheus:v2.54.1`,
  `quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z@sha256:…`,
  `clamav/clamav:1.4.3@sha256:…` (digests обрезаны — не секреты, но и не нужны).
- Compose labels (факт deployment): `project=technozrelost-prod`,
  `config_files=…/infra/docker-compose.prod.yml`,
  `environment_file=…/infra/.env.production`,
  `config-hash=3ec4b7d09b72764ece2f72be59068d36d69af2e3f68f38a205415e7710e62e77`.

## Ключи окружения: только name + set/empty (всего 108)

- Покрытие: `backend` 37, `alerter` 24, `backup-timer` 24, `wal-offsite` 8,
  `db` 5, `grafana` 4, `frontend` 3, `minio` 2, `redis` 1. Set=103, empty=5.
- Empty (факт, не вывод): `backend: BACKUP_OFFSITE_REMOTE, OPENCODE_API_KEY,
  OPENCODE_ZEN_API_KEY`; `backup-timer: BACKUP_OFFSITE_REMOTE`;
  `wal-offsite: BACKUP_OFFSITE_REMOTE`.
- `backend=set`: APP_ENV, BACKUP_BEFORE_MIGRATIONS, BACKUP_FRESHNESS_MARKER,
  BACKUP_KEEP, BACKUP_LOCK_SCRIPT, BACKUP_OFFSITE_MARKER, BACKUP_PRE_MIGRATION_MARKER,
  BACKUP_RUN_ID, BACKUP_STRICT_MINIO, CLAMAV_ENABLED, CLAMAV_HOST, CLAMAV_PORT,
  CORS_ORIGINS, JWT_SECRET, LLM_API_BASE, LLM_API_KEY, LLM_GATEWAY_ENABLED, LLM_MODEL,
  MC_HOST_URL_SCRIPT, MINIO_ACCESS_KEY, MINIO_BUCKET, MINIO_ENDPOINT, MINIO_SECRET_KEY,
  POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER,
  RCLONE_CONFIG, RCLONE_GUARD_SCRIPT, REDIS_PASSWORD, REDIS_URL, REPL_PASSWORD, REPL_USER.
- `alerter=set` (24): ALERTER_CLAMAV_HOST, ALERTER_CLAMAV_PORT,
  ALERTER_DISK_CRITICAL_PERCENT, ALERTER_DISK_PATHS, ALERTER_DISK_WARN_PERCENT,
  ALERTER_INTERVAL_SECONDS, ALERTER_MINIO_HEALTH_URL, ALERTER_PROBE_TIMEOUT_SECONDS,
  ALERTER_READINESS_URL, ALERTER_STATE_FILE, BACKUP_FRESHNESS_MARKER,
  BACKUP_MAX_AGE_HOURS, BACKUP_OFFSITE_MARKER, POSTGRES_DB, POSTGRES_HOST,
  POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER, TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID, WAL_ARCHIVE_DIR, WAL_ARCHIVE_MAX_AGE_SECONDS,
  WAL_OFFSITE_MARKER, WAL_OFFSITE_MAX_AGE_SECONDS.
- `backup-timer=set` (23): BACKUP_AT, BACKUP_DIR, BACKUP_FRESHNESS_MARKER,
  BACKUP_KEEP, BACKUP_LOCK_SCRIPT, BACKUP_OFFSITE_MARKER, BACKUP_SCRIPT,
  BACKUP_STRICT_MINIO, MC_HOST_URL_SCRIPT, MINIO_ACCESS_KEY, MINIO_BUCKET,
  MINIO_ENDPOINT, MINIO_SECRET_KEY, POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD,
  POSTGRES_PORT, POSTGRES_USER, RCLONE_CONFIG, RCLONE_GUARD_SCRIPT,
  REPL_PASSWORD, REPL_USER, TZ.
- `wal-offsite=set` (7): BACKUP_DIR, CHECK_RCLONE_SCRIPT, RCLONE_CONFIG,
  WAL_ARCHIVE_DIR, WAL_ARCHIVE_KEEP_DAYS, WAL_OFFSITE_INTERVAL_SECONDS,
  WAL_OFFSITE_MARKER.
- `db=set` (5): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REPL_PASSWORD,
  REPL_USER. `frontend=set` (3): API_URL_INTERNAL, NEXTAUTH_SECRET, NEXTAUTH_URL.
- `grafana=set` (4): GF_AUTH_ANONYMOUS_ENABLED, GF_SECURITY_ADMIN_PASSWORD,
  GF_SECURITY_ADMIN_USER, GF_USERS_ALLOW_SIGN_UP.
- `minio=set` (2): MINIO_ROOT_PASSWORD, MINIO_ROOT_USER.
- `redis=set` (1): REDIS_PASSWORD.
- Значения env нигде не сохранялись; имена выше — не секреты, статусы —
  факт резолва compose на момент замера.

## Связь со spec

- R06 (вторая половина blocking condition 01): санитизированный `compose config`
  без environment values + ключи как `name + set/empty` — закрыто этим файлом.
- Решения 2, 6 (read-only, без чтения `.env`/keys, протокол evidence); Решение 7:
  всё ниже — deployed-факт, не static.
- Ссылки: `01-environments.md` (Production config); findings — нет (факт, не дефект).
