-- 0028_achievements.sql — Каталог достижений (спека §4.2, тикет 01)
-- Идемпотентно: CREATE ... IF NOT EXISTS.
-- Схема: public. Индексы: UNIQUE B-Tree по slug (slug = icon_key),
-- B-Tree по group/rarity (групповые/редкостные выборки каталога и витрины).
-- ВНИМАНИЕ: `group` — зарезервированное слово PostgreSQL, экранировано "group".

CREATE TABLE IF NOT EXISTS public.achievements (
    id          BIGSERIAL    PRIMARY KEY,
    slug        VARCHAR(80)  NOT NULL,
    title       VARCHAR(160) NOT NULL,
    description TEXT         NOT NULL,
    "group"     VARCHAR(30)  NOT NULL,
    rarity      VARCHAR(20)  NOT NULL DEFAULT 'common',
    sector_slug VARCHAR(40),
    threshold   INTEGER,
    ugt_level   INTEGER,
    secret      BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    icon_key    VARCHAR(80)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_achievements_slug
    ON public.achievements (slug);

CREATE INDEX IF NOT EXISTS ix_achievements_group
    ON public.achievements ("group");

CREATE INDEX IF NOT EXISTS ix_achievements_rarity
    ON public.achievements (rarity);

-- Seed каталога (66 медалей, catalog-66.md): идемпотентный upsert по slug.
-- Перенос со старой линии: те же записи, что в app/db/seed_achievements.py.
INSERT INTO public.achievements
    (slug, title, description, "group", rarity, sector_slug, threshold, ugt_level, secret, sort_order, icon_key)
VALUES
    ('ugt-1', 'УГТ 1 — Первая ступень', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 1.', 'ugt', 'common', NULL, NULL, 1, FALSE, 1, 'ugt-1'),
    ('ugt-2', 'УГТ 2 — Зарождение технологии', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 2.', 'ugt', 'common', NULL, NULL, 2, FALSE, 2, 'ugt-2'),
    ('ugt-3', 'УГТ 3 — Концепция доказана', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 3.', 'ugt', 'common', NULL, NULL, 3, FALSE, 3, 'ugt-3'),
    ('ugt-4', 'УГТ 4 — Прототип в лаборатории', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 4.', 'ugt', 'common', NULL, NULL, 4, FALSE, 4, 'ugt-4'),
    ('ugt-5', 'УГТ 5 — Технология подтверждена', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 5.', 'ugt', 'common', NULL, NULL, 5, FALSE, 5, 'ugt-5'),
    ('ugt-6', 'УГТ 6 — Демонстратор готов', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 6.', 'ugt', 'common', NULL, NULL, 6, FALSE, 6, 'ugt-6'),
    ('ugt-7', 'УГТ 7 — Пилотное внедрение', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 7.', 'ugt', 'epic', NULL, NULL, 7, FALSE, 7, 'ugt-7'),
    ('ugt-8', 'УГТ 8 — Серийное производство', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 8.', 'ugt', 'epic', NULL, NULL, 8, FALSE, 8, 'ugt-8'),
    ('ugt-9', 'УГТ 9 — Технологический прорыв', 'Награждается команда проекта за подтверждённый переход на уровень УГТ 9.', 'ugt', 'legendary', NULL, NULL, 9, FALSE, 9, 'ugt-9'),
    ('doc-first', 'Первый принятый документ', 'Награждается за первый документ проекта, принятый по результатам проверки.', 'documents', 'common', NULL, NULL, NULL, FALSE, 10, 'doc-first'),
    ('doc-5', 'Начало пути — 5 документов', 'Награждается за 5 документов проекта, принятых по результатам проверки.', 'documents', 'common', NULL, 5, NULL, FALSE, 11, 'doc-5'),
    ('doc-10', 'Рабочий ритм — 10 документов', 'Награждается за 10 документов проекта, принятых по результатам проверки.', 'documents', 'common', NULL, 10, NULL, FALSE, 12, 'doc-10'),
    ('doc-25', 'Серьёзный вклад — 25 документов', 'Награждается за 25 документов проекта, принятых по результатам проверки.', 'documents', 'common', NULL, 25, NULL, FALSE, 13, 'doc-25'),
    ('doc-50', 'Половина сотни — 50 документов', 'Награждается за 50 документов проекта, принятых по результатам проверки.', 'documents', 'epic', NULL, 50, NULL, FALSE, 14, 'doc-50'),
    ('doc-100', 'Документальный архив — 100 документов', 'Награждается за 100 документов проекта, принятых по результатам проверки.', 'documents', 'legendary', NULL, 100, NULL, FALSE, 15, 'doc-100'),
    ('proj-first', 'Первый проект команды', 'Награждается команда за первый проект на платформе.', 'project', 'common', NULL, NULL, NULL, FALSE, 16, 'proj-first'),
    ('proj-first-request', 'Первая заявка на переход УГТ', 'Награждается команда за первую поданную заявку на переход УГТ.', 'project', 'common', NULL, NULL, NULL, FALSE, 17, 'proj-first-request'),
    ('proj-ugt3', 'Проект достиг УГТ 3', 'Награждается команда, когда её проект достигает уровня УГТ 3.', 'project', 'common', NULL, NULL, NULL, FALSE, 18, 'proj-ugt3'),
    ('proj-ugt4', 'Лабораторная победа — УГТ 4', 'Награждается команда, когда её проект достигает уровня УГТ 4.', 'project', 'common', NULL, NULL, NULL, FALSE, 19, 'proj-ugt4'),
    ('proj-ugt6', 'Демонстратор — УГТ 6', 'Награждается команда, когда её проект достигает уровня УГТ 6.', 'project', 'epic', NULL, NULL, NULL, FALSE, 20, 'proj-ugt6'),
    ('proj-ugt7', 'Пилот — УГТ 7', 'Награждается команда, когда её проект достигает уровня УГТ 7.', 'project', 'epic', NULL, NULL, NULL, FALSE, 21, 'proj-ugt7'),
    ('proj-ugt8', 'Производство — УГТ 8', 'Награждается команда, когда её проект достигает уровня УГТ 8.', 'project', 'epic', NULL, NULL, NULL, FALSE, 22, 'proj-ugt8'),
    ('proj-ugt9', 'Полный путь 1→9', 'Награждается команда, прошедшая с проектом полный путь от УГТ 1 до УГТ 9.', 'project', 'legendary', NULL, NULL, NULL, FALSE, 23, 'proj-ugt9'),
    ('proj-collector', 'Коллекционер документов (все типы проекта)', 'Награждается команда, собравшая в проекте документы всех типов.', 'project', 'epic', NULL, NULL, NULL, FALSE, 24, 'proj-collector'),
    ('proj-3-sectors', 'Полиглот отраслей (команда в 3+ отраслях)', 'Награждается команда, ведущая проекты в трёх и более отраслях.', 'project', 'epic', NULL, NULL, NULL, FALSE, 25, 'proj-3-sectors'),
    ('q-clean', 'Чистый проект (без возвратов до УГТ 4)', 'Награждается команда, прошедшая путь до УГТ 4 без единого возврата на доработку.', 'quality', 'common', NULL, NULL, NULL, FALSE, 26, 'q-clean'),
    ('q-first-try', 'С первой попытки (переход без отклонений)', 'Награждается команда, чей переход УГТ подтверждён с первой попытки, без отклонённых заявок.', 'quality', 'common', NULL, NULL, NULL, FALSE, 27, 'q-first-try'),
    ('q-leap', 'Рывок (переход на 2+ уровня за цикл)', 'Награждается команда, перешедшая на два и более уровня УГТ за один цикл.', 'quality', 'epic', NULL, NULL, NULL, FALSE, 28, 'q-leap'),
    ('q-sprint', 'Спринтер (быстрый переход между уровнями)', 'Награждается команда за быстрый переход между уровнями УГТ.', 'quality', 'common', NULL, NULL, NULL, FALSE, 29, 'q-sprint'),
    ('q-marathon', 'Марафонец (проект в работе более года)', 'Награждается команда, ведущая проект более года.', 'quality', 'common', NULL, NULL, NULL, FALSE, 30, 'q-marathon'),
    ('q-comeback', 'Возвращение (откат → снова УГТ 7+)', 'Награждается команда, вернувшаяся после отката уровня и вновь достигшая УГТ 7 и выше.', 'quality', 'epic', NULL, NULL, NULL, FALSE, 31, 'q-comeback'),
    ('q-perfect-set', 'Идеальный комплект (все документы с первой попытки)', 'Награждается команда, все документы комплекта которой приняты с первой попытки.', 'quality', 'epic', NULL, NULL, NULL, FALSE, 32, 'q-perfect-set'),
    ('q-fast-start', 'Быстрый старт (первый документ за N дней)', 'Награждается команда, чей первый документ принят в кратчайший срок с момента старта проекта.', 'quality', 'common', NULL, NULL, NULL, FALSE, 33, 'q-fast-start'),
    ('sector-agri', 'Сельское хозяйство', 'Награждается за проект в отрасли «Сельское хозяйство».', 'sector', 'common', 'agriculture', NULL, NULL, FALSE, 34, 'sector-agri'),
    ('sector-oil', 'Нефтедобыча', 'Награждается за проект в отрасли «Нефтедобыча».', 'sector', 'common', 'oil', NULL, NULL, FALSE, 35, 'sector-oil'),
    ('sector-machinery', 'Машиностроение', 'Награждается за проект в отрасли «Машиностроение».', 'sector', 'common', 'machinery', NULL, NULL, FALSE, 36, 'sector-machinery'),
    ('sector-it', 'IT и цифровые платформы', 'Награждается за проект в отрасли «IT и цифровые платформы».', 'sector', 'common', 'it', NULL, NULL, FALSE, 37, 'sector-it'),
    ('sector-medicine', 'Медицина', 'Награждается за проект в отрасли «Медицина».', 'sector', 'common', 'medicine', NULL, NULL, FALSE, 38, 'sector-medicine'),
    ('sector-energy', 'Энергетика', 'Награждается за проект в отрасли «Энергетика».', 'sector', 'common', 'energy', NULL, NULL, FALSE, 39, 'sector-energy'),
    ('sector-transport', 'Транспорт', 'Награждается за проект в отрасли «Транспорт».', 'sector', 'common', 'transport', NULL, NULL, FALSE, 40, 'sector-transport'),
    ('sector-polyglot', 'Межотраслевой лидер (3+ отраслей)', 'Награждается команда, ведущая проекты в трёх и более отраслях.', 'sector', 'epic', NULL, NULL, NULL, FALSE, 41, 'sector-polyglot'),
    ('role-verify-1', 'Первая верификация', 'Награждается менеджер за первую верифицированную заявку на переход УГТ.', 'role', 'common', NULL, 1, NULL, FALSE, 42, 'role-verify-1'),
    ('role-verify-10', 'Опытный верификатор — 10 переходов', 'Награждается менеджер за 10 верифицированных переходов УГТ.', 'role', 'common', NULL, 10, NULL, FALSE, 43, 'role-verify-10'),
    ('role-verify-50', 'Мастер верификации — 50 переходов', 'Награждается менеджер за 50 верифицированных переходов УГТ.', 'role', 'epic', NULL, 50, NULL, FALSE, 44, 'role-verify-50'),
    ('role-expert-1', 'Первая экспертиза', 'Награждается эксперт за первую проведённую экспертизу документа.', 'role', 'common', NULL, 1, NULL, FALSE, 45, 'role-expert-1'),
    ('role-expert-25', 'Признанный эксперт — 25 проверок', 'Награждается эксперт за 25 проведённых проверок документов.', 'role', 'epic', NULL, 25, NULL, FALSE, 46, 'role-expert-25'),
    ('role-mentor', 'Наставник (команда дошла до УГТ 4+)', 'Награждается наставник, чья команда достигла УГТ 4 и выше.', 'role', 'epic', NULL, NULL, NULL, FALSE, 47, 'role-mentor'),
    ('role-fast-check', 'Быстрая проверка (< 3 рабочих дней)', 'Награждается за проверку документа менее чем за три рабочих дня.', 'role', 'common', NULL, NULL, NULL, FALSE, 48, 'role-fast-check'),
    ('m-first-medal', 'Первая медаль', 'Награждается за первую полученную медаль платформы.', 'member', 'common', NULL, NULL, NULL, FALSE, 49, 'm-first-medal'),
    ('m-5-medals', 'Начало коллекции — 5 медалей', 'Награждается за 5 полученных медалей.', 'member', 'common', NULL, 5, NULL, FALSE, 50, 'm-5-medals'),
    ('m-15-medals', 'Коллекционер опыта — 15 медалей', 'Награждается за 15 полученных медалей.', 'member', 'common', NULL, 15, NULL, FALSE, 51, 'm-15-medals'),
    ('m-30-medals', 'Ветеран платформы — 30 медалей', 'Награждается за 30 полученных медалей.', 'member', 'epic', NULL, 30, NULL, FALSE, 52, 'm-30-medals'),
    ('m-3-projects', 'Мультипроектность (3+ проектов одновременно)', 'Награждается за одновременное участие в трёх и более проектах.', 'member', 'common', NULL, NULL, NULL, FALSE, 53, 'm-3-projects'),
    ('m-longhaul', 'Долгожитель (в команде от УГТ 1 до УГТ 4+)', 'Награждается за нахождение в команде проекта на всём пути от УГТ 1 до УГТ 4 и выше.', 'member', 'common', NULL, NULL, NULL, FALSE, 54, 'm-longhaul'),
    ('m-5-projects', 'Вклад в 5+ проектов', 'Награждается за вклад в пять и более проектов платформы.', 'member', 'epic', NULL, NULL, NULL, FALSE, 55, 'm-5-projects'),
    ('org-first', 'Первый проект организации', 'Награждается организация за первый проект на платформе.', 'organization', 'common', NULL, NULL, NULL, FALSE, 56, 'org-first'),
    ('org-5-projects', '5 проектов организации', 'Награждается организация за пять проектов на платформе.', 'organization', 'common', NULL, 5, NULL, FALSE, 57, 'org-5-projects'),
    ('org-3-sectors', '3 отрасли организации', 'Награждается организация, ведущая проекты в трёх отраслях.', 'organization', 'common', NULL, NULL, NULL, FALSE, 58, 'org-3-sectors'),
    ('org-10-docs', '10 документов организации', 'Награждается организация за 10 документов, принятых по её проектам.', 'organization', 'common', NULL, 10, NULL, FALSE, 59, 'org-10-docs'),
    ('org-ugt6', 'Проект организации до УГТ 6+', 'Награждается организация, чей проект достиг УГТ 6 и выше.', 'organization', 'epic', NULL, NULL, NULL, FALSE, 60, 'org-ugt6'),
    ('s-ghost', 'Призрак (путь 1→9 без единого возврата)', 'Награждается команда, прошедшая путь от УГТ 1 до УГТ 9 без единого возврата.', 'secret', 'legendary', NULL, NULL, NULL, TRUE, 61, 's-ghost'),
    ('s-comet', 'Комета (рекордное время 1→9)', 'Награждается команда, прошедшая путь от УГТ 1 до УГТ 9 за рекордное время.', 'secret', 'legendary', NULL, NULL, NULL, TRUE, 62, 's-comet'),
    ('s-pioneer', 'Первопроходец (первый проект в отрасли)', 'Награждается команда, открывшая новую отрасль — первый проект платформы в ней.', 'secret', 'epic', NULL, NULL, NULL, TRUE, 63, 's-pioneer'),
    ('s-phoenix', 'Феникс (дважды вернулся с УГТ 4+ → УГТ 7+)', 'Награждается команда, дважды пережившая откат с УГТ 4 и выше и вновь достигшая УГТ 7 и выше.', 'secret', 'epic', NULL, NULL, NULL, TRUE, 64, 's-phoenix'),
    ('s-epic-collection', 'Эпическая коллекция (все 9 УГТ-медалей)', 'Награждается за собрание всех девяти УГТ-медалей платформы.', 'secret', 'legendary', NULL, NULL, NULL, TRUE, 65, 's-epic-collection'),
    ('s-legend', 'Легенда платформы (100+ медалей)', 'Награждается за 100 и более наград в коллекции — легенда платформы.', 'secret', 'legendary', NULL, NULL, NULL, TRUE, 66, 's-legend')
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    "group" = EXCLUDED."group",
    rarity = EXCLUDED.rarity,
    sector_slug = EXCLUDED.sector_slug,
    threshold = EXCLUDED.threshold,
    ugt_level = EXCLUDED.ugt_level,
    secret = EXCLUDED.secret,
    sort_order = EXCLUDED.sort_order,
    icon_key = EXCLUDED.icon_key,
    updated_at = now();