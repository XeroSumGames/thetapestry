-- Recent moderation_pin notifications
SELECT id, user_id, type, title, body, created_at FROM notifications
WHERE type = 'moderation_pin' ORDER BY created_at DESC LIMIT 5;

-- Recent rumor pins
SELECT id, user_id, title, pin_type, status, created_at FROM map_pins
WHERE pin_type = 'rumor' ORDER BY created_at DESC LIMIT 5;
