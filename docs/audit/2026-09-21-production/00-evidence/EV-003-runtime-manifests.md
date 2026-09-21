# EV-003 — OS, runtime, Docker, образы, сервисы, манифесты

- Дата: UTC 2026-09-21T13:26–13:28Z
- Targets: локальный macOS; сервер Ubuntu (SSH, read-only)
- Команды: `uname -a; sw_vers; python3/node/npm/docker --version`;
  сервер: `uname -a; docker --version; docker compose version;
  docker images --format ... | head -20; docker ps --format ...`;
  локально: имена сервисов `docker-compose.prod.yml`, список манифестов `ls`
- Exit: 0 везде. Значения env не читались.

## Локально (факт окружения аудитора, не production)

- OS: `Darwin 25.6.0 arm64`; macOS 26.7 build 25G227
- Runtime: Python 3.9.6 (системный), Node v22.23.1, npm 10.9.8
- Docker 29.5.3, Compose v5.1.4

## Сервер

- OS: `Linux 7.0.0-29-generic x86_64 Ubuntu`
- Docker 29.1.3, Compose v2.35.1
- Uptime на момент замера: 5 дней 9:19, load average 0.10/0.24/0.19

## Контейнеры (имена, образы, статус — без env)

| Name | Image | Status |
|------|-------|--------|
| tz-prod-frontend | technozrelost-frontend:f06b15cb76ef | Up 5 hours (healthy) |
| tz-prod-backend | technozrelost-backend:f06b15cb76ef | Up 5 hours (healthy) |
| technozrelost-prod-backup-timer-1 | technozrelost-backend:f06b15cb76ef | Up 5 hours (healthy) |
| technozrelost-prod-wal-offsite-1 | technozrelost-backend:f06b15cb76ef | Up 5 hours (healthy) |
| technozrelost-prod-alerter-1 | technozrelost-backend:f06b15cb76ef | Up 5 hours (healthy) |
| tz-prod-grafana | grafana/grafana:11.2.0 | Up 4 days (healthy) |
| tz-prod-prometheus | prom/prometheus:v2.54.1 | Up 4 days (healthy) |
| tz-prod-nginx | nginx:1.27-alpine | Up 4 days (healthy) |
| tz-prod-redis | redis:7-alpine | Up 4 days (healthy) |
| tz-prod-db-primary | pgvector/pgvector:0.8.0-pg16 | Up 4 days (healthy) |
| tz-prod-minio | quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z | Up 4 days (healthy) |
| tz-prod-clamav | clamav/clamav:1.4.3 | Up 4 days (healthy) |

- Тег образов приложения `f06b15cb76ef` совпадает с server HEAD (EV-002).
- Прошлые теги образов на хосте (факт наличия, не запуск):
  frontend `previous/b30187a1d61c/d811da285ee7/...`, backend `b30187a1d61c/
  d811da285ee7/8651cced865c/ce447c95412a/...` — история rollback-кандидатов,
  оценка rollback — в operations-отчёте.

## Манифесты (имена, без содержимого секретов)

- Compose: `technozrelost-backend/infra/docker-compose.yml`,
  `technozrelost-backend/infra/docker-compose.prod.yml`
- Сервисы prod-композа (12): db, minio, clamav, redis, backend, backup-timer,
  wal-offsite, alerter, frontend, nginx, prometheus, grafana;
  volumes (именами): pg-prod-primary-data, wal-archive-prod-data,
  minio-prod-data, clamav-prod-db, redis-prod-data, backups-prod-data,
  rclone-config-prod, prometheus-prod-data
- nginx: `infra/nginx/nginx.conf`, `infra/nginx/nginx.prod.conf`
  (+ каталоги `certs/`, `legacy/`)
- prometheus: `infra/prometheus/prometheus.yml`; grafana: `infra/grafana/
  dashboard.json` + `provisioning/`; alerter: `infra/alerter/alerter.py`,
  `infra/alerter/test_alerter.py`
- postgres: `infra/postgres/ensure-replication.sh` (bind ro),
  `infra/postgres/pg_hba.conf` (bind ro) — имена и mount-режим из
  `docker inspect` (значения конфигов не читались)
- Версии кода: backend `0.1.0` (`pyproject.toml`), frontend `0.1.0`
  (`package.json`, next ^16.3.0, react 19.2.4)

## Связь со spec

- R01–R02 (versions, services, manifests): закрыты. Эксплуатационный контур:
  topology single-node (факт для оценки SPOF в operations-отчёте).
- Ссылки: `01-environments.md` (Production runtime, Манифесты).
