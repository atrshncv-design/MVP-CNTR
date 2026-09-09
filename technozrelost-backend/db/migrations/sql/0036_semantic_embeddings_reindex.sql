-- 0034_semantic_embeddings_reindex.sql (таск 12, R05i история 14).
-- Офлайн-модель semantic-ru-v2: нормализация, стоп-слова, стемминг RU,
-- канонические синонимы техдомена, TF-взвешивание, биграммы, L2-норма.
-- Размерность 1536 НЕ меняется — индекс pgvector согласован без
-- пересоздания; векторы пересчитываются идемпотентным скриптом
-- scripts/reindex_rag_embeddings.py (перезапись, детерминировано).
-- Миграция только фиксирует модель в комментарии и гарантирует наличие
-- частичных ivfflat-индексов по контуру (идемпотентно, IF NOT EXISTS).

COMMENT ON COLUMN public.rag_documents.embedding IS
    'Вектор эмбеддинга (pgvector, dim=1536, модель semantic-ru-v2: стемминг RU + синонимы + TF).';

CREATE INDEX IF NOT EXISTS rag_documents_embedding_tuno_ivfflat
    ON public.rag_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE contour = 'tuno';

CREATE INDEX IF NOT EXISTS rag_documents_embedding_kaba_ivfflat
    ON public.rag_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE contour = 'kaba';
