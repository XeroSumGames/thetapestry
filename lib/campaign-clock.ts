// Campaign clock — the only writer of `campaigns.clock`.
//
// Phase 1: just bumps the clock and broadcasts the new state. No event
// draining yet — that comes in Phase 2 (healing) and Phase 3 (rations,
// subsistence, ammo, fuel).
//
// Design contract: advance() is GM-only at the UI layer. Server-side
// RLS on the campaigns table also enforces this (only the GM can UPDATE
// their campaign). Callers should still gate the button on isGM and not
// rely solely on RLS for UX.

import { createClient } from './supabase-browser'

export interface ClockState {
  canon_day: number
  hour: number  // 0-23
}

// Read the current clock for a campaign. Returns the default
// { canon_day: 0, hour: 0 } if the campaign has no clock column yet
// (pre-migration) or if the campaign row was just created without an
// explicit clock value.
export async function readClock(campaignId: string): Promise<ClockState> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('clock')
    .eq('id', campaignId)
    .maybeSingle()
  if (error || !data) return { canon_day: 0, hour: 0 }
  const c = (data as any).clock as ClockState | null
  return c && typeof c.canon_day === 'number' && typeof c.hour === 'number'
    ? { canon_day: c.canon_day, hour: c.hour }
    : { canon_day: 0, hour: 0 }
}

// Bump the clock forward by N hours. Spills over into days as needed.
// Returns the new ClockState on success, or null on error. Phase 2
// will extend this to drain `campaign_events` rows whose scheduled
// (canon_day, hour) is <= the new clock; for now it just writes the
// new clock value and broadcasts.
//
// NOT idempotent — calling advance(8) twice = +16 hours. The UI should
// disable the button during the await to prevent double-clicks.
export async function advance(campaignId: string, hours: number): Promise<ClockState | null> {
  if (hours <= 0) return readClock(campaignId)
  const supabase = createClient()
  const current = await readClock(campaignId)
  const totalHours = current.hour + hours
  const dayDelta = Math.floor(totalHours / 24)
  const next: ClockState = {
    canon_day: current.canon_day + dayDelta,
    hour: ((totalHours % 24) + 24) % 24,
  }
  const { error } = await supabase
    .from('campaigns')
    .update({ clock: next })
    .eq('id', campaignId)
  if (error) {
    console.error('[campaign-clock] advance failed:', error.message)
    return null
  }
  // Realtime broadcast — every viewer's campaign sheet gets the new
  // clock state immediately, without waiting for postgres_changes to
  // propagate (faster + works around postgres_changes' UPDATE event
  // dropping when the row stays in RLS scope).
  try {
    const ch = supabase.channel(`campaign_clock_${campaignId}`)
    await ch.send({
      type: 'broadcast',
      event: 'clock_advanced',
      payload: { campaign_id: campaignId, clock: next, hours_advanced: hours },
    })
    supabase.removeChannel(ch)
  } catch {
    // Realtime broadcast best-effort; the postgres_changes
    // subscription on campaigns also catches the update.
  }
  return next
}

// Set the campaign's clock to a specific (canon_day, hour). Used at
// campaign creation to anchor the campaign to its starting canon day
// (Mongrels=563, Chased=379, etc.), and by future GM tooling for
// timeline corrections. GM-only.
export async function setClock(campaignId: string, canonDay: number, hour: number = 0): Promise<ClockState | null> {
  if (canonDay < 0) return null
  if (hour < 0 || hour > 23) return null
  const supabase = createClient()
  const next: ClockState = { canon_day: canonDay, hour }
  const { error } = await supabase
    .from('campaigns')
    .update({ clock: next })
    .eq('id', campaignId)
  if (error) {
    console.error('[campaign-clock] setClock failed:', error.message)
    return null
  }
  try {
    const ch = supabase.channel(`campaign_clock_${campaignId}`)
    await ch.send({
      type: 'broadcast',
      event: 'clock_set',
      payload: { campaign_id: campaignId, clock: next },
    })
    supabase.removeChannel(ch)
  } catch {}
  return next
}
