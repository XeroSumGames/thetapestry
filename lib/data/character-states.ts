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

/** Patch one character_states row. Drop-in for the inline update. */
export function updateCharacterState(id: string, patch: Update<'character_states'>) {
  return db().from('character_states').update(patch).eq('id', id)
}
