-- 0017_project_invites_admin.sql
-- Тикет 04 Friday RC: полномочие project_admin, договорные поля проекта,
-- одноразовые и массовые приглашения.

-- 1) Полномочие project_admin в project_members (создатель получает при создании)
ALTER TABLE public.project_members
    ADD COLUMN IF NOT EXISTS is_project_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Договорные поля проекта (заполняет только менеджер по основанию договора)
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS legal_owner TEXT;
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS rights_holder TEXT;
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS contract_number VARCHAR(128);
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS contract_basis TEXT;
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS legal_updated_by BIGINT REFERENCES public.users(id);
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS legal_updated_at TIMESTAMPTZ;

-- 3) Приглашения: одноразовые (single) и массовые (bulk) с лимитом и отзывом
CREATE TABLE IF NOT EXISTS public.project_invites (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id    BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by    BIGINT NOT NULL REFERENCES public.users(id),
    token         VARCHAR(32) NOT NULL,
    invite_type   VARCHAR(16) NOT NULL DEFAULT 'single',
    allowed_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_uses      INT NOT NULL DEFAULT 1,
    used_count    INT NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_invites IS
    'Приглашения в проект: single — одноразовое, bulk — массовое с лимитом и отзывом.';

-- Точный поиск по токену (уникальный B-Tree, конвенция проекта)
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_invites_token
    ON public.project_invites (token);

-- B-Tree: список приглашений проекта
CREATE INDEX IF NOT EXISTS idx_project_invites_project
    ON public.project_invites (project_id);
