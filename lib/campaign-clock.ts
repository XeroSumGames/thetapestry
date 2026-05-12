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

// Helper: signed total hours between two clock states. Positive when
// `b` is after `a`. Used by the streaming-heal drainer to compute how
// long an event has been in flight.
function hoursBetween(a: ClockState, b: ClockState): number {
  return (b.canon_day - a.canon_day) * 24 + (b.hour - a.hour)
}

// Bump the clock forward by N hours. Spills over into days as needed.
// Returns the new ClockState on success, or null on error.
//
// Drains pending events whose scheduled (canon_day, hour) is <= the
// new clock and whose type the drainer knows how to apply. Phase 2
// handles `streaming_heal`; Phase 3+ will add more types.
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
  // Drain pending events that should fire by the new clock. Best-
  // effort: each event type drains independently so a failure in one
  // type's apply path doesn't poison the others.
  try {
    await drainStreamingHeals(campaignId, next)
  } catch (e) {
    console.error('[campaign-clock] drainStreamingHeals failed:', e)
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

// Streaming heal drainer.
//
// Streaming heals (`type = 'streaming_heal'`) distribute their total
// WP/RP over a duration. Each advance applies the integer-portion of
// progress and banks the fractional remainder for the next tick.
//
// Payload shape:
//   {
//     total_wp: number,           // total WP to heal across duration
//     total_rp: number,           // total RP to heal across duration
//     duration_hours: number,     // total duration of the heal
//     applied_wp: number,         // integer WP already applied
//     applied_rp: number,         // integer RP already applied
//     applied_remainder_wp: number,  // fractional WP banked
//     applied_remainder_rp: number,  // fractional RP banked
//     source: string,             // e.g. "Doctor's Kit (Juno)"
//   }
async function drainStreamingHeals(campaignId: string, clock: ClockState): Promise<void> {
  const supabase = createClient()
  const { data: events, error } = await supabase
    .from('campaign_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('type', 'streaming_heal')
    .is('applied_canon_day', null)
    .is('cancelled_at', null)
  if (error || !events || events.length === 0) return
  for (const ev of events as any[]) {
    const scheduled: ClockState = { canon_day: ev.scheduled_canon_day, hour: ev.scheduled_canon_hour }
    const hoursElapsed = hoursBetween(scheduled, clock)
    if (hoursElapsed <= 0) continue  // not started yet
    const p = ev.payload ?? {}
    const totalWp = Number(p.total_wp ?? 0)
    const totalRp = Number(p.total_rp ?? 0)
    const duration = Number(p.duration_hours ?? 0)
    if (duration <= 0) continue
    const appliedWp = Number(p.applied_wp ?? 0)
    const appliedRp = Number(p.applied_rp ?? 0)
    const cappedHours = Math.min(hoursElapsed, duration)
    const completed = cappedHours >= duration
    // Expected cumulative progress at this tick. Floor for integer
    // WP/RP applied; the fractional remainder is implicit (next tick
    // will floor against the updated cumulative).
    const expectedWp = completed ? totalWp : Math.floor((totalWp * cappedHours) / duration)
    const expectedRp = completed ? totalRp : Math.floor((totalRp * cappedHours) / duration)
    const deltaWp = Math.max(0, expectedWp - appliedWp)
    const deltaRp = Math.max(0, expectedRp - appliedRp)
    if (deltaWp === 0 && deltaRp === 0 && !completed) continue
    // Apply to the target character's character_states row. LEAST() caps at
    // wp_max / rp_max so a heal can't push over the character's max.
    if (ev.target_character_id && (deltaWp > 0 || deltaRp > 0)) {
      try {
        const { data: state } = await supabase
          .from('character_states')
          .select('id, wp_current, wp_max, rp_current, rp_max')
          .eq('character_id', ev.target_character_id)
          .eq('campaign_id', campaignId)
          .maybeSingle()
        if (state) {
          const s: any = state
          const newWp = Math.min(s.wp_max ?? 999, (s.wp_current ?? 0) + deltaWp)
          const newRp = Math.min(s.rp_max ?? 999, (s.rp_current ?? 0) + deltaRp)
          await supabase
            .from('character_states')
            .update({ wp_current: newWp, rp_current: newRp })
            .eq('id', s.id)
        }
      } catch (e) {
        console.error('[drainStreamingHeals] failed to apply heal to character_states', e)
      }
    }
    // Update the event row. If completed, stamp applied_at; otherwise
    // bump applied_wp / applied_rp and stay pending.
    const newPayload = {
      ...p,
      applied_wp: appliedWp + deltaWp,
      applied_rp: appliedRp + deltaRp,
    }
    const updateFields: any = { payload: newPayload }
    if (completed) {
      updateFields.applied_canon_day = clock.canon_day
      updateFields.applied_canon_hour = clock.hour
    }
    await supabase.from('campaign_events').update(updateFields).eq('id', ev.id)
  }
}

// Queue a streaming heal. GM-callable (RLS allows members to INSERT,
// but the UI should only surface this on GM). Schedules the heal
// to start at the current clock; duration_hours determines when it
// will be fully applied (e.g. 24 for a Doctor's Kit).
export async function queueStreamingHeal(args: {
  campaignId: string
  targetCharacterId: string
  totalWp: number
  totalRp: number
  durationHours: number
  source: string
}): Promise<string | null> {
  const supabase = createClient()
  const current = await readClock(args.campaignId)
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('campaign_events')
    .insert({
      campaign_id: args.campaignId,
      type: 'streaming_heal',
      target_character_id: args.targetCharacterId,
      scheduled_canon_day: current.canon_day,
      scheduled_canon_hour: current.hour,
      payload: {
        total_wp: args.totalWp,
        total_rp: args.totalRp,
        duration_hours: args.durationHours,
        applied_wp: 0,
        applied_rp: 0,
        applied_remainder_wp: 0,
        applied_remainder_rp: 0,
        source: args.source,
      },
      created_by: user?.id ?? null,
    })
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[campaign-clock] queueStreamingHeal failed:', error.message)
    return null
  }
  return (data as any)?.id ?? null
}

// Cancel a pending event (GM only at the RLS layer). Used both by the
// damage-interrupt path (Phase 3) and by the GM panel's manual cancel
// button.
export async function cancelEvent(eventId: string, reason: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('campaign_events')
    .update({ cancelled_at: new Date().toISOString(), cancelled_reason: reason })
    .eq('id', eventId)
  if (error) {
    console.error('[campaign-clock] cancelEvent failed:', error.message)
    return false
  }
  return true
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
