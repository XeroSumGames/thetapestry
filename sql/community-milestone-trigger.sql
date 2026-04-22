-- ============================================================
-- communities: notify leader when group becomes a Community (13+)
-- ============================================================
--
-- Per XSE SRD §08, a settlement with ≤12 members is a Group; 13+ is
-- a Community. When a new active member pushes the head-count across
-- that line, the leader (community.leader_user_id) gets a one-time
-- notification celebrating the transition.
--
-- Mechanism:
--   1. Adds communities.notified_community_milestone (bool) — flips
--      true once the notification has fired, so churn below/above 13
--      doesn't re-trigger it.
--   2. Adds a trigger on community_members (INSERT + UPDATE of status
--      or left_at) that, when active-member count reaches ≥13 AND the
--      flag is still false, inserts one notification and sets the flag.
--
-- Idempotent. Safe to re-run.
-- ============================================================

-- ── 1. Add the flag column ────────────────────────────────────
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS notified_community_milestone boolean NOT NULL DEFAULT false;

-- Back-fill: any existing community already past 13 active members
-- shouldn't generate a stale notification, so mark them done.
UPDATE public.communities c
SET notified_community_milestone = true
WHERE notified_community_milestone = false
  AND (
    SELECT count(*) FROM public.community_members m
    WHERE m.community_id = c.id
      AND m.left_at IS NULL
      AND (
        NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'community_members'
            AND column_name = 'status'
        )
        OR COALESCE(m.status, 'active') = 'active'
      )
  ) >= 13;

-- ── 2. Trigger function ───────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_community_milestone()
RETURNS trigger AS $$
DECLARE
  v_community_id uuid;
  v_count int;
  v_already_notified boolean;
  v_leader_user_id uuid;
  v_community_name text;
  v_has_status boolean;
BEGIN
  -- Which community are we evaluating? For DELETEs this would be OLD,
  -- but we don't trigger on DELETE (a community shrinking back below
  -- 13 stays a community in-fiction; no un-notify).
  v_community_id := NEW.community_id;

  -- Pull the community row + flag. Bail early if already notified
  -- so we don't do the expensive count.
  SELECT leader_user_id, name, notified_community_milestone
    INTO v_leader_user_id, v_community_name, v_already_notified
  FROM public.communities
  WHERE id = v_community_id;

  IF v_already_notified IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Detect whether community_members.status exists (migration may or
  -- may not have landed); count active members accordingly.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'status'
  ) INTO v_has_status;

  IF v_has_status THEN
    SELECT count(*) INTO v_count
    FROM public.community_members
    WHERE community_id = v_community_id
      AND left_at IS NULL
      AND COALESCE(status, 'active') = 'active';
  ELSE
    SELECT count(*) INTO v_count
    FROM public.community_members
    WHERE community_id = v_community_id
      AND left_at IS NULL;
  END IF;

  IF v_count >= 13 AND v_leader_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_leader_user_id,
      'community_milestone',
      'Your group is now a Community',
      COALESCE(v_community_name, 'Your group') || ' has grown to ' || v_count || ' members — it''s officially a Community now.',
      '/communities'
    );

    UPDATE public.communities
    SET notified_community_milestone = true
    WHERE id = v_community_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Attach trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_community_milestone ON public.community_members;
CREATE TRIGGER trg_community_milestone
  AFTER INSERT OR UPDATE OF status, left_at
  ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_community_milestone();

-- ── Diagnostic ──
-- SELECT c.name, c.notified_community_milestone,
--   (SELECT count(*) FROM community_members m
--      WHERE m.community_id = c.id AND m.left_at IS NULL
--        AND COALESCE(m.status, 'active') = 'active') as active_count
-- FROM communities c;
