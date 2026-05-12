'use client'

// Campaign Sheet — Phase 1.
//
// Popout-style page (sidebar auto-hidden via LayoutShell's
// FULL_WIDTH_PATTERN matching the `-sheet` suffix). Three panels:
// clock header (with GM-only advance buttons), past+present timeline,
// pending effects (Phase 2+). See tasks/spec-campaign-sheet.md.

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { advance, readClock, type ClockState } from '../../lib/campaign-clock'
import { dayToCalendar, eventsOnDay, pastAndPresentEvents, hourTo12h } from '../../lib/distemper-timeline'

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

  const isGM = !!myUserId && !!gmUserId && myUserId === gmUserId

  // Initial load + realtime subscription on the clock.
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
      setLoaded(true)
    }
    load()
    // Realtime: postgres_changes on the campaigns row catches setClock
    // edits made elsewhere; the broadcast channel catches advance()
    // calls from this user's GM tab + every other viewer.
    const broadcastCh = supabase.channel(`campaign_clock_${campaignId}`)
      .on('broadcast', { event: 'clock_advanced' }, (msg: any) => {
        const next = msg?.payload?.clock as ClockState | undefined
        if (next) setClockState(next)
      })
      .on('broadcast', { event: 'clock_set' }, (msg: any) => {
        const next = msg?.payload?.clock as ClockState | undefined
        if (next) setClockState(next)
      })
      .subscribe()
    const pgCh = supabase.channel(`campaign_clock_pg_${campaignId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        (payload: any) => {
          const c = payload?.new?.clock as ClockState | undefined
          if (c && typeof c.canon_day === 'number' && typeof c.hour === 'number') {
            setClockState({ canon_day: c.canon_day, hour: c.hour })
          }
        })
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(broadcastCh)
      supabase.removeChannel(pgCh)
    }
  }, [campaignId, supabase])

  const calendar = dayToCalendar(clock.canon_day)
  const todaysEvents = eventsOnDay(clock.canon_day)
  const timeline = pastAndPresentEvents(clock.canon_day).slice().reverse() // newest first

  async function handleAdvance(hours: number) {
    if (!isGM || advancing) return
    setAdvancing(true)
    const next = await advance(campaignId, hours)
    if (next) setClockState(next)
    setAdvancing(false)
  }

  if (!campaignId) {
    return (
      <div style={{ padding: 24, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', fontSize: 13 }}>
        Missing campaign id. Open the sheet from the table page.
      </div>
    )
  }

  if (!loaded) {
    return (
      <div style={{ padding: 24, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', fontSize: 13 }}>
        Loading campaign sheet…
      </div>
    )
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

      {/* ── GM-only advance buttons ─────────────────────────── */}
      {isGM && (
        <div style={{ marginBottom: 28, padding: '10px 14px', background: '#14181c', border: '1px solid #2e2e2e', borderRadius: 3 }}>
          <div style={{ fontSize: 12, color: '#cce0f5', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Advance Time (GM)
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 4, 8, 12, 24].map(h => (
              <button key={h} onClick={() => handleAdvance(h)} disabled={advancing}
                style={{
                  height: 32, padding: '0 14px',
                  background: advancing ? '#1a1a1a' : '#1a2e10',
                  border: '1px solid #2d5a1b',
                  borderRadius: 3,
                  color: '#7fc458',
                  fontSize: 13, fontFamily: 'Carlito, sans-serif',
                  letterSpacing: '.06em', textTransform: 'uppercase',
                  cursor: advancing ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                +{h}h
              </button>
            ))}
          </div>
        </div>
      )}
      {!isGM && (
        <div style={{ marginBottom: 28, padding: '8px 12px', background: '#14181c', border: '1px solid #2e2e2e', borderRadius: 3, fontSize: 13, color: '#888', fontStyle: 'italic' }}>
          Only the GM can advance the clock.
        </div>
      )}

      {/* ── Panel: Timeline (past + present) ────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: '#cce0f5', fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 12px', paddingBottom: 6, borderBottom: '1px solid #2e2e2e' }}>
          Timeline
        </h2>
        {timeline.length === 0 ? (
          <div style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>
            No canonical events have occurred yet.
          </div>
        ) : (
          <div>
            {timeline.map(e => {
              const cal = dayToCalendar(e.canon_day)
              const isToday = e.canon_day === clock.canon_day
              return (
                <div key={`${e.canon_day}-${e.event.slice(0, 20)}`}
                  style={{
                    padding: '8px 12px',
                    marginBottom: 6,
                    background: isToday ? '#1a2010' : '#1a1a1a',
                    border: '1px solid #2e2e2e',
                    borderLeft: `3px solid ${isToday ? '#EF9F27' : '#3a3a3a'}`,
                    borderRadius: 3,
                  }}>
                  <div style={{ fontSize: 13, color: isToday ? '#EF9F27' : '#888', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                    Day {e.canon_day} · {cal.monthName} {cal.dayOrdinal}, Year {cal.yearNumber}
                    {isToday && <span style={{ marginLeft: 8, color: '#EF9F27', fontWeight: 700 }}>· Today</span>}
                  </div>
                  <div style={{ fontSize: 15, color: '#d4cfc9' }}>
                    {e.event}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Panel: Pending effects (Phase 2+) ───────────────── */}
      <div>
        <h2 style={{ color: '#cce0f5', fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 12px', paddingBottom: 6, borderBottom: '1px solid #2e2e2e' }}>
          Pending Effects
        </h2>
        <div style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>
          No pending effects. (Healing, ration consumption, and other over-time effects will appear here once Phase 2 ships.)
        </div>
      </div>
    </div>
  )
}
