-- Adds optional address column to map_pins so the Edit Pin modal can store
-- a human-readable street address alongside lat/lng. Safe to re-run.

ALTER TABLE map_pins
  ADD COLUMN IF NOT EXISTS address text;
