-- 0034_status_checks.sql (P2, таск 14): CHECK жизненных циклов.
-- Свободные строки гниют тихо: невалидный статус отклоняется БД, а не кодом.
-- Наборы собраны из кода (API/создание/решения) плюс legacy-данные:
--   projects: draft/auto_confirmed/published/approved/rejected/archived
--     + active/completed (считает executors.py) + review (legacy в данных, код не создаёт).
--   project_documents: draft (default) / uploaded (files.py) / active (stages.py).
--   promotion_requests: docs_uploaded/pre_evaluated/evaluation_unavailable/
--     pending_manager/approved/rejected (stages.py + manager.py + 0010/0013).
--   control_points: pending (default) / approved|rejected (ControlPointDecisionIn).
-- Идемпотентно (IF NOT EXISTS через DO-блок); downgrade снимает ограничения.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_check') THEN
        ALTER TABLE public.projects ADD CONSTRAINT projects_status_check CHECK (
            status IN ('draft', 'auto_confirmed', 'published', 'approved',
                       'rejected', 'archived', 'completed', 'active', 'review')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_status_check') THEN
        ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_status_check CHECK (
            status IN ('draft', 'uploaded', 'active')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_requests_status_check') THEN
        ALTER TABLE public.promotion_requests ADD CONSTRAINT promotion_requests_status_check CHECK (
            status IN ('docs_uploaded', 'pre_evaluated', 'evaluation_unavailable',
                       'pending_manager', 'approved', 'rejected')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_points_status_check') THEN
        ALTER TABLE public.control_points ADD CONSTRAINT control_points_status_check CHECK (
            status IN ('pending', 'approved', 'rejected')
        );
    END IF;
END
$$;
