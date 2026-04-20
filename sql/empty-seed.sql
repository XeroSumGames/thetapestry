-- ============================================================
-- Empty Jumpstart — setting seed
-- Empty is a standalone adventure (separate from Chased), tagged setting='empty'.
-- Pregens are merged via lib/setting-npcs.ts (Empty = 4 Chased pregens + Gus),
-- so this file only needs the Empty-specific NPCs, pins, scene, and handout.
--
-- Run in Supabase SQL Editor. Idempotent — re-running upserts by (setting, name)
-- or (setting, title).
-- Note: skill names "First Aid" and "Vehicles" in the source spec do not exist
-- in lib/xse-schema SKILLS — mapped to the closest valid skills (Medicine, Driving).
-- ============================================================

-- ── NPCs ───────────────────────────────────────────────────────────────────

INSERT INTO public.setting_seed_npcs (
  setting, name, reason, acumen, physicality, influence, dexterity,
  wp_max, rp_max, skills, equipment, notes, motivation,
  pin_title, npc_type, sort_order
) VALUES (
  'empty', 'Dylan', 0, 1, 1, 0, 2, 13, 8,
  '{"entries":[{"name":"Barter","level":1},{"name":"Medicine","level":2},{"name":"Ranged Combat","level":1},{"name":"Scavenging","level":1},{"name":"Manipulation","level":2},{"name":"Stealth","level":1},{"name":"Streetwise","level":1},{"name":"Unarmed Combat","level":1},{"name":"Driving","level":2}]}'::jsonb,
  '[{"name":"Light Pistol","notes":"3 bullets when he arrives. More ammo in Becky''s bag on the counter."},{"name":"Hunting Knife"},{"name":"Truck","notes":"Contains a shotgun with 2 shells."},{"name":"Basic Survival Kit"},{"name":"Rations","notes":"x2"}]'::jsonb,
  E'Early 30s. Short hair, tattoos visible on arms. Wears a holster. Charming, furtive, smart like a fox.\n\nComplication: Dark Secret\nMotivation: To Take Advantage\n\nHas spent much of his life in jail. Watched his biker buddies die one by one until he ran into Becky nearly a year ago. Together they survive by scavenging, stealing, and backstabbing.\n\nGM has two modes for Dylan:\n- PEACEFUL: desperate to join a group, running out of supplies, will offer skills and knowledge to negotiate.\n- HOSTILE: views all survivors as marks. Will attempt to follow the players back to their base to rob them.\n\nIn both modes, will pull his gun if negotiations fail. Only has 3 bullets when he arrives. Becky''s bag on the counter has more ammo. Truck has a shotgun with 2 shells.\n\nInitiative Modifier: +5 (DEX 2 + ACU 1 + Perception 2)\nGrapple: PHY 1 + Unarmed Combat 2 = +3 to any grapple attempt. Will attempt to grapple the weakest player as a hostage if outnumbered.',
  'To Take Advantage', NULL, 'foe', 1
) ON CONFLICT (setting, name) DO UPDATE SET
  reason = EXCLUDED.reason, acumen = EXCLUDED.acumen, physicality = EXCLUDED.physicality,
  influence = EXCLUDED.influence, dexterity = EXCLUDED.dexterity,
  wp_max = EXCLUDED.wp_max, rp_max = EXCLUDED.rp_max,
  skills = EXCLUDED.skills, equipment = EXCLUDED.equipment,
  notes = EXCLUDED.notes, motivation = EXCLUDED.motivation,
  npc_type = EXCLUDED.npc_type, sort_order = EXCLUDED.sort_order;

INSERT INTO public.setting_seed_npcs (
  setting, name, reason, acumen, physicality, influence, dexterity,
  wp_max, rp_max, skills, equipment, notes, motivation,
  pin_title, npc_type, sort_order
) VALUES (
  'empty', 'Becky', 1, 1, 0, 1, 1, 11, 6,
  '{"entries":[{"name":"Athletics","level":1},{"name":"Barter","level":1},{"name":"Medicine","level":2},{"name":"Ranged Combat","level":1},{"name":"Scavenging","level":1},{"name":"Stealth","level":1},{"name":"Manipulation","level":1}]}'::jsonb,
  '[{"name":"Light Pistol","notes":"7 rounds. In her backpack on the counter — not immediately accessible. Must Move then use an action to retrieve, then Ready Weapon before firing."},{"name":"Backpack","notes":"Contains pistol and personal items."}]'::jsonb,
  E'Late 20s. Long red hair, slim, easy smile and easy laugh. Calm, insightful, friendly.\n\nComplication: Loss\nMotivation: Find Safety\n\nGrew up in a suburb of Chicago. Was studying to become a dental hygienist when the Distemper hit. Watched her hometown crumble. Met Dylan and formed a bond out of necessity and mutual understanding.\n\nFriendly and articulate but never answers questions directly — eyes always darting, taking in the situation. Buys time for Dylan to return. Takes his lead completely — mirrors the mood he sets when he arrives.\n\nIf Dylan is killed or incapacitated she surrenders immediately and is overwhelmed with grief. Will not stop the players taking her belongings.',
  'Find Safety', NULL, 'foe', 2
) ON CONFLICT (setting, name) DO UPDATE SET
  reason = EXCLUDED.reason, acumen = EXCLUDED.acumen, physicality = EXCLUDED.physicality,
  influence = EXCLUDED.influence, dexterity = EXCLUDED.dexterity,
  wp_max = EXCLUDED.wp_max, rp_max = EXCLUDED.rp_max,
  skills = EXCLUDED.skills, equipment = EXCLUDED.equipment,
  notes = EXCLUDED.notes, motivation = EXCLUDED.motivation,
  npc_type = EXCLUDED.npc_type, sort_order = EXCLUDED.sort_order;

-- ── Pins ───────────────────────────────────────────────────────────────────

INSERT INTO public.setting_seed_pins (setting, name, lat, lng, notes, category, sort_order) VALUES
('empty', 'Battersby Farm', 38.7050, -75.7100,
  E'David Battersby''s farm near the Maryland and Delaware border. A third-generation working farm where a small group of survivors have been waiting out the pandemic for the last year. One of the tractors recently broke. This is where the characters of Empty begin.',
  'location', 1),
('empty', E'Stansfield''s Gas Station', 38.7281, -75.6089,
  E'A small rural garage with a couple of pumps out front, a mini-mart inside, and a workshop attached. Owned and run by Errol and Martina Stansfield for almost 15 years before the Distemper hit. The two died at home within days of each other. The station has remained largely untouched since. The workshop contains an arc welder and a tow truck in good condition. The general store is mostly intact but most contents are expired or rotten. A cheap abandoned car sits outside. An expensive motorbike is connected to one of the pumps.',
  'encounter', 2)
ON CONFLICT (setting, name) DO UPDATE SET
  lat = EXCLUDED.lat, lng = EXCLUDED.lng,
  notes = EXCLUDED.notes, category = EXCLUDED.category, sort_order = EXCLUDED.sort_order;

-- ── Tactical Scene ─────────────────────────────────────────────────────────
-- background_url stays NULL until the GM uploads page 11 of the Empty PDF
-- to the tactical-maps bucket and updates this row with the public URL:
--   UPDATE setting_seed_scenes SET background_url = '<paste url>'
--    WHERE setting='empty' AND name=E'Stansfield''s Gas Station';

INSERT INTO public.setting_seed_scenes (setting, name, grid_cols, grid_rows, notes, background_url) VALUES
('empty', E'Stansfield''s Gas Station', 20, 15,
  E'Eight key locations:\n(1) Gas station entrance — players park truck here.\n(2) Abandoned car — unlocked, keys inside, battery dead, nothing of value.\n(3) Dylan''s bike — connected to pump, saddlebags contain survival gear.\n(4) Main entrance — bell above door rings on entry unless players got Wild Success on Stealth.\n(5) Staff area / breakroom — pullout couch, Dylan slept here, cups of instant noodles on shelves.\n(6) Fire escape rear — unlocked but heavy, makes a lot of noise.\n(7) Workshop — contains arc welder, tow truck in good condition, starts first attempt.\n(8) Fire escape side — same as 6.',
  NULL)
ON CONFLICT (setting, name) DO UPDATE SET
  grid_cols = EXCLUDED.grid_cols, grid_rows = EXCLUDED.grid_rows,
  notes = EXCLUDED.notes;
  -- NOTE: deliberately not overwriting background_url so a manual UPDATE survives re-runs.

-- ── GM Handout ─────────────────────────────────────────────────────────────

INSERT INTO public.setting_seed_handouts (setting, title, content, attachments) VALUES
('empty', 'Empty — Session Zero',
E'WHAT THE PLAYERS KNOW\n\nRead or paraphrase the following to the group before play begins:\n\n"It has been almost a year since you first heard of the dog flu. You are all friends, family, or acquaintances of David Battersby and have been waiting the pandemic out on his farm. Your efforts in pulling together as a small group of survivors attempting to be self-sufficient have worked so far — you have all had enough to eat and, minor frustrations aside, no one has come to blows.\n\nBut one of the tractors recently broke and needs an arc welder to be repaired. David believes there is a garage nearby that might have one and, as none of you have left the farm in nearly two months, you all jumped at a chance to go. A few of you take his truck and leave after breakfast.\n\nThis is the first time anyone has ventured off the farm in months and the drive was a sobering experience. The complete lack of life reminds you how absolute the devastation of the dog flu has been. Someone suggested stopping at empty houses along the way to see if there was anything worth scavenging, but one house was enough to starkly remind the group of the horrors recently inflicted upon the world and you kept on moving.\n\nThere is another 25 somber minutes of driving through a couple of small towns and down some country roads before you see the gas station that David mentioned lies ahead."\n\n\nFILLING IN THE GAPS\n\nAsk each player to tell the group at least one detail about what their character saw on the drive. Prompts:\n- Did they see abandoned cars?\n- Were buildings intact or damaged?\n- Were any burned out shells?\n- Did things look looted or eerily normal?\n- Were there remains of the dead?\n- Were any lights on in buildings?\n- Did they see any stores worth stopping at on the way back?\n\n\nWHAT THE GM KNOWS ABOUT THE GAS STATION\n\nThe station was owned by Errol and Martina Stansfield for almost 15 years. In addition to fuel and the general store, Errol had a tow truck and a well-equipped workshop. The two lived quietly and happily until dying at home in excruciating pain within days of each other. Due to the low local population and the secluded nature of the station, it has remained untouched. The general store is largely intact but most contents are expired or rotten.\n\nInside is Becky, late 20s. She and Dylan, early 30s, arrived late the previous night and slept on the pull-out couch in the breakroom. Dylan went hunting that morning and will return shortly after the players encounter Becky. Dylan used more ammunition than intended while hunting and has only 3 bullets left when he returns. More ammo is in Becky''s bag on the counter. They also have a shotgun in their truck with 2 shells.\n\n\nMAP — EIGHT KEY LOCATIONS\n\n(1) Gas station entrance — players park truck here.\n(2) Abandoned car — unlocked, keys inside, battery dead, nothing of value.\n(3) Dylan''s bike — connected to pump, saddlebags contain survival gear.\n(4) Main entrance — bell above door rings on entry unless players got Wild Success on Stealth.\n(5) Staff area / breakroom — pullout couch, Dylan slept here, cups of instant noodles on shelves.\n(6) Fire escape rear — unlocked but heavy, makes a lot of noise.\n(7) Workshop — contains arc welder, tow truck in good condition, starts first attempt.\n(8) Fire escape side — same as 6.\n\nBecky is in the restroom when players arrive. She emerges moments after they enter. Unless players made significant noise she will not know they are there. She will assume any noise is Dylan returning.\n\nDylan arrives a few minutes after players encounter Becky. He peeks through windows before entering — make Stealth check 2d6+2+1.\n\nFront door bell: players can make Perception check to notice it, then Tinkerer check to disable it. Fire escape has second bell — same process.\n\nWorkshop doors are locked and require Physicality check at -3 CMod as group check to force open — will make huge noise.',
  '[]'::jsonb)
ON CONFLICT (setting, title) DO UPDATE SET
  content = EXCLUDED.content;
