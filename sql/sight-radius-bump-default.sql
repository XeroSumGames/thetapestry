-- sight-radius-bump-default.sql
-- Default sight radius was 6 cells (~30ft @ 5ft/cell) — fine for a
-- "torch in a pitch-dark room" UX, terrible for normally-lit scenes
-- where opening a door should reveal the corridor beyond. Bumps the
-- column default to 30 cells (~150ft, "Medium" range band) and
-- backfills any token still at the old default so the new behavior
-- shows up immediately on existing scenes.
--
-- Tokens whose sight has been hand-tuned away from 6 are left alone
-- — those reflect deliberate GM choices (stealth, torch radius,
-- blinded character).
--
-- Idempotent.

ALTER TABLE public.scene_tokens
  ALTER COLUMN sight_radius_cells SET DEFAULT 30;

UPDATE public.scene_tokens
   SET sight_radius_cells = 30
 WHERE sight_radius_cells = 6;

NOTIFY pgrst, 'reload schema';
