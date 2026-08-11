-- 0028_rag_governance.sql
-- Тикет 01 ai-rag: редакционный workflow базы знаний.
-- Жизненный цикл материала: draft -> (review) -> published -> retired.
-- retired исчезает из retrieval (search ищет только published),
-- история отзыва сохраняется в append-only rag_retired_log.
-- Публикация возможна только после prompt-injection review (is_ai_reviewed).

ALTER TABLE public.rag_documents
    ADD COLUMN IF NOT EXISTS status         TEXT        NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS version        INTEGER     NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS source_type    VARCHAR(32) NOT NULL DEFAULT 'doc',  -- gov | doc | center | manual | ...
    ADD COLUMN IF NOT EXISTS is_ai_reviewed BOOLEAN     NOT NULL DEFAULT FALSE,  -- prompt-injection review
    ADD COLUMN IF NOT EXISTS published_by   BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS published_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by    BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS retired_at     TIMESTAMPTZ;

COMMENT ON COLUMN public.rag_documents.status IS
    'Жизненный цикл материала: draft | published | retired.';
COMMENT ON COLUMN public.rag_documents.version IS
    'Версия материала (начинается с 1; растёт при редакции).';
COMMENT ON COLUMN public.rag_documents.source_type IS
    'Тип источника: gov | doc | center | manual | ...';
COMMENT ON COLUMN public.rag_documents.is_ai_reviewed IS
    'Prompt-injection review пройден — обязательное условие публикации.';
COMMENT ON COLUMN public.rag_documents.published_by IS
    'Кто опубликовал материал (staff).';
COMMENT ON COLUMN public.rag_documents.retired_at IS
    'Момент отзыва: retired-материал не попадает в retrieval.';

-- B-Tree: фильтр по статусу (основной запрос retrieval: status = 'published').
CREATE INDEX IF NOT EXISTS rag_documents_status_bidx
    ON public.rag_documents USING btree (status);

-- Backfill: существующие до миграции проиндексированные материалы остаются
-- доступными для поиска (сохраняем поведение до введения workflow).
UPDATE public.rag_documents
SET status = 'published'
WHERE status = 'draft' AND embedding IS NOT NULL;

-- Append-only журнал отозванных материалов: retired исчезает из retrieval
-- БЕЗ потери истории (audit-след отзыва).
CREATE TABLE IF NOT EXISTS public.rag_retired_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
    retired_by  BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    retired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason      TEXT
);

COMMENT ON TABLE public.rag_retired_log IS
    'Append-only журнал отозванных материалов базы знаний (тикет 01 ai-rag).';

CREATE INDEX IF NOT EXISTS rag_retired_log_document_bidx
    ON public.rag_retired_log USING btree (document_id, retired_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rag_retired_log TO technoz;
GRANT USAGE, SELECT ON SEQUENCE public.rag_retired_log_id_seq TO technoz;
