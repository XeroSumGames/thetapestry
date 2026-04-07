-- ============================================================
-- Chased Seed SQL — World Map Pins
-- Run in Supabase SQL Editor
-- No new tables needed — campaign_npcs already exists
-- ============================================================

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category) VALUES
-- Part 1: The Forest
('5806fd27-fcac-4163-b8a8-61476150962c', 38.7312, -75.5098, 'Redden State Forest Fire Station', 'Player camp at the start of Chased. Edge of Redden State Forest along Route 213. Group camps here for the night on their way east to the coast.', 'gm', 'approved', 'location'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.7285, -75.5085, 'The Encounter — Forest Clearing', 'Where players first hear Maddy crashing through the forest. Clearing near a small stream. Luke Connor catches up with Maddy here. Site of the first combat.', 'gm', 'approved', 'location'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.7230, -75.5060, 'Owen Connor''s Ambush Point', 'Half a mile from the Connor farmhouse. Owen flanks the group here on their way to rescue Maddy''s children. A windmill is visible nearby.', 'gm', 'approved', 'location'),
-- Part 2: The Farmhouse
('5806fd27-fcac-4163-b8a8-61476150962c', 38.7198, -75.5042, 'Connor Boys Farmhouse', 'Multi-generation Connor family home. Soundproofed basement used as a holding area. Two entrances — front and back, both unlocked. Donnie and Junior in the kitchen. Silas in the basement. Maddy''s children Troy and Mark locked in a ground-floor bedroom next to the kitchen. Windows have bars on that room. Ray and Jackie are out searching during this section.', 'gm', 'approved', 'location'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.7185, -75.5030, 'Connor Boys Farm & Fields', 'Working farm adjacent to the farmhouse. Livestock and tended fields. Recently tended and in better shape than many local farms. Potential player base if the Connors are dealt with.', 'gm', 'approved', 'location'),
-- Part 3 & 4: The Mall
('5806fd27-fcac-4163-b8a8-61476150962c', 38.6958, -75.5142, '01 | Best Nite Motel', 'Home base for Maddy''s group. 14 residents. Group dinners at the rear fire pit — the direction the Connors attack from in Part 4. Plenty of rooms still available. Starting location for the Crossroads Chronicles campaign.', 'gm', 'approved', 'residence'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.6955, -75.5130, '02 | Belvedere''s Outdoor Supply', 'Outdoor supply store in the King''s Crossroads Mall complex. Still contains useful supplies. Largely untouched due to the mall''s out-of-the-way location and incomplete construction at time of pandemic.', 'gm', 'approved', 'business'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.6950, -75.5118, '03 | Drop By Urgent Care', 'Urgent care clinic in the mall complex. Medical supplies available. Not fully looted.', 'gm', 'approved', 'medical'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.6960, -75.5125, '04 | Costco Superstore', 'The group''s primary food source. Pallets of tinned food the residents believe will last several more weeks. Construction tools and materials also present from the incomplete mall build.', 'gm', 'approved', 'resource'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.6956, -75.5138, '05 | Tri-State Firearms & Shooting Range', 'Firearms store and shooting range. Significant find for a group needing weapons and ammunition.', 'gm', 'approved', 'business'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.6963, -75.5148, '06 | Swiss Tony''s Used Car Lot', 'Used car lot on the mall perimeter. Potential source of vehicles or parts.', 'gm', 'approved', 'location'),
('5806fd27-fcac-4163-b8a8-61476150962c', 38.6968, -75.5155, '07 | RoadCo Gas Station', 'Gas station at the edge of the King''s Crossroads Mall property. Potential fuel source.', 'gm', 'approved', 'resource'),
-- Reference
('5806fd27-fcac-4163-b8a8-61476150962c', 38.6896, -75.4974, 'Georgetown, DE', 'Town approximately one hour south. 500+ people in a loose collective who consider the King''s Crossroads Mall their territory. Will not be happy to find players and NPCs living there. Further detailed in the Crossroads Chronicles sourcebook.', 'gm', 'approved', 'location');
