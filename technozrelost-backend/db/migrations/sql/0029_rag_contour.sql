-- 0029_rag_contour.sql (R22, интервью 04): контур tuno/kaba для RAG.
-- Один столбец contour TEXT CHECK(tuno,kaba) DEFAULT 'tuno' + backfill
-- и два частичных ivfflat-индекса WHERE contour = ... изолируют поиск
-- (реестры vs ГОСТ). Частичный индекс работает как WHERE в SQL_SEARCH_KNN
-- rag.py:26 — планировщик использует соответствующий индекс по контуру.
-- Выполняется после 0028, имена не конфликтуют с 0002/0027/0028.

-- Столбец контура: 'tuno' — Туно (реестры), 'kaba' — Каба (ГОСТ/методология)
-- IF NOT EXISTS — идемпотентность для повторного прогона в dev.
ALTER TABLE public.rag_documents
    ADD COLUMN IF NOT EXISTS contour VARCHAR(16) NOT NULL DEFAULT 'tuno';

-- Ограничение значений контура (Hash/B-Tree по конвенции AGENTS.md — точный поиск).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_contour_check'
    ) THEN
        ALTER TABLE public.rag_documents
            ADD CONSTRAINT rag_documents_contour_check CHECK (contour IN ('tuno', 'kaba'));
    END IF;
END $$;

-- Backfill существующих строк (до миграции столбец отсутствовал → DEFAULT 'tuno' уже проставлен,
-- но для строк с NULL/пустым — явно выставляем 'tuno').
UPDATE public.rag_documents SET contour = 'tuno' WHERE contour IS NULL OR contour NOT IN ('tuno', 'kaba');

-- Два частичных ivfflat-индекса по контуру ( WHERE — ключ изоляции, образец 0028).
-- cosine_ops — косинусная мера как в 0002_rag_documents.sql; lists=100 как в исходном.
CREATE INDEX IF NOT EXISTS rag_documents_embedding_tuno_ivfflat
    ON public.rag_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE contour = 'tuno';

CREATE INDEX IF NOT EXISTS rag_documents_embedding_kaba_ivfflat
    ON public.rag_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    WHERE contour = 'kaba';
