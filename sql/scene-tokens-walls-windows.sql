-- scene-tokens-walls-windows.sql
-- Vision-blocking semantics for object tokens. Builds on the door
-- migration: closed doors already model "blocks movement + vision
-- when shut," walls add "always blocks both," and windows model
-- "blocks movement but vision passes through" (the obvious thing
-- you want for a building exterior with a kitchen view).
--
-- New columns:
--   is_wall   — true on objects that should block both movement +
--               line of sight unconditionally. The 🧱 wall icon
--               auto-sets this.
--   is_window — true on objects that block movement (still in the
--               way) but DON'T block vision. The 🪟 window icon
--               auto-sets this.
--
-- The vision-punch algorithm in TacticalMap reads these alongside
-- is_door/door_open: a cell is a vision blocker when (is_wall) OR
-- (is_door AND door_open=false). Windows are explicitly skipped so
-- a PC behind a window still illuminates fog on the far side.
--
-- Backfill: any existing object token with color='wall' becomes
-- is_wall=true so existing walls behave correctly without GMs
-- touching them. (Window backfill is a no-op — the window preset
-- ships in the same patch as this migration.)
--
-- Idempotent — safe to re-run.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS is_wall   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_window boolean NOT NULL DEFAULT false;

UPDATE public.scene_tokens
   SET is_wall = true
 WHERE token_type = 'object'
   AND color = 'wall'
   AND is_wall = false;

NOTIFY pgrst, 'reload schema';
