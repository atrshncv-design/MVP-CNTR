# TICKET-16: Набор тестов ремедиации (все gaps)

- **Спека:** SPEC-08
- **Проблемы:** Все testing gaps сек.9 (file_ref, CRLF, migration, isolation, Vary, throttle async, threadpool, concurrent refresh, ETag)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** M
- **Зависимости:** TICKET-01..11 (фиксы должны быть слиты)
- **Можно параллельно с:** — (последний перед EXT)

## Проблема
11 сценариев без покрытия → регресс возможен, `pytest 347` не ловит H-01/M-01.

## Требуемый результат
6+ новых тестов, все PASS, `pytest -q` 353+ ≤300s, `reports/` артефакты.

## Объём работ
- `tests/test_file_ref_remediation.py` — `test_file_ref_rejects_non_slash_missing`, `test_file_ref_allows_legacy`, `test_file_ref_allows_real_key` (TICKET-01).
- `tests/test_header_remediation.py` — `test_download_crlf_escaped`, `test_request_id_crlf_generates` (TICKET-02).
- `tests/test_migration_remediation.py` — `test_migration_0031_handles_garbage_date` (TICKET-06).
- `tests/test_questionnaire_isolation.py` — `test_questionnaire_per_user_read_isolation` (TICKET-07).
- `tests/test_catalog_remediation.py` — `test_catalog_vary_and_private`, `test_catalog_etag_sort_order` (TICKET-11).
- `tests/test_throttle_async.py` — `test_auth_throttle_async_not_blocking` (TICKET-03).
- `tests/test_storage_threadpool.py` — `test_verification_doc_uses_threadpool` (TICKET-10) — mock `storage.get` + `to_thread` check via `patch`.

## Не входит
EXT smoke (TICKET-17).

## Компоненты
- Файлы: `tests/test_*remediation.py` (6 файлов)

## План
1. `read tests/test_tokens.py` формат.
2. `write` 6 тестовых файлов, каждый `from fastapi.testclient import TestClient`, `def test_*(client: TestClient)`.
3. `pytest new tests -q` → PASS.
4. `pytest -q` full 353+ → PASS.

## Пограничные случаи
- Каждый тест `TRUNCATE ... RESTART IDENTITY CASCADE` via `conftest` `autouse _clean_tables` — изоляция уже.
- `legacy_allowlist` `ref-1` — must be in `config`.

## Тесты
- Сами новые.

## Критерии приёмки
- [ ] 6 файлов, каждый PASS.
- [ ] `pytest -q` 353+ (347+6) PASS, ≤300s.
- [ ] `ruff/mypy` не ругается на тесты (ignore).

## Команды проверки
- `.venv/bin/pytest tests/test_*remediation.py -q`
- `.venv/bin/pytest -q 2>&1 | tail -n 5`

## Риски
- Тест на garbage migration требует `psycopg` `alembic` — использовать `TestClient` + `alembic` direct, не `async`.
