-- ============================================================
-- Path to Citizenship - seed (PART 1: NPC gaps + player handouts)
-- Target campaign "District Zero" 6dd8611b-62ef-4810-b998-b9c5682d0a62.
-- Spec: tasks/spec-path-to-citizenship.md
--
-- Idempotent + non-destructive: every row is an INSERT ... SELECT ... WHERE
-- NOT EXISTS guard keyed on (campaign_id, name|title). Re-running never
-- duplicates and never overwrites a row Xero later edits. (campaign_npcs and
-- campaign_notes have no natural unique key, so this guard replaces ON CONFLICT
-- and resolves spec open-item #4 without a schema change.)
--
-- Canon (verified 2026-06-30): attributes RSN/ACU/PHY/INF/DEX; WP = 10+PHY+DEX,
-- RP = 6+PHY (lib/xse-schema.ts deriveSecondaryStats); skill names from SKILLS;
-- motivations from MOTIVATIONS. Weapon stats from lib/weapons.ts.
--
-- APPLIED TO LIVE 2026-06-30 (verified present). Kept as the idempotent repo
-- artifact - re-running is a no-op thanks to the NOT EXISTS guards:
--   npx supabase db query --linked -f sql/path-to-citizenship-seed.sql
-- Parts 2 (pregens) + 3 (scene briefs) shipped in sibling files, also live.
-- ============================================================

-- ── NPC gaps ────────────────────────────────────────────────────────────────

-- George Meeker - the off-shift deputy who escorts newcomers (Scenes 1, 15, 20).
INSERT INTO public.campaign_npcs
  (campaign_id, name, reason, acumen, physicality, influence, dexterity,
   wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation,
   npc_type, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'George Meeker', 1, 2, 1, 1, 1,
   12, 7, 12, 7,
   '{"text":"Ranged Combat 2, Streetwise 2, Unarmed Combat 1, Manipulation 1, Specific Knowledge 1","weapon":null,"entries":[{"name":"Ranged Combat","level":2},{"name":"Streetwise","level":2},{"name":"Unarmed Combat","level":1},{"name":"Manipulation","level":1},{"name":"Specific Knowledge","level":1}]}'::jsonb,
   '[{"name":"Heavy Pistol","notes":"Sidearm. Holstered while off-shift."},{"name":"Walkie-Talkie","notes":"Tied to the City Hall shift leader."}]'::jsonb,
   E'Role: District Deputy (off-shift newcomer escort)\n\n42 years old, has lived in the Broken Arrow region his whole life. Affable and unhurried. He is the deputy who walks new arrivals into town once they clear the gate, answering questions along the way, though he is circumspect about oversharing. When his shift ends he heads to the Main Street Tavern for a grain beer.\n\nHow to meet: At the West Gate when the PCs first arrive (Scene 1), or off-duty at the Tavern. Recurs on watchtower duty (Scene 15) and the night-watch refugee decision (Scene 20).',
   'Protect', NULL, 50
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_npcs
   WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='George Meeker');

-- Marty - newcomer in the work detail; the parasite-outbreak thread.
INSERT INTO public.campaign_npcs
  (campaign_id, name, reason, acumen, physicality, influence, dexterity,
   wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation,
   npc_type, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'Marty', 0, 1, 1, 0, 1,
   12, 7, 12, 7,
   '{"text":"Athletics 1, Scavenging 1, Unarmed Combat 1","weapon":null,"entries":[{"name":"Athletics","level":1},{"name":"Scavenging","level":1},{"name":"Unarmed Combat","level":1}]}'::jsonb,
   '[{"name":"Worn belongings","notes":"A bindle of personal effects. Nothing of value."}]'::jsonb,
   E'Role: Newcomer / work-gang laborer\n\nAnother recent arrival assigned to the same work detail as the PCs. Eager to fit in and talkative. He rides the shit-truck alongside them (Scene 7) and fails to clean up properly afterward, contracting a parasitic infection that later spreads through the community.\n\nPlot thread: Scene 7 (introduced) -> Scene 12 (falls sick) -> Scene 21 (traced as the outbreak source). Leave his infection un-triggered until Scene 12; the GM infection controls drive it from there.\n\nHow to meet: The hazing work detail at Nate''s Auto Shop (Scene 7) and dinner at The Kitchen (Scene 8).',
   'Find Safety', NULL, 51
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_npcs
   WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Marty');

-- Desperate Survivor - foe, runs as a group of 3 (Scene 11 ambush).
INSERT INTO public.campaign_npcs
  (campaign_id, name, reason, acumen, physicality, influence, dexterity,
   wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation,
   npc_type, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'Desperate Survivor', 0, 1, 1, 0, 1,
   12, 7, 12, 7,
   '{"text":"Ranged Combat 1, Unarmed Combat 1, Scavenging 1, Stealth 1","weapon":null,"entries":[{"name":"Ranged Combat","level":1},{"name":"Unarmed Combat","level":1},{"name":"Scavenging","level":1},{"name":"Stealth","level":1}]}'::jsonb,
   '[{"name":"Hunting Knife","notes":"2+2d3 dmg. Carried by all three."},{"name":"Light Pistol","notes":"3+1d6 dmg. Only ONE of the three has it, with ~3 rounds."}]'::jsonb,
   E'Role: Foe - desperate scavenger (run as a group of 3)\n\nA band of starving survivors who ambush the work crew on the road to Morris (Scene 11, "Hostile Encounter"). They want the truck and its cargo, not a fight to the death. One carries a Light Pistol with only a few rounds; the other two have knives or clubs. If two go down, or the PCs show real force, the survivors break and flee.\n\nHow to meet: The Scavenger Run road encounter (Scene 11).',
   'Stay Alive', 'foe', 52
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_npcs
   WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Desperate Survivor');

-- Territorial Raider - foe, runs as a group of 5 (Scene 11 confrontation).
INSERT INTO public.campaign_npcs
  (campaign_id, name, reason, acumen, physicality, influence, dexterity,
   wp_max, rp_max, wp_current, rp_current, skills, equipment, notes, motivation,
   npc_type, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'Territorial Raider', 0, 1, 2, 1, 1,
   13, 8, 13, 8,
   '{"text":"Melee Combat 2, Ranged Combat 1, Unarmed Combat 1, Manipulation 1","weapon":null,"entries":[{"name":"Melee Combat","level":2},{"name":"Ranged Combat","level":1},{"name":"Unarmed Combat","level":1},{"name":"Manipulation","level":1}]}'::jsonb,
   '[{"name":"Machete","notes":"3+2d3 dmg. Three of the five carry these or clubs."},{"name":"Shotgun (Pump-Action)","notes":"5+2d6 dmg. The leader only."},{"name":"Light Pistol","notes":"3+1d6 dmg. One other raider."}]'::jsonb,
   E'Role: Foe - territorial raider (run as a group of 5)\n\nArmed men who claim the M&M Machining area and move on the crew as they load the lathe (Scene 11, "Confrontation"). Vary the weapons: the leader has a Pump-Action Shotgun, one has a Light Pistol, the remaining three carry machetes or clubs. They are confident and press an advantage, but they are opportunists, not zealots - heavy losses or a hard counter sends them looking for easier prey.\n\nHow to meet: The Scavenger Run at M&M Machining (Scene 11). Reusable for other road foes (Scenes 15, 22).',
   'Take Advantage', 'foe', 53
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_npcs
   WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Territorial Raider');

-- ── Player handouts (campaign_notes, shared=true) ───────────────────────────

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62',
   'PtC - Welcome to District Zero (the gate)',
   E'You have reached the Mile, the fenced heart of District Zero. However you approached, the fence and its watchtowers turned you toward the main gate on the west side. There is a line. Everyone is processed the same way, and the Deputies have broad discretion over who they admit:\n\n- You are frisked. No weapons are allowed inside the town. Anything you carry is taken and logged into a lockbox.\n- You pay 1 BB for the lockbox and get a chit to reclaim your weapon the next morning (another 1 BB for each day it stays).\n- You read the city rules aloud.\n- You are signed in (name and date of birth) and a Polaroid is taken for the city files.\n- You are given a colored chip that marks your status: Red (day visitor), Blue (extended stay), or Green (resident). Each chip has a recorded serial number.\n\nMake a First Impressions check as you go through this. The Deputies decide whether you are let in, restricted, or turned away, and there is no one to appeal to.',
   true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes
   WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62'
     AND title='PtC - Welcome to District Zero (the gate)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62',
   'PtC - Starting Out: Kit and the BB Economy',
   E'WHAT YOU ARRIVE WITH\n\nEach of you starts with:\n- 5d6 bullets and 5d6 batteries. Together these are your money, called BB ("beebee") - somewhere between 10 and 30 BB to start.\n- A primary and a secondary weapon (surrendered at the gate; reclaim them with your chit).\n- A Basic Survival Kit.\n- 3 days of Rations.\n\nLIVING IN THE MILE\n- A bed at the Rose Rooms costs 5 bullets per night, or 10 for a heated room.\n- Register for a work gang at the Chamber of Commerce and you earn 5 BB per day plus a meal at sundown.\n- Pay is credited as a chit; redeem it for real BB at the Vault, or spend it directly at the Tavern or the Rose Rooms.\n- One free meal per resident is served each evening at The Kitchen.',
   true, 2
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes
   WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62'
     AND title='PtC - Starting Out: Kit and the BB Economy');
