-- Fix: "Campaign members read each other's characters" SELECT policy on
-- public.characters joined campaign_members to campaign_members on
-- campaign_id, then matched theirs.user_id = characters.user_id - i.e. it
-- only checked that the OWNER shares a campaign with the viewer, never
-- that the specific character row being read is the one actually seated
-- in that shared campaign (campaign_members.character_id).
--
-- Being in one campaign with someone therefore granted SELECT on EVERY
-- character that person owns platform-wide - including drafts and
-- characters used only in unrelated (possibly private) campaigns the
-- viewer has no membership in. Contrast "GM reads member characters in
-- their campaigns", which correctly joins cm.character_id = characters.id
-- - only this peer-read policy was missing that scoping.
--
-- Fix: join on theirs.character_id = characters.id instead of
-- theirs.user_id = characters.user_id, matching the GM policy's pattern.

BEGIN;

DROP POLICY IF EXISTS "Campaign members read each other's characters" ON public.characters;
CREATE POLICY "Campaign members read each other's characters" ON public.characters
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM campaign_members me
      JOIN campaign_members theirs ON theirs.campaign_id = me.campaign_id
      WHERE me.user_id = auth.uid()
        AND theirs.character_id = characters.id
    )
  );

COMMIT;
