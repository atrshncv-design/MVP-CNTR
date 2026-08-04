-- 0011_readiness_assessment.sql
-- Версионируемая анкета из 22 контрольных рубежей, ответы и доказательства.

CREATE TABLE public.assessment_templates (
    id BIGSERIAL PRIMARY KEY,
    version VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.assessment_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES public.assessment_templates (id) ON DELETE CASCADE,
    code VARCHAR(16) NOT NULL,
    order_no SMALLINT NOT NULL,
    ugt_level SMALLINT NOT NULL CHECK (ugt_level BETWEEN 1 AND 9),
    title VARCHAR(500) NOT NULL,
    explanation TEXT NOT NULL,
    dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
    critical BOOLEAN NOT NULL DEFAULT FALSE,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (template_id, code),
    UNIQUE (template_id, order_no)
);

CREATE INDEX ix_assessment_checkpoints_template_order
    ON public.assessment_checkpoints (template_id, order_no);
CREATE INDEX ix_assessment_checkpoints_ugt_level
    ON public.assessment_checkpoints (ugt_level);

CREATE TABLE public.project_assessments (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL UNIQUE REFERENCES public.projects (id) ON DELETE CASCADE,
    template_id BIGINT NOT NULL REFERENCES public.assessment_templates (id),
    template_version VARCHAR(64) NOT NULL,
    preliminary_ugt SMALLINT NOT NULL DEFAULT 0 CHECK (preliminary_ugt BETWEEN 0 AND 9),
    completion_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    evidence_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    confidence_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    latest_checkpoint SMALLINT NOT NULL DEFAULT 0 CHECK (latest_checkpoint BETWEEN 0 AND 22),
    not_applicable_count SMALLINT NOT NULL DEFAULT 0,
    dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    level_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
    blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_project_assessments_preliminary_ugt
    ON public.project_assessments (preliminary_ugt);

CREATE TABLE public.assessment_answers (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT NOT NULL REFERENCES public.project_assessments (id) ON DELETE CASCADE,
    checkpoint_id BIGINT NOT NULL REFERENCES public.assessment_checkpoints (id),
    checkpoint_code VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    applicable BOOLEAN NOT NULL DEFAULT TRUE,
    comment TEXT,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    score_pct DOUBLE PRECISION,
    evidence_pct DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (assessment_id, checkpoint_id)
);

CREATE INDEX ix_assessment_answers_assessment
    ON public.assessment_answers (assessment_id);
CREATE INDEX ix_assessment_answers_checkpoint
    ON public.assessment_answers (checkpoint_code);
