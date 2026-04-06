-- Notify all campaign members when a player leaves
CREATE OR REPLACE FUNCTION notify_player_left()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_campaign_name text;
  v_gm_id uuid;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = OLD.user_id;
  SELECT name, gm_user_id INTO v_campaign_name, v_gm_id FROM campaigns WHERE id = OLD.campaign_id;

  -- Don't notify if GM is leaving (campaign is probably being deleted)
  IF OLD.user_id = v_gm_id THEN RETURN OLD; END IF;

  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT cm.user_id, 'player_left', 'Player Left',
    COALESCE(v_username, 'Someone') || ' has left ' || COALESCE(v_campaign_name, 'the campaign'),
    '/campaigns/' || OLD.campaign_id
  FROM campaign_members cm
  WHERE cm.campaign_id = OLD.campaign_id
    AND cm.user_id != OLD.user_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_player_left ON campaign_members;
CREATE TRIGGER on_player_left
  BEFORE DELETE ON campaign_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_player_left();
