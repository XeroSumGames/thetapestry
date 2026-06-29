-- Two HIGH/BLOCKER security fixes found in the 2026-06-23 "what else" pass
-- (the first audit checked read policies only and missed these).
--
-- 1. BLOCKER - privilege escalation to Thriver. profiles UPDATE policy is
--    auth.uid()=id, authenticated holds UPDATE grant on profiles.role, and the
--    normalize trigger only lowercased the value. So any logged-in user could
--    PATCH their own role to 'thriver' and gain is_thriver() god-mode. Fix:
--    extend the normalize trigger to block an authenticated non-Thriver from
--    setting role='thriver'. auth.uid() IS NULL (service_role / dashboard /
--    definer admin) is allowed, so legit Thriver-granting still works. Silent
--    revert (not RAISE) so a combined profile update (username + ...) still
--    succeeds with only the role change neutralized.
--
-- 2. HIGH - chat_messages SELECT was USING(true) (policy misleadingly named
--    "Campaign members can read chat") => all table chat AND all private
--    whispers world-readable across every campaign. Fix: scope to campaign
--    member/GM, and respect whisper privacy (is_whisper rows visible only to
--    sender, recipient, or the GM).
--
-- NOT here (deferred, need care): `whispers` table (id/author/content only -
-- can't support private scoping, likely public-by-design - confirm purpose
-- first) and `campaigns`/invite_code (naive scope breaks the join-by-code
-- flow; needs a SECURITY DEFINER find_campaign_by_invite_code RPC + app change).
--
-- Idempotent. Reversible.

-- 1. Role-escalation guard --------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_profile_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.role := LOWER(NEW.role);
  IF TG_OP = 'UPDATE'
     AND NEW.role = 'thriver'
     AND OLD.role IS DISTINCT FROM 'thriver'
     AND auth.uid() IS NOT NULL
     AND NOT public.is_thriver()
  THEN
    NEW.role := OLD.role;  -- block self-promotion; leave other columns intact
  END IF;
  RETURN NEW;
END $$;

-- 2. chat_messages read scoping + whisper privacy ---------------------------
DROP POLICY IF EXISTS "Campaign members can read chat" ON public.chat_messages;
CREATE POLICY "Campaign members can read chat"
  ON public.chat_messages FOR SELECT
  USING (
    (
      EXISTS (SELECT 1 FROM public.campaign_members cm
              WHERE cm.campaign_id = chat_messages.campaign_id AND cm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.campaigns c
                 WHERE c.id = chat_messages.campaign_id AND c.gm_user_id = auth.uid())
    )
    AND (
      coalesce(is_whisper, false) = false
      OR user_id = auth.uid()
      OR recipient_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.campaigns c
                 WHERE c.id = chat_messages.campaign_id AND c.gm_user_id = auth.uid())
    )
  );
