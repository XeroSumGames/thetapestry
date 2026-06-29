-- Prep for closing the campaigns/invite_code HIGH leak (2026-06-23 "what else").
--
-- Today `campaigns` SELECT is USING(true), so any authenticated user can
-- enumerate every campaign and harvest every invite_code -> join any private
-- game. We can't just scope the table read, because the join-by-code flow
-- (app/join/[code], app/stories/join) looks up a campaign BY invite_code as a
-- NON-member - a member-scope would lock joining out.
--
-- This SECURITY DEFINER RPC is the seam: it returns a campaign for an EXACT
-- code match (no enumeration - you must already know the code) and never
-- echoes the code back. It is additive and safe to ship now. Once HP rewires
-- both join flows to call it, the campaigns table SELECT can be scoped to
-- members/GM (separate change) and the leak closes with joining intact.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION public.find_campaign_by_invite_code(p_code text)
RETURNS TABLE (
  id uuid,
  name text,
  setting text,
  description text,
  cover_image_url text,
  gm_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT c.id, c.name, c.setting, c.description, c.cover_image_url, c.gm_user_id
  FROM public.campaigns c
  WHERE upper(c.invite_code) = upper(trim(p_code))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_campaign_by_invite_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_campaign_by_invite_code(text) TO authenticated;
