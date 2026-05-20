// Stabilize action - pure helpers extracted from the legacy pendingRoll
// path in app/stories/[id]/table/page.tsx. The full migration to a
// dedicated <RollModal> (Phase 1 of the Stabilize-migration spec) keeps
// the deterministic bits here so they can be unit-tested without
// pulling in the table page's 11k-line render context.
//
// The cascade itself (DB writes, state updates, progression log) still
// lives inside the table page because it needs the live entries /
// campaignNpcs closure - but every "what should happen" decision is
// answered by a function below. The cascade is the imperative shell
// around this pure core.
//
// Canon: CRB p.116 + roll-feed STABILIZE prefix (lib/roll-helpers.ts
// L425-443). Locked 2026-05-19.

import { OUTCOME } from './roll-outcomes'

/** A Stabilize roll succeeds on Success, Wild Success, or High Insight.
 *  All three of Failure / Dire Failure / Low Insight leave the patient
 *  still bleeding. Mirrors the per-outcome ladder in the roll-feed
 *  narrative (STABILIZE prefix). */
export function isStabilizeSuccess(outcome: string): boolean {
  return outcome === OUTCOME.Success
    || outcome === OUTCOME.WildSuccess
    || outcome === OUTCOME.HighInsight
}

/** Incapacitation rounds rolled when a stabilize succeeds. Canon:
 *  1d6 - PHY AMod, floored at 1 (the patient is always at least 1 round
 *  unconscious before regaining WP/RP). Negative PHY AMods (frail
 *  characters) ADD rounds; positive AMods reduce.
 *
 *  `rng` is injectable for deterministic tests; production passes
 *  Math.random implicitly. */
export function rollIncapRounds(phyAmod: number, rng: () => number = Math.random): number {
  const d6 = Math.floor(rng() * 6) + 1
  return Math.max(1, d6 - phyAmod)
}

/** Banner narrative shown in the dedicated modal's post-roll panel.
 *  Mirrors the legacy executeRoll path's `stabilizeResult` string
 *  (page.tsx L6141 / L6159) so the migration is behaviour-preserving.
 *  Failed stabilize narrative is intentionally terse - the medic gets
 *  no extra detail beyond the patient still being down. */
export function stabilizeNarrative(success: boolean, targetName: string, incapRounds: number): string {
  if (!success) return `Failed to stabilize ${targetName}.`
  const roundWord = incapRounds === 1 ? 'round' : 'rounds'
  return `${targetName} stabilized! Incapacitated for ${incapRounds} ${roundWord}, then regains 1 WP + 1 RP.`
}
