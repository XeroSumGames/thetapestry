-- tactical-scenes-fog-state.sql
-- Phase 1 of the tactical map vision system. Adds a sparse map of
-- fogged cells per scene so the GM can paint regions hidden from
-- players ("the dungeon is dark, I clear it as you explore").
--
-- Shape: jsonb object keyed by "x,y" cell coordinates with the value
-- always `true`. Empty = no fog (default). Sparse on purpose — a
-- 50×50 scene with 200 fogged cells stores ~3KB instead of 2500
-- entries. The render path skips any cell not in the map.
--
-- Players see fogged cells as opaque dark; tokens inside fogged
-- cells are hidden from the player render entirely. GM sees fog at
-- reduced opacity so they can inspect what's hidden.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.tactical_scenes
  ADD COLUMN IF NOT EXISTS fog_state jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
