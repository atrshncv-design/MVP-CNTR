-- 0031_perf_p14_created_date.sql — P-14: created_date VARCHAR(32) → DATE
-- Тип-обман: лексикографическая сортировка работает для ISO, но тип должен быть DATE.
-- Закалка M-01 (TICKET-06 / SPEC-03): pre-clean грязных данных перед ALTER TYPE.
-- FR-01: '' / 'bad' / 'неизвестно' / '2024-02-30' / '2024-13-01' → NULL, валидные YYYY-MM-DD → DATE.
-- Идемпотентно: повторный прогон на уже-DATE колонке не падает (WHERE на ::text, USING на ::text).

-- Шаг 1: не-ISO строки → NULL (пустые, мусор, кириллица). TRIM+::text для идемпотентности после конвертации.
UPDATE public.nioktr_cards
SET created_date = NULL
WHERE created_date IS NOT NULL
  AND TRIM(created_date::text) !~ '^\d{4}-\d{2}-\d{2}$';

-- Шаг 2: ISO-подобные но календарно невалидные → NULL (2024-02-30, 2024-13-01).
-- PostgreSQL нет TRY_CAST. H-02 (M4 TICKET-03): без pg_temp — пул-безопасно.
-- M4 fix: per-row EXCEPTION, иначе один to_date бросает весь UPDATE и invalid остаётся.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, created_date FROM public.nioktr_cards
           WHERE created_date IS NOT NULL
             AND TRIM(created_date::text) ~ '^\d{4}-\d{2}-\d{2}$'
  LOOP
    BEGIN
      PERFORM TRIM(r.created_date::text)::date;
    EXCEPTION WHEN others THEN
      UPDATE public.nioktr_cards SET created_date = NULL WHERE id = r.id;
    END;
  END LOOP;
END $$;

-- Шаг 3: безопасная конвертация — на этот момент только валидные ISO/NULL, поэтому USING не бросает.
-- TRIM+::text сохраняет идемпотентность при повторном прогоне на уже-DATE колонке.
ALTER TABLE public.nioktr_cards
    ALTER COLUMN created_date TYPE DATE
    USING NULLIF(TRIM(created_date::text), '')::date;

-- Индекс ix_nioktr_cards_created_date уже существует (0027/0028),
-- после ALTER TYPE он остаётся валидным (expression index на DATE).
-- Пересоздаём для корректной статистики (best-effort).
DROP INDEX IF EXISTS public.ix_nioktr_cards_created_date;
CREATE INDEX IF NOT EXISTS ix_nioktr_cards_created_date
    ON public.nioktr_cards (created_date DESC NULLS LAST, id DESC);
