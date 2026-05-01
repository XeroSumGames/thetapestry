// lib/help-text.ts
// Central copy for in-app tooltips. Game-term explanations, attribute
// descriptions, skill-tier labels, etc. — single source of truth so a
// rule clarification only needs to change once.
//
// SKILLS[].description (lib/xse-schema.ts) and TRAIT_DESCRIPTIONS
// (lib/weapons.ts) already exist and are the canonical sources for
// skill + weapon-trait copy. Don't duplicate them here; import them
// directly where needed. This file holds the OTHER terms that don't
// have a home — RAPID attributes, CDP, the modifier triad, vocational
// skills, etc.

import type { AttributeName } from './xse-schema'

// ── RAPID attribute descriptions ────────────────────────────────────
// Short prose explainer per attribute. Used by tooltips on every
// surface that displays the attribute key (RSN / ACU / etc.).
export const ATTRIBUTE_DESCRIPTIONS: Record<AttributeName, string> = {
  RSN: 'Reason — logic, pattern recognition, planning, memory recall. Drives Research, Tactics, Medicine, Mechanic, Demolitions.',
  ACU: 'Acumen — perception, awareness, attention to detail. Drives Perception, Survival, Streetwise, Lock-Picking, Stealth.',
  PHY: 'Physicality — raw strength, endurance, hardiness. Drives Athletics, Melee Combat, Unarmed Combat, Heavy Weapons. Affects max WP and Encumbrance.',
  INF: 'Influence — charisma, persuasion, reading people. Drives Manipulation, Inspiration, Psychology, Barter, Entertainment.',
  DEX: 'Dexterity — hand-eye coordination, reflexes, fine motor control. Drives Ranged Combat, Sleight of Hand, Tinkerer, Animal Handling. Affects Initiative.',
}

// ── Modifier triad (CMod / AMod / SMod) ─────────────────────────────
// Used in tooltip rollovers wherever these abbreviations appear in
// roll modals, weapon cards, and step UIs.
export const MODIFIER_DESCRIPTIONS = {
  AMod: 'Attribute Modifier — added to dice rolls based on the attribute driving the check (RSN +2 = +2 AMod). Permanent, derived from RAPID.',
  SMod: 'Skill Modifier — added when the skill applies. Equals the skill level (Beginner +1, Journeyman +2, Professional +3, Life\'s Work +4).',
  CMod: 'Conditional Modifier — situational bonus or penalty applied to a single roll. Range, weapon condition, defensive cover, GM rulings — anything tactical.',
} as const

// ── CDP ─────────────────────────────────────────────────────────────
export const CDP_DESCRIPTION =
  'Character Development Points — the budget you spend during creation to raise RAPID attributes and skills. ' +
  'After creation, the GM awards CDP for sessions / milestones. Earned CDP is spent via the Evolution surface ' +
  'on the character sheet to grow the character over time.'

// ── Vocational skills ───────────────────────────────────────────────
export const VOCATIONAL_DESCRIPTION =
  'Vocational skills (marked with *) start at Inept (-3) instead of Untrained (0). ' +
  'They take dedicated training; you can\'t pick one up casually. Spending 1 CDP on a vocational skill ' +
  'jumps it directly from -3 to Beginner (+1) — the prior step is skipped.'

// ── Skill tier labels ───────────────────────────────────────────────
// SkillValue runs -3, 0, 1, 2, 3, 4. Each tier has a canonical name.
export const SKILL_TIER_LABELS: Record<number, string> = {
  [-3]: 'Inept',
  0: 'Untrained',
  1: 'Beginner',
  2: 'Journeyman',
  3: 'Professional',
  4: "Life's Work",
}

export const SKILL_TIER_DESCRIPTION =
  'Skill levels: Inept (-3) · Untrained (0) · Beginner (+1) · Journeyman (+2) · Professional (+3) · Life\'s Work (+4). ' +
  'The numeric value is your SMod when the skill applies. Caps per step keep early-life skills from over-tuning a single discipline.'

// ── Rarity ──────────────────────────────────────────────────────────
export const RARITY_DESCRIPTION =
  'Rarity affects scavenging odds, trade value, and how much GM scrutiny attaches to acquisition. ' +
  'Common items are everywhere; Uncommon takes effort to find; Rare items are GM-gated and usually one-of-a-kind.'

// ── Encumbrance ─────────────────────────────────────────────────────
export const ENCUMBRANCE_DESCRIPTION =
  'Encumbrance (ENC) is your carry budget. Limit = 6 + PHY AMod (a Backpack adds +2). ' +
  'Going over imposes -1 to physical checks; staying over for an hour costs 1 RP per hour over limit.'

// ── Weapon range bands ──────────────────────────────────────────────
export const RANGE_BAND_DESCRIPTIONS: Record<string, string> = {
  Engaged: 'Engaged — within 5 feet (touching distance). Melee strikes, point-blank fire.',
  Close: 'Close — within 30 feet. Pistol territory, thrown weapons, short bursts.',
  Medium: 'Medium — within 100 feet. Carbines, hunting rifles, shotgun reach.',
  Long: 'Long — within 300 feet. Rifle effective range, crossbow extreme.',
  Distant: 'Distant — beyond 300 feet. Sniper territory, mortar lobs.',
}

// ── Stress / Breaking Point / Lasting Wound ─────────────────────────
// Not currently surfaced in character creation, but useful for the
// progression tooltips on the character sheet.
export const STRESS_DESCRIPTION =
  'Stress accumulates as your PC takes psychological hits. At 5 stress, the next event triggers a Stress Check ' +
  '(2d6 + RSN + ACU + CMod). Failure rolls on Table 13 — Breaking Point — for a temporary mental break.'

export const BREAKING_POINT_DESCRIPTION =
  'Breaking Point — a 2d6 roll on Table 13 mapping a temporary mental break to your character. ' +
  'Lasts 1d6 hours and applies a stat penalty during that time. Stress resets to 0 after the break.'

export const LASTING_WOUND_DESCRIPTION =
  'When a PC drops to 0 Wound Points (mortally wounded), they roll a Physicality Check (2d6 + PHY). ' +
  'On failure, they roll Table 12 — Lasting Wound — for a permanent stat penalty. Cannot be healed.'

// ── Insight Dice ────────────────────────────────────────────────────
export const INSIGHT_DICE_DESCRIPTION =
  'Insight Dice are awarded on Wild Success / Dire Failure rolls. ' +
  'Spend 1 before a roll for either a +3 CMod boost OR to roll 3d6 keeping all three faces. ' +
  'Spend 1 after a roll to reroll a single die. Capped at 10 per character.'
