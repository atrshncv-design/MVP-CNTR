# TICKET-17: Внешняя верификация P0 (EXT-01)

- **Спека:** SPEC-08
- **Проблемы:** EXT-01 (P0 внешние pending `BACKLOG.md` INF-01..07 `code/local done; external pending`)
- **Приоритет:** P1
- **Критичность:** High
- **Сложность:** L
- **Зависимости:** TICKET-01..16 (все код-фиксы)
- **Можно параллельно с:** — (финал)

## Проблема
`BACKLOG.md` INF-01 daily backup, INF-02 WAL/PITR, INF-04 offsite crypt, INF-05 Telegram, `infra/README-DEPLOY.md` — все `code/local done; external pending` — требуют прод-хост 4vCPU/12GB/500GB (`СЕРВЕР-ТРЕБОВАНИЯ.md:3`), `infra/.env.production` + `rclone crypt` + `TELEGRAM_BOT_TOKEN` + 500GB PITR rehearsal. Без этого B2G-приёмка не пройдена.

## Требуемый результат
На прод-клоне (Linux 4vCPU/12GB) `deploy.sh` green, `curl /ready` 200, `BACKUP_FRESHNESS_MARKER` <25h, `WAL_OFFSITE_MARKER` <300s, `security_check --base-url https://prod` ALL PASS, `loadtest 1K` 99% p95 read ≤500ms write ≤1s, `rehearse_pitr.sh PASS` + `reports/pitr-rehearsal-YYYY-MM-DD.txt`.

## Объём работ
- Подготовить `infra/.env.production` из `.example` (заполнить `POSTGRES_PASSWORD`, `REPL_PASSWORD`, `MINIO_SECRET_KEY`, `REDIS_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`, `RCLONE crypt`, `TELEGRAM_*`).
- `infra/deploy.sh` (из `infra/README-DEPLOY.md` 15 мин) → `docker compose ps` all healthy, `curl -sk https://localhost/api/v1/ready` 200.
- `scripts/security_check.py --base-url https://localhost` → `ALL PASS` → `reports/security-2026-08-29.json`.
- `scripts/loadtest.py --prepare-users 1000 && loadtest.py --users 1000 --duration 120` → `reports/loadtest_report.json` success ≥99%.
- `scripts/rehearse_pitr.sh` → `reports/pitr-rehearsal-2026-08-29.txt` PASS (как `reports/pitr-rehearsal-2026-08-26.txt`).
- `docs/adr/0016-external-smoke.md` — что проверено, артефакты.

## Не входит
Код-фиксы (уже TICKET-01..16).

## Компоненты
- Файлы: `infra/.env.production` (не коммитить!), `reports/*`, `docs/adr/0016*`
- Контур: `docker-compose.prod.yml` 13 сервисов

## План
1. `scp` репо на прод-хост.
2. `cp infra/.env.production.example infra/.env.production` → заполнить.
3. `./infra/deploy.sh` → health-gate.
4. `security_check --base-url` → report.
5. `loadtest` → report.
6. `rehearse_pitr.sh` → report.

## Пограничные случаи
- `BACKUP_OFFSITE_REMOTE=""` → `warn` not `fail` — для пилота ок, но для B2G fail — задокументировать.
- `TELEGRAM_BOT_TOKEN=""` → no-op, но `alerter` должен `warning` — проверить `alerter.py` no-op branch.

## Тесты
- Ручные smoke, не `pytest`.

## Критерии приёмки
- [ ] `deploy.sh` exit 0, `docker compose ps` all healthy.
- [ ] `security_check --base-url` ALL PASS.
- [ ] `loadtest` 99% p95 OK.
- [ ] `pitr-rehearsal` PASS.

## Команды проверки
- `curl -sk https://localhost/api/v1/health | jq`
- `curl -sk https://localhost/api/v1/ready | jq`
- `cat reports/security-*.json | grep ALL`

## Риски
- Требует прод-хост — если нет, остаётся `external pending` и вердикт “условно готово”.
