# Chased Pregens - Canon Audit (old sheet vs. current canon)

**Source audited:** `David Battersby Pregen.pdf` (OneDrive / Chased / Module / Chased Pregens)
**Canon reference:** `lib/xse-schema.ts` (SKILLS, PROFESSIONS, deriveSecondaryStats) + `app/rules/*`
**Date:** 2026-06-18
**Why:** the old pregen PDFs predate the current XSE skill list, profession list, and secondary-stat model. This documents every drift so all the Chased pregens get rebuilt to canon consistently, not just David.

---

## What the old David sheet contains (extracted)

- **Profession:** Farmer
- **Attributes (sheet calls them REA/ACU/PHY/INF/DEX):** Reason 2, Acumen 2, Physicality 1, Influence 0, Dexterity 0
- **3 words:** Shrewd, Sullen, Pessimistic - **Complication:** Betrayed - **Motivation:** Revenge
- **Skills** grouped under category headers [Combat] / [Criminal] / [Medicine] / [Knowledge] / [Mechanic] / [Innate] / [Sway]
- **Secondary:** Wound Points (10 + PHY + DEX), Resilience 7, Encumbrance 7, Morality 3, "Panic Threshold" 3, Breaking Point 7, DM Melee +2, DM Ranged 0, CDP, Insight Dice, Rations
- **Weapons:** Fists (1d3 + PHY, Unarmed); Sawed-Off Shotgun (WP 2x2d6, RP 50%, Clip 2)

---

## MISMATCHES vs. canon

### 1. Profession "Farmer" is not a canon profession
Canon professions: Academic, Driver, Entrepreneur, Law Enforcement, Mechanic, Medic, Military, Outdoorsman, Outlaw, Performer, Politician, Trader.
-> **Map Farmer -> Outdoorsman** (this is exactly what the built-in "Farmer" paradigm already does). "Farming" survives as a *skill*, not a profession.

### 2. Skills are no longer categorized
Old sheet groups skills under [Combat]/[Criminal]/[Medicine]/[Knowledge]/[Mechanic]/[Innate]/[Sway]. Canon is a **flat list of 29 skills**, no categories. Drop the headers entirely.

### 3. Old skills that DON'T exist in canon (merged / renamed / removed)
| Old sheet skill | Canon resolution |
|---|---|
| First Aid, Pharmacology*, Surgery* (3 separate) | collapse into one skill: **Medicine*** (RSN) |
| Armorsmith*, Vehicle Rep.* | folded into **Mechanic*** (RSN) - neither exists standalone |
| Weaponsmith* | exists in canon (DEX) - keep |
| General Knowledge | canon has **Specific Knowledge** (RSN), not "General" |
| Intimidation | not a canon skill - folded into **Manipulation** (INF) |
| Hunting | not a canon skill - folded into **Survival** (ACU) / Animal Handling |

### 4. Canon skills the old sheet is missing
Driving (DEX), Gambling (ACU), Heavy Weapons* (PHY), Streetwise (ACU), Specific Knowledge (RSN). The new sheet lists all 29.

### 5. Skill -> attribute associations changed (these are real mismatches, not just label changes)
| Skill | Old sheet | Canon |
|---|---|---|
| Stealth | DEX | **PHY** |
| Athletics | DEX | **PHY** |
| Barter | ACU | **INF** |
| Farming | REA | **ACU** |
| Lock-Picking* | DEX/REA | **ACU** |

(Note: the abbreviation **REA on the old sheet = RSN in canon** - same attribute "Reason," just relabeled. Not a real mismatch, but every "REA" tag becomes "RSN.")

### 6. Secondary-stat model changed
- **"Panic Threshold"** no longer exists. Replaced by the **Stress / Breaking Point** system (stressLevel, breakingPoint, stressModifier = RSN + ACU).
- **Perception** (RSN + ACU) is a canon secondary stat the old sheet doesn't show - add it.
- Formulas that DO still match exactly: Wound Points = 10 + PHY + DEX; Resilience = 6 + PHY; Encumbrance = 6 + PHY; Morality = 3 (constant); Initiative = DEX + ACU.
- **"DM Melee / DM Ranged"**: canon exposes **Ranged Defense = DEX** and **Melee Defense = PHY**. Ranged Defense 0 matches (DEX 0); the old "DM Melee +2" does NOT match PHY 1 - old sheet used a different melee formula. New sheet uses Melee Defense = PHY.

### 7. Weapon notation
- **Sawed-Off Shotgun "RP 50%"**: CORRECTION - the % RP **is** canon for shotguns. `lib/weapons.ts` / `xse-schema.ts` define `Shotgun (Sawed-Off)` with `rpPercent: 50`. The only outdated part is the **WP**: old sheet shows `2x2d6`, canon is `2+3d6`. Use the canon entry by name (`Shotgun (Sawed-Off)`).
- Range/Type bands (Engaged/Close/Medium/Long/Distant) still match canon.

### 8. Vocational (*) skills + the "-3 Inept" default
This part is actually CONSISTENT: canon marks vocational skills with `*` and defaults them to **-3 (Inept)** when untrained. The faint "-3" marks next to Demolitions*/Surgery*/Weaponsmith* on the old sheet line up with that default. Keep the convention; just apply it to the canon vocational set: Demolitions*, Heavy Weapons*, Lock-Picking*, Mechanic*, Medicine*, Psychology*, Tactics*, Weaponsmith*.

---

## Illegible on the scan (needs Xero confirmation or sensible defaults)
The scan is faded; **bold dark numbers** = David's actual ranks, faint gray = template defaults. Confident reads: Melee Combat 2, Unarmed Combat 2, Manipulation 3. The "Criminal" cluster (Lock-Picking 2 / Sleight of Hand 2 / Stealth 2) reads as filled but is an odd fit for a grieving farmer - likely template artifacts. Recommend rebuilding David's skill spread to fit the Outdoorsman/farmer concept + his revenge arc rather than transcribing faded marks.

---

## RESOLUTION - David is ALREADY built (verified 2026-06-18)
David Battersby already exists as a canon-faithful pregen in `lib/setting-npcs.ts:715` (`CHASED_PREGENS[0]`), and it is an EXACT transcription of this sheet:
- **Attributes:** RSN 2, ACU 2, PHY 1, INF 0, DEX 0 - match.
- **Skills (transcribed from the bold colored values, gray base-reminders ignored):** Melee Combat 2, Unarmed Combat 2, Lock-Picking* 2, Sleight of Hand 2, Stealth 2, Manipulation 3 (Intimidation 2 folded in - higher wins), Athletics 1, Navigation 1, Scavenging 1, Survival 1, Barter 1 - match. (Farming is blank on the sheet, so 0 - faithful.)
- **Weapon:** `Shotgun (Sawed-Off)` (canon entry) - match. Fists are innate, no slot needed.
- **Breaking Point 7, 3 words / Betrayed / Revenge, age/height/weight** - all match.

**Profession field = `'Farmer'`** (free-text flavor label). This is correct per the codebase convention: every Chased pregen uses a flavor profession string (`Trail Guide`, `Vet Technician`, `Handyman`...), NOT a canon Profession. Xero confirmed 2026-06-18: base Profession is Outdoorsman, but the character introduces himself as a farmer. No change.

**Conclusion:** no rebuild needed. David is done and live. The whole Chased set (David, Carly, Morgan, Marv, Victor) + Gus (Empty) already exist via `SETTING_PREGENS`. The canon-mapping rules above (sections 1-8) are the reference for auditing the REMAINING source sheets against what's built, if/when those PDFs are provided.
