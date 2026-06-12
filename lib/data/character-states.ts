// Repository: character_states (grand re-architecture Phase 1b/3 exemplar).
//
// Per-campaign live PC state (WP/RP/stress/insight/death). Same
// behavior-preserving convention as campaign-npcs: repos return the raw
// typed `{ data, error }` so call sites swap as true drop-ins.

import { db, type Row, type Update } from './db'

export type CharacterState = Row<'character_states'>

/** All live character states for a campaign. Drop-in for the inline select. */
export function getCharacterStates(campaignId: string) {
  return db().from('character_states').select('*').eq('campaign_id', campaignId)
}

/**
 * Party Status fetch: character_states scoped to currently-assigned characters.
 * Prefetches campaign_members to build the active character_id set so that stale
 * rows from reassigned players are excluded.
 */
export async function getPartyCharacterStates(campaignId: string) {
  const { data: members } = await db()
    .from('campaign_members')
    .select('character_id')
    .eq('campaign_id', campaignId)
  const currentCharIds = (members ?? []).map(m => m.character_id).filter((id): id is string => !!id)
  if (currentCharIds.length === 0) return { data: [], error: null }
  return db()
    .from('character_states')
    .select('id, character_id, wp_current, wp_max, rp_current, rp_max, stress')
    .eq('campaign_id', campaignId)
    .in('character_id', currentCharIds)
}

/** Patch one character_states row. Drop-in for the inline update. */
export function updateCharacterState(id: string, patch: Update<'character_states'>) {
  return db().from('character_states').update(patch).eq('id', id)
}
