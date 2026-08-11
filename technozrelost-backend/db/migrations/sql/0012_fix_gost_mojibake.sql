-- RAG-002: Fix mojibake GOST titles and source_uri
-- The original seed_gost wrote titles/source_uri through a wrong codepage
-- (mojibake: 'С®бв•ђл §®І†©≠...' instead of readable Cyrillic).
-- This migration extracts the correct GOST number from the clean raw_text
-- and rebuilds human-readable title + source_uri.
--
-- Applied 2026-08-04 for 391 of 456 GOST rows (65 rows were non-GOST templates
-- and left unchanged — their raw_text lacks a GOST number pattern).

UPDATE rag_documents
SET
  title = regexp_replace(
    coalesce(
      (regexp_match(raw_text, '(ГОСТ(?:\s*Р)?\s+\d+(?:\.\d+)?(?:[—–\-]\d+)?)'))[1],
      split_part(source_uri, ' ', 1)
    ),
    '\s+', ' ', 'g'
  ) || ' — раздел ' || (regexp_match(source_uri, 'chunk-(\d+)'))[1],
  source_uri = regexp_replace(
    coalesce(
      (regexp_match(raw_text, '(ГОСТ(?:\s*Р)?\s+\d+(?:\.\d+)?(?:[—–\-]\d+)?)'))[1],
      split_part(source_uri, ' ', 1)
    ),
    '\s+', ' ', 'g'
  ) || '.pdf#chunk-' || (regexp_match(source_uri, 'chunk-(\d+)'))[1]
WHERE
  doc_type = 'gost'
  AND source_uri LIKE '%.pdf#chunk-%'
  AND (
    regexp_match(raw_text, '(ГОСТ(?:\s*Р)?\s+\d+(?:\.\d+)?(?:[—–\-]\d+)?)') IS NOT NULL
    OR split_part(source_uri, ' ', 1) ~ 'ГОСТ'
  );
