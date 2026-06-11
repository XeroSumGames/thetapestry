-- Grapple/Subdue/Break-Free rework Phase 3.
-- Adds a "lose your next action whenever it falls" pending-debt column to
-- initiative_order, so a Grapple's defender-action-loss persists across
-- the round boundary if the defender already has 0 actions left when
-- they're grappled (consumeAction silently skips when actions < cost,
-- which is correct semantics for actions, but wrong for the canon
-- penalty - it should carry forward to the next turn).
--
-- Canon source: app/rules/combat/combat-rounds/page.tsx:26 (ebb19ce).
-- Engine spec: tasks/grapple-subdue-rework-spec.md.
-- Xero pre-approved live DB change.
--
-- Apply: npx supabase db query --linked -f sql/initiative-pending-action-loss-2026-06-11.sql
-- Apply this in the SAME commit as the HP UI consumer to avoid an orphan
-- column in live.
--
-- Default false keeps every existing initiative_order row trivially
-- correct. No RLS update needed: only the GM-or-engine pathways insert
-- into initiative_order, and that's exactly who sets this column.
-- Realtime publication membership already present (initiative_order is
-- in supabase_realtime).

ALTER TABLE initiative_order
  ADD COLUMN IF NOT EXISTS pending_action_loss boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN initiative_order.pending_action_loss IS
  'When true, the next time this entry would get an action (start of '
  'their next turn), spend it immediately and clear the flag. Set by '
  'Grapple''s defender-loses-1-action rule when the defender has 0 '
  'actions left at the moment they''re grappled, so the canon penalty '
  'carries forward instead of being silently swallowed. Added 2026-06-11 '
  'for grapple rework Phase 3.';
