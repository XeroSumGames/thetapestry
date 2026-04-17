-- ============================================================
-- Seed Mongrels NPCs into an EXISTING campaign
-- Run in Supabase SQL Editor.
-- Finds the first campaign with setting='mongrels' and inserts
-- all seed NPCs that don't already exist (by name).
-- ============================================================

DO $$
DECLARE
  camp_id uuid;
  pin_map jsonb := '{}'::jsonb;
  pin_id uuid;
  npc_data jsonb;
  npc record;
  sort_idx integer := 1;
BEGIN
  -- Find the Mongrels campaign
  SELECT id INTO camp_id FROM campaigns WHERE setting = 'mongrels' LIMIT 1;
  IF camp_id IS NULL THEN
    RAISE NOTICE 'No Mongrels campaign found. Skipping.';
    RETURN;
  END IF;

  -- Build pin title → id map for this campaign
  FOR npc IN SELECT id, name FROM campaign_pins WHERE campaign_id = camp_id LOOP
    pin_map := pin_map || jsonb_build_object(npc.name, npc.id::text);
  END LOOP;

  -- Get current max sort_order
  SELECT COALESCE(MAX(sort_order), 0) INTO sort_idx FROM campaign_npcs WHERE campaign_id = camp_id;

  -- Insert NPCs (skip if name already exists in this campaign)
  -- Frankie
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Frank "Frankie" Wallace') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'Frank "Frankie" Wallace', 2, 2, 1, 2, 1, 12, 7, 12, 7,
      '{"entries":[{"name":"Mechanic","level":2},{"name":"Tinkerer","level":2},{"name":"Inspiration","level":1},{"name":"Ranged Combat","level":1},{"name":"Survival","level":1},{"name":"Tactics","level":1},{"name":"Driving","level":1},{"name":"Intimidation","level":1}]}'::jsonb,
      '[{"name":"Heavy Pistol"},{"name":"Grenade","notes":"Hidden in pocket. 4-square blast radius."}]'::jsonb,
      E'Role: Compound Leader\n\nFrankie is a competent, stubborn man who has kept eleven people alive in the Sonoran Desert for three years. He dies on Day One.\n\nHow to meet: The players begin the campaign working alongside Frankie in the barn.',
      'Get his people to Bozeman before Kincaid forces them into a water war.', 'active', sort_idx,
      (pin_map->>'Hells Hole Spring, AZ')::uuid);
  END IF;

  -- Kincaid
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Kincaid') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'Kincaid', 1, 1, 2, 2, 1, 14, 6, 14, 6,
      '{"entries":[{"name":"Intimidation","level":2},{"name":"Tactics","level":2},{"name":"Ranged Combat","level":2},{"name":"Melee Combat","level":1},{"name":"Manipulation","level":1},{"name":"Athletics","level":1},{"name":"Survival","level":1}]}'::jsonb,
      '[{"name":"Heavy Pistol"},{"name":"Hunting Rifle"}]'::jsonb,
      E'Role: Warlord / Antagonist\n\nKincaid controls Apache Junction and Canyon Lake. Ruthless, calculating. His men do not cross into Menendez territory.\n\nHow to meet: Arrives at the compound on Day One with Justice Morse and a dozen soldiers.',
      'Control the methanol production capability.', 'active', sort_idx,
      (pin_map->>'Canyon Lake Marina & Campground')::uuid);
  END IF;

  -- Justice Morse
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Justice Morse') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order)
    VALUES (camp_id, 'Justice Morse', 0, 1, 2, 1, 1, 13, 6, 13, 6,
      '{"entries":[{"name":"Ranged Combat","level":2},{"name":"Melee Combat","level":1},{"name":"Intimidation","level":1},{"name":"Athletics","level":1},{"name":"Tactics","level":1},{"name":"Driving","level":1}]}'::jsonb,
      '[{"name":"Assault Rifle","notes":"Full-auto capable"},{"name":"Heavy Pistol"}]'::jsonb,
      E'Role: Kincaid''s Lieutenant\n\nJustice Morse is Kincaid''s right hand. Loyal, efficient, dangerous.\n\nHow to meet: Arrives with Kincaid on Day One.',
      'Loyalty to Kincaid.', 'active', sort_idx);
  END IF;

  -- Kincaid's Soldier
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Kincaid''s Soldier') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order)
    VALUES (camp_id, 'Kincaid''s Soldier', 0, 0, 1, 0, 1, 12, 7, 12, 7,
      '{"entries":[{"name":"Ranged Combat","level":1},{"name":"Melee Combat","level":1},{"name":"Athletics","level":1},{"name":"Intimidation","level":1},{"name":"Driving","level":1},{"name":"Survival","level":1}]}'::jsonb,
      '[{"name":"Assault Rifle"},{"name":"Light Pistol"}]'::jsonb,
      E'Role: Raider\n\nGeneric stat block for Kincaid''s men. A dozen arrive on Day One.\n\nHow to meet: Day One — they surround the compound.',
      'Following orders.', 'active', sort_idx);
  END IF;

  -- The Watcher of Page
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'The Watcher of Page') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'The Watcher of Page', 1, 2, 0, 0, 1, 10, 7, 10, 7,
      '{"entries":[{"name":"Stealth","level":2},{"name":"Survival","level":2},{"name":"Scavenging","level":1},{"name":"Tinkerer","level":1}]}'::jsonb,
      '[{"name":"Hunting Knife"}]'::jsonb,
      E'Role: Lone Survivor\n\nLives among mannequins in abandoned Page. Watches from a distance. Ambiguous intent.\n\nHow to meet: Day 10. Players discover Page full of mannequins.',
      'Solitude.', 'active', sort_idx,
      (pin_map->>'Page, AZ')::uuid);
  END IF;

  -- Nana Ruth
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Nana Ruth') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'Nana Ruth', 2, 1, 0, 2, 0, 10, 8, 10, 8,
      '{"entries":[{"name":"Mechanic","level":2},{"name":"Inspiration","level":1},{"name":"Psychology","level":1},{"name":"Survival","level":1},{"name":"Barter","level":1}]}'::jsonb,
      '[]'::jsonb,
      E'Role: LDS Elder\n\nKnows a cleaner distilling method. Will share it if you sit and listen to her talk about her family.\n\nHow to meet: Days 14-15, Kanab brew day. Wild Success.',
      'Connection. Someone to listen.', 'active', sort_idx,
      (pin_map->>'Kanab, UT')::uuid);
  END IF;

  -- Cole Vickers
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Cole Vickers') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'Cole Vickers', 1, 1, 2, 1, 1, 13, 7, 13, 7,
      '{"entries":[{"name":"Ranged Combat","level":2},{"name":"Survival","level":2},{"name":"Athletics","level":1},{"name":"Intimidation","level":1},{"name":"Stealth","level":1}]}'::jsonb,
      '[{"name":"Hunting Rifle"},{"name":"Hunting Knife"}]'::jsonb,
      E'Role: Survivalist Leader\n\nControls Cedar Breaks at 10,000ft. Suspicious, territorial, well-prepared — but not unreasonable.\n\nHow to meet: Day 16, approach to Cedar City.',
      'Protect the water supply.', 'active', sort_idx,
      (pin_map->>'Cedar Breaks National Monument, UT')::uuid);
  END IF;

  -- Brother Elias
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Brother Elias') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'Brother Elias', 2, 2, 0, 2, 0, 10, 8, 10, 8,
      '{"entries":[{"name":"Manipulation","level":2},{"name":"Inspiration","level":2},{"name":"Psychology","level":1},{"name":"Intimidation","level":1}]}'::jsonb,
      '[]'::jsonb,
      E'Role: Fanatic Preacher\n\nLeads the religious fanatics on I-15. Theology is coherent and disturbing. First encounter is non-violent.\n\nHow to meet: Days 17-19, Cedar City to Holden.',
      'Convert the players. Absolute faith.', 'active', sort_idx,
      (pin_map->>'Fanatics Roadblock I-15 North')::uuid);
  END IF;

  -- Marcus Webb
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Marcus Webb') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'Marcus Webb', 0, 1, 1, 0, 2, 12, 7, 12, 7,
      '{"entries":[{"name":"Mechanic","level":3},{"name":"Tinkerer","level":2},{"name":"Driving","level":1},{"name":"Scavenging","level":1}]}'::jsonb,
      '[{"name":"Light Pistol"}]'::jsonb,
      E'Role: Trapped Mechanic\n\nPinned under shelving in Idaho Falls. Knows Winnebago engines. Wants to come to Bozeman. Someone here loves him.\n\nHow to meet: Days 32-33, gather day.',
      'Get free. Get to Bozeman.', 'active', sort_idx,
      (pin_map->>'Idaho Falls, ID')::uuid);
  END IF;

  -- The Dying Traveller
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'The Dying Traveller') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'The Dying Traveller', 1, 0, 0, 1, 0, 3, 2, 3, 2,
      '{"entries":[{"name":"Survival","level":1}]}'::jsonb,
      '[]'::jsonb,
      E'Role: Dying Survivor\n\nFrom Bozeman. Found in a raided town near Pocatello. Leaves behind a photograph.\n\nHow to meet: Days 28-30, Pocatello.',
      'Get the photograph home.', 'active', sort_idx,
      (pin_map->>'Pocatello, ID')::uuid);
  END IF;

  -- Dillon Rancher
  IF NOT EXISTS (SELECT 1 FROM campaign_npcs WHERE campaign_id = camp_id AND name = 'Dillon Rancher') THEN
    sort_idx := sort_idx + 1;
    INSERT INTO campaign_npcs (campaign_id, name, reason, acumen, physicality, influence, dexterity,
      wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation, status, sort_order,
      campaign_pin_id)
    VALUES (camp_id, 'Dillon Rancher', 1, 1, 1, 1, 1, 12, 7, 12, 7,
      '{"entries":[{"name":"Ranged Combat","level":1},{"name":"Survival","level":2},{"name":"Animal Handling","level":2},{"name":"Barter","level":1},{"name":"Farming","level":1}]}'::jsonb,
      '[{"name":"Hunting Rifle"},{"name":"Hunting Knife"}]'::jsonb,
      E'Role: Working Rancher\n\nBeaverhead Valley rancher. Curious but cautious. Has horses and beef. Willing to trade.\n\nHow to meet: Days 35-36, Dillon gather day. Wild Success.',
      'Protect his land.', 'active', sort_idx,
      (pin_map->>'Dillon, MT')::uuid);
  END IF;

  RAISE NOTICE 'Mongrels NPCs seeded into campaign %', camp_id;
END $$;
