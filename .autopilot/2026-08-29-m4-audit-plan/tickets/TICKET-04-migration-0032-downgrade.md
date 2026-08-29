# TICKET-04: 0032 downgrade индексы (L-03)

- **Спека:** SPEC-02
- **Проблемы:** L-03 (`alembic/versions/0032_questionnaire_read_isolation.py:30` downgrade оставляет `ix_questionnaire_results_user_id`/`project_level_user`)
- **Приоритет:** P2
- **Критичность:** Low
- **Сложность:** S
- **Зависимости:** TICKET-03
- **Можно параллельно с:** TICKET-05,06,08

## Проблема
`downgrade()` делает `ALTER COLUMN user_id DROP NOT NULL` но не `DROP INDEX IF EXISTS` — схема после `downgrade 0032` ≠ `0031`. `upgrade` `CREATE INDEX IF NOT EXISTS` ok, но несоответствие.

## Требуемый результат
`downgrade 0032` → `DROP NOT NULL` + `DROP INDEX IF EXISTS` оба индекса, `upgrade` восстанавливает.

## Объём работ
- `read alembic/versions/0032_questionnaire_read_isolation.py:30`.
- Добавить в `downgrade()`:

```python
op.execute("DROP INDEX IF EXISTS public.ix_questionnaire_results_user_id")
op.execute("DROP INDEX IF EXISTS public.ix_questionnaire_results_project_level_user")
```

(второй — только если был создан в 0032, иначе `IF EXISTS` безопасно).

## Не входит
0031 без pg_temp (TICKET-03).

## Компоненты
- Файл: `technozrelost-backend/alembic/versions/0032_questionnaire_read_isolation.py`

## План
1. `read 0032.py`.
2. Edit `downgrade()`.
3. `alembic upgrade head && downgrade 0032 && upgrade head` проверить.

## Пограничные случаи
- Индекс отсутствовал до 0030 — `IF EXISTS` не бросает.

## Тесты
- `tests/test_questionnaire_isolation.py::test_performance_indexes` после `downgrade` должен падать (нет индекса) — доку.

## Критерии приёмки
- [ ] `downgrade 0032` дропает `NOT NULL` + оба `DROP INDEX IF EXISTS`.
- [ ] `upgrade 0032` восстанавливает.

## Команды проверки
- `.venv/bin/alembic downgrade 0032 && .venv/bin/alembic upgrade head && .venv/bin/pytest tests/test_questionnaire_isolation.py -v`

## Риски
- Нет.
