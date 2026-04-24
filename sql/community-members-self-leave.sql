-- Self-leave RLS for community_members.
--
-- Before this: the only UPDATE policy on community_members covered the GM
-- (and any existing Phase B insert/update policies). A player clicking a
-- "Leave" button would hit RLS and silently fail — UPDATE succeeds with
-- 0 rows affected, no JS error, the PC stays in the community.
--
-- This policy lets an authenticated user soft-delete their OWN PC's
-- community_members row by flipping `left_at` / `left_reason`. The USING
-- clause proves they own the character via campaign_members; the
-- WITH CHECK clause mirrors it so a player can't abuse the UPDATE to
-- wedge themselves back in or swap characters.
--
-- Scope is deliberately narrow — this policy only matches rows where
-- character_id is set and that character belongs to the auth user. NPC
-- rows, rows for other PCs, and rows the GM manages stay on the GM's
-- existing policy.
--
-- Idempotent. Run in Supabase SQL Editor.
-- ============================================================

DROP POLICY IF EXISTS "Player leaves own community row" ON public.community_members;
CREATE POLICY "Player leaves own community row"
  ON public.community_members FOR UPDATE TO authenticated
  USING (
    character_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.campaign_members cm
      JOIN public.communities c ON c.campaign_id = cm.campaign_id
      WHERE c.id = community_members.community_id
        AND cm.character_id = community_members.character_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    character_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.campaign_members cm
      JOIN public.communities c ON c.campaign_id = cm.campaign_id
      WHERE c.id = community_members.community_id
        AND cm.character_id = community_members.character_id
        AND cm.user_id = auth.uid()
    )
  );
