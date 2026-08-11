-- 0024_project_operations.sql
-- Тикет 01 operations-modules: универсальное сопровождение проекта.
-- Этап сопровождения (project_stages), задачи этапа (stage_tasks),
-- привязка контрольных точек и документов-доказательств к этапу.
-- Просрочки/прогресс считаются на сервере детерминированно (без LLM) —
-- производные статусы в БД не хранятся.

CREATE TABLE IF NOT EXISTS public.project_stages (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id         BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    from_level         SMALLINT NOT NULL DEFAULT 0,
    to_level           SMALLINT NOT NULL DEFAULT 1,
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    status             VARCHAR(32) NOT NULL DEFAULT 'planned',  -- planned | in_progress | completed
    responsible_id     BIGINT REFERENCES public.users(id),
    planned_start_date DATE,
    planned_end_date   DATE,
    actual_start_date  DATE,
    actual_end_date    DATE,
    plan_result        JSONB NOT NULL DEFAULT '{}'::jsonb,
    fact_result        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by         BIGINT REFERENCES public.users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stage_tasks (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stage_id     BIGINT NOT NULL REFERENCES public.project_stages(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    status       VARCHAR(32) NOT NULL DEFAULT 'todo',  -- todo | in_progress | done
    assignee_id  BIGINT REFERENCES public.users(id),
    due_date     DATE,
    completed_at TIMESTAMPTZ,
    created_by   BIGINT REFERENCES public.users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.control_points
    ADD COLUMN IF NOT EXISTS stage_id BIGINT REFERENCES public.project_stages(id) ON DELETE CASCADE;
ALTER TABLE public.control_points
    ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.control_points
    ADD COLUMN IF NOT EXISTS weight SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.project_documents
    ADD COLUMN IF NOT EXISTS stage_id BIGINT REFERENCES public.project_stages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_project_stages_project
    ON public.project_stages (project_id);
CREATE INDEX IF NOT EXISTS idx_stage_tasks_stage
    ON public.stage_tasks (stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_tasks_due
    ON public.stage_tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_control_points_stage
    ON public.control_points (stage_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_stage
    ON public.project_documents (stage_id);

COMMENT ON TABLE public.project_stages IS
    'Этап сопровождения проекта: ответственный, сроки, план/факт, статус (тикет 01 operations-modules).';
COMMENT ON TABLE public.stage_tasks IS
    'Задачи этапа сопровождения: исполнитель, срок, статус, аудит (тикет 01 operations-modules).';
