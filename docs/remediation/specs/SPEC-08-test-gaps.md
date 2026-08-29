# SPEC-08: Дефицит тестов ремедиации и внешняя верификация (EXT-01, все gaps)

## Контекст
Аудит `сек.9` перечислил 11 отсутствующих сценариев: `file_ref` без слэша, `X-Request-ID` CRLF, `Content-Disposition` CRLF, грязная миграция 0031, read isolation, Vary/private, throttle async, threadpool, backup crypt, concurrent refresh, ETag инвалидация. Текущие 347 passed их не покрывают. EXT-01: P0 внешние pending (`BACKLOG.md` INF-01..07 `code/local done; external pending`) — `daily backup`, `WAL offsite crypt`, `Telegram`, `PITR` требуют прод-хост 4vCPU/12GB/500GB (`СЕРВЕР-ТРЕБОВАНИЯ.md:3`) и не верифицированы `security_check --base-url`. Затронуты `tests/*`, `scripts/security_check.py`, `scripts/loadtest.py`, `reports/`.

## Цель
Каждый High/Medium fix имеет regression-test; операционные P0 имеют smoke на прод-клоне с артефактами `reports/`.

## Не входит
Сами фиксы (SPEC-01..07). Не добавлять `pytest-timeout` (не нужен).

## Функциональные требования
- `FR-01` 6 новых тестов ремедиации (в `tests/test_*_remediation.py` или в существующих): `test_file_ref_rejects_non_slash_missing`, `test_download_crlf_escaped`, `test_request_id_crlf_generates`, `test_migration_0031_handles_garbage_date`, `test_questionnaire_read_isolation`, `test_catalog_vary_and_private`.
- `FR-02` `test_auth_throttle_async_not_blocking` — mock Redis sleep, `gather` не блокирует.
- `FR-03` `reports/loadtest_report.json` и `reports/security-YYYY-MM-DD.json` — артефакты каждого `loadtest/security_check --base-url` (как `PROC-01`).
- `FR-04` `infra/README-DEPLOY.md` — секция “Smoke на прод-клоне” с командами `deploy.sh` + `curl /ready` + `rehearse_pitr.sh PASS` (как `reports/pitr-rehearsal-2026-08-26.txt`).

## Нефункциональные
- Время: `pytest -q` ≤ 300s (239s сейчас) — новые тесты ≤10s суммарно.
- Изоляция: каждый тест `TRUNCATE ... RESTART IDENTITY CASCADE` (как `conftest.py:58`).

## Техническое решение
- `tests/test_file_ref_remediation.py` — `register user, create project, POST verification-docs evil → 404, ref-1 → 201`.
- `tests/test_header_remediation.py` — `TestClient` `get("/api/v1/health", headers={"X-Request-ID":"a\r\nX:1"})` → `response.headers["x-request-id"]` != CRLF, `download` CRLF → `Content-Disposition` без `\r\n`.
- `tests/test_migration_remediation.py` — `psycopg connect technozrelost_test, INSERT nioktr_cards created_date='bad', alembic upgrade head` not raise.
- `tests/test_questionnaire_isolation.py` — как SPEC-03 сценарий.
- `tests/test_catalog_remediation.py` — `GET catalog` → `Vary`, `Authorization` → `private`, `If-None-Match` → 304.
- `reports/` — `loadtest.py` уже пишет `reports/loadtest_report.json` (проверить), `security_check.py` `--output reports/security-...`.

## Сценарии
- **Given** новый `file_ref` без слэша, **When** `pytest test_file_ref_rejects`, **Then** 404.
- **Given** `X-Request-ID` CRLF, **When** `pytest`, **Then** генерируется, не echo.
- **Given** `alembic upgrade` на грязной, **When** `pytest`, **Then** success.
- **Given** prod-клон, **When** `security_check --base-url https://prod`, **Then** `ALL PASS`.

## Безопасность
- CRLF-тесты — security regression.

## Тестирование
- Сами новые тесты — как выше.
- `pytest -q` 353+ (347+6) pass.

## Критерии приёмки
- [ ] 6+ новых тестов, все PASS.
- [ ] `reports/` артефакты при `loadtest`/`security_check`.
- [ ] `pytest` ≤300s.

## DoD
FR, тесты, доки, `reports/` gitignored кроме `pitr-rehearsal`, `ruff/mypy` pass.
