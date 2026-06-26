-- Enable RLS on public.pregen_campaign_map (Supabase linter 0013_rls_disabled_in_public).
--
-- This pregen<->campaign join table (pregen_id, campaign_id) shipped with the
-- pregen feature but RLS was never enabled. anon AND authenticated both hold
-- full SELECT/INSERT/UPDATE/DELETE grants, so with RLS off an UNAUTHENTICATED
-- request could read or wipe every mapping via the REST API. (My 2026-06-23
-- audit missed it because a no-RLS table has no policies to show in a
-- pg_policies scan - lesson logged.)
--
-- Policies mirror pregen_library's model. READ reuses pregen_library's own RLS:
-- the EXISTS subquery returns a row only for pregens the caller may already see
-- (author / approved / thriver), so the /pregens embed + the by-campaign picker
-- keep working without re-stating that logic. WRITE is limited to the pregen's
-- author, the linked campaign's GM, or a Thriver (official pregens have
-- author_id NULL -> Thriver-managed, which matches the editor surface).
--
-- Enabling RLS denies all access until a policy allows it, so the policies are
-- created in the same statement batch. Idempotent. Reversible.

ALTER TABLE public.pregen_campaign_map ENABLE ROW LEVEL SECURITY;

-- READ: thriver; OR you can see the linked pregen (pregen_library RLS filters
-- this to author/approved/thriver); OR you GM the linked campaign.
DROP POLICY IF EXISTS "pregen_campaign_map_read" ON public.pregen_campaign_map;
CREATE POLICY "pregen_campaign_map_read"
  ON public.pregen_campaign_map FOR SELECT
  USING (
    public.is_thriver()
    OR EXISTS (SELECT 1 FROM public.pregen_library pl WHERE pl.id = pregen_campaign_map.pregen_id)
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = pregen_campaign_map.campaign_id AND c.gm_user_id = auth.uid())
  );

-- WRITE (insert/update/delete): thriver; OR author of the linked pregen; OR GM
-- of the linked campaign. Anonymous (auth.uid() IS NULL) satisfies none -> blocked.
DROP POLICY IF EXISTS "pregen_campaign_map_insert" ON public.pregen_campaign_map;
CREATE POLICY "pregen_campaign_map_insert"
  ON public.pregen_campaign_map FOR INSERT
  WITH CHECK (
    public.is_thriver()
    OR EXISTS (SELECT 1 FROM public.pregen_library pl
               WHERE pl.id = pregen_campaign_map.pregen_id AND pl.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = pregen_campaign_map.campaign_id AND c.gm_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "pregen_campaign_map_update" ON public.pregen_campaign_map;
CREATE POLICY "pregen_campaign_map_update"
  ON public.pregen_campaign_map FOR UPDATE
  USING (
    public.is_thriver()
    OR EXISTS (SELECT 1 FROM public.pregen_library pl
               WHERE pl.id = pregen_campaign_map.pregen_id AND pl.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = pregen_campaign_map.campaign_id AND c.gm_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "pregen_campaign_map_delete" ON public.pregen_campaign_map;
CREATE POLICY "pregen_campaign_map_delete"
  ON public.pregen_campaign_map FOR DELETE
  USING (
    public.is_thriver()
    OR EXISTS (SELECT 1 FROM public.pregen_library pl
               WHERE pl.id = pregen_campaign_map.pregen_id AND pl.author_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = pregen_campaign_map.campaign_id AND c.gm_user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
