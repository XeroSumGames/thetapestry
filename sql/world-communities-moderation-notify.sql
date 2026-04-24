-- Phase E — publisher-side notifications for Thriver moderation on
-- world_communities. Fires on two triggers:
--
--   1. UPDATE OF moderation_status — when a Thriver approves or
--      rejects (or reverses their decision). Sends a ✓ / ✗ to the
--      original publisher.
--   2. DELETE — when a Thriver force-unpublishes the row entirely.
--      Sends a 🗑 to the publisher; the source campaign community
--      stays intact so they can re-publish.
--
-- Idempotent — drops + recreates both functions and triggers.

-- ── notify_world_community_moderation ──────────────────────────
-- Approve / reject transitions. Also fires on re-reversal
-- (approved → rejected → approved) so the publisher sees the
-- latest state. No-ops if moderation_status didn't actually change.
CREATE OR REPLACE FUNCTION public.notify_world_community_moderation()
RETURNS trigger AS $$
DECLARE
  v_recipient_user_id uuid;
  v_source_community_id uuid;
BEGIN
  IF NEW.moderation_status = OLD.moderation_status THEN
    RETURN NEW;
  END IF;
  v_recipient_user_id := NEW.published_by;
  v_source_community_id := NEW.source_community_id;
  IF v_recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    v_recipient_user_id,
    'world_community_moderation',
    CASE NEW.moderation_status
      WHEN 'approved' THEN '✓ Community approved'
      WHEN 'rejected' THEN '✗ Community rejected'
      ELSE 'Community moderation updated'
    END,
    CASE NEW.moderation_status
      WHEN 'approved' THEN
        'Your published community "' || NEW.name
        || '" is now live on the world map. Other GMs can see it, propose links, and route their PCs into an encounter with it.'
      WHEN 'rejected' THEN
        'Your published community "' || NEW.name
        || '" was rejected by a Thriver. The source campaign community is untouched; you can edit the public metadata and re-submit for moderation via Community ▾.'
      ELSE
        'Your published community "' || NEW.name
        || '" moderation state is now: ' || NEW.moderation_status
    END,
    '/communities/' || v_source_community_id::text,
    jsonb_build_object(
      'world_community_id', NEW.id,
      'source_community_id', v_source_community_id,
      'name', NEW.name,
      'moderation_status', NEW.moderation_status,
      'previous_moderation_status', OLD.moderation_status
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_world_community_moderation_notify
  ON public.world_communities;
CREATE TRIGGER trg_world_community_moderation_notify
  AFTER UPDATE OF moderation_status ON public.world_communities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_world_community_moderation();

-- ── notify_world_community_deletion ────────────────────────────
-- Thriver force-unpublish. The source community's back-link
-- (world_visibility + world_community_id + published_at on
-- public.communities) is NOT reset by DELETE since there's no FK
-- cascade in that direction — callers who want the source community
-- to reflect "not published" after a moderation-initiated delete
-- should clear those columns manually. Notification fires regardless.
CREATE OR REPLACE FUNCTION public.notify_world_community_deletion()
RETURNS trigger AS $$
BEGIN
  IF OLD.published_by IS NULL THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    OLD.published_by,
    'world_community_deleted',
    '🗑 Community unpublished',
    'A Thriver removed your published community "' || OLD.name
    || '" from the Distemperverse. The source campaign community is untouched — '
    || 'you can re-publish from the Community ▾ → Status panel if you want it back on the world map.',
    '/communities/' || OLD.source_community_id::text,
    jsonb_build_object(
      'world_community_id', OLD.id,
      'source_community_id', OLD.source_community_id,
      'name', OLD.name,
      'prior_moderation_status', OLD.moderation_status
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_world_community_deletion_notify
  ON public.world_communities;
CREATE TRIGGER trg_world_community_deletion_notify
  AFTER DELETE ON public.world_communities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_world_community_deletion();
