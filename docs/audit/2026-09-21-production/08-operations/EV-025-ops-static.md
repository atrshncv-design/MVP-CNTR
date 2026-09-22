# EV-025 — operations static inventory (ticket 08, local read-only)

- Дата: исходная метка `2026-09-22` (только дата) — exact UTC исходного сбора
  timestamp unavailable (время не фиксировалось, не выдумываем); доказуемая
  граница из существующих metadata: pre-repair `stat` mtime
  `2026-09-22T08:54:23+0400` (= `2026-09-22T04:54:23Z`); повторная
  верификация local `2026-09-22T04:59:20Z` (exit 0, без SSH, без HTTP-проб:
  `stat` + `date -u`; production не трогался)
- Target: локальный checkout `production-technical-audit`
  (`technozrelost-backend/infra/`, `app/api/v1/health.py`,
  `app/core/config.py`, `app/core/database.py`, `app/main.py`,
  `infra/alerter/alerter.py`); значения `.env`/credentials не читались,
  только имена ключей и кодовые дефолты
- Exit: 0. Нагрузка не создавалась, production не трогался. Живые
  internals (connections/slow/locks/очереди/RPO/RTO/rehearsal) здесь
  осознанно отсутствуют — в отчёте они `UNKNOWN`
- Deployed-факты переиспользованы из EV-003…EV-008 без повторных проб

## Reproducibility (static)

- `deploy.sh`: выкладка по git SHA (`IMAGE_TAG`), сохранение предыдущих
  образов тегом `previous`, `rollback previous|<sha>` (строки ~31–37, 345–436)
- Пины образов с digest: minio `RELEASE.2025-04-22...@sha256:a1ea...`,
  clamav `1.4.3@sha256:75fb...`; версии кода backend/frontend `0.1.0`
- App-образы собираются из локального Dockerfile (`build.context: ..`)

## Probes / restart (static + deployed EV-003/EV-004)

- Liveness: `GET /health` возвращает статическое `ok` (health.py:15–17)
- Readiness: `GET /ready` проверяет Primary (`SELECT 1`), Replica
  (`not_configured` при отсутствии), Redis ping, storage health, clamd PING;
  любой `unavailable` → 503 (health.py:86–124)
- Compose healthcheck у всех 12 сервисов; backend ждёт healthy
  db/minio/clamav/redis; у alerter `depends_on` нет осознанно (должен
  сообщать об аварии, а не ждать её)
- `restart: unless-stopped` 12/12; backend `replicas: 1`; nginx `/healthz`

## Resources envelope (static)

- Лимиты CPU (vCPU): db 1.0, minio 0.5, clamav 1.0, redis 0.25, backend 1.0,
  backup-timer 0.10, wal-offsite 0.10, alerter 0.05, frontend 1.25,
  nginx 0.25, prometheus 0.4, grafana 0.10 — сумма 6.0
- Лимиты памяти: 1536+384+2048+256+1536+128+128+128+768+128+384+256 = 7680M
- Наблюдение (не SLO): разовый `docker stats` из EV-006 — все сервисы далеко
  ниже лимитов, кроме clamav 964.9MiB/2GiB (~47%)

## Disk / log rotation (static + EV-006)

- Compose logging: `json-file max-size 10m max-file 3` у всех 12 сервисов
- Host: `logrotate.timer` активен, следующий запуск 2026-09-22 00:41 UTC
- Alerter следит за `/backups,/wal-archive`: warn 80%, critical 90%
- PG-данные 136M (размер из EV-006); размер хост-диска не читался

## Monitoring / alerting (static + EV-003/EV-006)

- Prometheus scrape 15s, job `technozrelost-backend` через DNS-SD `backend:8000`,
  retention `15d/10GB`; Grafana внутри сети (SSH-туннель), dashboard +
  provisioning присутствуют именами
- Alerter (интервал 60с, таймаут проб 5с): readiness, minio health, clamd PING
  + возраст CVD, свежесть бэкапа (порог 25ч), offsite-маркеры, возраст WAL
  (порог 300с), disk usage, replica/slot (пропуск там, где реплики нет по
  проекту); доставка — Telegram (только имена ключей `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`); факт доставки алертов не доказан
- `/metrics` отдаёт только route-шаблоны (кардинальность не раздувается)

## Tracing / errors (static)

- OTel/Sentry/распределённого трейсинга в коде нет; корреляция —
  middleware `X-Request-ID` (main.py:192–224) + глобальный 500-handler
  с тем же ID без утечки деталей (main.py:267–281)

## Backup / restore / RPO / RTO (static + EV-006)

- `backup.sh`: pg_dump (custom) + pg_basebackup + MinIO-зеркало + SHA256SUMS,
  ротация `BACKUP_KEEP=7`, `BACKUP_STRICT_MINIO=1`, запуск ежедневно
  `BACKUP_AT=03:15` UTC; маркеры freshness (ISO-8601) и offsite (ok|warn|fail)
- `restore.sh`: обязательный `sha256sum -c` до изменений, затем
  `pg_restore --clean --if-exists` + зеркало MinIO обратно; PITR-процедура
  P3 в `RUNBOOK-DATA.md`; репетиция `scripts/rehearse_pitr.sh` — только
  локальная, production-репетиции нет
- Цели из RUNBOOK (не SLA): RPO ≤ 5 мин, RTO ≤ 1 ч
- Свежесть deployed (EV-006): маркеры 2026-09-21 08:03, ≥3 снапшота за день;
  `BACKUP_OFFSITE_REMOTE` пуст у backend/backup-timer/wal-offsite (EV-007)

## CI/CD / rollback (static + EV-003/EV-005/EV-008)

- CI `backend`/`frontend` (EV-005); прошлые теги образов на хосте
  `previous/b30187a1d61c/d811da285ee7/8651cced865c/ce447c95412a` (EV-003)
- Rollback перевыкатывает только образы; БД требует restore/PITR
  (`README-DEPLOY.md`); файловое deploy-событие отстаёт от running
  (`deploy-log-trail-behind-running`, EV-008)

## Redis / PostgreSQL / queues (static + EV-004)

- Redis: `appendonly yes`, том `redis-prod-data`, политика вытеснения
  `maxmemory 200mb / allkeys-lru`; backend fail-fast без Redis в prod;
  наблюдение EV-006: 4MiB/256MiB; живая персистентность — UNKNOWN
- PostgreSQL: `max_connections=100`, `shared_buffers=256MB`,
  `wal_level=replica`, `log_min_duration_statement=500ms`;
  пул backend `pool_size=20 + overflow=35` (макс. 55 ≤ 100);
  живые connections/slow/locks — UNKNOWN (каталог-only правило)
- Очередей задач (Celery/Dramatiq/ARQ) и DLQ в коде нет: фоновый контур —
  cron backup-timer, 60с-цикл wal-offsite, 60с-цикл alerter, SSE-ticket TTL 30с

## Связь со spec

- R03/R06/R23–R25: статика закрыта этим файлом; deployed — EV-003…EV-008;
  без production-доказательства — `UNKNOWN` (Решение 7)
- Нагрузка/restore/restart/DDL не запускались (Вне рамок)
