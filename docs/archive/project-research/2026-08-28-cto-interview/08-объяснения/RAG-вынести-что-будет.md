# RAG вынести — что будет

## Сейчас (монолит)
RAG в `app/services/rag.py:26` `search_documents` + `ai_assistant.py:31` `ask_llm` + `embeddings.py` хеш 1536 + `rag_documents` `vector(1536)` `ivfflat` один индекс `0002_rag_documents.sql:36`, один `LLM_MODEL` `config.py:57`. Вызов внутри `stages.py:320` транзакции 60с.

## Если вынести в микросервис `rag-service`
**Что появится:**
- Отдельный репо `rag-service` FastAPI `POST /search` `POST /upsert` `POST /chat/tuno|kaba`, своя БД `pgvector` с двумя индексами `WHERE contour`, свой `LLM_MODEL` `tuno/kaba`.
- Независимое масштабирование: можно дать GPU под `embed_text` (сейчас хеш, не GigaChat), кэш векторов.
- Health отдельно `GET /health` RAG.

**Что сломается/усложнится:**
- +1 деплой `deploy.sh` `IMAGE_TAG`, +1 `health-gate`, +1 `alerter` check `ALERTER_RAG_URL`, +1 `alembic` (2 БД)
- Транзакция `stages._trigger_application` `db.commit` + RAG `upsert` — не атомарно, нужен outbox (как R3) иначе `PromotionRequest` создался, а RAG не записался
- Solo on-call x2: ночью RAG упал — кто чинит? Ты один `bus-factor=1` `Q7`
- Сеть: `backend -> rag-service` +1 хоп 20мс, `pg_trgm` `P-05` уже без RAG ищет

## Для тебя solo до 10К
**Не выносить** до 10К (как в 13-): выделить только воркер `python -m app.workers.llm` той же БД, `queue:llm-eval` Redis, 2 процесса одного образа. Это не микросервис — горизонтальное шардирование монолита, 1 репо, 1 `alembic`, 1 `deploy.sh`.
**После 10К + найм второго бэка:** выносить RAG первым (когда rag_documents >100K и нужен ANN/HNSW + GPU).

Вынос RAG сейчас — недели распила вместо 2 дней локов/очередей `13-`, без выгоды на 5К.
