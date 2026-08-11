-- 0024_email_lifecycle.sql
-- Тикет 01 (identity-organizations): подтверждение email и lifecycle аккаунта.
--   * users: email_verified_at, хеши verification/reset-токенов + сроки,
--     login_attempts/locked_until (throttling входа), status (unverified/verified/blocked/deleted).
--   * email_outbox: тестовая доставка писем (APP_ENV=test), открытый токен — только в test-профиле.
-- Конвенции (CLAUDE.md): Hash-индекс — точный поиск (хеш токена), B-Tree — диапазоны (expires).

-- 1. Новые поля lifecycle аккаунта (идемпотентно).
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unverified';

COMMENT ON COLUMN public.users.email_verified_at IS
    'Момент подтверждения email (одноразовый verification-токен, 24ч).';
COMMENT ON COLUMN public.users.email_verification_token_hash IS
    'SHA-256 хеш verification-токена; открытый токен в БД не хранится.';
COMMENT ON COLUMN public.users.email_verification_token_expires_at IS
    'Срок действия verification-токена (по умолчанию 24 часа).';
COMMENT ON COLUMN public.users.password_reset_token_hash IS
    'SHA-256 хеш одноразового reset-токена; открытый токен в БД не хранится.';
COMMENT ON COLUMN public.users.password_reset_token_expires_at IS
    'Срок действия reset-токена (по умолчанию 30 минут).';
COMMENT ON COLUMN public.users.login_attempts IS
    'Счётчик неудачных попыток входа (сбрасывается при успехе).';
COMMENT ON COLUMN public.users.locked_until IS
    'Блокировка входа до указанного момента (после >= 5 неудачных попыток).';
COMMENT ON COLUMN public.users.status IS
    'Lifecycle аккаунта: unverified | verified | blocked | deleted.';

-- 2. CHECK-ограничение допустимых статусов (idempotent DO-блок).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_status_check' AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_status_check
            CHECK (status IN ('unverified', 'verified', 'blocked', 'deleted'));
    END IF;
END $$;

-- 3. Существующие пользователи (зарегистрированы до 0024) считаются verified —
--    обратная совместимость: им не нужно повторно подтверждать email.
UPDATE public.users
   SET status = 'verified',
       email_verified_at = COALESCE(email_verified_at, created_at)
 WHERE status = 'unverified';

-- 4. Индексы:
--    Hash — точечный поиск по хешу токена (verify/reset по токену).
CREATE INDEX IF NOT EXISTS users_email_verification_token_hash_hidx
    ON public.users USING hash (email_verification_token_hash);
CREATE INDEX IF NOT EXISTS users_password_reset_token_hash_hidx
    ON public.users USING hash (password_reset_token_hash);

--    B-Tree — диапазонные запросы по срокам истечения (очистка/фоновые задачи).
CREATE INDEX IF NOT EXISTS users_email_verification_expires_bidx
    ON public.users USING btree (email_verification_token_expires_at);
CREATE INDEX IF NOT EXISTS users_password_reset_expires_bidx
    ON public.users USING btree (password_reset_token_expires_at);

-- 5. Outbox тестовой доставки email (тикет 01).
--    token заполняется ТОЛЬКО в APP_ENV=test (для тестов); в остальных профилях NULL,
--    а token_hash пишется всегда — аудит без хранения секретов.
CREATE TABLE IF NOT EXISTS public.email_outbox (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient   VARCHAR(254) NOT NULL,
    subject     VARCHAR(255) NOT NULL,
    template    VARCHAR(32)  NOT NULL,   -- verification | password_reset
    token       TEXT,                     -- открытый токен ТОЛЬКО в test-профиле
    token_hash  VARCHAR(64),              -- SHA-256 всегда
    status      VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_outbox IS
    'Outbox тестовой доставки email (APP_ENV=test); SMTP-адаптер — заглушка.';

CREATE INDEX IF NOT EXISTS email_outbox_created_at_bidx
    ON public.email_outbox USING btree (created_at);
