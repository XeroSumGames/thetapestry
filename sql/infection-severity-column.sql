-- Add infection_severity column to distinguish:
--   'check' = Failure on the infection check (Day-0 PHY check required)
--   'auto'  = Dire Failure on the infection check (Day-0 Lasting Damage auto-applies)
--   null    = no infection / no risk
--
-- Without this column we can't tell a Failure (1d3 days, lasting-risk gate)
-- from a Dire Failure (1d6 days, auto-Lasting-Damage). Both currently set
-- infection_lasting_risk=true, which loses the distinction.
--
-- Backfill: any existing row with infection_lasting_risk=true is conservatively
-- set to 'check' since we can't recover whether the original was Failure or
-- Dire. This means a few rows currently slated for Auto Lasting Damage will
-- instead require a PHY check at Day 0; the alternative (assume 'auto') would
-- punish characters whose original roll was just a Failure. Conservative >
-- punitive on a backfill.

ALTER TABLE character_states ADD COLUMN IF NOT EXISTS infection_severity text;
ALTER TABLE campaign_npcs ADD COLUMN IF NOT EXISTS infection_severity text;

UPDATE character_states
SET infection_severity = 'check'
WHERE infection_lasting_risk = true AND infection_severity IS NULL;

UPDATE campaign_npcs
SET infection_severity = 'check'
WHERE infection_lasting_risk = true AND infection_severity IS NULL;
