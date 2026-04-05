-- ============================================
-- Logging & Notifications — Pass 4
-- Updated triggers with email alerts via Edge Function
-- Run this in Supabase SQL Editor
-- Requires: pg_net extension enabled, Edge Function deployed
-- ============================================

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper: call the notify-thriver Edge Function
-- Replace YOUR_PROJECT_REF with your actual Supabase project ref
-- e.g. https://abcdefghij.supabase.co/functions/v1/notify-thriver
CREATE OR REPLACE FUNCTION call_notify_thriver(p_type text, p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-thriver',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', p_type,
      'title', p_title,
      'body', p_body,
      'link', p_link
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Silently fail if pg_net or Edge Function is not available
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- TRIGGER 1: New Survivor signup (updated with email)
CREATE OR REPLACE FUNCTION notify_new_survivor()
RETURNS trigger AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT p.id, 'new_survivor', 'New Survivor',
    NEW.username || ' just signed up',
    '/moderate'
  FROM profiles p
  WHERE p.role = 'Thriver' AND p.id != NEW.id;

  PERFORM call_notify_thriver(
    'new_survivor',
    'New Survivor',
    NEW.username || ' just signed up',
    '/moderate'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- TRIGGER 2: New map pin submitted (updated with email)
CREATE OR REPLACE FUNCTION notify_new_pin()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body text;
BEGIN
  IF NEW.pin_type != 'rumor' THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
  v_body := COALESCE(v_username, 'Someone') || ' submitted a pin: ' || COALESCE(NEW.title, 'Untitled');

  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT p.id, 'moderation_pin', 'New Pin in Queue', v_body, '/moderate'
  FROM profiles p
  WHERE p.role = 'Thriver';

  PERFORM call_notify_thriver('moderation_pin', 'New Pin in Queue', v_body, '/moderate');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- TRIGGER 3: New world NPC submitted (updated with email)
CREATE OR REPLACE FUNCTION notify_new_world_npc()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_body text;
BEGIN
  IF NEW.status != 'pending' THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM profiles WHERE id = NEW.created_by;
  v_body := COALESCE(v_username, 'Someone') || ' submitted an NPC: ' || COALESCE(NEW.name, 'Unnamed');

  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT p.id, 'moderation_npc', 'New NPC in Queue', v_body, '/moderate'
  FROM profiles p
  WHERE p.role = 'Thriver';

  PERFORM call_notify_thriver('moderation_npc', 'New NPC in Queue', v_body, '/moderate');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Triggers 4, 5, 6 remain unchanged (no email for session/join/approve)
