#!/usr/bin/env -S npx tsx
// Tapestry Rules Canon — generator.
//
// Pulls every canonical table out of `lib/xse-schema.ts` (the platform's
// source of truth for rules content) and emits a single markdown file
// suitable for feeding to claude.ai chat alongside Quickstart/SRD PDFs
// for offline rules audits.
//
// Usage:
//   npx tsx scripts/export-canon.ts > tasks/tapestry-rules-canon.md
//
// The prose sections (combat-actions narrative, range-band notes,
// stress mechanics description) are hard-coded in this script because
// they live inside React JSX in app/rules/* pages. When those pages'
// rule content changes meaningfully, update the prose blocks below to
// match.

import {
  ATTRIBUTE_LABELS,
  BACKSTORY_STEPS,
  BREAKING_POINT,
  COMPLICATIONS,
  EQUIPMENT,
  LASTING_WOUNDS,
  MELEE_WEAPONS,
  MOTIVATIONS,
  OUTCOMES,
  PARADIGMS,
  PROFESSIONS,
  RANGED_WEAPONS,
  SKILL_LABELS,
  SKILLS,
} from '../lib/xse-schema.ts'

// ----------------------------
// Helpers
// ----------------------------

const heading = (level: number, text: string) =>
  `${'#'.repeat(level)} ${text}\n`

const lines = (...xs: string[]) => xs.join('\n') + '\n'

const tableRow = (cells: (string | number)[]) =>
  `| ${cells.join(' | ')} |`

const tableHeader = (cols: string[]) =>
  `${tableRow(cols)}\n${tableRow(cols.map(() => '---'))}`

// ----------------------------
// Sections
// ----------------------------

function header(): string {
  const today = new Date().toISOString().slice(0, 10)
  return lines(
    `# Tapestry Rules Canon — XSE SRD v1.1.17`,
    ``,
    `**Source of truth**: \`lib/xse-schema.ts\` and \`app/rules/*\` pages on TheTapestry platform.`,
    `**Generated**: ${today}.`,
    `**Regenerate**: \`npx tsx scripts/export-canon.ts > tasks/tapestry-rules-canon.md\``,
    ``,
    `This file is the platform's canonical reference for rules content. Every term, formula,`,
    `table value, and skill/profession/paradigm name in this document comes verbatim from the`,
    `platform's source code. **Nothing in this file is invented or inferred — every line is sourced.**`,
    ``,
    `## Precedence rule`,
    ``,
    `When auditing or rewriting rules content (e.g. the Distemper Quickstart):`,
    ``,
    `> **Tapestry > SRD > Quickstart > Core Rulebook**`,
    ``,
    `If a term, table entry, or skill name appears in the Quickstart or CRB but is **not** in this`,
    `canon file, it should be deleted from the Quickstart, not preserved. If something is in the`,
    `SRD or this canon file but missing from the Quickstart, it should be added. Never invent new terms.`,
  )
}

function outcomesSection(): string {
  return lines(
    `### Outcomes (Table 1)`,
    ``,
    `Source: \`lib/xse-schema.ts\` OUTCOMES array.`,
    ``,
    tableHeader(['Total', 'Outcome']),
    ...OUTCOMES.map(o => tableRow([o.range, o.label])),
    ``,
    `A Moment of Low Insight counts as a Dire Failure AND grants an Insight Die.`,
    `A Moment of High Insight counts as a Wild Success AND grants an Insight Die.`,
  )
}

function modifierTables(): string {
  const aRows = Object.entries(ATTRIBUTE_LABELS)
    .map(([k, v]) => [Number(k), v] as [number, string])
    .sort((a, b) => a[0] - b[0])

  const sRows = Object.entries(SKILL_LABELS)
    .map(([k, v]) => [Number(k), v] as [number, string])
    .sort((a, b) => a[0] - b[0])

  const fmtMod = (n: number) => (n > 0 ? `+${n}` : String(n))

  return lines(
    `### Modifier ranges and labels`,
    ``,
    `#### Attribute Modifier (AMod) — Table 2`,
    ``,
    `Source: \`lib/xse-schema.ts\` ATTRIBUTE_LABELS. Range -2 to +4 for player characters; +5 reserved for animals and machines.`,
    ``,
    tableHeader(['Mod', 'Label']),
    ...aRows.map(([mod, label]) =>
      tableRow([fmtMod(mod), mod === 5 ? `${label} *(animals/machines only)*` : label]),
    ),
    ``,
    `#### Skill Modifier (SMod) — Table 3`,
    ``,
    `Source: \`lib/xse-schema.ts\` SKILL_LABELS. Range -3 to +4. Starting characters cap at +3 (Professional). Vocational skills (marked \`*\`) start at -3 (Inept) instead of 0 (Untrained); the first level taken jumps from -3 directly to +1 (Beginner).`,
    ``,
    tableHeader(['Mod', 'Label']),
    ...sRows.map(([mod, label]) => tableRow([fmtMod(mod), label])),
    ``,
    `#### Conditional Modifier (CMod) — Table 4`,
    ``,
    `Source: \`app/rules/core-mechanics/modifiers/page.tsx\`. (Hard-coded in script — keep in sync with that page if the labels change.)`,
    ``,
    tableHeader(['Mod', 'Label']),
    tableRow(['-5', 'Doomed To Fail']),
    tableRow(['-4', 'Insurmountable']),
    tableRow(['-3', 'Hard']),
    tableRow(['-2', 'Difficult']),
    tableRow(['-1', 'Challenging']),
    tableRow(['0', 'Average']),
    tableRow(['+1', 'Simple']),
    tableRow(['+2', 'Slight Favor']),
    tableRow(['+3', 'Easy']),
    tableRow(['+4', 'Trivial']),
    tableRow(['+5', 'Divinely Inspired']),
  )
}

function skillsTable(): string {
  return lines(
    `### Skills (Table 9) — ${SKILLS.length} canonical skills`,
    ``,
    `Source: \`lib/xse-schema.ts\` SKILLS.`,
    ``,
    tableHeader(['Skill', 'Attribute', 'Vocational', 'Description']),
    ...SKILLS.map(s =>
      tableRow([s.name, s.attribute, s.vocational ? '✓' : '–', s.description]),
    ),
  )
}

function complicationsTable(): string {
  const rows = Object.entries(COMPLICATIONS)
    .map(([k, v]) => [Number(k), v] as [number, string])
    .sort((a, b) => a[0] - b[0])

  return lines(
    `### Complications (Table 6)`,
    ``,
    `Source: \`lib/xse-schema.ts\` COMPLICATIONS.`,
    ``,
    tableHeader(['2d6', 'Complication']),
    ...rows.map(([roll, name]) => tableRow([roll, name])),
  )
}

function motivationsTable(): string {
  const rows = Object.entries(MOTIVATIONS)
    .map(([k, v]) => [Number(k), v] as [number, string])
    .sort((a, b) => a[0] - b[0])

  return lines(
    `### Motivations (Table 7)`,
    ``,
    `Source: \`lib/xse-schema.ts\` MOTIVATIONS.`,
    ``,
    tableHeader(['2d6', 'Motivation']),
    ...rows.map(([roll, name]) => tableRow([roll, name])),
  )
}

function professionsTable(): string {
  return lines(
    `### Professions (Table 8) — ${PROFESSIONS.length} canonical professions, 5 skills each`,
    ``,
    `Source: \`lib/xse-schema.ts\` PROFESSIONS.`,
    ``,
    tableHeader(['Profession', 'Skills']),
    ...PROFESSIONS.map(p => tableRow([p.name, p.skills.join(', ')])),
  )
}

function backstorySteps(): string {
  return lines(
    `### Backstory steps`,
    ``,
    `Source: \`lib/xse-schema.ts\` BACKSTORY_STEPS. Total: **${BACKSTORY_STEPS.reduce((a, s) => a + s.attributeCDP + s.skillCDP, 0)} CDP** (${BACKSTORY_STEPS.reduce((a, s) => a + s.attributeCDP, 0)} attribute + ${BACKSTORY_STEPS.reduce((a, s) => a + s.skillCDP, 0)} skill).`,
    ``,
    tableHeader(['Step', 'Title', 'Attr CDP', 'Skill CDP', 'Max attr', 'Max skill']),
    ...BACKSTORY_STEPS.map((s, i) =>
      tableRow([
        i,
        s.title,
        s.attributeCDP,
        s.skillCDP,
        s.maxAttributeLevel || '–',
        s.maxSkillLevel || '–',
      ]),
    ),
    ``,
    `**Step Four** is the Profession step — pick a Profession from the table above, allocate 4 skill CDP to that Profession's bundle.`,
    `**Step Six** is Complications & Motivations — choose or roll 2d6.`,
  )
}

function paradigms(): string {
  const rapidStr = (r: { RSN: number; ACU: number; PHY: number; INF: number; DEX: number }) =>
    `${r.RSN}-${r.ACU}-${r.PHY}-${r.INF}-${r.DEX}`

  const overview = [
    heading(3, `Paradigms — ${PARADIGMS.length} canonical paradigms`),
    `Source: \`lib/xse-schema.ts\` PARADIGMS. The platform has exactly ${PARADIGMS.length} Paradigms, one per Profession.`,
    ``,
    tableHeader(['Paradigm', 'Profession', 'RAPID (R-A-P-I-D)']),
    ...PARADIGMS.map(p => tableRow([p.name, p.profession, rapidStr(p.rapid)])),
    ``,
  ].join('\n')

  const detail = PARADIGMS.map(p => {
    const skills = p.skills
      .map(s => `${s.skillName} ${s.level}`)
      .join(', ')
    const equip = p.equipment ? p.equipment.join(', ') : '—'
    return [
      `#### ${p.name} (${p.profession})`,
      `**RAPID**: ${rapidStr(p.rapid)} (R-A-P-I-D).`,
      `**Skills**: ${skills}.`,
      p.weaponPrimary
        ? `**Weapons**: ${p.weaponPrimary} (primary), ${p.weaponSecondary ?? '—'} (secondary).`
        : '',
      p.equipment ? `**Equipment**: ${equip}.` : '',
      ``,
    ]
      .filter(Boolean)
      .join('\n')
  }).join('\n')

  return overview + '\n' + detail + '\n'
}

function lastingWounds(): string {
  const rows = Object.entries(LASTING_WOUNDS)
    .map(([k, v]) => [Number(k), v] as [number, { name: string; effect: string }])
    .sort((a, b) => a[0] - b[0])

  return lines(
    `### Lasting Wounds (Table 12)`,
    ``,
    `Source: \`lib/xse-schema.ts\` LASTING_WOUNDS.`,
    ``,
    `A character who is Mortally Wounded must make a Physicality check to avoid taking 1 Lasting Wound. On failure, roll 2d6 on Table 12. **Lasting Wounds are permanent** and cannot be healed.`,
    ``,
    tableHeader(['2d6', 'Wound', 'Effect']),
    ...rows.map(([roll, w]) => tableRow([roll, w.name, w.effect])),
  )
}

function breakingPoint(): string {
  const rows = Object.entries(BREAKING_POINT)
    .map(([k, v]) => [Number(k), v] as [number, { name: string; effect: string }])
    .sort((a, b) => a[0] - b[0])

  return lines(
    `### Breaking Point (Table 13)`,
    ``,
    `Source: \`lib/xse-schema.ts\` BREAKING_POINT.`,
    ``,
    `When Stress Level reaches 5, roll 2d6 on Table 13. The reaction lasts **1d6 rounds**. Once resolved, Stress Level resets to 0.`,
    ``,
    tableHeader(['2d6', 'Reaction', 'Effect (during 1d6 rounds)']),
    ...rows.map(([roll, r]) => tableRow([roll, r.name, r.effect])),
  )
}

function meleeWeapons(): string {
  return lines(
    `### Melee Weapons (Table 16) — ${MELEE_WEAPONS.length} canonical melee weapons`,
    ``,
    `Source: \`lib/xse-schema.ts\` MELEE_WEAPONS. Format: \`name | skill | range | rarity | damage | RP% | enc | traits\`.`,
    ``,
    ...MELEE_WEAPONS.map(w => {
      const traits = w.traits.length
        ? w.traits.map(t => (t.value ? `${t.name}(${t.value})` : t.name)).join(', ')
        : '–'
      const dmg = w.damageDice ? `${w.damageBase}+${w.damageDice}` : String(w.damageBase)
      return `- ${w.name} | ${w.skill} | ${w.range} | ${w.rarity} | ${dmg} | ${w.rpPercent}% | ${w.enc} | ${traits}`
    }),
  )
}

function rangedWeapons(): string {
  return lines(
    `### Ranged Weapons (Table 17) — ${RANGED_WEAPONS.length} canonical ranged weapons`,
    ``,
    `Source: \`lib/xse-schema.ts\` RANGED_WEAPONS.`,
    ``,
    ...RANGED_WEAPONS.map(w => {
      const traits = w.traits.length
        ? w.traits.map(t => (t.value ? `${t.name}(${t.value})` : t.name)).join(', ')
        : '–'
      const dmg = w.damageDice ? `${w.damageBase}+${w.damageDice}` : String(w.damageBase)
      return `- ${w.name} | ${w.range} | ${w.rarity} | ${dmg} | ${w.rpPercent}% | ${w.enc} | ammo ${w.ammoRarity}, clip ${w.clipSize} | ${traits}`
    }),
  )
}

function equipmentList(): string {
  return lines(
    `### Equipment (Table 20) — ${EQUIPMENT.length} canonical equipment items`,
    ``,
    `Source: \`lib/xse-schema.ts\` EQUIPMENT.`,
    ``,
    EQUIPMENT.map(e => e.name).join(', ') + '.',
  )
}

// ----------------------------
// Hard-coded prose blocks (sourced from app/rules/* JSX)
// ----------------------------

const PROSE_CORE_MECHANICS = `## §02 Core Mechanics

### Dice Check format

> 2d6 + Attribute Modifier (AMod) + Skill Modifier (SMod) + Conditional Modifier (CMod)

Total of 9 or above is a Success.

### Insight Dice

Source: \`app/rules/core-mechanics/insight-dice/page.tsx\`.

Characters get **2 Insight Dice on creation** and gain an additional one each time they roll a Moment of Insight (double-1 or double-6). Common uses:

- Roll an extra d6 prior to the Dice Check (3d6 total).
- Add a +3 CMod to the Dice Check before rolling.
- After a Dice Check, drop one or both dice and replace each with an Insight Die rolled fresh.
- Spend Insight Dice for a flashback, retcon, or anything else the player can Make The Case for.
- Spend an Insight Die to introduce a story element (with GM approval and a successful Make The Case).
- Spend ALL available Insight Dice to recover **1 Wound Point + 1 Resilience Point per die surrendered** and save the character from Death.

Restrictions: Insight Dice are non-transferable, cannot transfer between characters, and **cannot re-roll a Moment of Low Insight**. They carry over from session to session.

### Group Check

Source: \`app/rules/core-mechanics/attribute-checks/page.tsx\`.

Multiple players attempting the same task can pool their abilities. Everyone must be using the same attribute or skill (even if they have 0). The player with the highest relevant AMod or SMod makes the check and applies any AMods or SMods from the other characters taking part. **Insight Dice cannot be spent as part of a Group Check**, but if the outcome is a Moment of Insight, all participants receive an Insight Die.

### Opposed Check

Source: \`app/rules/core-mechanics/attribute-checks/page.tsx\`.

The outcome is determined by the first side to roll a Success, Wild Success, or Moment of High Insight while the other simultaneously rolls a Failure, Dire Failure, or Moment of Low Insight. If both sides roll the same outcome tier, the result is negated and play continues until a clear winner emerges.

### Perception Check

A player who wants to know if their character notices subtle details makes a Perception Check using the secondary stat **Perception (RSN + ACU AMod)** as a modifier.

### First Impressions

Source: \`app/rules/core-mechanics/first-impressions/page.tsx\`.

Uses **Influence + an appropriate skill (Manipulation, Streetwise, Psychology\\*, etc.)**. Outcome ladder: Wild Success (14+) → +1 CMod; Moment of High Insight (6+6) → +2 CMod + Insight Die; Success (9–13) → 0; Failure (4–8) → -1 CMod; Dire Failure (0–3) → -2 CMod; Moment of Low Insight (1+1) → -3 CMod + Insight Die.

### Gut Instincts

Uses the **Perception modifier**, or an appropriate skill (Psychology\\*, Streetwise, Tactics\\*).
`

const PROSE_SECONDARY_STATS = `### Secondary Stats (Table 5)

Source: \`lib/xse-schema.ts\` deriveSecondaryStats. These are the ground-truth formulas.

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
`

const PROSE_COMBAT = `## §06 Combat

### Combat Rounds

Combat rounds last approximately **3–6 seconds**. Each round has three phases: **Initiative**, **Action**, **Recovery**.

### Initiative

Each participant rolls **2d6 + Initiative Mod (ACU + DEX)**. Highest goes first. Ties between PCs and NPCs go to the PC; ties between PCs act simultaneously. In subsequent rounds, any participant who was neither attacked nor attacked anyone else gets a **+1** on their next Initiative check.

### Get The Drop

Before combat starts, one character can preemptively Get The Drop and take a single combat action before anyone else rolls for initiative. If multiple characters attempt it, the one with the highest combined **DEX + ACU AMods** wins. Any character who Got The Drop incurs a **−2 CMod** on their next Initiative roll.

### Combat Actions (Table 10) — 17 canonical actions

Source: \`app/rules/combat/combat-rounds/page.tsx\`. Each character gets **2 Combat Actions per round**.

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

Source: \`app/rules/combat/range/page.tsx\`.

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
- **Stabilise**: Successful **Medicine\\*** check, OR Wild Success on Reason. Once Stabilised, Incapacitated for **16 − PHY AMod** rounds (min 1), then 1 WP + 1 RP.
- **Death**: prevented only by spending ALL Insight Dice — character lives with 1 WP + 1 RP per die surrendered.
- **Healing**: never-MW heal 1 WP/day; was-MW heal 1 WP/2 days; resting recovers 1 RP/hour.

### Stress & Breaking Point

Stress starts at 0, max 5. Rises by 1 on a failed Stress Check (2d6 + RSN + ACU AMod) or when entering 0 WP / 0 RP (Tapestry house rule). At 5, roll 2d6 on Table 13 — reaction lasts 1d6 rounds, then Stress resets to 0. **Cooling Off**: Stress drops by 1 per 8 uninterrupted in-game hours free from combat/conflict/threat doing something the character enjoys.
`

const PROSE_NOT_ON_PLATFORM = `## What's NOT on the platform

Things the Distemper Quickstart historically referenced but **do not exist** on the platform — these should be deleted from any Quickstart audit.

**Skills that don't exist** (with platform replacement):

- Intimidation → Manipulation (or Psychology\\* if reading/exploiting)
- Hunting → Survival (tracking) or Ranged Combat (shooting)
- First Aid → Medicine\\*
- Surgery\\* → Medicine\\*
- Pharmacology\\* → Medicine\\*
- Vehicle Repair\\* → Mechanic\\*
- Armorsmith\\* → Mechanic\\*
- General Knowledge → Specific Knowledge

**Mechanics that don't exist**:

- Panic Threshold (replaced by Stress / Stress Modifier / Breaking Point)

**Paradigms that don't exist** (on the platform):

- Beat Cop, Cosmetic Surgeon, Family Doctor, Flea Market Trader, Semi-Pro Athlete, Trucker.
- "Mayor" was renamed to **Small Town Mayor**.

**Skills the Quickstart's inner-cover mentions for First Impressions / Negotiations that aren't on platform**: Charm, Deception, Perception (Perception is a Secondary Stat, not a skill).
`

// ----------------------------
// Main
// ----------------------------

function main() {
  const out = [
    header(),
    PROSE_CORE_MECHANICS,
    outcomesSection(),
    modifierTables(),
    `## §03 Character Overview`,
    skillsTable(),
    PROSE_SECONDARY_STATS,
    `## §04 Character Creation`,
    backstorySteps(),
    complicationsTable(),
    motivationsTable(),
    professionsTable(),
    paradigms(),
    PROSE_COMBAT,
    lastingWounds(),
    breakingPoint(),
    `## §07 Weapons & Equipment`,
    meleeWeapons(),
    rangedWeapons(),
    equipmentList(),
    PROSE_NOT_ON_PLATFORM,
  ].join('\n')

  process.stdout.write(out)
}

main()
