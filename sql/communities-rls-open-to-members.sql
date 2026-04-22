-- ============================================================
-- Open Community write policies to any campaign member
-- ============================================================
-- Communities in the Tapestry are player-created and player-driven
-- (see docs/Rules/ XSE SRD §08). The Phase A policies in
-- sql/communities-phase-a.sql restricted INSERT / UPDATE / DELETE to
-- the campaign GM only, which forces GM-gated UX. User direction:
-- drop that gate — any member of a campaign can create, edit, and
-- delete communities inside it, as well as manage the member roster,
-- run morale checks, and run resource checks.
--
-- SELECT policies are unchanged (already allow any campaign member).
-- This migration is idempotent: DROP POLICY IF EXISTS + re-CREATE.

-- ── communities — insert / update / delete ──
DROP POLICY IF EXISTS communities_insert ON public.communities;
CREATE POLICY communities_insert ON public.communities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = communities.campaign_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS communities_update ON public.communities;
CREATE POLICY communities_update ON public.communities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = communities.campaign_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS communities_delete ON public.communities;
CREATE POLICY communities_delete ON public.communities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = communities.campaign_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

-- ── community_members — insert / update / delete ──
DROP POLICY IF EXISTS community_members_insert ON public.community_members;
CREATE POLICY community_members_insert ON public.community_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS community_members_update ON public.community_members;
CREATE POLICY community_members_update ON public.community_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS community_members_delete ON public.community_members;
CREATE POLICY community_members_delete ON public.community_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

-- ── community_morale_checks — insert ──
DROP POLICY IF EXISTS community_morale_insert ON public.community_morale_checks;
CREATE POLICY community_morale_insert ON public.community_morale_checks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_morale_checks.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

-- ── community_resource_checks — insert ──
DROP POLICY IF EXISTS community_resource_insert ON public.community_resource_checks;
CREATE POLICY community_resource_insert ON public.community_resource_checks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_resource_checks.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

-- ============================================================
-- Diagnostic — confirm policies live
-- ============================================================
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
-- FROM pg_policy
-- WHERE polrelid IN ('public.communities'::regclass, 'public.community_members'::regclass, 'public.community_morale_checks'::regclass, 'public.community_resource_checks'::regclass)
-- ORDER BY polrelid::text, polcmd, polname;
