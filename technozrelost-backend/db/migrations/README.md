# Миграции БД

Слой миграций имеет **два эквивалентных представления** одного источника истины:

1. `sql/*.sql` — декларативные SQL-файлы (читаемые, аудит-friendly).
2. `../alembic/versions/*.py` — Alembic-ревизии, выполняющие те же `.sql`-файлы
   через `op.execute`. Это канонический рантайм-инструмент.

## Применение

```bash
# Канонический путь (FastAPI-окружение):
uv run alembic upgrade head

# Прямой SQL (CI / аудит):
POSTGRES_PASSWORD=... ./db/migrations/apply.sh
```

## Конвенции (CLAUDE.md)
- ID: `Serial` / `BigSerial`
- Hash-индекс — точный поиск (`content_hash`, `email`, `filename`)
- B-Tree-индекс — диапазоны (`created_at`, `ugt_level`, даты)
- pgvector (`vector(N)`) — векторный поиск KNN через `ivfflat` / `hnsw`

## Реестр миграций
| Файл | Назначение |
| ---- | ---------- |
| `0001_init_schemas.sql` | Схемы `public`/`test`, расширения `vector` + `pg_trgm`, журнал миграций. |
| `0002_rag_documents.sql` | Таблица `public.rag_documents` (BigSerial PK, pgvector, Hash/B-Tree/ivfflat). |