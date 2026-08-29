# TICKET-14: External smoke (M-04)

- **Спека:** SPEC-06
- **Проблемы:** M-04 (`reports/loadtest_report.json` `null p95` stub, `security-*.json` `skip-live`, `pitr-*.txt` копия 2026-08-26)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** L
- **Зависимости:** TICKET-01,02,03,05,06,08,09 (все P0/P1)
- **Можно параллельно с:** — (финал)

## Проблема
Stubs `external_pending:true` — `scripts/loadtest.py --users 1000 --duration 120` 70/20/8/2, `scripts/security_check.py --base-url` 5 групп, `scripts/rehearse_pitr.sh` 500GB не прогнаны на прод-клоне — B2G-приёмка `условно готово`, `RPO≤24h, PITR ≤5мин, offsite crypt` не доказаны (требует прод-хост 4vCPU/12GB/500GB `СЕРВЕР-ТРЕБОВАНИЯ.md:3`).

## Требуемый результат
Прод-клон 6 шагов ADR-0016: `deploy.sh` green → `curl /ready 200` → `security_check --base-url ALL PASS` (5 групп) → `loadtest 1K` 99% p95 read ≤500ms write ≤1s → `rehearse_pitr.sh` PASS → `reports/loadtest_report.json` `all_targets_pass:true`, `reports/security-YYYY-MM-DD.json` `verdict ALL PASS`, `reports/pitr-rehearsal-YYYY-MM-DD.txt` PASS.

## Объём работ
- Подготовить `infra/.env.production` из `.example` (заполнить `POSTGRES_PASSWORD`, `REPL_PASSWORD`, `MINIO_SECRET_KEY`, `REDIS_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`, `CVD_MAX_AGE_SECONDS`, `rclone crypt` `type=crypt`, `TELEGRAM_*`) — файл `0600`, не коммитить.
- `scp` репо на прод-хост Linux 4vCPU/12GB/500GB, `docker compose -f infra/docker-compose.prod.yml up -d` + `./infra/deploy.sh` (health-gate 300с) → `docker compose ps` all healthy 13 сервисов, `curl -sk https://localhost/api/v1/ready` 200 `{"status":"ready"}`.
- `uv run python scripts/security_check.py --base-url https://localhost --json reports/security-$(date +%F).json` → `ALL CHECKS PASS` (SECRETS, DEPS, RBAC, IDOR, FILE-SEC) → `cat reports/security-*.json`.
- `uv run python scripts/loadtest.py --prepare-users 1000 --seed-manager && uv run python scripts/loadtest.py --users 1000 --duration 120 --report reports/loadtest_report.json` → `jq .all_targets_pass` true, `jq .success_rate` ≥99, `p95 read ≤500`.
- `bash technozrelost-backend/scripts/rehearse_pitr.sh` → `REPORT=reports/pitr-rehearsal-$(date +%F).txt` PASS (WAL replay 1 vs 0).
- `cat /backups/.backup-freshness` <25h, `/backups/.wal-offsite-status` <300s, `/backups/.offsite-status` `ok`.

## Не входит
Code fix (уже), `SOPS` перешифровка (TICKET-07).

## Компоненты
- Файлы: `infra/.env.production` (не коммитить!), `reports/*` (перезапись stubs), `docs/adr/0016`
- Контур: `docker-compose.prod.yml` 13 сервисов, `deploy.sh`, `scripts/*`

## План
1. `scp -r . prod:/opt/technozrelost`.
2. `ssh prod "cd /opt/technozrelost/technozrelost-backend/infra && cp .env.production.example .env.production && vi .env.production"`.
3. `ssh prod "./infra/deploy.sh"`.
4. `ssh prod "curl -sk https://localhost/api/v1/ready && uv run python scripts/security_check.py --base-url https://localhost --json reports/security-$(date +%F).json"`.
5. `ssh prod "uv run python scripts/loadtest.py --prepare-users 1000 && uv run python scripts/loadtest.py --users 1000 --duration 120 --report reports/loadtest_report.json"`.
6. `ssh prod "bash scripts/rehearse_pitr.sh && cat reports/pitr-rehearsal-*.txt"`.

## Пограничные случаи
- `BACKUP_OFFSITE_REMOTE=""` → `warn no-remote` pilot ok, B2G fail — задокументировать.
- `TELEGRAM_*` пусто → alerter no-op с `logger.warning` — probes продолжают.

## Тесты
- `security_check --base-url` 5 групп PASS, `loadtest` 99% p95, `rehearse_pitr.sh` PASS.

## Критерии приёмки
- [ ] `curl /ready` 200 `{"status":"ready"}`.
- [ ] `security-*.json` `verdict ALL PASS` (5 групп).
- [ ] `loadtest_report.json` `all_targets_pass:true`, `success_rate≥99`, `p95 read≤500 write≤1000`.
- [ ] `pitr-*.txt` PASS (1 vs 0), `/.backup-freshness` <25h.

## Команды проверки
- `curl -sk https://localhost/api/v1/ready | jq .`
- `uv run python technozrelost-backend/scripts/security_check.py --base-url https://localhost --json reports/security-$(date +%F).json && cat reports/security-*.json | grep ALL`
- `uv run python technozrelost-backend/scripts/loadtest.py --users 1000 --duration 120 --report reports/loadtest_report.json && cat reports/loadtest_report.json | jq .all_targets_pass`

## Риски
- Требует прод-хост и операторских секретов — без них остаётся `external_pending:true` «условно готово».
