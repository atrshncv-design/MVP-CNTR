-- 0014_nioktr_cards.sql
-- Реестр карточек НИОКТР (полный массив 2025, 16 582 карточки).
-- Модель: app/db/models.py -> NioktrCard (колонки/типы совпадают 1:1).

CREATE TABLE IF NOT EXISTS public.nioktr_cards (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_number VARCHAR(64) NOT NULL,
    name                TEXT NOT NULL,
    annotation          TEXT,
    keywords            JSONB NOT NULL DEFAULT '[]',
    nioktr_types        JSONB NOT NULL DEFAULT '[]',
    state_program       TEXT,
    federal_program     TEXT,
    created_date        VARCHAR(32),
    start_date          VARCHAR(32),
    end_date            VARCHAR(32),
    is_ai_area          BOOLEAN NOT NULL DEFAULT FALSE,
    is_ai_usage         BOOLEAN NOT NULL DEFAULT FALSE,
    executor_name       TEXT,
    executor_short_name TEXT,
    executor_ogrn       TEXT,
    executor_territory  TEXT,
    customer_name       TEXT,
    budgets             JSONB NOT NULL DEFAULT '[]',
    organization_id     BIGINT REFERENCES public.organizations(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nioktr_cards IS 'Реестр карточек НИОКТР (источник: массив 2025).';
COMMENT ON COLUMN public.nioktr_cards.registration_number IS 'Регистрационный номер карточки НИОКТР (уникален).';

-- Точный поиск по регистрационному номеру (unique => B-Tree, конвенция проекта)
CREATE UNIQUE INDEX IF NOT EXISTS uq_nioktr_cards_registration_number
    ON public.nioktr_cards (registration_number);

-- B-Tree: поиск по названию (ILIKE %search%)
CREATE INDEX IF NOT EXISTS idx_nioktr_cards_name
    ON public.nioktr_cards (name);

-- GIN: JSONB-поиск по ключевым словам (contains)
CREATE INDEX IF NOT EXISTS idx_nioktr_cards_keywords
    ON public.nioktr_cards USING gin (keywords);

-- B-Tree: фильтр по ИИ-направлению (is_ai_area)
CREATE INDEX IF NOT EXISTS idx_nioktr_cards_ai
    ON public.nioktr_cards (is_ai_area);
