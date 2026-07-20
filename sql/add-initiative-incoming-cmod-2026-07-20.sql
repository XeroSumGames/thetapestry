-- H4 Cover Fire fix (Beta-500 Gate 2.1): give incoming combat-modifiers their
-- own home on the initiative row.
--
-- The bug: Cover Fire wrote its -2 CMod onto the TARGET's aim_bonus, but
-- activateUpdate resets aim_bonus to 0 the instant the target activates (start
-- of their turn) - so the penalty was wiped exactly when it should apply. Worse,
-- aim_bonus is also the target's OWN Aim (+2), so it was the wrong field to
-- borrow.
--
-- Fix: a dedicated incoming_cmod column that activation does NOT reset. Cover
-- Fire subtracts 2 here (accumulates across multiple cover-fires); computeAttackCmod
-- reads it as a labeled term on the target's next attack; nextTurn clears it at
-- the target's turn END so it only ever bites the one next action.
--
-- Xero canon (2026-07-20): the -2 STICKS to the target's next action, and Cover
-- Fire spends a round of ammo (gated when the clip is empty).
--
-- Additive + backward-compatible: NOT NULL DEFAULT 0, mirrors coordinate_bonus /
-- defense_bonus. Existing rows get 0. No function body -> no em/en-dash concern.
-- Covered by the existing table-level UPDATE grant + the campaign-members/GM
-- write RLS policy (row-level, not column-level), so no new grant needed.
--
-- Apply with:
--   npx supabase db query --linked -f sql/add-initiative-incoming-cmod-2026-07-20.sql
-- Then mirror into sql/_baseline/schema.sql and lib/database.types.ts.

ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS incoming_cmod integer NOT NULL DEFAULT 0;
