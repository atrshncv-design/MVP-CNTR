# infra/

Инфраструктура платформы «Технозрелость».

## Состав
- `docker-compose.yml` — PostgreSQL Primary (запись, :5432) + Replica (чтение, :5433) с pgvector.
- `postgres/` — конфиги, init-скрипт primary, старт-скрипт replica (streaming replication через pg_basebackup + физический слот `tz_replica_slot`).
- `nginx/nginx.conf` — шаблон балансировщика перед API-серверами (активируется в Фазе 3).

## Управление
```bash
docker compose -f infra/docker-compose.yml up -d        # поднять БД
docker compose -f infra/docker-compose.yml ps           # статус
docker compose -f infra/docker-compose.yml logs -f pg-primary
docker compose -f infra/docker-compose.yml down         # остановить (данные в volumes сохраняются)
```

## Архитектура БД (CLAUDE.md / PRD)
- **Primary** — единственная точка записи.
- **Replica** — hot standby, только чтение (read-only transaction); приложение направляет SELECT на неё.
- **pgvector** — расширение для RAG (эмбеддинги 1536-dim, индекс ivfflat).
- **Схемы**: `public` (продакшн), `test` (гипотезы).
- **Идентификаторы**: `Serial` / `BigSerial`.
- **Индексы**: `Hash` (точный поиск), `B-Tree` (диапазоны), `ivfflat` (KNN по векторам).