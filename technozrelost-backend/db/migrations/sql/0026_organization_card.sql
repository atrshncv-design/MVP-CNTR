-- 0026_organization_card.sql
-- Тикет 03 (identity-organizations): карточка организации по ИНН.
-- Расширяет существующую таблицу public.user_organizations (карточка уже имеет
-- name/short_name/ogrn/org_type/region/description/state/review_comment/
-- created_by/reviewed_by/reviewed_at — НЕ дублируем, дополняем недостающее):
--   * inn      VARCHAR(12) — нормализованный ИНН (только цифры), UNIQUE (Hash-индекс).
--   * kpp      VARCHAR(9)  — необязателен.
--   * contacts JSONB       — публичные контакты (телефоны/email/сайт и т.п.).
--   * verification_decision TEXT — решение менеджера ('verified'|'rejected').
-- Соответствие полей брифа существующим колонкам (дополнено, не продублировано):
--   status              -> state       (draft/pending/verified/rejected; 'pending'
--                                        = 'pending_verification' брифа — сохранено
--                                        значение 'pending' для совместимости с
--                                        существующим lifecycle profiles.py/тестами)
--   verification_by     -> reviewed_by (FK public.users)
--   verification_at     -> reviewed_at (TIMESTAMPTZ)
--   internal_comment    -> review_comment (НЕ публичное поле)
--   created_by          -> created_by  (уже есть)

-- 1. ИНН карточки: нормализованный (только цифры), уникальный.
--    NULL допустим для legacy-карточек, созданных до тикета 03 (старый /orgs);
--    новые карточки (POST /organizations) требуют ИНН на уровне API.
ALTER TABLE public.user_organizations
    ADD COLUMN IF NOT EXISTS inn VARCHAR(12),
    ADD COLUMN IF NOT EXISTS kpp VARCHAR(9),
    ADD COLUMN IF NOT EXISTS contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS verification_decision TEXT;

COMMENT ON COLUMN public.user_organizations.inn IS
    'Нормализованный ИНН (только цифры, 10 — юрлицо, 12 — ИП); уникален. NULL — legacy-карточки.';
COMMENT ON COLUMN public.user_organizations.contacts IS
    'Публичные контакты организации (JSONB-список); не являются внутренними.';
COMMENT ON COLUMN public.user_organizations.verification_decision IS
    'Решение менеджера при верификации: verified | rejected (дублирует state на момент решения).';

-- 2. Уникальность ИНН + Hash-индекс точного поиска по ИНН.
--    PostgreSQL: UNIQUE поддерживают только btree-индексы (hash — нет),
--    поэтому уникальность обеспечивает btree, а hash-индекс — точный поиск.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_organizations_inn
    ON public.user_organizations (inn);
CREATE INDEX IF NOT EXISTS idx_user_organizations_inn_hidx
    ON public.user_organizations USING hash (inn);

-- 3. B-Tree по статусу (очередь проверки менеджером; существующий индекс).
CREATE INDEX IF NOT EXISTS idx_user_organizations_state
    ON public.user_organizations (state);
