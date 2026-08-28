# RUNBOOK — Сохранность данных (бэкапы / WAL-PITR / offsite)

Таски INF-01..INF-04 прогона m0-security-hardening. Владелец модуля `infra/data-safety`
(границы — `.autopilot/2026-08-26-m0-security-hardening--wip/interfaces.md`).

## Целевые показатели

> **Статус:** это целевые параметры production-конфигурации. Локальная PITR-репетиция
> подтверждает только локальный сценарий; до live offsite и production-like восстановления
> RPO/RTO не являются доказанным эксплуатационным SLA.

| Метрика | Цель | Чем обеспечивается |
|---|---|---|
| **RPO** | цель: ≤ 5 минут | Ежедневный logical pg_dump + physical pg_basebackup-снапшот, непрерывный локальный архив WAL и его offsite-синхронизация (`archive_timeout = 60s`, sidecar каждые 60 секунд); требуется production/offsite evidence |
| **RTO** | цель: ≤ 1 час | Восстановление из logical-снапшота (restore.sh) или physical base backup + PITR на чистом контейнере описано ниже; требуется production-like rehearsal |

## Компоненты

| Файл | Роль |
|---|---|
| `infra/backup.sh` | Снапшот: pg_dump + physical pg_basebackup Primary + MinIO + SHA256SUMS + crypt-only offsite (rclone) + ротация; пишет маркеры |
| `infra/backup-lock.py` | Общий non-blocking PostgreSQL advisory lock для pre-migration и scheduled backup; image-run marker не допускает дубль между репликами |
| `infra/cron/backup-timer.sh` | Ежедневный автозапуск backup.sh внутри прод-стека (замена cron, работает в любом контейнере) |
| `infra/cron/wal-offsite-sync.sh` | Непрерывная отправка WAL и timeline history-файлов на crypt remote; после успешной отправки удаляет только завершённые архивные объекты старше retention и пишет отдельный свежий маркер |
| `infra/cron/check-rclone-crypt.sh` | Общий fail-closed guard для типа remote и `no_data_encryption` |
| `infra/restore.sh` | Полное exact-восстановление БД+MinIO из снапшота (с проверкой контрольных сумм; файл также входит в backend image) |
| `infra/postgres/postgresql-pitr.conf` | Прод-профиль архивации WAL (archive_mode/command/timeout) |
| `infra/postgres/postgresql-primary.conf` | Общие настройки Primary, включая `max_slot_wal_keep_size = 15GB` |
| `scripts/rehearse_pitr.sh` | Репетиция PITR на одноразовых контейнерах; отчёты в `reports/pitr-rehearsal-*.txt` |

## Контракт маркеров для алертера

| Маркер | Env с путём (по умолчанию) | Формат содержимого | Авария |
|---|---|---|---|
| Свежесть бэкапа | `BACKUP_FRESHNESS_MARKER` (`<BACKUP_DIR>/.backup-freshness`) | одна строка ISO-8601 UTC с офсетом, напр. `2026-08-26T03:15:02+00:00` | файла нет ИЛИ возраст > `BACKUP_MAX_AGE_HOURS` (красный) |
| Статус offsite | `BACKUP_OFFSITE_MARKER` (`<BACKUP_DIR>/.offsite-status`) | `<status> <ISO-8601> <detail>`; status ∈ `ok` \| `warn` \| `fail` | `fail` — красный; `warn` (таргет не настроен) — жёлтый; файла нет — красный |
| Свежесть offsite WAL | `WAL_OFFSITE_MARKER` (`<BACKUP_DIR>/.wal-offsite-status`) | `<status> <ISO-8601> <detail>`; status ∈ `ok` \| `warn` \| `fail`; до первого сегмента — `warn ... no-wal` | `fail`, отсутствие или возраст > `WAL_OFFSITE_MAX_AGE_SECONDS` — красный; `warn` — жёлтый |

Маркер свежести пишется строго последним шагом backup.sh: его наличие = полный
успех локальных стадий (logical dump, physical base backup, MinIO, суммы,
ротация). Offsite имеет отдельный маркер и может быть недоступен, не отменяя
локальный снапшот. Если заданный offsite target не является crypt remote,
копирование не выполняется, пишется `fail`, а локальный снапшот сохраняется для
разбора и восстановления.

Перед миграциями backend запускает `backup-lock.py` с тем же non-blocking lock,
что и scheduled timer. Compose передаёт `BACKUP_RUN_ID` из `IMAGE_TAG` и общий
`BACKUP_PRE_MIGRATION_MARKER`; после успешного backup marker атомарно содержит
текущий image run. Поэтому вторая backend-реплика, стартовавшая позже первой,
пропускает уже выполненный backup, а при новом image tag выполняется новый
pre-migration backup.

## Переменные окружения (значения — только через .env.production, не коммитить)

| Переменная | Назначение |
|---|---|
| `BACKUP_AT` | время ежедневного запуска `ЧЧ:ММ` (TZ контейнера таймера; задаётся TZ=UTC), по умолчанию `03:15` |
| `BACKUP_KEEP` | retention: сколько локальных снапшотов хранить (по умолчанию 14) |
| `BACKUP_FRESHNESS_MARKER` / `BACKUP_OFFSITE_MARKER` | пути маркеров (см. контракт выше) |
| `WAL_OFFSITE_MARKER` / `WAL_OFFSITE_INTERVAL_SECONDS` / `WAL_OFFSITE_MAX_AGE_SECONDS` | маркер, период синхронизации WAL и допустимый возраст (по умолчанию 60 / 300 секунд) |
| `WAL_ARCHIVE_KEEP_DAYS` | положительное число суток хранения локальных WAL и timeline history-файлов после успешной отправки (по умолчанию 7) |
| `BACKUP_MAX_AGE_HOURS` | порог свежести для алертера (рекомендуется 25) |
| `BACKUP_OFFSITE_REMOTE` | только `type=crypt` remote с путём `remote:bucket/path`; storage remote настраивается отдельно, пусто = offsite выключен (warn) |
| `REPL_USER`, `REPL_PASSWORD` | учётные данные роли PostgreSQL с `REPLICATION` для physical `pg_basebackup`; пароль обязателен для успешного снапшота |
| `RCLONE_CONFIG` | путь к конфигурации rclone; в production — `/rclone-config/rclone.conf` из read-only volume |
| `PG_CONTAINER`, `POSTGRES_*`, `MINIO_*` | как прежде (см. шапку backup.sh) |

## Подключение в прод-стеке (задача таска 05)

1. **Таймер бэкапов** — sidecar-сервис рядом с backend:

```yaml
  backup-timer:
    image: <тот же образ, что у сервиса backend>
    restart: unless-stopped
    depends_on:
      - db
    environment:
      TZ: UTC
      BACKUP_AT: "03:15"
      BACKUP_SCRIPT: /app/backup.sh
      BACKUP_LOCK_SCRIPT: /usr/local/bin/tz-backup-lock.py
      POSTGRES_HOST: db            # остальное POSTGRES_*/MINIO_* — из .env.production
      BACKUP_FRESHNESS_MARKER: /backups/.backup-freshness
      BACKUP_OFFSITE_MARKER: /backups/.offsite-status
      BACKUP_STRICT_MINIO: "1"
      BACKUP_OFFSITE_REMOTE: ${BACKUP_OFFSITE_REMOTE:-}
      RCLONE_CONFIG: /rclone-config/rclone.conf
      REPL_USER: ${REPL_USER:-replicator}
      REPL_PASSWORD: ${REPL_PASSWORD}
    volumes:
      - backups-prod-data:/backups
      - rclone-config-prod:/rclone-config:ro
```

2. **Непрерывная offsite-синхронизация WAL** — отдельный sidecar с тем же
   образом backend:

```yaml
  wal-offsite:
    command: ["/bin/sh", "/app/infra/cron/wal-offsite-sync.sh"]
    environment:
      WAL_ARCHIVE_DIR: /wal-archive
      WAL_OFFSITE_MARKER: /backups/.wal-offsite-status
      WAL_OFFSITE_INTERVAL_SECONDS: 60
      WAL_ARCHIVE_KEEP_DAYS: 7
      BACKUP_OFFSITE_REMOTE: ${BACKUP_OFFSITE_REMOTE:-}
      RCLONE_CONFIG: /rclone-config/rclone.conf
    volumes:
      - wal-archive-prod-data:/wal-archive:rw
      - backups-prod-data:/backups
      - rclone-config-prod:/rclone-config:ro
```

3. **Архивация WAL на сервисе `db`** — отдельный том и PITR-профиль:

```yaml
  db:
    volumes:
      - wal-archive-prod-data:/var/lib/postgresql/wal-archive   # ОТДЕЛЬНЫЙ том
      - ./postgres/postgresql-pitr.conf:/etc/postgresql/postgresql-pitr.conf:ro
# volumes:
#   wal-archive-prod-data:
#   rclone-config-prod:
```

В production compose используется `alerter/postgres-primary-entrypoint.sh`: он
подключает `postgresql-primary.conf` и `postgresql-pitr.conf` через временный
агрегирующий `config_file`, потому что существующий `start-primary.sh` фиксирует
только базовый файл и игнорирует аргументы Compose. Значения остаются в
`postgres/postgresql-pitr.conf` как источнике истины и проверены репетицией PITR
на том же образе.

Production Compose использует `172.30.0.0/24` и монтирует только
`postgres/pg_hba.conf`: streaming replication доступен только роли `replicator`,
а app-подключения используют `scram-sha-256` из этого точного диапазона.
Docker Desktop gateway в production HBA отсутствует.

Dev Compose использует отдельный `172.31.0.0/24` в сети `tz-dev-network` и
монтирует только `postgres/pg_hba.dev.conf`. Помимо fixed dev CIDR он содержит
ограниченное `scram-sha-256` правило `192.168.65.0/24`: Docker Desktop for Mac
показывает подключение с host к опубликованному PostgreSQL-порту как gateway
`192.168.65.1`. Это исключение нужно для local pytest через `localhost`; оно не
разрешает `0.0.0.0/0`, не использует `trust` и никогда не монтируется в
production.

Существующую сеть `technozrelost-infra_default` с прежним CIDR не
переиспользовать. Из `technozrelost-backend/` безопасный переход на новую dev
сеть выполняется без удаления данных:

```bash
docker compose -f infra/docker-compose.yml up -d --force-recreate pg-primary pg-replica
```

Не используйте `down -v` и не удаляйте named volumes или Docker images. При
изменении subnet обновляйте соответствующий HBA-файл и Compose одновременно.

## Процедуры

### P1. Ручной бэкап (вне расписания)
```bash
docker exec <backend-контейнер> python /app/infra/backup-lock.py /app/backup.sh  # в проде
# либо с хоста: BACKUP_DIR=/path PG_CONTAINER=<primary> sh infra/backup.sh
cat $BACKUP_DIR/.backup-freshness                              # проверить маркер
test -s <BACKUP_DIR>/<UTC-TIMESTAMP>/pg_basebackup/PG_VERSION  # проверить physical base
```

`backup.sh` сначала создаёт logical `pg_primary_*.dump`, затем обязательный
`pg_basebackup` в `pg_basebackup/` ролью `REPL_USER`. При отсутствии
`pg_basebackup` или `REPL_PASSWORD` снапшот удаляется и маркер свежести не
обновляется. `pg_dump`, MinIO, SHA256SUMS и offsite-шаг при этом сохраняются.

### P2. Полное восстановление (гибель данных Primary)
1. Выполнять команды из `technozrelost-backend/infra/`, где доступен
   `.env.production`; не использовать production-дефолты `localhost` из
   host-only режима `restore.sh`.
2. Остановить запись и все две API-реплики через Compose service:
   `docker compose --env-file .env.production -f docker-compose.prod.yml
   stop backend backup-timer wal-offsite alerter frontend nginx`.
3. Выбрать снапшот в named volume (`/backups/<UTC-TIMESTAMP>`) или подключить
   host-каталог read-only к one-off контейнеру. Restore нужно запускать внутри
   той же Compose-сети, чтобы `db` и `minio` разрешались по именам сервисов:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml run \
     --rm --no-deps -T --entrypoint /app/restore.sh \
     -e RESTORE_CONFIRM=1 backend /backups/<UTC-TIMESTAMP>
   ```
   Если snapshot находится на host, добавьте `-v
   /secure/snapshot:/restore-snapshot:ro` и передайте `/restore-snapshot`.
   Суммы проверяются до любого изменения данных.
4. Поднять остановленные сервисы командой `docker compose ... up -d backend
   backup-timer wal-offsite alerter frontend nginx`, проверить `/api/v1/health`
   и свежесть данных.
Локальный ориентир времени: минуты (размер дампа ~десятки МБ); production RTO нужно
измерить отдельно на фактическом объёме и целевой capacity.

`restore.sh` намеренно применяет logical `pg_primary_*.dump` к уже выбранной
БД. MinIO restore сначала создаёт отсутствующий бакет, затем применяет exact
semantics: удаляет объекты, которых нет в snapshot, и загружает snapshot (в том
числе пустой каталог). Каталог `pg_basebackup/` он не копирует в живой `PGDATA`: для PITR используйте
процедуру P3 на чистом кластере, чтобы не перезаписать работающий Primary.

### P3. PITR — восстановление на момент времени (потеря последних минут)
Предпосылка: жив том `wal-archive-prod-data` (или скачанный с offsite каталог
`wal-archive/`) и каталог `<snapshot>/pg_basebackup/`, созданный `backup.sh` ДО
целевого момента. Сначала
проверить, что каталог действительно является physical base backup:
```bash
BASE_BACKUP=<BACKUP_DIR>/<UTC-TIMESTAMP>/pg_basebackup
test -s "$BASE_BACKUP/PG_VERSION"
```
Не используйте для PITR logical `pg_primary_*.dump` и не снимайте базу ролью
приложения: production backup использует `REPL_USER`/`REPL_PASSWORD`.
Шаги восстановления (именно их автоматизирует `scripts/rehearse_pitr.sh`):
1. Подготовить новый чистый каталог PGDATA и скопировать туда
   `pg_basebackup/`, дописать в конец
   `postgresql.conf`:
   ```
   restore_command = 'cp /var/lib/postgresql/wal-archive/%f %p'
   recovery_target_time = '<целевой момент из журнала приложения>'
   recovery_target_action = 'promote'
   ```
2. `touch <копия>/recovery.signal`.
3. Поднять чистый контейнер postgres с этой копией как PGDATA и тем же
   томом/каталогом архива WAL (см. rehearse_pitr.sh, шаги 5–7).
4. Дождаться выхода из recovery (`SELECT pg_is_in_recovery()` → f),
   сверить данные, переключить трафик.

Репетиция всей цепочки одной командой (прод не затрагивает):
```bash
bash scripts/rehearse_pitr.sh   # отчёт: reports/pitr-rehearsal-YYYY-MM-DD.txt
```
Последний локальный результат: PASS 2026-08-26 (строка «до» цели восстановлена
из WAL, строка «после» отсутствует). Он не подтверждает production/offsite RPO/RTO.
Репетировать при каждом изменении конфига БД или образа postgres и отдельно
протоколировать production-like восстановление.

### P5. Проверка алертера

Самопроверка алертера не обращается к сети и не требует Telegram:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm \
  --no-deps alerter python /app/infra/alerter/alerter.py --self-check
```

Проверить журнал работающего сервиса и marker-контракт:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 alerter
docker compose --env-file .env.production -f docker-compose.prod.yml exec alerter \
  cat /backups/.backup-freshness
```

### P4. Настройка offsite (выполняет владелец после выбора хранилища)
Если `BACKUP_OFFSITE_REMOTE` пуст, этот шаг не нужен: backup пишет `warn`, а
deploy не требует config volume. При заданном remote:
1. На защищённой машине создать storage remote и отдельный remote типа `crypt`,
   который оборачивает нужный путь storage remote. В `BACKUP_OFFSITE_REMOTE`
   указывать только crypt remote; обычный storage remote backup.sh отвергнет.
   Не включать truthy `no_data_encryption` (`true`, `1`, `yes`, `on` в любом
   регистре); файл не хранить в репозитории.
2. Создать named volume и загрузить config без вывода содержимого:

   ```bash
   docker volume create tz-prod-rclone-config
   docker run --rm -i --mount type=volume,src=tz-prod-rclone-config,dst=/config \
     alpine:3.20 sh -c 'umask 077; cat > /config/rclone.conf' \
     < /secure/path/rclone.conf
   ```

3. Прописать `BACKUP_OFFSITE_REMOTE=<crypt-remote>:<path>` в
   `.env.production` и перезапустить `backup-timer` и `wal-offsite`; их
   healthcheck проверит `rclone`, config и тип remote.
4. После очередного бэкапа проверить: `<BACKUP_DIR>/.offsite-status`
   начинается с `ok`, а `<BACKUP_DIR>/.wal-offsite-status` обновляется не реже
   `WAL_OFFSITE_MAX_AGE_SECONDS`. До настройки remote оба маркера могут давать
   ожидаемый жёлтый `warn`.

При восстановлении после гибели сервера сначала скачать снапшот и WAL-архив из
crypt remote на новый сервер, затем выполнять P2/P3:

```bash
REMOTE="<crypt-remote>:<path>"
TS="<UTC-TIMESTAMP>"
mkdir -p "<BACKUP_DIR>/$TS" "<BACKUP_DIR>/wal-archive"
rclone --config /secure/path/rclone.conf copy "$REMOTE/$TS" "<BACKUP_DIR>/$TS"
rclone --config /secure/path/rclone.conf copy "$REMOTE/wal-archive" "<BACKUP_DIR>/wal-archive"
```

Для P3 используйте скачанный `<BACKUP_DIR>/wal-archive` в `restore_command` вместо
локального `/var/lib/postgresql/wal-archive`.

### P5. Диагностика архивации WAL
```bash
docker exec db psql -U technoz -d technozrelost -c \
  'SELECT archived_count, failed_count, last_archived_wal, last_failed_wal FROM pg_stat_archiver'
docker exec db psql -U technoz -d technozrelost -c \
  "SELECT slot_name, active, wal_status FROM pg_replication_slots"   # wal_status=unreserved после лимита — норма
```
Растущий `failed_count` = переполнение диска с архивом или потеря каталога —
чинить немедленно, это прямой риск RPO.
