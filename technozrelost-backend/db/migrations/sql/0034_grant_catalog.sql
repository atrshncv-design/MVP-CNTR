-- 0034_grant_catalog.sql
-- Тикет 04 operations-modules: проверяемый каталог мер поддержки.
-- Программа меры поддержки с источником, датой актуальности, ответственным
-- (user_organizations — legacy-контур org, provisional), УГТ-диапазоном,
-- категориями, checklist готовности и прогрессом пользователя.
--
-- Решения (зафиксированы в коде и verification-report):
-- * Статус жизненного цикла: draft | published | confirmed. Публикация
--   (support_program.published) требует actuality_date (иначе 422);
--   подтверждение (support_program.confirmed) — только после публикации (409).
--   Создание/редактирование/публикация/подтверждение/удаление — только
--   служебная роль cntr_admin/cntr_manager (иначе 403).
-- * «Устарело»/рекомендация НЕ хранятся — вычисляются детерминированно при
--   чтении (app/services/support_catalog.py, чистые функции, unit-тесты
--   границ вчера/сегодня/завтра; без LLM): actuality_date < today → stale,
--   recommendation=false; сегодня — ещё актуально весь день.
-- * checklist прогресс хранится локально (completed — массив позиций) и НЕ
--   отправляется на внешний портал (никаких внешних вызовов в коде).
-- * categories — JSONB-массив строк; B-Tree-индексы по ТЗ + GIN для
--   фильтрации «категория содержится в массиве».
-- * responsible_org_id ON DELETE SET NULL: программа переживает удаление
--   организации (каталожная сущность).

CREATE TABLE IF NOT EXISTS public.support_programs (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    source_url        TEXT,
    source_name       VARCHAR(255),
    actuality_date    DATE,
    responsible_org_id BIGINT REFERENCES public.user_organizations(id) ON DELETE SET NULL,
    target_ugt_min    SMALLINT CHECK (target_ugt_min BETWEEN 0 AND 9),
    target_ugt_max    SMALLINT CHECK (target_ugt_max BETWEEN 0 AND 9),
    categories        JSONB NOT NULL DEFAULT '[]'::jsonb,
    eligibility       TEXT,
    status            VARCHAR(16) NOT NULL DEFAULT 'draft',
                      -- draft | published | confirmed
    published_by      BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    published_at      TIMESTAMPTZ,
    created_by        BIGINT NOT NULL REFERENCES public.users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_program_checklists (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES public.support_programs(id) ON DELETE CASCADE,
    item       TEXT NOT NULL,
    position   INT NOT NULL,
    UNIQUE (program_id, position)
);

CREATE TABLE IF NOT EXISTS public.support_program_checklist_progress (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES public.support_programs(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    completed  JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (program_id, user_id)
);

-- B-Tree по ТЗ: (actuality_date), (published_at), (target_ugt_min, target_ugt_max).
CREATE INDEX IF NOT EXISTS idx_support_programs_actuality_date
    ON public.support_programs (actuality_date);
CREATE INDEX IF NOT EXISTS idx_support_programs_published_at
    ON public.support_programs (published_at);
CREATE INDEX IF NOT EXISTS idx_support_programs_ugt
    ON public.support_programs (target_ugt_min, target_ugt_max);
-- GIN для фильтра «категория содержится в categories» (JSONB-контейнерность).
CREATE INDEX IF NOT EXISTS idx_support_programs_categories
    ON public.support_programs USING GIN (categories jsonb_path_ops);
-- B-Tree по FK (точный поиск; FK-колонки без UNIQUE).
CREATE INDEX IF NOT EXISTS idx_support_programs_responsible_org
    ON public.support_programs (responsible_org_id);
CREATE INDEX IF NOT EXISTS idx_support_program_checklists_program
    ON public.support_program_checklists (program_id);
CREATE INDEX IF NOT EXISTS idx_support_program_progress_program
    ON public.support_program_checklist_progress (program_id);
CREATE INDEX IF NOT EXISTS idx_support_program_progress_user
    ON public.support_program_checklist_progress (user_id);

COMMENT ON TABLE public.support_programs IS
    'Мера поддержки с источником/датой актуальности/ответственным (тикет 04 operations-modules); «устарело» вычисляется при чтении.';
COMMENT ON TABLE public.support_program_checklists IS
    'Checklist готовности программы (позиции 0..N); прогресс — в support_program_checklist_progress.';
COMMENT ON TABLE public.support_program_checklist_progress IS
    'Локальный прогресс пользователя по checklist (completed — массив позиций); наружу НЕ отправляется.';
