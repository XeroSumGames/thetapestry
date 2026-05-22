// Repository: character_states (grand re-architecture Phase 1b exemplar).
//
// Per-campaign live PC state (WP/RP/stress/insight/death). Second exemplar
// of the lib/data pattern - a write-heavy health table, complementing the
// read-heavy campaign-npcs repo. Query shapes mirror the table page's
// existing character_states writes (e.g. the Restore-to-full flow).

import { db, type Row, type Update } from './db'

export type CharacterState = Row<'character_states'>

/** All live character states for a campaign. */
export async function getCharacterStates(campaignId: string): Promise<CharacterState[]> {
  const { data, error } = await db()
    .from('character_states')
    .select('*')
    .eq('campaign_id', campaignId)
  if (error) throw error
  return data ?? []
}

/**
 * Patch one character_states row and return it. Same `.select()`-after-
 * `.update()` discipline as the campaign-npcs repo (lessons.md). Mirrors
 * the Restore flow's `update({ wp_current, rp_current, ... }).eq('id', stateId)`.
 */
export async function updateCharacterState(id: string, patch: Update<'character_states'>) {
  return db()
    .from('character_states')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle()
}
