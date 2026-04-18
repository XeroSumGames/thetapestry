-- ============================================================
-- Token properties — flexible key-value attributes
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS properties jsonb NOT NULL DEFAULT '[]'::jsonb;
