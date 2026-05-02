-- scene-tokens-doors.sql
-- Phase 2 of the tactical map vision system. Adds first-class door
-- semantics to object tokens. The visual was already there (the
-- 🚪 Door object icon shipped with CampaignObjects); this adds the
-- mechanical toggle: closed doors block movement into their cell,
-- open doors don't, and clicking a door token swaps the state.
--
-- New columns on scene_tokens:
--   is_door   — flagged true for any token meant to behave as a door.
--               Set automatically when an object is created with the
--               'door' icon; GMs can also flip the flag manually
--               via the object edit form.
--   door_open — true = passable, false = closed and blocking. Default
--               true (open) so newly-placed doors don't accidentally
--               wall off the map.
--
-- Backfill: any existing object token with color='door' becomes
-- is_door=true so live campaigns don't lose their door affordance.
--
-- Movement-blocking enforcement is client-side in TacticalMap (the
-- target cell is rejected when it sits on a closed door). RLS already
-- gates writes — players can toggle door_open if the door is in their
-- controlled_by_character_ids OR they're the GM, same pattern as
-- existing object updates.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS is_door   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS door_open boolean NOT NULL DEFAULT true;

-- Backfill: existing rows with the door icon (color='door') become
-- doors. door_open stays at its DEFAULT true so they all start passable.
UPDATE public.scene_tokens
   SET is_door = true
 WHERE token_type = 'object'
   AND color = 'door'
   AND is_door = false;

NOTIFY pgrst, 'reload schema';
