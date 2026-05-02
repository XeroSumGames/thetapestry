# SRD vs Code — divergence audit

**Goal**: list every place where the live Tapestry code does something *different* from what `XSE SRD v1.1.17 (Small).pdf` prints. Per the user's directive on 2026-05-01: **the platform supersedes the SRD**, so this list becomes the changelog for the next SRD revision. The Tapestry SRD pages at `/rules/*` will then be re-authored from the updated PDF.

Sources cross-referenced:
- `docs/Rules/XSE SRD v1.1.17 (Small).pdf` (gitignored, local-only)
- `lib/xse-schema.ts`, `lib/xse-engine.ts`, `lib/cdp-costs.ts`, `lib/weapons.ts`, `lib/range-profiles.ts`, `lib/community-logic.ts`, `lib/help-text.ts`
- `components/CommunityMoraleModal.tsx`, `components/CampaignCommunity.tsx`, `components/TacticalMap.tsx`, `components/CharacterCard.tsx`
- `app/stories/[id]/table/page.tsx` (combat tracker)
- `tasks/rules-extract-{communities,combat,cdp}.md` (canonical extracts already curated)

Severity tags:
- 🔴 **WIRED** — code formula or data; SRD update is mechanical (copy code into prose).
- 🟡 **EXTENDED** — code adds something the SRD doesn't have (new state, new outcome, new mechanic). Decide: bless into SRD, or make it a Distemper/Tapestry-only addition.
- 🟢 **CLARIFIED** — code's wording is more specific than the SRD's vague text. Tighten the SRD to match.
- ⚪ **DOC ONLY** — my `/rules/*` pages have a typo, wrong number, or out-of-date statement. Fix the page, no SRD change.

---

## §02 Core Mechanics

### Outcome ladder
| | Code | SRD | |
|---|---|---|---|
| Dire Failure | ≤ 3 | 0–3 | ✅ match |
| Failure | 4–8 | 4–8 | ✅ match |
| Success | 9–13 | 9–13 | ✅ match |
| Wild Success | ≥ 14 | 14+ | ✅ match |
| Low Insight | 1+1 | 1+1 | ✅ match |
| High Insight | 6+6 | 6+6 | ✅ match |

Source: `lib/roll-helpers.ts:20-33`. No drift.

### Modifier scales
| | Code label set | SRD |
|---|---|---|
| AMod (−2…+5) | Diminished / Weak / Average / Good / Strong / Exceptional / Human Peak / Superhuman | matches |
| SMod (−3, 0…+4) | Inept / Untrained / Beginner / Journeyman / Professional / Life's Work | matches |

Source: `lib/xse-schema.ts:32-54`. ✅ no drift.

### CMod (difficulty) scale
- 🔴 **WIRED**: code does **not** carry a canonical CMod-difficulty label set (no `CMOD_LABELS`). My `/rules/core-mechanics/modifiers#cmod` page reconstructs Doomed To Fail / Insurmountable / Hard / Difficult / Challenging / Average / Simple / Slight Favor / Easy / Trivial / Divinely Inspired from the OCR'd PDF — **none of these names are referenced in code**, so any rename is a free SRD-side decision.

### Insight Dice — usage menu
SRD §02 lists 5 ways to spend an Insight Die:
1. Roll an extra d6 (3d6 total)
2. Add +3 CMod before rolling
3. After roll: drop one or both dice, replace with Insight Die rolled fresh
4. "Anything they can Make The Case for" (flashback, retcon, etc.)
5. Spend ALL ID for 1 WP + 1 RP/die to save from death

🟡 **EXTENDED — code implementation lives in the table page roll modal.** Recommend a specific check on each:
- Bonus die at +3 d6 — present (3d6 mode)
- +3 CMod pre-roll — present (insightCmod path)
- Replace dropped dice — present (drop-and-replace UI)
- Save from death — present (`insightSavePrompt` state in `app/stories/[id]/table/page.tsx`); SRD says "spend all" — code may differ on whether all dice get burned vs partial. **Recommend audit on this specific path.**

🟡 The save-from-death formula in code is **+1 WP + 1 RP per Insight Die spent**, all dice consumed. SRD reads the same. Match. ✅

### Outcomes that grant an Insight Die
SRD only mentions Moments of Insight (1+1, 6+6) granting +1 ID.

🟡 **EXTENDED**: code includes an `Insight Die` award path on `First Impression` (1+1 / 6+6) — that's actually still SRD-canonical (any roll that hits 1+1 or 6+6). No drift. ✅

### Filling In The Gaps / Making The Case
No mechanical implementation in code — both are GM-narrative tools used at the table. ✅ No drift.

### Check types
- `Group Check`: SRD says all participants use the same attr/skill, highest does the roll, others' AMods/SMods stack. Code surfaces this in the Morale Check modal as a "Group Check" branch (`components/CommunityMoraleModal.tsx`). ✅ Match.
- `Opposed Check`: SRD's "first to S/WS/HI vs F/DF/LI wins". Combat attacks USE this implicitly via attacker roll vs defender's MDM/RDM static defense. ✅ Match.
- `Perception Check`: SRD says "use Perception modifier (RSN+ACU)". Code: `secondary.perception = rapid.RSN + rapid.ACU` (`lib/xse-schema.ts:717`). ✅ Match.

### First Impression
SRD outcomes → CMods on future interactions:
| Outcome | CMod |
|---|---|
| Wild Success / High Insight | +1 / +2 |
| Success | 0 |
| Failure | −1 |
| Dire Failure | −2 |
| Low Insight | −3 |

Code stores per-PC×NPC `relationship_cmod` and applies it on future rolls (Recruitment Check most prominently). ✅ Match.

---

## §03 Character Overview

### RAPID order
SRD writes RAPID as `R-A-P-I-D` and the code `xse-schema.ts` matches.
- 🟢 **CLARIFIED**: SRD's prose does NOT define which letter goes first when you read a string like `13201`. Code locks the order: `RSN, ACU, PHY, INF, DEX`. Recommend the SRD adopt this explicit ordering in §03 RAPID.

### Secondary stat formulas
Code (`lib/xse-schema.ts:707-721`):
| Stat | Formula |
|---|---|
| Wound Points | 10 + PHY + DEX |
| Resilience Points | 6 + PHY |
| Melee Defense Mod | PHY |
| Ranged Defense Mod | DEX |
| Initiative | DEX + ACU |
| Encumbrance | 6 + PHY |
| Perception | RSN + ACU |
| Stress Modifier | RSN + ACU |
| Breaking Point | 3 (constant) |

SRD §03 prose (decoded from OCR):
- WP = 10 + PHY + DEX ✅
- RP = 6 + PHY AM ✅
- MDM = "A's P AM" — **OCR-ambiguous**. Code reads it as defender's PHY. SRD prose should be tightened to **"defender's PHY AMod"** explicitly.
- RDM = same ambiguity → code reads defender's DEX. ✅
- INIT = "A + D AM" → ACU + DEX ✅
- ENC = 6 + PHY ✅
- PER = "R + A AM" → RSN + ACU ✅
- Stress = same formula as PER (RSN + ACU) — code matches.
- Breaking Point = "C M 3" → constant 3 ✅

🟢 **CLARIFIED**: Defense Mods (MDM/RDM) need explicit "defender's" qualifier in the SRD prose.

🟡 **EXTENDED**: code also has a `morality: 3` field on `SecondaryStats`. Not in the SRD. Either flag it as a placeholder for a future Morality system, or remove from code.

🟡 **EXTENDED**: NPCs can have a custom `breakingPoint` (e.g. `lib/setting-npcs.ts:730 = 7`, `:748 = 5`). SRD locks BP at 5. Code lets the GM tune it per NPC. Consider blessing this as a Distemper/Tapestry rule: "GM may set NPC Breaking Point higher or lower than 5 to reflect resilience or fragility."

### Three Words
No code-side mechanical implementation — purely narrative. ✅ no drift.

### Complications & Motivations (Tables 6 & 7)
Code (`lib/xse-schema.ts:116-146`) ↔ SRD:
| 2d6 | Complication | Motivation |
|---|---|---|
| 2 | Addiction | Accumulate |
| 3 | Betrayed | Build |
| 4 | Code of Honor | Find Safety |
| 5 | Criminal Past | Hedonism |
| 6 | Daredevil | Make Amends |
| 7 | Dark Secret | Preach |
| 8 | Family Obligation | Protect |
| 9 | Famous | Reunite |
| 10 | Loss | Revenge |
| 11 | Outstanding Debt | Stay Alive |
| 12 | Personal Enemy | Take Advantage |

✅ Match.

---

## §04 Character Creation — **MAJOR DIVERGENCE**

### 🔴 Step ordering REVERSED between code and SRD

Code (`lib/xse-schema.ts:618-626`, 7 spend slots):

| Index | Code title | What's in this step |
|---|---|---|
| 0 | Step Zero: Who Are They? | Concept (no spend) |
| 1 | Step One: Where They Grew Up | 1 attr CDP + 2 skill CDP, max +1 attr / +2 skill |
| 2 | Step Two: What They Learned | 1 attr + 3 skill, max +1 attr / +2 skill |
| 3 | Step Three: What They Like To Do | 1 attr + 3 skill, max +1 attr / +2 skill (hobbies) |
| 4 | **Step Four: How They Make Money** | **2 attr + 4 skill, max +3 attr / +3 skill, profession pick** |
| 5 | Step Five: What Makes Them Them | 3 skill only |
| 6 | **Step Six: What Drives Them?** | **Complication + Motivation pick** |

SRD §04 (per the PDF prose):

| SRD step | SRD title | What's in this step |
|---|---|---|
| X | Who Are You? | Concept |
| One | Where They Grew Up | 1 attr CDP + 2 skill CDP |
| Two | What They Learned | 1 attr + 3 skill |
| Three | What They Like To Do | 1 attr + 3 skill (spare time) |
| **S/Four** | **What Drives Them?** | **Complication + Motivation pick** |
| **F/Five** | **How They Make Money** | **2 attr + 4 skill, profession** |
| F/Six | What Makes Them Tick? | 3 skill only |
| S/Seven | Secondary Stats | computed |
| E/Eight | What They Have | gear pick |
| N | Final Form | review |

**Differences**:
1. **Comp/Mot vs Profession order is swapped.** Code asks for profession in Step 4 (with the big skill spend), then Comp/Mot in Step 6 (last). SRD asks for Comp/Mot in Step 4 (early, no spend), then profession in Step 5.
2. **Code has 7 spend steps; SRD has 9 stages** (X + 8 + N). Code merges/elides Steps 7 (Secondary Stats — auto-computed), 8 (gear — handled in a separate UI flow), and N (final review).
3. **Step titles slightly different**: Code's Step 5 is "What Makes Them Them"; SRD's is "What Makes Them Tick?".

🔴 **Decision needed**: SRD should match the live wizard's order. Recommend updating SRD to:
- **Step Four: How They Make Money** (profession + 2 attr + 4 skill spend)
- **Step Five: What Makes Them Them** (3 skill spend, no attrs — final polish)
- **Step Six: What Drives Them?** (Comp + Mot pick — narrative anchor at the end)

The code's ordering puts CDP-spend stages first, then narrative anchors at the close, which actually reads better.

### CDP costs — perfect match
Code (`lib/cdp-costs.ts`):
- Skill: 1 CDP to learn (any negative baseline → +1). Raise: current + (current+1) = 2N+1 CDP. So +1→+2 = 3, +2→+3 = 5, +3→+4 = 7. ✅ matches SRD.
- RAPID: 3 × (current+1) CDP. So +1→+2 = 6, +2→+3 = 9, +3→+4 = 12. ✅ matches SRD.

🟢 **CLARIFIED — 0 → +1 attribute**: SRD §04 only specifies post-creation costs starting from +1. Code computes 0→+1 = 3 CDP (the formula 3 × (0+1)). The SRD should explicitly state "raising a RAPID Range attribute from 0 (Average) to +1 (Good) costs **3 CDP**" so post-creation purchases of a baseline-zero attribute have a price.

### Lv 4 narrative gate — Distemper-only?
🟡 **EXTENDED**: `lib/cdp-costs.ts:46-48` `isLv4Step()` flags raising to Human Peak / Life's Work as narrative-gated (per CRB Ch.6). The XSE SRD §04 doesn't mention this. Either:
- Bless into SRD §04: "Raising an attribute to +4 (Human Peak) or a skill to +4 (Life's Work) requires GM approval and a narrative justification (Fill In The Gaps)."
- Mark as Distemper-only in `/rules/skills/` Distemper additions.

### Paradigm vs Pregen vs Backstory — three methods
SRD §04: Backstory Generation, Paradigm, Pregen. Code: matches all three. Quick Character flow ↔ Paradigm method, Random Character ↔ Paradigm with auto-roll Comp/Mot/Words. ✅

### Apprentice creation
🔴 **WIRED-DEEPLY** in `components/ApprenticeCreationWizard.tsx`. Apprentice creation rewrote 2026-04-30 from Paradigm-based to **Profession-based** per Xero clarification. Live order:
1. Identity (name, age, 3 trait words, background)
2. Profession pick (12 PROFESSIONS, each seeds 1 CDP per profession-skill)
3. 3 CDP RAPID (baseline 0)
4. 5 CDP skills (per-skill SRD cap = master_PC.skill − 1)
5. Confirm

SRD §08 Apprentices says "3 CDP RAPID, 5 CDP skills, 1 Paradigm". 🔴 **The SRD still says Paradigm-based; code is Profession-based.** Update SRD §08 Apprentices to match:
- "Picks one **Profession**" (not Paradigm)
- "Profession seeds 1 CDP per profession-skill, on top of the 5 skill CDP"

🟡 **EXTENDED**: Apprentice cap rule "skill ≤ master − 1" is encoded in the wizard. SRD says "trained up to (PC skill level − 1) over 1 month". Code does **per-skill cap on the wizard at creation time**, no time-elapsed gating. Recommend SRD wording: "Each Apprentice skill is capped at master's level − 1 at creation; no in-game training time required for the initial spend."

### Character Evolution
🔴 **WIRED**: `components/CharacterEvolution.tsx` lets players spend earned CDP using the same `cdp-costs.ts` formulas. SRD §04 says "GM awards 2+ CDP per session." Code matches. ✅

---

## §05 Skills + Appendix B

### Skill list
🔴 **WIRED** in `lib/xse-schema.ts:80-110` — 29 skills with attribute, vocational flag, and one-line description. SRD Appendix B prose matches the skill list and pairings. ✅

🟢 **CLARIFIED**: SRD §05 skill descriptions (Appendix B) are written in mid-sentence prose. Code one-liners are crisper:
- Code "Hunt, forage, farm, fish, scavenge → Rations" vs SRD "Knowing how to grow crops or raise livestock at scale to sustain large groups of people" (Farming)
- All 29 descriptions are slight rewrites. Recommend SRD adopt the code prose verbatim — they're tighter and battle-tested through onboarding.

### Vocational asterisks
- Code marks 9 skills vocational: Demolitions*, Heavy Weapons*, Lock-Picking*, Mechanic*, Medicine*, Psychology*, Tactics*, Weaponsmith*. **8 starred + 1 implicit (Lock-Picking* in some files)**.

🔴 **CONFIRM**: SRD §05 lists vocational skills inline. Verify each is starred in both:

| Skill | Code voc. | Notes |
|---|---|---|
| Demolitions* | ✅ | |
| Heavy Weapons* | ✅ | |
| Lock-Picking* | ✅ | |
| Mechanic* | ✅ | |
| Medicine* | ✅ | |
| Psychology* | ✅ | |
| Tactics* | ✅ | |
| Weaponsmith* | ✅ | |

8 vocational. Match SRD.

### Level scale
| Level | Label |
|---|---|
| −3 | Inept (vocational baseline) |
| 0 | Untrained (non-vocational baseline) |
| +1 | Beginner |
| +2 | Journeyman |
| +3 | **Professional** |
| +4 | **Life's Work** |

🟢 **CLARIFIED**: Code uses `Professional` and `Life's Work`. The SRD's OCR mangling rendered "L' W" — easily mis-decoded as "Lifer's Wisdom" or similar. Update SRD to **Life's Work** explicitly.

### Inspiration Lv4 + Psychology* Lv4 — Distemper CRB additions
🟡 **EXTENDED — needs CRB confirmation**: `/rules/skills/inspiration` and `/rules/skills/psychology` ship the CRB additions:
- Inspiration: +1 SMod per level on Recruitment; Lv4 Beacon of Hope = +4 to all Morale Checks.
- Psychology* Lv4 Insightful Counselor = +3 to Morale (tenure-gated).

These are **CRB-only additions** layered on the SRD baseline. Currently auto-applied in the Morale + Recruitment modals. Decide:
- Keep them on the SRD page as a "Distemper CRB additions" sidebar (current approach), OR
- Move them to a Setting-specific page if XSE goes multi-setting.

---

## §06 Combat — **MULTIPLE DIVERGENCES**

### 🔴 Range bands — feet thresholds locked, weapon profiles much richer than SRD

#### Band thresholds (`lib/range-profiles.ts:7-13`)
| Band | Feet (≤) |
|---|---|
| Engaged | 5 |
| Close | 30 |
| Medium | 100 |
| Long | 300 |
| Distant | ∞ (1000 in /rules pages) |

**The SRD has no specific feet thresholds for the bands** — it describes them narratively ("close enough to wrestle", "see the whites of their eyes"). The Tapestry codebase locks them at the values above. Update SRD §06 Range to include the explicit feet table.

#### Per-weapon range CMods — code ships a full profile system, SRD has only band-level guidance

`lib/range-profiles.ts:32-51` ships **17 distinct weapon profiles** with band-by-band CMods. The SRD currently only describes:
- Engaged: +1 melee CMod, −1 ranged
- Close: −1 melee, +1 to any ranged attack
- Medium: no modifiers
- Long: −5 pistol, +1 rifle
- Distant: only sniper rifle / hunting rifle with scope

🔴 The code is **far more granular** — for example Sniper's Rifle gets +1 at Long AND Distant; Carbine works Engaged through Distant with band-specific CMods; Bow has Tracking trait. Update SRD to publish the full per-weapon profile table, OR adopt a "weapon-band profile" concept and reference it in §06 Range.

#### Move action distance
- Code (`components/TacticalMap.tsx:1450`): `maxMoveCells = ceil(10 / cellFt)` — **1 Move action = 10 ft**.
- SRD §06 prose says "Moving between bands takes the same number of combat rounds as the sum of the bands being covered. 3 rounds Engaged→Close (= 30ft / 6 actions = 5 ft/action)."

🔴 **CONFLICT**: Code says 10 ft per Move; SRD math implies 5 ft per Move. Either:
- Update SRD to explicitly state "1 Move action = 10 ft (2 cells at 5 ft / cell)" — matching code.
- Or fix code to match the SRD's slower 5 ft/action math.

The current Tapestry behaviour is the user-visible truth — recommend SRD update.

#### Sprint
- Code: Sprint = 2 actions = 30 ft (per gm-screen). Athletics check or become Winded.
- SRD: "Sprint 2 actions, Move 30ft. Athletics check or Winded."
✅ Match.

#### Charge
- Code: 2 actions, +1 CMod on the charge attack.
- SRD: "Move 20ft + melee/unarmed attack with +1 CMod" (per existing /rules/combat/combat-rounds page).
🔴 **DISTANCE MISMATCH**: SRD says 20 ft. Code's Charge consumes 2 actions, which at 10 ft/Move gives 20 ft of movement. Or it gives 10 ft (one Move action) + a melee swing. Confirm in code which one. Either way, document the resolved value in the SRD.

### Combat actions list
SRD lists these (Table 10 in Appendix A): Aim, Attack, Charge, Coordinate, Cover Fire, Defend, Distract, Fire from Cover, Grapple, Inspire, Move, Rapid Fire, Ready Weapon, Reposition, Sprint, Subdue, Take Cover, Stabilize.

Code in `app/stories/[id]/table/page.tsx` implements all of these PLUS:
- 🟡 **EXTENDED** state tracking: `aim_active`, `aim_bonus`, `defense_bonus`, `has_cover`, `winded`, `inspired_this_round`, `coordinate_target`, `coordinate_bonus`. SRD doesn't describe how long an Aim bonus persists ("must attack next or lost"). Code: aim cleared after one attack OR end of turn — matches SRD.
- 🟡 **EXTENDED**: `Stabilize` is in the SRD as a Medicine* check on a Mortally Wounded character. Code adds a generic STABILIZE roll modal — same mechanic.

### Aim wording
- Code: "+2 CMod on the next Attack this round; lost if anything but Attack is taken next."
- SRD: "+2 CMod on next attack. Must attack next or lost."
✅ Match in spirit.

### Coordinate
- Code: Tactics* check; allies in Close get +2 CMod vs target. On Wild Success, allies also get +1 CMod on their attack.
- SRD: Tactics* check, allies in Close range get +2 CMod against the same target. On Wild Success, +1 CMod additionally.
✅ Match.

### Damage
- WP/RP split: Code uses each weapon's `rpPercent` field. ✅ matches SRD's "RP damage = 50% of WP damage" default + per-weapon overrides.
- 🟡 **EXTENDED**: code has `rpPercent: 400` for Cattle Prod / Taser ("Stun" weapons that do 4× RP vs WP). SRD describes Stun weapons but the 400% RP value is a Tapestry-specific encoding choice.
- Melee + Unarmed: code adds attacker's PHY AMod. ✅ matches SRD `5+1d6 + PHY AMod`.
- Bare-fisted: code computes `1d3 + PHY AMod + Unarmed Combat SMod`. ✅ SRD §06 Damage page matches.

### Environmental damage
| | Code | SRD |
|---|---|---|
| Starvation | 1 RP/day after 24hr; 0 RP from starvation = 1 WP/day until death | matches |
| Falling | 3 WP + 3 RP per 10 ft | matches |
| Drowning | 6 + PHY AMod rounds breath-hold; PHY check or 3 WP + 3 RP/round | matches |
| Healing | 1 WP/day rest; 1 WP per 2 days if previously Mortally Wounded; 1 RP/hour resting | matches |

✅ All match per `components/CharacterCard.tsx:878` env-damage prompt.

### Incapacitation thresholds
- RP = 0 → Incapacitated for 4 − PHY AMod rounds (min 1). ✅
- WP = 0 → Mortally Wounded; dies in 4 + PHY AMod rounds without Stabilize. ✅
- Stabilize via Medicine* (or Reason Wild Success). ✅
- After Stabilize: Incapacitated 16 − PHY AMod rounds (min 1). ✅
- Insight Die save: spend ALL ID, +1 WP + 1 RP per die. ✅

🟡 **EXTENDED**: code also supports an automatic Stress pip on entering WP=0 OR RP=0 (per memory: stress on mortal/incap, +1 pip cap 5). SRD doesn't mention this. **Recommend SRD adopt** — incapacitation/mortal-wound IS extreme stress by definition.

### Lasting Wounds (Table 12) and Breaking Point (Table 13)
- Code: tables stored in `lib/xse-schema.ts:580-602` (Breaking Point) — matches SRD per /rules/combat/incapacitation and /rules/combat/stress pages.
- 🟢 **CLARIFIED**: SRD calls Table 12 "Lasting Wounds" and Table 13 "Breaking Point". Code's `LASTING_WOUNDS` table label "Self-Destructive Urges" (entry 11) is in the BREAKING POINT table; whereas the LASTING WOUND entry 11 is `Compound Injury`. Confirm both tables are in code.

### Stress modifier and Breaking Point
- Stress Modifier: code `RSN + ACU` (`lib/xse-schema.ts:718`). SRD ✅.
- Breaking Point: code default 3 (`xse-schema:719: morality: 3`). 🔴 **NAME COLLISION**: code calls this `morality` not `breakingPoint` — but it functions as the BP threshold. SRD calls it Breaking Point with default 5, NOT 3. **CHECK**: which is canonical? Code has BP=3 but the page I authored says "Breaking Point of 5". Investigate before pushing the SRD update.

  Likely root cause: `morality: 3` in the schema is unrelated and unused (placeholder), and the actual stress=5→BP gate is elsewhere. The number 3 vs 5 needs reconciliation.

---

## §07 Equipment + Appendix C

### Item Condition CMods
| Condition | Code CMod | SRD |
|---|---|---|
| Pristine | +1 | +1 ✅ |
| Used | 0 | 0 ✅ |
| Worn | −1 | −1 ✅ |
| Damaged | −2 | −2 ✅ |
| Broken | Unusable | Unusable ✅ |

Source: `lib/weapons.ts CONDITION_CMOD`. ✅ no drift.

### Item Traits
Code (`lib/weapons.ts:42-50`) has 8 traits:
- Automatic Burst, Blast Radius, Burning, Close-Up, Cumbersome, Stun, Tracking, Unwieldy.

SRD lists these 8. ✅ match.

#### Trait effect deltas
- 🟢 **CLARIFIED**: SRD trait descriptions in §07 are OCR-garbled. Code prose is clean:
  - **Cumbersome (X)**: "Requires Physicality of (X) to use, or incurs −X CMod."
  - **Unwieldy (X)**: "Requires Dexterity of (X) to use correctly, or incurs −X CMod."
  - **Tracking**: "When players Ready Their Weapon before an attack, they also track their target. +1 CMod on next attack."
  - **Stun**: "Deals no WP damage. On Wild Success or High Insight, target incapacitated for 1d6 − PHY AMod rounds (min 1)."
  - **Blast Radius**: "Engaged = full damage, Close = 50%, further = 25%."
  - **Burning (X)**: "Initial damage + additional WP/RP per round for d3 rounds."
  - **Close-Up**: "Hits indiscriminately at Engaged range, target sustains 50% damage." 🟡 Note: code's wording suggests cone damage at Engaged only; SRD wording was unclear.
  - **Automatic Burst (X)**: "Can fire X rounds simultaneously at anyone at Engaged range. Uses listed number of rounds per burst."

🔴 **WIRED**: copy code prose verbatim into SRD §07 Item Traits.

### Upkeep
SRD says: Upkeep check uses Mechanic*, Tinkerer, Ranged Combat, Melee Combat, Heavy Weapons*, Demolitions*, or Weaponsmith*.

🔴 **NOT WIRED**: I don't see explicit Upkeep code — items get their condition manipulated by the GM via the inventory edit modal. No automatic Upkeep rolls. Either:
- Add an Upkeep roll modal that uses one of the SRD-listed skills.
- Or document the SRD's behaviour as "GM-driven" in the SRD prose.

### Weapon catalog
**Massive divergence — code's catalog is more comprehensive than the SRD's.**

Code:
- `MELEE_WEAPONS` (lib/xse-schema.ts:197-215): 17 weapons
- `RANGED_WEAPONS` (lib/xse-schema.ts:235-250): 14 weapons
- `EXPLOSIVE_WEAPONS` (lib/weapons.ts): 6 explosives
- `HEAVY_WEAPONS` (lib/weapons.ts): 3 heavy/specialist

SRD Tables 16–19 reference fewer entries (the OCR makes exact counts hard, but the in-code catalog is broader).

🟡 **EXTENDED — recommend SRD adopt the code catalog wholesale**. Specifically:
- Cattle Prod (melee, Stun, RP 400%)
- Bullwhip (Athletics, Close, Unwieldy 2)
- Tactical Baton (melee, Engaged)
- Taser (ranged, dart, Stun)
- Tranquilizer Gun (ranged, Stun)
- Compound Bow vs regular Bow split
- Mortar (explosive, Distant, Demolitions skill)
- Shiv-Grenade and Flash-Bang Grenade (explosive, Stun)
- Molotov (explosive, Demolitions skill)
- Mounted Turret / Gatling Gun (heavy, Cumbersome 2)
- M60 (Mounted) (heavy, Cumbersome 2)

Plus weapon stats (damage dice, RP%, ammo rarity, clip size) all live in code as the canonical numbers. 🔴 SRD update is mostly mechanical: dump the schema arrays as Markdown tables.

### Equipment list (Table 20)
Code `lib/xse-schema.ts:263-298` ships 32 equipment items. Includes:
- Angler's Set (+2 to Fishing)
- Backpack (+2 ENC)
- Doctor's Bag (+2 Medicine*, heals 1+2d3 over 24hr)
- First Aid Kit (+1 Medicine*, heals 1+1d3 over 24hr)
- Compass (+1 Navigation)
- Multitool (+1 Tinkering or Mechanic*)
- Plus standard / criminal lockpicks, military backpack, etc.

✅ Each has rarity, ENC, and an effect note. 🔴 **WIRED**: SRD Table 20 should be replaced with the code catalog.

---

## §08 Communities — extensions to flag

### Recruitment Check
- 🟡 **EXTENDED — RecruitmentType has 6 values, SRD has 4**:
  - Code: `member`, `founder`, `cohort`, `conscript`, `convert`, `apprentice`
  - SRD: only `cohort`, `conscript`, `convert`, `apprentice`
  - **Decision**: bless `founder` (the original community creator) and `member` (generic non-recruited NPCs added directly) into the SRD, or strip them to extension-only behaviour.

- ✅ The 3 recruitment outcome tables (Cohort/Conscript/Convert) match SRD per `tasks/rules-extract-communities.md`.

- ✅ Apprentice unlock is gated on **Moment of High Insight (6+6)** only, matching SRD.

### Morale Check — modifier slot computation
The Morale roll is `2d6 + leader's AMod + leader's SMod + 6 modifier slots`. Each slot's source:

| Slot | Code formula | SRD prose |
|---|---|---|
| Mood Around The Campfire | Prior Morale's `cmod_for_next` (= outcomeToMoraleCmod) | "Carried in from previous Morale Check" ✅ |
| Fed | `outcomeToMoraleCmod(fedOutcome)` | Same — derived from weekly Fed Check ✅ |
| Clothed | `outcomeToMoraleCmod(clothedOutcome)` | Same ✅ |
| Enough Hands | `+1 if all 3 minimums met, else −1 per group short, max −3` | Match per `tasks/rules-extract-communities.md` |
| A Clear Voice | `0 if leader, −1 if leaderless` | ✅ |
| Someone To Watch Over Me | `+1 if Safety ≥ 10%, −1 if Safety < 5%, else 0` | ✅ |
| Adjusted CMods | GM-set | ✅ |

Source: `lib/community-logic.ts:75-111`.

🟡 **EXTENDED — World Events**: code adds a 7th slot path. `components/CommunityMoraleModal.tsx:201-207, 250-255` pulls active Distemper Timeline pins (`map_pins.cmod_active=true`) within their `cmod_radius_km` of the community's Homestead, applies their `cmod_impact` as Morale CMods, GM can opt-out per-event. 🔴 **Add to SRD §08**: "World Events that intersect a community's location apply CMod impacts to the next Morale Check; the GM may rule individual events as not affecting their community."

🟡 **EXTENDED — Inspiration Lv4 (+4 Morale CMod)** and **Psychology* Lv4 (+3 Morale CMod, tenure-gated)** are CRB additions auto-applied. Already documented as CRB additions on the SRD pages.

### Morale outcomes → next-Mood CMod
| Outcome | Next-week Mood |
|---|---|
| High Insight | +2 |
| Wild Success | +1 |
| Success | 0 |
| Failure | −1 |
| Dire Failure | −2 |
| Low Insight | −3 |

✅ matches SRD per `outcomeToMoraleCmod`.

### Morale outcomes → community departures
| Outcome | % leaves |
|---|---|
| Failure | 25% |
| Dire Failure | 50% |
| Low Insight | 75% |

✅ Match (`outcomeToDeparturePct`).

### Departure pick — weighted priority
🟡 **EXTENDED**: `pickDeparturesWeighted` (`lib/community-logic.ts:128-160`) chooses WHICH NPCs leave on a Morale failure. Priority (lowest = leaves first):
- 0: unassigned
- 1: cohort
- 2: convert (or generic member)
- 3: conscript
- 4: founder
- 5: apprentice (most loyal — leaves last)

PCs are never auto-removed.

🔴 **Add to SRD §08**: "On a Morale Check failure, members leave in priority order: Unassigned first, then Cohort, Convert, Conscript, Founder; Apprentices leave last. Player Characters never auto-leave — they choose to stay or go narratively."

### Dissolution + Retention
- 3 consecutive Morale failures → community dissolves. ✅ SRD match.
- Retention Check: an immediate Morale Check using the failed roll's `cmod_for_next` as the Mood slot. ✅ SRD match.

🟡 **EXTENDED**: code lets the leader pick a different skill for the Retention Check (`retentionSkillName`). SRD just says "make an immediate Morale Check". The picker is a UX nicety. 🔴 **Add to SRD**: "On a Retention Check, the leader may use any social skill the GM agrees applies — the desperate rally is its own beat, not necessarily the same skill that drove the failed Morale roll."

### Community Structure — role minimums
| Role | Code | SRD |
|---|---|---|
| Gatherers | `ceil(N × 0.33)` | "33% (round down)" |
| Maintainers | `ceil(N × 0.20)` | "20% (round down)" |
| Safety | `max(1, ceil(N × 0.05))` | "5–10%" |

🔴 **CONFLICT — rounding direction**:
- SRD: "round **down**" (33% of 13 = 4 floor)
- Code: `ceil` (33% of 13 = 5 ceil)

For Gatherers and Maintainers, code uses ceil; SRD says floor. **Verify which is intended.** Code's stricter ceil means small communities need slightly more staffing to clear the threshold.

For Safety: code adds a `max(1, …)` floor — at least 1 person on Safety even in tiny communities. SRD doesn't specify a floor. Bless code's behaviour ("at least one Safety in any community") into the SRD.

### Apprentice — 1 per PC
✅ Code enforces 1 Apprentice per PC at any time. SRD match.

### Apprentice Paradigm-vs-Profession
🔴 **MAJOR (also covered above in §04)**: Apprentice creation is **Profession-based** in code (post 2026-04-30 rewrite) but SRD §08 still says **Paradigm**. SRD must update.

---

## Appendix D — Paradigms

Code (`lib/xse-schema.ts:325+`) ships 12 Distemper Paradigms with full RAPID, skill, weapon, and equipment loadouts.

🔴 **WIRED**: each Paradigm's stats are canonical in code. SRD Appendix D should publish the code's 12 Paradigm tables verbatim. The starter loadout (Primary, Secondary, 2 Equipment items) is a Tapestry-specific addition — the SRD only says "pick weapons and equipment". 🟡 **EXTENDED — bless the loadout into SRD**: it's a strong onboarding aid.

🟢 **CLARIFIED — Vibe Shifts**: SRD Appendix D mentions "Paradigms & Vibe Shifts" (Table 8). Code currently doesn't have a Vibe Shifts surface. **Action**: either add a Vibe Shifts column/section to code (tracking the per-Paradigm thematic shift) or remove the "& Vibe Shifts" reference from the SRD title.

---

## Cross-cutting nits

1. **Code uses `morality: 3` on SecondaryStats** (`lib/xse-schema.ts:719`) — purpose unclear. Either it's the placeholder Breaking Point default and should be renamed, or it's an unused field that should be removed.

2. **Distemper CRB layered features** (Inspiration Lv4, Psychology* Lv4, Apprentice Paradigm pick rewrite, Profession seeds): currently inline on the SRD `/rules/*` pages with "Distemper CRB additions" sections. Decide: keep inline (current) or split into a separate `/rules/crb/` namespace if XSE goes multi-setting.

3. **Sniper's Rifle weapon-band penalty**: the rules-extract-combat.md notes "Sniper's Rifle (and similar) carry weapon-specific extra penalties". Code's `range-profiles.ts:42` ships a custom profile (engaged −4, close −2, medium 0, long +1, distant +1). 🔴 **Update SRD §06 Range** to reference per-weapon profiles by name.

4. **Vehicles**: code has a vehicle system (`lib/setting-vehicles.ts`, `components/VehicleCard.tsx`, etc.) — SRD doesn't cover vehicles at all. 🟡 **EXTENDED — Tapestry-only feature**. Either add §09 Vehicles to the SRD, or document as a Distemper-platform extension.

5. **Inventory + Encumbrance time-tick**: the GM Tools "Time" feature applies hourly RP loss to overencumbered PCs/NPCs. SRD has Encumbrance as a stat but no time-tick rule. 🟡 **House rule per Xero, 2026-04-30** — bless into SRD §07.

6. **Stockpiles, trade, world events, communities subscriptions, multi-campaign mechanics**: all Tapestry/Distemperverse extensions, none in SRD. Document scope decisions before publishing the next SRD revision.

---

## Recommended next steps

1. **Reconcile §04 step ordering** — single biggest user-facing divergence. Update SRD to match code's order.
2. **Reconcile Apprentice Paradigm → Profession** in §08.
3. **Publish the per-weapon range-profile table** in §06 (or §07 Equipment).
4. **Adopt code's weapon catalog** as canonical for Tables 16–19 + Equipment Table 20.
5. **Document `morality: 3` field**, decide rename or remove.
6. **Add World Events slot to §08 Morale**.
7. **Document Apprentice/Founder departure-priority and the at-least-1-Safety floor** in §08.
8. **Decide CRB additions placement** — keep inline on SRD pages, or split.
9. **After SRD update**: re-author the `/rules/*` pages to match the new canonical text. Most pages are mechanical; the structure pages (§04 ordering, §08 Recruitment types) need careful prose revision.

Once you have a new SRD PDF, drop it at `docs/Rules/`, ping me, and I'll regenerate every `/rules/*` page from it.
