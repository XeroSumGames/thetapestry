-- Persistence for Day-0 Lasting Damage Check broadcasts so they survive:
--   - tabs that were closed at drain time
--   - tabs with a stale pre-deploy JS bundle (no listener registered)
--   - websocket backgrounding / Chrome throttling
--
-- Drainer sets this true on severity='check'. The pending modal opens on
-- the next page load for the owning user (PC) or for any GM-side viewer
-- (NPC). executeRoll's "Lasting Damage Check" branch clears it when the
-- roll resolves.

ALTER TABLE character_states
  ADD COLUMN IF NOT EXISTS infection_pending_lasting_check boolean NOT NULL DEFAULT false;
ALTER TABLE campaign_npcs
  ADD COLUMN IF NOT EXISTS infection_pending_lasting_check boolean NOT NULL DEFAULT false;

-- One-time recovery for Cree Hask in campaign 29ba3cc4 - her broadcast
-- evaporated against tony's stale bundle in the 4-minute window between
-- the c4bc13b deploy and the drainer firing. Manually flag the pending
-- check so tony's reloaded tab picks it up.
UPDATE character_states s
SET infection_pending_lasting_check = true
FROM characters c
WHERE s.character_id = c.id
  AND c.name = 'Cree Hask'
  AND s.campaign_id = '29ba3cc4-f7cc-45f0-8b05-cf6388d54ac2';
