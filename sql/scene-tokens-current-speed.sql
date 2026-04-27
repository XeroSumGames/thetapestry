-- Per-token acceleration state for vehicles (and any other object that
-- ramps up over multiple Move actions). Default 1 — Speed-1 first move
-- (30 ft for a Speed × 30 ft/round mapping). Increments by 1 per
-- successful Move, capped at the parent vehicle's max Speed.
--
-- Stored on scene_tokens directly so each instance of a vehicle on the
-- map has its own acceleration state (a campaign with two trucks
-- each ramps independently). Idempotent — safe to re-run.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS current_speed int DEFAULT 1;
