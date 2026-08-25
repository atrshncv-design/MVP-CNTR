-- 0027_performance_indexes.sql (таск 06): индексы горячих путей реестров.
-- Каждый индекс отвечает конкретному ORDER BY/WHERE из API-запросов.

-- GET /api/v1/projects/registry: WHERE is_public ORDER BY current_level DESC, updated_at DESC
CREATE INDEX IF NOT EXISTS ix_projects_public_registry
    ON public.projects (current_level DESC, updated_at DESC)
    WHERE is_public;

-- Фильтр реестра ?category=
CREATE INDEX IF NOT EXISTS ix_projects_category ON public.projects (category);

-- GET /api/v1/projects: список проектов пользователя (WHERE user_id);
-- uq_project_user ведёт по (project_id, user_id) и для этого фильтра не годится.
CREATE INDEX IF NOT EXISTS ix_project_members_user_id
    ON public.project_members (user_id);

-- GET /api/v1/nioktr: ORDER BY created_date DESC NULLS LAST, id DESC (+limit/offset)
CREATE INDEX IF NOT EXISTS ix_nioktr_cards_created_date
    ON public.nioktr_cards (created_date DESC NULLS LAST, id DESC);

-- Карточки организации: коррелят count(*) и выборка по organization_id
CREATE INDEX IF NOT EXISTS ix_nioktr_cards_organization_id
    ON public.nioktr_cards (organization_id);

-- Публичная лента: WHERE status='published' ORDER BY published_at DESC, id DESC
CREATE INDEX IF NOT EXISTS ix_news_posts_status_published
    ON public.news_posts (status, published_at DESC NULLS LAST, id DESC);

-- ix_news_posts_status из 0024 поглощён композитом выше: его левый префикс
-- (status) покрывает любой план одиночного btree по status. Дубликат дропаем;
-- downgrade 0027 восстанавливает исходный индекс.
DROP INDEX IF EXISTS public.ix_news_posts_status;
