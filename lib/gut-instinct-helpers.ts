// Gut Instinct - pure helpers extracted from the legacy pendingRoll
// path in app/stories/[id]/table/page.tsx during the migration to a
// dedicated <RollModal> (2026-05-20). Companion to lib/stabilize-helpers.ts
// and lib/distract-helpers.ts.
//
// Canon: Gut Instinct = Perception (RSN + ACU AMod) + best of Psychology
// / Streetwise / Tactics. No target, no action consumption tied to the
// check itself; if the rolling PC is the active combatant, closeRollModal
// gating applies (which we preserve in the dedicated modal). On any
// outcome, the rolling client broadcasts `gut_instinct_resolved` so the
// GM/Thriver client opens its existing whisper-detail modal (shipped
// 2026-05-19, adb9382) to send a private "you sense..." line to the
// player. No outcome ladder for state changes - the GM tunes the
// whisper to the dice result.

/** The three sub-skills any of which can drive the Gut Instinct SMod.
 *  Locked order; the picker is pure max() so the order is only for
 *  documentation. */
export const GUT_INSTINCT_SUB_SKILLS = ['Psychology', 'Streetwise', 'Tactics'] as const

/** Pick the highest-level entry among Gut Instinct's sub-skills, returning
 *  its level (0 if the character has none of them). Mirrors the legacy
 *  triggerGutInstinct logic at page.tsx L3812-3815. */
export function gutInstinctSmod(skills: Array<{ skillName?: string; level?: number }> | null | undefined): number {
  if (!Array.isArray(skills)) return 0
  let best = 0
  for (const s of skills) {
    if (!s || typeof s.skillName !== 'string') continue
    if (!GUT_INSTINCT_SUB_SKILLS.includes(s.skillName as typeof GUT_INSTINCT_SUB_SKILLS[number])) continue
    const lvl = typeof s.level === 'number' ? s.level : 0
    if (lvl > best) best = lvl
  }
  return best
}
