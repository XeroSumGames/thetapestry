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

  // Optional action-feed log entry. Best-effort — failure here doesn't roll
  // back the decrement; we'd rather have a missing log line than a stuck turn.
  if (args.actionLabel) {
    try {
      await supabase.from('roll_log').insert({
        campaign_id: args.campaignId,
        user_id: args.userId ?? null,
        character_name: entry.character_name,
        label: args.actionLabel,
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
        outcome: 'action',
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
