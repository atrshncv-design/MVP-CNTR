-- 0010_new_core.sql
-- Новое ядро (тикеты 20-25): словарь требований этапов УГТ, заявки на повышение,
-- верифицирующие документы регулирующей организации, уведомления, переименование роли.

-- ── Словарь требований этапов: 8 переходов N→N+1 ─────────────────────────────
CREATE TABLE public.stage_requirements (
    id BIGSERIAL PRIMARY KEY,
    from_level SMALLINT NOT NULL,
    to_level SMALLINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_level, to_level)
);

CREATE INDEX ix_stage_requirements_from_level
    ON public.stage_requirements (from_level);  -- B-Tree: выборка этапа проекта

INSERT INTO public.stage_requirements (from_level, to_level, title, description) VALUES
    (1, 2, 'Технологическая концепция',
     'Обоснована технологическая концепция; определены возможные применения; проведён анализ принципиальной реализуемости (ГОСТ Р 58048-2017, п. 5.2).'),
    (2, 3, 'Критические функции',
     'Определены и подтверждены критические функции; сформулированы требования к компонентам; аналитическое/экспериментальное доказательство осуществимости (п. 5.3).'),
    (3, 4, 'Лабораторная проверка',
     'Компоненты проверены в лабораторных условиях; характеристики соответствуют требованиям; оформлены протоколы испытаний (п. 5.4).'),
    (4, 5, 'Верификация в реальных условиях',
     'Компоненты интегрированы и верифицированы в условиях, близких к реальным; подтверждена совместимость с существующими системами (п. 5.5).'),
    (5, 6, 'Системный прототип',
     'Создан системный прототип; испытания в моделируемых условиях пройдены; подтверждена производительность ключевых характеристик (п. 5.6).'),
    (6, 7, 'Полевые испытания',
     'Прототип испытан в реальной эксплуатационной среде; достигнут уровень масштабного образца; оформлены акты испытаний (п. 5.7).'),
    (7, 8, 'Завершение и квалификация',
     'Технология завершена и квалифицирована; системы интегрированы и проверены на реальных объектах; подготовлена эксплуатационная документация (п. 5.8).'),
    (8, 9, 'Успешная эксплуатация',
     'Технология доказала работоспособность в серийной эксплуатации; зафиксированы показатели надёжности и эффективности (п. 5.9).');

-- ── Проекты: предварительный УГТ и причина отклонения черновика ──────────────
ALTER TABLE public.projects
    ADD COLUMN preliminary_level SMALLINT,
    ADD COLUMN rejection_reason TEXT;

CREATE INDEX ix_projects_preliminary_level
    ON public.projects (preliminary_level);  -- B-Tree: фильтр по уровню
CREATE INDEX ix_projects_status
    ON public.projects (status);             -- B-Tree: очереди и реестры

-- ── Документы проекта: привязка к требованию этапа ───────────────────────────
ALTER TABLE public.project_documents
    ADD COLUMN stage_requirement_id BIGINT REFERENCES public.stage_requirements (id);

CREATE INDEX ix_project_documents_stage_requirement
    ON public.project_documents (stage_requirement_id);  -- B-Tree: комплектность этапа

-- ── Заявки на повышение УГТ (лента статусов, история попыток) ────────────────
CREATE TABLE public.promotion_requests (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    from_level SMALLINT NOT NULL,
    to_level SMALLINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'docs_uploaded',  -- docs_uploaded→pre_evaluated→pending_manager→approved|rejected
    rejection_reason TEXT,
    manager_id BIGINT REFERENCES public.users (id),
    attempt_no INTEGER NOT NULL DEFAULT 1,
    evaluation_result JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_promotion_requests_project
    ON public.promotion_requests (project_id);  -- B-Tree: история попыток по проекту
CREATE INDEX ix_promotion_requests_status
    ON public.promotion_requests (status);      -- B-Tree: очередь менеджера

-- ── Верифицирующие документы регулирующей организации ────────────────────────
CREATE TABLE public.verification_documents (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    uploader_id BIGINT NOT NULL REFERENCES public.users (id),
    title VARCHAR(255) NOT NULL,
    comment TEXT,
    file_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_verification_documents_project
    ON public.verification_documents (project_id);  -- B-Tree: материалы очереди
CREATE INDEX ix_verification_documents_uploader
    ON public.verification_documents (uploader_id);

-- ── In-app уведомления ───────────────────────────────────────────────────────
CREATE TABLE public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_notifications_user_read
    ON public.notifications (user_id, is_read);  -- B-Tree: лента «мои, непрочитанные»

-- ── Переименование роли: Эксперт УГТ → Регулирующая организация ──────────────
UPDATE public.roles
SET slug = 'regulating_organization', name = 'Регулирующая организация'
WHERE slug = 'ugt_expert';
-- user_roles ссылаются на role_id — пользователи сохраняются автоматически.
