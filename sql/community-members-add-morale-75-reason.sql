-- Phase C — widen left_reason to accept 'morale_75' (Moment of Low
-- Insight on a Morale Check drops 75% of the community). Existing
-- allowed set: morale_25, morale_50, dissolved, manual, killed.
-- Idempotent: re-running drops and re-adds the same constraint.

ALTER TABLE public.community_members
  DROP CONSTRAINT IF EXISTS community_members_left_reason_check;

ALTER TABLE public.community_members
  ADD CONSTRAINT community_members_left_reason_check
  CHECK (
    left_reason IS NULL OR left_reason IN (
      'morale_25', 'morale_50', 'morale_75',
      'dissolved', 'manual', 'killed'
    )
  );
