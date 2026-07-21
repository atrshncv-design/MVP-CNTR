-- 0005_rag_metadata.sql
-- Add template_metadata JSONB to rag_documents for variable definitions.
-- This enables the document generator to map questionnaire data to template placeholders.

ALTER TABLE public.rag_documents
    ADD COLUMN IF NOT EXISTS template_metadata JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.rag_documents.template_metadata
    IS 'Метаданные переменных шаблона: список переменных с именем, типом, источником (поле опросника/проекта).';
