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
import { normalizeRations, LASTING_WOUNDS } from './xse-schema'
import { OUTCOME } from './roll-outcomes'

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
  try {
    await drainPendingHeals(campaignId, next)
  } catch (e) {
    console.error('[campaign-clock] drainPendingHeals failed:', e)
  }
  try {
    await drainRationsConsumption(campaignId, current.canon_day, next.canon_day - current.canon_day)
  } catch (e) {
    console.error('[campaign-clock] drainRationsConsumption failed:', e)
  }
  try {
    await drainSubsistenceDamage(campaignId, current.canon_day, next.canon_day - current.canon_day)
  } catch (e) {
    console.error('[campaign-clock] drainSubsistenceDamage failed:', e)
  }
  try {
    await drainInfectionDays(campaignId, next.canon_day - current.canon_day)
  } catch (e) {
    console.error('[campaign-clock] drainInfectionDays failed:', e)
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

// Rations consumption drainer.
//
// One ration covers one day of food + water for one character
// (Quickstart Table 16 canon, locked 2026-05-09). For every day-
// boundary crossed by an advance(), each PC in the campaign loses
// one ration from `characters.data.rations.count` (floor at 0). PCs
// already at 0 are skipped here and become candidates for the
// subsistence-damage drainer (Phase 3c).
//
// Why iterate per-PC instead of using campaign_events rows: rations
// are a perpetual per-day decrement, not a scheduled future effect.
// Computing consumption from current state at tick time is simpler
// and naturally handles characters added/removed mid-campaign.
//
// Emits a single System row to roll_log summarizing the tick (mirrors
// the encumbrance summary shape). Skipped silently if no PC consumed
// anything (e.g. dayDelta=0 or everyone's already out).
async function drainRationsConsumption(campaignId: string, prevCanonDay: number, dayDelta: number): Promise<void> {
  if (dayDelta <= 0) return
  const supabase = createClient()
  const { data: states, error } = await supabase
    .from('character_states')
    .select('character_id, characters!inner(id, name, data)')
    .eq('campaign_id', campaignId)
  if (error || !states || states.length === 0) return

  type Outcome = { name: string; prev: number; next: number; ranOut: boolean }
  const outcomes: Outcome[] = []

  for (const row of states as any[]) {
    const c = row.characters
    if (!c?.data) continue
    const rations = normalizeRations(c.data.rations)
    if (rations.count <= 0) continue
    const nextCount = Math.max(0, rations.count - dayDelta)
    if (nextCount === rations.count) continue
    const newRations: any = { type: rations.type, count: nextCount }
    // Stamp out_since_day on the day the last ration was consumed.
    // PC ate one per day starting day prevCanonDay+1, so the last
    // ration is gone after day prevCanonDay + prev_count; day after
    // that is the first hungry day.
    if (nextCount === 0 && rations.count > 0) {
      newRations.out_since_day = prevCanonDay + rations.count + 1
      newRations.last_subsistence_day = null
    }
    const newData = { ...c.data, rations: newRations }
    const { error: updErr } = await supabase
      .from('characters')
      .update({ data: newData })
      .eq('id', c.id)
    if (updErr) {
      console.error('[drainRationsConsumption] failed to update character', c.id, updErr.message)
      continue
    }
    outcomes.push({
      name: c.name,
      prev: rations.count,
      next: nextCount,
      ranOut: nextCount === 0 && rations.count > 0,
    })
  }

  if (outcomes.length === 0) return
  const { data: { user } } = await supabase.auth.getUser()
  const summaryParts = outcomes.map(o =>
    o.ranOut ? `${o.name} (${o.prev} to 0, out)` : `${o.name} (${o.prev} to ${o.next})`
  )
  await supabase.from('roll_log').insert({
    campaign_id: campaignId,
    user_id: user?.id ?? null,
    character_name: 'System',
    label: `🍞 Rations consumed (${dayDelta}d): ${summaryParts.join(', ')}`,
    die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
    outcome: OUTCOME.rations,
  })
}

// Subsistence-damage drainer (CRB Ch.07 p.117 canon, locked 2026-05-09).
//
// Once a PC's rations hit 0, they get a 2-day grace period (days 1
// and 2 hungry). Starting day 3, every day without food costs 1 WP
// + 1 RP. This drainer iterates the day-boundaries crossed by the
// current advance() and, for any boundary where the PC is at daysOut
// >= 3, applies the per-day damage. last_subsistence_day on the
// rations blob prevents double-application across overlapping
// advances.
//
// out_since_day is set by drainRationsConsumption when count drops to
// 0. If a PC's rations are restored (count > 0) without going through
// the inventory UI's reset path, this drainer self-heals by clearing
// out_since_day + last_subsistence_day at read time.
//
// PCs with wp_current <= 0 or rp_current <= 0 are still subject to
// subsistence damage on principle (the game world doesn't pause for
// the incapacitated); the existing mortal/incap pipeline takes over
// when totals hit 0.
async function drainSubsistenceDamage(campaignId: string, prevCanonDay: number, dayDelta: number): Promise<void> {
  if (dayDelta <= 0) return
  const supabase = createClient()
  const { data: states, error } = await supabase
    .from('character_states')
    .select('id, wp_current, wp_max, rp_current, rp_max, stress, character_id, characters!inner(id, name, data)')
    .eq('campaign_id', campaignId)
  if (error || !states || states.length === 0) return

  type Outcome = { name: string; damage: number; wpFrom: number; wpTo: number; rpFrom: number; rpTo: number }
  const outcomes: Outcome[] = []

  for (const row of states as any[]) {
    const c = row.characters
    if (!c?.data) continue
    const rations = normalizeRations(c.data.rations)
    const rawData: any = c.data.rations ?? {}
    // Self-heal: count > 0 should mean no hungry-day tracking.
    if (rations.count > 0) {
      if (rawData.out_since_day != null || rawData.last_subsistence_day != null) {
        const newData = { ...c.data, rations: { type: rations.type, count: rations.count } }
        await supabase.from('characters').update({ data: newData }).eq('id', c.id)
      }
      continue
    }
    const outSinceDay: number | null = typeof rawData.out_since_day === 'number' ? rawData.out_since_day : null
    if (outSinceDay == null) continue  // count==0 but never tracked (e.g. created with 0 rations); skip
    const lastSubDay: number | null = typeof rawData.last_subsistence_day === 'number' ? rawData.last_subsistence_day : null

    // Walk each day-boundary crossed by this advance. A boundary at
    // canon_day = prevCanonDay + d (d in 1..dayDelta) is "hungry day
    // d_hungry = boundaryCanon - outSinceDay + 1" of starvation.
    // Damage applies at d_hungry >= 3. Skip boundaries we already
    // applied damage for (last_subsistence_day tracks the most recent
    // hungry-day that took damage).
    let damage = 0
    let newLastSubDay = lastSubDay
    for (let d = 1; d <= dayDelta; d++) {
      const boundaryCanon = prevCanonDay + d
      const hungryDay = boundaryCanon - outSinceDay + 1
      if (hungryDay < 3) continue
      if (lastSubDay != null && boundaryCanon <= lastSubDay) continue
      damage++
      newLastSubDay = boundaryCanon
    }
    if (damage === 0) continue

    const wpFrom = row.wp_current ?? 0
    const rpFrom = row.rp_current ?? 0
    const wpTo = Math.max(0, wpFrom - damage)
    const rpTo = Math.max(0, rpFrom - damage)
    const updateFields: any = {
      wp_current: wpTo,
      rp_current: rpTo,
      updated_at: new Date().toISOString(),
    }
    // Stress on mortal/incap (cap 5).
    if (wpTo === 0 && wpFrom > 0) {
      updateFields.stress = Math.min(5, (row.stress ?? 0) + 1)
    }
    if (rpTo === 0 && rpFrom > 0) {
      updateFields.stress = Math.min(5, (updateFields.stress ?? row.stress ?? 0) + 1)
    }
    await supabase.from('character_states').update(updateFields).eq('id', row.id)

    // Stamp last_subsistence_day so a future overlapping advance
    // doesn't double-apply damage.
    const newRations = { ...rawData, type: rations.type, count: 0, last_subsistence_day: newLastSubDay }
    const newData = { ...c.data, rations: newRations }
    await supabase.from('characters').update({ data: newData }).eq('id', c.id)

    outcomes.push({ name: c.name, damage, wpFrom, wpTo, rpFrom, rpTo })
  }

  if (outcomes.length === 0) return
  const { data: { user } } = await supabase.auth.getUser()
  const summaryParts = outcomes.map(o =>
    `${o.name} (-${o.damage} WP/-${o.damage} RP, ${o.wpFrom}->${o.wpTo} WP, ${o.rpFrom}->${o.rpTo} RP)`
  )
  await supabase.from('roll_log').insert({
    campaign_id: campaignId,
    user_id: user?.id ?? null,
    character_name: 'System',
    label: `🪦 Subsistence damage: ${summaryParts.join(', ')}`,
    die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
    outcome: OUTCOME.subsistence,
  })
}

// Infection days-left drainer (canon §06 - /rules/combat/infection).
//
// Every infected character (PC or NPC, `infection_state != null`) has
// their `infection_days_left` decremented by the number of canon days
// crossed in this advance. When days_left reaches 0 the infection
// resolves per its severity:
//   'auto'  - Lasting Damage applies automatically. Roll 2d6, look up
//             Table 12 (LASTING_WOUNDS), append to the patient's
//             lasting wounds. PCs: characters.data.lastingWounds[].
//             NPCs: logged via roll_log only (no NPC field today;
//             schema-gap follow-up).
//   'check' - PHY check required. The drainer broadcasts a
//             `lasting_damage_check_request` event scoped to the PC's
//             owning user_id; the PC's client opens the standard
//             roll modal. NPCs queue on the GM's local list (the
//             table-page listener handles this just like the
//             infection check broadcast).
//
// Either path clears infection_state / infection_days_left /
// infection_lasting_risk / infection_severity AND lifts the RP cap
// (caller's RP_max is unchanged, so just clearing infection_state
// removes the half-max clamp downstream). A single System feed row
// summarises the tick for the GM.
async function drainInfectionDays(campaignId: string, dayDelta: number): Promise<void> {
  if (dayDelta <= 0) return
  const supabase = createClient()
  // Pull infected PCs (character_states) + infected NPCs (campaign_npcs)
  // in parallel - both tables share the same infection columns.
  const [pcsRes, npcsRes] = await Promise.all([
    supabase
      .from('character_states')
      .select('id, character_id, characters!inner(id, name, user_id, data), infection_state, infection_days_left, infection_lasting_risk, infection_severity, rp_current, rp_max')
      .eq('campaign_id', campaignId)
      .not('infection_state', 'is', null),
    supabase
      .from('campaign_npcs')
      .select('id, name, infection_state, infection_days_left, infection_lasting_risk, infection_severity, rp_current, rp_max')
      .eq('campaign_id', campaignId)
      .not('infection_state', 'is', null),
  ])
  if (pcsRes.error) console.error('[drainInfectionDays] PC fetch:', pcsRes.error.message)
  if (npcsRes.error) console.error('[drainInfectionDays] NPC fetch:', npcsRes.error.message)
  const pcs = (pcsRes.data ?? []) as any[]
  const npcs = (npcsRes.data ?? []) as any[]
  if (pcs.length === 0 && npcs.length === 0) return

  type Outcome = {
    name: string
    kind: 'wound' | 'sickness'
    severity: 'check' | 'auto' | null
    daysLeft: number
    triggered: boolean   // hit Day 0 this tick
    wound?: { roll: number; name: string; effect: string }
  }
  const outcomes: Outcome[] = []

  const processRow = async (row: any, isPc: boolean) => {
    const prev: number = row.infection_days_left ?? 0
    const next = Math.max(0, prev - dayDelta)
    const kind = (row.infection_state as 'wound' | 'sickness')
    const severity = (row.infection_severity as 'check' | 'auto' | null)
    const name = isPc ? row.characters?.name : row.name
    if (next > 0) {
      // Still sick; just decrement.
      const table = isPc ? 'character_states' : 'campaign_npcs'
      await supabase.from(table).update({ infection_days_left: next }).eq('id', row.id)
      outcomes.push({ name, kind, severity, daysLeft: next, triggered: false })
      return
    }
    // Day 0. Clear infection state; dispatch per severity.
    const clear = {
      infection_state: null,
      infection_days_left: null,
      infection_lasting_risk: false,
      infection_severity: null,
    }
    if (severity === 'auto') {
      // Auto Lasting Damage - roll 2d6, look up Table 12.
      const die1 = Math.floor(Math.random() * 6) + 1
      const die2 = Math.floor(Math.random() * 6) + 1
      const sum = die1 + die2
      const wound = LASTING_WOUNDS[sum]
      // PC: push to data.lastingWounds. NPC: skip (no field today).
      if (isPc && row.characters?.id) {
        const charData = row.characters.data ?? {}
        const nextLW = [...(charData.lastingWounds ?? []), wound.name]
        await supabase.from('characters').update({ data: { ...charData, lastingWounds: nextLW } }).eq('id', row.characters.id)
      }
      await supabase.from(isPc ? 'character_states' : 'campaign_npcs').update(clear).eq('id', row.id)
      outcomes.push({ name, kind, severity, daysLeft: 0, triggered: true, wound: { roll: sum, name: wound.name, effect: wound.effect } })
    } else if (severity === 'check') {
      // PHY check required. Two delivery paths, used together:
      //
      //   1. Broadcast `lasting_damage_check_request` for live-tab
      //      delivery. The PC owner's table tab (or GM tab for NPCs)
      //      opens the roll modal immediately. PHY AMod is read from
      //      the listener side.
      //   2. Set infection_pending_lasting_check=true on the row so
      //      tabs that were CLOSED, stale-bundle, or backgrounded at
      //      drain time pick the check up on next page load /
      //      loadEntries cycle. Belt-and-suspenders against the
      //      "broadcast has no replay" gap that bit Cree at 22:46 UTC.
      //
      // The pending flag is cleared by executeRoll's Lasting Damage
      // Check branch when the modal resolves; until then it sits and
      // re-opens the modal on every reload until someone rolls it.
      const targetUserId = isPc ? row.characters?.user_id : null
      const ch = supabase.channel(`initiative_${campaignId}`)
      try {
        await new Promise<void>((resolve) => {
          ch.subscribe(async (status: string) => {
            if (status !== 'SUBSCRIBED') return
            await ch.send({
              type: 'broadcast',
              event: 'lasting_damage_check_request',
              payload: { targetUserId, name, kind, isPc },
            })
            resolve()
          })
        })
      } catch (e) {
        console.error('[drainInfectionDays] broadcast failed for', name, e)
      } finally {
        await supabase.removeChannel(ch)
      }
      // Clear the sick period AND raise the persistent pending flag.
      const clearAndFlag = { ...clear, infection_pending_lasting_check: true }
      await supabase.from(isPc ? 'character_states' : 'campaign_npcs').update(clearAndFlag).eq('id', row.id)
      outcomes.push({ name, kind, severity, daysLeft: 0, triggered: true })
    } else {
      // No severity recorded (legacy data). Just clear state.
      await supabase.from(isPc ? 'character_states' : 'campaign_npcs').update(clear).eq('id', row.id)
      outcomes.push({ name, kind, severity, daysLeft: 0, triggered: true })
    }
  }

  for (const row of pcs) await processRow(row, true)
  for (const row of npcs) await processRow(row, false)

  // System feed row: one summary covering the tick. Only emit if at
  // least one row triggered (Day 0) OR had a decrement. Quiet ticks
  // (everyone still has multi-day sickness with no state change) emit
  // a single "still sick" summary so the GM has signal.
  const { data: { user } } = await supabase.auth.getUser()
  const triggered = outcomes.filter(o => o.triggered)
  const stillSick = outcomes.filter(o => !o.triggered)
  const parts: string[] = []
  for (const o of triggered) {
    if (o.wound) {
      parts.push(`${o.name} Day 0 - Lasting Wound: ${o.wound.name} [2d6=${o.wound.roll}] (${o.wound.effect})`)
    } else if (o.severity === 'check') {
      parts.push(`${o.name} Day 0 - Lasting Damage check pending`)
    } else {
      parts.push(`${o.name} Day 0 - infection cleared (no severity)`)
    }
  }
  for (const o of stillSick) {
    parts.push(`${o.name} (${o.kind}, ${o.daysLeft}d left)`)
  }
  if (parts.length === 0) return
  await supabase.from('roll_log').insert({
    campaign_id: campaignId,
    user_id: user?.id ?? null,
    character_name: 'System',
    label: `🦠 Infection tick (${dayDelta}d): ${parts.join(', ')}`,
    die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
    outcome: 'infection_tick',
  })
}

// Pending heal drainer.
//
// pending_heal events represent a single discrete WP application at a
// specific (canon_day, hour). Used by the Medicine*-check healing flow
// per tasks/spec-healing.md: a successful check queues TWO pending_heal
// events on the target — one at +12h with floor(total/2) WP and one at
// +24h with the remainder. Each event is applied once when the clock
// crosses its scheduled time.
//
// Payload shape: { wp_amount: number, source: string, healer_name: string }
async function drainPendingHeals(campaignId: string, clock: ClockState): Promise<void> {
  const supabase = createClient()
  const { data: events, error } = await supabase
    .from('campaign_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('type', 'pending_heal')
    .is('applied_canon_day', null)
    .is('cancelled_at', null)
  if (error || !events || events.length === 0) return
  type Outcome = { name: string; wpFrom: number; wpTo: number; delta: number; source: string }
  const outcomes: Outcome[] = []
  for (const ev of events as any[]) {
    const scheduled: ClockState = { canon_day: ev.scheduled_canon_day, hour: ev.scheduled_canon_hour }
    if (hoursBetween(scheduled, clock) < 0) continue  // not yet due
    const p = ev.payload ?? {}
    const wpAmount = Number(p.wp_amount ?? 0)
    if (!ev.target_character_id) {
      await supabase.from('campaign_events').update({ applied_canon_day: clock.canon_day, applied_canon_hour: clock.hour }).eq('id', ev.id)
      continue
    }
    try {
      const { data: state } = await supabase
        .from('character_states')
        .select('id, wp_current, wp_max, character_id, characters!inner(name)')
        .eq('character_id', ev.target_character_id)
        .eq('campaign_id', campaignId)
        .maybeSingle()
      if (!state) {
        await supabase.from('campaign_events').update({ applied_canon_day: clock.canon_day, applied_canon_hour: clock.hour }).eq('id', ev.id)
        continue
      }
      const s: any = state
      const wpFrom = s.wp_current ?? 0
      const wpTo = Math.min(s.wp_max ?? 999, wpFrom + wpAmount)
      const delta = wpTo - wpFrom
      if (delta > 0) {
        await supabase.from('character_states').update({ wp_current: wpTo, updated_at: new Date().toISOString() }).eq('id', s.id)
      }
      await supabase.from('campaign_events').update({ applied_canon_day: clock.canon_day, applied_canon_hour: clock.hour }).eq('id', ev.id)
      const charName = s.characters?.name ?? 'Someone'
      outcomes.push({ name: charName, wpFrom, wpTo, delta, source: String(p.source ?? 'treatment') })
    } catch (e) {
      console.error('[drainPendingHeals] failed to apply heal', ev.id, e)
    }
  }
  if (outcomes.length === 0) return
  // Emit a single System row summarizing the tick (mirrors rations /
  // subsistence drainer pattern). One row per advance, not per heal.
  const { data: { user } } = await supabase.auth.getUser()
  const summaryParts = outcomes.map(o =>
    o.delta > 0
      ? `${o.name} (+${o.delta} WP, ${o.wpFrom} to ${o.wpTo})`
      : `${o.name} (already at WP max - heal lost)`
  )
  await supabase.from('roll_log').insert({
    campaign_id: campaignId,
    user_id: user?.id ?? null,
    character_name: 'System',
    label: `🩹 Treatment applied: ${summaryParts.join(', ')}`,
    die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
    outcome: OUTCOME.pending_heal,
  })
}

// Queue a pending heal: spec says 50% applies at +12h, remainder at +24h.
// Creates two campaign_events rows. Each is applied independently by
// drainPendingHeals when the clock crosses its scheduled time.
export async function queuePendingHeal(args: {
  campaignId: string
  targetCharacterId: string
  totalWp: number
  healerName: string
  source: string  // e.g. "naked Medicine*", "First Aid Kit", "Doctor's Bag"
}): Promise<{ firstEventId: string | null; secondEventId: string | null }> {
  const supabase = createClient()
  const current = await readClock(args.campaignId)
  const { data: { user } } = await supabase.auth.getUser()
  const half1 = Math.floor(args.totalWp / 2)
  const half2 = args.totalWp - half1
  // First chunk: +12h from now.
  const h12 = current.hour + 12
  const sched1: ClockState = { canon_day: current.canon_day + Math.floor(h12 / 24), hour: h12 % 24 }
  // Second chunk: +24h from now (so same hour, next day).
  const sched2: ClockState = { canon_day: current.canon_day + 1, hour: current.hour }
  const payload = { source: args.source, healer_name: args.healerName }
  const rows = [
    {
      campaign_id: args.campaignId,
      type: 'pending_heal',
      target_character_id: args.targetCharacterId,
      scheduled_canon_day: sched1.canon_day,
      scheduled_canon_hour: sched1.hour,
      payload: { ...payload, wp_amount: half1, half: 1 },
      created_by: user?.id ?? null,
    },
    {
      campaign_id: args.campaignId,
      type: 'pending_heal',
      target_character_id: args.targetCharacterId,
      scheduled_canon_day: sched2.canon_day,
      scheduled_canon_hour: sched2.hour,
      payload: { ...payload, wp_amount: half2, half: 2 },
      created_by: user?.id ?? null,
    },
  ]
  const { data, error } = await supabase
    .from('campaign_events')
    .insert(rows)
    .select('id')
  if (error) {
    console.error('[campaign-clock] queuePendingHeal failed:', error.message)
    return { firstEventId: null, secondEventId: null }
  }
  const ids = (data ?? []) as any[]
  return { firstEventId: ids[0]?.id ?? null, secondEventId: ids[1]?.id ?? null }
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
