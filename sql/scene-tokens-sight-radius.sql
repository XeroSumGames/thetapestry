-- scene-tokens-sight-radius.sql
-- Per-token sight radius for the fog vision punch-through. Hard-coded
-- 6-cell radius works as a default but doesn't model torch-bearers
-- (longer), low-light vision (longer), or stealthing PCs (shorter).
-- This adds a column the GM can tune per-token.
--
-- TacticalMap reads tok.sight_radius_cells with a 6-cell fallback so
-- existing rows behave identically until edited. NPC tokens can also
-- carry a value for future Phase 3 NPC-vision work, but the current
-- algorithm only illuminates fog from PC tokens.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS sight_radius_cells int NOT NULL DEFAULT 6;

NOTIFY pgrst, 'reload schema';
