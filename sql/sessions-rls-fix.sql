-- Allow GMs to delete and update sessions in their own campaigns
-- Run in Supabase SQL Editor

-- DELETE policy
DROP POLICY IF EXISTS "GMs can delete sessions" ON public.sessions;
CREATE POLICY "GMs can delete sessions"
  ON public.sessions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = sessions.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- UPDATE policy (for renumbering)
DROP POLICY IF EXISTS "GMs can update sessions" ON public.sessions;
CREATE POLICY "GMs can update sessions"
  ON public.sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = sessions.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = sessions.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );
