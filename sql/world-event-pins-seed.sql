-- ============================================================
-- World Map Pins — Timeline Events & Settlements
-- Visible to everyone including Ghosts
-- Idempotent: skips if title already exists
-- ============================================================

-- THE ORIGIN
INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 50.4501, 30.5234, 'First Reports — Eastern Europe',
 'January 17th. Reports surface of a novel virus causing severe respiratory distress across multiple Eastern European countries and Russian republics. The aggressive symptoms and swift transmission in several large cities leave officials startled. The world does not yet know what is coming.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'First Reports — Eastern Europe');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 43.3169, 45.6988, 'Chechnya — First State of Emergency',
 'January 23rd. Without explanation to the outside world, Chechnya declares a state of emergency. A French Reuters correspondent reports martial law being used to combat a highly infectious virus. Three days later that correspondent disappears. Chechen officials deny his reporting while the military simultaneously quarantines the three most heavily populated cities. The country goes dark.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'Chechnya — First State of Emergency');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', -33.4489, -70.6693, 'First Recorded Death — Chile',
 'March 4th. An elderly man dies in the middle of a coughing fit. An autopsy confirms all the symptoms of H724, but he had had no contact with the outside world in weeks. Most alarmingly, it was estimated that fewer than 12 hours passed from his initial symptoms to his death. This marks the true beginning of the Dog Flu.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'First Recorded Death — Chile');

-- SCIENCE & RESPONSE
INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 46.2338, 6.1157, 'WHO Headquarters — Geneva',
 'The source of every announcement that charted the world''s descent. February 9th: H724 officially designated. March 12th: H724-B mutation announced. April 14th: Hyper-pandemic declared — international airspace shuts down within hours. April 15th: Mortality rates confirmed climbing to 15% in vulnerable regions. June 5th: H724-C announced, mortality rate revised to 29%. For many, each WHO press conference was the moment they understood it was real.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'WHO Headquarters — Geneva');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 52.5200, 13.4050, 'German Research Institute — Testing Breakthrough',
 'June 3rd. Data provided by a German research institute enables a breakthrough in rapid testing capabilities. For the first time there is a concrete path forward — the ability to identify who is infected and begin to contain the spread. It comes too late to stop the collapse, but it is the moment the scientific community allows itself a moment of cautious optimism.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'German Research Institute — Testing Breakthrough');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 59.3293, 18.0686, 'Berglund''s Coalition — Stockholm',
 'May 27th. A coalition of scientists from 14 nations led by Hans Berglund, a famed Swedish epidemiologist, begins researching effective testing in the hope it will ultimately point to a vaccine. Berglund will later relocate his team to a facility in Belgium as Sweden falls into chaos following the Finland nuclear event.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'Berglund''s Coalition — Stockholm');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 50.8503, 4.3517, 'Berglund''s Research Facility — Belgium',
 'September 11th. Isolated in a facility in Belgium, Berglund''s team introduce synthetic genes into H724 and believe they have line of sight to a vaccine. It will not come fast enough. Europe is already falling into anarchy as successive governments topple around them. Whether they ever succeeded is unknown.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'Berglund''s Research Facility — Belgium');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 51.5074, -0.1278, 'UK Vaccine Trials',
 'August 11th. With Berglund''s team no closer to a breakthrough, the UK begins experimental human treatment to evaluate a possible vaccine. In any other era this would have drawn global condemnation. Instead, what remains of the UN, WHO, and the FDA immediately remove all drug research safeguards. The trials begin in desperation.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'UK Vaccine Trials');

-- THE TURNING POINTS
INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 37.5665, 126.9780, 'South Korea — Mandatory National Testing',
 'June 15th. South Korea is the first nation to conduct mandatory, nationwide testing. The infected — along with anyone even suspected of exposure — are moved into what are euphemistically called Survival Camps. Most countries quickly follow. The Survival Camp model spreads around the globe within days.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'South Korea — Mandatory National Testing');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 55.7558, 37.6173, 'Russia Coup — Chain Reaction',
 'March 3rd. A coup in Russia sets off a chain of coups, revolutions, and insurrections inside the former USSR. The timing raises many questions and any connection to the virus remains unclear. Multiple countries go dark. This instability spreads throughout the region, plunging much of it into chaos and accelerating the pandemic''s unchecked spread.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'Russia Coup — Chain Reaction');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 40.7128, -74.0060, 'US Quarantine Zones',
 'August 6th. On the advice of what remains of the CDC, the US government quarantines parts of California, Rhode Island, North and South Dakota, Florida, and New York City. The bridges and tunnels connecting Manhattan to the outside world are destroyed. The blowback forces Martial Law across the United States. Twenty-four days later, the Federal Government dissolves entirely.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'US Quarantine Zones');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 38.8951, -77.0364, 'US Government Dissolves',
 'August 30th. After the death of the President and most of his cabinet, with so few forces remaining, the Federal Government dissolves and returns all authority to the states. This effectively ends the United States of America.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'US Government Dissolves');

-- THE COLLAPSE
INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 39.9042, 116.4074, 'China — Central Corpse Disposal',
 'July 20th. Unable to cope with so many dead bodies, China begins what it calls ''central corpse disposal''. The fires can be seen from Taiwan. Unconfirmed reports emerge of mass exterminations within Survival Camps in both Russia and China. From this point forward no one is reporting — only surviving.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'China — Central Corpse Disposal');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 60.1699, 24.9384, 'Finland — Nuclear Event',
 'August 22nd. A nuclear explosion in Finland creates a radiological disaster and begins weeks of ash-smoke and grid failure. No one is ever certain precisely what caused it. The event appears to trigger total societal breakdown in neighboring Sweden, plunging all of Scandinavia into darkness within days. Reports of widespread brutality and cannibalism follow. The shockwave drives further riots throughout what remains of Europe.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'Finland — Nuclear Event');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 59.9139, 10.7522, 'Scandinavia — Goes Dark',
 'August 27th. Within days of losing its power grid following the Finland nuclear event, Scandinavia is plunged into darkness. Multiple independent reports of widespread brutality and horror. Unconfirmed reports of cannibalism. This drives further riots throughout what remains of Europe as terrified people demand desperate action from paralyzed governments hanging on by their fingertips.',
 'gm', 'approved', 'world_event'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'Scandinavia — Goes Dark');

-- SETTLEMENTS
INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 36.0526, -95.7902, 'District Zero — Broken Arrow, OK',
 'Three years after the apex of the Dog Flu, District Zero — also called the Mile — is one of the most organized survivor settlements in the region. Built on the bones of Broken Arrow''s historic Rose District, it houses just over 900 people under the leadership of Lincoln Sawyer. A rare pocket of civilization in a shattered world.',
 'gm', 'approved', 'settlement'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'District Zero — Broken Arrow, OK');

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category)
SELECT '5806fd27-fcac-4163-b8a8-61476150962c', 38.6958, -75.5142, 'King''s Crossroads Mall — Sussex County, DE',
 'A half-finished mall that became home to a small group of survivors making their way toward the Delaware coast. 14 residents at last count. The starting location for the Crossroads Chronicles campaign. Georgetown, one hour south, houses 500+ people in a loose collective who consider this area their territory.',
 'gm', 'approved', 'settlement'
WHERE NOT EXISTS (SELECT 1 FROM map_pins WHERE title = 'King''s Crossroads Mall — Sussex County, DE');
