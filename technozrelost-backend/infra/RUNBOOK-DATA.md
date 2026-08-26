# RUNBOOK — Сохранность данных (бэкапы / WAL-PITR / offsite)

Таски INF-01..INF-04 прогона m0-security-hardening. Владелец модуля `infra/data-safety`
(границы — `.autopilot/2026-08-26-m0-security-hardening--wip/interfaces.md`).

## Целевые показатели

| Метрика | Цель | Чем обеспечивается |
|---|---|---|
| **RPO** | ≤ 5 минут | Ежедневный pg_dump-снапшот + непрерывный архив WAL (`archive_timeout = 60s` ⇒ сегмент закрывается минимум раз в минуту) |
| **RTO** | ≤ 1 час | Восстановление из снапшота (restore.sh) или PITR на чистом контейнере — обе процедуры отрепетированы и пошагово описаны ниже |

## Компоненты

| Файл | Роль |
|---|---|
| `infra/backup.sh` | Снапшот: pg_dump Primary + MinIO + SHA256SUMS + offsite (rclone) + ротация; пишет маркеры |
| `infra/cron/backup-timer.sh` | Ежедневный автозапуск backup.sh внутри прод-стека (замена cron, работает в любом контейнере) |
| `infra/restore.sh` | Полное восстановление БД+MinIO из снапшота (с проверкой контрольных сумм) |
| `infra/postgres/postgresql-pitr.conf` | Прод-профиль архивации WAL (archive_mode/command/timeout) |
| `infra/postgres/postgresql-primary.conf` | Общие настройки Primary, включая `max_slot_wal_keep_size = 15GB` |
| `scripts/rehearse_pitr.sh` | Репетиция PITR на одноразовых контейнерах; отчёты в `reports/pitr-rehearsal-*.txt` |

## Контракт маркеров для алертера

| Маркер | Env с путём (по умолчанию) | Формат содержимого | Авария |
|---|---|---|---|
| Свежесть бэкапа | `BACKUP_FRESHNESS_MARKER` (`<BACKUP_DIR>/.backup-freshness`) | одна строка ISO-8601 UTC с офсетом, напр. `2026-08-26T03:15:02+00:00` | файла нет ИЛИ возраст > `BACKUP_MAX_AGE_HOURS` (красный) |
| Статус offsite | `BACKUP_OFFSITE_MARKER` (`<BACKUP_DIR>/.offsite-status`) | `<status> <ISO-8601> <detail>`; status ∈ `ok` \| `warn` \| `fail` | `fail` — красный; `warn` (таргет не настроен) — жёлтый; файла нет — красный |

Маркер свежести пишется строго последним шагом backup.sh: его наличие = полный
успех всех стадий (дамп, MinIO, суммы, offsite, ротация).

## Переменные окружения (значения — только через .env.production, не коммитить)

| Переменная | Назначение |
|---|---|
| `BACKUP_AT` | время ежедневного запуска `ЧЧ:ММ` (TZ контейнера таймера; задаётся TZ=UTC), по умолчанию `03:15` |
| `BACKUP_KEEP` | retention: сколько локальных снапшотов хранить (по умолчанию 14) |
| `BACKUP_FRESHNESS_MARKER` / `BACKUP_OFFSITE_MARKER` | пути маркеров (см. контракт выше) |
| `BACKUP_MAX_AGE_HOURS` | порог свежести для алертера (рекомендуется 25) |
| `BACKUP_OFFSITE_REMOTE` | полный rclone-таргет назначения `remote:bucket/path`; пусто = offsite выключен (warn) |
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
      BACKUP_SCRIPT: /app/infra/backup.sh
      POSTGRES_HOST: db            # остальное POSTGRES_*/MINIO_* — из .env.production
      BACKUP_FRESHNESS_MARKER: /backups/.backup-freshness
      BACKUP_OFFSITE_MARKER: /backups/.offsite-status
      BACKUP_OFFSITE_REMOTE: ${BACKUP_OFFSITE_REMOTE:-}
    volumes:
      - backups-prod-data:/backups
      - ./infra:/app/infra:ro      # если ещё не смонтирован целиком
```

2. **Архивация WAL на сервисе `db`** — том под архив + три параметра:

```yaml
  db:
    volumes:
      - wal-archive-prod-data:/var/lib/postgresql/wal-archive   # ОТДЕЛЬНЫЙ том
    command: >
      postgres
      -c config_file=/etc/postgresql/postgresql-primary.conf
      -c hba_file=/etc/postgresql/pg_hba.conf
      -c archive_mode=on
      -c 'archive_command=test ! -f /var/lib/postgresql/wal-archive/%f && cp %p /var/lib/postgresql/wal-archive/%f'
      -c archive_timeout=60s
# volumes: wal-archive-prod-data:
```

Значения совпадают с `postgres/postgresql-pitr.conf` (файл — источник истины,
можно монтировать его и подключать через `-c config_file` агрегатором).
Настройки проверены репетицией PITR на том же образе.

## Процедуры

### P1. Ручной бэкап (вне расписания)
```bash
docker exec <backend-контейнер> /app/infra/backup.sh          # в проде
# либо с хоста: BACKUP_DIR=/path PG_CONTAINER=<primary> sh infra/backup.sh
cat $BACKUP_DIR/.backup-freshness                              # проверить маркер
```

### P2. Полное восстановление (гибель данных Primary)
1. Остановить запись: `docker stop backend` (обе реплики API).
2. Выбрать снапшот: `ls <BACKUP_DIR>`.
3. `RESTORE_SNAPSHOT=<dir> RESTORE_CONFIRM=1 sh infra/restore.sh`
   (суммы проверяются автоматически до применения).
4. Поднять backend, проверить `/api/v1/health` и свежесть данных.
Ориентир времени: минуты (размер дампа ~десятки МБ).

### P3. PITR — восстановление на момент времени (потеря последних минут)
Предпосылка: жив том `wal-archive-prod-data` и последний base-backup
(`pg_basebackup`) ДО целевого момента. Если базового нет — сначала снять:
```bash
docker exec db pg_basebackup -h localhost -U technoz -D /tmp/basebk -Fp -X stream
```
Шаги восстановления (именно их автоматизирует `scripts/rehearse_pitr.sh`):
1. Подготовить каталог копии: скопировать base-backup, дописать в конец
   `postgresql.conf`:
   ```
   restore_command = 'cp /var/lib/postgresql/wal-archive/%f %p'
   recovery_target_time = '<целевой момент из журнала приложения>'
   recovery_target_action = 'promote'
   ```
2. `touch <копия>/recovery.signal`.
3. Поднять чистый контейнер postgres с этой копией как PGDATA и тем же
   томом архива WAL (см. rehearse_pitr.sh, шаги 5–7).
4. Дождаться выхода из recovery (`SELECT pg_is_in_recovery()` → f),
   сверить данные, переключить трафик.

Репетиция всей цепочки одной командой (прод не затрагивает):
```bash
bash scripts/rehearse_pitr.sh   # отчёт: reports/pitr-rehearsal-YYYY-MM-DD.txt
```
Последний результат: PASS 2026-08-26 (строка «до» цели восстановлена из WAL,
строка «после» отсутствует). Репетировать при каждом изменении конфига БД
или образа postgres.

### P4. Настройка offsite (выполняет владелец после выбора хранилища)
1. На хосте: `rclone config create <remote> <provider> ...` (S3/любой
   rclone-бэкенд); секреты — в env хоста, не в репозитории.
2. Прописать `BACKUP_OFFSITE_REMOTE=<remote>:<bucket>/tz-backups` в
   `.env.production` и перезапустить стек.
3. После очередного бэкапа проверить: `<BACKUP_DIR>/.offsite-status`
   начинается с `ok`. До этого алертер горит жёлтым (warn) — это ожидаемо.

### P5. Диагностика архивации WAL
```bash
docker exec db psql -U technoz -d technozrelost -c \
  'SELECT archived_count, failed_count, last_archived_wal, last_failed_wal FROM pg_stat_archiver'
docker exec db psql -U technoz -d technozrelost -c \
  "SELECT slot_name, active, wal_status FROM pg_replication_slots"   # wal_status=unreserved после лимита — норма
```
Растущий `failed_count` = переполнение диска с архивом или потеря каталога —
чинить немедленно, это прямой риск RPO.
