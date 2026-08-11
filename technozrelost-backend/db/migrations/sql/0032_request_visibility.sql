-- 0032_request_visibility.sql
-- Тикет 02 requests-matching: конфиденциальность и модерация запроса.
-- Модель: app/db/models.py -> TechRequest (+ TechRequestModerationLog).
-- Режимы: public (виден всем после одобрения) / platform (авторизованным) /
--         private (только создатель и Центр). Публикация — только после
--         решения менеджера (moderation_status=approved).

ALTER TABLE public.tech_requests
    ADD COLUMN visibility         VARCHAR(16) NOT NULL DEFAULT 'platform',
    ADD COLUMN moderation_status  VARCHAR(16) NOT NULL DEFAULT 'pending',
    ADD COLUMN moderated_by       BIGINT REFERENCES public.users(id),
    ADD COLUMN moderated_at       TIMESTAMPTZ,
    ADD COLUMN moderation_reason  TEXT;

ALTER TABLE public.tech_requests
    ADD CONSTRAINT chk_tech_requests_visibility
        CHECK (visibility IN ('public', 'platform', 'private')),
    ADD CONSTRAINT chk_tech_requests_moderation
        CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

COMMENT ON COLUMN public.tech_requests.visibility IS
    'Режим видимости: public — все после одобрения; platform — авторизованным; private — создатель и Центр.';
COMMENT ON COLUMN public.tech_requests.moderation_status IS
    'Решение менеджера: pending — на модерации; approved/rejected — решение (moderated_by/at/reason).';

-- B-Tree: публичный реестр — выборка approved+public/platform с пагинацией.
CREATE INDEX IF NOT EXISTS idx_tech_requests_visibility_moderation
    ON public.tech_requests (visibility, moderation_status, created_at);

-- B-Tree: очереди модерации по статусу решения.
CREATE INDEX IF NOT EXISTS idx_tech_requests_moderation_status
    ON public.tech_requests (moderation_status, created_at);

-- Append-only журнал решений модерации (approve/reject/visibility_changed).
CREATE TABLE IF NOT EXISTS public.tech_request_moderation_log (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id   BIGINT NOT NULL REFERENCES public.tech_requests(id) ON DELETE CASCADE,
    action       VARCHAR(32) NOT NULL,   -- approve | reject | visibility_changed
    moderator_id BIGINT REFERENCES public.users(id),
    reason       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tech_request_moderation_log IS
    'Append-only журнал решений модерации запросов (тикет 02 requests-matching).';

CREATE INDEX IF NOT EXISTS idx_tech_request_moderation_log_request
    ON public.tech_request_moderation_log (request_id, created_at);
