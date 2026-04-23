-- ============================================================
-- community_members: add 'assigned' to role CHECK
-- ============================================================
--
-- Gatherers / Maintainers / Safety are the SRD labor roles with
-- minimum percentages. `unassigned` is idle labor available to be
-- assigned. `assigned` is new: the NPC is busy with a specific
-- task a PC has given them (e.g. "guard this pin", "follow me",
-- "run this errand"). Assigned NPCs are still community members
-- but NOT counted in the labor pool for role minimums — the auto-
-- rebalance skips them, and role percentages exclude them from
-- the denominator.
--
-- Idempotent: DROP + re-ADD the constraint.

ALTER TABLE public.community_members
  DROP CONSTRAINT IF EXISTS community_members_role_check;

ALTER TABLE public.community_members
  ADD CONSTRAINT community_members_role_check
  CHECK (role IN ('gatherer','maintainer','safety','unassigned','assigned'));

-- ── Diagnostic ──
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'public.community_members'::regclass AND contype = 'c';
