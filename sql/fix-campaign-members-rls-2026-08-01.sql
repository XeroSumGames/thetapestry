-- Fix: campaign_members had no invite-code check on INSERT (any authenticated
-- user could join any private campaign by guessing/enumerating its UUID) and
-- no ownership check on UPDATE (a member could point character_id at any
-- character, including one they don't own, to hijack token control).
--
-- Both legitimate join flows (app/join/[code]/page.tsx, app/stories/join/page.tsx)
-- already call find_campaign_by_invite_code() first; this migration folds the
-- actual membership insert into a new SECURITY DEFINER RPC that validates the
-- code server-side and performs the insert atomically, closing the gap where
-- a raw client insert could use any campaign_id regardless of code possession.
--
-- The one legitimate raw-insert case - a GM auto-joining their own
-- freshly-created campaign (app/stories/new/page.tsx:196) - is preserved by
-- restricting the raw INSERT policy to gm_user_id = auth.uid() instead of
-- removing it outright. The campaign_invitations accept trigger
-- (handle_campaign_invitation_response, already SECURITY DEFINER) is
-- unaffected either way since SECURITY DEFINER bypasses RLS.

BEGIN;

-- 1. New atomic, code-validating join RPC. Upserts so a re-join (already a
-- member) reconciles the observer flag instead of erroring, matching the
-- exact 23505-handling behavior the client used to do itself.
CREATE OR REPLACE FUNCTION public.join_campaign_by_invite_code(p_code text, p_observer boolean DEFAULT false)
 RETURNS TABLE(id uuid, name text, setting text, description text, cover_image_url text, gm_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_campaign_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.id INTO v_campaign_id
  FROM public.campaigns c
  WHERE upper(c.invite_code) = upper(trim(p_code))
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.campaign_members (campaign_id, user_id, observer)
  VALUES (v_campaign_id, v_uid, p_observer)
  ON CONFLICT (campaign_id, user_id) DO UPDATE SET observer = EXCLUDED.observer;

  RETURN QUERY
  SELECT c.id, c.name, c.setting, c.description, c.cover_image_url, c.gm_user_id
  FROM public.campaigns c
  WHERE c.id = v_campaign_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_campaign_by_invite_code(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_campaign_by_invite_code(text, boolean) TO authenticated;

-- 2. Tighten the raw-table INSERT policy: only the GM of that exact campaign
-- may insert themselves directly. Everyone else must go through the RPC
-- above (invite-code flows) or the invitation-accept trigger (bypasses RLS).
DROP POLICY IF EXISTS "Users can join campaigns" ON public.campaign_members;
CREATE POLICY "GM can self-join own campaign" ON public.campaign_members
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_members.campaign_id AND c.gm_user_id = auth.uid())
  );

-- 3. Add character-ownership check to the self-UPDATE policy so a member
-- can't point character_id at a character they don't own.
DROP POLICY IF EXISTS "Members can update their own row" ON public.campaign_members;
CREATE POLICY "Members can update their own row" ON public.campaign_members
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      character_id IS NULL
      OR EXISTS (SELECT 1 FROM public.characters ch WHERE ch.id = character_id AND ch.user_id = auth.uid())
    )
  );

COMMIT;
