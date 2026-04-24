-- Fix: notify_world_community_public_update() was broken.
--
-- The collector used `text[] || 'text_literal'` to append scalar strings
-- to v_field_changes. Postgres resolves `||` on an array with an untyped
-- string literal ambiguously — it picks the array-to-array form and
-- tries to parse the literal as an array, which fails with:
--   ERROR: 22P02: malformed array literal: "size"
--
-- The trigger only fires on an UPDATE that changes one of the tracked
-- public fields, which is why it stayed latent: nothing had been
-- updating size_band in-place until the retaxonomy migration.
--
-- Replace `|| 'literal'` with `array_append(v_field_changes, 'literal')`
-- so the append is unambiguously scalar-to-array. Behavior is otherwise
-- identical.
--
-- Idempotent. Safe to re-run.
-- ============================================================

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
    '/map',
    jsonb_build_object(
      'world_community_id', NEW.id,
      'source_community_id', NEW.source_community_id,
      'fields_changed', v_field_changes
    )
  FROM public.profiles p
  WHERE p.role = 'thriver'
    AND p.id IS DISTINCT FROM NEW.published_by;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
