-- ============================================================
-- Add coord_chain_id to roll_log so a Coordinated Effort chain
-- can be retconned when a participant withdraws mid-chain.
--
-- Option B (locked 2026-05-17 per Xero): if a participant opts
-- out, every already-rolled chain row gets cmod -= 1, total -= 1,
-- outcome recomputed. We need a chain id stamped on every chain
-- row so the withdraw handler can find them all without parsing
-- labels.
--
-- Existing rows pre-2026-05-17 stay NULL - they predate this
-- mechanic.
--
-- Idempotent. Run via supabase db query --linked.
-- ============================================================

ALTER TABLE roll_log ADD COLUMN IF NOT EXISTS coord_chain_id uuid;

CREATE INDEX IF NOT EXISTS idx_roll_log_coord_chain_id
  ON roll_log (coord_chain_id)
  WHERE coord_chain_id IS NOT NULL;
