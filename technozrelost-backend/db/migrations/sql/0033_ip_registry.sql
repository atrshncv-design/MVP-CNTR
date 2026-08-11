-- 0033_ip_registry.sql
-- Тикет 03 operations-modules: реестр РИД (результаты интеллектуальной
-- деятельности). Конфиденциальная карточка РИД: правообладатель
-- (user_organizations — legacy-контур org, provisional), проект, статусы/даты,
-- авторы (пользователь платформы ИЛИ внешний), файлы-документы (file_storage).
--
-- Решения (зафиксированы в коде и verification-report):
-- * Предупреждения («истёк», «правообладатель не указан») НЕ хранятся —
--   вычисляются детерминированно при чтении (app/services/ip_registry.py,
--   чистые функции, unit-тесты на граничные даты; без LLM).
-- * Авторы: user_id (пользователь платформы) ИЛИ name (внешний автор);
--   по ТЗ — обычный B-Tree индекс (ip_asset_id, user_id), без UNIQUE
--   (UNIQUE(ip_asset_id, COALESCE(user_id,0)) невозможен в PostgreSQL).
-- * project_id / owner_organization_id — ON DELETE SET NULL: карточка РИД
--   переживает удаление проекта/организации (реестровая сущность).
-- * ip_documents.document_id — ссылка на project_documents (может быть NULL:
--   файл загружается напрямую в file_storage, строка ip_documents — запись).

CREATE TABLE IF NOT EXISTS public.ip_assets (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title                 VARCHAR(255) NOT NULL,
    type                  VARCHAR(32) NOT NULL,
                          -- patent | software | know-how | trademark | design
    project_id            BIGINT REFERENCES public.projects(id) ON DELETE SET NULL,
    owner_organization_id BIGINT REFERENCES public.user_organizations(id) ON DELETE SET NULL,
    status                VARCHAR(32) NOT NULL DEFAULT 'draft',
                          -- draft | registered | protected | expired | transferred
    registration_number   VARCHAR(128),
    application_date      DATE,
    registration_date     DATE,
    expiry_date           DATE,
    restrictions          TEXT,
    created_by            BIGINT NOT NULL REFERENCES public.users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ip_authors (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip_asset_id  BIGINT NOT NULL REFERENCES public.ip_assets(id) ON DELETE CASCADE,
    user_id      BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
                 -- NULL → внешний автор (заполняется name)
    name         VARCHAR(255),
    contribution TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ip_documents (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip_asset_id BIGINT NOT NULL REFERENCES public.ip_assets(id) ON DELETE CASCADE,
    document_id BIGINT REFERENCES public.project_documents(id) ON DELETE SET NULL,
    title       VARCHAR(255) NOT NULL,
    storage_key TEXT,
    mime        VARCHAR(128),
    sha256      VARCHAR(64),
    scan_status VARCHAR(16) NOT NULL DEFAULT 'pending',
                -- pending | clean | infected | error
    uploaded_by BIGINT NOT NULL REFERENCES public.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B-Tree по FK/статусам (точный поиск по FK — B-Tree; FK-колонки без UNIQUE).
CREATE INDEX IF NOT EXISTS idx_ip_assets_owner_organization
    ON public.ip_assets (owner_organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_assets_project
    ON public.ip_assets (project_id);
CREATE INDEX IF NOT EXISTS idx_ip_assets_status
    ON public.ip_assets (status);
CREATE INDEX IF NOT EXISTS idx_ip_authors_asset_user
    ON public.ip_authors (ip_asset_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ip_documents_asset
    ON public.ip_documents (ip_asset_id);
CREATE INDEX IF NOT EXISTS idx_ip_documents_scan_status
    ON public.ip_documents (scan_status);

COMMENT ON TABLE public.ip_assets IS
    'Карточка РИД: правообладатель, проект, статусы/даты, ограничения (тикет 03 operations-modules).';
COMMENT ON TABLE public.ip_authors IS
    'Авторы РИД: пользователь платформы (user_id) или внешний автор (name); ПДн маскируются по ролям.';
COMMENT ON TABLE public.ip_documents IS
    'Файлы РИД (file_storage + антивирус); доступ — участник проекта/владелец org/staff.';
