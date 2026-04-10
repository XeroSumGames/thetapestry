-- ============================================================
-- Add sort_order to campaign_pins and campaign_npcs.
-- Idempotent: safe to re-run.
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. Columns + indexes ─────────────────────────────────────
ALTER TABLE public.campaign_pins
  ADD COLUMN IF NOT EXISTS sort_order int;

ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS sort_order int;

CREATE INDEX IF NOT EXISTS campaign_pins_sort_idx ON public.campaign_pins(campaign_id, sort_order);
CREATE INDEX IF NOT EXISTS campaign_npcs_sort_idx ON public.campaign_npcs(campaign_id, sort_order);

-- ── 2. Backfill existing rows ────────────────────────────────
-- Numbered 1..N within each campaign, ordered by created_at.
-- Only fills NULL values so re-running this preserves any manual reorders.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY created_at, id) AS rn
  FROM public.campaign_pins
  WHERE sort_order IS NULL
)
UPDATE public.campaign_pins p
SET sort_order = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY created_at, id) AS rn
  FROM public.campaign_npcs
  WHERE sort_order IS NULL
)
UPDATE public.campaign_npcs n
SET sort_order = ranked.rn
FROM ranked
WHERE n.id = ranked.id;
