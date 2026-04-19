-- Extend setting seed tables to carry scene backgrounds and handout attachments
-- so a GM Kit import preserves images when a new campaign is created from
-- the seed.
--
-- Run in Supabase SQL Editor. Idempotent.

-- Scene background images (URL kept as-is from the source campaign's bucket).
ALTER TABLE public.setting_seed_scenes
  ADD COLUMN IF NOT EXISTS background_url text;

-- Handout attachments — jsonb array of { name, url, size, type, path } objects.
-- Mirrors campaign_notes.attachments shape.
ALTER TABLE public.setting_seed_handouts
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
