-- Add hidden_from_players flag to initiative_order so the GM can stage
-- ambush / hidden-adversary NPCs in combat without spoiling the surprise
-- in the players' initiative bar.
--
-- Trigger: 2026-05-31 playtest. Xero was manually moving NPC Dylan to
-- keep him offscreen so the kids wouldn't see the threat coming. This
-- column + the HP UI consumer make that the GM's default option.
--
-- Finding: tasks/finding-hidden-npc-in-initiative-2026-05-31.md
--
-- DEFAULT false keeps every existing row trivially correct. No RLS
-- changes needed: only the GM can INSERT/UPDATE initiative_order, and
-- that's exactly who sets this column. Realtime publication membership
-- already present (initiative_order is in supabase_realtime).
--
-- Apply: npx supabase db query --linked -f sql/initiative-hidden-from-players-2026-05-31.sql
-- Apply this in the SAME commit as the HP UI consumer to avoid an
-- orphan column in live.

ALTER TABLE initiative_order
  ADD COLUMN IF NOT EXISTS hidden_from_players boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN initiative_order.hidden_from_players IS
  'When true, this initiative entry is filtered out of the players'' '
  'InitiativeBar render and shows as a "Waiting..." placeholder during '
  'its active turn. GM still sees the full entry with a HIDDEN chip. '
  'Couples to scene_tokens.is_visible for the matching NPC token. '
  'Set false on Reveal. Added 2026-05-31.';
