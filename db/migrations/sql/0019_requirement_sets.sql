-- 0019_requirement_sets.sql
-- Тикет 07 Friday RC: снимок версий документов в заявке, версия справочника
-- комплектов, защита от дубликатов неизменённого комплекта.

-- Версия фиксированного универсального справочника документов этапов
ALTER TABLE public.stage_requirements
    ADD COLUMN IF NOT EXISTS template_version VARCHAR(16) NOT NULL DEFAULT 'v1';

-- Снимок версий документов на момент заявки (неизменяемый)
CREATE TABLE IF NOT EXISTS public.promotion_request_documents (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    promotion_request_id  BIGINT NOT NULL
        REFERENCES public.promotion_requests(id) ON DELETE CASCADE,
    project_document_id   BIGINT NOT NULL
        REFERENCES public.project_documents(id) ON DELETE CASCADE,
    document_version      INT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.promotion_request_documents IS
    'Неизменяемый снимок версий документов, с которыми создана заявка.';

-- B-Tree: документы заявки
CREATE INDEX IF NOT EXISTS idx_promotion_request_docs_request
    ON public.promotion_request_documents (promotion_request_id);

-- Уникальность: одна запись на документ в заявке
CREATE UNIQUE INDEX IF NOT EXISTS uq_promotion_request_docs
    ON public.promotion_request_documents (promotion_request_id, project_document_id);
