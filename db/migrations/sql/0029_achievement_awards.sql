-- 0029_achievement_awards.sql — Механика наградчиков достижений (спека §4.2, тикет 02)
-- Идемпотентно: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Схема: public.
-- user_achievements: персональные медали. Hash-индексы по user_id/achievement_id
-- (точный поиск), UNIQUE B-Tree (user_id, achievement_id, event_ref) — защита
-- от дублей «одна медаль за одно событие». PostgreSQL считает NULL-значения
-- event_ref различными, поэтому логическую дедупликацию «медаль выдаётся один
-- раз» дополнительно проверяет сервис наградчиков (app/services/achievements.py).
-- project_achievements: командные медали проекта, UNIQUE (project_id, achievement_id).

CREATE TABLE IF NOT EXISTS public.user_achievements (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    achievement_id BIGINT       NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    project_id     BIGINT       REFERENCES public.projects(id) ON DELETE CASCADE,
    event_ref      VARCHAR(120),
    times          INTEGER      NOT NULL DEFAULT 1,
    awarded_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_achievements_user_achievement_event
    ON public.user_achievements (user_id, achievement_id, event_ref);

CREATE INDEX IF NOT EXISTS ix_user_achievements_user_id_hash
    ON public.user_achievements USING hash (user_id);

CREATE INDEX IF NOT EXISTS ix_user_achievements_achievement_id_hash
    ON public.user_achievements USING hash (achievement_id);

CREATE INDEX IF NOT EXISTS ix_user_achievements_project_id_hash
    ON public.user_achievements USING hash (project_id);

CREATE TABLE IF NOT EXISTS public.project_achievements (
    id             BIGSERIAL    PRIMARY KEY,
    project_id     BIGINT       NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    achievement_id BIGINT       NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    awarded_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_achievements_project_achievement
    ON public.project_achievements (project_id, achievement_id);

CREATE INDEX IF NOT EXISTS ix_project_achievements_project_id_hash
    ON public.project_achievements USING hash (project_id);

CREATE INDEX IF NOT EXISTS ix_project_achievements_achievement_id_hash
    ON public.project_achievements USING hash (achievement_id);
