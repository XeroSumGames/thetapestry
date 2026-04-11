-- ============================================================
-- Allow campaign members to update campaign_npcs (damage, status).
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================
--
-- Why: PC → NPC damage application updates campaign_npcs.wp_current.
-- The existing UPDATE policy on campaign_npcs likely only permits the
-- GM (or no one), so damage from a player's roll gets silently dropped
-- by RLS. Same silent-success-zero-rows pattern as character_states.
--
-- This policy lets ANY member of the campaign update campaign_npcs
-- rows in that campaign, which is necessary for damage resolution to
-- flow from either direction.

-- Diagnostic — see existing policies first.
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy
WHERE polrelid = 'public.campaign_npcs'::regclass
ORDER BY polcmd, polname;

DROP POLICY IF EXISTS "Campaign members update campaign_npcs" ON public.campaign_npcs;
CREATE POLICY "Campaign members update campaign_npcs"
  ON public.campaign_npcs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = campaign_npcs.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_npcs.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = campaign_npcs.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_npcs.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );
