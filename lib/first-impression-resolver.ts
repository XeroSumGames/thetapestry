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

import type { SupabaseClient } from '@supabase/supabase-js'
import { OUTCOME } from './roll-outcomes'
import { appendProgressionEntry } from './progression-log'

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

// ── Phase 2: side-effectful resolver ──────────────────────────────
// Single entry point for "First Impression roll completed — write
// everything." Used by the new <FirstImpressionModal> component to
// resolve a roll in one call instead of routing through executeRoll +
// RollModal. The legacy executeRoll FI branch stays alive during
// Phase 2 as a fallback; Phase 3 removes it.
//
// Does three best-effort writes (each independent — a failure in one
// doesn't block the others, and the caller surfaces the warnings):
//   1. roll_log row — the dice + outcome (mirrors executeRoll's
//      saveRollToLog shape for the FI label).
//   2. bump_npc_relationship_cmod RPC — atomic accumulate-with-clamp
//      on npc_relationships.relationship_cmod (±3). RPC runs as
//      SECURITY DEFINER per c30a34d so non-GM PCs can write their
//      own relationship rows.
//   3. progression_log append — "Met X - <vibe> (CMod <signed>).";
//      best-effort, never throws (matches appendProgressionEntry's
//      contract).
//
// Returns the canonical cmodDelta + vibe + any warnings the caller
// can surface inline.

export interface ResolveFirstImpressionArgs {
  supabase: SupabaseClient
  campaignId: string
  userId: string
  characterId: string
  characterName: string
  npcId: string
  npcName: string
  die1: number
  die2: number
  // Phase 3 (2026-05-19): when the player pre-spent an Insight Die on
  // 3d6, the raw d3 lands here and die2 holds the packed (d2+d3) value
  // per saveRollToLog's existing storage convention. null on normal
  // 2d6 + on the '+3cmod' Insight Die spend.
  die3?: number | null
  amod: number
  smod: number
  cmod: number
  total: number
  outcome: string
  // Which Insight Die variant (if any) the player pre-spent on this
  // roll. Stored in roll_log.insight_used so the extended log can
  // flag the 3d6 / +3cmod spends. null on no-spend.
  insightUsed?: '3d6' | '+3cmod' | null
}

export interface ResolveFirstImpressionResult {
  cmodDelta: number
  vibe: string
  warnings: string[]
}

export async function resolveFirstImpression(
  args: ResolveFirstImpressionArgs,
): Promise<ResolveFirstImpressionResult> {
  const { supabase, campaignId, userId, characterId, characterName, npcId, npcName,
          die1, die2, amod, smod, cmod, total, outcome } = args
  const die3 = args.die3 ?? null
  const insightUsed = args.insightUsed ?? null
  const cmodDelta = firstImpressionCmodDelta(outcome)
  const vibe = firstImpressionVibe(cmodDelta)
  const warnings: string[] = []
  // HI/LI auto-award flag matches saveRollToLog at page.tsx:4643. PC
  // rollers always qualify (the FI modal only runs for PC rollers,
  // and non-antagonist NPC carve-out doesn't apply here).
  const insightAwarded = outcome === 'High Insight' || outcome === 'Low Insight'

  // 1. roll_log entry. die3 lives in damage_json per saveRollToLog's
  // existing convention so the extended-log renderer can show
  // [d1 + (d2 + die3 insight)] for 3d6 spends.
  try {
    const damageJson = die3 != null ? { die3 } : null
    const { error } = await supabase.from('roll_log').insert({
      campaign_id: campaignId,
      user_id: userId,
      character_name: characterName,
      label: `${characterName} - First Impression (${npcName})`,
      die1, die2, amod, smod, cmod, total, outcome,
      insight_awarded: insightAwarded,
      insight_used: insightUsed,
      damage_json: damageJson,
    })
    if (error) warnings.push(`roll_log: ${error.message}`)
  } catch (e: any) {
    warnings.push(`roll_log: ${e?.message ?? String(e)}`)
  }

  // 2. Atomic relationship bump (SECURITY DEFINER, RPC at
  // sql/npc-relationship-cmod-rpc-security-definer-2026-05-19.sql).
  try {
    const { error } = await supabase.rpc('bump_npc_relationship_cmod', {
      p_npc_id: npcId,
      p_character_id: characterId,
      p_delta: cmodDelta,
      p_set_revealed: true,
      p_reveal_level: 'name_portrait',
    })
    if (error) warnings.push(`bump_npc_relationship_cmod: ${error.message}`)
  } catch (e: any) {
    warnings.push(`bump: ${e?.message ?? String(e)}`)
  }

  // 3. Progression log entry. appendProgressionEntry swallows its own
  // errors but we still try/catch as belt + suspenders.
  try {
    await appendProgressionEntry(
      supabase, characterId, 'relationship',
      firstImpressionProgressionMessage(npcName, cmodDelta),
    )
  } catch (e: any) {
    warnings.push(`progression_log: ${e?.message ?? String(e)}`)
  }

  return { cmodDelta, vibe, warnings }
}
