'use client'

// Campaign Sheet — Phase 2.
//
// Popout-style page (sidebar auto-hidden via LayoutShell's
// FULL_WIDTH_PATTERN matching the `-sheet` suffix). Panels:
//   - Clock header with today's canon event + GM advance buttons
//   - Party Status — every PC's WP/RP/Stress in one glance
//   - Vehicle Status — every vehicle's WP/Stress/Fuel
//   - Pending Effects — active streaming heals (and future ration /
//     subsistence / world-event-expiry ticks)
//   - Timeline — past + present canon events only
//
// See tasks/spec-campaign-sheet.md for the locked rules.

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { advance, readClock, queueStreamingHeal, cancelEvent, type ClockState } from '../../lib/campaign-clock'
import { dayToCalendar, eventsOnDay, pastAndPresentEvents, hourTo12h } from '../../lib/distemper-timeline'

interface PartyRow {
  character_id: string
  name: string
  wp_current: number
  wp_max: number
  rp_current: number
  rp_max: number
  stress: number
}

interface VehicleRow {
  id: string
  name: string
  type: string
  wp_current: number
  wp_max: number
  stress: number
  fuel_current: number
  fuel_max: number
}

interface PendingHeal {
  id: string
  target_character_id: string | null
  target_name: string
  scheduled_canon_day: number
  scheduled_canon_hour: number
  payload: {
    total_wp: number
    total_rp: number
    duration_hours: number
    applied_wp: number
    applied_rp: number
    source: string
  }
}

export default function CampaignSheetPage() {
  const params = useSearchParams()
  const campaignId = params.get('c') ?? ''
  const supabase = useMemo(() => createClient(), [])

  const [clock, setClockState] = useState<ClockState>({ canon_day: 0, hour: 0 })
  const [campaignName, setCampaignName] = useState<string>('')
  const [gmUserId, setGmUserId] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [party, setParty] = useState<PartyRow[]>([])
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [pending, setPending] = useState<PendingHeal[]>([])
  const [healModal, setHealModal] = useState(false)

  const isGM = !!myUserId && !!gmUserId && myUserId === gmUserId

  async function loadParty() {
    const { data: states } = await supabase
      .from('character_states')
      .select('character_id, wp_current, wp_max, rp_current, rp_max, stress')
      .eq('campaign_id', campaignId)
    if (!states || states.length === 0) { setParty([]); return }
    const charIds = (states as any[]).map(s => s.character_id)
    const { data: chars } = await supabase
      .from('characters')
      .select('id, name')
      .in('id', charIds)
    const nameMap: Record<string, string> = {}
    for (const c of (chars ?? []) as any[]) nameMap[c.id] = c.name
    setParty((states as any[]).map(s => ({
      character_id: s.character_id,
      name: nameMap[s.character_id] ?? 'Unknown',
      wp_current: s.wp_current ?? 0, wp_max: s.wp_max ?? 0,
      rp_current: s.rp_current ?? 0, rp_max: s.rp_max ?? 0,
      stress: s.stress ?? 0,
    })))
  }

  async function loadVehicles() {
    const { data } = await supabase.from('campaigns').select('vehicles').eq('id', campaignId).maybeSingle()
    const arr = (data as any)?.vehicles as any[] | undefined
    if (!arr || arr.length === 0) { setVehicles([]); return }
    setVehicles(arr.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type ?? '',
      wp_current: v.wp_current ?? 0,
      wp_max: v.wp_max ?? 0,
      stress: v.stress ?? 0,
      fuel_current: v.fuel_current ?? 0,
      fuel_max: v.fuel_max ?? 0,
    })))
  }

  async function loadPending() {
    const { data: events } = await supabase
      .from('campaign_events')
      .select('id, type, payload, target_character_id, scheduled_canon_day, scheduled_canon_hour')
      .eq('campaign_id', campaignId)
      .eq('type', 'streaming_heal')
      .is('applied_canon_day', null)
      .is('cancelled_at', null)
      .order('scheduled_canon_day', { ascending: true })
      .order('scheduled_canon_hour', { ascending: true })
    if (!events || events.length === 0) { setPending([]); return }
    const targetIds = (events as any[])
      .map(e => e.target_character_id)
      .filter((x: string | null): x is string => !!x)
    let nameMap: Record<string, string> = {}
    if (targetIds.length > 0) {
      const { data: chars } = await supabase.from('characters').select('id, name').in('id', targetIds)
      for (const c of (chars ?? []) as any[]) nameMap[c.id] = c.name
    }
    setPending((events as any[]).map(e => ({
      id: e.id,
      target_character_id: e.target_character_id,
      target_name: e.target_character_id ? (nameMap[e.target_character_id] ?? 'Unknown') : 'Unknown',
      scheduled_canon_day: e.scheduled_canon_day,
      scheduled_canon_hour: e.scheduled_canon_hour,
      payload: e.payload ?? {},
    })))
  }

  // Initial load + realtime subscription on clock, character_states,
  // and campaign_events. Anything that changes refreshes the
  // affected panel.
  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    async function load() {
      const [auth, camp] = await Promise.all([
        getCachedAuth(),
        supabase.from('campaigns').select('name, gm_user_id, clock').eq('id', campaignId).maybeSingle(),
      ])
      if (cancelled) return
      setMyUserId(auth.user?.id ?? null)
      const c: any = camp.data
      if (c) {
        setCampaignName(c.name ?? '')
        setGmUserId(c.gm_user_id ?? null)
        const stored = c.clock as ClockState | null
        if (stored && typeof stored.canon_day === 'number' && typeof stored.hour === 'number') {
          setClockState({ canon_day: stored.canon_day, hour: stored.hour })
        }
      }
      await Promise.all([loadParty(), loadVehicles(), loadPending()])
      setLoaded(true)
    }
    load()
    const broadcastCh = supabase.channel(`campaign_clock_${campaignId}`)
      .on('broadcast', { event: 'clock_advanced' }, async (msg: any) => {
        const next = msg?.payload?.clock as ClockState | undefined
        if (next) setClockState(next)
        // Clock moved → party WP/RP may have changed (heals drained),
        // pending list may have changed.
        await Promise.all([loadParty(), loadPending()])
      })
      .on('broadcast', { event: 'clock_set' }, (msg: any) => {
        const next = msg?.payload?.clock as ClockState | undefined
        if (next) setClockState(next)
      })
      .subscribe()
    const pgCh = supabase.channel(`campaign_pg_${campaignId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        (payload: any) => {
          const cl = payload?.new?.clock as ClockState | undefined
          if (cl && typeof cl.canon_day === 'number') setClockState({ canon_day: cl.canon_day, hour: cl.hour })
          const veh = payload?.new?.vehicles
          if (Array.isArray(veh)) loadVehicles()
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'character_states', filter: `campaign_id=eq.${campaignId}` },
        () => { loadParty() })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_events', filter: `campaign_id=eq.${campaignId}` },
        () => { loadPending() })
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(broadcastCh)
      supabase.removeChannel(pgCh)
    }
  }, [campaignId, supabase])

  const calendar = dayToCalendar(clock.canon_day)
  const todaysEvents = eventsOnDay(clock.canon_day)
  const timeline = pastAndPresentEvents(clock.canon_day).slice().reverse()

  async function handleAdvance(hours: number) {
    if (!isGM || advancing) return
    setAdvancing(true)
    const next = await advance(campaignId, hours)
    if (next) setClockState(next)
    setAdvancing(false)
  }

  if (!campaignId) {
    return <Empty msg="Missing campaign id. Open the sheet from the table page." />
  }
  if (!loaded) {
    return <Empty msg="Loading campaign sheet…" />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0e0e0e', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', padding: '20px 24px 80px' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#888', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          {campaignName || 'Campaign'} · Campaign Sheet
        </div>
        <div style={{ fontSize: 24, color: '#f5f2ee', fontWeight: 700, letterSpacing: '.04em', marginBottom: 6 }}>
          {calendar.display} · {hourTo12h(clock.hour)}
        </div>
        {todaysEvents.length > 0 && (
          <div style={{ fontSize: 15, color: '#EF9F27', fontStyle: 'italic', marginBottom: 6 }}>
            {todaysEvents.map(e => e.event).join(' · ')}
          </div>
        )}
      </div>

      {/* ── GM advance bar ──────────────────────────────────── */}
      {isGM ? (
        <div style={{ marginBottom: 24, padding: '10px 14px', background: '#14181c', border: '1px solid #2e2e2e', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#cce0f5', letterSpacing: '.12em', textTransform: 'uppercase' }}>Advance Time</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 4, 8, 12, 24].map(h => (
              <button key={h} onClick={() => handleAdvance(h)} disabled={advancing} style={advanceBtn(advancing)}>
                +{h}h
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button onClick={() => setHealModal(true)} disabled={advancing}
              style={actionBtn('#1a2e10', '#2d5a1b', '#7fc458')}>
              🩹 Heal
            </button>
            {/* Placeholder buttons — Phase 3 will wire each to its
                event type:
                  Eat   → ration_consumed events for everyone present
                  Rest  → bulk WP/RP restoration over scheduled hours
                The visible button keeps the workflow surface intact
                so the GM has the muscle memory by the time the wiring
                lands. */}
            <button onClick={() => alert('Eating (placeholder).\n\nPhase 3 will consume one ration per character present + apply any Luxury Ration stress-clear. For now this is just a visible affordance.')} disabled={advancing}
              style={actionBtn('#2a1a10', '#5a3a1b', '#EF9F27')}
              title="Consume rations for everyone present (Phase 3)">
              🍞 Eat
            </button>
            <button onClick={() => alert('Resting (placeholder).\n\nPhase 3 will queue a bulk rest action — full WP/RP restoration over a configurable rest duration, with interruption rules. For now this is just a visible affordance.')} disabled={advancing}
              style={actionBtn('#0f1a2e', '#1a3a5c', '#7ab3d4')}
              title="Begin a rest (Phase 3)">
              💤 Rest
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 24, padding: '10px 14px', background: '#14181c', border: '1px solid #2e2e2e', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#888', fontStyle: 'italic', flex: 1 }}>
            Only the GM can advance the clock or queue effects.
          </div>
          {/* Player-only Discharge Stress placeholder — gives players a
              visible control of their own. Phase 3 will check the
              player's PC's current Stress, fire a discharge roll (or
              auto-clear one pip per the chosen tactic), and log it. */}
          <button onClick={() => alert('Relax (placeholder).\n\nPhase 3 will let your PC spend a tactic (or pass a roll) to clear one Stress pip. For now this is just a visible affordance.')}
            style={actionBtn('#2a1210', '#c0392b', '#f5a89a')}
            title="Spend a tactic to clear one Stress pip (Phase 3)">
            🧘 Relax
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* ── Party Status ───────────────────────────────────── */}
        <Panel title="Party Status">
          {party.length === 0 ? (
            <Muted text="No characters at the table." />
          ) : (
            <div>
              {party.map(p => <PartyCard key={p.character_id} row={p} />)}
            </div>
          )}
        </Panel>

        {/* ── Vehicles ───────────────────────────────────────── */}
        <Panel title="Vehicles">
          {vehicles.length === 0 ? (
            <Muted text="No vehicles in this campaign." />
          ) : (
            <div>
              {vehicles.map(v => <VehicleStatus key={v.id} v={v} />)}
            </div>
          )}
        </Panel>

        {/* ── Pending Effects ────────────────────────────────── */}
        <Panel title="Pending Effects">
          {pending.length === 0 ? (
            <Muted text="No active pending effects. Queued heals appear here while they drain." />
          ) : (
            <div>
              {pending.map(ev => (
                <PendingHealCard
                  key={ev.id}
                  ev={ev}
                  clock={clock}
                  canCancel={isGM}
                  onCancel={async () => {
                    if (!confirm(`Cancel heal for ${ev.target_name}? Remaining heal is lost.`)) return
                    await cancelEvent(ev.id, 'manual_cancel')
                    await loadPending()
                  }}
                />
              ))}
            </div>
          )}
        </Panel>

        {/* ── Timeline ───────────────────────────────────────── */}
        <Panel title="Timeline">
          {timeline.length === 0 ? (
            <Muted text="No canonical events have occurred yet." />
          ) : (
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {timeline.map(e => {
                const cal = dayToCalendar(e.canon_day)
                const isToday = e.canon_day === clock.canon_day
                return (
                  <div key={`${e.canon_day}-${e.event.slice(0, 20)}`}
                    style={{
                      padding: '8px 12px', marginBottom: 6,
                      background: isToday ? '#1a2010' : '#1a1a1a',
                      border: '1px solid #2e2e2e',
                      borderLeft: `3px solid ${isToday ? '#EF9F27' : '#3a3a3a'}`,
                      borderRadius: 3,
                    }}>
                    <div style={{ fontSize: 13, color: isToday ? '#EF9F27' : '#888', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                      Day {e.canon_day} · {cal.monthName} {cal.dayOrdinal}, Year {cal.yearNumber}
                      {isToday && <span style={{ marginLeft: 8, fontWeight: 700 }}>· Today</span>}
                    </div>
                    <div style={{ fontSize: 15, color: '#d4cfc9' }}>{e.event}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Queue Heal Modal ────────────────────────────────── */}
      {healModal && isGM && (
        <QueueHealModal
          party={party}
          onClose={() => setHealModal(false)}
          onSubmit={async (args) => {
            const id = await queueStreamingHeal({
              campaignId,
              targetCharacterId: args.targetCharacterId,
              totalWp: args.totalWp,
              totalRp: args.totalRp,
              durationHours: args.durationHours,
              source: args.source,
            })
            setHealModal(false)
            if (id) await loadPending()
          }}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 24, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', fontSize: 13 }}>
      {msg}
    </div>
  )
}

function Panel({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ color: '#cce0f5', fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 12px', paddingBottom: 6, borderBottom: '1px solid #2e2e2e' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Muted({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>{text}</div>
}

function advanceBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 32, padding: '0 14px',
    background: disabled ? '#1a1a1a' : '#1a2e10',
    border: '1px solid #2d5a1b', borderRadius: 3,
    color: '#7fc458',
    fontSize: 13, fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase',
    cursor: disabled ? 'wait' : 'pointer',
    whiteSpace: 'nowrap',
  }
}

// Generic action button — same geometry as advance buttons but the
// caller picks the color theme. Used by Queue Heal, Eat, Rest, and
// the player-side Discharge Stress placeholder so they all share the
// 32px height in the same toolbar row.
function actionBtn(bg: string, border: string, color: string): React.CSSProperties {
  return {
    height: 32, padding: '0 14px',
    background: bg, border: `1px solid ${border}`, borderRadius: 3,
    color,
    fontSize: 13, fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase',
    cursor: 'pointer', whiteSpace: 'nowrap',
  }
}

function StatBar({ label, current, max, color }: { label: string, current: number, max: number, color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'Carlito, sans-serif', marginBottom: 2 }}>
        <span style={{ color: '#888', letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{current}/{max}</span>
      </div>
      <div style={{ height: 6, background: '#242424', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function PartyCard({ row: p }: { row: PartyRow }) {
  const wpColor = p.wp_current / Math.max(1, p.wp_max) > 0.5 ? '#7fc458' : p.wp_current / Math.max(1, p.wp_max) > 0.25 ? '#EF9F27' : '#c0392b'
  const rpColor = p.rp_current / Math.max(1, p.rp_max) > 0.5 ? '#7ab3d4' : p.rp_current / Math.max(1, p.rp_max) > 0.25 ? '#EF9F27' : '#c0392b'
  return (
    <div style={{ padding: '10px 12px', marginBottom: 8, background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${wpColor}`, borderRadius: 3 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>
        {p.name}
      </div>
      <StatBar label="Wound Points" current={p.wp_current} max={p.wp_max} color={wpColor} />
      <StatBar label="Resilience Points" current={p.rp_current} max={p.rp_max} color={rpColor} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 13, color: '#888', letterSpacing: '.06em', textTransform: 'uppercase' }}>Stress</span>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: i < p.stress ? (i >= 4 ? '#c0392b' : i >= 2 ? '#EF9F27' : '#7fc458') : '#242424', border: '1px solid #3a3a3a' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function VehicleStatus({ v }: { v: VehicleRow }) {
  const wpColor = v.wp_current / Math.max(1, v.wp_max) > 0.5 ? '#7fc458' : v.wp_current / Math.max(1, v.wp_max) > 0.25 ? '#EF9F27' : '#c0392b'
  return (
    <div style={{ padding: '10px 12px', marginBottom: 8, background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #EF9F27', borderRadius: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase' }}>{v.name}</div>
        <div style={{ fontSize: 13, color: '#EF9F27', textTransform: 'uppercase' }}>{v.type}</div>
      </div>
      <StatBar label="Wound Points" current={v.wp_current} max={v.wp_max} color={wpColor} />
      <StatBar label="Fuel (days)" current={v.fuel_current} max={v.fuel_max} color="#EF9F27" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 13, color: '#888', letterSpacing: '.06em', textTransform: 'uppercase' }}>Stress</span>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: i < v.stress ? (i >= 4 ? '#c0392b' : i >= 2 ? '#EF9F27' : '#7fc458') : '#242424', border: '1px solid #3a3a3a' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PendingHealCard({ ev, clock, canCancel, onCancel }:
  { ev: PendingHeal, clock: ClockState, canCancel: boolean, onCancel: () => void }) {
  const totalWp = ev.payload.total_wp ?? 0
  const totalRp = ev.payload.total_rp ?? 0
  const appliedWp = ev.payload.applied_wp ?? 0
  const appliedRp = ev.payload.applied_rp ?? 0
  const duration = ev.payload.duration_hours ?? 0
  const startHours = ev.scheduled_canon_day * 24 + ev.scheduled_canon_hour
  const nowHours = clock.canon_day * 24 + clock.hour
  const elapsed = Math.max(0, nowHours - startHours)
  const remaining = Math.max(0, duration - elapsed)
  const pct = duration > 0 ? Math.min(1, elapsed / duration) : 0
  return (
    <div style={{ padding: '10px 12px', marginBottom: 8, background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #7fc458', borderRadius: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase' }}>{ev.target_name}</div>
        {canCancel && (
          <button onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid #c0392b', borderRadius: 3, color: '#c0392b', fontSize: 12, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', padding: '2px 8px' }}>
            Cancel
          </button>
        )}
      </div>
      <div style={{ fontSize: 13, color: '#7fc458', marginBottom: 6 }}>
        +{totalWp} WP / +{totalRp} RP over {duration}h · <span style={{ color: '#888' }}>{ev.payload.source}</span>
      </div>
      <div style={{ height: 6, background: '#242424', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: '#7fc458', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 13, color: '#888' }}>
        Applied: {appliedWp}/{totalWp} WP, {appliedRp}/{totalRp} RP · {remaining > 0 ? `${remaining}h remaining` : 'completes on next advance'}
      </div>
    </div>
  )
}

interface HealModalProps {
  party: PartyRow[]
  onClose: () => void
  onSubmit: (args: { targetCharacterId: string, totalWp: number, totalRp: number, durationHours: number, source: string }) => Promise<void>
}

function QueueHealModal({ party, onClose, onSubmit }: HealModalProps) {
  const [target, setTarget] = useState<string>(party[0]?.character_id ?? '')
  const [wp, setWp] = useState<string>('1')
  const [rp, setRp] = useState<string>('0')
  const [duration, setDuration] = useState<string>('24')
  const [source, setSource] = useState<string>("Doctor's Kit")
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!target || submitting) return
    const totalWp = Math.max(0, Math.floor(Number(wp) || 0))
    const totalRp = Math.max(0, Math.floor(Number(rp) || 0))
    const durationHours = Math.max(1, Math.floor(Number(duration) || 0))
    if (totalWp === 0 && totalRp === 0) {
      alert('Total WP or RP must be at least 1.')
      return
    }
    setSubmitting(true)
    await onSubmit({ targetCharacterId: target, totalWp, totalRp, durationHours, source: source || 'Heal' })
    setSubmitting(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ minWidth: 380, background: '#0e0e0e', border: '1px solid #2e2e2e', borderRadius: 3, padding: 18 }}>
        <h2 style={{ color: '#7fc458', fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 12px' }}>Queue Streaming Heal</h2>
        <p style={{ fontSize: 13, color: '#888', marginTop: 0, marginBottom: 14 }}>Heal applies proportionally over the duration as the GM advances the clock. Damage to the target during the heal cancels it (Phase 3 wiring; manual Cancel button works now).</p>
        <Field label="Target">
          <select value={target} onChange={e => setTarget(e.target.value)} style={inp}>
            {party.length === 0 && <option value="">(no PCs at the table)</option>}
            {party.map(p => <option key={p.character_id} value={p.character_id}>{p.name}</option>)}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <Field label="Total WP">
            <input type="number" value={wp} onChange={e => setWp(e.target.value)} min={0} style={inp} />
          </Field>
          <Field label="Total RP">
            <input type="number" value={rp} onChange={e => setRp(e.target.value)} min={0} style={inp} />
          </Field>
          <Field label="Duration (h)">
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min={1} style={inp} />
          </Field>
        </div>
        <Field label="Source">
          <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Doctor's Kit (Juno)" style={inp} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} disabled={submitting} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #5a5550', borderRadius: 3, color: '#cce0f5', fontSize: 13, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={submitting || !target} style={{ padding: '6px 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: 3, color: '#7fc458', fontSize: 13, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: submitting ? 'wait' : 'pointer', opacity: !target ? 0.5 : 1 }}>
            {submitting ? 'Queuing…' : 'Queue Heal'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '6px 10px', background: '#1a1a1a',
  border: '1px solid #3a3a3a', borderRadius: 3,
  color: '#f5f2ee', fontSize: 13, fontFamily: 'Carlito, sans-serif',
  boxSizing: 'border-box',
}
