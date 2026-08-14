-- 0028_achievements.sql — Каталог достижений (спека §4.2, тикет 01)
-- Идемпотентно: CREATE ... IF NOT EXISTS.
-- Схема: public. Индексы: UNIQUE B-Tree по slug (slug = icon_key),
-- B-Tree по group/rarity (групповые/редкостные выборки каталога и витрины).
-- ВНИМАНИЕ: `group` — зарезервированное слово PostgreSQL, экранировано "group".

CREATE TABLE IF NOT EXISTS public.achievements (
    id          BIGSERIAL    PRIMARY KEY,
    slug        VARCHAR(80)  NOT NULL,
    title       VARCHAR(160) NOT NULL,
    description TEXT         NOT NULL,
    "group"     VARCHAR(30)  NOT NULL,
    rarity      VARCHAR(20)  NOT NULL DEFAULT 'common',
    sector_slug VARCHAR(40),
    threshold   INTEGER,
    ugt_level   INTEGER,
    secret      BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    icon_key    VARCHAR(80)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_achievements_slug
    ON public.achievements (slug);

CREATE INDEX IF NOT EXISTS ix_achievements_group
    ON public.achievements ("group");

CREATE INDEX IF NOT EXISTS ix_achievements_rarity
    ON public.achievements (rarity);
