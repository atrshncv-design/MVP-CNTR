-- 0029_rag_guardrails.sql
-- Тикет 03 ai-rag: серверный topic gate и off-topic блокировка.
-- Серверное состояние счётчика/блокировки (НЕ client state):
--   - одна запись на IP (уникальный ключ ip);
--   - off_topic_count — число ПОСЛЕДОВАТЕЛЬНЫХ off-topic от IP
--     (сброс при on-topic/ambiguous; TTL-сброс через час бездействия);
--   - blocked_until — блокировка IP на 1 час после N off-topic
--     (settings.rag_offtopic_limit / rag_block_minutes);
--   - session_id хранится для диагностики; ключ состояния — IP,
--     поэтому смена session_id не снимает блокировку.

CREATE TABLE IF NOT EXISTS public.rag_abuse_state (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip             VARCHAR(45)  NOT NULL,             -- IPv4/IPv6 (макс. 45)
    session_id     VARCHAR(128) NOT NULL DEFAULT '',
    off_topic_count INTEGER     NOT NULL DEFAULT 0,
    blocked_until  TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT rag_abuse_state_ip_key UNIQUE (ip)
);

COMMENT ON TABLE public.rag_abuse_state IS
    'Серверное состояние topic gate: счётчик последовательных off-topic и блокировка по IP (тикет 03 ai-rag).';
COMMENT ON COLUMN public.rag_abuse_state.off_topic_count IS
    'Число последовательных off-topic от IP (сброс при on-topic/ambiguous, TTL 1 час).';
COMMENT ON COLUMN public.rag_abuse_state.blocked_until IS
    'До этого момента /rag/chat для IP возвращает 429 (после N off-topic).';

-- Быстрый поиск активных блокировок (проверка на каждый запрос /rag/chat).
CREATE INDEX IF NOT EXISTS rag_abuse_state_blocked_bidx
    ON public.rag_abuse_state USING btree (blocked_until)
    WHERE blocked_until IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rag_abuse_state TO technoz;
GRANT USAGE, SELECT ON SEQUENCE public.rag_abuse_state_id_seq TO technoz;
