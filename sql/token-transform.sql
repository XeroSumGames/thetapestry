-- ============================================================
-- Token scale + rotation columns
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS scale real NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS rotation real NOT NULL DEFAULT 0;
