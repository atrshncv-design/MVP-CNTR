-- 0007_organizations_technologies.sql
-- Реестр исполнителей (организации из НИОКТР) и реестр технологий.
-- Спека mvp1-release §5: импорт выборки карточек НИОКТР в демо-реестры.

-- Организации-исполнители НИОКТР
CREATE TABLE IF NOT EXISTS public.organizations (
    id             BIGSERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    short_name     TEXT,
    ogrn           VARCHAR(32),
    org_type       VARCHAR(64),
    region         VARCHAR(128),
    competencies   JSONB NOT NULL DEFAULT '[]',
    projects_count INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS 'Организации-исполнители (источник: карточки НИОКТР, в перспективе — реестр малых техкомпаний УР).';
COMMENT ON COLUMN public.organizations.competencies IS 'Компетенции из ключевых слов карточек НИОКТР.';

-- Точный поиск по ОГРН — Hash Index (конвенция проекта)
CREATE INDEX IF NOT EXISTS uq_organizations_ogrn ON public.organizations (ogrn);
CREATE INDEX IF NOT EXISTS ix_organizations_name ON public.organizations (name);

-- Технологии (карточки НИОКТР как записи реестра)
CREATE TABLE IF NOT EXISTS public.technologies (
    id                  BIGSERIAL PRIMARY KEY,
    name                TEXT NOT NULL,
    description         TEXT,
    category            VARCHAR(100),
    keywords            JSONB NOT NULL DEFAULT '[]',
    current_level       SMALLINT NOT NULL DEFAULT 1,
    target_level        SMALLINT NOT NULL DEFAULT 9,
    status              VARCHAR(32) NOT NULL DEFAULT 'active',
    registration_number VARCHAR(64) UNIQUE,
    organization_id     BIGINT REFERENCES public.organizations(id),
    source_uri          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.technologies IS 'Реестр технологий (демо-источник: выборка карточек НИОКТР).';
COMMENT ON COLUMN public.technologies.registration_number IS 'Регистрационный номер карточки НИОКТР (уникален).';

-- Hash-индекс для точного поиска по номеру, B-Tree для диапазонов по уровню УГТ
CREATE INDEX IF NOT EXISTS ix_technologies_reg_number ON public.technologies (registration_number);
CREATE INDEX IF NOT EXISTS ix_technologies_current_level ON public.technologies (current_level);
CREATE INDEX IF NOT EXISTS ix_technologies_status ON public.technologies (status);
