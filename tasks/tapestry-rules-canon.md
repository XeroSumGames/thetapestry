# Tapestry Rules Canon - XSE SRD v1.1.17

**Source of truth**: `lib/xse-schema.ts` and `app/rules/*` pages on TheTapestry platform.
**Generated**: 2026-06-30.
**Regenerate**: `npx tsx scripts/export-canon.ts > tasks/tapestry-rules-canon.md`

This file is the platform's canonical reference for rules content. Every term, formula,
table value, and skill/profession/paradigm name in this document comes verbatim from the
platform's source code. **Nothing in this file is invented or inferred - every line is sourced.**

## Precedence rule

When auditing or rewriting rules content (Quickstart, SRD, or Core Rulebook):

> **Tapestry (this canon) > Quickstart > SRD > Core Rulebook**

Goal of any audit pass: Quickstart, SRD, and Core Rulebook all match the canon in this file.

If a term, table entry, or skill name appears in the Quickstart, SRD, or CRB but is **not** in
this canon file, it should be deleted from those documents, not preserved. If something is in
this canon file but missing from a document being audited, it should be added. Never invent new terms.

## §01 Overview › In-World Time

Source: `app/rules/overview/in-world-time/page.tsx`.

The Distemper world has a shared canonical calendar anchored to the first recorded H724 (Dog Flu / Distemper) death on **March 2nd, Year 0**. This is canon_day 0 - the zero point for all calendar math.

**Year 0 is the pandemic year itself.** The outbreak begins, spreads through Year 0, and by the end of Year 0 the world is in collapse. **Year 1** is the first year after the pandemic. **Year 2** is the second year after. And so on. The year numbers shown in-game are **always implicit** ("Year N", no Gregorian year shown) - the world plays out in real time relative to platform launch.

**Pre-pandemic prologue.** January and February of Year 0 (~60 days before the first recorded death) are playable for campaigns set in the run-up to the outbreak. These days have **negative canon_day** values: January 1, Year 0 = canon_day -60.

**Campaign Sheet clock display.** Every campaign tracks both its current in-world clock and the canon_day it started on. The Campaign Sheet header shows three pieces of time:

- **Campaign Day N** - days since the campaign started (Day 1 on the first day).
- **<time>, <month> <day_ordinal>, Year M** - the wall-clock equivalent (e.g. "6 PM, September 15th, Year 1").
- **X days after the first recorded death** - the canon_day value, for situating the campaign on the universal timeline.

Module authors can stamp a canonical start date on their module (`modules.start_canon_day`); any campaign cloned from that module opens on that in-world day automatically. GMs can edit the clock + start date directly from the Campaign Sheet at any time.

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
- Spend ALL available Insight Dice to recover **1 Wound Point + 1 Resilience Point total** (flat, regardless of how many dice were surrendered) and save the character from Death.
- Stave off death by **Subsistence Damage** (starvation/dehydration) by surrendering Insight Dice - each die buys one additional day before WP loss begins.

Restrictions: Insight Dice are non-transferable, cannot transfer between characters, and **cannot re-roll a Moment of Low Insight**. They carry over from session to session.

### Group Check

Source: `app/rules/core-mechanics/attribute-checks/page.tsx`.

Multiple players attempting the same task can pool their abilities. Everyone must be using the same attribute or skill (even if they have 0). The player with the highest relevant AMod or SMod makes the check and applies any AMods or SMods from the other characters taking part. **Insight Dice cannot be spent as part of a Group Check**, but if the outcome is a Moment of Insight, all participants receive an Insight Die.

### Opposed Check

Source: `app/rules/core-mechanics/attribute-checks/page.tsx`.

The outcome is determined by the first side to roll a Success, Wild Success, or Moment of High Insight while the other simultaneously rolls a Failure, Dire Failure, or Moment of Low Insight. If both sides roll the same outcome tier, the result is negated and play continues until a clear winner emerges.

### Coordinated Effort

Source: `app/rules/core-mechanics/coordinated-effort/page.tsx`.

A chain of skill checks where multiple PCs work together on a sequence of actions toward a shared goal. Any player can initiate, pick participants, and pick the skill they themselves will roll first (Tactics\*, Manipulation, Mechanic\*, Perception, or any other skill that fits the opening action). The first roll's outcome becomes the **lead CMod** that propagates to every subsequent roll in the chain. Each participant rolls whatever skill suits their part of the plan; the same participant can roll multiple times. Only the FIRST roll's outcome propagates - later helper outcomes don't stack further. Every roll gets **+1 CMod per OTHER participant** plus the lead CMod.

| First-roll outcome | Lead CMod | Effect on chain |
|---|---|---|
| Moment of High Insight (6+6) | +3 | Chain at +3; first roller earns a personal Insight Die. |
| Wild Success (14+) | +2 | All subsequent rolls +2. |
| Success (9-13) | +1 | All subsequent rolls +1. |
| Failure (4-8) | -1 | Chain continues at -1. |
| Dire Failure (0-3) | -3 | Chain continues at -3, heavily penalized. |
| Moment of Low Insight (1+1) | - | **Chain collapses immediately.** First roller still earns an Insight Die per canon. |

Asymmetry is intentional - bad lead rolls cascade hard, and Low Insight aborts the entire effort. Chain ends on goal achievement, opt-out by any participant, narrative impossibility, or LI on the lead.

**Insight Dice during a Coordinated Effort:** any participant can spend an Insight Die on their own roll (3d6 keep all 3 or +3 CMod), and any participant who rolls HI or LI personally earns +1 Insight Die regardless of the overall outcome.

**In combat:** each roll consumes 1 combat action from the roller; the chain resolves on the initiator's turn (initiative pauses until the chain ends or someone opts out). Out of combat, rolls are free.

### Perception Check

A player who wants to know if their character notices subtle details makes a Perception Check using the secondary stat **Perception (RSN + ACU AMod)** as a modifier.

### First Impressions

Source: `app/rules/core-mechanics/first-impressions/page.tsx`.

Uses **Influence + an appropriate skill (Manipulation, Streetwise, Psychology\*, etc.)**. Outcome ladder: Wild Success (14+) → +1 CMod; Moment of High Insight (6+6) → +2 CMod + Insight Die; Success (9-13) → 0; Failure (4-8) → -1 CMod; Dire Failure (0-3) → -2 CMod; Moment of Low Insight (1+1) → -3 CMod + Insight Die.

### Gut Instincts

Uses the **Perception modifier**, or an appropriate skill (Psychology\*, Streetwise, Tactics\*).

### Negotiations

Source: `app/rules/core-mechanics/negotiations/page.tsx`.

Negotiations are an Opposed Check resolved through **Gambit** and **Rebuttal**. Used for haggling, demands, threats, or persuasion.

**Gambit**: rolled by the side leading the negotiation. Formula: `2d6 + Influence AMod + skill SMod`. Skill choice: **Barter**, **Inspiration**, **Manipulation**, or **Psychology\***.

| Gambit outcome | Effect on Rebuttal |
|---|---|
| Wild Success (14+) | Other side gets −3 CMod on their Rebuttal |
| Success (9-13) | Other side gets −1 CMod on their Rebuttal |
| Failure (4-8) | Other side gets +1 CMod on their Rebuttal |
| Dire Failure (0-3) | Negotiation is over. Possibly hostile. |

**Rebuttal**: rolled by the responding side. Formula: `2d6 + Acumen AMod + skill SMod`. Skill choice: **Barter**, **Inspiration**, **Manipulation**, **Psychology\***, or **Tactics\***.

| Rebuttal outcome | Effect |
|---|---|
| Wild Success (14+) | Compelling counteroffer; other side very likely to consider |
| Success (9-13) | Counter met favourably; deal can be reached |
| Failure (4-8) | Cannot present a cogent counterargument; impasse |
| Dire Failure (0-3) | Negotiation immediately over; situation could turn hostile |

**Retry rule**: a failed Negotiation cannot be retried until the situation materially changes (different terms, new information, shifted leverage).

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

#### Attribute Modifier (AMod) - Table 2

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

#### Skill Modifier (SMod) - Table 3

Source: `lib/xse-schema.ts` SKILL_LABELS. Range -3 to +4. Starting characters cap at +3 (Professional). Vocational skills (marked `*`) start at -3 (Inept) instead of 0 (Untrained); the first level taken jumps from -3 directly to +1 (Beginner).

| Mod | Label |
| --- | --- |
| -3 | Inept |
| 0 | Untrained |
| +1 | Beginner |
| +2 | Journeyman |
| +3 | Professional |
| +4 | Life's Work |

#### Conditional Modifier (CMod) - Table 4

Source: `app/rules/core-mechanics/modifiers/page.tsx`. (Hard-coded in script - keep in sync with that page if the labels change.)

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
### Skills (Table 9) - 29 canonical skills

Source: `lib/xse-schema.ts` SKILLS.

| Skill | Attribute | Vocational | Description |
| --- | --- | --- | --- |
| Animal Handling | INF | - | Understanding how to work with animals, from basic obedience to herd management |
| Athletics | PHY | - | Fitness, agility, stamina, and coordination, including climbing, jumping, swimming, and overcoming obstacles |
| Barter | INF | - | Arranging deals, enticing buyers, appraising goods, haggling for the best outcome, and closing deals |
| Demolitions* | PHY | ✓ | The manufacture and use of explosives, ranging from improvised charges to precision military demolitions |
| Driving | DEX | - | Drive any vehicle with confidence and finesse, this allows for reckless maneuvers without wrecking |
| Entertainment | INF | - | The charisma and talent to captivate an audience through music, song, acting, comedy, storytelling, or other form of performance |
| Farming | ACU | - | Knowing how to grow crops or raise livestock at scale to sustain large groups of people |
| Gambling | ACU | - | The understanding of underlying mechanics behind games of chance, risk, and reward, and the confidence of knowing when to bet or fold |
| Heavy Weapons* | PHY | ✓ | The operation of complex, large-scale battlefield weapons like machine guns, launchers, and artillery |
| Inspiration | INF | - | Being able to boost the morale of individuals or groups or motivate them behind a shared vision or belief |
| Lock-Picking* | ACU | ✓ | Bypassing locks and security devices to open them without keys or codes |
| Manipulation | INF | - | Getting others to think, believe, or act in ways that they may not have otherwise done |
| Mechanic* | RSN | ✓ | Diagnose, repair, maintain, or build complex machines, tools, vehicles, and systems |
| Medicine* | RSN | ✓ | Providing first aid, diagnosis, treatment, emergency stabilization and advanced medical care to the injured or ill |
| Melee Combat | PHY | - | Training with melee weapons to improve close-quarters precision, accuracy and damage |
| Navigation | ACU | - | Innately able to discern directions, remember routes, and plot accurate courses |
| Psychology* | RSN | ✓ | Leveraging an understanding of human behavior to influence, predict, exploit, or manipulate outcomes |
| Ranged Combat | DEX | - | Accurately and safely using projectile weapons, ranging from thrown objects to sniper rifles |
| Research | RSN | - | Being able to efficiently organize, distill, and absorb information to quickly become well informed on any subject |
| Scavenging | ACU | - | Finding and evaluating missed, hidden, or discarded items that still have use for survival or trade |
| Sleight of Hand | DEX | - | Well practiced in performing sleight-of-hand tricks, palming, pickpocketing, concealment, and creating subtle diversions |
| Specific Knowledge | RSN | - | Knowledge about the history, layout, and secrets of a specific area, community, person, or discipline |
| Stealth | PHY | - | Avoid notice, moving unseen, sticking to the shadows, and avoiding detection |
| Streetwise | ACU | - | Instinctively being able to navigate urban environments, read situations for danger, and identify underworld resources |
| Survival | ACU | - | Knowing how to survive in the wild, live off the land, and track people or animals |
| Tactics* | RSN | ✓ | The application of battlefield or interpersonal strategies in order to gain a situational advantage or upper hand |
| Tinkerer | DEX | - | Being adept at fixing, modifying, or improving machines, gear, or weapons as well as the ability to improvise inventions |
| Unarmed Combat | PHY | - | Knowledge and practice of grappling, fist fight, bare fists or martial arts, and body control |
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

**Encumbrance (over-limit rule)**: ENC limit = 6 + PHY AMod (+2 if carrying a Backpack / Military Backpack). A character can carry right up to their limit with no penalty. The moment they EXCEED it: their movement speed drops by half, and they take **1 RP damage per hour for each point they are over the limit** (3 over = 3 RP/hour, not 1) until they drop weight or rest. If this drives them to 0 RP they become Incapacitated - they regain consciousness + 1 RP within moments, but must then rest for four hours to recover half their RP before carrying on. Dropping enough gear to get back within the limit stops the RP damage immediately. (Canon restored 2026-05-20 - the rule was dropped between manuscript versions; see `tasks/rules-extract-encumbrance-2026-05-20.md`.)

## §04 Character Creation
### Backstory steps

Source: `lib/xse-schema.ts` BACKSTORY_STEPS. Total: **20 CDP** (5 attribute + 15 skill).

| Step | Title | Attr CDP | Skill CDP | Max attr | Max skill |
| --- | --- | --- | --- | --- | --- |
| 0 | Step Zero: Who Are They? | 0 | 0 | - | - |
| 1 | Step One: Where They Grew Up | 1 | 2 | 1 | 2 |
| 2 | Step Two: What They Learned | 1 | 3 | 1 | 2 |
| 3 | Step Three: What They Like To Do | 1 | 3 | 1 | 2 |
| 4 | Step Four: How They Make Money | 2 | 4 | 3 | 3 |
| 5 | Step Five: What Makes Them Them | 0 | 3 | 3 | 3 |
| 6 | Step Six: What Drives Them? | 0 | 0 | 3 | 3 |

**Step Four** is the Profession step - pick a Profession from the table above, allocate 4 skill CDP to that Profession's bundle.
**Step Six** is Complications & Motivations - choose or roll 2d6.

**+4 attribute exception**: at the GM's discretion, with a Fill In The Gaps narrative justification, a player may reassign **2 CDP from skills to a single RAPID attribute** to bring it from +3 (Exceptional) to +4 (Human Peak) at character creation. Represents intense lifelong training at the expense of skill breadth. One reassignment per character.

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
| 8 | Obligation |
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

### Professions (Table 8) - 12 canonical professions, 5 skills each

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

### Paradigms - 12 canonical paradigms

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

### Character Evolution (post-creation CDP costs)

Source: `app/rules/character-creation/character-evolution/page.tsx`.

At the end of each session, the GM has the discretion to award **2+ CDP** that players spend on improving their characters' attributes or skills. CDP saves across sessions. Spending costs use the same ladder as Backstory Generation:

- **Learn a new skill** (Inept or Untrained → Beginner): **1 CDP**
- **Raise a skill** (current + target level CDP):
  - +1 → +2 = **3 CDP**
  - +2 → +3 = **5 CDP**
  - +3 → +4 = **7 CDP**
- **Raise an attribute** (3× the level being raised):
  - +1 → +2 = **6 CDP**
  - +2 → +3 = **9 CDP**
  - +3 → +4 = **12 CDP**

CDP can be spent on a master PC's Apprentice instead of the PC themselves (see §08 → Apprentices).

## §05 Skills - Lv4 Traits & CRB Bonuses

Source: `app/rules/skills/inspiration/page.tsx`, `app/rules/skills/psychology/page.tsx`, `app/rules/communities/crb-additions/page.tsx`.

The platform implements two Lv4 Skill Traits and one per-level Inspiration bonus that show up only in the Communities subsystem:

### Inspiration - +1 SMod per level on Recruitment Checks

For each level in **Inspiration**, a PC gets a +1 SMod on any attempt to get NPCs behind an idea, including any NPC Recruitment Check. This stacks on top of whatever core skill is being used for the recruitment (Barter, Psychology\*, Tactics\*, etc.).

### Inspiration Lv4 - Beacon of Hope

At **Inspiration Level 4 (Life's Work)**, the character adds **+4 to any Community Morale Check** they participate in. They can also make rousing speeches that convince any community they are a part of to risk everything - including their own lives - for the good of the larger group.

### Psychology* Lv4 - Insightful Counselor

At **Psychology\* Level 4 (Life's Work)**, a character who has spent time as part of a community is able to understand them and help the community leaders see what they need. They may add a **+3 CMod** to the community's weekly Morale Check. The bonus is gated on tenure with the community - the character must actually be a member long enough to know its rhythms.

### Psychology* per-level - Stress recovery via Activity Block

Source: `app/rules/skills/psychology/page.tsx`.

A character with at least 1 level in **Psychology\*** can spend a **Daily Activity Block** with another character to help them step back from their Breaking Point. On a successful Psychology\* check, the patient's **Stress Level drops by 1** (minimum 0). One Psychology\* recovery attempt per patient per day.

> **Note**: only Inspiration and Psychology\* currently have Lv4 Traits implemented. Other skills don't unlock additional mechanics at Lv4 beyond the standard +1 SMod.

## §06 Combat

### Combat Rounds

Combat rounds last approximately **3-6 seconds**. Each round has three phases: **Initiative**, **Action**, **Recovery**.

### Initiative

Each participant rolls **2d6 + Initiative Mod (ACU + DEX)**. Highest goes first. Ties between PCs and NPCs go to the PC; ties between PCs act simultaneously. In subsequent rounds, any participant who was neither attacked nor attacked anyone else gets a **+1** on their next Initiative check.

### Get The Drop

Before combat starts, one character can preemptively Get The Drop and take a single combat action before anyone else rolls for initiative. If multiple characters attempt it, the one with the highest combined **DEX + ACU AMods** wins. Any character who Got The Drop incurs a **−2 CMod** on their next Initiative roll.

### Combat Actions (Table 10) - 17 canonical actions

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
| Subdue | 1 | Non-lethal attack - full RP damage but only 50% WP damage. |
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
- **Death**: prevented only by spending ALL Insight Dice - character lives with 1 WP + 1 RP per die surrendered.
- **Healing**: never-MW heal 1 WP/day; was-MW heal 1 WP/2 days; resting recovers 1 RP/hour.

### Healing (Medicine\* check)

Source: `app/rules/combat/healing/page.tsx`.

A successful Medicine\* check on a target at Engaged range queues a pending heal that applies over 24 hours of in-world time: **50% at +12 hours, 50% at +24 hours**. Healer may roll naked or use a First Aid Kit (+1 CMod, heals 1+1d3) or a Doctor's Bag (+2 CMod, heals 1+2d3).

| Outcome | Naked Medicine\* check | First Aid Kit | Doctor's Bag |
|---|---|---|---|
| Wild Success | Medicine\* level + 1 | 1+1d3 + 1 | 1+2d3 + 1 |
| High Insight (6+6) | Medicine\* level + 2 (+ Insight Die) | 1+1d3 + 2 (+ Insight Die) | 1+2d3 + 2 (+ Insight Die) |
| Success | Medicine\* level | 1+1d3 | 1+2d3 |
| Failure | 0 | 0 | 0 |
| Dire Failure | -1 WP to target (immediate) | -1 WP | -1 WP |
| Low Insight (1+1) | Target makes a Wound Infection check (+ Insight Die to healer) | same | same |

**Banking:** total split 50/50 across +12h and +24h checkpoints. Odd totals put the larger half at +24h (heal of 5 → +2 at +12h, +3 at +24h).

**Target queue:** the pending heal lives on the target, not the healer. If the healer dies between the check and the checkpoint, the target still gets the WP.

**Stacking:** multiple successful heals on the same target stack as independent queue rows, each with its own +12h/+24h schedule from its own check time.

**Dire Failure interrupt:** the -1 WP from Dire Failure applies immediately, not over 24h. Mortal-wound flow fires if the target hits 0 WP.

### Weapon Repair (Unjam / Repair)

Source: `app/rules/combat/weapon-repair/page.tsx`.

On a Moment of Low Insight with a weapon, the weapon malfunctions: it's flagged as jammed (firearms) or broken-state (melee) AND its condition degrades by one level. The owner can spend a Ready Weapon action to attempt recovery. Firearms call it **Unjam**; melee weapons call it **Repair** - same mechanic, different verb and skill pool.

**Skill pool** (best of three the roller has access to):

- **Firearms (Unjam):** Tinkerer, Weaponsmith\*, or Ranged Combat.
- **Melee (Repair):** Tinkerer, Weaponsmith\*, or Melee Combat.

| Outcome | Effect |
|---|---|
| Wild Success | Condition improved by 1 level. Jam cleared. |
| High Insight (6+6) | Condition improved by 2 levels. Jam cleared. Insight Die awarded. |
| Success | If condition is Worn or worse, improve by 1 level. Jam cleared. |
| Failure | No change. Jam still in place. |
| Dire Failure | Weapon breaks (condition jumps to Broken). |
| Low Insight (1+1) | Weapon breaks AND the roller takes 1 WP damage. Insight Die awarded. |

Condition ladder (worst → best): Broken → Damaged → Worn → Used → Pristine. A Broken weapon can't be used until repaired past Damaged.

### Stress & Breaking Point

Stress is tracked on a 5-pip bar starting at 0. Three things raise it:

- **Failed Stress Check** (GM-triggered narrative event): roll `2d6 + Stress Modifier (RSN + ACU AMod) + CMod`, standard 9+ Success threshold. Failure → +1 Stress, manually applied by GM or player. The platform does NOT auto-tick on a failed Stress Check; the result broadcasts to the dice feed and the GM judges.
- **Entering 0 WP (Mortally Wounded)**: automatic +1 Stress, no check, no manual tick. Tapestry handles via `character_states.stress` increment.
- **Entering 0 RP (Incapacitated)**: same - automatic +1 Stress.

**Hold It Together save (Pip 5)**: when Stress hits 5, the character makes a last-chance save before Breaking Point fires. Roll `2d6 + RSN AMod + ACU AMod + CMod`. The success threshold is **7 or above** - lower than the standard 9+ Success because this is the cliff edge. On a Success, Stress drops to 4. On a Failure, Stress stays at 5 and the character rolls on Table 13: Breaking Point. The platform pops the Hold It Together modal automatically when Stress transitions from <5 to 5.

**Breaking Point**: roll 2d6 on Table 13 - reaction lasts 1d6 rounds, then Stress resets to 0.

**Cooling Off**: Stress drops by 1 per 8 uninterrupted in-game hours free from combat/conflict/threat doing something the character enjoys.

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

**Compounded wounds**: a character can take Lasting Damage more than once over their career, and the same result can come up again. When that happens, the effects compound - a second roll of Brain Injury stacks the −2 Reason penalty (becoming −4 Reason); rolling Lost Eye twice means the character is blind.

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

### Infection, Sickness & Disease

Source: `app/rules/combat/infection/page.tsx`. Two related but distinct damage-over-time tracks. Both check **Physicality**, both resolve over days, both can end at Lasting Wounds (Table 12).

#### Wound Infection (post-combat)

Once combat ends, any character who took at least one shot/stab/cut wound makes a single **Physicality check** to see if their wounds become infected. One check per character per combat - regardless of how many hits they took.

| Roll | Effect |
|---|---|
| Wild Success / High Insight | No infection. High Insight earns 1 Insight Die. |
| Success | No infection. |
| Failure | Sick for 1d3 days. Lasting Damage risk unless treated. |
| Dire Failure / Low Insight | Sick for 1d6 days. **Automatic** Lasting Damage on Day 0. |

#### Sickness & Disease (environmental)

Characters exposed to particularly toxic conditions (a pit of dead bodies, a sewer wade, contaminated water) may need to make a Physicality check to avoid getting sick. The GM decides when the trigger fires.

If the first check fails, the character makes a **second Physicality check** (Progression Check):

| Progression Check | Effect |
|---|---|
| Wild Success / Success / High Insight | Shake it off. No progression. |
| Failure | Progressively unwell for 1d3 days. On final day, Mortally Wounded. |
| Dire Failure / Low Insight | Progressively unwell for 1d6 days. On final day, Mortally Wounded. |

When a Sickness & Disease countdown reaches Day 0, the character drops to **WP = 0** and enters the standard Mortally Wounded flow.

#### The Sick state

While sick (either branch):

- **−2 CMod** on physical checks: Athletics, Melee Combat, Ranged Combat, Stealth, Survival, Unarmed Combat.
- **RP capped at half-max** (round down). Current RP clamped down if above the cap.
- WP regen still works at 1 WP/day rest. RP regen still works, but half-max is the ceiling until recovery.

When the day counter hits 0, all sick-state penalties clear. Lasting Damage may still apply.

#### Treatment - Medicine\* check

An ally with Medicine\* may attempt to treat a sick character. **One check per sick incident** - not per day.

| Roll | Effect |
|---|---|
| Wild Success | Cuts remaining sick days in half (round up). Clears Lasting Damage risk. |
| High Insight | Wild Success outcome plus 1 Insight Die. |
| Success | Clears Lasting Damage risk. Days unchanged. |
| Failure | No help, no harm. Patient cannot be treated again this incident. |
| Dire Failure | +1 day to remaining sick duration (botched care). |
| Low Insight | Dire Failure outcome plus the medic earns 1 Stress pip plus 1 Insight Die. |

Medic must be at **Engaged** range to treat (matches Stabilise). A Doctor's Bag or First Aid Kit grants its listed bonus to the Medicine\* check.

#### Lasting Damage

On Day 0 of a sick period, if Lasting Damage risk is still set (Failure was rolled and Medicine\* didn't clear it), the character makes a final **Physicality check** to avoid Lasting Damage. Failure rolls 2d6 on Table 12: Lasting Wounds. Dire Failure on the original Infection check skips this step - Lasting Damage applies automatically.

## §07 Weapons & Equipment
### Melee Weapons (Table 16) - 18 canonical melee weapons

Source: `lib/xse-schema.ts` MELEE_WEAPONS. Format: `name | skill | range | rarity | damage | RP% | enc | traits`.

- Baseball Bat | Melee | Engaged | Common | 4+1d6 | 100% | 1 | -
- Brass Knuckles | Unarmed | Engaged | Uncommon | 1 | 100% | 0 | -
- Bullwhip | Athletics | Close | Uncommon | 1+1d3 | 100% | 1 | Unwieldy(2)
- Club | Melee | Engaged | Common | 5+1d6 | 100% | 2 | Cumbersome(1)
- Fire Axe | Melee | Close | Uncommon | 3+2d3 | 50% | 1 | -
- Hatchet | Melee | Engaged | Common | 3+1d3 | 50% | 1 | -
- Hunting Knife | Melee | Engaged | Common | 2+2d3 | 50% | 1 | Unwieldy(1)
- Kitchen Knife | Melee | Engaged | Common | 2+1d3 | 50% | 1 | -
- Machete | Melee | Close | Uncommon | 3+2d3 | 50% | 1 | Unwieldy(2)
- Makeshift Club | Melee | Engaged | Common | 3+1d3 | 100% | 1 | -
- Sledgehammer | Melee | Engaged | Uncommon | 3+3d3 | 100% | 2 | Cumbersome(2)
- Spear | Melee | Close | Uncommon | 2+2d6 | 50% | 1 | Cumbersome(2)
- Staff | Melee | Close | Common | 2+2d3 | 100% | 1 | Unwieldy(1)
- Sword | Melee | Engaged | Uncommon | 3+3d3 | 50% | 1 | -
- Tactical Baton | Melee | Engaged | Uncommon | 4+2d3 | 100% | 1 | -
- Cattle Prod | Melee | Engaged | Uncommon | 1 | 200% | 1 | Stunned
- Stun Gun | Melee | Engaged | Uncommon | 1 | 400% | 1 | Stunned
- Wood Axe | Melee | Close | Uncommon | 5+1d3 | 50% | 1 | Cumbersome(1)

### Ranged Weapons (Table 17) - 14 canonical ranged weapons

Source: `lib/xse-schema.ts` RANGED_WEAPONS.

- Automatic Rifle | Long | Uncommon | 5+2d6 | 50% | 2 | ammo Uncommon, clip 30 | Automatic Burst(3)
- Black Powder Rifle | Long | Uncommon | 5+1d6 | 50% | 2 | ammo Uncommon, clip 1 | -
- Bow | Medium | Common | 4+1d6 | 50% | 1 | ammo Common, clip 1 | Tracking
- Carbine | Long | Uncommon | 5+1d6 | 50% | 1 | ammo Uncommon, clip 30 | Automatic Burst(3)
- Compound Bow | Medium | Common | 4+2d3 | 50% | 2 | ammo Common, clip 1 | Tracking
- Crossbow | Medium | Uncommon | 4+1d6 | 50% | 2 | ammo Uncommon, clip 1 | Unwieldy(1)
- Heavy Pistol | Medium | Common | 3+2d3 | 50% | 1 | ammo Uncommon, clip 9 | -
- Hunting Rifle | Long | Common | 5+1d6 | 50% | 2 | ammo Uncommon, clip 12 | -
- Light Pistol | Close | Common | 3+1d6 | 50% | 1 | ammo Common, clip 6 | -
- Shotgun (Pump-Action) | Medium | Common | 5+2d6 | 50% | 2 | ammo Common, clip 5 | Close-Up
- Shotgun (Sawed-Off) | Close | Uncommon | 2+3d6 | 50% | 2 | ammo Common, clip 2 | Close-Up
- Slingshot | Close | Common | 1+1d3 | 100% | 0 | ammo Common, clip 1 | Tracking
- Sniper's Rifle | Distant | Rare | 2+3d6 | 50% | 2 | ammo Uncommon, clip 10 | -
- Taser | Close | Uncommon | 1 | 600% | 1 | ammo Rare, clip 1 | Stunned

### Equipment (Table 20) - 36 canonical equipment items

Source: `lib/xse-schema.ts` EQUIPMENT.

Angler's Set, Backpack, Basic Survival Kit, Bicycle, Bicycle Repair Kit, Bolt Cutters, Binoculars, Canteen, Climbing Gear, Compass, Crowbar, Doctor's Bag, Fire-starting Kit, First Aid Kit, Fishing Kit, Flashbang, Flashlight, Grappling Hook, Handcuffs, Instant Camera, Lantern, Military Backpack, Multitool, Night Vision Goggles, Radio Scanner, Rope, Shovel, Survivalists Kit, Standard Lockpicks, Criminal Lockpicks, Hunting Traps, Toolkit, Walkie-Talkies, Weapons Toolkit, Workman's Toolkit, 55-Gallon Drum.

### Rations (Quickstart Table 16) - canon

Source: `lib/xse-schema.ts` RATIONS. Locked 2026-05-09. Each ration covers one day of food + water for one character. Default starting allotment is **2 Standard Rations**.

| Ration | Rarity | Enc | Notes |
| --- | --- | --- | --- |
| Standard Rations | Common | 0.5 | 1 day food + water. |
| Luxury Rations | Uncommon | 0.5 | 1 day food + water; consume to drop Stress Level by 1. |
| Military Grade Rations | Rare | 0.25 | Compact, calorie-dense; 1 day food + water. |

## §08 Communities

Source: `app/rules/communities/*`. The Communities subsystem governs how PCs build, maintain, and lose groups of NPC followers.

### Group → Community threshold

PCs working together are a **Group**. Players recruit NPCs to their Group via a Recruitment Check. If a Group grows to a combined total of **13 or more** PCs and NPCs, it becomes a **Community**. Communities require regular Morale Checks; Groups do not.

### Recruitment Check

Source: `app/rules/communities/recruitment/page.tsx`.

A Recruitment Check uses a skill that aligns with the PCs' approach - most commonly **Barter**, **Psychology\***, or **Tactics\***. The First Impression a player made on the NPC applies as a CMod. The Inspiration +1-per-level bonus also applies (see §05 Skill Traits).

The choice of approach sets commitment duration:

| Approach | Basis | Commitment |
|---|---|---|
| Cohort | Shared interest or goal with the PC | Joins until next Morale Check |
| Conscript | Coerced - requires a credible threat | While the coercion holds |
| Convert | Shared belief, ideology, or vision | Probationary through first Morale Check |

#### Cohort outcomes

| Roll | Effect |
|---|---|
| Wild Success (14+) | NPC becomes a Cohort immediately (no probation). |
| Moment of High Insight (6+6) | Same as Wild Success + may take the NPC as Apprentice. |
| Success (9-13) | NPC joins until next Morale Check. |
| Failure (4-8) | Does not join. Retry only if circumstances materially change. |
| Dire Failure (0-3) | No interest in joining. |
| Moment of Low Insight (1+1) | NPC alienated or offended. Possible escalation, including violent rejection. |

#### Conscript outcomes

| Roll | Effect |
|---|---|
| Wild Success (14+) | Joins willingly - fully committed, loyal follower. |
| Moment of High Insight (6+6) | Wild Success + Apprentice option. |
| Success (9-13) | Complies under duress. Will follow orders until next Morale Check. |
| Failure (4-8) | Appears to comply but will attempt to escape at first opportunity. |
| Dire Failure (0-3) | Steadfastly refuses to join. |
| Moment of Low Insight (1+1) | Refuses + hostile or violent response possible. |

#### Convert outcomes

| Roll | Effect |
|---|---|
| Wild Success (14+) | Committed believer and follower. |
| Moment of High Insight (6+6) | Wild Success + Apprentice option. |
| Success (9-13) | Joins as probationary Convert. Commits after first Morale Check passes. |
| Failure (4-8) | No interest. Retry allowed if PCs Fill In The Gaps on a different approach. |
| Dire Failure (0-3) | Becomes wary and distances themselves from the PC. |
| Moment of Low Insight (1+1) | So unwilling to join they may become hostile or violent. |

### Community Structure

Source: `app/rules/communities/structure/page.tsx`.

For a community to function, a certain number of members must be dedicated to specific tasks:

| Role | Minimum | Responsibility | Weekly check |
|---|---|---|---|
| Gatherers | 33% (round down) | Hunt, forage, farm, fish, scavenge - bring in Rations | Fed Check |
| Maintainers | 20% (round down) | Collect Supplies, repair / maintain buildings, equipment, vehicles | Clothed Check |
| Safety | 5-10% | Policing, patrol, firefighting, emergency services. Leadership comes from here. | Drives Morale modifiers only |

#### Fed Check (Gatherers) - feeds next Morale Check as the Fed CMod

| Roll | Effect | CMod |
|---|---|---|
| Moment of High Insight (6+6) | Enough luxury items found to give the community a real boost. | +2 |
| Wild Success (14+) | Rations surplus. | +1 |
| Success (9-13) | Baseline ration needs are met. | 0 |
| Failure (4-8) | Shortfall in Rations leading to only 1 meal a day. | -1 |
| Dire Failure (0-3) | Continuously hungry, sometimes days between Rations. | -2 |
| Moment of Low Insight (1+1) | Food contamination, famine onset. | -3 |

#### Clothed Check (Maintainers) - feeds next Morale Check as the Clothed CMod

| Roll | Effect | CMod |
|---|---|---|
| Moment of High Insight (6+6) | Buildings and equipment in perfect working order; project goes well. | +2 |
| Wild Success (14+) | Adequately repaired, maintained, even improved. | +1 |
| Success (9-13) | All systems, buildings, and equipment adequately maintained. | 0 |
| Failure (4-8) | Minor breakdowns, or a deficit in required Supplies. | -1 |
| Dire Failure (0-3) | Continued breakdowns impacting the community. | -2 |
| Moment of Low Insight (1+1) | Critical infrastructure damaged or destroyed. | -3 |

#### Safety

5-10% of any community is required for policing/patrol/firefighting/emergency services. This group is also where community leadership is drawn from. No weekly Safety check, but staffing affects Morale slots: **Someone To Watch Over Me** swings from -1 (Safety < 5%) to +1 (Safety ≥ 10%), and Safety counts toward **Enough Hands**.

#### PC contribution

Unless explicitly stated, Fed and Clothed Checks are assumed to be performed by NPCs. Players may choose to spend their time contributing and use their own AMods/SMods if they Fill In The Gaps on how they contributed.

### Morale Check

Source: `app/rules/communities/morale/page.tsx`.

Each week, a Community must make a Morale Check to maintain cohesion. Formula:

> **2d6 + leader's AMod + leader's SMod + six modifier slots**

If leadership is co-equal, they make a **Group Check**.

#### Modifier slots

| Slot | Source |
|---|---|
| Mood Around The Campfire | From the previous Morale Check's outcome. If none: 0. |
| Fed | From the weekly Fed Check (Gatherers). |
| Clothed | From the weekly Clothed Check (Maintainers). |
| Enough Hands | +1 if all role minimums met; else -1 per group short, max -3. |
| A Clear Voice | 0 if a clear leader exists; -1 if leaderless. |
| Someone To Watch Over Me | -1 if Safety < 5%; +1 if Safety ≥ 10%; otherwise 0. |
| Adjusted CMods | GM- or player-Filled-In events: raids, miracles, plague, festivals. |

#### Morale outcomes

| Roll | Effect | Next Mood |
|---|---|---|
| Moment of High Insight (6+6) | Belief in leadership and the community is high. | +2 |
| Wild Success (14+) | Morale stays strong or improves. | +1 |
| Success (9-13) | Morale remains steady. | 0 |
| Failure (4-8) | Morale slipping. **25%** of the community will leave unless stopped. | -1 |
| Dire Failure (0-3) | Morale collapses. **50%** of the community leaves. | -2 |
| Moment of Low Insight (1+1) | Infighting and violence. **75%** of the community leaves. | -3 |

#### Dissolution & Retention

After **three consecutive failures**, a community has degraded to the point of immediately and irreconcilably falling apart. A fast-acting leader wishing to retain fragments may make an **immediate Morale Check** using the result of the preceding Morale Check as the Mood Around The Campfire CMod.

### Activity Blocks

Source: `app/rules/communities/structure/page.tsx` (anchor activity-blocks).

When the table jumps between scenes, the GM advances time in **Activity Blocks** - named tiers that frame what a character can credibly accomplish without a scene playing out on screen. Anything narratively appropriate inside one Block can be Filled In The Gaps; anything bigger needs to spend multiple Blocks, or its own scene.

| Block | Duration | Typical scope |
|---|---|---|
| Daily | ~8 hours of focused effort within a single day. | One Psychology* stress-recovery session with another character. A day's labour on a building project. One Medicine* day-tick of treatment. One day's worth of foraging or hunting. |
| Weekly | One in-game week (drives Morale / Fed / Clothed checks). | A community's weekly Morale Check fires; Gatherers and Maintainers resolve their Fed and Clothed Checks; one increment of training an Apprentice in a skill. |
| Monthly | ~4 weeks of in-game time. | Finishing Apprentice skill training (PC can train Apprentice one level in any single skill the PC has, up to PC level - 1, in one Monthly Block). Major construction milestones; long-distance trade-route runs. |
| Seasonal | ~3 months / a quarter of the year. | Long-term community shifts: a hard winter's siege, a growing season's harvest, persistent migration of NPCs, slow-burn faction politics. |

Activity Blocks are the canonical names for time granularity when GMs and players talk about off-screen work. They're not a separate resource that gets spent - they're a shared vocabulary.

### Apprentices

Source: `app/rules/communities/apprentices/page.tsx`.

The Apprentice option is unlocked only by a **Moment of High Insight (6+6)** on a Recruitment Check. A plain Wild Success (total ≥ 14 without matching faces) does NOT unlock Apprentice. A player may also seek out a specific NPC and make a deliberate Recruitment attempt aimed at Apprenticeship - same roll, same threshold, still needs the double-six.

Apprentices can undertake tasks and act as **proxy** for their PC. Each PC may have only **one Apprentice** at a time.

On recruit, the player:

- Names the Apprentice (if they don't already have one).
- Rolls 2d6 on both the Motivation and Complication tables.
- Works with the GM to Fill In The Gaps on background.
- Spends **3 CDP** on RAPID Range Attributes.
- Spends **5 CDP** on skills.
- Picks one setting-appropriate **Paradigm** (Table 8).

Over **1 month of game-time**, the PC can train the Apprentice in any single skill the PC has, up to **(PC skill level − 1)**. So a PC with Barter 3 can train their Apprentice up to Barter 2. If the PC earns CDP later, they may choose to spend those CDP on the Apprentice instead of themselves.

## What's NOT on the platform

Things the Distemper Quickstart historically referenced but **do not exist** on the platform - these should be deleted from any Quickstart audit.

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
