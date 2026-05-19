// First Impression roll resolution — pure helpers extracted from
// app/stories/[id]/table/page.tsx (executeRoll's FI branch) as Phase 1
// of the FI streamline (see chat 2026-05-19). All three functions are
// side-effect-free and unit-tested.
//
// Phases 2 + 3 will fold the side-effectful RPC + progression-log
// callers into a single resolver function; Phase 1 just splits the
// pure ladder out so executeRoll shrinks and the SRD math is locked
// behind tests.
//
// Source of truth for the ladder: SRD v1.1.17 §07 First Impression.
// Canon fix history (lessons): the pre-2026-05-10 code shifted every
// tier +1 (Success gave +1 instead of 0, Low Insight gave -2 instead
// of -3, etc). Tests below enshrine the corrected mapping.

import { OUTCOME } from './roll-outcomes'

// CMod delta by outcome. Stacks atomically via the
// bump_npc_relationship_cmod RPC, clamped to +/-3 server-side.
//
//   Moment of High Insight (6+6)  -> +2  (Insight Die awarded separately)
//   Wild Success (14+)            -> +1
//   Success (9-13)                ->  0  (NPC still revealed; no shift)
//   Failure (4-8)                 -> -1
//   Dire Failure (0-3)            -> -2
//   Moment of Low Insight (1+1)   -> -3  (Insight Die awarded separately)
export function firstImpressionCmodDelta(outcome: string): number {
  if (outcome === OUTCOME.HighInsight) return 2
  if (outcome === OUTCOME.WildSuccess) return 1
  if (outcome === OUTCOME.Success) return 0
  if (outcome === OUTCOME.Failure) return -1
  if (outcome === OUTCOME.DireFailure) return -2
  if (outcome === OUTCOME.LowInsight) return -3
  return 0
}

// Vibe label for the progression log entry, mapped to the CMod delta.
// Tracks the SRD ladder: +2 great / +1 good / 0 neutral / -1 rough /
// -2 bad / -3 catastrophic.
export function firstImpressionVibe(delta: number): string {
  if (delta >= 2) return 'great first impression'
  if (delta === 1) return 'good first impression'
  if (delta === 0) return 'neutral first impression'
  if (delta === -1) return 'rough start'
  if (delta === -2) return 'bad blood'
  return 'catastrophic first impression'
}

// Progression log message — what gets appended to the rolling PC's
// progression-log when the First Impression resolves. Format:
//   "Met <NpcName> - <vibe> (CMod <signed-delta>)."
// Signed: '+2' / '+0' / '-3' (no '+' on negatives; matches the
// existing log convention).
export function firstImpressionProgressionMessage(npcName: string, delta: number): string {
  const vibe = firstImpressionVibe(delta)
  const sign = delta >= 0 ? '+' : ''
  return `Met ${npcName} - ${vibe} (CMod ${sign}${delta}).`
}
