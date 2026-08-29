# API / БД / Очередь / Кэш — на твоём коде

## API — дверь
Frontend `src/lib/public-api.ts:30` `CLIENT_API_BASE` -> `fetch /api/v1/projects` -> `nginx:443` -> `backend:8000` `app/main.py` ~25 роутеров `app/api/v1/*.py`. API — контракт: что отдать, какие поля, какие коды (200/403/413).

## БД — сейф
PostgreSQL 16 `pgvector/pgvector:0.8.0-pg16`:
- Primary :5432 запись (создать проект, загрузить документ `stages.py:373`)
- Replica :5433 чтение реестров `get_read_db()` `app/core/database.py:21` (930 RPS чтения не бьют запись)
- `max_connections=100` `postgresql-primary.conf:12` + пул `10+20` `config.py:38` -> 2 реплики 70 <100, 8 реплик 250 >100 -> нужен pgbouncer
- Индексы: Hash по id/email `0027`, B-Tree по датам, GIN trgm по ILIKE `P-05` `nioktr.py:56`, ivfflat vector `rag_documents`

## Очередь — конвейер
Когда 2 юзера жмут одновременно (R2 stages.py:203 дубль PromotionRequest, R8 news 5К fan-out, R3 LLM 60с держит транзакцию), нужна очередь:
- Redis FIFO `compose:112` `queue:llm-eval` + DB outbox `FOR UPDATE SKIP LOCKED` `notifications.py:67` -> воркер вне транзакции, 202 Accepted, не держит пул
- Пример: _trigger_application пишет job в outbox той же транзакцией, воркер читает и зовет ask_llm вне транзакции

## Кэш — полка
Redis `compose:112` сейчас пустой `P-09`. Справочники 66 медалей `seed_achievements.py:28` каждый запрос бьют БД. Кэш: `GET /achievements/catalog` -> Redis 5м + ETag. Очередь и кэш — разные: очередь разгружает запись, кэш ускоряет чтение.

Итого: API дверь, БД сейф (Primary запись/Replica чтение), очередь конвейер для гонок, кэш полка для чтения.
