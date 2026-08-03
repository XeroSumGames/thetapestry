-- Fix: Thriver moderators could not actually approve/reject a world_npc
-- submitted by another user - the write silently matched 0 rows (found
-- while investigating the silent-write-failure sweep's world_npcs
-- approve/reject candidate, app/moderate/page.tsx:266).
--
-- Verified live: UPDATE via the "created_by = auth.uid()" branch (a
-- Thriver approving their OWN submission) succeeds. UPDATE via the
-- Thriver branch (an inline correlated EXISTS subquery on `profiles`)
-- against someone ELSE's pending row consistently matches 0 rows, even
-- though the exact same subquery evaluates true when run standalone.
-- Root cause not fully pinned to a single Postgres mechanism, but the
-- shape matches the proven pattern from today's campaign_members
-- incident: an inline correlated subquery on a second RLS-protected
-- table inside a policy is fragile. Every SIBLING moderation table
-- (forum_threads, lfg_posts, modules, war_stories, world_communities)
-- already grants Thriver access via the `is_thriver()` SECURITY DEFINER
-- helper instead of an inline subquery - world_npcs was the one table
-- that never got that treatment. Also missing: a SELECT-side Thriver
-- policy, so the pending-queue LIST itself (loadPendingWorldNpcs, a
-- plain client SELECT, not an RPC) was invisible for pending rows the
-- Thriver didn't submit themselves - the exact same gap every sibling
-- table already closes with its own `*_select_thriver` policy.

BEGIN;

DROP POLICY IF EXISTS "Thrivers can moderate world NPCs" ON public.world_npcs;
CREATE POLICY "Thrivers can moderate world NPCs" ON public.world_npcs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_thriver())
  WITH CHECK (created_by = auth.uid() OR public.is_thriver());

DROP POLICY IF EXISTS "world_npcs_select_thriver" ON public.world_npcs;
CREATE POLICY "world_npcs_select_thriver" ON public.world_npcs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_thriver());

COMMIT;
