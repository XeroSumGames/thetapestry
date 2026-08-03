-- Fix: "infinite recursion detected in policy for relation campaign_members"
-- on any UPDATE that sets campaign_members.character_id to a value (i.e.
-- every "assign my existing character to this campaign" action).
--
-- Root cause, introduced by sql/fix-campaign-members-rls-2026-08-01.sql: that
-- migration's WITH CHECK added an inline correlated subquery on `characters`
-- to stop a member pointing character_id at a character they don't own
-- (a real, correct security fix). But `characters`' own SELECT policy
-- ("Campaign members read each other's characters") queries back into
-- `campaign_members` via an inline subquery too - so evaluating the WITH
-- CHECK on campaign_members pulls in characters' RLS, which pulls
-- campaign_members' RLS again, within the same statement's policy
-- resolution: a genuine cross-table RLS cycle. This didn't surface until a
-- player tried to assign an ALREADY-EXISTING character (most first-time
-- joins create a brand new character instead, a different code path),
-- which is rare enough that it went unnoticed since 2026-08-01.
--
-- Fix: replace the inline `characters` subquery with a SECURITY DEFINER
-- helper (bypasses RLS internally, same pattern already proven safe by
-- is_campaign_member()/is_thriver() elsewhere in this schema), so
-- evaluating "do I own this character" no longer re-enters characters'
-- RLS and can't loop back into campaign_members'.

BEGIN;

CREATE OR REPLACE FUNCTION public.user_owns_character(p_character_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.characters
    WHERE id = p_character_id AND user_id = auth.uid()
  );
$function$;

REVOKE ALL ON FUNCTION public.user_owns_character(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owns_character(uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can update their own row" ON public.campaign_members;
CREATE POLICY "Members can update their own row" ON public.campaign_members
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      character_id IS NULL
      OR public.user_owns_character(character_id)
    )
  );

COMMIT;
