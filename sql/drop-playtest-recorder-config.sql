-- Drop the now-orphan playtest_recorder_config table. Zero readers /
-- zero writers from app code after:
--   e53211b - record() gated tab-local, no global config read
--   20aee55 - /record admin UI deleted
-- Safe to drop with no data loss concerns (the table held a single
-- singleton id=1 row used only by the deleted admin page).
DROP TABLE IF EXISTS playtest_recorder_config;
