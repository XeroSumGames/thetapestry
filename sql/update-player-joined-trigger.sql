-- Update player_joined trigger to include character name
CREATE OR REPLACE FUNCTION notify_player_joined()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_campaign_name text;
  v_gm_id uuid;
  v_char_name text;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
  SELECT name, gm_user_id INTO v_campaign_name, v_gm_id FROM campaigns WHERE id = NEW.campaign_id;

  -- Don't notify GM about their own join
  IF NEW.user_id = v_gm_id THEN RETURN NEW; END IF;

  -- Get character name if assigned
  IF NEW.character_id IS NOT NULL THEN
    SELECT name INTO v_char_name FROM characters WHERE id = NEW.character_id;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    v_gm_id,
    'player_joined',
    'New Player',
    COALESCE(v_username, 'Someone') || ' joined ' || COALESCE(v_campaign_name, 'your campaign') ||
      CASE WHEN v_char_name IS NOT NULL THEN ' with ' || v_char_name ELSE '' END,
    '/campaigns/' || NEW.campaign_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
