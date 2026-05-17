-- Player joins campaign (INSERT) — no character yet, say "joined"
CREATE OR REPLACE FUNCTION notify_player_joined()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_campaign_name text;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO v_campaign_name FROM campaigns WHERE id = NEW.campaign_id;

  -- Don't notify if GM auto-joining
  IF EXISTS (SELECT 1 FROM campaigns WHERE id = NEW.campaign_id AND gm_user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT cm.user_id, 'player_joined', 'New Player',
    COALESCE(v_username, 'Someone') || ' joined ' || COALESCE(v_campaign_name, 'a campaign'),
    '/campaigns/' || NEW.campaign_id
  FROM campaign_members cm
  WHERE cm.campaign_id = NEW.campaign_id
    AND cm.user_id != NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Player assigns or changes character (UPDATE) — say "joined as" or "is now playing as"
CREATE OR REPLACE FUNCTION notify_character_changed()
RETURNS trigger AS $$
DECLARE
  v_username text;
  v_campaign_name text;
  v_char_name text;
BEGIN
  IF OLD.character_id IS NOT DISTINCT FROM NEW.character_id THEN RETURN NEW; END IF;
  IF NEW.character_id IS NULL THEN RETURN NEW; END IF;

  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO v_campaign_name FROM campaigns WHERE id = NEW.campaign_id;
  SELECT name INTO v_char_name FROM characters WHERE id = NEW.character_id;

  -- First character assignment = "joined as", subsequent = "is now playing as"
  IF OLD.character_id IS NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT cm.user_id, 'player_joined', 'New Player',
      COALESCE(v_username, 'Someone') || ' joined ' || COALESCE(v_campaign_name, 'a campaign') || ' as ' || COALESCE(v_char_name, 'a character'),
      '/campaigns/' || NEW.campaign_id
    FROM campaign_members cm
    WHERE cm.campaign_id = NEW.campaign_id
      AND cm.user_id != NEW.user_id;
  ELSE
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT cm.user_id, 'player_joined', 'Character Change',
      COALESCE(v_username, 'Someone') || ' is now playing as ' || COALESCE(v_char_name, 'a new character') || ' in ' || COALESCE(v_campaign_name, 'a campaign'),
      '/campaigns/' || NEW.campaign_id
    FROM campaign_members cm
    WHERE cm.campaign_id = NEW.campaign_id
      AND cm.user_id != NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Triggers ────────────────────────────────────────────────────
-- on_player_joined is defined in sql/pass2-notification-triggers.sql
-- and continues to use the v3 function body via CREATE OR REPLACE above.
--
-- on_character_changed was created manually in the dashboard when the v3
-- function was added; the CREATE TRIGGER was missing from this file
-- until the 2026-05-17 schema-drift report surfaced it. Restoring the
-- canonical CREATE TRIGGER here so the file is self-contained.
DROP TRIGGER IF EXISTS on_character_changed ON public.campaign_members;
CREATE TRIGGER on_character_changed
  AFTER UPDATE ON public.campaign_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_character_changed();
