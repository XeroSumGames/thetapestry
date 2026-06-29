-- Seams for the last two app-coordinated security items (2026-06-23).
-- Additive + safe to ship now. The actual leaks close when HP rewires the
-- readers to these RPCs and PF then revokes the column SELECT grants (see
-- handoff-hp-pii-revokes-2026-06-23.md). Definer + pinned search_path.

-- profiles.email is SELECT-granted to anon+authenticated -> any logged-in user
-- can GET /profiles?select=email and harvest every email (PII/GDPR). This RPC
-- returns an email only for the caller's own row or to a Thriver (moderation).
CREATE OR REPLACE FUNCTION public.get_profile_email(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT email FROM public.profiles
  WHERE id = p_user_id AND (p_user_id = auth.uid() OR public.is_thriver());
$$;
REVOKE ALL ON FUNCTION public.get_profile_email(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_email(uuid) TO authenticated;

-- campaigns.invite_code is readable in bulk (campaigns SELECT is USING(true))
-- -> enumerate every campaign + harvest every code -> join any game. This RPC
-- returns a campaign's code only to its GM / a member / a Thriver, for the
-- GM-side "share invite link" display. (Joining by code uses the separate
-- find_campaign_by_invite_code RPC.)
CREATE OR REPLACE FUNCTION public.get_campaign_invite_code(p_campaign_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT c.invite_code FROM public.campaigns c
  WHERE c.id = p_campaign_id
    AND (c.gm_user_id = auth.uid() OR public.is_campaign_member(p_campaign_id) OR public.is_thriver());
$$;
REVOKE ALL ON FUNCTION public.get_campaign_invite_code(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_invite_code(uuid) TO authenticated;
