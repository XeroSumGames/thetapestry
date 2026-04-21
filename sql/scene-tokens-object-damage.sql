-- ============================================================
-- Allow campaign members to update destructible object tokens
-- (crates, barrels, cars) when they attack them.
--
-- Without this, the existing `Players move own token` policy only
-- lets a user write to rows where token_type='pc' and the token
-- belongs to their PC. Object damage updates from a player client
-- silently fail (RLS returns 0 rows, no JS error, crate never loses
-- HP). GM client works because GM has a broader policy.
--
-- Idempotent. Run in Supabase SQL Editor.
-- ============================================================

DROP POLICY IF EXISTS "Campaign members damage objects" ON public.scene_tokens;
CREATE POLICY "Campaign members damage objects"
  ON public.scene_tokens FOR UPDATE TO authenticated
  USING (
    token_type = 'object'
    AND EXISTS (
      SELECT 1 FROM public.tactical_scenes ts
      JOIN public.campaign_members cm ON cm.campaign_id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    token_type = 'object'
    AND EXISTS (
      SELECT 1 FROM public.tactical_scenes ts
      JOIN public.campaign_members cm ON cm.campaign_id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id
        AND cm.user_id = auth.uid()
    )
  );
