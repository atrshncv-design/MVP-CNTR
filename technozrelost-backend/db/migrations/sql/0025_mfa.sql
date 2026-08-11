-- 0025_mfa.sql
-- Тикет 02 (identity-organizations): MFA для служебных ролей.
--   * mfa_credentials      — секрет TOTP, зашифрованный Fernet (открытый секрет
--                            в БД не хранится), enabled (завершён confirm).
--   * mfa_recovery_codes   — 10 одноразовых кодов восстановления;
--                            в БД ТОЛЬКО sha256-хеши (code_hash), used_at.
--   * mfa_challenges       — одноразовые challenge-токены входа (mfa_required):
--                            token_hash, expires_at (5 мин), attempts (brute force),
--                            used_at (одноразовость).
-- Конвенции: Hash-индекс — точный поиск (token_hash, user_id), B-Tree — диапазоны.

-- 1. mfa_credentials: одна запись на пользователя (PK = user_id).
CREATE TABLE IF NOT EXISTS public.mfa_credentials (
    user_id          BIGINT PRIMARY KEY
                     REFERENCES public.users(id) ON DELETE CASCADE,
    secret_encrypted TEXT NOT NULL,
    enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mfa_credentials IS
    'Учётные данные MFA (TOTP): секрет шифруется Fernet (MFA_SECRET_ENCRYPTION_KEY).';
COMMENT ON COLUMN public.mfa_credentials.secret_encrypted IS
    'TOTP-секрет, зашифрованный Fernet; открытый секрет не хранится и не логируется.';
COMMENT ON COLUMN public.mfa_credentials.enabled IS
    'TRUE после успешного confirm (TOTP-проверка + выдача recovery-кодов).';

CREATE INDEX IF NOT EXISTS mfa_credentials_user_id_hidx
    ON public.mfa_credentials USING hash (user_id);

-- 2. mfa_recovery_codes: одноразовые коды восстановления (sha256-хеши).
CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL
               REFERENCES public.users(id) ON DELETE CASCADE,
    code_hash  VARCHAR(64) NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mfa_recovery_codes IS
    'Одноразовые recovery-коды MFA; в БД только sha256-хеши, показ после TOTP.';

CREATE INDEX IF NOT EXISTS mfa_recovery_codes_user_id_hidx
    ON public.mfa_recovery_codes USING hash (user_id);
CREATE INDEX IF NOT EXISTS mfa_recovery_codes_code_hash_hidx
    ON public.mfa_recovery_codes USING hash (code_hash);

-- 3. mfa_challenges: одноразовые challenge-токены входа при включённой MFA.
CREATE TABLE IF NOT EXISTS public.mfa_challenges (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL
               REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mfa_challenges IS
    'Одноразовые challenge-токены MFA-входа (TTL 5 мин; >=5 неудач — locked).';

CREATE INDEX IF NOT EXISTS mfa_challenges_token_hash_hidx
    ON public.mfa_challenges USING hash (token_hash);
CREATE INDEX IF NOT EXISTS mfa_challenges_user_id_hidx
    ON public.mfa_challenges USING hash (user_id);
CREATE INDEX IF NOT EXISTS mfa_challenges_expires_bidx
    ON public.mfa_challenges USING btree (expires_at);
