-- scene-tokens-window-default-closed.sql
-- Windows now share door_open semantics with doors so alt-right-click
-- can toggle them (closed glass → open passage). Existing window
-- tokens were created when door_open defaulted true (the door rule);
-- under the new dual-semantic, that would mean "open window =
-- passable both ways" which would silently re-classify every existing
-- window. Backfill flips them to door_open=false so the current
-- behavior (movement blocked, vision passes) is preserved.
--
-- The same backfill is safe to apply to wall segments stored in
-- tactical_scenes.walls jsonb — those use a separate code path and
-- already default-undefined which the gate treats as closed.
-- Idempotent.

UPDATE public.scene_tokens
   SET door_open = false
 WHERE is_window = true
   AND door_open IS NOT false;

NOTIFY pgrst, 'reload schema';
