-- Phase E — Thriver notification when a published community's
-- public info is updated.
--
-- The "Update Public Info" flow in CampaignCommunity / MapView lets
-- a GM or community leader tweak description, faction_label,
-- size_band, community_status, and bumps last_public_update_at.
-- Thrivers should get a heads-up so they can re-scan the listing
-- for anything that violates moderation standards (name changes,
-- faction re-labels, description edits, etc.).
--
-- Scope:
--   - Fires AFTER UPDATE on world_communities
--   - Only when one of the human-readable public fields actually
--     changed (name, description, faction_label, size_band,
--     community_status, last_public_update_at)
--   - Skips if moderation_status changed in the same UPDATE —
--     that path is already covered by
--     notify_world_community_moderation (approve/reject) and we
--     don't want to double-notify on a single transition.
--   - Also skips if the only field that changed is the
--     subscriber_count / approved_by / approved_at plumbing.
--
-- Idempotent — drops + recreates function and trigger.

-- Defensive column assertion (same pattern as moderation-notify).
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.notify_world_community_public_update()
RETURNS trigger AS $$
DECLARE
  v_editor_username text;
  v_field_changes text[] := ARRAY[]::text[];
BEGIN
  -- Don't fire on moderation transitions — the moderation notifier
  -- handles those. A moderation flip also usually lands at the same
  -- instant as approved_by/approved_at; suppress those too.
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    RETURN NEW;
  END IF;

  -- Collect which fields changed so the notification body can
  -- summarize. Only count the public-facing ones.
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_field_changes := v_field_changes || 'name';
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_field_changes := v_field_changes || 'description';
  END IF;
  IF NEW.faction_label IS DISTINCT FROM OLD.faction_label THEN
    v_field_changes := v_field_changes || 'faction';
  END IF;
  IF NEW.size_band IS DISTINCT FROM OLD.size_band THEN
    v_field_changes := v_field_changes || 'size';
  END IF;
  IF NEW.community_status IS DISTINCT FROM OLD.community_status THEN
    v_field_changes := v_field_changes || 'status';
  END IF;
  IF NEW.homestead_lat IS DISTINCT FROM OLD.homestead_lat
     OR NEW.homestead_lng IS DISTINCT FROM OLD.homestead_lng THEN
    v_field_changes := v_field_changes || 'homestead';
  END IF;

  -- No visible change? Skip. (Covers bookkeeping-only UPDATEs like
  -- last_public_update_at without other changes, or pure
  -- approved_by / approved_at touches.)
  IF cardinality(v_field_changes) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_editor_username
    FROM public.profiles WHERE id = NEW.published_by;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT p.id,
    'world_community_updated',
    '✎ Community updated',
    COALESCE(v_editor_username, 'Someone') || ' updated public info on "'
      || NEW.name || '" ('
      || array_to_string(v_field_changes, ', ') || ').',
    '/moderate',
    jsonb_build_object(
      'world_community_id', NEW.id,
      'name', NEW.name,
      'changed_fields', v_field_changes,
      'editor_username', v_editor_username,
      'moderation_status', NEW.moderation_status
    )
  FROM public.profiles p
  WHERE lower(p.role) = 'thriver';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_world_community_public_update_notify
  ON public.world_communities;
CREATE TRIGGER trg_world_community_public_update_notify
  AFTER UPDATE ON public.world_communities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_world_community_public_update();
