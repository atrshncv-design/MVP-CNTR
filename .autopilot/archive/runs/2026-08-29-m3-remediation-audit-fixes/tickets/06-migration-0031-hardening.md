# TICKET-06: Закалка миграции 0031 (M-01)

- **Спека:** SPEC-03
- **Проблемы:** M-01 (0031 `USING ::date` падает на `not-a-date`)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** TICKET-05 (чистый lock для `alembic`)
- **Можно параллельно с:** TICKET-07? Нет, TICKET-07 зависит от 06.

## Проблема
`db/migrations/sql/0031_perf_p14_created_date.sql:5` `USING NULLIF(TRIM(created_date),'')::date` бросает `invalid input syntax for type date` на `created_date='неизвестно'` → `alembic upgrade head` rollback, `backend-entrypoint.sh` health-gate fail, деплой не проходит.

## Требуемый результат
`alembic upgrade head` idempotent на БД с `created_date` = `''`, `'bad'`, `'2024-02-30'` → все become `NULL`, валидные `2024-01-02` → `DATE`.

## Объём работ
- `db/migrations/sql/0031_perf_p14_created_date.sql` заменить `ALTER ... USING NULLIF(...)::date` на двухшаговый: `UPDATE public.nioktr_cards SET created_date = NULL WHERE created_date IS NOT NULL AND TRIM(created_date) !~ '^\d{4}-\d{2}-\d{2}$';` затем `UPDATE ... SET created_date = NULL WHERE created_date::date IS NULL` с `EXCEPTION` или `TRY_CAST` — или `USING CASE WHEN created_date ~ '^\d{4}-\d{2}-\d{2}$' THEN created_date::date ELSE NULL END` с pre-`UPDATE` для `'2024-02-30'` (который matches regex но invalid). Простейший: pre-`UPDATE` 2 строки + `ALTER ... USING created_date::date` где уже только ISO/NULL.
- `alembic/versions/0031_perf_p14_created_date.py` — не менять логику `upgrade()`, только SQL файл.
- Добавить `DROP INDEX IF EXISTS ...; CREATE INDEX ...` уже есть — оставить.

## Не входит
`user_id` NOT NULL (TICKET-07).

## Компоненты
- Файлы: `db/migrations/sql/0031_perf_p14_created_date.sql`

## План
1. `read 0031 SQL`.
2. Заменить на 3 команды: `UPDATE ... !~ regex → NULL; UPDATE ... try_cast invalid → NULL; ALTER ... USING ::date`.
3. `psql technozrelost_test` `INSERT ... 'bad'` → `alembic upgrade head` → `SELECT created_date IS NULL`.
4. `alembic downgrade 0031 && upgrade` → idempotent.

## Пограничные случаи
- `'2024-02-30'` — regex pass но date invalid → pre-UPDATE должен обнулить (`::date` в `WHERE` с `EXCEPTION`).
- `''` → `NULL` уже handled `NULLIF`.
- `NULL` → остаётся `NULL`.

## Тесты
- `test_migration_0031_handles_garbage_date` (см. SPEC-03) — temp DB dirty → upgrade not raise.

## Критерии приёмки
- [ ] `0031 SQL` с `UPDATE !~` + `CASE`/`TRY`.
- [ ] `alembic upgrade/downgrade` на dirty 100 строк PASS.
- [ ] `mypy` не трогаем, `pytest` green.

## Команды проверки
- `psql -h 127.0.0.1 -U technoz -d technozrelost_test -c "INSERT ... 'bad' ..."`
- `uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head`

## Риски
- `UPDATE` без `WHERE` на 16K строк — ок, но на 1M — `lock` долго → `WHERE` regex index not, но 16K — fine.
