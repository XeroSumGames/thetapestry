-- ============================================================
-- Allow GMs to update character_states in their own campaigns.
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================
--
-- Why: damage application updates character_states for the target PC.
-- The existing RLS likely only allows users to update their own state
-- (auth.uid() = user_id), so when the GM rolls for an NPC attacking a
-- player, the UPDATE silently affects 0 rows (Supabase returns success
-- with empty data, no error). Damage looks applied for a frame via the
-- optimistic local update, then loadEntries refetches and overwrites
-- it back to the unchanged DB value.
--
-- This adds a policy: campaign members (and the GM in particular) can
-- update any character_states row in a campaign they belong to.

-- Diagnostic — see existing policies first.
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy
WHERE polrelid = 'public.character_states'::regclass
ORDER BY polcmd, polname;

-- Permissive UPDATE policy for campaign members.
DROP POLICY IF EXISTS "Campaign members update character_states" ON public.character_states;
CREATE POLICY "Campaign members update character_states"
  ON public.character_states FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = character_states.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = character_states.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = character_states.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = character_states.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );
