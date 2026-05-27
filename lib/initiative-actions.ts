// Shared helper for decrementing the active initiative entry's
// actions_remaining. Used by:
//  - app/stories/[id]/table/page.tsx (its consumeAction() wraps this)
//  - app/vehicle/page.tsx (popout vehicle attacks fire from a different
//    page where the table's consumeAction is unreachable)
//
// Scope: pure DB operations only. Callers handle in-flight locks, nextTurn
// cascades, local state refresh, and broadcast notifications themselves.
//
// Returning `reachedZero: true` is the caller's signal to advance the turn
// (either by calling nextTurn() locally on the table page, or by sending
// a turn_advance_requested broadcast from a remote page that doesn't own
// the initiative state).

import type { SupabaseClient } from '@supabase/supabase-js'
import { OUTCOME } from './roll-outcomes'

// A campaign_npcs record as far as initiative cares - just the fields that
// flow onto the initiative_order row. Loosely typed (the real rows carry more).
export interface InitiativeNpcLike {
  id: string
  name?: string | null
  acumen?: number | null
  dexterity?: number | null
  portrait_url?: string | null
  npc_type?: string | null
}

// Build the initiative_order insert row for an NPC added to combat. When `npc`
// is a roster record (the GM picked one), the row LINKS to it via npc_id and
// rolls 2d6 + ACU + DEX, carrying portrait + type - identical to combat-start,
// so the next-round reroll can find its modifier. When `npc` is null (an ad-hoc
// free-text combatant), npc_id is null and it rolls a plain 2d6. The two d6 are
// passed in so this stays pure (the caller owns the RNG) and unit-testable.
export function buildNpcInitiativeRow(args: {
  campaignId: string
  name: string
  npc: InitiativeNpcLike | null
  d1: number
  d2: number
}) {
  const { campaignId, name, npc, d1, d2 } = args
  return {
    campaign_id: campaignId,
    character_name: npc?.name ?? name,
    character_id: null as string | null,
    user_id: null as string | null,
    npc_id: npc?.id ?? null,
    portrait_url: npc?.portrait_url ?? null,
    npc_type: npc?.npc_type ?? null,
    roll: d1 + d2 + (npc?.acumen ?? 0) + (npc?.dexterity ?? 0),
    is_active: false,
    is_npc: true,
    actions_remaining: 2,
  }
}

export type DecrementResult = {
  ok: boolean
  newRemaining: number
  reachedZero: boolean
  entry: { id: string; character_name: string; actions_remaining: number; is_active: boolean } | null
  error?: string
}

export type DecrementArgs = {
  campaignId: string
  entryId?: string              // If known (table page). Otherwise we look up the active entry for the campaign.
  userId?: string | null
  actionLabel?: string          // Logged to roll_log as outcome:'action' if provided.
  cost?: number                 // Default 1.
}

export async function decrementInitiativeAction(
  supabase: SupabaseClient,
  args: DecrementArgs
): Promise<DecrementResult> {
  const cost = args.cost ?? 1

  // Resolve the entry we're decrementing.
  let entry: any = null
  if (args.entryId) {
    const { data, error } = await supabase
      .from('initiative_order')
      .select('*')
      .eq('id', args.entryId)
      .single()
    if (error) return { ok: false, newRemaining: 0, reachedZero: false, entry: null, error: error.message }
    entry = data
  } else {
    const { data, error } = await supabase
      .from('initiative_order')
      .select('*')
      .eq('campaign_id', args.campaignId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) return { ok: false, newRemaining: 0, reachedZero: false, entry: null, error: error.message }
    if (!data) return { ok: false, newRemaining: 0, reachedZero: false, entry: null, error: 'no active entry' }
    entry = data
  }

  const remaining = entry.actions_remaining ?? 0
  if (remaining < cost) {
    return {
      ok: false,
      newRemaining: remaining,
      reachedZero: false,
      entry,
      error: `insufficient actions: ${remaining} < ${cost}`,
    }
  }

  const newRemaining = remaining - cost

  // Optional action-feed log entry. Best-effort - failure here doesn't roll
  // back the decrement; we'd rather have a missing log line than a stuck turn.
  if (args.actionLabel) {
    try {
      await supabase.from('roll_log').insert({
        campaign_id: args.campaignId,
        user_id: args.userId ?? null,
        character_name: entry.character_name,
        label: args.actionLabel,
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
        outcome: OUTCOME.action,
      })
    } catch { /* swallow */ }
  }

  // Persist the decrement. Use .select() so a silent RLS rejection
  // (0 rows updated, no error) is distinguishable from a real update.
  const { data: updData, error: updErr } = await supabase
    .from('initiative_order')
    .update({ actions_remaining: newRemaining })
    .eq('id', entry.id)
    .select('id, actions_remaining')
  if (updErr) {
    return { ok: false, newRemaining: remaining, reachedZero: false, entry, error: updErr.message }
  }
  if (!updData || updData.length === 0) {
    return { ok: false, newRemaining: remaining, reachedZero: false, entry, error: 'silent RLS fail (0 rows)' }
  }

  return {
    ok: true,
    newRemaining,
    reachedZero: newRemaining <= 0,
    entry,
  }
}
