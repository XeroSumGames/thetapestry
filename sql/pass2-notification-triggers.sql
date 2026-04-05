-- ============================================
-- Logging & Notifications — Pass 2
-- Automated notification triggers
-- Run this in Supabase SQL Editor
-- ============================================

-- TRIGGER 1: New Survivor signup
-- Notifies all Thrivers when a new user signs up
CREATE OR REPLACE FUNCTION notify_new_survivor()
RETURNS trigger AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT p.id, 'new_survivor', 'New Survivor',
    NEW.username || ' just signed up',
    '/moderate'
  FROM profiles p
  WHERE p.role = 'Thriver' AND p.id != NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_survivor ON profiles;
CREATE TRIGGER on_new_survivor
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_survivor();


-- TRIGGER 2: New map pin submitted
-- Notifies all Thrivers when a rumor pin is submitted
CREATE OR REPLACE FUNCTION notify_new_pin()
RETURNS trigger AS $$
DECLARE
  v_username text;
BEGIN
  IF NEW.pin_type != 'rumor' THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;

  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT p.id, 'moderation_pin', 'New Pin in Queue',
    COALESCE(v_username, 'Someone') || ' submitted a pin: ' || COALESCE(NEW.title, 'Untitled'),
    '/moderate'
  FROM profiles p
  WHERE p.role = 'Thriver';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_pin ON map_pins;
CREATE TRIGGER on_new_pin
  AFTER INSERT ON map_pins
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_pin();


-- TRIGGER 3: New world NPC submitted
-- Notifies all Thrivers when an NPC is submitted for review
CREATE OR REPLACE FUNCTION notify_new_world_npc()
RETURNS trigger AS $$
DECLARE
  v_username text;
BEGIN
  IF NEW.status != 'pending' THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM profiles WHERE id = NEW.created_by;

  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT p.id, 'moderation_npc', 'New NPC in Queue',
    COALESCE(v_username, 'Someone') || ' submitted an NPC: ' || COALESCE(NEW.name, 'Unnamed'),
    '/moderate'
  FROM profiles p
  WHERE p.role = 'Thriver';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_world_npc ON world_npcs;
CREATE TRIGGER on_new_world_npc
  AFTER INSERT ON world_npcs
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_world_npc();


-- TRIGGER 4: Session opened
-- Notifies all campaign members when GM starts a session
CREATE OR REPLACE FUNCTION notify_session_opened()
RETURNS trigger AS $$
BEGIN
  IF OLD.session_status = 'idle' AND NEW.session_status = 'active' THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT cm.user_id, 'session_opened', 'Session Started',
      'Your GM has opened Session ' || NEW.session_count || ' in ' || NEW.name,
      '/campaigns/' || NEW.id || '/table'
    FROM campaign_members cm
    WHERE cm.campaign_id = NEW.id
      AND cm.user_id != NEW.gm_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_session_opened ON campaigns;
CREATE TRIGGER on_session_opened
  AFTER UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION notify_session_opened();


-- TRIGGER 5: Player joined campaign
-- Notifies the GM when a player joins their campaign
CREATE OR REPLACE FUNCTION notify_player_joined()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_campaign_name text;
  v_gm_id uuid;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
  SELECT name, gm_user_id INTO v_campaign_name, v_gm_id FROM campaigns WHERE id = NEW.campaign_id;

  -- Don't notify GM about their own join
  IF NEW.user_id = v_gm_id THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    v_gm_id,
    'player_joined',
    'New Player',
    COALESCE(v_username, 'Someone') || ' joined ' || COALESCE(v_campaign_name, 'your campaign'),
    '/campaigns/' || NEW.campaign_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_player_joined ON campaign_members;
CREATE TRIGGER on_player_joined
  AFTER INSERT ON campaign_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_player_joined();


-- TRIGGER 6: Pin approved
-- Notifies the pin creator when their rumor is approved
CREATE OR REPLACE FUNCTION notify_pin_approved()
RETURNS trigger AS $$
BEGIN
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'rumor_approved',
      'Rumor Approved',
      'Your pin "' || COALESCE(NEW.title, 'Untitled') || '" has been approved and is now visible on the world map',
      '/map'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pin_approved ON map_pins;
CREATE TRIGGER on_pin_approved
  AFTER UPDATE ON map_pins
  FOR EACH ROW
  EXECUTE FUNCTION notify_pin_approved();
