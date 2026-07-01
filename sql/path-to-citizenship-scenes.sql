-- ============================================================
-- Path to Citizenship - seed (PART 3: the 22 scene briefs)
-- GM-facing campaign_notes (shared=false) for campaign
-- "District Zero" 6dd8611b-62ef-4810-b998-b9c5682d0a62.
-- Arc A = onboarding (0-9), Arc B = hook pool (10-22). Scene 4 is folded into
-- Scene 3 (Lodging), so numbering skips 4 to keep the NPC/foe cross-refs stable.
--
-- Each brief follows the locked skeleton: Location/NPCs/Handout, Setup, Trigger,
-- Check + tiered Outcomes, Drop-in scaling, Links. The Setup->Trigger->Outcomes
-- shape is what lets a future solo/oracle layer slot in.
--
-- Tactical maps (Scenes 11, 15, 16, 22) are NOT seeded as rows - each brief tells
-- the GM the grid size to build with uploaded art at run time (cell_px 35).
--
-- Idempotent + non-destructive: NOT EXISTS guards on (campaign_id, title).
-- dollar-quoted ($pg$) content, ASCII only. sort_order = 100 + scene number so
-- briefs group after the two player handouts.
-- ============================================================

-- ── Arc A: onboarding ───────────────────────────────────────────────────────

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 00. Shining City on the Hill (Session Zero)',
$pg$Location: Outside the District. NPCs: none.

Setup. Before play begins, each player establishes where their character is coming from and why they are heading to the District.

Prompts (ask each player). Are they going there intentionally, and why? Or did they find it by accident, and where from? What have they left behind? Are they alone or with others? Are they armed? Are they looking to visit, trade, join, or are they undecided?

Starting resources. Each PC begins with 5d6 bullets and 5d6 batteries (10-30 BB total), a primary and a secondary weapon, a Basic Survival Kit, and 3 days of Rations.

Drop-in scaling. This is the on-ramp for any new player at any time - a newcomer joining an ongoing table runs this solo to establish their arrival, then slots into the gate scene.

Links. Leads to Scene 1 (the Gate). Give the players the "Starting Out: Kit and the BB Economy" handout.$pg$,
false, 100
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 00. Shining City on the Hill (Session Zero)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 01. New Faces in Town (the Gate)',
$pg$Location: West Gate. NPCs: George Meeker, a gate Deputy (Wesley keeps the files). Handout: "Welcome to District Zero (the gate)".

Setup. The PCs first arrival at the Mile. However they approached, the fence and watchtowers funnel them to the West Gate. Residents come and go with carts and work details - wary, but not hostile. There is a line.

Trigger. The PCs join the line to be processed by the Deputies.

The process (run in order). Frisked; all weapons confiscated to a lockbox (1 BB, chit to reclaim next morning or pay again); made to read the city rules aloud; signed in - name, DOB, a Polaroid for Wesley's files; issued a status chip - Red (day), Blue (extended stay), or Green (resident), serial recorded.

Check. Each PC makes a First Impressions check. The Deputies have broad discretion and there is no appeal.
- Success: admitted, directed to the town center; off-shift George Meeker walks them in and fields questions.
- Partial: admitted but watched; Red chip only, extra scrutiny at later gates.
- Failure / Dire: restricted or turned away; they must find another way in (a voucher, a bribe, come back tomorrow).

Drop-in scaling. Works for 1 to a full table - each newcomer rolls their own First Impressions. A lone player pairs naturally with George as an escort.

Links. Hands out the gate player-handout; leads to Scene 2 (the Tavern). George recurs in Scenes 15 and 20.$pg$,
false, 101
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 01. New Faces in Town (the Gate)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 02. It''s Happy Hour Somewhere',
$pg$Location: Main Street Tavern. NPCs: Jemimah Sawyer, George Meeker, locals.

Setup. As the PCs explore (or as George escorts them), they come upon the Main Street Tavern, the town's social hub.

Trigger. George invites them in, or Jemimah is opening up / taking a bread delivery, or they simply wander in.

Check. Social - no roll required; a First Impressions or Barter check if they push for gossip, credit, or favors.

Outcome. They meet locals and learn the lay of the town - work at the Chamber, lodging at the Rose Rooms, and a background murmur about the Milo / church tension.

Drop-in scaling. A natural low-stakes scene to open a session or fold in a latecomer.

Links. Follows Scene 1; leads to Scene 3 (Lodging) or Scene 5 (register for work).$pg$,
false, 102
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 02. It''s Happy Hour Somewhere');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 03. Lodging (Renting a Room / Roughing It)',
$pg$Location: The Rose Rooms. NPCs: Marcy Cunningham.

Setup. Whenever a PC needs to sleep. Marcy meets them at the Rose Rooms (a converted apartment building), answers questions, and points them to Wesley at the Chamber of Commerce for morning work.

Options. A room is 5 bullets per night, or 10 for a heated room. A PC who cannot or will not pay can rough it - sleep in the open or a public space - free, but rougher (cold, poor rest; the GM may impose a minor penalty on the next morning's checks).

Check. Barter if they haggle Marcy on the rate (she quietly accepts cigarettes, though Wesley disapproves).

Drop-in scaling. Pure connective tissue - use it to end a session or pass time. Recurs any night.

Links. Leads to Scene 5 (work registration in the morning).$pg$,
false, 103
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 03. Lodging (Renting a Room / Roughing It)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 05. Becoming One Of You',
$pg$Location: Chamber of Commerce. NPCs: Wesley Spencer.

Setup. A PC wanting to stay more than a night applies for residency, or at least registers to work.

Trigger. They go to Wesley at the Chamber of Commerce.

Process. Residency means Wesley types up an application and asks a thousand questions. Work-only means he assigns them to a crew by skill; turn up at sunrise for a duty by need. Pay is 5 batteries per day plus a meal.

Check. First Impressions on Wesley - the result colors how he treats them and what duty they draw.
- Good: a decent assignment.
- Poor: a worse one (see Scene 6).

Drop-in scaling. Solo-friendly; the residency interview is a good spotlight for a lone PC.

Links. Leads to Scene 6 (work assignment).$pg$,
false, 105
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 05. Becoming One Of You');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 06. Putting These Hands To Work',
$pg$Location: Chamber of Commerce. NPCs: Wesley Spencer.

Setup. Residents-to-be (and anyone wanting BB) report at dawn for a work assignment. Outsiders can work for 5 BB per day plus a sundown meal.

Trigger. They meet Wesley at dawn. He sends them to Johnson Walker at the Auto Shop.

Check. They can try Barter or Manipulation to angle for a better duty.
- Fail or annoy Wesley: they ride the shit truck (Scene 7).
- Succeed: a better duty - David's farm (Scene 9).

Pay. Wesley credits 5 BB the next morning as a chit, redeemable at the Vault, the Tavern, or the Rose Rooms.

Drop-in scaling. Works at any size.

Links. Leads to Scene 7 (hazing) on a fail, or Scene 9 (farm) on a success.$pg$,
false, 106
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 06. Putting These Hands To Work');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 07. Riding the Shit Truck (hazing)',
$pg$Location: Nate's Auto Shop, then the composting depot across OK 51. NPCs: Johnson Walker, Marty, Gio Leone.

Setup. Wesley's hazing ritual for hopefuls. Johnson waits at the shop with his truck (masked, taciturn). Another newcomer, Marty, is on the detail.

Trigger. Johnson tells them they are being hazed - gathering human waste from the town's composting toilets to haul to the humanure depot.

Beats. They ride in the truck bed with three strapped barrels (gas mask and gloves provided), collect waste house to house (keep the lids on), deliver to Gio at the depot near sundown, and wash up at Johnson's basin.

Check. Physicality to avoid vomiting through the day.

Consequence. They end tired and stinking. They can shower at the Rose Rooms (pay), wash at the public trough by the Farmer's Market, or go to dinner smelling of it (see Scene 8).

Plot seed. Marty does not clean up properly, which starts the parasite thread (Scene 12).

Drop-in scaling. A great group bonding scene; runs fine solo.

Links. Leads to Scene 8 (dinner). Marty thread continues in Scene 12.$pg$,
false, 107
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 07. Riding the Shit Truck (hazing)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 08. Dinner with Nana and the Angels',
$pg$Location: The Kitchen. NPCs: Nana Welch, Johnson Walker, Marty, townsfolk.

Setup. Dinner is served at sundown each night - a repeatable backdrop. Hundreds mill about, good-natured, some playing music; Nana and her "angels" serve rice and beans.

Trigger. The PCs come with their work gang.

Social. If they cleaned up after the shit truck, people mingle with them. If not, only Johnson (who cannot smell it) sits near them.

Drop-in scaling. Reusable as the backdrop to any evening; ideal for latecomers or downtime roleplay.

Links. Recurs; leads to Scene 9 (the farm) or any Arc B hook.$pg$,
false, 108
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 08. Dinner with Nana and the Angels');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 09. Down on the Farm',
$pg$Location: The Farm (District One). NPCs: David Battersby.

Setup. Post-hazing, Wesley gives a proper assignment: David's farm, in a 20-person work gang.

Trigger. David meets them at the farm's corner with a clipboard, calls 15 names to the fields, and keeps the last 5 (including the PCs) back for a project.

Beats. The field crew does hard labor; the kept-back crew helps David build bee hives (he needs mechanical / tinkerer hands, and has scavengers watching for wild hives).

Checks.
- Field workers: Athletics (failure or dire = a pulled back, in pain).
- Project crew: Mechanics or Tinkerer (0 CMod) to succeed and pick up the technique.

Outcome. Help the project and David is grateful; work the fields and he is ambivalent.

Drop-in scaling. Splits the party naturally (fields vs project); scale the gang size to the table.

Links. Leads to Scene 10 (Dinner and a Show) or any Arc B hook.$pg$,
false, 109
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 09. Down on the Farm');

-- ── Arc B: hook pool (self-contained, non-linear) ───────────────────────────

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 10. Dinner and a Show',
$pg$Location: The Kitchen. NPCs: Lincoln Sawyer, Mitch Kosinski, Milo Cantwell and followers.

Setup. A normal Kitchen dinner (bread and stew) that turns tense.

Trigger. About 15 minutes in, discordant singing and instruments rise from the crowd's edge - Milo and his followers, unsettling the diners. Lincoln, Mitch, and a few deputies go to speak with Milo; the group retreats.

Check. Manipulation to learn more about Milo. Locals recall the split when Father Donalds renamed the church and Milo broke away.

Outcome. The PCs become aware of the Milo / town faction tension, which pays off in Scene 17.

Drop-in scaling. Social; any size.

Links. Leads to Scene 17 (First Church mediation).$pg$,
false, 110
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 10. Dinner and a Show');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 11. Scavenger Run (M&M Machining)',
$pg$Location: Nate's Auto Shop, then the road to Morris OK (40 miles, ~3 hours). NPCs: Nate Landry, Johnson Walker. Foes: Desperate Survivor (x3), Territorial Raider (x5).

Setup. The crew helps Nate and Johnson retrieve machining parts for the bullet-production project: brass sheets, lead ingots, a press die set, a powder measure, lathe parts, primer cups and anvils, rolling mills.

Sub-encounters (run in sequence).
1) Harmony Bridge, blocked road - a fresh vehicle roadblock. Group Physicality (-3 CMod) to clear. They feel watched.
2) Fuel trouble - the ethanol truck sputters (loose radiator pipe). Detour to scavenge a part from a similar truck or a dilapidated gas station.
3) Hostile encounter - 3 Desperate Survivors ambush for the truck. Fight, negotiate, or flee.
4) Arrival at M&M - the shop is partly looted, no power. Scavenging check to find the parts.
5) The Lathe - Nate wants it. Mechanic or Tinkerer to disassemble and move it (rig a pulley or find a generator).
6) Confrontation - 5 Territorial Raiders (shotgun, pistol, melee) claim the territory and want the truck. Load fast and escape, or deal with them.
7) Breakdowns - the truck fails on the return (weight or damage). Repair under pressure before nightfall or be locked out until dawn.
8) Nightfall - reduced visibility; a possibly-friendly group of survivors; navigate the final leg.

Tactical map. Combat-heavy. Build a tactical map (grid ~20x15, cell 35px) with uploaded art for the ambush (3) and the confrontation (6) when you run it.

Outcome. They return (hopefully) with the parts; injuries, extra supplies, or new enemies depending on their choices. Success advances the town's ammunition capacity.

Drop-in scaling. A full session's adventure; trim sub-encounters for a smaller or shorter table.

Links. Feeds Scene 12 (Sulphur) and the bullet-factory arc.$pg$,
false, 111
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 11. Scavenger Run (M&M Machining)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 12. Sulphur (Vinita Mines)',
$pg$Location: Nate's Auto Shop, then the mines at Vinita. NPCs: Gio Leone, Johnson Walker, Morgan Lieu (offscreen), Marty (falling ill).

Setup. At the morning rotation, Gio requests help retrieving sulfur from the Vinita mines (for primers and powder). Wesley mentions that Marty, from the shit-truck detail, caught a bad parasitic infection from handling waste without cleaning up, and has spread it to others who are worsening.

Beats. Morgan has foragers out for wormwood and garlic but is unsure it will work. The crew hauls sulfur while the infection thread simmers in the background.

Checks. Scavenging or Physicality for the sulfur haul. A Medicine-minded PC may start connecting the outbreak to Marty.

Plot. This is the outbreak's midpoint - Marty leads to Scene 21 (Medical Crisis).

Tactical. Optional - the mine can be a hazard or light-combat map if you want one.

Drop-in scaling. Any size.

Links. Follows the Marty thread from Scene 7; leads to Scene 21.$pg$,
false, 112
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 12. Sulphur (Vinita Mines)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 13. Echoes of the Past (the Vault)',
$pg$Location: The Vault. NPCs: Nate Landry, Wesley Spencer.

Setup. A strange shortwave radio signal begins transmitting from the Vault, a secured store of relics and records. Beneath it lies a forgotten Cold War fallout shelter.

Trigger. The PCs investigate the signal.

Beats. Old tech - a battery shortwave transmitter (inexplicably on), damaged record-keeping computers, manuals and maps of nearby military sites and bunkers. A hidden tunnel leads to the fallout shelter: rusted gear, gas masks, water filters, a low-power generator (restorable as backup power for the Mile), and a degraded Emergency Broadcast link.

Challenges. The decaying tunnel (navigate carefully) and pockets of radiation.

Decisions. Use or destroy the tech? Restore the bunker or leave it? Balance the benefit against the risk.

Checks. Research / Tinkerer / Mechanic to interpret and restore; Athletics to navigate the collapse.

Drop-in scaling. Exploration; solo-friendly with Nate as support.

Links. Standalone; the generator can improve town infrastructure.$pg$,
false, 113
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 13. Echoes of the Past (the Vault)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 14. Loose Threads (the Bike Clinic)',
$pg$Location: The Bike Clinic. NPCs: Emma Hernandez, Johnson Walker, Nate Landry.

Setup. A scavenger crew brings back a batch of bikes needing repair; parts and time must be allocated wisely.

Trigger. The PCs work with the mechanics to fix or repurpose the bikes.

Checks. Mechanics or Tinkerer to repair; Barter to decide whose bike gets fixed first.

Drop-in scaling. Low-stakes; a good downtime scene; any size.

Links. Standalone.$pg$,
false, 114
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 14. Loose Threads (the Bike Clinic)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 15. Into the Wild (the Watchtowers)',
$pg$Location: The Watchtowers. NPCs: George Meeker, deputies, Lincoln Sawyer. Foes: reuse the Territorial Raider set.

Setup. The PCs pull a watchtower shift and spot something suspicious beyond the perimeter.

Trigger. They investigate the disturbance - a scout, an ambush, or an opportunity.

Checks. Perception to read the threat; Ranged Combat if it turns to a fight.

Tactical map. Build a perimeter / approach map (grid ~20x15, cell 35px) with uploaded art if it goes loud.

Outcome. They head off a threat, gather intel, or seize an opportunity depending on how they read it.

Drop-in scaling. Scale the foe count; solo works with an NPC deputy.

Links. George recurs from Scene 1; tonal sibling to Scene 20 (Night Watch).$pg$,
false, 115
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 15. Into the Wild (the Watchtowers)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 16. Market Mayhem (the Farmer''s Market)',
$pg$Location: The Farmer's Market. NPCs: Tom Orchard, Jemimah Sawyer, various traders.

Setup. A fight breaks out in the market over a trade dispute.

Trigger. The PCs must resolve it before it escalates.

Checks. Manipulation to de-escalate; Unarmed or Melee Combat if they wade in; Barter to broker a settlement.

Outcome. De-escalate or pick a side - either shifts their standing with the traders.

Tactical. Optional crowd / stalls map if it turns physical.

Drop-in scaling. Social-first; any size.

Links. Standalone; affects market reputation.$pg$,
false, 116
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 16. Market Mayhem (the Farmer''s Market)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 17. First Church of the District',
$pg$Location: The First Church. NPCs: Father Donalds, Milo Cantwell, Lincoln Sawyer.

Setup. Father Donalds asks the PCs to help mediate between the First Church and Milo's breakaway faction (the Church of Christ).

Trigger. They navigate the tension between the two camps.

Checks. Manipulation or Inspiration to mediate; Psychology to read Milo's real aims.

Outcome. Their choices ease or worsen the schism (ties back to Scene 10).

Drop-in scaling. Roleplay-heavy; solo-friendly.

Links. Follows the thread seeded in Scene 10.$pg$,
false, 117
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 17. First Church of the District');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 18. Fuel for the Fire (the Refinery)',
$pg$Location: The Refinery. NPCs: David Battersby, Gio Leone, scavenger crews.

Setup. David needs feedstock and fuel for ethanol production to keep the town running.

Trigger. The PCs help secure or produce the fuel.

Checks. Scavenging or Driving to source it; Mechanic to keep the volatile refinery running.

Outcome. Tough calls about allocation; success keeps the lights and vehicles going.

Drop-in scaling. Any size.

Links. Standalone infrastructure hook.$pg$,
false, 118
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 18. Fuel for the Fire (the Refinery)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 19. Seeds of Discord (the College)',
$pg$Location: The College. NPCs: David Battersby, Wesley Spencer, Carol Philips, farmers.

Setup. Someone is sabotaging the college's agricultural experiments.

Trigger. The PCs investigate.

Checks. Research, Streetwise, or Perception to uncover the saboteur; then a justice decision.

Outcome. They expose the culprit and live with the consequences of how they handle it.

Drop-in scaling. Investigation; solo-friendly.

Links. Standalone.$pg$,
false, 119
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 19. Seeds of Discord (the College)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 20. Night Watch',
$pg$Location: The Entrances and Watchtowers. NPCs: George Meeker, Wesley Spencer, Lincoln Sawyer, newcomers.

Setup. Strangers approach the gate at night seeking refuge.

Trigger. The PCs must decide whether to trust them or turn them away.

Checks. First Impressions or Psychology to read the strangers' intent.

Outcome. A moral call with community consequences either way.

Drop-in scaling. Tense roleplay; any size.

Links. George recurs; tonal sibling to Scene 15.$pg$,
false, 120
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 20. Night Watch');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 21. Medical Crisis (Dr Zee''s Clinic)',
$pg$Location: Dr Zee's Clinic. NPCs: Morgan Lieu, Nana Welch, Wesley Spencer.

Setup. An illness sweeps the Mile - the parasite Marty spread (Scenes 7 and 12), now an outbreak. The clinic is named for the late Dr Zee, the town's original doctor; Morgan Lieu, his vet-tech successor, runs it, and it is too soon for anyone to rename it after her.

Trigger. The PCs help control the outbreak and trace its source.

Checks. Medicine to treat; Research or Streetwise to trace it back to the shit-truck detail and Marty; Scavenging or Survival to gather wormwood and garlic.

Outcome. Contain the spread and identify the source; success saves lives and settles the thread.

Drop-in scaling. Any size; a medic PC shines here.

Links. Follows the Marty thread from Scenes 7 and 12. Use the GM infection controls to drive the sickness mechanically.$pg$,
false, 121
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 21. Medical Crisis (Dr Zee''s Clinic)');

INSERT INTO public.campaign_notes (campaign_id, title, content, shared, sort_order)
SELECT '6dd8611b-62ef-4810-b998-b9c5682d0a62', 'PtC 22. Supply Run Gone Wrong',
$pg$Location: Nate's Auto Shop, then the field. NPCs: Johnson Walker, Nate Landry, scavenger crews. Foes: reuse the raider set.

Setup. A scavenging crew has gone missing.

Trigger. The PCs are sent to find them.

Checks. Survival or Navigation to track; Scavenging to recover supplies; combat if the cause is hostile.

Outcome. Save the crew or recover what they can; consequences ripple through the town's supply.

Tactical map. Build an ambush / rescue map (grid ~20x15, cell 35px) with uploaded art if it comes to a fight.

Drop-in scaling. Scale the threat; a full-session hook.

Links. Standalone; reuses the Desperate Survivor / Territorial Raider statblocks.$pg$,
false, 122
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_notes WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND title='PtC 22. Supply Run Gone Wrong');
