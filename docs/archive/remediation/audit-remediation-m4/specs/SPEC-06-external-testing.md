# SPEC-06: Внешняя верификация и гигиена тестов (M-04, L-01, I-01)

## Контекст
`M-04` `reports/loadtest_report.json:1` `{"success_rate":null,"p95":null,"external_pending":true}` stub — `scripts/loadtest.py --users 1000 --duration 120` 70/20/8/2 на прод-клоне не прогнан; `reports/security-2026-08-29.json` `mode:skip-live` — live-группы RBAC/IDOR/file-sec (`scripts/security_check.py --base-url https://prod` 5 групп) не прогнаны; `reports/pitr-rehearsal-2026-08-29.txt` — копия 2026-08-26 stub, не прод 500GB. `L-01` `tests/test_storage_remediation.py` и `test_storage_threadpool.py` `diff` 0 (дубль), аналогично `test_throttle_async.py`/`test_throttle_remediation.py` — `collect` 361 (фактически 359 уникальных). `I-01` `technozrelost-backend/Dockerfile:53` и `infra/backend-entrypoint.sh:128` `workers>1 forbidden per ADR-0015` — только коммент, `uvicorn --workers 2` технически запустится и дубль `_news_scheduler_loop` `advisory_lock(42)` спасёт лишь меж-контейнерно, не внутри хоста. Затронуты `tests/*`, `Dockerfile`, `infra/backend-entrypoint.sh`, `infra/README-DEPLOY.md`, `reports/*`, `docs/adr/0016-external-smoke.md`.

Текущее неправильно: B2G-приёмка по 152-ФЗ (`RPO≤24h, PITR ≤5мин, offsite crypt`) без прод-артефактов `условно готово`; дубли тестов вводят путаницу; guard не enforce.

## Цель
Каждый High/Medium fix имеет regression-test без дублей; guard `workers>1` ловится CI; внешние smokes прогнаны на прод-клоне с артефактами `reports/` (`all_targets_pass:true`).

## Не входит
Сами фиксы SPEC-01..05, смена образа (SPEC-01), `pg` миграция (SPEC-02).

## Функциональные требования
- `FR-01` Удалить дубли: `rm technozrelost-backend/tests/test_storage_remediation.py` (оставить `test_storage_threadpool.py`) и `rm technozrelost-backend/tests/test_throttle_remediation.py` (оставить `test_throttle_async.py`) — или наоборот, но один из пары. `pytest --collect-only` → 359 (-2).
- `FR-02` `Dockerfile`/`backend-entrypoint.sh` без `--workers`, CI `grep -r "\-\-workers" technozrelost-backend/Dockerfile technozrelost-backend/infra/backend-entrypoint.sh` →0, иначе fail (`tests/test_infra_contracts.py` добавить `test_no_workers_in_entrypoint`).
- `FR-03` Прод-клон 6 шагов ADR-0016 (TICKET-14): `scp` репо на Linux 4vCPU/12GB/500GB → `cp infra/.env.production.example infra/.env.production` + заполнить `POSTGRES_PASSWORD/REPL_PASSWORD/MINIO_SECRET_KEY/REDIS_PASSWORD/GRAFANA_ADMIN_PASSWORD` + `rclone crypt` + `TELEGRAM_*` → `./infra/deploy.sh` green → `curl -sk https://localhost/api/v1/ready` 200 `{"status":"ready"}` → `uv run python scripts/security_check.py --base-url https://localhost --json reports/security-YYYY-MM-DD.json` ALL PASS → `uv run python scripts/loadtest.py --prepare-users 1000 --seed-manager && uv run python scripts/loadtest.py --users 1000 --duration 120 --report reports/loadtest_report.json` success ≥99% p95 read ≤500ms write ≤1s → `bash technozrelost-backend/scripts/rehearse_pitr.sh` → `reports/pitr-rehearsal-YYYY-MM-DD.txt` PASS (1 vs 0 строк WAL replay) → `BACKUP_FRESHNESS_MARKER` <25h, `WAL_OFFSITE_MARKER` <300s.
- `FR-04` Stubs `reports/loadtest_report.json` и `reports/security-*.json` после реального прогона перезаписаны тем же путём (`--report`, `--json`, `REPORT env`), `external_pending` → false, `all_targets_pass` → true/false (не null).
- `FR-05` `pytest -q` ≤300s (сейчас >180s на darwin, на CI Linux с `pgvector` service ≤239s) — выборка 359 PASS, `npm test` 39 PASS, `ruff/mypy` PASS.

## Нефункциональные
- Время: `pytest -q` ≤300s — новые тесты 0, только удаление дубля.
- Изоляция: каждый тест `TRUNCATE … RESTART IDENTITY CASCADE` (как `conftest.py:58`).
- Наблюдаемость: `reports/` в `.gitignore` кроме `pitr-*.txt` и `PROC-01.json` (SPEC-01).

## Техническое решение
- `rm` два файла, `git rm` (не `rm` просто).
- `technozrelost-backend/infra/backend-entrypoint.sh` уже `exec uvicorn app.main:app --host 0.0.0.0 --port 8000` без `--workers` — добавить `test_no_workers_in_entrypoint` в `test_infra_contracts.py`: `assert "--workers" not in Path("infra/backend-entrypoint.sh").read_text()`.
- Прод-клон: `infra/README-DEPLOY.md` 15 мин + `docs/adr/0016` 6 шагов — не дублировать, прогнать `deploy.sh` с `DEPLOY_HEALTH_TIMEOUT_SECONDS=300`, `security_check --base-url`, `loadtest --prepare-users` + `--duration`, `rehearse_pitr.sh` с `REPORT=reports/pitr-rehearsal-…`.
- `reports/` stubs уже `external_pending:true` — реальные прогоны перезапишут `generated_at` ISO с офсетом, `success_rate` число.

## Сценарии
- **Given** `pytest --collect-only` после dedup **When** **Then** 359, не 361.
- **Given** `grep -r --workers Dockerfile` **When** CI **Then** fail если найдено.
- **Given** прод-клон **When** `security_check --base-url https://prod` **Then** `ALL CHECKS PASS` (5 групп), `live_pending` пусто.
- **Given** `loadtest 1K` **When** **Then** `success_rate ≥99`, `p95 read ≤500 write ≤1000`.

## Безопасность
- `security_check` live-группы — RBAC 403/404, IDOR 404, file-sec 422/201 — должны PASS на проде.

## Тестирование
- `pytest -q` 359, `npm test` 39, `ruff/mypy` green.
- `test_no_workers_in_entrypoint` + `test_digest_pinned` (SPEC-01).

## Критерии приёмки
- [ ] `ls tests/test_storage*.py` 1 файл, `test_throttle*.py` 1 файл, `collect` 359.
- [ ] `grep --workers` в `Dockerfile`/`backend-entrypoint.sh` 0.
- [ ] `reports/loadtest_report.json` `all_targets_pass` не null, `security-*.json` `verdict ALL PASS`, `pitr-*.txt` PASS (на проде) или stubs с `external_pending:true` в pilot.
- [ ] `pytest -q` ≤300s green (на CI).

## Definition of Done
FR, тесты, доки `infra/README-DEPLOY.md` не менять, `reports/` перезаписаны или stubs задокументированы, нет TODO.
