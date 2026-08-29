# TICKET-03: 0031 без pg_temp (H-02)

- **Спека:** SPEC-02
- **Проблемы:** H-02 (`db/migrations/sql/0031_perf_p14_created_date.sql:22` `pg_temp.try_cast_date` падает в пуле `42704`)
- **Приоритет:** P0
- **Критичность:** High
- **Сложность:** M
- **Зависимости:** —
- **Можно параллельно с:** TICKET-01,05,06

## Проблема
`pg_temp.try_cast_date` — сессионная функция видима только одному коннекшену `AsyncEngine` `10+20`. Второй коннекшен `alembic upgrade head` параллельно ( `replicas=2` + `advisory 732018`) → `42704 undefined_function`. Тест `test_migration_remediation` проходит на одном `psycopg.connect`, но прод пул нет. `grep pg_temp` в `0031` 1.

## Требуемый результат
`0031` SQL без `pg_temp` (`grep -c pg_temp` 0), `to_date` + `DO $$ EXCEPTION` или `CASE`, `alembic upgrade head` idempotent на dirty, concurrent ×2 не 42704.

## Объём работ
- `read db/migrations/sql/0031_perf_p14_created_date.sql`.
- Заменить блок `CREATE FUNCTION pg_temp…; UPDATE … AND pg_temp.try_cast_date…; DROP FUNCTION` на:

```sql
-- Шаг 2: ISO но невалидная → NULL без pg_temp
DO $$ BEGIN
  UPDATE public.nioktr_cards SET created_date = NULL
  WHERE created_date IS NOT NULL
    AND TRIM(created_date::text) ~ '^\d{4}-\d{2}-\d{2}$'
    AND to_date(TRIM(created_date::text), 'YYYY-MM-DD') IS NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
```

(или simpler `UPDATE … WHERE to_date(…) IS NULL` с `DO`).

- Оставить шаг 1 не-ISO→NULL и шаг 3 `ALTER TYPE`.
- `alembic downgrade 0030 && upgrade head` проверить.

## Не входит
0032 NOT NULL (TICKET-04), `technologies` (SPEC-05).

## Компоненты
- Файл: `technozrelost-backend/db/migrations/sql/0031_perf_p14_created_date.sql`

## План
1. `read 0031` → `grep pg_temp`.
2. Edit sql: `CREATE FUNCTION` → `DO $$`.
3. `alembic downgrade 0030` + dirty insert 6 rows + `upgrade head` + проверки.
4. `grep pg_temp` 0.

## Пограничные случаи
- `created_date` уже DATE — `created_date::text` idempotent.
- `''` vs `NULL`.

## Тесты
- `tests/test_migration_remediation.py::test_migration_0031_handles_garbage_date` обновить на `grep pg_temp 0` + concurrent.

## Критерии приёмки
- [ ] `grep pg_temp` 0.
- [ ] `alembic upgrade head` на dirty PASS (garbage NULL, valid DATE).
- [ ] concurrent ×2 не 42704.

## Команды проверки
- `grep -c pg_temp technozrelost-backend/db/migrations/sql/0031_perf_p14_created_date.sql`
- `.venv/bin/pytest tests/test_migration_remediation.py -v`
- `alembic downgrade 0030 && .venv/bin/alembic upgrade head`

## Риски
- `to_date` бросает на `2024-02-30` — ловим `EXCEPTION`.
