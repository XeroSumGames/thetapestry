-- Backfill: mark all existing campaign pins as revealed.
-- Pre-fix, every creation path defaulted to revealed=false.
-- The new default is revealed=true for all GM-created and module-imported
-- pins. This one-time update brings existing campaigns into parity so
-- players can see their location pins without the GM having to click
-- "Reveal all" for every campaign.
--
-- Note: this reveals ALL pins in ALL campaigns. If a GM deliberately hid a
-- pin (e.g., a mystery location), they will need to re-hide it after this
-- runs. That tradeoff is acceptable - the old default was wrong, and hiding
-- individual pins is fast.

UPDATE campaign_pins
SET revealed = true
WHERE revealed = false;
