-- tactical-scenes-reveal-state.sql
-- GM force-reveal layer. The fog of war system has two layers:
--
--   fog_state    — GM-painted fog (manually hidden cells)
--   reveal_state — GM-painted force-reveal (manually shown cells)
--
-- Effective fog rule:
--   cell is fogged iff (in fog_state OR outside-any-PC-LoS)
--                    AND NOT in reveal_state
--
-- reveal_state lets the GM override auto-fog for narrative reasons —
-- "the players can see the cliff face from here even though no PC
-- has line of sight to it." Inverse of fog_state. Same sparse-map
-- shape: jsonb keyed by "x,y" with `true` for force-revealed.
--
-- Idempotent.

ALTER TABLE public.tactical_scenes
  ADD COLUMN IF NOT EXISTS reveal_state jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
