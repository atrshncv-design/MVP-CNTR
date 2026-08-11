-- BE-LOGIC-001: Partial unique index to prevent duplicate active
-- PromotionRequest rows for the same project + from_level.
-- Only enforces uniqueness among non-terminal statuses.
CREATE UNIQUE INDEX IF NOT EXISTS uq_promotion_requests_active_stage
ON public.promotion_requests (project_id, from_level)
WHERE status IN ('docs_uploaded', 'pre_evaluated', 'evaluation_unavailable', 'pending_manager');
