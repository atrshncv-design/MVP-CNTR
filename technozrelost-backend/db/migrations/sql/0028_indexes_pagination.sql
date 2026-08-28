-- 0028_indexes_pagination.sql (P-05): индексы для ILIKE/trgm, JSONB, Hash/B-Tree.
-- Каждый индекс отвечает конкретному фильтру из API; образец — 0027.
-- Выполняется после 0027, поэтому имена не конфликтуют с существующими.

-- pg_trgm уже создан в 0001, но для изолированного прогона — IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ILIKE '%search%' по имени карточки НИОКТР (nioktr.py:56) и организации (nioktr.py:87)
-- Gin + gin_trgm_ops ускоряет ILIKE с ведущим %.
CREATE INDEX IF NOT EXISTS ix_nioktr_cards_name_trgm
    ON public.nioktr_cards USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_nioktr_cards_customer_name_trgm
    ON public.nioktr_cards USING gin (customer_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_organizations_name_trgm
    ON public.organizations USING gin (name gin_trgm_ops);

-- JSONB-поиск по типам НИОКТР (nioktr.py:60 contains)
CREATE INDEX IF NOT EXISTS ix_nioktr_cards_nioktr_types
    ON public.nioktr_cards USING gin (nioktr_types);

-- Точный поиск организации по ОГРН — Hash Index (конвенция проекта, AGENTS.md)
CREATE INDEX IF NOT EXISTS ix_organizations_ogrn_hash
    ON public.organizations USING hash (ogrn);

-- Фильтр по ИИ-направлению — B-Tree по умолчанию для флагов/диапазонов
CREATE INDEX IF NOT EXISTS ix_nioktr_cards_is_ai_area_btree
    ON public.nioktr_cards USING btree (is_ai_area);
