-- tactical-scenes-lighting-mode.sql
-- Day/Night per-scene lighting toggle. Night = current behavior:
-- per-token sight radius (default 30 cells), auto-fog kicks in
-- beyond the radius. Day = sight is unbounded by distance, only
-- limited by line-of-sight (walls + closed doors). Outdoors in
-- daylight, PCs see to the horizon; inside buildings, walls
-- still cast vision shadows.
--
-- Default = 'day' so brand-new scenes don't surprise GMs with
-- aggressive fog the first time they place a token. Switch to
-- 'night' for dungeons / nighttime exteriors.
--
-- Idempotent.

ALTER TABLE public.tactical_scenes
  ADD COLUMN IF NOT EXISTS lighting_mode text NOT NULL DEFAULT 'day';

NOTIFY pgrst, 'reload schema';
