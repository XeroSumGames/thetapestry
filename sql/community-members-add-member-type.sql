-- ============================================================
-- community_members: add 'member' to recruitment_type
-- ============================================================
--
-- Per SRD §08, the recruitment types (Cohort / Conscript / Convert /
-- Apprentice) describe HOW an NPC was recruited via a Recruitment
-- Check. PCs joining a community aren't "recruited" — they're just
-- members. Using 'cohort' for PC joins (as the code did originally)
-- polluted the Cohort count used by Morale Check departure math
-- (Cohorts are first to leave on failure; PCs shouldn't be).
--
-- Adds a new value 'member' to the CHECK constraint and keeps the
-- existing values. 'founder' still distinguishes community creators;
-- new PC joiners default to 'member'.
--
-- Idempotent: DROP + re-ADD the constraint.

ALTER TABLE public.community_members
  DROP CONSTRAINT IF EXISTS community_members_recruitment_type_check;

ALTER TABLE public.community_members
  ADD CONSTRAINT community_members_recruitment_type_check
  CHECK (recruitment_type IN ('cohort','conscript','convert','apprentice','founder','member'));

-- ── Diagnostic ──
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'public.community_members'::regclass AND contype = 'c';
