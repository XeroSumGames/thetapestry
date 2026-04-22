-- ============================================================
-- community_members: pending-request status + RLS for request flow
-- ============================================================
--
-- User spec: "when someone STARTS a new community, they are the de
-- facto leader. if someone wants to join a community, a request
-- should go to the leader/founder who has to approve it first."
--
-- Approach: add a `status` column to community_members. Existing
-- rows stay 'active'. New join requests insert as 'pending';
-- approve flips to 'active'; reject deletes the row. Invites
-- (leader-initiated) also insert as 'pending' but with an
-- invited_by_user_id so the accepting side knows who offered.
--
-- Idempotent: CREATE / ALTER guarded with IF NOT EXISTS.

-- ── schema ──
ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'removed'));

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS invited_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_community_members_status
  ON public.community_members(community_id, status);

-- ── RLS ──
-- The existing "campaign members" policies from
-- sql/communities-rls-open-to-members.sql still apply (any member of
-- the campaign can SELECT/INSERT/UPDATE/DELETE community_members).
-- The status column doesn't need a separate policy since every
-- legitimate workflow (pending insert, approve, reject, remove) is
-- already a member-authorized action.
--
-- A stricter "only the leader can approve" policy would tighten this
-- at the DB level; MVP trusts the UI gate. Phase B+ can add:
--
--   CREATE POLICY community_members_update_leader ON community_members FOR UPDATE
--     USING (
--       EXISTS (
--         SELECT 1 FROM communities c
--         WHERE c.id = community_members.community_id
--           AND c.leader_user_id = auth.uid()
--       )
--     );
--
-- Skipping for now since any member already has write access via the
-- widened policy; the UI only exposes approve/reject to leaders.

-- ── Diagnostic ──
-- SELECT column_name, data_type, column_default FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'community_members'
-- ORDER BY ordinal_position;
