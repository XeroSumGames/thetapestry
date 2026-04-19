-- Add floorplan to Minnie vehicle data
-- Run after seed-minnie-vehicle.sql

UPDATE campaigns
SET vehicles = jsonb_set(
  vehicles,
  '{0,floorplan_url}',
  '"/minnie-floorplan.jpg"'::jsonb
)
WHERE setting = 'mongrels' AND vehicles IS NOT NULL AND jsonb_array_length(vehicles) > 0;
