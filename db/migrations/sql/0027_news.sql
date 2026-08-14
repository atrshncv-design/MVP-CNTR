-- 0027_news.sql — Новостной раздел (спека §3.2, тикет 05)
-- Идемпотентно: CREATE ... IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Схема: public. Индексы: B-Tree для диапазонов/UNIQUE, Hash для точного
-- поиска по автору (конвенция проекта, AGENTS.md).

CREATE TABLE IF NOT EXISTS public.news_categories (
    id         BIGSERIAL PRIMARY KEY,
    slug       VARCHAR(80)  NOT NULL,
    name       VARCHAR(160) NOT NULL,
    sort_order INTEGER      NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_news_categories_slug
    ON public.news_categories (slug);

CREATE TABLE IF NOT EXISTS public.news_tags (
    id   BIGSERIAL PRIMARY KEY,
    slug VARCHAR(80)  NOT NULL,
    name VARCHAR(160) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_news_tags_slug
    ON public.news_tags (slug);

CREATE TABLE IF NOT EXISTS public.news_posts (
    id                   BIGSERIAL PRIMARY KEY,
    title                VARCHAR(200) NOT NULL,
    content              TEXT         NOT NULL,
    status               VARCHAR(20)  NOT NULL DEFAULT 'draft',
    category_id          BIGINT       REFERENCES public.news_categories (id) ON DELETE SET NULL,
    author_id            BIGINT       NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    cover_key            VARCHAR(255),
    published_at         TIMESTAMPTZ,
    scheduled_at         TIMESTAMPTZ,
    source               VARCHAR(10)  NOT NULL DEFAULT 'manual',
    created_automatically BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- B-Tree: диапазонные/групповые выборки (лента, фильтры).
CREATE INDEX IF NOT EXISTS ix_news_posts_status
    ON public.news_posts (status);
CREATE INDEX IF NOT EXISTS ix_news_posts_category_id
    ON public.news_posts (category_id);
CREATE INDEX IF NOT EXISTS ix_news_posts_published_at
    ON public.news_posts (published_at);
-- Hash: точный поиск по автору (права менеджера: свои новости).
CREATE INDEX IF NOT EXISTS ix_news_posts_author_id
    ON public.news_posts USING hash (author_id);

CREATE TABLE IF NOT EXISTS public.news_post_tags (
    post_id BIGINT NOT NULL REFERENCES public.news_posts (id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES public.news_tags (id)  ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.news_post_media (
    id          BIGSERIAL PRIMARY KEY,
    post_id     BIGINT       NOT NULL REFERENCES public.news_posts (id) ON DELETE CASCADE,
    storage_key VARCHAR(255) NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    mime_type   VARCHAR(127) NOT NULL,
    kind        VARCHAR(20)  NOT NULL DEFAULT 'inline',
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_news_post_media_post_id
    ON public.news_post_media (post_id);

-- Seed категорий (спека §3.2): «События», «Конкурсы», «Проекты»,
-- «Обучение», «Партнёрства».
INSERT INTO public.news_categories (slug, name, sort_order) VALUES
    ('sobytiya',    'События',     10),
    ('konkursy',    'Конкурсы',    20),
    ('proekty',     'Проекты',     30),
    ('obuchenie',   'Обучение',    40),
    ('partnerstva', 'Партнёрства', 50)
ON CONFLICT (slug) DO NOTHING;
