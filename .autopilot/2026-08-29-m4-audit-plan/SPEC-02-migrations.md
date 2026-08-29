# SPEC-02: Корректность и идемпотентность миграций (H-02, L-03)

## Контекст
`H-02` `technozrelost-backend/db/migrations/sql/0031_perf_p14_created_date.sql:22` использует `CREATE OR REPLACE FUNCTION pg_temp.try_cast_date(t text) RETURNS date LANGUAGE plpgsql AS $$ BEGIN RETURN t::date; EXCEPTION WHEN OTHERS THEN RETURN NULL; END $$;` — сессионная `pg_temp` видима только одному соединению пула `AsyncEngine` (`db_pool_size 10`). Второй коннекшен `alembic upgrade head` параллельно ( `backend-entrypoint.sh` advisory 732018 + `replicas=2`) падает `42704 undefined_function pg_temp.try_cast_date`. `L-03` `alembic/versions/0032_questionnaire_read_isolation.py:30` `downgrade()` делает только `ALTER COLUMN user_id DROP NOT NULL`, но оставляет `ix_questionnaire_results_user_id` и `ix_questionnaire_results_project_level_user` — схема после отката ≠ `0031`. Затронуты `db/migrations/sql/0031*.sql`, `alembic/versions/0032*.py`, `db/migrations/sql/0032*.sql`.

Текущее неправильно: dirty DB `INSERT nioktr_cards ('bad', '2024-02-30')` + `upgrade head` ×2 → второй 42704; `downgrade 0032 → upgrade 0032` — индекс-дубликация не критична, но несоответствие.

## Цель
`alembic upgrade head` идемпотентен на `''/bad/неизвестно/2024-02-30/2024-13-01` → NULL, валидные `YYYY-MM-DD` → DATE, без `pg_temp`, concurrent безопасен; `downgrade 0032` обратим.

## Не входит
Изменение `questionnaire_results.user_id` NOT NULL логики (уже 0032), `target_level` логика, `is_ai_area` индексы.

## Функциональные требования
- `FR-01` Dirty DB: после `INSERT nioktr_cards registration_number LIKE 'TEST-GARBAGE-%' ('', 'bad', 'неизвестно', '2024-02-30', '2024-13-01')` Then `alembic upgrade head` success, `SELECT created_date FROM nioktr_cards WHERE reg LIKE 'TEST-GARBAGE-%'` → все грязные NULL, `'2024-01-02'` → DATE `'2024-01-02'`. Повторный `upgrade head` — не падает.
- `FR-02` `0031` SQL не содержит `pg_temp` (`grep -c pg_temp db/migrations/sql/0031*.sql` 0) и использует `DO $$ BEGIN … EXCEPTION WHEN others THEN NULL; END $$;` или `to_date(..., 'YYYY-MM-DD')` + `CASE`.
- `FR-03` `0032` downgrade: `ALTER TABLE public.questionnaire_results ALTER COLUMN user_id DROP NOT NULL; DROP INDEX IF EXISTS public.ix_questionnaire_results_user_id; DROP INDEX IF EXISTS public.ix_questionnaire_results_project_level_user;` (или оставить один `project_level_user` если он был до 0030 — но тогда доку). `upgrade` восстанавливает `SET NOT NULL` + `CREATE INDEX IF NOT EXISTS`.
- `FR-04` Concurrent: два параллельных `alembic upgrade head` на dirty DB не бросают `42704`.

## Нефункциональные
- Идемпотентность: повторный прогон на уже-DATE колонке `WHERE created_date::text !~ …` не падает.
- Производительность: `UPDATE … WHERE created_date IS NOT NULL` с `TRIM(created_date::text)` использует seq scan — ок для 17k карточек, не для 1M (но pilot 17k).

## Техническое решение
- `db/migrations/sql/0031_perf_p14_created_date.sql`: заменить блок `CREATE FUNCTION pg_temp…; UPDATE … AND pg_temp.try_cast_date…; DROP FUNCTION` на:

```sql
-- Шаг 1: не-ISO → NULL
UPDATE public.nioktr_cards SET created_date = NULL
WHERE created_date IS NOT NULL AND TRIM(created_date::text) !~ '^\d{4}-\d{2}-\d{2}$';
-- Шаг 2: ISO но невалидная дата → NULL (без pg_temp)
DO $$ BEGIN
  UPDATE public.nioktr_cards SET created_date = NULL
  WHERE created_date IS NOT NULL
    AND TRIM(created_date::text) ~ '^\d{4}-\d{2}-\d{2}$'
    AND to_date(TRIM(created_date::text), 'YYYY-MM-DD') IS NULL
    -- to_date бросает на 2024-02-30, ловим
    ;
EXCEPTION WHEN others THEN
  -- fallback: построчно
  PERFORM 1;
END $$;
-- Более надёжный fallback без EXCEPTION: использовать TRY через plpgsql per row уже выше
-- Шаг 3: безопасная конвертация
ALTER TABLE public.nioktr_cards ALTER COLUMN created_date TYPE DATE
  USING NULLIF(TRIM(created_date::text), '')::date;
```

Альтернатива: простой `UPDATE … SET created_date = NULL WHERE created_date::text !~ '^\d{4}-\d{2}-\d{2}$' OR created_date::text::date IS NULL` с `EXCEPTION` внутри `DO`. Выбрать один, задокументировать в SQL комменте.

- `alembic/versions/0032_questionnaire_read_isolation.py:30` `downgrade()` дописать `op.execute("DROP INDEX IF EXISTS public.ix_questionnaire_results_user_id"); op.execute("DROP INDEX IF EXISTS public.ix_questionnaire_results_project_level_user");` (второй — только если был создан в 0032, иначе `IF EXISTS` безопасно).

## Сценарии
- **Given** DB на `0030` (VARCHAR) с 6 garbage +2 valid, **When** `alembic upgrade head` **Then** garbage NULL, valid DATE, `upgrade head` повторно PASS.
- **Given** `0032` applied, **When** `alembic downgrade 0032` **Then** `information_schema.columns is_nullable YES`, индексы отсутствуют, `upgrade 0032` снова `NO`.
- **Given** два `ThreadPoolExecutor` одновременно `upgrade head` на dirty, **When** parallel **Then** оба PASS, второй не 42704.

## Безопасность
- Нет.

## Тестирование
- Unit: `tests/test_migration_remediation.py::test_migration_0031_handles_garbage_date` обновить на `grep pg_temp 0` + concurrent.
- Integration: `alembic downgrade 0031 && upgrade head` + `downgrade 0032 && upgrade head` в `test_performance_indexes`.

## Критерии приёмки
- [ ] `grep pg_temp` в `0031` 0.
- [ ] `alembic upgrade head` на dirty PASS (garbage NULL, valid DATE).
- [ ] `downgrade 0032` дропает `NOT NULL` + индексы `IF EXISTS`.
- [ ] concurrent ×2 не 42704.

## Definition of Done
FR, миграции обратимы, `ruff/mypy` pass, `pytest test_migration_remediation` PASS, доки `db/migrations/sql/0031` коммент «без pg_temp».
