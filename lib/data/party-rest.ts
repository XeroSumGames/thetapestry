// Party Rest - one rest event, one clock advance, all PCs recover simultaneously.
// Used by the table-page GM Rest modal. Computes recovery for each PC then applies
// after the clock advance, so drainers settle before any recovery writes land.

import { createClient } from '../supabase-browser'
import { advance as advanceClock, type ClockState } from '../campaign-clock'
import { computeRestRecovery, type RestState } from '../rest'
import { reportSupabaseError } from '../supabase-errors'

export interface PartyRestResult {
  clock: ClockState | null
  recoveries: Array<{
    characterId: string
    name: string
    wpHeal: number
    rpGain: number
    stressDrop: number
    newWP: number
    newRP: number
    newStress: number
  }>
  error: string | null
}

/**
 * Orchestrate a single rest for all PCs in the campaign. Sequence:
 * 1. Advance the clock once (all drainers settle: rations, subsistence, infection)
 * 2. Read fresh character_states for each PC
 * 3. Apply computed recovery to each from their fresh state (no race with drainers)
 *
 * @param campaignId Campaign to rest
 * @param hours Total in-game hours to rest
 * @param restful GM affirmation that the rest was uninterrupted & enjoyable
 * @returns Clock state, per-PC recovery, and error (if any)
 */
export async function partyRest(
  campaignId: string,
  hours: number,
  restful: boolean,
): Promise<PartyRestResult> {
  if (hours <= 0) return { clock: null, recoveries: [], error: 'Hours must be > 0' }

  const supabase = createClient()

  // Step 1: Advance the campaign clock once. All drainers (rations, subsistence,
  // infection) run automatically inside advance(), consuming time off everyone.
  const clock = await advanceClock(campaignId, hours)
  if (!clock) {
    return {
      clock: null,
      recoveries: [],
      error: 'Failed to advance campaign clock',
    }
  }

  // Step 2: Read fresh character_states for all PCs in this campaign.
  // character_states join to characters to get the player-owned PC identities.
  const { data: states, error: statesErr } = await supabase
    .from('character_states')
    .select(
      'id, character_id, wp_current, wp_max, rp_current, rp_max, stress, death_countdown, infection_state, recovering_from_mortal_wound, characters!inner(id, name)',
    )
    .eq('campaign_id', campaignId)
    .not('character_id', 'is', null)

  if (statesErr) {
    reportSupabaseError(statesErr, 'partyRest:read-states')
    return {
      clock,
      recoveries: [],
      error: `Failed to read character states: ${statesErr.message}`,
    }
  }

  if (!states || states.length === 0) {
    return { clock, recoveries: [], error: null }
  }

  // Step 3: For each PC, compute recovery from their fresh state, then apply.
  const recoveries: PartyRestResult['recoveries'] = []
  for (const row of states as any[]) {
    try {
      const char = row.characters
      if (!char) continue

      // Build RestState from the fresh read.
      const restState: RestState = {
        wp_current: row.wp_current ?? 0,
        wp_max: row.wp_max ?? 999,
        rp_current: row.rp_current ?? 0,
        rp_max: row.rp_max ?? 999,
        stress: row.stress ?? 0,
        death_countdown: row.death_countdown,
        infection_state: row.infection_state,
        recovering_from_mortal_wound: row.recovering_from_mortal_wound,
      }

      // Compute what this PC recovers from the hours of rest.
      const recovery = computeRestRecovery(restState, hours, restful)

      // Apply the recovery to character_states. Only write fields that changed.
      const updateFields: any = { updated_at: new Date().toISOString() }
      if (recovery.newWP !== restState.wp_current) updateFields.wp_current = recovery.newWP
      if (recovery.newRP !== restState.rp_current) updateFields.rp_current = recovery.newRP
      if (recovery.stressDrop > 0) updateFields.stress = recovery.newStress

      const { error: updErr } = await supabase
        .from('character_states')
        .update(updateFields)
        .eq('id', row.id)

      if (updErr) {
        reportSupabaseError(updErr, 'partyRest:apply-recovery')
        console.error(`Failed to apply recovery to ${char.name}:`, updErr)
        continue
      }

      recoveries.push({
        characterId: char.id,
        name: char.name,
        wpHeal: recovery.wpHeal,
        rpGain: recovery.rpGain,
        stressDrop: recovery.stressDrop,
        newWP: recovery.newWP,
        newRP: recovery.newRP,
        newStress: recovery.newStress,
      })
    } catch (e) {
      console.error('partyRest: exception processing character', row.character_id, e)
    }
  }

  return { clock, recoveries, error: null }
}
