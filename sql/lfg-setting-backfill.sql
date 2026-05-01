-- lfg-setting-backfill.sql
-- Phase 4A backfill — normalize legacy freetext setting values on
-- lfg_posts to either canonical slugs from lib/settings.ts or NULL
-- (global). Pre-Phase-4A posts were authored with a free-form text
-- field; Phase 4A switched to a slug picker. Old rows still hold
-- the freetext shape and don't match any chip filter, so they're
-- invisible on the Setting Hubs and Setting Context filters.
--
-- Live data inspection 2026-05-01 (the only freetext mismatches):
--   "Any"    → NULL   (no specific setting, post welcomes any setting)
--   "Empty"  → empty
--   "Chased" → chased
--
-- Forums + War Stories had no freetext mismatches in this DB.
--
-- Idempotent — UPDATEs only fire on rows that still hold the
-- legacy values, so re-runs are no-ops.

UPDATE public.lfg_posts SET setting = NULL     WHERE setting = 'Any';
UPDATE public.lfg_posts SET setting = 'empty'  WHERE setting = 'Empty';
UPDATE public.lfg_posts SET setting = 'chased' WHERE setting = 'Chased';

-- Sanity print: residual non-canonical values, if any. Empty result =
-- backfill complete. Allowed values: NULL or any key from SETTINGS.
SELECT setting, COUNT(*) AS n
FROM public.lfg_posts
WHERE setting IS NOT NULL
  AND setting NOT IN (
    'custom','district_zero','mongrels','chased','empty',
    'therock','arena','kings_crossroads_mall'
  )
GROUP BY setting;
