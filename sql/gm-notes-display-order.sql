-- ============================================================
-- GM Notes: drag-to-reorder
-- Run in Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================

-- ── 1. Add display_order column ─────────────────────────────
-- Nullable so existing rows don't fail validation. The app
-- backfills with the row-number-by-created-at below and then
-- sets display_order on every new insert.

ALTER TABLE public.campaign_notes
  ADD COLUMN IF NOT EXISTS display_order integer;

-- ── 2. Backfill rows that don't have an order yet ───────────
-- Within each campaign, number existing notes 1..N by their
-- creation time so the visible order today is preserved.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id
      ORDER BY created_at ASC
    ) AS rn
  FROM public.campaign_notes
  WHERE display_order IS NULL
)
UPDATE public.campaign_notes cn
SET display_order = r.rn
FROM ranked r
WHERE cn.id = r.id;

-- ── 3. Index for fast ordered fetches ───────────────────────
CREATE INDEX IF NOT EXISTS campaign_notes_order_idx
  ON public.campaign_notes (campaign_id, display_order);
