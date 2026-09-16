# SPEC-07: Фоновая обработка и масштабируемость (I-01, I-02, P-15 верификация)

## Контекст
I-01: `app/main.py:59` `_news_scheduler_loop` внутри `uvicorn` процесса + `pg_try_advisory_lock(42)` — костыль от дубля при `replicas=2` или `--workers`. Док `AGENTS.md:42` честно “не масштабировать --workers без выноса”, но `Dockerfile` не запрещает. P-15 `notifications.py:97` batch 500 в одной транзакции — при 100K активных `notify_news_published` держит 100K `Notification` в памяти до commit, может `statement_timeout`. I-02: `auth_throttle` LRU 5k evict — при 5001 IP ротации лимит обходится, но Redis mitigates. Затронуты `app/main.py`, `app/services/notifications.py`, `infra/docker-compose.prod.yml`, `app/services/news_scheduler.py`.

## Цель
Scheduler не дублируется при любом `replicas`/`workers`; `notify_news_published` не OOM при росте.

## Не входит
Вынос scheduler в отдельный сервис как P3 — здесь только P2-документация и P1-верификация batch; сам вынос — отдельный тикет P3 если владелец решит до B2G.

## Функциональные требования
- `FR-01` Документировать в `docs/adr/0015-scheduler-advisory-lock.md` текущее решение `advisory_lock(42)` и ограничение “не использовать `--workers` >1 без выноса в `clock` sidecar”.
- `FR-02` `Dockerfile` или `technozrelost-backend/README.md` — добавить `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]` без `--workers`, коммент “workers>1 запрещён — см. ADR-0015”.
- `FR-03` `notify_news_published` batch 500 остаётся (P-15) — верифицировать, что при 10K активных `total 10000` создаётся за <5s и без OOM (синтетический тест с `User` bulk).
- `FR-04` LRU 5k — оставить, но добавить `logger.warning` при `len(_attempts) > 4000` (early warning) и доку `auth_throttle.py` коммент “Redis must for prod, LRU only fallback”.

## Нефункциональные
- Масштабируемость: `scale backend=4` не дублирует публикации (advisory lock).
- Надёжность: batch 500 — одна транзакция, но `flush` per batch, не `add_all` 100K разом (уже done).

## Техническое решение
- Создать `docs/adr/0015-scheduler-advisory-lock.md` — контекст, решение advisory_lock, альтернативы (pg_cron, Celery Beat), последствия.
- `technozrelost-backend/Dockerfile` проверить `CMD` — если есть `--workers`, убрать, добавить коммент.
- `notifications.py:97` уже batch 500 — добавить `logger.info(f"notify batch {offset//500}")` для observability, не менять логику.
- `auth_throttle.py:143` после `while len(_attempts) > MAX_ENTRIES: pop` добавить `if len(_attempts) > 4000: logger.warning("throttle LRU near capacity")`.

## Сценарии
- **Given** `replicas=2`, **When** `process_scheduled_posts` с advisory lock, **Then** только один инстанс публикует, второй `skipped: lock held` в логах.
- **Given** 10K активных, **When** `notify_news_published`, **Then** 10K `Notification` + 10K `Outbox` за <5s, без OOM.

## Безопасность
- Нет.

## Тестирование
- Unit: `test_scheduler_advisory_lock` (два concurrent `process_scheduled_posts`, один skipped).
- Load: `test_notify_batch_10k` (bulk users, `notify_news_published` mock).

## Критерии приёмки
- [ ] ADR 0015 создан.
- [ ] `Dockerfile` без `--workers`.
- [ ] `auth_throttle` warning при 4k.
- [ ] `pytest` `test_scheduler*` PASS.

## DoD
FR, ADR, тесты, `ruff/mypy` pass, дока.
