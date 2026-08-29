-- 0032_questionnaire_read_isolation: изоляция чтения анкеты (TICKET-07, M-02)
-- После 0030 per-user user_id был nullable для обратной совместимости; бэкфил
-- старых строк → projects.created_by уже выполнен, но повторно — для идемпотентности
-- перед SET NOT NULL (иначе upgrade упадёт на оставшихся NULL). Индекс
-- ix_questionnaire_results_user_id уже создан в 0030, но IF NOT EXISTS — безопасно.
-- SPEC-03 FR-04: после backfill user_id NOT NULL.

-- 1. Повторный бэкфил NULL → created_by проекта (идемпотентно)
UPDATE public.questionnaire_results qr
SET user_id = p.created_by
FROM public.projects p
WHERE qr.project_id = p.id AND qr.user_id IS NULL;

-- 2. Строгая схема: user_id обязателен
ALTER TABLE public.questionnaire_results ALTER COLUMN user_id SET NOT NULL;

-- 3. Индекс для per-user выборок (member where user_id == current) — B-Tree по умолчанию
CREATE INDEX IF NOT EXISTS ix_questionnaire_results_user_id ON public.questionnaire_results (user_id);
-- Композит уже есть из 0030, но на случай ручного дропа — восстановим
CREATE INDEX IF NOT EXISTS ix_questionnaire_results_project_level_user
    ON public.questionnaire_results (project_id, level_id, user_id);
