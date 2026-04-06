-- Notify pin creator when their rumor is rejected
CREATE OR REPLACE FUNCTION notify_pin_rejected()
RETURNS trigger AS $$
BEGIN
  IF OLD.status != 'rejected' AND NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'rumor_rejected',
      'Rumor Rejected',
      'Your pin "' || COALESCE(NEW.title, 'Untitled') || '" has been reviewed and was not approved',
      '/map'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_pin_rejected ON map_pins;
CREATE TRIGGER on_pin_rejected
  AFTER UPDATE ON map_pins
  FOR EACH ROW
  EXECUTE FUNCTION notify_pin_rejected();
