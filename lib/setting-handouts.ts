// Seed handout data for campaign GM notes

export interface HandoutSeed {
  title: string
  content: string
}

export const EMPTY_HANDOUTS: HandoutSeed[] = [
  {
    title: 'Empty — Session Zero',
    content: `WHAT THE PLAYERS KNOW
Read or paraphrase the following to the group before play begins:

"It has been almost a year since you first heard of the dog flu. You are all friends, family, or acquaintances of David Battersby and have been waiting the pandemic out on his farm. Your efforts in pulling together as a small group of survivors attempting to be self-sufficient have worked so far — you have all had enough to eat and, minor frustrations aside, no one has come to blows.

But one of the tractors recently broke and needs an arc welder to be repaired. David believes there is a garage nearby that might have one and, as none of you have left the farm in nearly two months, you all jumped at a chance to go. A few of you take his truck and leave after breakfast.

This is the first time anyone has ventured off the farm in months and the drive was a sobering experience. The complete lack of life reminds you how absolute the devastation of the dog flu has been. Someone suggested stopping at empty houses along the way to see if there was anything worth scavenging, but one house was enough to starkly remind the group of the horrors recently inflicted upon the world and you kept on moving.

There is another 25 somber minutes of driving through a couple of small towns and down some country roads before you see the gas station that David mentioned lies ahead."

---

FILLING IN THE GAPS
Ask each player to tell the group at least one detail about what their character saw on the drive. Prompts:
- Did they see abandoned cars?
- Were buildings intact or damaged?
- Were any burned out shells?
- Did things look looted or eerily normal?
- Were there remains of the dead?
- Were any lights on in buildings?
- Did they see any stores worth stopping at on the way back?

---

WHAT THE GM KNOWS ABOUT THE GAS STATION
The station was owned by Errol and Martina Stansfield for almost 15 years. In addition to fuel and the general store, Errol had a tow truck and a well-equipped workshop. The two lived quietly and happily until dying at home in excruciating pain within days of each other. Due to the low local population and the secluded nature of the station, it has remained untouched. The general store is largely intact but most contents are expired or rotten.

Inside is Becky, late 20s. She and Dylan, early 30s, arrived late the previous night and slept on the pull-out couch in the breakroom. Dylan went hunting that morning and will return shortly after the players encounter Becky. Dylan used more ammunition than intended while hunting and has only 3 bullets left when he returns. More ammo is in Becky's bag on the counter. They also have a shotgun in their truck with 2 shells.`,
  },
]

export const MONGRELS_HANDOUTS: HandoutSeed[] = [
  {
    title: 'Mongrels — Session Zero',
    content: `WHAT THE PLAYERS KNOW
Read or paraphrase the following to the group before play begins:

"It has been 1,075 days since the first recorded death from the Dog Flu. Three years. You are part of a small group of survivors living on a compound at Hells Hole Spring in the Sonoran Desert east of Phoenix. The compound belongs to Frank Wallace — Frankie — who has kept eleven people alive through a combination of competence, stubbornness, and a methanol still he built from scratch.

The desert is running out of patience. Canyon Lake — the nearest reliable water source — is controlled by a warlord called Kincaid, who has been pressuring Frankie to convert his vehicles to methanol. Frankie has been making excuses. He is out of excuses.

Frankie has a plan he has told almost no one about: Bozeman, Montana. His family's farm. More water, more land, more distance from men like Kincaid. He has given the compound 48 hours to get ready. You are in the barn, working on a 2015 Winnebago called Minnie, getting her ready to leave before dawn."

---

FILLING IN THE GAPS
Ask each player to tell the group:
- How long they have been at the compound
- How they know Frankie — family, friend, hired hand, ex-military, or stranger who showed up
- What they were doing before the Dog Flu
- One thing they are bringing with them that has no practical value

---

GM NOTES
This is a placeholder handout. Expand it with your own session zero content, safety tools, and table expectations before play.`,
  },
  {
    title: 'Minnie — Vehicle Sheet',
    content: `MINNIE — 2015 WINNEBAGO MINNIE WINNIE (CLASS C RV)

TYPE: Recreational Vehicle
SIZE: 5 | SPEED: 2 | RARITY: Common
WOUND POINTS: 67 (16 Stress)
PASSENGERS: 10 | ENCUMBRANCE: 05
RANGE: 660 (231 on ethanol / 132 on methanol)

Describe Minnie in 3 words: CRAMPED AND NOISY

---

MODIFICATIONS
- Methanol still integrated into rear cargo area
  - Can only operate when vehicle is stopped (50% fire/explosion chance if moving: 1-3 on 1d6)
  - 1 day gathering + 1 day distilling = 2 days of fuel (requires Tinkerer or Mechanic* check)
  - Storage tanks in bodywork hold up to 4 days of fuel
- Sniper's nest on roof between AC units — fitted sniper rifle, fires forward in 90-degree arc
- Reinforced door and window frames — not bulletproof but deflects low-calibre rounds at distance
- Hand-painted name on both sides: MINNIE, with a crude dog paw print

---

WEAPONS & EQUIPMENT MANIFEST
Automatic Rifles (x4) — 300 rounds each
Heavy Pistols (x6) — 90 rounds each
Light Pistols (x10) — 90 rounds each
Hunting Rifles (x2) — 50 rounds each
Shotguns (x4) — 40 rounds each
Sniper Rifle (x1, fitted) — 150 rounds
Tactical Batons (x6)
Hunting Knives (x10)
Grenades (x20)
Flash-bang Grenades (x20)
Tasers (x3)
Bows (x2) — 60 arrows
Tactical Vests (x6) — -3 DMR/DMM
Tactical Helmets (x6) — -1 DMR/DMM
Tactical Shields (x2) — -1 DMR/DMM
Binoculars (x4)
First Aid Kits (x6)
Toolkit (x1)
Mechanic's Toolkit (x1)
Walkie-Talkies (x12)
Angler's Kits (x10)

---

FUEL RULES
- Minnie runs on methanol. Range per tank: 132 miles.
- Fuel cycle: 1 Gather day (Scavenging/ACU) + 1 Brew day (Mechanic*/RSN or Tinkerer/DEX) = 1 full tank.
- Departs with 2 tanks banked. Maximum storage: 4 tanks.
- Still cannot operate while moving. If it does: roll 1d6, on 1-3 it catches fire, on 4-6 it continues. Uncontrolled fire explodes in 1d6 rounds.`,
  },
  {
    title: 'The Route — Hells Hole Spring to Bozeman',
    content: `THE ROUTE: 1,115 MILES | 37 DAYS MINIMUM
13 driving days + 24 production days (13 gather + 13 brew)

ZONE 1 — ARIZONA: THE ESCAPE (Days 1-12)
Tones: Threat & Violence, Grief & Loss

Day  1  DRIVE   Hells Hole Spring -> Payson, AZ         85 mi
Day  2  GATHER  Payson, AZ
Day  3  BREW    Payson, AZ
Day  4  DRIVE   Payson -> Flagstaff, AZ                 95 mi
Day  5  GATHER  Flagstaff, AZ
Day  6  BREW    Flagstaff, AZ
Day  7  DRIVE   Flagstaff -> Cameron, AZ                50 mi
Day  8  GATHER  Cameron, AZ
Day  9  BREW    Cameron, AZ
Day 10  DRIVE   Cameron -> Page, AZ                     85 mi
Day 11  GATHER  Page, AZ
Day 12  BREW    Page, AZ

ZONE 2 — SOUTHERN UTAH: LDS COUNTRY (Days 13-21)
Tones: Community & Survival, Moral Dilemmas, The Weird & Unsettling

Day 13  DRIVE   Page -> Kanab, UT                       75 mi
Day 14  GATHER  Kanab, UT
Day 15  BREW    Kanab, UT
Day 16  DRIVE   Kanab -> Cedar City, UT                  80 mi
Day 17  GATHER  Cedar City, UT
Day 18  BREW    Cedar City, UT
Day 19  DRIVE   Cedar City -> Holden, UT                 90 mi
Day 20  GATHER  Holden, UT
Day 21  BREW    Holden, UT

ZONE 3 — CENTRAL UTAH CORRIDOR (Days 22-27)
Tones: Hope, Community & Survival, Grief & Loss

Day 22  DRIVE   Holden -> Provo -> Salt Lake City, UT   115 mi
Day 23  GATHER  Salt Lake City, UT
Day 24  BREW    Salt Lake City, UT
Day 25  DRIVE   Salt Lake City -> Logan, UT              80 mi
Day 26  GATHER  Logan, UT
Day 27  BREW    Logan, UT

ZONE 4 — IDAHO: THE OPEN COUNTRY (Days 28-33)
Tones: Threat & Violence, Grief & Loss, Hope

Day 28  DRIVE   Logan -> Pocatello, ID                  115 mi
Day 29  GATHER  Pocatello, ID
Day 30  BREW    Pocatello, ID
Day 31  DRIVE   Pocatello -> Idaho Falls, ID             50 mi
Day 32  GATHER  Idaho Falls, ID
Day 33  BREW    Idaho Falls, ID

ZONE 5 — MONTANA: THE END OF THE ROAD (Days 34-37)
Tones: Hope, Grief & Loss, Community & Survival

Day 34  DRIVE   Idaho Falls -> Dillon, MT               130 mi
Day 35  GATHER  Dillon, MT
Day 36  BREW    Dillon, MT
Day 37  DRIVE   Dillon -> Bozeman, MT                    65 mi

---

CHECK STRUCTURE (All Days)
- DRIVE days: Driving (DEX) check
- GATHER days: Scavenging (ACU) check
- BREW days: Mechanic* (RSN) or Tinkerer (DEX) check

Outcome tiers: Wild Success | Success | Failure | Dire Failure

Every deviation — failed check, set piece, storm — adds days to the journey.`,
  },
]

export const SETTING_HANDOUTS: Record<string, HandoutSeed[]> = {
  empty: EMPTY_HANDOUTS,
  mongrels: MONGRELS_HANDOUTS,
}
