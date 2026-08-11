-- 0020_request_comments.sql
-- Тикет 09 Friday RC: обсуждение заявки (US 53) — комментарии привязаны
-- к конкретной заявке на повышение, сохраняя предметный контекст.

CREATE TABLE IF NOT EXISTS public.request_comments (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    promotion_request_id  BIGINT NOT NULL
        REFERENCES public.promotion_requests(id) ON DELETE CASCADE,
    author_id             BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    body                  TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.request_comments IS
    'Комментарии участников и менеджеров по конкретной заявке (US 53).';

-- B-Tree: лента комментариев заявки
CREATE INDEX IF NOT EXISTS idx_request_comments_request
    ON public.request_comments (promotion_request_id, id);
