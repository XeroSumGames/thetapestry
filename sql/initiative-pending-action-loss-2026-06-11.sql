-- Add pending_action_loss flag to initiative_order to track grapple action debt.
-- When a combatant is grappled and has 0 actions remaining, the 1-action penalty
-- (canon: lose next action no matter when it falls) carries to their next turn via
-- this flag. activateUpdate() checks it: if true, gives 1 action instead of 2 and
-- resets the flag.
--
-- DEFAULT false keeps every existing row trivially correct. No RLS changes needed:
-- only game logic sets/clears this column. Realtime publication membership already
-- present (initiative_order is in supabase_realtime).
--
-- Apply: npx supabase db query --linked -f sql/initiative-pending-action-loss-2026-06-11.sql
-- Apply in the SAME commit as the HP UI consumer to avoid an orphan column in live.

ALTER TABLE initiative_order
  ADD COLUMN IF NOT EXISTS pending_action_loss boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN initiative_order.pending_action_loss IS
  'When true, this combatant owes one action at the start of their next turn '
  '(set when grapple succeeds but they have 0 actions_remaining this round). '
  'activateUpdate() reads it, gives them 1 action instead of 2, and resets it '
  'to false. Added 2026-06-11.';
