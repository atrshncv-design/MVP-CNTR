-- 0021_publication_consent.sql
-- Тикет 10 Friday RC: публикация проектов с согласием владельца.
-- УГТ 1–2 публикуется после авто-подтверждения; УГТ 3–9 — после решения
-- менеджера. Предварительный уровень показывается опционально.

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS is_public        BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS show_preliminary BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS published_at     TIMESTAMPTZ;
