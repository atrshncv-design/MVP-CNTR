-- N-16: per-user questionnaire — изоляция записей анкеты по пользователю
-- До: UNIQUE (project_id, level_id) общий; любой участник перезаписывал.
-- После: добавляем user_id, бэкфилим старым записям created_by проекта, меняем уникальность.

-- 1. Колонка user_id (nullable для обратной совместимости)
ALTER TABLE public.questionnaire_results
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Бэкфил старых строк → владелец проекта
UPDATE public.questionnaire_results qr
SET user_id = p.created_by
FROM public.projects p
WHERE qr.project_id = p.id AND qr.user_id IS NULL;

-- 3. Индекс для per-user выборок
CREATE INDEX IF NOT EXISTS ix_questionnaire_results_user_id ON public.questionnaire_results (user_id);
CREATE INDEX IF NOT EXISTS ix_questionnaire_results_project_level_user ON public.questionnaire_results (project_id, level_id, user_id);

-- 4. Замена уникальности: старая uq_project_level → новая с user_id
ALTER TABLE public.questionnaire_results DROP CONSTRAINT IF EXISTS uq_project_level;
-- UNIQUE с nullable user_id: PostgreSQL считает NULL различными, поэтому старые NULL-строки
-- после бэкфила уже не NULL; для будущей строгости constraint с тремя колонками
ALTER TABLE public.questionnaire_results DROP CONSTRAINT IF EXISTS uq_project_level_user;
ALTER TABLE public.questionnaire_results
    ADD CONSTRAINT uq_project_level_user UNIQUE (project_id, level_id, user_id);
