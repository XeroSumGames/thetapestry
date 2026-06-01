// Centralized combat-damage state transition (pure + testable).
//
// When WP/RP damage lands on a combatant, the SAME downstream rules must
// fire no matter which path applied it (a weapon attack, a Subdue choke, an
// AoE splash). The bug class this prevents: one path computes "entered
// mortal / incap + the Stress pip" and another forgets to (SMOKE-1 lesson,
// 2026-05-21 - follow-on logic gated on a state change must be centralized,
// not duplicated per path).
//
// This module owns the DECISION (new WP/RP/Stress + which transitions fired).
// Each caller still performs its own DB write + side effects (log rows,
// broadcasts, the insight-save prompt, nextTurn) off these flags - but the
// math + the canon rules live here, once.
//
// Canon:
//   - Mortally wounded when WP first hits 0 (death countdown = max(1, 4+PHY)).
//   - Incapacitated when RP first hits 0 AND not simultaneously mortal
//     (incap rounds = max(1, 4-PHY)).
//   - Entering either state fills exactly ONE Stress pip (cap 5). Mortal
//     preempts incap, so only one pip per event.
//   - Negative incoming damage never heals (floored at 0).

import { mortalWoundCountdown } from './table-roll-context'

export interface DamageTargetState {
  wp_current: number
  rp_current: number
  stress: number
  /** Physicality AMod - drives both countdowns. */
  phyMod: number
}

export interface DamageInput {
  wp: number
  rp: number
}

export interface DamageTransition {
  newWP: number
  newRP: number
  newStress: number
  /** WP crossed to 0 on this hit. */
  becameMortal: boolean
  /** RP crossed to 0 on this hit (and not simultaneously mortal). */
  becameIncap: boolean
  /** Death countdown to write when becameMortal; else null. */
  deathCountdown: number | null
  /** Incap rounds to write when becameIncap; else null. */
  incapRounds: number | null
  /** Reason string for the Stress-pip log row, or null when no pip. */
  stressReason: 'Mortally Wounded' | 'Incapacitated' | null
}

export function applyDamageTransition(s: DamageTargetState, dmg: DamageInput): DamageTransition {
  const wpDealt = Math.max(0, dmg.wp)
  const rpDealt = Math.max(0, dmg.rp)
  const newWP = Math.max(0, s.wp_current - wpDealt)
  const newRP = Math.max(0, s.rp_current - rpDealt)

  const becameMortal = newWP === 0 && s.wp_current > 0
  // Incap only when RP bottoms out, the target is still alive (WP > 0), and
  // it isn't the same hit that mortally wounded them.
  const becameIncap = !becameMortal && newRP === 0 && s.rp_current > 0 && newWP > 0

  const stressReason: DamageTransition['stressReason'] =
    becameMortal ? 'Mortally Wounded' : becameIncap ? 'Incapacitated' : null
  const newStress = stressReason ? Math.min(5, s.stress + 1) : s.stress

  return {
    newWP,
    newRP,
    newStress,
    becameMortal,
    becameIncap,
    deathCountdown: becameMortal ? mortalWoundCountdown(s.phyMod) : null,
    incapRounds: becameIncap ? Math.max(1, 4 - s.phyMod) : null,
    stressReason,
  }
}
