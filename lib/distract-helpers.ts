// Distract action - pure helpers extracted from the legacy pendingRoll
// path in app/stories/[id]/table/page.tsx during the Phase 2 migration
// to a dedicated <RollModal> (companion to lib/stabilize-helpers.ts;
// see tasks/spec-stabilize-migration.md).
//
// Canon: CRB §06 Combat Actions - Distract.
//   Wild Success / High Insight (6+6) -> target loses BOTH actions
//   Success                            -> target loses 1 action
//   Failure / Low Insight              -> no effect (still costs the attempt)
//   Dire Failure                       -> target GAINS 1 action ("Inspired")
//
// The narrative + delta logic is enshrined here so the dedicated
// modal can render outcome + cascade preview without re-implementing
// the ladder, and so the SRD math is locked behind unit tests.

import { OUTCOME } from './roll-outcomes'

/** Action delta to apply to the target's `initiative_order.actions_remaining`.
 *  Signed: negative drains, positive grants. Returns 0 for "no effect"
 *  outcomes - caller skips the DB write in that case (matches the
 *  legacy executeRoll behavior at page.tsx L6181). */
export function distractActionDelta(outcome: string): number {
  if (outcome === OUTCOME.WildSuccess || outcome === OUTCOME.HighInsight) return -2
  if (outcome === OUTCOME.Success) return -1
  if (outcome === OUTCOME.DireFailure) return +1
  // Failure + Low Insight + anything unexpected: no effect
  return 0
}

/** Banner narrative shown in the dedicated modal's post-roll panel.
 *  Mirrors the legacy executeRoll path's `distractResult` strings
 *  (page.tsx L6198-6203) so the migration is behaviour-preserving.
 *  `applied` distinguishes "the cascade fired and produced delta" from
 *  "no-op outcome" so the renderer can pick the right copy. */
export function distractNarrative(targetName: string, delta: number, applied: boolean): string {
  if (!applied) return `${targetName} shrugged off the distraction.`
  if (delta === -2) return `${targetName} loses BOTH actions this turn.`
  if (delta === -1) return `${targetName} loses 1 action.`
  if (delta === +1) return `${targetName} shrugs it off and gains an action - Inspired!`
  // Defensive: applied=true with delta=0 should never happen, but
  // fall back to the no-op narrative rather than producing an empty
  // banner.
  return `${targetName} shrugged off the distraction.`
}
