-- 0002_rag_documents.sql
-- Фундамент RAG-хранилища: таблица шаблонов/документов ЦНТР (ГОСТ, методики, ТЗ).
-- Демонстрирует конвенции: BigSerial PK, Hash-индекс по content_hash,
-- B-Tree по created_at и уровню УГТ, ivfflat-индекс по вектору эмбеддинга.

CREATE TABLE IF NOT EXISTS public.rag_documents (
    id            BigSerial   PRIMARY KEY,
    title         VARCHAR(512) NOT NULL,
    doc_type      VARCHAR(64)  NOT NULL,                -- 'gost' | 'template_tz' | 'template_passport' | 'template_teo' | 'methodology'
    ugt_level     SmallInt,                              -- 1..9 (NULL для общих методик)
    content_hash  CHAR(64)      NOT NULL,                -- sha256(raw_text)
    raw_text      TEXT         NOT NULL,
    embedding     vector(1536),                           -- pgvector; 1536 — размерность модели эмбеддинга
    source_uri    VARCHAR(1024),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.rag_documents IS 'RAG-база знаний ЦНТР: шаблоны ТЗ/Паспорта/ТЭО, ГОСТ Р 58048-2017, методики.';
COMMENT ON COLUMN public.rag_documents.ugt_level IS 'Уровень готовности технологии 1..9 по ГОСТ Р 58048-2017; NULL — общие документы.';
COMMENT ON COLUMN public.rag_documents.embedding  IS 'Вектор эмбеддинга (pgvector, dim=1536).';

-- Hash: точный поиск дубликатов по хэшу содержимого.
CREATE INDEX IF NOT EXISTS rag_documents_content_hash_hidx
    ON public.rag_documents USING hash (content_hash);

-- B-Tree: фильтр по типу документа + диапазон по дате создания.
CREATE INDEX IF NOT EXISTS rag_documents_type_created_bidx
    ON public.rag_documents USING btree (doc_type, created_at);

-- B-Tree: диапазон по уровню УГТ (1..9).
CREATE INDEX IF NOT EXISTS rag_documents_ugt_bidx
    ON public.rag_documents USING btree (ugt_level);

-- ivfflat: векторный поиск KNN (косинусное расстояние).
CREATE INDEX IF NOT EXISTS rag_documents_embedding_ivfflat
    ON public.rag_documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rag_documents TO technoz;
GRANT USAGE, SELECT ON SEQUENCE public.rag_documents_id_seq TO technoz;