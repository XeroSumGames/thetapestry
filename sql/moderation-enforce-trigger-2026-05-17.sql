-- moderation-enforce-trigger-2026-05-17.sql
-- Pre-launch audit Y3 (tasks/pre-launch-audit-2026-05-17.md).
--
-- Background. The locked design (campfire-moderation.sql) says:
--   campaign-scoped post (campaign_id NOT NULL) -> moderation_status='approved'
--   global/setting-scoped post (campaign_id NULL) -> moderation_status='pending'
-- Plus: thrivers' posts auto-approve everywhere.
--
-- Today this is enforced ONLY on the client. A user who crafts the
-- request directly can insert `moderation_status='approved'` +
-- `approved_by=<any_uuid>` and bypass review. The post then shows in
-- the public feed because the SELECT policy only checks the status
-- column, not whether the approver was actually a thriver.
--
-- Fix: a BEFORE INSERT trigger that overwrites the moderation columns
-- based on the actual inserting user's role + the row's scope, ignoring
-- whatever the client supplied. SECURITY DEFINER so it can read
-- profiles.role regardless of RLS.
--
-- UPDATE is already RLS-gated to thrivers only (ft_update_thriver /
-- ws_update_thriver / lfg_update_thriver) so the trigger only covers
-- INSERT. Existing rows are unaffected — this is an additive trigger.
--
-- Idempotent. Run via:
--   npx supabase db query --linked -f sql/moderation-enforce-trigger-2026-05-17.sql

CREATE OR REPLACE FUNCTION public.enforce_moderation_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_thriver boolean;
BEGIN
  SELECT lower(role) = 'thriver' INTO v_is_thriver
    FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_is_thriver, false) THEN
    -- Thriver inserts: respect status, but force approved_by to the
    -- real auth.uid() so a thriver cannot credit a different thriver.
    IF NEW.moderation_status = 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := COALESCE(NEW.approved_at, now());
    END IF;
    RETURN NEW;
  END IF;

  -- Non-thriver inserts: scope decides moderation outcome.
  IF NEW.campaign_id IS NOT NULL THEN
    NEW.moderation_status := 'approved';
    NEW.approved_by := NULL;  -- system-approved by campaign-scope rule
    NEW.approved_at := now();
  ELSE
    NEW.moderation_status := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ── forum_threads ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_enforce_mod_forum_threads ON public.forum_threads;
CREATE TRIGGER trg_enforce_mod_forum_threads
  BEFORE INSERT ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_on_insert();

-- ── war_stories ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_enforce_mod_war_stories ON public.war_stories;
CREATE TRIGGER trg_enforce_mod_war_stories
  BEFORE INSERT ON public.war_stories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_on_insert();

-- ── lfg_posts ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_enforce_mod_lfg_posts ON public.lfg_posts;
CREATE TRIGGER trg_enforce_mod_lfg_posts
  BEFORE INSERT ON public.lfg_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_on_insert();

NOTIFY pgrst, 'reload schema';
