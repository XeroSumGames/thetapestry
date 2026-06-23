-- Pre-Beta-500 RLS hardening: close untrusted-user READ + storage-write holes.
-- From stability-audit-2026-06-23.md (HIGH cluster H-SEC-1..5).
--
-- Root pattern: an old broad policy (auth.role()='authenticated' / USING(true))
-- was left sitting NEXT TO a newer scoped policy. RLS policies OR-combine, so
-- the broad one wins and the scoped one is dead. Harmless among friends; a
-- data-exposure / griefing surface once accounts are untrusted.
--
-- Verified live before writing: every GM is also a campaign_members row
-- (0/22 campaigns have a non-member GM), so the existing co-member SELECT
-- policies already cover GM reads; we add an explicit GM clause as insurance.
-- Storage key formats verified: campaign-covers = <campaign_id>/...,
-- module-covers = <module_id>/... . SELECT (public read) is intentionally
-- left open for covers; only writes are scoped. Uses ::text comparison (not
-- ::uuid cast) so a malformed/legacy flat key fails closed instead of erroring.
--
-- NOT in this file (deferred, MEDIUM, need care): campaign_members read
-- (self-referential -> RLS recursion, needs a SECURITY DEFINER helper) and
-- object-tokens insert (campaign-scoped folder; confirm player-upload path first).
--
-- Idempotent. Reversible (drops only the broad/loose policies; recreates scoped).

-- ============================================================
-- H-SEC-1: characters - drop world-read, keep scoped co-member/owner read,
--          add explicit GM-of-campaign read insurance.
-- ============================================================
DROP POLICY IF EXISTS "Characters viewable by authenticated users" ON public.characters;

-- Insurance: a GM can read any character assigned to a member of a campaign
-- they run (covered today by the co-member policy since GMs are members, but
-- make it explicit so it survives a future GM that isn't a member row).
DROP POLICY IF EXISTS "GM reads member characters in their campaigns" ON public.characters;
CREATE POLICY "GM reads member characters in their campaigns"
  ON public.characters FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaign_members cm
    JOIN public.campaigns c ON c.id = cm.campaign_id
    WHERE c.gm_user_id = auth.uid() AND cm.character_id = characters.id
  ));
-- Remaining SELECT coverage after this: owner + campaign co-members
-- ("Campaign members read each other's characters") + thriver bypass.

-- ============================================================
-- H-SEC-2: character_states - drop world-read, add member-or-GM scoped read
--          (mirrors the existing UPDATE policy's USING exactly).
-- ============================================================
DROP POLICY IF EXISTS "Members can view all states in their campaign" ON public.character_states;

DROP POLICY IF EXISTS "Members and GM view states in their campaign" ON public.character_states;
CREATE POLICY "Members and GM view states in their campaign"
  ON public.character_states FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.campaign_members cm
            WHERE cm.campaign_id = character_states.campaign_id AND cm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = character_states.campaign_id AND c.gm_user_id = auth.uid())
  );

-- ============================================================
-- H-SEC-3: roll_log - drop world-read (USING true) + add member-or-GM scoped
--          read; tighten insert so a stranger can't inject rolls into any
--          campaign's live feed.
-- ============================================================
DROP POLICY IF EXISTS "Campaign members can view rolls" ON public.roll_log;
CREATE POLICY "Campaign members can view rolls"
  ON public.roll_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.campaign_members cm
            WHERE cm.campaign_id = roll_log.campaign_id AND cm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = roll_log.campaign_id AND c.gm_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their own rolls" ON public.roll_log;
CREATE POLICY "Users can insert their own rolls"
  ON public.roll_log FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (SELECT 1 FROM public.campaign_members cm
              WHERE cm.campaign_id = roll_log.campaign_id AND cm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.campaigns c
                 WHERE c.id = roll_log.campaign_id AND c.gm_user_id = auth.uid())
    )
  );

-- ============================================================
-- H-SEC-4: campaign-covers storage - scope write ops to the GM of the
--          campaign whose id is the object's top folder. Public read stays.
-- ============================================================
DROP POLICY IF EXISTS "campaign-covers insert" ON storage.objects;
CREATE POLICY "campaign-covers insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-covers'
    AND ( public.is_thriver()
      OR EXISTS (SELECT 1 FROM public.campaigns c
                 WHERE c.id::text = (storage.foldername(name))[1] AND c.gm_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "campaign-covers update" ON storage.objects;
CREATE POLICY "campaign-covers update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'campaign-covers'
    AND ( public.is_thriver()
      OR EXISTS (SELECT 1 FROM public.campaigns c
                 WHERE c.id::text = (storage.foldername(name))[1] AND c.gm_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "campaign-covers delete" ON storage.objects;
CREATE POLICY "campaign-covers delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-covers'
    AND ( public.is_thriver()
      OR EXISTS (SELECT 1 FROM public.campaigns c
                 WHERE c.id::text = (storage.foldername(name))[1] AND c.gm_user_id = auth.uid()))
  );

-- ============================================================
-- H-SEC-5: module-covers storage - scope write ops to the module author
--          (top folder = module id). Public read stays. The single legacy
--          flat-key cover falls to thriver-only writes (acceptable).
-- ============================================================
DROP POLICY IF EXISTS "Authors upload module covers" ON storage.objects;
CREATE POLICY "Authors upload module covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'module-covers'
    AND ( public.is_thriver()
      OR EXISTS (SELECT 1 FROM public.modules m
                 WHERE m.id::text = (storage.foldername(name))[1] AND m.author_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Authors update module covers" ON storage.objects;
CREATE POLICY "Authors update module covers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'module-covers'
    AND ( public.is_thriver()
      OR EXISTS (SELECT 1 FROM public.modules m
                 WHERE m.id::text = (storage.foldername(name))[1] AND m.author_user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Authors delete module covers" ON storage.objects;
CREATE POLICY "Authors delete module covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'module-covers'
    AND ( public.is_thriver()
      OR EXISTS (SELECT 1 FROM public.modules m
                 WHERE m.id::text = (storage.foldername(name))[1] AND m.author_user_id = auth.uid()))
  );

NOTIFY pgrst, 'reload schema';
