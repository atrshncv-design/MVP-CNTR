-- 0030_rag_cost_gate.sql
-- Тикет 04 ai-rag: серверные rate limits и cost gate публичного /rag/chat.
--
-- rag_rate_limit_state — лимиты частоты (окно N минут) и суточный, ПО IP:
--   - одна запись на IP (unique ip);
--   - freq_window_start/freq_count — текущее окно частоты (сдвиг окна = сброс к 1);
--   - daily_date/daily_count — текущий UTC-день (смена дня = сброс к 1);
--   - session_id хранится ТОЛЬКО для диагностики: ключ — IP, поэтому смена
--     session_id не обнуляет ни частотный, ни суточный лимит;
--   - TTL: устаревшие строки чистятся по updated_at < now() - 2 дня.
--   ПДн не хранятся: только IP + счётчики окон + updated_at (тексты вопросов нет).
--
-- rag_cost_state — дневной бюджет (глобальный, на всех посетителей):
--   - одна строка на UTC-день (unique day);
--   - request_count — запросы, дошедшие до консультанта (LLM/fallback);
--   - input_tokens/output_tokens — оценка токенов (эвристика len//4);
--   - превышение порогов settings (rag_daily_budget_requests/tokens) → 429.

CREATE TABLE IF NOT EXISTS public.rag_rate_limit_state (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip                VARCHAR(45)  NOT NULL,             -- IPv4/IPv6 (макс. 45)
    session_id        VARCHAR(128) NOT NULL DEFAULT '',  -- только для диагностики
    freq_window_start TIMESTAMPTZ  NOT NULL,
    freq_count        INTEGER      NOT NULL DEFAULT 0,
    daily_date        DATE         NOT NULL,
    daily_count       INTEGER      NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT rag_rate_limit_state_ip_key UNIQUE (ip)
);

COMMENT ON TABLE public.rag_rate_limit_state IS
    'Серверные rate limits публичного /rag/chat по IP (частота + суточный, тикет 04 ai-rag).';
COMMENT ON COLUMN public.rag_rate_limit_state.session_id IS
    'Хранится только для диагностики; ключ лимитов — IP, смена session_id лимиты не обнуляет.';
COMMENT ON COLUMN public.rag_rate_limit_state.freq_window_start IS
    'Начало текущего окна частоты (сдвиг окна сбрасывает freq_count к 1).';
COMMENT ON COLUMN public.rag_rate_limit_state.daily_date IS
    'Текущий UTC-день суточного лимита (смена дня сбрасывает daily_count к 1).';

CREATE TABLE IF NOT EXISTS public.rag_cost_state (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    day           DATE         NOT NULL,
    request_count INTEGER      NOT NULL DEFAULT 0,
    input_tokens  INTEGER      NOT NULL DEFAULT 0,
    output_tokens INTEGER      NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT rag_cost_state_day_key UNIQUE (day)
);

COMMENT ON TABLE public.rag_cost_state IS
    'Дневной бюджет публичного /rag/chat: запросы и оценка токенов по UTC-дню (тикет 04 ai-rag).';
COMMENT ON COLUMN public.rag_cost_state.request_count IS
    'Запросы, дошедшие до консультанта (LLM/fallback); лимит settings.rag_daily_budget_requests.';
COMMENT ON COLUMN public.rag_cost_state.input_tokens IS
    'Оценка входных токенов (эвристика len//4); лимит settings.rag_daily_budget_tokens.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rag_rate_limit_state TO technoz;
GRANT USAGE, SELECT ON SEQUENCE public.rag_rate_limit_state_id_seq TO technoz;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rag_cost_state TO technoz;
GRANT USAGE, SELECT ON SEQUENCE public.rag_cost_state_id_seq TO technoz;
