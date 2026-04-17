-- ============================================================
-- Pin Multi-Category Support
-- Adds categories JSONB array to map_pins.
-- Backfills from existing category text field.
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- Add categories array column
ALTER TABLE public.map_pins
  ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: copy existing single category into the array
UPDATE public.map_pins
  SET categories = jsonb_build_array(category)
  WHERE (categories = '[]'::jsonb OR categories IS NULL)
    AND category IS NOT NULL
    AND category != '';
