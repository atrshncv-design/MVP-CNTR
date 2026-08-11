-- 0031_tech_requests.sql
-- Тикет 01 requests-matching: черновик технологического запроса заказчика.
-- Модель: app/db/models.py -> TechRequest / TechRequestDocument.
-- Только верифицированный представитель организации (user_organizations.state='verified')
-- с ролью gk_customer создаёт запрос; черновик видят создатель и Центр (staff);
-- submit фиксирует запрос (draft -> submitted, правки закрыты).

CREATE TABLE IF NOT EXISTS public.tech_requests (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_by      BIGINT NOT NULL REFERENCES public.users(id),
    organization_id BIGINT NOT NULL REFERENCES public.user_organizations(id) ON DELETE RESTRICT,
    title           VARCHAR(255) NOT NULL,
    requirements    TEXT NOT NULL,
    demand          TEXT,
    deadline        TIMESTAMPTZ NOT NULL,
    budget          NUMERIC(15, 2),
    status          VARCHAR(16) NOT NULL DEFAULT 'draft',  -- draft | submitted
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tech_requests IS
    'Технологический запрос заказчика (draft/submitted; тикет 01 requests-matching).';

-- Hash: точный поиск запросов по владельцу и организации
-- Композитный индекс: PostgreSQL НЕ поддерживает hash на нескольких колонках
-- (FeatureNotSupported) — B-Tree покрывает и точный поиск по (created_by, organization_id),
-- и запросы с диапазонами (правило CLAUDE.md: B-Tree по умолчанию).
CREATE INDEX IF NOT EXISTS idx_tech_requests_owner
    ON public.tech_requests (created_by, organization_id);

-- B-Tree: очереди по статусу (черновики / отправленные)
CREATE INDEX IF NOT EXISTS idx_tech_requests_status
    ON public.tech_requests (status, created_at);

CREATE TABLE IF NOT EXISTS public.tech_request_documents (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id  BIGINT NOT NULL REFERENCES public.tech_requests(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    storage_key TEXT,
    file_name   VARCHAR(255),
    file_size   BIGINT,
    mime_type   VARCHAR(128),
    sha256      VARCHAR(64),
    scan_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    version     INTEGER NOT NULL DEFAULT 1,
    uploaded_by BIGINT REFERENCES public.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tech_request_documents IS
    'Вложения технологического запроса (версионируются по title; тикет 01).';

CREATE INDEX IF NOT EXISTS idx_tech_request_documents_request
    ON public.tech_request_documents (request_id, title, version);
