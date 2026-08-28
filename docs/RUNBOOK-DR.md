# RUNBOOK-DR — Восстановление после гибели хоста (SPOF) и окно техработ

**Владелец:** `infra` (тикет 05, INF-13). Границы — `technozrelost-backend/infra/docker-compose.prod.yml`, `nginx/nginx.prod.conf:41`, `docs/RUNBOOK-DR.md`, `technozrelost-backend/app/api/v1/nioktr.py`.

> **Ограничение пилота:** весь прод-стек работает на **единственном Docker-хосте**.
> Реплика `db-replica` защищает лишь от падения контейнера/процесса `db`, но **не**
> от гибели хоста/диска. До появления второго хоста/внешних снапшотов томов RPO/RTO
> обеспечиваются только локальными бэкапами + непрерывным WAL-архивом и их
> offsite-копией (crypt rclone). Требуется внешний регулярный снапшот томов
> гипервизора — договориться отдельно.

| Метрика | Цель | Чем обеспечивается (см. `infra/RUNBOOK-DATA.md`) |
|---|---|---|
| **RPO** | ≤ 5 минут | `archive_timeout = 60s` + `wal-offsite` каждые 60с, daily `pg_basebackup` + `pg_dump` |
| **RTO** | ≤ 1 час | Процедура ниже (stop → чистая БД → restore → start); локально минуты, прод — измерить |

## 0. Окно техработ и хотфиксов (интервью 28-)

Пилот — B2B/B2G без 24/7 SLA, но с живыми данными НИОКТР/проектов.

- **Плановое окно:** `02:00–04:00 GMT+4` (Asia/Dushanbe) ежедневно. В окно разрешены
  деплои (`./deploy.sh`), миграции `alembic upgrade head`, перезапуски стека,
  `restore.sh` и PITR на чистом кластере. Вне окна — только `hotfix` по решению
  CTO (критичный баг безопасности/потеря данных).
- **Hotfix вне окна:** объявляется как `hotfix: 28-<дата> <причина>` (ссылка на
  интервью файл `28-техработы-с-хотфиксом.md`), проходит тот же DR-чек
  `stop→чистая БД→restore→start` на стейдже, затем `deploy.sh` с тегом `hotfix-*`
  и health-gate `HEALTH_SERVICES`. Откат — `deploy.sh rollback previous`.
- **Уведомление:** за 24ч до окна — в Telegram-чат алертера (если настроен).

## 1. Предпосылки

- Команды выполнять из `technozrelost-backend/infra/`, где лежит `.env.production`
  (не использовать дефолты `localhost` из host-only режима `restore.sh`).
- Снапшот — каталог `<BACKUP_DIR>/<UTC-TIMESTAMP>` из `backups-prod-data`
  (`/backups/<TS>`) с файлами `pg_primary_*.dump`, `pg_basebackup/PG_VERSION`,
  `minio/`, `SHA256SUMS`. До гибели — скачан с offsite crypt remote:
  ```bash
  REMOTE="<crypt-remote>:<path>"   # BACKUP_OFFSITE_REMOTE
  TS="<UTC-TIMESTAMP>"
  mkdir -p "<BACKUP_DIR>/$TS" "<BACKUP_DIR>/wal-archive"
  rclone --config /secure/path/rclone.conf copy "$REMOTE/$TS" "<BACKUP_DIR>/$TS"
  rclone --config /secure/path/rclone.conf copy "$REMOTE/wal-archive" "<BACKUP_DIR>/wal-archive"
  ```

## 2. DR-процедура: stop → чистая БД → restore → start (`restore.sh`)

Полное exact-восстановление БД+MinIO из снапшота (проверка контрольных сумм **до**
любой записи; MinIO exact — удаляет объекты вне снапшота, включая пустой каталог).

```bash
cd technozrelost-backend/infra

# 1. Остановить запись и все зависимые сервисы (SPOF — хост один, трафик стоп)
docker compose --env-file .env.production -f docker-compose.prod.yml \
  stop backend backup-timer wal-offsite alerter frontend nginx

# 2. Остановить БД и подготовить ЧИСТУЮ БД для restore
#    ВНИМАНИЕ: `down -v` удалит и backups-prod-data — НЕ использовать.
#    Удаляем только тома данных PostgreSQL:
docker compose --env-file .env.production -f docker-compose.prod.yml stop db db-replica
docker volume rm technozrelost-prod_pg-prod-primary-data technozrelost-prod_pg-prod-replica-data
# (имена — из `docker volume ls`; прод-сеть 172.30.0.0/24 сохранится)

# Поднять пустые Primary/Replica (healthcheck pg_is_in_recovery + streaming)
docker compose --env-file .env.production -f docker-compose.prod.yml up -d db db-replica
# дождаться healthy (до 30с):
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# 3. Restore — внутри compose-сети, чтобы `db`/`minio` резолвились по именам
#    Снапшот — из named volume /backups или с host (см. -v ниже)
docker compose --env-file .env.production -f docker-compose.prod.yml run \
  --rm --no-deps -T --entrypoint /app/restore.sh \
  -e RESTORE_CONFIRM=1 backend /backups/<UTC-TIMESTAMP>
# Если снапшот на host: добавить -v /secure/snapshot:/restore-snapshot:ro и /restore-snapshot

# 4. Поднять остановленный стек
docker compose --env-file .env.production -f docker-compose.prod.yml \
  up -d backend backup-timer wal-offsite alerter frontend nginx

# 5. Проверки
curl -sk https://localhost/api/v1/health          # liveness 200
curl -sk https://localhost/api/v1/ready           # readiness 200 (Primary+Replica)
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 alerter
cat /backups/.backup-freshness                    # ISO-8601 с офсетом, возраст < 25ч
```

`pg_basebackup/` из снапшота этим скриптом намеренно **не** копируется в живой
`PGDATA`: для PITR используйте процедуру P3 из `infra/RUNBOOK-DATA.md` на чистом
кластере с `restore_command = 'cp /var/lib/postgresql/wal-archive/%f %p'`.

## 3. Инфра-лимиты и логи (INF-08/09)

- `deploy.resources.limits`: `backend` `1cpu/2G` (×2 реплики), `clamav` `2cpu/4G`
  — хост не кладётся прожорливым контейнером, `docker compose config` валиден.
- `logging` `max-size 10m` `max-file 3` (json-file) на всех 13 сервисах
  прод-контура — диск не распухает, `nginx -t` зелёный.

## 4. Nginx hardening (INF-12) и rate limit реестров (N-18)

- `resolver 127.0.0.11 valid=10s` + `set $backend / $frontend` + `proxy_pass http://$backend`
  — рестарт реплик не даёт 502 без reload.
- `limit_req zone=auth burst=10 nodelay` на `/api/v1/auth/` (INF-12) и
  `zone=registry burst=100` на `/api/v1/` (N-18) + Redis fixed-window в
  `app/api/v1/nioktr.py` (fallback LRU 5k/60s при недоступности Redis) — дорогие
  `ILIKE '%…%'` защищены на двух уровнях.
- `gzip` для `text/css/json/js/xml/svg` (уровень 6) и
  `location ~* ^/_next/static/` `expires 1y` `Cache-Control immutable` (INF-12).
- Проверка: `docker run --rm -v $(pwd)/nginx/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro -v $(pwd)/nginx/certs:/etc/nginx/certs:ro nginx:1.27-alpine nginx -t`

## 5. После восстановления

1. Сверить `SELECT count(*) FROM pg_stat_replication` и `pg_replication_slots`.
2. Запустить `scripts/rehearse_pitr.sh` (если менялся `postgresql-pitr.conf`).
3. Зафиксировать время RTO в `docs/Status.md` и уведомить владельца в Telegram.

Связанные документы: `infra/RUNBOOK-DATA.md` (детали бэкапов/WAL/PITR/offsite),
`infra/docker-compose.prod.yml`, `nginx/nginx.prod.conf`.
