-- Add floorplan to Minnie vehicle data
-- Run after seed-minnie-vehicle.sql
-- 2026-04-23: switched from .jpg to the hand-drawn .png floorplan.
-- Idempotent — running it again on a campaign that already has the new
-- path is a no-op; running it on a legacy .jpg row swaps it.

UPDATE campaigns
SET vehicles = jsonb_set(
  vehicles,
  '{0,floorplan_url}',
  '"/minnie-floorplan.png"'::jsonb
)
WHERE setting = 'mongrels' AND vehicles IS NOT NULL AND jsonb_array_length(vehicles) > 0;
