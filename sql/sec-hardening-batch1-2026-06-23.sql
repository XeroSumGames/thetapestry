-- Security hardening batch 1 (pure-SQL, no app changes) - remaining MEDIUM
-- items from the 2026-06-23 "what else" pass. Each closes a cross-user read or
-- a storage-griefing write. Verified non-breaking before writing: storage
-- folders are campaign_id (object-tokens, campaign-npcs) / session_id
-- (session-attachments); campaign_members co-member reads keep working via a
-- SECURITY DEFINER membership helper (avoids RLS self-recursion); the policies
-- that subquery campaign_members (characters/character_states/roll_log/chat)
-- still resolve because each only needs the caller's own membership row + the
-- helper. Idempotent. Reversible.

-- ============================================================
-- 1. sessions - was SELECT USING(true): cross-campaign GM narrative
--    (gm_summary, cliffhanger, session_log) world-readable. Scope to member/GM.
-- ============================================================
DROP POLICY IF EXISTS "Sessions viewable by authenticated users" ON public.sessions;
CREATE POLICY "Sessions viewable by authenticated users"
  ON public.sessions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.campaign_members cm
            WHERE cm.campaign_id = sessions.campaign_id AND cm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = sessions.campaign_id AND c.gm_user_id = auth.uid())
    OR public.is_thriver()
  );

-- ============================================================
-- 2. campaign_members read - was auth.role()='authenticated' (whole membership
--    graph). Scope via a definer helper so the policy can reference membership
--    without recursing on its own table.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_campaign_member(p_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = p_campaign_id AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_campaign_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_campaign_member(uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can view their campaigns" ON public.campaign_members;
CREATE POLICY "Members can view their campaigns"
  ON public.campaign_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_campaign_member(campaign_members.campaign_id)
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = campaign_members.campaign_id AND c.gm_user_id = auth.uid())
    OR public.is_thriver()
  );

-- ============================================================
-- 3. portrait_bank TABLE - INSERT was USING(true) (anyone writes metadata);
--    SELECT was USING(true) (ignored is_private). Gate insert to owner; respect
--    is_private on read (public portraits stay shared).
-- ============================================================
DROP POLICY IF EXISTS "Users insert portrait bank metadata" ON public.portrait_bank;
CREATE POLICY "Users insert portrait bank metadata"
  ON public.portrait_bank FOR INSERT
  WITH CHECK (created_by = auth.uid() OR public.is_thriver());

DROP POLICY IF EXISTS "Anyone reads portrait bank metadata" ON public.portrait_bank;
CREATE POLICY "Anyone reads portrait bank metadata"
  ON public.portrait_bank FOR SELECT
  USING (coalesce(is_private, false) = false OR created_by = auth.uid() OR public.is_thriver());

-- ============================================================
-- 4. STORAGE: object-tokens (folder = campaign_id) - INSERT was bucket-only.
--    Scope to a member of that campaign. Public read unchanged.
-- ============================================================
DROP POLICY IF EXISTS "Users upload object tokens" ON storage.objects;
CREATE POLICY "Users upload object tokens"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'object-tokens'
    AND ( public.is_thriver() OR public.is_campaign_member(((storage.foldername(name))[1])::uuid) )
  );

-- ============================================================
-- 5. STORAGE: campaign-npcs portraits (folder = campaign_id) - upload/delete
--    were bucket-only. Scope I/U/D to a member of that campaign.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload campaign NPC portraits" ON storage.objects;
CREATE POLICY "Authenticated users can upload campaign NPC portraits"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-npcs' AND ( public.is_thriver() OR public.is_campaign_member(((storage.foldername(name))[1])::uuid) ));
DROP POLICY IF EXISTS "Authenticated users can update campaign NPC portraits" ON storage.objects;
CREATE POLICY "Authenticated users can update campaign NPC portraits"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-npcs' AND ( public.is_thriver() OR public.is_campaign_member(((storage.foldername(name))[1])::uuid) ));
DROP POLICY IF EXISTS "Authenticated users can delete campaign NPC portraits" ON storage.objects;
CREATE POLICY "Authenticated users can delete campaign NPC portraits"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-npcs' AND ( public.is_thriver() OR public.is_campaign_member(((storage.foldername(name))[1])::uuid) ));

-- ============================================================
-- 6. STORAGE: session-attachments (folder = session_id) - upload/delete were
--    bucket-only. Scope to the GM of the session's campaign (uploads happen at
--    End Session, GM-driven). Orphan files (deleted session) -> thriver only.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload session attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload session attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-attachments'
    AND ( public.is_thriver() OR EXISTS (
      SELECT 1 FROM public.sessions s JOIN public.campaigns c ON c.id = s.campaign_id
      WHERE s.id::text = (storage.foldername(name))[1] AND c.gm_user_id = auth.uid()))
  );
DROP POLICY IF EXISTS "Authenticated users can delete session attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete session attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-attachments'
    AND ( public.is_thriver() OR EXISTS (
      SELECT 1 FROM public.sessions s JOIN public.campaigns c ON c.id = s.campaign_id
      WHERE s.id::text = (storage.foldername(name))[1] AND c.gm_user_id = auth.uid()))
  );

NOTIFY pgrst, 'reload schema';
