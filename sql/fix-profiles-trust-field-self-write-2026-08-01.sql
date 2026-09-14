-- Fix: "Users can update own profile" (USING (auth.uid() = id), no WITH
-- CHECK) places zero column restriction on a self-update beyond row
-- ownership. The 2026-06-23 fix (sql/sec-role-escalation-and-chat-rls-
-- 2026-06-23.sql) added trigger protection for exactly one column
-- (role -> 'thriver'), but the same class of gap was never closed for:
--
--   suspended / suspended_until / suspended_reason - any suspended user
--   can clear their own suspension (`suspended_until: null`) via a
--   direct client update. is_user_suspended() reads these columns live,
--   so this also silently defeats tonight's own earlier fix
--   (fix-duplicate-insert-policies-suspension-ratelimit-2026-08-01.sql),
--   which re-gated forum/LFG/war-story/whisper INSERTs on
--   is_user_suspended().
--
--   tableau_role - profiles is the shared identity row across
--   TheTapestry and TheTableau (sql/profiles-tableau-role-2026-05-30.sql).
--   'director' is that platform's super-role. Any Tapestry user can set
--   their own tableau_role='director' and gain director/godmode on the
--   sister platform - the exact 'role' self-escalation bug, just on a
--   column added a few weeks after that fix and never brought under it.
--
-- Fix: a second BEFORE UPDATE trigger, same shape as
-- normalize_profile_role() but covering these four columns instead of
-- role - non-Thrivers can never move them away from OLD via a
-- self-update; Thrivers (moderation staff) are unaffected.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_profile_trust_fields_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF public.is_thriver() THEN
    RETURN NEW;
  END IF;

  NEW.suspended := OLD.suspended;
  NEW.suspended_until := OLD.suspended_until;
  NEW.suspended_reason := OLD.suspended_reason;
  NEW.tableau_role := OLD.tableau_role;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_profile_trust_fields ON public.profiles;
CREATE TRIGGER trg_enforce_profile_trust_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_trust_fields_on_update();

COMMIT;
