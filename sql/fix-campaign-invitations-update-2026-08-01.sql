-- Fix: campaign_invitations UPDATE RLS (ci_update) only checked row
-- ownership (sender_user_id = auth.uid() OR recipient_user_id = auth.uid())
-- in both USING and WITH CHECK, with no restriction on which columns could
-- change. Any user could:
--   1. Create a throwaway campaign (any user can be a GM of their own).
--   2. INSERT a self-addressed campaign_invitations row (passes ci_insert_gm).
--   3. UPDATE that row, retargeting campaign_id to any target campaign
--      (private or not) and setting status='accepted'.
-- handle_campaign_invitation_response (SECURITY DEFINER, AFTER UPDATE)
-- blindly trusts NEW.campaign_id / NEW.recipient_user_id and inserts into
-- campaign_members - full membership bypass of any private campaign via a
-- second, unguarded path (the direct campaign_members INSERT path was
-- already closed today in fix-campaign-members-rls-2026-08-01.sql).
--
-- The same gap also let an attacker retarget sender_user_id to an arbitrary
-- victim UUID and toggle status repeatedly, each toggle firing an
-- unauthorized notifications INSERT addressed to the victim (the
-- notifications table itself has no direct-INSERT policy for regular
-- users - this trigger was the only reachable spam vector).
--
-- The only legitimate UPDATE path (components/NotificationBell.tsx
-- handleCampaignInvitationAction) only ever touches status/responded_at.
-- Fix: a BEFORE UPDATE trigger that rejects any change to campaign_id,
-- sender_user_id, or recipient_user_id - RLS WITH CHECK cannot express an
-- old-value-pinning constraint directly, so this is the standard pattern
-- (mirrors the narrow-RPC philosophy already used elsewhere in this schema,
-- e.g. toggle_wall_segment_door).

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_campaign_invitation_immutable_targets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id THEN
    RAISE EXCEPTION 'campaign_id, sender_user_id, and recipient_user_id cannot be changed after an invitation is created';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_campaign_invitation_immutable_targets ON public.campaign_invitations;
CREATE TRIGGER enforce_campaign_invitation_immutable_targets
  BEFORE UPDATE ON public.campaign_invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_invitation_immutable_targets();

COMMIT;
