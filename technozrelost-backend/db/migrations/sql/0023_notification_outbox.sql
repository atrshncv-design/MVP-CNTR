-- 0023_notification_outbox.sql
-- Тикет 12 Friday RC: outbox для realtime-доставки и атомарного взятия задач.
-- Outbox отделён от транзакции создания уведомления — будущий Bitrix-адаптер
-- читает только подтверждённые (committed) записи.

CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notification_id BIGINT REFERENCES public.notifications(id) ON DELETE CASCADE,
    target_scope    VARCHAR(16) NOT NULL DEFAULT 'project',  -- project | general
    manager_id      BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending | claimed | delivered
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_outbox IS
    'Transactional outbox: realtime-события и задачи менеджеров (тикет 12).';

CREATE INDEX IF NOT EXISTS idx_outbox_status
    ON public.notification_outbox (status, created_at);
