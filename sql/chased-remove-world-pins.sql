-- Remove Chased pins from world map — they should only be campaign-scoped
DELETE FROM map_pins WHERE title IN (
  'Redden State Forest Fire Station',
  'The Encounter — Forest Clearing',
  'Owen Connor''s Ambush Point',
  'Connor Boys Farmhouse',
  'Connor Boys Farm & Fields',
  '01 | Best Nite Motel',
  '02 | Belvedere''s Outdoor Supply',
  '03 | Drop By Urgent Care',
  '04 | Costco Superstore',
  '05 | Tri-State Firearms & Shooting Range',
  '06 | Swiss Tony''s Used Car Lot',
  '07 | RoadCo Gas Station',
  'Georgetown, DE'
);
