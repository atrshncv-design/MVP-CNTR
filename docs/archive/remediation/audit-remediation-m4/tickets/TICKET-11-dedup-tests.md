# TICKET-11: Dedup tests (L-01)

- **Спека:** SPEC-06
- **Проблемы:** L-01 (`tests/test_storage_remediation.py` и `test_storage_threadpool.py` diff 0, `test_throttle_async.py`/`test_throttle_remediation.py` diff 0)
- **Приоритет:** P2
- **Критичность:** Low
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-10,09,13

## Проблема
Два агента создали дубли: `collect` 361 (фактически 359 уникальных) — путаница, CI время +2s.

## Требуемый результат
Один из пары удалён, `collect` 359, `pytest -q` green.

## Объём работ
- `git rm technozrelost-backend/tests/test_storage_remediation.py` (оставить `test_storage_threadpool.py` — более новое имя `threadpool` отражает `to_thread`).
- `git rm technozrelost-backend/tests/test_throttle_remediation.py` (оставить `test_throttle_async.py`).
- `pytest --collect-only` 359.

## Не входит
Code fix, `external` (TICKET-14).

## Компоненты
- Файлы: `technozrelost-backend/tests/test_storage_remediation.py`, `test_throttle_remediation.py`

## План
1. `ls tests/test_storage*.py test_throttle*.py` → 4.
2. `git rm` 2 файла.
3. `pytest --collect-only` 359.

## Пограничные случаи
- `test_file_ref_remediation` не дубль — оставить.

## Тесты
- `pytest --collect-only` + `pytest tests/test_storage_threadpool.py tests/test_throttle_async.py -v`.

## Критерии приёмки
- [ ] `ls tests/test_storage*.py` 1, `test_throttle*.py` 1, `collect` 359.
- [ ] `pytest -q` green.

## Команды проверки
- `ls technozrelost-backend/tests/test_storage*.py technozrelost-backend/tests/test_throttle*.py`
- `.venv/bin/pytest --collect-only -q 2>&1 | tail -n 5`

## Риски
- Нет.
