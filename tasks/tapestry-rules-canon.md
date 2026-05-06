# Tapestry Rules Canon — XSE SRD v1.1.17

**Source of truth**: `lib/xse-schema.ts` and `app/rules/*` pages on TheTapestry platform.
**Generated**: 2026-05-06.
**Regenerate**: `npx tsx scripts/export-canon.ts > tasks/tapestry-rules-canon.md`

This file is the platform's canonical reference for rules content. Every term, formula,
table value, and skill/profession/paradigm name in this document comes verbatim from the
platform's source code. **Nothing in this file is invented or inferred — every line is sourced.**

## Precedence rule

When auditing or rewriting rules content (e.g. the Distemper Quickstart):

> **Tapestry > SRD > Quickstart > Core Rulebook**

If a term, table entry, or skill name appears in the Quickstart or CRB but is **not** in this
canon file, it should be deleted from the Quickstart, not preserved. If something is in the
SRD or this canon file but missing from the Quickstart, it should be added. Never invent new terms.

## §02 Core Mechanics

### Dice Check format

> 2d6 + Attribute Modifier (AMod) + Skill Modifier (SMod) + Conditional Modifier (CMod)

Total of 9 or above is a Success.

### Insight Dice

Source: `app/rules/core-mechanics/insight-dice/page.tsx`.

Characters get **2 Insight Dice on creation** and gain an additional one each time they roll a Moment of Insight (double-1 or double-6). Common uses:

- Roll an extra d6 prior to the Dice Check (3d6 total).
- Add a +3 CMod to the Dice Check before rolling.
- After a Dice Check, drop one or both dice and replace each with an Insight Die rolled fresh.
- Spend Insight Dice for a flashback, retcon, or anything else the player can Make The Case for.
- Spend an Insight Die to introduce a story element (with GM approval and a successful Make The Case).
- Spend ALL available Insight Dice to recover **1 Wound Point + 1 Resilience Point per die surrendered** and save the character from Death.

Restrictions: Insight Dice are non-transferable, cannot transfer between characters, and **cannot re-roll a Moment of Low Insight**. They carry over from session to session.

### Group Check

Source: `app/rules/core-mechanics/attribute-checks/page.tsx`.

Multiple players attempting the same task can pool their abilities. Everyone must be using the same attribute or skill (even if they have 0). The player with the highest relevant AMod or SMod makes the check and applies any AMods or SMods from the other characters taking part. **Insight Dice cannot be spent as part of a Group Check**, but if the outcome is a Moment of Insight, all participants receive an Insight Die.

### Opposed Check

Source: `app/rules/core-mechanics/attribute-checks/page.tsx`.

The outcome is determined by the first side to roll a Success, Wild Success, or Moment of High Insight while the other simultaneously rolls a Failure, Dire Failure, or Moment of Low Insight. If both sides roll the same outcome tier, the result is negated and play continues until a clear winner emerges.

### Perception Check

A player who wants to know if their character notices subtle details makes a Perception Check using the secondary stat **Perception (RSN + ACU AMod)** as a modifier.

### First Impressions

Source: `app/rules/core-mechanics/first-impressions/page.tsx`.

Uses **Influence + an appropriate skill (Manipulation, Streetwise, Psychology\*, etc.)**. Outcome ladder: Wild Success (14+) → +1 CMod; Moment of High Insight (6+6) → +2 CMod + Insight Die; Success (9–13) → 0; Failure (4–8) → -1 CMod; Dire Failure (0–3) → -2 CMod; Moment of Low Insight (1+1) → -3 CMod + Insight Die.

### Gut Instincts

Uses the **Perception modifier**, or an appropriate skill (Psychology\*, Streetwise, Tactics\*).

### Outcomes (Table 1)

Source: `lib/xse-schema.ts` OUTCOMES array.

| Total | Outcome |
| --- | --- |
| 0-3 | Dire Failure |
| 4-8 | Failure |
| 9-13 | Success |
| 14+ | Wild Success |
| 1+1 | Moment of Low Insight |
| 6+6 | Moment of High Insight |

A Moment of Low Insight counts as a Dire Failure AND grants an Insight Die.
A Moment of High Insight counts as a Wild Success AND grants an Insight Die.

### Modifier ranges and labels

#### Attribute Modifier (AMod) — Table 2

Source: `lib/xse-schema.ts` ATTRIBUTE_LABELS. Range -2 to +4 for player characters; +5 reserved for animals and machines.

| Mod | Label |
| --- | --- |
| -2 | Diminished |
| -1 | Weak |
| 0 | Average |
| +1 | Good |
| +2 | Strong |
| +3 | Exceptional |
| +4 | Human Peak |
| +5 | Superhuman *(animals/machines only)* |

#### Skill Modifier (SMod) — Table 3

Source: `lib/xse-schema.ts` SKILL_LABELS. Range -3 to +4. Starting characters cap at +3 (Professional). Vocational skills (marked `*`) start at -3 (Inept) instead of 0 (Untrained); the first level taken jumps from -3 directly to +1 (Beginner).

| Mod | Label |
| --- | --- |
| -3 | Inept |
| 0 | Untrained |
| +1 | Beginner |
| +2 | Journeyman |
| +3 | Professional |
| +4 | Life's Work |

#### Conditional Modifier (CMod) — Table 4

Source: `app/rules/core-mechanics/modifiers/page.tsx`. (Hard-coded in script — keep in sync with that page if the labels change.)

| Mod | Label |
| --- | --- |
| -5 | Doomed To Fail |
| -4 | Insurmountable |
| -3 | Hard |
| -2 | Difficult |
| -1 | Challenging |
| 0 | Average |
| +1 | Simple |
| +2 | Slight Favor |
| +3 | Easy |
| +4 | Trivial |
| +5 | Divinely Inspired |

## §03 Character Overview
### Skills (Table 9) — 29 canonical skills

Source: `lib/xse-schema.ts` SKILLS.

| Skill | Attribute | Vocational | Description |
| --- | --- | --- | --- |
| Animal Handling | INF | – | Understanding how to work with animals, from basic obedience to herd management |
| Athletics | PHY | – | Fitness, agility, stamina, and coordination, including climbing, jumping, swimming, and overcoming obstacles |
| Barter | INF | – | Arranging deals, enticing buyers, appraising goods, haggling for the best outcome, and closing deals |
| Demolitions* | PHY | ✓ | The manufacture and use of explosives, ranging from improvised charges to precision military demolitions |
| Driving | DEX | – | Drive any vehicle with confidence and finesse, this allows for reckless maneuvers without wrecking |
| Entertainment | INF | – | The charisma and talent to captivate an audience through music, song, acting, comedy, storytelling, or other form of performance |
| Farming | ACU | – | Knowing how to grow crops or raise livestock at scale to sustain large groups of people |
| Gambling | ACU | – | The understanding of underlying mechanics behind games of chance, risk, and reward, and the confidence of knowing when to bet or fold |
| Heavy Weapons* | PHY | ✓ | The operation of complex, large-scale battlefield weapons like machine guns, launchers, and artillery |
| Inspiration | INF | – | Being able to boost the morale of individuals or groups or motivate them behind a shared vision or belief |
| Lock-Picking* | ACU | ✓ | Bypassing locks and security devices to open them without keys or codes |
| Manipulation | INF | – | Getting others to think, believe, or act in ways that they may not have otherwise done |
| Mechanic* | RSN | ✓ | Diagnose, repair, maintain, or build complex machines, tools, vehicles, and systems |
| Medicine* | RSN | ✓ | Providing first aid, diagnosis, treatment, emergency stabilization and advanced medical care to the injured or ill |
| Melee Combat | PHY | – | Training with melee weapons to improve close-quarters precision, accuracy and damage |
| Navigation | ACU | – | Innately able to discern directions, remember routes, and plot accurate courses |
| Psychology* | RSN | ✓ | Leveraging an understanding of human behavior to influence, predict, exploit, or manipulate outcomes |
| Ranged Combat | DEX | – | Accurately and safely using projectile weapons, ranging from thrown objects to sniper rifles |
| Research | RSN | – | Being able to efficiently organize, distill, and absorb information to quickly become well informed on any subject |
| Scavenging | ACU | – | Finding and evaluating missed, hidden, or discarded items that still have use for survival or trade |
| Sleight of Hand | DEX | – | Well practiced in performing sleight-of-hand tricks, palming, pickpocketing, concealment, and creating subtle diversions |
| Specific Knowledge | RSN | – | Knowledge about the history, layout, and secrets of a specific area, community, person, or discipline |
| Stealth | PHY | – | Avoid notice, moving unseen, sticking to the shadows, and avoiding detection |
| Streetwise | ACU | – | Instinctively being able to navigate urban environments, read situations for danger, and identify underworld resources |
| Survival | ACU | – | Knowing how to survive in the wild, live off the land, and track people or animals |
| Tactics* | RSN | ✓ | The application of battlefield or interpersonal strategies in order to gain a situational advantage or upper hand |
| Tinkerer | DEX | – | Being adept at fixing, modifying, or improving machines, gear, or weapons as well as the ability to improvise inventions |
| Unarmed Combat | PHY | – | Knowledge and practice of grappling, fist fight, bare fists or martial arts, and body control |
| Weaponsmith* | DEX | ✓ | Crafting, repairing, and modifying weapons to ensure reliability and effectiveness |

### Secondary Stats (Table 5)

Source: `lib/xse-schema.ts` deriveSecondaryStats. These are the ground-truth formulas.

| Stat | Abbrev | Formula |
|---|---|---|
| Wound Points | WP | 10 + PHY AMod + DEX AMod |
| Resilience Points | RP | 6 + PHY AMod |
| Melee Defense Mod | MDM | PHY AMod |
| Ranged Defense Mod | RDM | DEX AMod |
| Initiative Mod | INIT | ACU AMod + DEX AMod |
| Encumbrance | ENC | 6 + PHY AMod |
| Perception | PER | RSN AMod + ACU AMod |
| Stress Modifier | SM | RSN AMod + ACU AMod |
| Morality | MOR | starts at 3 |

**Stress Level**: separate tracker, 0 to 5. Rises by 1 on a failed Stress Check or when entering 0 WP / 0 RP. At 5, the character hits their Breaking Point.

## §04 Character Creation
### Backstory steps

Source: `lib/xse-schema.ts` BACKSTORY_STEPS. Total: **20 CDP** (5 attribute + 15 skill).

| Step | Title | Attr CDP | Skill CDP | Max attr | Max skill |
| --- | --- | --- | --- | --- | --- |
| 0 | Step Zero: Who Are They? | 0 | 0 | – | – |
| 1 | Step One: Where They Grew Up | 1 | 2 | 1 | 2 |
| 2 | Step Two: What They Learned | 1 | 3 | 1 | 2 |
| 3 | Step Three: What They Like To Do | 1 | 3 | 1 | 2 |
| 4 | Step Four: How They Make Money | 2 | 4 | 3 | 3 |
| 5 | Step Five: What Makes Them Them | 0 | 3 | 3 | 3 |
| 6 | Step Six: What Drives Them? | 0 | 0 | 3 | 3 |

**Step Four** is the Profession step — pick a Profession from the table above, allocate 4 skill CDP to that Profession's bundle.
**Step Six** is Complications & Motivations — choose or roll 2d6.

### Complications (Table 6)

Source: `lib/xse-schema.ts` COMPLICATIONS.

| 2d6 | Complication |
| --- | --- |
| 2 | Addiction |
| 3 | Betrayed |
| 4 | Code of Honor |
| 5 | Criminal Past |
| 6 | Daredevil |
| 7 | Dark Secret |
| 8 | Family Obligation |
| 9 | Famous |
| 10 | Loss |
| 11 | Outstanding Debt |
| 12 | Personal Enemy |

### Motivations (Table 7)

Source: `lib/xse-schema.ts` MOTIVATIONS.

| 2d6 | Motivation |
| --- | --- |
| 2 | Accumulate |
| 3 | Build |
| 4 | Find Safety |
| 5 | Hedonism |
| 6 | Make Amends |
| 7 | Preach |
| 8 | Protect |
| 9 | Reunite |
| 10 | Revenge |
| 11 | Stay Alive |
| 12 | Take Advantage |

### Professions (Table 8) — 12 canonical professions, 5 skills each

Source: `lib/xse-schema.ts` PROFESSIONS.

| Profession | Skills |
| --- | --- |
| Academic | Mechanic*, Psychology*, Research, Specific Knowledge, Tactics* |
| Driver | Animal Handling, Driving, Lock-Picking*, Mechanic*, Navigation |
| Entrepreneur | Barter, Gambling, Inspiration, Manipulation, Research |
| Law Enforcement | Athletics, Ranged Combat, Streetwise, Survival, Tactics* |
| Mechanic | Barter, Demolitions*, Mechanic*, Scavenging, Tinkerer |
| Medic | Manipulation, Medicine*, Psychology*, Research, Sleight of Hand |
| Military | Demolitions*, Heavy Weapons*, Ranged Combat, Tactics*, Unarmed Combat |
| Outdoorsman | Animal Handling, Navigation, Ranged Combat, Stealth, Survival |
| Outlaw | Gambling, Lock-Picking*, Sleight of Hand, Stealth, Streetwise |
| Performer | Athletics, Entertainment, Inspiration, Manipulation, Specific Knowledge |
| Politician | Inspiration, Manipulation, Psychology*, Streetwise, Tactics* |
| Trader | Barter, Scavenging, Sleight of Hand, Specific Knowledge, Tinkerer |

### Paradigms — 12 canonical paradigms

Source: `lib/xse-schema.ts` PARADIGMS. The platform has exactly 12 Paradigms, one per Profession.

| Paradigm | Profession | RAPID (R-A-P-I-D) |
| --- | --- | --- |
| School Teacher | Academic | 3-1-0-1-0 |
| Biker | Driver | 0-2-1-0-2 |
| Bar Owner | Entrepreneur | 1-2-1-1-0 |
| Rural Sheriff | Law Enforcement | 0-2-0-2-1 |
| Hot Rod Mechanic | Mechanic | 1-1-1-0-2 |
| EMT | Medic | 2-1-0-1-1 |
| Farmer | Outdoorsman | 0-2-2-0-1 |
| Petty Criminal | Outlaw | 0-1-1-1-2 |
| Mercenary | Military | 0-1-2-0-2 |
| Preacher | Performer | 1-1-0-3-0 |
| Small Town Mayor | Politician | 2-1-0-2-0 |
| Antiques Dealer | Trader | 1-2-0-2-0 |

#### School Teacher (Academic)
**RAPID**: 3-1-0-1-0 (R-A-P-I-D).
**Skills**: Entertainment 2, Inspiration 2, Medicine* 2, Research 2, Athletics 1, Barter 1, Manipulation 1, Psychology* 1, Specific Knowledge 1, Stealth 1, Tinkerer 1.
**Weapons**: Light Pistol (primary), Kitchen Knife (secondary).
**Equipment**: Compass, Binoculars.
#### Biker (Driver)
**RAPID**: 0-2-1-0-2 (R-A-P-I-D).
**Skills**: Driving 2, Barter 1, Demolitions* 1, Lock-Picking* 1, Manipulation 1, Mechanic* 1, Melee Combat 1, Navigation 1, Scavenging 1, Stealth 1, Survival 1, Tactics* 1, Tinkerer 1, Unarmed Combat 1.
**Weapons**: Heavy Pistol (primary), Tactical Baton (secondary).
**Equipment**: Bicycle Repair Kit, Compass.
#### Bar Owner (Entrepreneur)
**RAPID**: 1-2-1-1-0 (R-A-P-I-D).
**Skills**: Barter 2, Manipulation 2, Athletics 1, Entertainment 1, Gambling 1, Inspiration 1, Medicine* 1, Psychology* 1, Scavenging 1, Sleight of Hand 1, Specific Knowledge 1, Tinkerer 1, Unarmed Combat 1.
**Weapons**: Light Pistol (primary), Baseball Bat (secondary).
**Equipment**: Basic Survival Kit, Walkie-Talkies.
#### Rural Sheriff (Law Enforcement)
**RAPID**: 0-2-0-2-1 (R-A-P-I-D).
**Skills**: Tactics* 2, Manipulation 2, Animal Handling 1, Barter 1, Inspiration 1, Lock-Picking* 1, Navigation 1, Psychology* 1, Ranged Combat 1, Scavenging 1, Sleight of Hand 1, Stealth 1, Unarmed Combat 1.
**Weapons**: Hunting Rifle (primary), Tactical Baton (secondary).
**Equipment**: Binoculars, First Aid Kit.
#### Hot Rod Mechanic (Mechanic)
**RAPID**: 1-1-1-0-2 (R-A-P-I-D).
**Skills**: Mechanic* 3, Barter 2, Demolitions* 2, Driving 1, Lock-Picking* 1, Melee Combat 1, Navigation 1, Scavenging 1, Specific Knowledge 1, Tinkerer 2.
**Weapons**: Heavy Pistol (primary), Sledgehammer (secondary).
**Equipment**: Workman's Toolkit, Weapons Toolkit.
#### EMT (Medic)
**RAPID**: 2-1-0-1-1 (R-A-P-I-D).
**Skills**: Athletics 2, Medicine* 2, Psychology* 2, Driving 1, Inspiration 1, Manipulation 1, Navigation 1, Research 1, Scavenging 1, Sleight of Hand 1, Specific Knowledge 1, Streetwise 1.
**Weapons**: Light Pistol (primary), Kitchen Knife (secondary).
**Equipment**: Doctor's Bag, First Aid Kit.
#### Farmer (Outdoorsman)
**RAPID**: 0-2-2-0-1 (R-A-P-I-D).
**Skills**: Farming 3, Scavenging 2, Stealth 2, Survival 2, Animal Handling 1, Athletics 1, Navigation 1, Ranged Combat 1, Tinkerer 1.
**Weapons**: Hunting Rifle (primary), Wood Axe (secondary).
**Equipment**: Basic Survival Kit, Compass.
#### Petty Criminal (Outlaw)
**RAPID**: 0-1-1-1-2 (R-A-P-I-D).
**Skills**: Lock-Picking* 2, Manipulation 2, Scavenging 2, Sleight of Hand 2, Streetwise 2, Barter 1, Melee Combat 1, Stealth 1, Survival 1, Unarmed Combat 1.
**Weapons**: Shotgun (Sawed-Off) (primary), Brass Knuckles (secondary).
**Equipment**: Crowbar, Bolt Cutters.
#### Mercenary (Military)
**RAPID**: 0-1-2-0-2 (R-A-P-I-D).
**Skills**: Survival 3, Stealth 2, Tactics* 2, Athletics 1, Demolitions* 1, Heavy Weapons* 1, Melee Combat 1, Ranged Combat 1, Tinkerer 1, Unarmed Combat 1, Weaponsmith* 1.
**Weapons**: Carbine (primary), Hatchet (secondary).
**Equipment**: Basic Survival Kit, Walkie-Talkies.
#### Preacher (Performer)
**RAPID**: 1-1-0-3-0 (R-A-P-I-D).
**Skills**: Inspiration 3, Barter 2, Manipulation 2, Psychology* 2, Entertainment 1, Ranged Combat 1, Research 1, Specific Knowledge 1, Stealth 1, Tactics* 1.
**Weapons**: Light Pistol (primary), Staff (secondary).
**Equipment**: Walkie-Talkies, First Aid Kit.
#### Small Town Mayor (Politician)
**RAPID**: 2-1-0-2-0 (R-A-P-I-D).
**Skills**: Inspiration 3, Manipulation 3, Psychology* 2, Streetwise 2, Tactics* 2, Barter 1, Entertainment 1, Research 1.
**Weapons**: Heavy Pistol (primary), Baseball Bat (secondary).
**Equipment**: Walkie-Talkies, First Aid Kit.
#### Antiques Dealer (Trader)
**RAPID**: 1-2-0-2-0 (R-A-P-I-D).
**Skills**: Barter 3, Manipulation 2, Entertainment 1, Tinkerer 2, Psychology* 1, Research 1, Scavenging 1, Sleight of Hand 1, Specific Knowledge 1, Stealth 1, Survival 1.
**Weapons**: Crossbow (primary), Hatchet (secondary).
**Equipment**: Backpack, Bolt Cutters.

## §06 Combat

### Combat Rounds

Combat rounds last approximately **3–6 seconds**. Each round has three phases: **Initiative**, **Action**, **Recovery**.

### Initiative

Each participant rolls **2d6 + Initiative Mod (ACU + DEX)**. Highest goes first. Ties between PCs and NPCs go to the PC; ties between PCs act simultaneously. In subsequent rounds, any participant who was neither attacked nor attacked anyone else gets a **+1** on their next Initiative check.

### Get The Drop

Before combat starts, one character can preemptively Get The Drop and take a single combat action before anyone else rolls for initiative. If multiple characters attempt it, the one with the highest combined **DEX + ACU AMods** wins. Any character who Got The Drop incurs a **−2 CMod** on their next Initiative roll.

### Combat Actions (Table 10) — 17 canonical actions

Source: `app/rules/combat/combat-rounds/page.tsx`. Each character gets **2 Combat Actions per round**.

| Action | Cost | Effect |
|---|---|---|
| Aim | 1 | +2 CMod on the next Attack this round; lost if anything but Attack is taken next. |
| Attack | 1 | Roll Unarmed, Ranged, or Melee Combat. Damage on success. |
| Charge | 2 | Move + a melee/unarmed attack with a +1 CMod. |
| Coordinate | 1 | Tactics* check; allies in Close get +2 CMod vs target. On Wild Success, allies also get +1 CMod on their attack. |
| Cover Fire | 1 | Expend ammo to suppress an attacker. Subjects take −2 CMod on their next attack, dodge, or move. |
| Defend | 1 | +2 to MDM/RDM against the next attack on this character. Cleared after one hit. |
| Distract | 1 | Steal 1 Combat Action from a target via an Opposed Check. On Wild Success, steal 2 actions. |
| Fire from Cover | 2 | Attack from cover; keep the cover's defensive bonus. |
| Grapple | 1 | Opposed Physicality + Unarmed Combat. Winner restrains or takes 1 RP from the loser. |
| Inspire | 1 | Grant +1 Combat Action to an ally. Once per round. |
| Move | 1 | Move up to 1 Range Band per Move action. |
| Rapid Fire | 2 | Two shots from a Ranged Weapon. −1 CMod on first, −3 CMod on second. As a single Combat Action: −2 first / −4 second. |
| Ready Weapon | 1 | Switch, reload, or unjam a weapon. |
| Reposition | 1 | End-of-round positioning move. |
| Sprint | 2 | Move 2 bands. Athletics check on completion or become Winded (1 action next round). |
| Subdue | 1 | Non-lethal attack — full RP damage but only 50% WP damage. |
| Take Cover | 1 | +2 Defensive Modifier against all attacks until the character takes an active combat action. |

### Range Bands (Table 11)

Source: `app/rules/combat/range/page.tsx`.

| Value | Band | Tactical | Modifiers / notes |
|---|---|---|---|
| 1 | Engaged | ≤ 5 ft | +1 CMod on Melee, −1 CMod on Ranged. All Unarmed combat at Engaged. |
| 2 | Close | ≤ 30 ft | Whites of their eyes. Melee at Close gets −1 CMod. Pistols and grenades best. |
| 3 | Medium | ≤ 100 ft | No modifiers to any attack. Carbines and bows are perfect. |
| 4 | Long | ≤ 300 ft | −5 CMod to a pistol shot, +1 CMod to a rifle shot. |
| 5 | Distant | ≤ 1000 ft | Radio equipment needed. Hunting rifle with scope or sniper's rifle required. |

**Movement between bands**: takes the same number of combat rounds as the sum of the band values being covered. Engaged → Close: 3 rounds. Engaged → Medium: 6. Engaged → Long: 10. Engaged → Distant: 15.

### Damage

Each attack deals **Wound Points (WP)** and **Resilience Points (RP)** damage. RP damage = 50% of WP damage rounded down for most weapons; concussive/blunt-force weapons (fists, batons, grenades) often do equal RP and WP damage (marked "100% RP"). Melee and Unarmed attacks add the user's **Physicality AMod** to damage. Bare-fisted damage is **1d3 + PHY AMod + Unarmed Combat SMod**.

### Incapacitation, Mortally Wounded, Stabilise, Death

- **RP = 0**: Incapacitated for **4 − PHY AMod** rounds (min 1). Recover 1 RP on waking, +1 RP per round if not in combat.
- **WP = 0**: Mortally Wounded. Die in **4 + PHY AMod** rounds unless Stabilised.
- **Stabilise**: Successful **Medicine\*** check, OR Wild Success on Reason. Once Stabilised, Incapacitated for **16 − PHY AMod** rounds (min 1), then 1 WP + 1 RP.
- **Death**: prevented only by spending ALL Insight Dice — character lives with 1 WP + 1 RP per die surrendered.
- **Healing**: never-MW heal 1 WP/day; was-MW heal 1 WP/2 days; resting recovers 1 RP/hour.

### Stress & Breaking Point

Stress starts at 0, max 5. Rises by 1 on a failed Stress Check (2d6 + RSN + ACU AMod) or when entering 0 WP / 0 RP (Tapestry house rule). At 5, roll 2d6 on Table 13 — reaction lasts 1d6 rounds, then Stress resets to 0. **Cooling Off**: Stress drops by 1 per 8 uninterrupted in-game hours free from combat/conflict/threat doing something the character enjoys.

### Lasting Wounds (Table 12)

Source: `lib/xse-schema.ts` LASTING_WOUNDS.

A character who is Mortally Wounded must make a Physicality check to avoid taking 1 Lasting Wound. On failure, roll 2d6 on Table 12. **Lasting Wounds are permanent** and cannot be healed.

| 2d6 | Wound | Effect |
| --- | --- | --- |
| 2 | Lost Eye | -1 on checks using Dexterity |
| 3 | Brain Injury | -2 Reason |
| 4 | Diminished | -1 Dexterity |
| 5 | Shaken | -1 Max. Resilience Points |
| 6 | Weakened | -1 Max. Wound Points |
| 7 | Skittish | -1 Initiative Modifier |
| 8 | Scarring | -1 Influence |
| 9 | Fragile | -1 Physicality |
| 10 | Hearing Loss | -1 Acumen |
| 11 | Crippled | -1 Perception & -1 Acumen |
| 12 | Shell Shock | -2 Dexterity |

### Breaking Point (Table 13)

Source: `lib/xse-schema.ts` BREAKING_POINT.

When Stress Level reaches 5, roll 2d6 on Table 13. The reaction lasts **1d6 rounds**. Once resolved, Stress Level resets to 0.

| 2d6 | Reaction | Effect (during 1d6 rounds) |
| --- | --- | --- |
| 2 | Catatonia | -1 on Dexterity checks |
| 3 | Compulsive Fixation | -2 Reason |
| 4 | Blind Rage | -1 Dexterity |
| 5 | Dissociation | -1 Maximum RP |
| 6 | Overwhelm | -1 Max. Wound Points |
| 7 | Panic Surge | -1 Initiative Modifier |
| 8 | Fatalism | -1 Influence |
| 9 | Reckless Abandon | -1 Physicality |
| 10 | Self-Harm | -1 Acumen |
| 11 | Self-Destructive Urges | -1 Per -1 Acu |
| 12 | Irrational Outburst | -2 Dexterity |

## §07 Weapons & Equipment
### Melee Weapons (Table 16) — 17 canonical melee weapons

Source: `lib/xse-schema.ts` MELEE_WEAPONS. Format: `name | skill | range | rarity | damage | RP% | enc | traits`.

- Baseball Bat | Melee | Engaged | Common | 4+1d6 | 100% | 1 | –
- Brass Knuckles | Unarmed | Engaged | Uncommon | 1 | 100% | 0 | –
- Bullwhip | Athletics | Close | Uncommon | 1+1d3 | 100% | 1 | Unwieldy(2)
- Club | Melee | Engaged | Common | 5+1d6 | 100% | 2 | Cumbersome(1)
- Fire Axe | Melee | Close | Uncommon | 3+2d3 | 50% | 1 | –
- Hatchet | Melee | Engaged | Common | 3+1d3 | 50% | 1 | –
- Hunting Knife | Melee | Engaged | Common | 2+2d3 | 50% | 1 | Unwieldy(1)
- Kitchen Knife | Melee | Engaged | Common | 2+1d3 | 50% | 1 | –
- Machete | Melee | Close | Uncommon | 3+2d3 | 50% | 1 | Unwieldy(2)
- Makeshift Club | Melee | Engaged | Common | 3+1d3 | 100% | 1 | –
- Sledgehammer | Melee | Engaged | Uncommon | 3+3d3 | 100% | 2 | Cumbersome(2)
- Spear | Melee | Close | Uncommon | 2+2d6 | 50% | 1 | Cumbersome(2)
- Staff | Melee | Close | Common | 2+2d3 | 100% | 1 | Unwieldy(1)
- Sword | Melee | Engaged | Uncommon | 3+3d3 | 50% | 1 | –
- Tactical Baton | Melee | Engaged | Uncommon | 4+2d3 | 100% | 1 | –
- Cattle Prod | Melee | Engaged | Uncommon | 2 | 400% | 1 | Stunned
- Wood Axe | Melee | Close | Uncommon | 5+1d3 | 50% | 1 | Cumbersome(1)

### Ranged Weapons (Table 17) — 14 canonical ranged weapons

Source: `lib/xse-schema.ts` RANGED_WEAPONS.

- Automatic Rifle | Long | Uncommon | 5+2d6 | 50% | 2 | ammo Uncommon, clip 30 | Automatic Burst(3)
- Black Powder Rifle | Long | Uncommon | 5+1d6 | 50% | 2 | ammo Uncommon, clip 1 | –
- Bow | Medium | Common | 4+1d6 | 50% | 1 | ammo Common, clip 1 | Tracking
- Carbine | Long | Uncommon | 5+1d6 | 50% | 1 | ammo Uncommon, clip 30 | Automatic Burst
- Compound Bow | Medium | Common | 4+2d3 | 50% | 2 | ammo Common, clip 1 | Tracking
- Crossbow | Medium | Uncommon | 4+1d6 | 50% | 2 | ammo Uncommon, clip 1 | Unwieldy(1)
- Heavy Pistol | Medium | Common | 3+2d3 | 50% | 1 | ammo Uncommon, clip 9 | –
- Hunting Rifle | Long | Common | 5+1d6 | 50% | 2 | ammo Uncommon, clip 12 | –
- Light Pistol | Close | Common | 3+1d6 | 50% | 1 | ammo Common, clip 6 | –
- Shotgun (Pump-Action) | Medium | Common | 5+2d6 | 50% | 2 | ammo Common, clip 5 | Close-Up
- Shotgun (Sawed-Off) | Close | Uncommon | 2+3d6 | 50% | 2 | ammo Common, clip 2 | Close-Up
- Slingshot | Close | Common | 1+1d3 | 100% | 0 | ammo Common, clip 1 | Tracking
- Sniper's Rifle | Distant | Rare | 2+3d6 | 50% | 2 | ammo Uncommon, clip 10 | –
- Taser | Close | Uncommon | 1 | 400% | 1 | ammo Rare, clip 1 | Stunned

### Equipment (Table 20) — 34 canonical equipment items

Source: `lib/xse-schema.ts` EQUIPMENT.

Angler's Set, Backpack, Basic Survival Kit, Bicycle Repair Kit, Bolt Cutters, Binoculars, Canteen, Climbing Gear, Compass, Crowbar, Doctor's Bag, Fire-starting Kit, First Aid Kit, Fishing Kit, Flashbang, Flashlight, Grappling Hook, Handcuffs, Instant Camera, Lantern, Military Backpack, Multitool, Night Vision Goggles, Radio Scanner, Rope, Shovel, Survivalists Kit, Standard Lockpicks, Criminal Lockpicks, Hunting Traps, Toolkit, Walkie-Talkies, Weapons Toolkit, Workman's Toolkit.

## What's NOT on the platform

Things the Distemper Quickstart historically referenced but **do not exist** on the platform — these should be deleted from any Quickstart audit.

**Skills that don't exist** (with platform replacement):

- Intimidation → Manipulation (or Psychology\* if reading/exploiting)
- Hunting → Survival (tracking) or Ranged Combat (shooting)
- First Aid → Medicine\*
- Surgery\* → Medicine\*
- Pharmacology\* → Medicine\*
- Vehicle Repair\* → Mechanic\*
- Armorsmith\* → Mechanic\*
- General Knowledge → Specific Knowledge

**Mechanics that don't exist**:

- Panic Threshold (replaced by Stress / Stress Modifier / Breaking Point)

**Paradigms that don't exist** (on the platform):

- Beat Cop, Cosmetic Surgeon, Family Doctor, Flea Market Trader, Semi-Pro Athlete, Trucker.
- "Mayor" was renamed to **Small Town Mayor**.

**Skills the Quickstart's inner-cover mentions for First Impressions / Negotiations that aren't on platform**: Charm, Deception, Perception (Perception is a Secondary Stat, not a skill).
