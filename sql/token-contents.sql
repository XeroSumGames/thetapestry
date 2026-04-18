-- ============================================================
-- Token contents — lootable items inside object tokens
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS contents jsonb NOT NULL DEFAULT '[]'::jsonb;
-- contents: [{ type: 'weapon'|'equipment', name: string, quantity: number }]
