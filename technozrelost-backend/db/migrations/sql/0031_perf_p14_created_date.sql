-- 0031_perf_p14_created_date.sql — P-14: created_date VARCHAR(32) → DATE
-- Тип-обман: лексикографическая сортировка работает для ISO, но тип должен быть DATE.
-- Конвертация через USING: пустые строки → NULL, валидные ISO → DATE.

ALTER TABLE public.nioktr_cards
    ALTER COLUMN created_date TYPE DATE
    USING NULLIF(TRIM(created_date), '')::date;

-- Индекс ix_nioktr_cards_created_date уже существует (0027/0028),
-- после ALTER TYPE он остаётся валидным (expression index на DATE).
-- Пересоздаём для корректной статистики (best-effort).
DROP INDEX IF EXISTS public.ix_nioktr_cards_created_date;
CREATE INDEX IF NOT EXISTS ix_nioktr_cards_created_date
    ON public.nioktr_cards (created_date DESC NULLS LAST, id DESC);
