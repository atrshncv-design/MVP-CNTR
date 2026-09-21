# 01 — Окружения и ограничения (baseline, ticket 01)

Снимок на UTC 2026-09-21T13:26–13:30Z + добор blocking condition 01
на UTC 2026-09-21T16:47–16:55Z. Доказательства: `00-evidence/EV-001…EV-008`.
Оценки без production-доказательства помечены static/local (Решение 7).

## Локально (static, EV-001/EV-003)

- Worktree `production-technical-audit`, branch `autopilot/production-technical-audit`,
  HEAD `f364388074647ec9d00f4e3f8a21114ff236f522` (= Решение 1: от `3a4dfe3`
  отличается только закрытием прошлого прогона).
- Dirty-state: только служебные `.autopilot/*`; продуктовый код чист.
- Origin: `https://github.com/atrshncv-design/MVP-CNTR.git`.
- Машина аудитора: macOS 26.7 arm64, Python 3.9.6, Node v22.23.1, Docker 29.5.3.

## Git / origin (EV-001/EV-002)

- Local HEAD `f364388` (ветка `autopilot/production-technical-audit`).
- Server HEAD `f06b15c` (ветка `autopilot/m0-security-hardening`, дерево чистое).
- Deployed-версия доказана тройным совпадением: server SHA = image tag
  `f06b15cb76ef` = running containers (EV-002/EV-003/EV-005).

## Сервер (deployed, EV-002/EV-003)

- `root@213.139.209.165`, Ubuntu `7.0.0-29-generic x86_64`,
  Docker 29.1.3 / Compose v2.35.1, uptime 5 дней, load 0.10/0.24/0.19.
- Фактический deployment path `~/MVP-CNTR` ≠ `/opt/technozrelost` из spec —
  расхождение зафиксировано в EV-002 для findings-реестра.

## Production runtime (deployed, EV-003/EV-004)

- 12 контейнеров, все healthy: frontend/backend (`:f06b15cb76ef`),
  backup-timer, wal-offsite, alerter, grafana 11.2.0, prometheus v2.54.1,
  nginx 1.27-alpine, redis 7-alpine, db-primary pgvector 0.8.0-pg16,
  minio RELEASE.2025-04-22T22-12-26Z, clamav 1.4.3.
- Single-node топология — факт для SPOF-оценки (целевая 2×R640 — вне прогона).
- Probes: `/api/v1/health` 200 `ok`; `/api/v1/ready` 200 `ready`
  (replica `not_configured`); landing `/` 200; `/api/v1/metrics` 200
  (только route-шаблоны). Частота: 4 одиночных GET, stop-сигнал не сработал.

## CI/CD (EV-005 + EV-008)

- Workflow `CI`: джобы `backend` (Python 3.11, uv, pip-audit, ruff, mypy,
  pytest, image build, readiness smoke) и `frontend` (npm ci, audit, lint,
  test, build); CI-образы совпадают с prod.
- Deploy events (metadata, EV-005): `deploy.log` 2026-09-17 (266 строк),
  `seed.log` 2026-09-16, `load.json`/`load.log` 2026-09-17, `gost.tar` 63MB.
- Последнее файловое событие (EV-008, безопасный хвост с автомаскировкой
  tokens/cookies/email/phones): выкладка `8651cced865c` прошла health-gate
  2026-09-17 (контейнеры Starting→Healthy, 301-redirect без изменений, curl
  `/api/v1/health`, cert-скрипты именами). Файловое событие отстаёт от running
  `f06b15cb76ef` (EV-002/EV-003) — факт `deploy-log-trail-behind-running`
  для findings/operations.

## Production config без values (EV-007, deployed)

- Санитизированный `docker compose config` проекта `technozrelost-prod`
  (12 сервисов, `restart: unless-stopped` везде): значения env не сохранялись,
  `.env`/credential stores не читались; интерполяция маскировалась серверным
  редактором в `name + set/empty`.
- Ключей: 108 (set 103, empty 5). Empty: `backend: BACKUP_OFFSITE_REMOTE,
  OPENCODE_API_KEY, OPENCODE_ZEN_API_KEY`; `backup-timer: BACKUP_OFFSITE_REMOTE`;
  `wal-offsite: BACKUP_OFFSITE_REMOTE`. По сервисам: backend 37, alerter 24,
  backup-timer 24, wal-offsite 8, db 5, grafana 4, frontend 3, minio 2, redis 1.
- Config-hash `3ec4b7d0…` связывает running-контейнеры с этим compose-файлом.

## Operations metadata (EV-006)

- Backup volumes + свежие маркеры/снапшоты 2026-09-21; `backup-timer` и
  `wal-offsite` healthy; PG-данные 136M (размер). RPO/RTO/restore — в отчёт,
  restore не запускался.
- Monitoring: prometheus+grafana healthy, job `technozrelost-backend`,
  alerter + dashboard присутствуют именами; правила/каналы — не читались.
- Logrotate на хосте активен; конфиги ротации приложений — UNKNOWN.

## Ограничения и UNKNOWN

- `.env`/credentials/keys/resolved config — не читались (запрет).
- Business rows, полные логи, тела ответов — не собирались (вне зоны).
- DB internals (connections/slow/locks), RPO/RTO, rollback, SPOF, очереди —
  operations-отчёт; нагрузка/restore/restart/DDL — не запускались (вне рамок).
- Ролевой runtime — `UNKNOWN` до test accounts (R36).
- Mutations: ни одной. Секретов/ПДн/бизнес-строк в артефактах нет.
