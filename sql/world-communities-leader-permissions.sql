-- Phase E — widen world_communities RLS so the community's LEADER
-- can publish / re-publish / unpublish their own community.
--
-- Background: the original policies (sql/world-communities.sql)
-- gated INSERT/UPDATE/DELETE on `campaigns.gm_user_id = auth.uid()`.
-- That made sense for GM-only campaigns, but Communities are a
-- player-driven subsystem: a PC can be the Founder + Leader of
-- their community and should be able to publish it to the Tapestry
-- themselves without asking the GM to do it for them.
--
-- This migration:
--   1. Widens INSERT to also allow the community's leader
--      (communities.leader_user_id = auth.uid()).
--   2. Widens UPDATE to the same set (re-publish flow).
--   3. Widens DELETE to the same set (unpublish flow).
--
-- GM + publisher + Thriver remain valid actors on UPDATE/DELETE.
-- Thriver never gets INSERT — they don't publish on behalf of
-- someone else; they only moderate.
--
-- Idempotent — drops + recreates the three policies. Safe to re-run.

-- ── INSERT ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "world_communities_insert_gm" ON public.world_communities;
DROP POLICY IF EXISTS "world_communities_insert" ON public.world_communities;
CREATE POLICY "world_communities_insert"
  ON public.world_communities FOR INSERT
  WITH CHECK (
    published_by = auth.uid()
    AND (
      -- GM of the source campaign
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = world_communities.source_campaign_id
          AND c.gm_user_id = auth.uid()
      )
      -- OR leader of the source community
      OR EXISTS (
        SELECT 1 FROM public.communities cm
        WHERE cm.id = world_communities.source_community_id
          AND cm.leader_user_id = auth.uid()
      )
    )
  );

-- ── UPDATE ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "world_communities_update" ON public.world_communities;
CREATE POLICY "world_communities_update"
  ON public.world_communities FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    OR published_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = world_communities.source_campaign_id
        AND c.gm_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.communities cm
      WHERE cm.id = world_communities.source_community_id
        AND cm.leader_user_id = auth.uid()
    )
  );

-- ── DELETE ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "world_communities_delete" ON public.world_communities;
CREATE POLICY "world_communities_delete"
  ON public.world_communities FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    OR published_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = world_communities.source_campaign_id
        AND c.gm_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.communities cm
      WHERE cm.id = world_communities.source_community_id
        AND cm.leader_user_id = auth.uid()
    )
  );
