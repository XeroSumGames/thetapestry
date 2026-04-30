// CDP cost helpers — pure functions for the Character Evolution
// surface. SRD-canonical (per CLAUDE.md precedence: SRD wins on the
// SRD/CRB discrepancy around RAPID raise costs — see
// tasks/rules-extract-cdp.md §3b for the diff).
//
// Skills (both SRD + CRB agree):
//   Learn (any baseline → Lv 1 Beginner)   = 1 CDP
//   Raise N → N+1                          = N + (N+1) CDP   (= 2N+1)
//
// RAPID Range Attributes (SRD §07 — 3× new level):
//   Raise N → N+1                          = 3 × (N+1) CDP
//
// Vocational skills baseline at -3 (Inept) but the "Learn" jump still
// costs 1 CDP regardless of base, per SRD §07. This matches the
// existing skillStepUp helper in lib/xse-engine.ts.

import type { SkillValue } from './xse-schema'

/** Cost in CDP to raise a skill from `current` to `current+1` (or to
 *  Lv 1 from any negative baseline, treated as a single jump). */
export function skillRaiseCost(current: SkillValue): number | null {
  if (current >= 4) return null  // capped at Life's Work
  // Vocational baseline -3 → Lv 1 = 1 CDP. Non-vocational 0 → 1 = 1 CDP.
  if (current < 1) return 1
  // Standard ladder: 1→2 = 3, 2→3 = 5, 3→4 = 7.
  return current + (current + 1)
}

/** What level does a given current become after one CDP-spend step? */
export function skillNextLevel(current: SkillValue): SkillValue | null {
  if (current >= 4) return null
  if (current < 1) return 1
  return ((current + 1) as SkillValue)
}

/** Cost in CDP to raise a RAPID Range attribute from `current` to
 *  `current+1`. SRD §07 = 3 × the new level being purchased. */
export function rapidRaiseCost(current: number): number | null {
  if (current >= 4) return null  // capped at Human Peak
  return 3 * (current + 1)
}

/** Whether raising the given level next requires Fill-In-The-Gaps
 *  narrative justification. Per CRB Ch.6 — Lv 4 (Human Peak / Life's
 *  Work) is GM-approved + narrative-gated. */
export function isLv4Step(current: number): boolean {
  return current === 3
}
