# TICKET-12: Scheduler guard (I-01)

- **Спека:** SPEC-06
- **Проблемы:** I-01 (`Dockerfile:53` и `backend-entrypoint.sh:128` `workers>1 forbidden per ADR-0015` — только коммент)
- **Приоритет:** P3
- **Критичность:** Info
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-11,13

## Проблема
`uvicorn --workers 2` технически запустится и `_news_scheduler_loop` `advisory_lock(42)` спасёт лишь меж-контейнерно, не внутри хоста — guard только док, не код.

## Требуемый результат
CI ловит `--workers` в `Dockerfile`/`backend-entrypoint.sh` — `grep -r "--workers"` → fail.

## Объём работ
- `read technozrelost-backend/Dockerfile` + `infra/backend-entrypoint.sh`.
- Добавить в `tests/test_infra_contracts.py` `test_no_workers_in_entrypoint`:
```python
def test_no_workers_in_entrypoint():
    assert "--workers" not in Path("infra/backend-entrypoint.sh").read_text()
    assert "--workers" not in Path("Dockerfile").read_text()
```
- `Dockerfile:53` коммент уже — не менять.

## Не входит
Вынос в `clock` sidecar (future P3), `technologies` (TICKET-09).

## Компоненты
- Файлы: `technozrelost-backend/Dockerfile`, `infra/backend-entrypoint.sh`, `tests/test_infra_contracts.py`

## План
1. `read Dockerfile` + `backend-entrypoint.sh`.
2. Edit `test_infra_contracts.py` add `test_no_workers_in_entrypoint`.
3. `pytest test_infra_contracts -k no_workers`.

## Пограничные случаи
- `uvicorn --workers` в комменте — тоже fail, но коммент уже `workers>1 forbidden` — тест должен искать `"--workers"` literal.

## Тесты
- `test_no_workers_in_entrypoint`.

## Критерии приёмки
- [ ] `grep -r --workers Dockerfile` 0 (кроме комментивного `workers>1 forbidden` — ok).
- [ ] `pytest -k no_workers` PASS.

## Команды проверки
- `grep -r "\-\-workers" technozrelost-backend/Dockerfile technozrelost-backend/infra/backend-entrypoint.sh`
- `.venv/bin/pytest tests/test_infra_contracts.py -k no_workers -v`

## Риски
- Нет.
