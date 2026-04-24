-- Phase E — Thriver-side moderation queue notifications.
--
-- Ensures Thrivers get a bell alert whenever something new hits the
-- /moderate page, across all four queues:
--   1. Users         — existing `notify_new_survivor` trigger
--   2. Rumor Queue   — existing `notify_new_pin` trigger
--   3. NPCs          — existing `notify_new_world_npc` trigger
--   4. 🌐 Communities — NEW: `notify_new_world_community` trigger
--
-- Also fixes a case-sensitivity bug in the three existing triggers
-- from sql/pass2-notification-triggers.sql: they filtered by
-- `profiles.role = 'Thriver'` (capital T) but everywhere else in
-- Phase E we use `lower(p.role) = 'thriver'`. Users whose role was
-- stored as lowercase (e.g. via `UPDATE profiles SET role =
-- 'thriver'`) were silently excluded from queue notifications.
-- Repatch with case-insensitive comparison so all Thrivers fire
-- regardless of casing.
--
-- Idempotent — CREATE OR REPLACE + DROP TRIGGER IF EXISTS pattern.
-- Safe to re-run.

-- ── notifications.metadata guarantee ───────────────────────────
-- Same defensive pattern used by the moderation-notify file.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- ── 1. Fix case-sensitivity on new-survivor trigger ────────────
CREATE OR REPLACE FUNCTION public.notify_new_survivor()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id, 'new_survivor', 'New Survivor',
    NEW.username || ' just signed up',
    '/moderate'
  FROM public.profiles p
  WHERE lower(p.role) = 'thriver' AND p.id != NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_survivor ON public.profiles;
CREATE TRIGGER on_new_survivor
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_survivor();

-- ── 2. Fix case-sensitivity on new-pin (rumor) trigger ─────────
CREATE OR REPLACE FUNCTION public.notify_new_pin()
RETURNS trigger AS $$
DECLARE
  v_username text;
BEGIN
  IF NEW.pin_type != 'rumor' THEN RETURN NEW; END IF;
  IF NEW.status != 'pending' THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT p.id, 'moderation_pin', 'New Pin in Queue',
    COALESCE(v_username, 'Someone') || ' submitted a pin: ' || COALESCE(NEW.title, 'Untitled'),
    '/moderate',
    jsonb_build_object(
      'pin_id', NEW.id,
      'title', NEW.title,
      'submitter_username', v_username
    )
  FROM public.profiles p
  WHERE lower(p.role) = 'thriver';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_pin ON public.map_pins;
CREATE TRIGGER on_new_pin
  AFTER INSERT ON public.map_pins
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_pin();

-- ── 3. Fix case-sensitivity on new-world-NPC trigger ───────────
CREATE OR REPLACE FUNCTION public.notify_new_world_npc()
RETURNS trigger AS $$
DECLARE
  v_username text;
BEGIN
  IF NEW.status != 'pending' THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.created_by;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT p.id, 'moderation_npc', 'New NPC in Queue',
    COALESCE(v_username, 'Someone') || ' submitted an NPC: ' || COALESCE(NEW.name, 'Unnamed'),
    '/moderate',
    jsonb_build_object(
      'world_npc_id', NEW.id,
      'name', NEW.name,
      'submitter_username', v_username
    )
  FROM public.profiles p
  WHERE lower(p.role) = 'thriver';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_world_npc ON public.world_npcs;
CREATE TRIGGER on_new_world_npc
  AFTER INSERT ON public.world_npcs
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_world_npc();

-- ── 4. NEW: notify Thrivers when a community is submitted ──────
-- Fires on INSERT into world_communities with moderation_status =
-- 'pending'. Carries submitter username + community name in both
-- the body text and metadata so NotificationBell can colorize.
CREATE OR REPLACE FUNCTION public.notify_new_world_community()
RETURNS trigger AS $$
DECLARE
  v_submitter_username text;
  v_source_campaign_name text;
BEGIN
  IF NEW.moderation_status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_submitter_username
    FROM public.profiles WHERE id = NEW.published_by;
  SELECT name INTO v_source_campaign_name
    FROM public.campaigns WHERE id = NEW.source_campaign_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT p.id,
    'moderation_community',
    '🌐 New Community in Queue',
    COALESCE(v_submitter_username, 'Someone') || ' submitted "' || NEW.name
      || '" from ' || COALESCE(v_source_campaign_name, 'their campaign')
      || ' for Tapestry publication.',
    '/moderate',
    jsonb_build_object(
      'world_community_id', NEW.id,
      'name', NEW.name,
      'source_campaign_id', NEW.source_campaign_id,
      'source_campaign_name', v_source_campaign_name,
      'submitter_username', v_submitter_username,
      'size_band', NEW.size_band,
      'faction_label', NEW.faction_label
    )
  FROM public.profiles p
  WHERE lower(p.role) = 'thriver';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_world_community ON public.world_communities;
CREATE TRIGGER on_new_world_community
  AFTER INSERT ON public.world_communities
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_world_community();
