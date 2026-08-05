-- 0022_nioktr_source.sql
-- Тикет 11 Friday RC: внешние записи НИОКТР показывают источник и дату импорта.

ALTER TABLE public.nioktr_cards
    ADD COLUMN IF NOT EXISTS source      TEXT         NOT NULL DEFAULT 'МИНОБРНАУКИ России',
    ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ  NOT NULL DEFAULT now();
