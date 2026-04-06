-- Notify ALL campaign members when a player joins or changes character
CREATE OR REPLACE FUNCTION notify_player_joined()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_campaign_name text;
  v_char_name text;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO v_campaign_name FROM campaigns WHERE id = NEW.campaign_id;

  -- Get character name if assigned
  IF NEW.character_id IS NOT NULL THEN
    SELECT name INTO v_char_name FROM characters WHERE id = NEW.character_id;
  END IF;

  -- Notify all campaign members except the player themselves
  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT cm.user_id, 'player_joined', 'New Player',
    COALESCE(v_username, 'Someone') || ' joined ' || COALESCE(v_campaign_name, 'a campaign') ||
      CASE WHEN v_char_name IS NOT NULL THEN ' as ' || v_char_name ELSE '' END,
    '/campaigns/' || NEW.campaign_id
  FROM campaign_members cm
  WHERE cm.campaign_id = NEW.campaign_id
    AND cm.user_id != NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also notify when a player changes their character assignment
CREATE OR REPLACE FUNCTION notify_character_changed()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_campaign_name text;
  v_char_name text;
BEGIN
  -- Only fire if character_id actually changed
  IF OLD.character_id IS NOT DISTINCT FROM NEW.character_id THEN RETURN NEW; END IF;
  IF NEW.character_id IS NULL THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO v_campaign_name FROM campaigns WHERE id = NEW.campaign_id;
  SELECT name INTO v_char_name FROM characters WHERE id = NEW.character_id;

  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT cm.user_id, 'player_joined', 'Character Change',
    COALESCE(v_username, 'Someone') || ' is now playing as ' || COALESCE(v_char_name, 'a new character') || ' in ' || COALESCE(v_campaign_name, 'a campaign'),
    '/campaigns/' || NEW.campaign_id
  FROM campaign_members cm
  WHERE cm.campaign_id = NEW.campaign_id
    AND cm.user_id != NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_character_changed ON campaign_members;
CREATE TRIGGER on_character_changed
  AFTER UPDATE ON campaign_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_character_changed();
