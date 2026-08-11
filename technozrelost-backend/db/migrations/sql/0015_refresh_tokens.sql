-- 0015_refresh_tokens.sql
-- Отзываемые refresh-токены: ротация при каждом обновлении пары токенов.
-- Хранится только SHA-256 хеш JWT — сам токен в БД не лежит.
-- Модель: app/db/models.py -> RefreshToken (колонки совпадают 1:1).

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.refresh_tokens IS 'Refresh-токены (ротация, хранение только хеша).';

-- Точный поиск по хешу токена (Hash-индекс, конвенция проекта)
CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_tokens_token_hash
    ON public.refresh_tokens (token_hash);

-- B-Tree: поиск активных токенов пользователя (user_id + revoked_at)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON public.refresh_tokens (user_id, revoked_at);
