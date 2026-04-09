-- Add sort_order column to map_pins for chronological timeline ordering
-- Run this in the Supabase SQL Editor

ALTER TABLE map_pins ADD COLUMN IF NOT EXISTS sort_order INT;

-- Set chronological order for world_event pins (by in-world date)
UPDATE map_pins SET sort_order = 1  WHERE title = 'First Reports — Eastern Europe';
UPDATE map_pins SET sort_order = 2  WHERE title = 'Chechnya — First State of Emergency';
UPDATE map_pins SET sort_order = 3  WHERE title = 'WHO Headquarters — Geneva';
UPDATE map_pins SET sort_order = 4  WHERE title = 'Russia Coup — Chain Reaction';
UPDATE map_pins SET sort_order = 5  WHERE title = 'First Recorded Death — Chile';
UPDATE map_pins SET sort_order = 6  WHERE title = 'Berglund''s Coalition — Stockholm';
UPDATE map_pins SET sort_order = 7  WHERE title = 'German Research Institute — Testing Breakthrough';
UPDATE map_pins SET sort_order = 8  WHERE title = 'South Korea — Mandatory National Testing';
UPDATE map_pins SET sort_order = 9  WHERE title = 'China — Central Corpse Disposal';
UPDATE map_pins SET sort_order = 10 WHERE title = 'US Quarantine Zones';
UPDATE map_pins SET sort_order = 11 WHERE title = 'UK Vaccine Trials';
UPDATE map_pins SET sort_order = 12 WHERE title = 'Finland — Nuclear Event';
UPDATE map_pins SET sort_order = 13 WHERE title = 'Scandinavia — Goes Dark';
UPDATE map_pins SET sort_order = 14 WHERE title = 'US Government Dissolves';
UPDATE map_pins SET sort_order = 15 WHERE title = 'Berglund''s Research Facility — Belgium';

-- Settlements get high sort_order (after all timeline events)
UPDATE map_pins SET sort_order = 100 WHERE title = 'District Zero — Broken Arrow, OK';
UPDATE map_pins SET sort_order = 101 WHERE title = 'King''s Crossroads Mall — Sussex County, DE';
