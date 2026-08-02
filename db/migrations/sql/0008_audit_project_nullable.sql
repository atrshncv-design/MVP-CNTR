-- 0008_audit_project_nullable.sql
-- Аудит действий вне контекста проекта (администрирование пользователей).

ALTER TABLE public.audit_trail
    ALTER COLUMN project_id DROP NOT NULL;
