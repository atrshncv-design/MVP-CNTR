-- 0018_file_storage.sql
-- Тикет 06 Friday RC: файловые метаданные документов (MinIO + ClamAV).
-- Внутреннее имя объекта (storage_key), пользовательское имя (file_name) —
-- только метаданные; размер, фактический MIME, SHA-256 и статус скана.

ALTER TABLE public.project_documents
    ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE public.project_documents
    ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE public.project_documents
    ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.project_documents
    ADD COLUMN IF NOT EXISTS mime_type VARCHAR(128);
ALTER TABLE public.project_documents
    ADD COLUMN IF NOT EXISTS sha256 VARCHAR(64);
ALTER TABLE public.project_documents
    ADD COLUMN IF NOT EXISTS scan_status VARCHAR(16) NOT NULL DEFAULT 'pending';
ALTER TABLE public.project_documents
    ADD COLUMN IF NOT EXISTS scan_result TEXT;

COMMENT ON COLUMN public.project_documents.storage_key IS
    'Внутреннее имя объекта в MinIO (UUID, не раскрывает пользовательское имя).';
COMMENT ON COLUMN public.project_documents.scan_status IS
    'pending/clean/infected/error — только clean учитывается как доказательство.';

-- B-Tree: версии документов проекта
CREATE INDEX IF NOT EXISTS idx_project_documents_project_version
    ON public.project_documents (project_id, version);

-- Hash: точный поиск объекта хранилища
CREATE INDEX IF NOT EXISTS idx_project_documents_storage_key
    ON public.project_documents USING hash (storage_key);
