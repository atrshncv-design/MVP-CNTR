-- 0027_consent_deletion.sql
-- Тикет 04 (identity-organizations): версионируемые согласия и обезличивание.
--
-- Три новые таблицы:
--   * consent_versions    — версии юридических документов (slug + version, UNIQUE).
--   * consent_acceptances — фиксация принятия версии пользователем.
--   * deletion_requests   — управляемый запрос удаления/обезличивания аккаунта.
--
-- Конвенции AGENTS.md: Serial/BigSerial PK, Hash-индекс для точного поиска,
-- B-Tree по умолчанию. PostgreSQL: UNIQUE даёт только btree (hash — нет),
-- поэтому уникальность обеспечивает btree-констрейнт, а отдельный Hash-индекс
-- ускоряет точный поиск по user_id (паттерн 0026_organization_card.sql).

-- 1. consent_versions — версии текстов согласий.
CREATE TABLE IF NOT EXISTS public.consent_versions (
    id           BIGSERIAL PRIMARY KEY,
    slug         TEXT NOT NULL,
    version      INTEGER NOT NULL,
    title        TEXT,
    text         TEXT NOT NULL,
    is_draft     BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_consent_versions_slug_version UNIQUE (slug, version)
);

COMMENT ON TABLE public.consent_versions IS
    'Версии юридических документов (согласий). is_draft=TRUE — черновик-плейсхолдер до утверждения юристом (launch gate BLOCKED).';

-- B-Tree по (slug, version): выборка истории и текущей (максимальной) версии.
CREATE INDEX IF NOT EXISTS idx_consent_versions_slug_version
    ON public.consent_versions (slug, version);

-- 2. consent_acceptances — фиксация принятия согласия пользователем.
CREATE TABLE IF NOT EXISTS public.consent_acceptances (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    consent_version_id BIGINT NOT NULL REFERENCES public.consent_versions (id) ON DELETE CASCADE,
    accepted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_consent_acceptances_user_version UNIQUE (user_id, consent_version_id)
);

COMMENT ON TABLE public.consent_acceptances IS
    'Неизменяемый след принятия версии согласия (минимальный след при обезличивании сохраняется).';

-- Hash по user_id — точный поиск принятий пользователя (GET /consents/mine, pending-проверки).
CREATE INDEX IF NOT EXISTS idx_consent_acceptances_user_id_hidx
    ON public.consent_acceptances USING hash (user_id);

-- 3. deletion_requests — управляемый запрос удаления/обезличивания.
CREATE TABLE IF NOT EXISTS public.deletion_requests (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    state        TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | rejected
    requested_by TEXT NOT NULL DEFAULT 'self'
);

COMMENT ON TABLE public.deletion_requests IS
    'Запрос пользователя на удаление аккаунта. Один активный запрос на пользователя (UNIQUE user_id).';

-- Hash по user_id — точный поиск запроса пользователя.
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id_hidx
    ON public.deletion_requests USING hash (user_id);
-- B-Tree по state — очередь обработки администратором.
CREATE INDEX IF NOT EXISTS idx_deletion_requests_state
    ON public.deletion_requests (state);

-- 4. Seed обязательных документов (черновики-плейсхолдеры до утверждения юристом).
--    is_draft=TRUE, текст явно помечен «ЧЕРНОВИК»; launch gate BLOCKED до юр. утверждения.
INSERT INTO public.consent_versions (slug, version, title, text, is_draft, published_at)
VALUES
    (
        'terms',
        1,
        'Пользовательское соглашение',
        'ЧЕРНОВИК. Пользовательское соглашение платформы «Технозрелость» (ЦНТР, ГОСТ Р 58048-2017). '
        || 'Текст не утверждён юристом и не вступает в силу. Положения будут опубликованы после '
        || 'юридической проверки.',
        TRUE,
        NULL
    ),
    (
        'privacy',
        1,
        'Политика обработки персональных данных',
        'ЧЕРНОВИК. Политика обработки персональных данных платформы «Технозрелость» (152-ФЗ). '
        || 'Текст не утверждён юристом и не вступает в силу. Положения будут опубликованы после '
        || 'юридической проверки.',
        TRUE,
        NULL
    )
ON CONFLICT (slug, version) DO NOTHING;
