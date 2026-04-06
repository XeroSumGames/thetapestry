'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

interface VisitorLog {
  id: string
  session_id: string
  page: string
  referrer: string | null
  is_ghost: boolean
  ip_address: string | null
  user_id: string | null
  created_at: string
  username?: string
}

interface UserEvent {
  id: string
  user_id: string
  event_type: string
  metadata: any
  created_at: string
  username?: string
}

export default function LoggingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'visitors' | 'events'>('visitors')
  const [visitors, setVisitors] = useState<VisitorLog[]>([])
  const [events, setEvents] = useState<UserEvent[]>([])
  const [visitorCount, setVisitorCount] = useState(0)
  const [eventCount, setEventCount] = useState(0)
  const [signups7d, setSignups7d] = useState(0)
  const [signups30d, setSignups30d] = useState(0)
  const [activeSessions, setActiveSessions] = useState(0)
  const [ghostVisits7d, setGhostVisits7d] = useState(0)
  const [pendingPins, setPendingPins] = useState(0)
  const [pendingNpcs, setPendingNpcs] = useState(0)
  const [topPages, setTopPages] = useState<{ page: string; count: number }[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role?.toLowerCase() !== 'thriver') { router.push('/dashboard'); return }

      try {
        const now = new Date()
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

        const [
          { data: vData, count: vCount },
          { data: eData, count: eCount },
          { count: s7 },
          { count: s30 },
          { count: ac },
          { count: gv },
          { count: pp },
          { count: pn },
        ] = await Promise.all([
          supabase.from('visitor_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
          supabase.from('user_events').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d7),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30),
          supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('session_status', 'active'),
          supabase.from('visitor_logs').select('*', { count: 'exact', head: true }).eq('is_ghost', true).gte('created_at', d7),
          supabase.from('map_pins').select('*', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending'),
          supabase.from('world_npcs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        setSignups7d(s7 ?? 0)
        setSignups30d(s30 ?? 0)
        setActiveSessions(ac ?? 0)
        setGhostVisits7d(gv ?? 0)
        setPendingPins(pp ?? 0)
        setPendingNpcs(pn ?? 0)

        // Top pages
        const { data: visitRows } = await supabase.from('visitor_logs').select('page').gte('created_at', d7)
        const pageCounts: Record<string, number> = {}
        for (const row of visitRows ?? []) pageCounts[row.page] = (pageCounts[row.page] ?? 0) + 1
        setTopPages(Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([page, count]) => ({ page, count })))
        const rawVisitors = vData ?? []
        if (rawVisitors.length > 0) {
          const vUserIds = [...new Set(rawVisitors.filter((v: any) => v.user_id).map((v: any) => v.user_id))]
          if (vUserIds.length > 0) {
            const { data: vProfiles } = await supabase.from('profiles').select('id, username').in('id', vUserIds)
            const vNameMap = Object.fromEntries((vProfiles ?? []).map((p: any) => [p.id, p.username]))
            setVisitors(rawVisitors.map((v: any) => ({ ...v, username: v.user_id ? vNameMap[v.user_id] : undefined })))
          } else {
            setVisitors(rawVisitors)
          }
        }
        setVisitorCount(vCount ?? 0)

        // Get usernames for events
        const rawEvents = eData ?? []
        if (rawEvents.length > 0) {
          const userIds = [...new Set(rawEvents.map((e: any) => e.user_id))]
          const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds)
          const nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))
          setEvents(rawEvents.map((e: any) => ({ ...e, username: nameMap[e.user_id] ?? 'Unknown' })))
        }
        setEventCount(eCount ?? 0)
      } catch (err) {
        console.error('[Logging] load error:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
    })
  }

  function timeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (loading) return (
    <div style={{ padding: '2rem', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>Loading logs...</div>
  )

  const tabStyle = (active: boolean) => ({
    padding: '7px 16px',
    border: `1px solid ${active ? '#c0392b' : '#3a3a3a'}`,
    background: active ? '#2a1210' : '#242424',
    color: active ? '#f5a89a' : '#d4cfc9',
    borderRadius: '3px', cursor: 'pointer' as const,
    fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase' as const,
  })

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Activity Log
        </div>
        <div style={{ flex: 1 }} />
        <a href="/moderate" style={{ padding: '5px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Moderation</a>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Signups (7d)', value: signups7d, color: '#7fc458' },
          { label: 'Signups (30d)', value: signups30d, color: '#7fc458' },
          { label: 'Active Sessions', value: activeSessions, color: '#c0392b' },
          { label: 'Ghost Visits (7d)', value: ghostVisits7d, color: '#7ab3d4' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: '120px', padding: '14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color, fontFamily: 'Barlow Condensed, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Moderation queue */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <a href="/moderate" style={{ flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Pending Pins</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: pendingPins > 0 ? '#EF9F27' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>{pendingPins}</span>
        </a>
        <a href="/moderate" style={{ flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Pending NPCs</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: pendingNpcs > 0 ? '#EF9F27' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>{pendingNpcs}</span>
        </a>
      </div>

      {/* Top Pages */}
      {topPages.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Top Pages (7d)</div>
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
            {topPages.map((p, i) => (
              <div key={p.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < topPages.length - 1 ? '1px solid #2e2e2e' : 'none' }}>
                <span style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif' }}>{p.page}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
        <button onClick={() => setTab('visitors')} style={tabStyle(tab === 'visitors')}>
          Page Visits ({visitorCount})
        </button>
        <button onClick={() => setTab('events')} style={tabStyle(tab === 'events')}>
          User Events ({eventCount})
        </button>
      </div>

      {/* Visitors tab */}
      {tab === 'visitors' && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid #2e2e2e', background: '#111' }}>
            <div style={{ flex: 2, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Page</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>User</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>IP</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>When</div>
          </div>
          {visitors.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px' }}>No visitor logs yet.</div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {visitors.map(v => (
                <div key={v.id} style={{ display: 'flex', padding: '6px 12px', borderBottom: '1px solid #2e2e2e', alignItems: 'center' }}>
                  <div style={{ flex: 2, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.page}</div>
                  <div style={{ flex: 1, fontSize: '13px', color: v.username ? '#7fc458' : '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.username ?? (v.is_ghost ? 'Ghost' : 'User')}
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.ip_address ?? '—'}</div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5' }}>{timeAgo(v.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events tab */}
      {tab === 'events' && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid #2e2e2e', background: '#111' }}>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>User</div>
            <div style={{ flex: 2, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Event</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>When</div>
            <div style={{ flex: 2, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Details</div>
          </div>
          {events.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px' }}>No user events yet.</div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {events.map(e => (
                <div key={e.id} style={{ display: 'flex', padding: '6px 12px', borderBottom: '1px solid #2e2e2e', alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{e.username}</div>
                  <div style={{ flex: 2 }}>
                    <span style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
                      {e.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5' }}>{timeAgo(e.created_at)}</div>
                  <div style={{ flex: 2, fontSize: '13px', color: '#cce0f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.metadata ? JSON.stringify(e.metadata) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
