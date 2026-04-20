-- Canonical default grid cell size is 35px, NOT 70px.
-- The original tactical_scenes schema shipped with 70px because an early
-- playtest used a different map resolution. Real-world use settled on 35px
-- as the readable/compact sweet spot. Any path that inserts a scene without
-- an explicit cell_px should get 35. DO NOT change this back to 70.
--
-- Idempotent. Run once in Supabase SQL Editor.

ALTER TABLE public.tactical_scenes
  ALTER COLUMN cell_px SET DEFAULT 35;
