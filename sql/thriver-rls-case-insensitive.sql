-- Bug-fix: a handful of older RLS policies + notification triggers
-- check `profiles.role = 'Thriver'` (capital T) while every newer
-- policy + the JS client uses `lower(p.role) = 'thriver'`. If a
-- Thriver's profile row stores the role as 'thriver' (lowercase, the
-- canonical form the rest of the codebase produces), the older
-- policies + triggers quietly reject them — symptoms include the
-- /logging visitor-logs page rendering "0 logs" while rows exist in
-- the table, and the new-survivor / new-pin / new-NPC notifications
-- never fanning out to the Thriver inbox.
--
-- This migration normalizes every remaining capital-T spot to the
-- case-insensitive `lower(...) = 'thriver'` convention. Idempotent —
-- DROPs each policy / re-CREATEs each function before re-defining.
--
-- Triggered 2026-04-30 after Xero noticed three real visitors
-- (Auckland / Monroe / Pittsburgh) had no rows visible on /logging.

-- ── visitor_logs SELECT (the symptom you'd notice first) ──────────
DROP POLICY IF EXISTS "Thrivers can read visitor logs" ON public.visitor_logs;
CREATE POLICY "Thrivers can read visitor logs"
  ON public.visitor_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND lower(role) = 'thriver'
    )
  );

-- ── debug_log SELECT + DELETE (Thriver-only triage table) ─────────
DROP POLICY IF EXISTS "debug_log_select_thriver" ON public.debug_log;
CREATE POLICY "debug_log_select_thriver"
  ON public.debug_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND lower(profiles.role) = 'thriver'
    )
  );

DROP POLICY IF EXISTS "debug_log_delete_thriver" ON public.debug_log;
CREATE POLICY "debug_log_delete_thriver"
  ON public.debug_log FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND lower(profiles.role) = 'thriver'
    )
  );

-- ── notification trigger functions ────────────────────────────────
-- These fan-out triggers fire a notification row to every Thriver on
-- key events. The capital-T check meant Thrivers with lowercase role
-- never received the in-app pings.

-- TRIGGER 1: New Survivor signup
CREATE OR REPLACE FUNCTION public.notify_new_survivor()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id, 'new_survivor', 'New Survivor',
    NEW.username || ' just signed up',
    '/moderate'
  FROM public.profiles p
  WHERE lower(p.role) = 'thriver' AND p.id != NEW.id;

  PERFORM public.call_notify_thriver(
    'new_survivor',
    'New Survivor',
    NEW.username || ' just signed up',
    '/moderate'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 2: New rumor pin submitted
CREATE OR REPLACE FUNCTION public.notify_new_pin()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body text;
BEGIN
  IF NEW.pin_type != 'rumor' THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.user_id;
  v_body := COALESCE(v_username, 'Someone') || ' submitted a pin: ' || COALESCE(NEW.title, 'Untitled');

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id, 'moderation_pin', 'New Pin in Queue', v_body, '/moderate'
  FROM public.profiles p
  WHERE lower(p.role) = 'thriver';

  PERFORM public.call_notify_thriver('moderation_pin', 'New Pin in Queue', v_body, '/moderate');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 3: New world NPC submitted
CREATE OR REPLACE FUNCTION public.notify_new_world_npc()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body text;
BEGIN
  IF NEW.status != 'pending' THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.created_by;
  v_body := COALESCE(v_username, 'Someone') || ' submitted an NPC: ' || COALESCE(NEW.name, 'Unnamed');

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id, 'moderation_npc', 'New NPC in Queue', v_body, '/moderate'
  FROM public.profiles p
  WHERE lower(p.role) = 'thriver';

  PERFORM public.call_notify_thriver('moderation_npc', 'New NPC in Queue', v_body, '/moderate');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
