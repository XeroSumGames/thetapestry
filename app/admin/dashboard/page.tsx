'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

interface Stats {
  signups7d: number
  signups30d: number
  activeCampaigns: number
  ghostVisits7d: number
  topPages: { page: string; count: number }[]
  recentEvents: { id: string; username: string; event_type: string; created_at: string }[]
  pendingPins: number
  pendingNpcs: number
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

export default function ThriverDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role?.toLowerCase() !== 'thriver') { router.push('/dashboard'); return }

      const now = new Date()
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { count: signups7d },
        { count: signups30d },
        { count: activeCampaigns },
        { count: ghostVisits7d },
        { count: pendingPins },
        { count: pendingNpcs },
        { data: recentEventsRaw },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d7),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('session_status', 'active'),
        supabase.from('visitor_logs').select('*', { count: 'exact', head: true }).eq('is_ghost', true).gte('created_at', d7),
        supabase.from('map_pins').select('*', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending'),
        supabase.from('world_npcs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('user_events').select('id, user_id, event_type, created_at').order('created_at', { ascending: false }).limit(20),
      ])

      // Get usernames for recent events
      let recentEvents: Stats['recentEvents'] = []
      if (recentEventsRaw && recentEventsRaw.length > 0) {
        const userIds = [...new Set(recentEventsRaw.map((e: any) => e.user_id))]
        const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds)
        const nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))
        recentEvents = recentEventsRaw.map((e: any) => ({
          id: e.id,
          username: nameMap[e.user_id] ?? 'Unknown',
          event_type: e.event_type,
          created_at: e.created_at,
        }))
      }

      // Top pages — fetch raw visitor_logs for last 7d and aggregate client-side
      const { data: visitRows } = await supabase.from('visitor_logs').select('page').gte('created_at', d7)
      const pageCounts: Record<string, number> = {}
      for (const row of visitRows ?? []) {
        pageCounts[row.page] = (pageCounts[row.page] ?? 0) + 1
      }
      const topPages = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([page, count]) => ({ page, count }))

      setStats({
        signups7d: signups7d ?? 0,
        signups30d: signups30d ?? 0,
        activeCampaigns: activeCampaigns ?? 0,
        ghostVisits7d: ghostVisits7d ?? 0,
        topPages,
        recentEvents,
        pendingPins: pendingPins ?? 0,
        pendingNpcs: pendingNpcs ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !stats) return (
    <div style={{ padding: '2rem', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>Loading dashboard...</div>
  )

  const statCard = (label: string, value: number | string, accent?: string) => (
    <div style={{ flex: 1, minWidth: '140px', padding: '16px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', fontWeight: 700, color: accent ?? '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Thriver Dashboard
        </div>
        <div style={{ flex: 1 }} />
        <a href="/moderate" style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Moderation</a>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {statCard('Signups (7d)', stats.signups7d, '#7fc458')}
        {statCard('Signups (30d)', stats.signups30d, '#7fc458')}
        {statCard('Active Sessions', stats.activeCampaigns, '#c0392b')}
        {statCard('Ghost Visits (7d)', stats.ghostVisits7d, '#7ab3d4')}
      </div>

      {/* Moderation queue */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <a href="/moderate" style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Pending Pins</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: stats.pendingPins > 0 ? '#EF9F27' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>{stats.pendingPins}</span>
        </a>
        <a href="/moderate" style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Pending NPCs</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: stats.pendingNpcs > 0 ? '#EF9F27' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>{stats.pendingNpcs}</span>
        </a>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Top Pages */}
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Top Pages (7d)</div>
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
            {stats.topPages.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#3a3a3a', fontSize: '11px' }}>No visit data yet</div>
            ) : (
              stats.topPages.map((p, i) => (
                <div key={p.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < stats.topPages.length - 1 ? '1px solid #2e2e2e' : 'none' }}>
                  <span style={{ fontSize: '12px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif' }}>{p.page}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{p.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Events */}
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Recent Events</div>
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', maxHeight: '400px', overflowY: 'auto' }}>
            {stats.recentEvents.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#3a3a3a', fontSize: '11px' }}>No events yet</div>
            ) : (
              stats.recentEvents.map(e => (
                <div key={e.id} style={{ padding: '8px 12px', borderBottom: '1px solid #2e2e2e', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{e.username}</span>
                  <span style={{ fontSize: '10px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{e.event_type.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '9px', color: '#cce0f5', marginLeft: 'auto', flexShrink: 0 }}>{timeAgo(e.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
