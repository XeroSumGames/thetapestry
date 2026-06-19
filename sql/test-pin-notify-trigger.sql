-- Test the notify_new_pin trigger directly.
-- Inserts a fake rumor pin, checks notifications, then cleans up.
BEGIN;

INSERT INTO map_pins (user_id, title, lat, lng, pin_type, status, category)
SELECT id, '__test_pin__', 0, 0, 'rumor', 'pending', 'location'
FROM profiles WHERE role = 'thriver' LIMIT 1;

SELECT count(*) AS notification_rows_created
FROM notifications WHERE type = 'moderation_pin' AND body LIKE '%__test_pin__%';

ROLLBACK;
