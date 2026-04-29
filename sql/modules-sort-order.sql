-- Add a sort_order column to modules so the /modules marketplace can
-- be curated by Thrivers instead of falling back to created_at DESC.
--
-- Behavior:
--   - lower sort_order ranks first (NULL sorts LAST)
--   - created_at DESC is the tiebreaker (newest first within
--     unsorted modules)
--
-- This migration also pins the 5 setting-migration modules to the
-- order Xero spec'd: Empty → Chased → Minnie → Basement → Arena.
-- Match is by exact name; if the names change in the migration tool
-- the values here go stale and Thrivers can re-sort via the
-- Edit page.
--
-- Apply once. Idempotent — re-runnable.

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS sort_order int;

CREATE INDEX IF NOT EXISTS idx_modules_sort_order
  ON public.modules(sort_order NULLS LAST, created_at DESC);

UPDATE public.modules SET sort_order = 1 WHERE name = 'Empty';
UPDATE public.modules SET sort_order = 2 WHERE name = 'Chased';
UPDATE public.modules SET sort_order = 3 WHERE name = 'Minnie & The Magnificent Mongrels';
UPDATE public.modules SET sort_order = 4 WHERE name = 'The Basement';
UPDATE public.modules SET sort_order = 5 WHERE name = 'The Arena';
