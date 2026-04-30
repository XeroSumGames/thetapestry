-- Persist grid render settings on tactical_scenes so they survive a
-- main-window refresh. Previously show_grid / grid_color / grid_opacity
-- lived only in popout + TacticalMap memory, synced via BroadcastChannel
-- — refresh the main window and the grid reverted to defaults because
-- nothing on disk held the GM's choice.
--
-- has_grid (already on tactical_scenes since the original tactical-map.sql)
-- is the "this scene is configured WITH a grid" boolean — left untouched
-- so we don't accidentally repurpose its semantics. show_grid is the new
-- "render-the-lines" visibility flag, defaulting to true to match prior
-- in-memory default.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.tactical_scenes
  ADD COLUMN IF NOT EXISTS show_grid boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS grid_color text NOT NULL DEFAULT 'white',
  ADD COLUMN IF NOT EXISTS grid_opacity real NOT NULL DEFAULT 0.4;

COMMENT ON COLUMN public.tactical_scenes.show_grid IS
  'Render the grid lines on the canvas. Distinct from has_grid which means "this scene is configured with a grid at all."';
COMMENT ON COLUMN public.tactical_scenes.grid_color IS
  'CSS color for grid lines. Common values: white, black, #888, #c0392b, etc.';
COMMENT ON COLUMN public.tactical_scenes.grid_opacity IS
  'Grid line opacity 0..1. UI surfaces 5..100% as 0.05..1.0.';
