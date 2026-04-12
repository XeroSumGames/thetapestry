-- NPC mortal wound / stabilization support
-- Mirrors the PC death_countdown / incap_rounds mechanic from character_states
ALTER TABLE campaign_npcs ADD COLUMN IF NOT EXISTS death_countdown integer;
ALTER TABLE campaign_npcs ADD COLUMN IF NOT EXISTS incap_rounds integer;
