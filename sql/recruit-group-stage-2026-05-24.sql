-- Recruit-into-a-Group: a Group is a lightweight pre-Community.
--
-- Canon (tasks/tapestry-rules-canon.md:746): PCs + recruited NPCs form a
-- GROUP; it becomes a COMMUNITY only at 13+ combined members (Morale Checks).
-- The platform wrongly forced founding+naming a Community at recruit #1.
--
-- Implemented as a `stage` flag on the existing `communities` row (Xero-
-- approved 2026-05-24, over a separate `groups` table): reuses all the
-- membership / recruit / roster plumbing, and the at-13 promotion is a flag
-- flip + a name prompt - zero data migration. The Group renders a simpler
-- card (roster + recruit only); morale / public / activity-blocks gate on
-- stage = 'community'.
--
-- Backward-compatible + additive: existing rows default to 'community'
-- (they are all real communities already). Apply via:
--   npx supabase db query --linked -f sql/recruit-group-stage-2026-05-24.sql

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'community';

-- A Group has no name until it is promoted to a Community at member 13.
ALTER TABLE communities
  ALTER COLUMN name DROP NOT NULL;

-- Guard the two valid stages. All existing rows are 'community', so the
-- constraint validates clean.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'communities_stage_chk'
  ) THEN
    ALTER TABLE communities
      ADD CONSTRAINT communities_stage_chk CHECK (stage IN ('group', 'community'));
  END IF;
END $$;
