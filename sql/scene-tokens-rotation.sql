-- Per-token rotation (degrees) for orienting vehicles, cars, etc. on
-- the tactical map. 0 = default (no rotation). The TacticalMap canvas
-- draw applies ctx.rotate(rotation * π / 180) around the token center
-- before drawing the portrait. The vehicle popout exposes a slider
-- that writes back to this field.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS rotation int DEFAULT 0;
