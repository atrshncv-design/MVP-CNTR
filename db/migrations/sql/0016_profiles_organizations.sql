-- 0016_profiles_organizations.sql
-- Личные профили, пользовательские организации и членство (тикет 03 Friday RC).
-- Модель: app/db/models.py -> UserProfile / UserOrganization / OrganizationMember.

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    headline       VARCHAR(255),
    bio            TEXT,
    region         VARCHAR(128),
    skills         JSONB NOT NULL DEFAULT '[]'::jsonb,
    state          VARCHAR(16) NOT NULL DEFAULT 'draft',
    review_comment TEXT,
    reviewed_by    BIGINT REFERENCES public.users(id),
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS
    'Личный профессиональный профиль (draft/pending/verified/rejected).';

-- У пользователя ровно один профиль: уникальный B-Tree (точный поиск по user_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_user_id
    ON public.user_profiles (user_id);

-- B-Tree: очередь проверки по статусу
CREATE INDEX IF NOT EXISTS idx_user_profiles_state
    ON public.user_profiles (state);

CREATE TABLE IF NOT EXISTS public.user_organizations (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           TEXT NOT NULL,
    short_name     VARCHAR(255),
    ogrn           VARCHAR(32),
    org_type       VARCHAR(64),
    region         VARCHAR(128),
    description    TEXT,
    state          VARCHAR(16) NOT NULL DEFAULT 'draft',
    review_comment TEXT,
    created_by     BIGINT NOT NULL REFERENCES public.users(id),
    reviewed_by    BIGINT REFERENCES public.users(id),
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_organizations IS
    'Организации пользователей платформы (отдельно от справочника НИОКТР).';

CREATE INDEX IF NOT EXISTS idx_user_organizations_state
    ON public.user_organizations (state);

-- Hash: точный поиск по ОГРН (неуникальный)
CREATE INDEX IF NOT EXISTS idx_user_organizations_ogrn
    ON public.user_organizations USING hash (ogrn);

CREATE TABLE IF NOT EXISTS public.organization_members (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL REFERENCES public.user_organizations(id) ON DELETE CASCADE,
    role_in_org     VARCHAR(32) NOT NULL DEFAULT 'member',
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_members IS
    'Членство пользователей в пользовательских организациях (многие ко многим).';

-- Уникальное членство (user_id, organization_id) — уникальный B-Tree
CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_members_user_org
    ON public.organization_members (user_id, organization_id);

-- Hash: точный поиск участников организации
CREATE INDEX IF NOT EXISTS idx_organization_members_org
    ON public.organization_members USING hash (organization_id);
