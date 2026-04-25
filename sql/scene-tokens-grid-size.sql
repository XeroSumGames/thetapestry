-- scene-tokens-grid-size.sql
-- Adds explicit grid footprint columns to scene_tokens so an object
-- token (truck, wall, large piece of terrain) can occupy multiple cells
-- instead of being squeezed into a single cell with aspect-preserving
-- visual overflow. Default 1×1 keeps every existing token unchanged.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS grid_w int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grid_h int NOT NULL DEFAULT 1;

-- Defensive bounds — caps prevent a runaway value from making the token
-- engulf the whole map; the floor of 1 ensures a token always has at
-- least one cell of footprint.
ALTER TABLE public.scene_tokens
  DROP CONSTRAINT IF EXISTS scene_tokens_grid_size_check;
ALTER TABLE public.scene_tokens
  ADD CONSTRAINT scene_tokens_grid_size_check
  CHECK (grid_w BETWEEN 1 AND 20 AND grid_h BETWEEN 1 AND 20);
