-- 0033_request_candidate_decisions.sql
-- Тикет 03 requests-matching: решения менеджера по кандидатам matcher'а.
-- Модель: app/db/models.py -> TechRequestCandidateDecision.
-- Решение (shortlist/reject) пишется ОТДЕЛЬНОЙ записью, исходные данные
-- кандидата и запроса не изменяются; UNIQUE (request_id, candidate_id) —
-- одно решение на пару (повторное решение → 409 на уровне API).

CREATE TABLE IF NOT EXISTS public.tech_request_candidate_decisions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id   BIGINT NOT NULL REFERENCES public.tech_requests(id) ON DELETE CASCADE,
    candidate_id BIGINT NOT NULL REFERENCES public.users(id),
    decision     VARCHAR(16) NOT NULL,        -- shortlist | reject
    note         TEXT,
    decided_by   BIGINT NOT NULL REFERENCES public.users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tech_request_candidate_decisions UNIQUE (request_id, candidate_id),
    CONSTRAINT chk_tech_request_candidate_decisions
        CHECK (decision IN ('shortlist', 'reject'))
);

COMMENT ON TABLE public.tech_request_candidate_decisions IS
    'Решения по кандидатам matcher (тикет 03 requests-matching): shortlist/reject, одно на пару (request, candidate).';

-- B-Tree: выборка решений по запросу и статусу решения (список shortlist и т.п.).
CREATE INDEX IF NOT EXISTS idx_tech_request_candidate_decisions_request_decision
    ON public.tech_request_candidate_decisions (request_id, decision);
