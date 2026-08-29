# ADR 0015: Scheduler в процессе uvicorn с pg advisory lock 42 — запрет workers>1 (I-01, SPEC-07)

**Tier:** T2 — correctness / scalability, reversal = дубль публикации новостей при workers>1 без выноса в clock sidecar
**Date:** 2026-08-29
**Status:** accepted

## Title
Отложенная публикация новостей остаётся в процессе uvicorn (`_news_scheduler_loop` раз в 60с) с `pg_try_advisory_lock(42)`; `workers>1` запрещён — масштабирование только репликами, вынос в `clock` sidecar — future P3

## Context
`technozrelost-backend/app/main.py:60` запускает фоновый цикл `_news_scheduler_loop` внутри процесса uvicorn (lifespan, интервал `SCHEDULER_INTERVAL_SECONDS=60`). Цикл каждую итерацию берёт `SELECT pg_try_advisory_lock(42)`, при успехе вызывает `app/services/news_scheduler.py:20` `process_scheduled_posts` (`UPDATE ... WHERE status='scheduled' AND scheduled_at <= now() RETURNING id` — атомарно), затем `SELECT pg_advisory_unlock(42)`; при неуспехе — `logger.debug("news scheduler skipped: lock held")` и `rollback`.

Такое решение появилось как костыль от дубля при `deploy.replicas: 2` в `technozrelost-backend/infra/docker-compose.prod.yml:190` (два контейнера backend за `nginx:443` upstream `technozrelost_api` round-robin, каждый со своим event loop) и от теоретического `--workers>1` внутри одного контейнера. `advisory_lock(42)` — единственная общая точка координации: БД, переживает рестарты контейнера, не требует внешнего брокера. Комментарий в коде честно предупреждает (`app/main.py:64` «при replicas=2 только один инстанс обрабатывает», `infra/backend-entrypoint.sh:5` «один uvicorn-воркер на контейнер, масштабирование — репликами»), но `technozrelost-backend/Dockerfile` формально не запрещал `--workers`, а централизованного документа не было (I-01). Аудитор фиксирует риск: с `--workers=2` внутри одного хоста два воркера увидят БД как две конкурирующие сессии, `pg_try_advisory_lock` защитит от меж-контейнерного дубля, но дублирование планировщика внутри хоста — лишняя нагрузка и потенциальная гонка при неаккуратном рефакторе (снятие lock в конце итерации не сериализует «проверка+публикация» между воркерами одного хоста, если один воркер успеет освободить lock раньше, чем второй проверит окно 60с). Для B2G нужен явный контракт о масштабировании.

Смежные проблемы SPEC-07: P-15 `notify_news_published` уже батчует 500 (одна транзакция, `flush` per batch, не `add_all` 100K) — верифицирован, не OOM; I-02 LRU 5k в `auth_throttle.py` — Redis должен быть primary, LRU только fallback (отдельный guard warning, не здесь).

## Decision
- Оставляем in-process scheduler с `pg_try_advisory_lock(42)` / `pg_advisory_unlock(42)` как есть. Ключ `42` — выделенный singleton планировщика, не пересекается с `732018` миграций (`infra/backend-entrypoint.sh`) и другими lock-ами бэкапов. Транзакционный `pg_try_advisory_lock` (сессионный, но освобождаем явно в `finally`) достаточен: каждый контейнер — одна сессия на итерацию через `SessionLocal`, вторая реплика видит «lock held» и пропускает тик.
- Масштабирование — только горизонтально репликами (`docker-compose.prod.yml` `deploy.replicas: 2..4`, `db_pool_size=10` + `db_max_overflow=20` с учётом `db_app_replicas`). Вынос в отдельный `clock` sidecar (отдельный контейнер с тем же образом, запускающий только scheduler, без uvicorn-воркеров) — backlog P3, не в этом тикете; при появлении — убрать цикл из `lifespan` и оставить только sidecar.
- **Запрещаем `uvicorn --workers>1` внутри контейнера.** `technozrelost-backend/Dockerfile` (`CMD ["/app/backend-entrypoint.sh"]`) и `infra/backend-entrypoint.sh:128` (`exec uvicorn app.main:app --host 0.0.0.0 --port 8000`) остаются без `--workers`; в оба файла добавлен комментарий `workers>1 forbidden per ADR-0015 — single uvicorn worker per container, scale via replicas`. Любая попытка запустить `uvicorn --workers N` — нарушение контракта, требует выноса scheduler.
- Интервал 60с (`news_scheduler.py:17`) и логирование `skipped: lock held` / `news scheduler iteration failed` остаются — наблюдаемость через Prometheus/логи достаточна; P-15 batch 500 в `notifications.py:102` остаётся без изменения, добавлен `logger.info` per batch для трассировки (observability, не функциональность).
- `auth_throttle.py` LRU остаётся 5k, но добавлен `logger.warning` при `len(_attempts) > 4000` (early warning, I-02) и комментарий `Redis must for prod, LRU only fallback` — prod-контракт: Redis `throttle:*` INCR EXPIRE 60 — источник истины, in-memory — только при недоступности Redis.

## Consequences
**Положительные:** `scale backend=4` не дублирует публикации — `advisory lock` сериализует тик на уровне БД независимо от числа реплик; решение без внешних зависимостей (pg_cron, Celery, Rabbit) — один образ, один деплой-командой `deploy.sh`; контракт задокументирован для аудита 152-ФЗ/B2G — I-01 закрыт.

**Отрицательные / цена:** in-process scheduler живёт в каждом uvicorn-процессе — при `--workers>1` без выноса дубль внутри хоста (хотя lock снижает риск, но не убирает лишние попытки); зависимость от доступности Primary — при недоступности БД тик падает в `exception` и ждёт следующего 60с интервала (это правильно — статус в БД источник истины); нужен выделенный ключ `42` и договорённость не занимать его другими фичами; вынос в sidecar потребует изменения `lifespan` и отдельного сервиса в compose (P3).

**Что отвергли и почему:**
- *`pg_cron` (расширение Postgres, `SELECT cron.schedule`)* — отвергнуто: требует superuser/расширения на Primary, управление расписанием уходит в БД-миграции, теряется единый образ приложения, не тестируется в `pg-primary:5432` dev-контуре без расширения; нам нужен код приложения, а не DB-cron.
- *Celery Beat / RQ Scheduler + Redis* — отвергнуто: внешний брокер, дополнительная очередь, воркер-контейнер и мониторинг; несоразмерно для одного тика раз в 60с при пилотной базе; вернёмся при появлении тяжёлых фоновых задач (matching, LLM-очередь 0011).
- *Kubernetes CronJob / systemd timer на хосте* — отвергнуто: прод-стек — Docker Compose на bare-metal (infra `docker-compose.prod.yml`), хостовый cron ломает «одна команда поднимает контур» и не тестируется локально; при переезде на k8s пересмотрим.
- *`--workers>1` с lock внутри воркера* — отвергнуто: lock защищает меж-контейнерный дубль, но внутри хоста каждый воркер — отдельная asyncio-петля, гонка «освободил lock → второй воркер тут же взял и пере-обработал» при коротком окне; контракт проще — один воркер, масштаб репликами.
- *Убрать lock и надеяться на `UPDATE ... RETURNING` идемпотентность* — отвергнуто: `RETURNING id` идемпотентен (второй UPDATE вернёт 0 строк), но без lock две реплики параллельно дернут `notify_news_published` за одни и те же `id` в случае ретрая транзакции; lock дешевле и даёт явный `skipped` лог.

## References
- `technozrelost-backend/app/main.py:60` `_news_scheduler_loop` + `pg_try_advisory_lock(42)` / `pg_advisory_unlock(42)`, `lifespan` создание `asyncio.create_task`
- `technozrelost-backend/app/services/news_scheduler.py:1` `SCHEDULER_INTERVAL_SECONDS=60`, `process_scheduled_posts` атомарный `UPDATE ... RETURNING`
- `technozrelost-backend/app/services/notifications.py:102` `notify_news_published` batch 500, `technozrelost-backend/app/services/auth_throttle.py:1` LRU 5k warning
- `technozrelost-backend/Dockerfile:53` `CMD ["/app/backend-entrypoint.sh"]` — без `--workers`, коммент `workers>1 forbidden per ADR-0015`
- `technozrelost-backend/infra/backend-entrypoint.sh:4` коммент «один uvicorn-воркер на контейнер», `exec uvicorn ... --port 8000` без workers, `MIGRATION_LOCK=732018`
- `technozrelost-backend/infra/docker-compose.prod.yml:190` `backend` `deploy.replicas: 2`, `nginx` upstream `technozrelost_api`
- SPEC-07 `docs/remediation/specs/SPEC-07-scheduler-scale.md` (I-01, I-02, P-15), тикет `docs/remediation/tickets/TICKET-15-scheduler-adr.md`, FR-01..FR-04
- Альтернативы: `pg_cron` docs, Celery Beat, `infra/README-LOADTEST.md` профиль 70/20/8/2 — масштаб без дубля
