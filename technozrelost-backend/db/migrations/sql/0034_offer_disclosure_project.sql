-- 0034_offer_disclosure_project.sql
-- Тикет 04 requests-matching: управляемый контакт и связанный проект.
-- Модели: app/db/models.py -> TechRequestOffer / TechRequestDisclosure /
--         TechRequestProject.
--
-- Жизненный цикл: staff отправляет кандидату ОБЕЗЛИЧЕННОЕ предложение
-- (tech_request_offers, без контактов и закрытых полей); согласие кандидата
-- (accept) создаёт запрос на раскрытие (tech_request_disclosures pending);
-- решение staff/создателя (approved/denied) раскрывает контакты или
-- отклоняет с причиной; связанный проект (tech_request_projects) хранит
-- ЯВНО выбранные наследуемые поля (selected_fields JSONB).

CREATE TABLE IF NOT EXISTS public.tech_request_offers (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id   BIGINT NOT NULL REFERENCES public.tech_requests(id) ON DELETE CASCADE,
    candidate_id BIGINT NOT NULL REFERENCES public.users(id),
    status       VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending | accepted | declined
    message      TEXT,                                    -- обезличенное сопроводительное письмо
    offered_by   BIGINT NOT NULL REFERENCES public.users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT uq_tech_request_offers UNIQUE (request_id, candidate_id),
    CONSTRAINT chk_tech_request_offers_status
        CHECK (status IN ('pending', 'accepted', 'declined'))
);

-- B-Tree по внешним ключам и статусу (выборки: офферы запроса / кандидата).
CREATE INDEX IF NOT EXISTS idx_tech_request_offers_request
    ON public.tech_request_offers (request_id);
CREATE INDEX IF NOT EXISTS idx_tech_request_offers_candidate
    ON public.tech_request_offers (candidate_id);
CREATE INDEX IF NOT EXISTS idx_tech_request_offers_status
    ON public.tech_request_offers (status);

CREATE TABLE IF NOT EXISTS public.tech_request_disclosures (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offer_id     BIGINT NOT NULL REFERENCES public.tech_request_offers(id) ON DELETE CASCADE,
    requested_by BIGINT NOT NULL REFERENCES public.users(id),  -- кандидат, давший согласие
    status       VARCHAR(16) NOT NULL DEFAULT 'pending',      -- pending | approved | denied
    decided_by   BIGINT REFERENCES public.users(id),
    decided_at   TIMESTAMPTZ,
    reason       TEXT,                                        -- причина отказа
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tech_request_disclosures_status
        CHECK (status IN ('pending', 'approved', 'denied'))
);

-- B-Tree по FK оффера и статусу (очередь решений staff).
CREATE INDEX IF NOT EXISTS idx_tech_request_disclosures_offer
    ON public.tech_request_disclosures (offer_id);
CREATE INDEX IF NOT EXISTS idx_tech_request_disclosures_status
    ON public.tech_request_disclosures (status);

CREATE TABLE IF NOT EXISTS public.tech_request_projects (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id     BIGINT NOT NULL REFERENCES public.tech_requests(id) ON DELETE CASCADE,
    offer_id       BIGINT NOT NULL REFERENCES public.tech_request_offers(id),
    project_id     BIGINT NOT NULL REFERENCES public.projects(id),
    created_by     BIGINT NOT NULL REFERENCES public.users(id),
    selected_fields JSONB NOT NULL DEFAULT '{}',  -- {проектное_поле: источник_поля_запроса}
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B-Tree по FK: связь запрос→проект, оффер→проект, проект→запрос.
CREATE INDEX IF NOT EXISTS idx_tech_request_projects_request
    ON public.tech_request_projects (request_id);
CREATE INDEX IF NOT EXISTS idx_tech_request_projects_offer
    ON public.tech_request_projects (offer_id);
CREATE INDEX IF NOT EXISTS idx_tech_request_projects_project
    ON public.tech_request_projects (project_id);

COMMENT ON TABLE public.tech_request_offers IS
    'Обезличенные предложения кандидатам (тикет 04 requests-matching): без контактов и закрытых полей; одно на пару (request, candidate).';
COMMENT ON TABLE public.tech_request_disclosures IS
    'Ручное разрешение раскрытия контактов/полей кандидату (тикет 04 requests-matching).';
COMMENT ON TABLE public.tech_request_projects IS
    'Связь технологический запрос -> проект с явно выбранными наследуемыми полями (тикет 04 requests-matching).';
