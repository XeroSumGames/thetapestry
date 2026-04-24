-- Phase E Sprint 4d — Schism mechanic.
--
-- When a community splits, members leaving with the breakaway are
-- soft-removed from the original (left_at + left_reason='schism')
-- AND re-inserted into the new community with a fresh row. Tracking
-- a 'schism' departure reason keeps the original's roster history
-- complete (you can reconstruct who left for the breakaway).
--
-- Idempotent — drops + re-adds the CHECK constraint to widen.

ALTER TABLE public.community_members
  DROP CONSTRAINT IF EXISTS community_members_left_reason_check;

ALTER TABLE public.community_members
  ADD CONSTRAINT community_members_left_reason_check
  CHECK (
    left_reason IS NULL OR left_reason IN (
      'morale_25', 'morale_50', 'morale_75',
      'dissolved', 'manual', 'killed', 'schism'
    )
  );
