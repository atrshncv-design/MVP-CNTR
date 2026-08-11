-- 0032_expert_workflow.sql
-- Тикет 02 operations-modules: реестр экспертов и базовое заключение.
-- Назначение эксперта на scope материалов проекта, декларация конфликта
-- интересов (COI), версионное заключение под контролем Центра (staff).
--
-- Решение по роли эксперта (зафиксировано): роль ugt_expert НЕ создаётся.
-- Пул экспертов = пользователи с верифицированным профилем
-- (user_profiles.state = 'verified', компетенции — user_profiles.skills);
-- назначение делает staff (cntr_manager/cntr_admin).

CREATE TABLE IF NOT EXISTS public.expert_assignments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    expert_user_id  BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scope           JSONB NOT NULL DEFAULT '{"stage_ids": [], "checkpoint_ids": []}'::jsonb,
    status          VARCHAR(32) NOT NULL DEFAULT 'assigned',
                    -- assigned | accepted | declined | submitted | reviewed
    assigned_by     BIGINT NOT NULL REFERENCES public.users(id),
    coi_declared    BOOLEAN,
    coi_declared_at TIMESTAMPTZ,
    conclusion_id   BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expert_conclusions (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id  BIGINT NOT NULL UNIQUE REFERENCES public.expert_assignments(id) ON DELETE CASCADE,
    content        TEXT NOT NULL DEFAULT '',
    version        INTEGER NOT NULL DEFAULT 1,
    status         VARCHAR(16) NOT NULL DEFAULT 'draft',
                   -- draft | submitted | approved
    submitted_at   TIMESTAMPTZ,
    reviewed_by    BIGINT REFERENCES public.users(id),
    reviewed_at    TIMESTAMPTZ,
    review_comment TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Круговая ссылка: assignment.conclusion_id → conclusions (заполняется при submit).
ALTER TABLE public.expert_assignments
    ADD CONSTRAINT expert_assignments_conclusion_id_fkey
    FOREIGN KEY (conclusion_id) REFERENCES public.expert_conclusions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expert_assignments_project_status
    ON public.expert_assignments (project_id, status);
CREATE INDEX IF NOT EXISTS idx_expert_assignments_expert_status
    ON public.expert_assignments (expert_user_id, status);
CREATE INDEX IF NOT EXISTS idx_expert_conclusions_status
    ON public.expert_conclusions (status);

COMMENT ON TABLE public.expert_assignments IS
    'Назначение эксперта на scope материалов проекта + COI + lifecycle (тикет 02 operations-modules).';
COMMENT ON TABLE public.expert_conclusions IS
    'Версионное заключение эксперта по назначению (1 строка на assignment, version инкрементируется).';
