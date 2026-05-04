-- windows-doors-default-flip.sql
-- Reframes the open/closed semantic per Xero's spec (2026-05-03):
--
--   Window  default = OPEN  (vision passes; glass always blocks
--           movement; "closed" means blinds/drapes drawn = vision
--           blocked; movement is unaffected by the toggle)
--   Door    default = CLOSED (vision + movement both blocked;
--           "open" passes both)
--   Wall    always blocks both (no toggle; delete wall to "destroy")
--
-- Existing window tokens were just flipped to door_open=false by
-- sql/scene-tokens-window-default-closed.sql under the previous
-- "closed glass" semantic. Under the new semantic, that means every
-- existing window suddenly starts blocking VISION — a regression.
-- Flip them back to door_open=true (the "default open" state).
--
-- Doors keep their existing per-row state — we don't retroactively
-- close every door in every scene. Only the CREATION default flips,
-- which lives in the application code.
--
-- Idempotent.

UPDATE public.scene_tokens
   SET door_open = true
 WHERE is_window = true
   AND door_open IS NOT true;

NOTIFY pgrst, 'reload schema';
