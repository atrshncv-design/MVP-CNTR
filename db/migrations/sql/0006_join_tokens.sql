-- 0006_join_tokens.sql
-- Механика вступления в проект (спека mvp1-release §4):
--   * projects.join_token — уникальный случайный токен вида TZ-XXXXXX (ключ доступа к проекту);
--   * project_members.status — active | pending | removed;
--   * project_members.invited_by — кто пригласил/по чьей ссылке вступил;
--   * project_members.is_priority — приоритетный участник (авто-приём, одобрение заявок);
--   * уникальность (project_id, user_id) — один участник = одна запись.

-- 1. Join-токен проекта
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS join_token VARCHAR(16);

-- Бэкафилл существующих проектов случайными токенами
UPDATE public.projects
SET join_token = 'TZ-' || upper(substr(md5(random()::text), 1, 6))
WHERE join_token IS NULL;

ALTER TABLE public.projects
    ALTER COLUMN join_token SET NOT NULL;

-- Уникальность токена (неугадываемость + защита от дублей)
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_join_token
    ON public.projects (join_token);

COMMENT ON COLUMN public.projects.join_token
    IS 'Join-токен проекта (TZ-XXXXXX): ключ доступа для вступления. Приоритетный шаринг = авто-вступление, ручной ввод = заявка.';

-- 2. Поля участника проекта
ALTER TABLE public.project_members
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS invited_by BIGINT REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.project_members.status
    IS 'Статус членства: active (участник), pending (заявка на вступление), removed (исключён/отклонён).';
COMMENT ON COLUMN public.project_members.invited_by
    IS 'Пользователь, по чьей ссылке/токену вступил участник (null — создатель проекта).';
COMMENT ON COLUMN public.project_members.is_priority
    IS 'Приоритетный участник: видит заявки, одобряет вступление, может авто-принимать по своей ссылке.';

-- Один участник — одна запись по проекту (уникальность уже обеспечена
-- констрейнтом uq_project_user из миграции 0004).
