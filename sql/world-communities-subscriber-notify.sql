-- Phase E #B — notify subscribers when a followed community is updated.
--
-- Companion to sql/world-communities-update-notify.sql (which notifies
-- Thrivers for moderation review). This trigger fans out a separate
-- notification to every user who has a community_subscriptions row
-- pointing at the updated community, so following = actually finding
-- out when something changes.
--
-- Same skip-rules as the Thriver notify:
--   * Skip moderation transitions (covered by the moderation notifier)
--   * Skip if only bookkeeping fields changed (subscriber_count,
--     approved_by, approved_at, last_public_update_at alone)
--   * Don't notify the editor about their own change
--
-- Notification routes to /communities so subscribers land on the
-- Following list with the updated card visible. The Thriver notifier
-- routes to /moderate which is a different surface.
--
-- Idempotent — drops + recreates function and trigger.

CREATE OR REPLACE FUNCTION public.notify_world_community_subscribers_update()
RETURNS trigger AS $$
DECLARE
  v_editor_username text;
  v_field_changes text[] := ARRAY[]::text[];
BEGIN
  -- Skip moderation flips (handled elsewhere) and any pure-bookkeeping
  -- UPDATE.
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    RETURN NEW;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_field_changes := array_append(v_field_changes, 'name');
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_field_changes := array_append(v_field_changes, 'description');
  END IF;
  IF NEW.faction_label IS DISTINCT FROM OLD.faction_label THEN
    v_field_changes := array_append(v_field_changes, 'faction');
  END IF;
  IF NEW.size_band IS DISTINCT FROM OLD.size_band THEN
    v_field_changes := array_append(v_field_changes, 'size');
  END IF;
  IF NEW.community_status IS DISTINCT FROM OLD.community_status THEN
    v_field_changes := array_append(v_field_changes, 'status');
  END IF;
  IF NEW.homestead_lat IS DISTINCT FROM OLD.homestead_lat
     OR NEW.homestead_lng IS DISTINCT FROM OLD.homestead_lng THEN
    v_field_changes := array_append(v_field_changes, 'homestead');
  END IF;

  IF cardinality(v_field_changes) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_editor_username
    FROM public.profiles WHERE id = NEW.published_by;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT s.user_id,
    'world_community_followed_updated',
    '★ ' || NEW.name || ' updated',
    COALESCE(v_editor_username, 'A leader') || ' updated public info on "'
      || NEW.name || '" ('
      || array_to_string(v_field_changes, ', ') || ').',
    '/communities',
    jsonb_build_object(
      'world_community_id', NEW.id,
      'name', NEW.name,
      'changed_fields', v_field_changes,
      'editor_username', v_editor_username,
      'community_status', NEW.community_status
    )
  FROM public.community_subscriptions s
  WHERE s.world_community_id = NEW.id
    -- Don't notify the editor themselves about their own change.
    AND s.user_id IS DISTINCT FROM NEW.published_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_world_community_subscribers_update_notify
  ON public.world_communities;
CREATE TRIGGER trg_world_community_subscribers_update_notify
  AFTER UPDATE ON public.world_communities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_world_community_subscribers_update();
