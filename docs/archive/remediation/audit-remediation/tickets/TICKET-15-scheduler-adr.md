# TICKET-15: Scheduler ADR и guard (I-01)

- **Спека:** SPEC-07
- **Проблемы:** I-01 (scheduler в процессе)
- **Приоритет:** P3
- **Критичность:** Info
- **Сложность:** M
- **Зависимости:** —
- **Можно параллельно с:** TICKET-13,14

## Проблема
`main.py:59` scheduler внутри `uvicorn` + `advisory_lock(42)` — работает на `replicas=2`, но `workers>1` дублирует внутри хоста, нет дока.

## Требуемый результат
ADR `0015-scheduler-advisory-lock.md` + `Dockerfile` без `--workers`.

## Объём работ
- `docs/adr/0015-scheduler-advisory-lock.md` — контекст, решение lock, альтернативы `pg_cron`, последствия.
- `technozrelost-backend/Dockerfile` проверить `CMD` — убрать `--workers`, добавить коммент `// workers>1 forbidden per ADR-0015`.
- `app/main.py:59` коммент уже есть — не трогать.
- `app/services/auth_throttle.py` LRU warning (I-02) — добавить `if len(_attempts)>4000: logger.warning`.

## Не входит
Вынос в `clock` sidecar (future P3, не здесь).

## Компоненты
- Файлы: `docs/adr/0015*.md`, `technozrelost-backend/Dockerfile`

## План
1. `read Dockerfile`.
2. `write ADR 0015`.
3. Edit `Dockerfile` если `workers`.

## Пограничные случаи
- `Dockerfile` без `workers` — только ADR.

## Тесты
- `grep -c "workers" Dockerfile` ==0.
- `pytest -k test_scheduler` PASS (если есть).

## Критерии приёмки
- [ ] ADR 0015.
- [ ] `Dockerfile` без workers.

## Команды проверки
- `cat technozrelost-backend/Dockerfile | grep -E "uvicorn|CMD"`
- `ls docs/adr/0015*`

## Риски
- Нет.
