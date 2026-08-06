-- 0003_rbac.sql
-- RBAC для 9 ролей платформы (PRD §3, ГОСТ Р 58048-2017).
-- Конвенции (CLAUDE.md):
--   * ID: Serial / BigSerial.
--   * Hash-индекс — точный поиск (email, role slug, user_id).
--   * B-Tree — диапазонные/сортировочные запросы (created_at, last_login_at).
--   * ORM (SQLAlchemy) — единый путь в рантайме.

-- 1. Роли (9 штук из PRD).
CREATE TABLE IF NOT EXISTS public.roles (
    id            Serial        PRIMARY KEY,
    role_no       SmallInt      NOT NULL UNIQUE,                -- 1..9 (номер из PRD)
    slug          VARCHAR(64)    NOT NULL UNIQUE,                -- 'gk_customer' и т.д.
    name          VARCHAR(128)  NOT NULL,
    description   TEXT,
    priority      SmallInt      NOT NULL DEFAULT 0,             -- P0/P1/P2 (P2 — ограниченный функционал)
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles IS '9 ролей пользователей платформы (PRD §3): 1=ГосКомпания, 2=R&D-исп., 3=Научная орг, 4=Серийный произв., 5=Эксперт УГТ, 6=Аудитор, 7=Инвестор, 8=Админ ЦНТР, 9=Менеджер ЦНТР.';

-- Уникальные slug для точного поиска — Hash-индекс.
CREATE INDEX IF NOT EXISTS roles_slug_hidx
    ON public.roles USING hash (slug);

-- B-Tree по priority для выборки «какие роли P2».
CREATE INDEX IF NOT EXISTS roles_priority_bidx
    ON public.roles USING btree (priority);

-- 2. Разрешения (гранулярные действия в системе).
CREATE TABLE IF NOT EXISTS public.permissions (
    id            Serial        PRIMARY KEY,
    slug          VARCHAR(96)   NOT NULL UNIQUE,                 -- 'project.create', 'doc.tz.approve', ...
    name          VARCHAR(128)  NOT NULL,
    description   TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS permissions_slug_hidx
    ON public.permissions USING hash (slug);

-- 3. Связь_role ↔ permission (many-to-many).
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id       Int           NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
    permission_id Int           NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- Hash по role_id — точечная выборка прав роли.
CREATE INDEX IF NOT EXISTS role_permissions_role_hidx
    ON public.role_permissions USING hash (role_id);

-- 4. Пользователи.
CREATE TABLE IF NOT EXISTS public.users (
    id            BigSerial     PRIMARY KEY,
    email         VARCHAR(254)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,                        -- bcrypt/argon2 (!не хранить plaintext)
    full_name     VARCHAR(255)  NOT NULL,
    organization  VARCHAR(255),
    is_active     Boolean       NOT NULL DEFAULT TRUE,
    is_superuser  Boolean       NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

COMMENT ON COLUMN public.users.password_hash IS 'Хэш пароля (bcrypt/argon2). Plaintext нигде не хранится (152-ФЗ).';

-- Email — уникальный的自然ный ключ, точный поиск при логине.
-- Уникальность через B-Tree (PostgreSQL не поддерживает unique hash-index),
-- плюс дублирующий Hash-индекс для точечного lookup'а по правилу CLAUDE.md §2.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx
    ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS users_email_hidx
    ON public.users USING hash (email);

-- B-Tree по created_at — реестр/диапазонные запросы.
CREATE INDEX IF NOT EXISTS users_created_at_bidx
    ON public.users USING btree (created_at);

-- B-Tree по last_login_at — аудит «давно не заходил».
CREATE INDEX IF NOT EXISTS users_last_login_at_bidx
    ON public.users USING btree (last_login_at);

-- 5. Связь user ↔ role (у пользователя может быть несколько ролей,
--    но в MVP v2 упрощаем до одной primary role через флаг is_primary).
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id      BigInt        NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    role_id      Int           NOT NULL REFERENCES public.roles (id) ON DELETE RESTRICT,
    is_primary   Boolean       NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS user_roles_user_hidx
    ON public.user_roles USING hash (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_bidx
    ON public.user_roles USING btree (role_id);
-- Гарантия одной primary role на пользователя.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_primary_uq
    ON public.user_roles (user_id) WHERE is_primary;

-- 6. Привилегии.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles, public.permissions, public.role_permissions, public.users, public.user_roles TO technoz;
GRANT USAGE, SELECT ON SEQUENCE public.roles_id_seq, public.permissions_id_seq, public.users_id_seq TO technoz;

-- 7. Сидинг 9 ролей (PRD §3).
INSERT INTO public.roles (role_no, slug, name, description, priority) VALUES
    (1, 'gk_customer',          'ГосКомпания-заказчик',         'Поиск компетенций и контроль; создание ПТЗ, мониторинг УГТ, согласование ТЗ/Актов.', 0),
    (2, 'rd_executor',          'R&D-исполнитель',              'Получение заказов и НИОКР; профиль (УГТ 3-6), загрузка технических отчетов.', 0),
    (3, 'scientific_org',       'Научная организация',          'НИР-контракты (ВУЗ/НИИ); витрина кейсов, Мини-ТЗ (Limited v2).', 2),
    (4, 'serial_manufacturer',  'Серийный производитель',       'Технологии УГТ 7+; каталог КД, запрос лицензий, приёмка в серию.', 0),
    (5, 'ugt_expert',           'Эксперт УГТ',                  'Верификация уровней; чек-листы ГОСТ, загрузка актов верификации.', 0),
    (6, 'auditor',              'Аудитор',                      'Контроль КТ-1; доступ к ТЭО и Паспорту, решение go/no-go (Mockup).', 2),
    (7, 'investor',             'Инвестор',                     'Поиск активов для вложений; фильтры реестра технологий, аналитика зрелости.', 1),
    (8, 'cntr_admin',           'Администратор ЦНТР',           'Техническое управление; управление RBAC, логирование, биллинг.', 0),
    (9, 'cntr_manager',         'Менеджер ЦНТР',                'Оркестрация проектов; модерация пайплайна, коммуникация, валидация ИИ.', 1)
ON CONFLICT (role_no) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority;

-- 8. Базовый набор разрешений и маппинг по роль_права доступа.
INSERT INTO public.permissions (slug, name) VALUES
    ('project.create',         'Создание проекта/ПТЗ'),
    ('project.view',           'Просмотр проектов'),
    ('project.moderate',       'Модерация пайплайна проекта'),
    ('doc.tz.create',          'Формирование ТЗ'),
    ('doc.tz.approve',         'Утверждение ТЗ'),
    ('doc.passport.generate',  'Генерация Паспорта проекта'),
    ('doc.teo.generate',       'Генерация ТЭО'),
    ('doc.verify_report.upload', 'Загрузка акта верификации УГТ'),
    ('doc.verify.sign',        'Подписание акта верификации УГТ'),
    ('registry.technology.view', 'Просмотр реестра технологий'),
    ('registry.technology.manage', 'Управление реестром технологий'),
    ('catalog.executors.view', 'Просмотр каталога исполнителей'),
    ('audit.kt1.decide',       'Решение go/no-go по КТ-1'),
    ('rbac.manage',            'Управление ролями и доступом'),
    ('billing.manage',         'Управление биллингом'),
    ('log.view',               'Просмотр логов'),
    ('ai.validate',            'Валидация ИИ-сгенерированного контента')
ON CONFLICT (slug) DO NOTHING;

-- Маппинг role → permissions (упрощённая модель прав по PRD).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
CROSS JOIN public.permissions p
WHERE
    -- ГосКомпания-заказчик
    (r.slug='gk_customer' AND p.slug IN ('project.create','project.view','doc.tz.approve','registry.technology.view','catalog.executors.view'))
    -- R&D-исполнитель
    OR (r.slug='rd_executor' AND p.slug IN ('project.view','doc.tz.create','doc.verify_report.upload','registry.technology.view'))
    -- Научная организация (P2)
    OR (r.slug='scientific_org' AND p.slug IN ('project.view','catalog.executors.view','doc.tz.create'))
    -- Серийный производитель
    OR (r.slug='serial_manufacturer' AND p.slug IN ('project.view','registry.technology.view','catalog.executors.view'))
    -- Эксперт УГТ
    OR (r.slug='ugt_expert' AND p.slug IN ('project.view','doc.verify_report.upload','doc.verify.sign','doc.tz.create'))
    -- Аудитор (P2)
    OR (r.slug='auditor' AND p.slug IN ('project.view','audit.kt1.decide','doc.passport.generate','doc.teo.generate'))
    -- Инвестор
    OR (r.slug='investor' AND p.slug IN ('project.view','registry.technology.view'))
    -- Администратор ЦНТР
    OR (r.slug='cntr_admin' AND p.slug IN ('project.view','project.moderate','rbac.manage','billing.manage','log.view','registry.technology.manage'))
    -- Менеджер ЦНТР
    OR (r.slug='cntr_manager' AND p.slug IN ('project.view','project.moderate','ai.validate','project.create','doc.tz.create','doc.passport.generate','doc.teo.generate'))
ON CONFLICT DO NOTHING;