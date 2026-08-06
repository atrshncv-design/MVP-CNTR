-- 0001_init_schemas.sql
-- Фундамент БД платформы «Технозрелость» (Шаг 1.2 Plan.md).
-- Конвенции (CLAUDE.md):
--   * Схемы: public  — продакшн;     test — тестирование гипотез.
--   * ID:    Serial / BigSerial (автогенерация sequence).
--   * Индексы: Hash  — точный поиск (id, email);
--             B-Tree — диапазонные запросы (даты, уровни УГТ 1-9).
--   * Векторное хранилище RAG: расширение pgvector в схеме public.

-- 1. Продакшн-схема public (создаётся по умолчанию, переустанавливать не нужно).
CREATE SCHEMA IF NOT EXISTS public;
COMMENT ON SCHEMA public IS 'Продакшн-схема платформы Технозрелость (ГОСТ Р 58048-2017).';

-- 2. Тестовая схема для проверки гипотез (изолирована от продакшн-данных).
CREATE SCHEMA IF NOT EXISTS test;
COMMENT ON SCHEMA test IS 'Изолированная схема для тестирования гипотез и прототипов.';

-- 3. Расширение pgvector — векторное хранилище для RAG.
CREATE EXTENSION IF NOT EXISTS vector;
COMMENT ON EXTENSION vector IS 'pgvector: векторное хранилище эмбеддингов для RAG-пайплайна.';

-- 4. pg_trgm — триграммный нечёткий поиск (полезен для реестров).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
COMMENT ON EXTENSION pg_trgm IS 'Нечёткий поиск по тексту в реестрах технологий и исполнителей.';

-- 5. Привилегии по умолчанию (роль приложения — technoz, см. compose env).
GRANT USAGE ON SCHEMA public TO technoz;
GRANT CREATE ON SCHEMA public TO technoz;
GRANT USAGE ON SCHEMA test TO technoz;
GRANT CREATE ON SCHEMA test TO technoz;

-- 6. Журнал применённых SQL-миграций (источник истины — Alembic, таблица
--    дублирует SQL-слой для аудита без ORM).
CREATE TABLE IF NOT EXISTS public.db_migration_log (
    id          Serial      PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL,
    applied_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Hash-индекс по filename — точный поиск дубликатов применённых миграций.
CREATE INDEX IF NOT EXISTS db_migration_log_filename_hidx
    ON public.db_migration_log USING hash (filename);

-- B-Tree по applied_at — диапазонные запросы «когда накатывали».
CREATE INDEX IF NOT EXISTS db_migration_log_applied_at_bidx
    ON public.db_migration_log USING btree (applied_at);

GRANT SELECT, INSERT ON public.db_migration_log TO technoz;
GRANT USAGE, SELECT ON SEQUENCE public.db_migration_log_id_seq TO technoz;