-- ============================================================
-- Coordinate action: target-specific combat bonus
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- Which target the coordinate bonus applies against
ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS coordinate_target text;

-- The CMod bonus when attacking the coordinate_target
ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS coordinate_bonus integer NOT NULL DEFAULT 0;
