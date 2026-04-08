'use client'
import { useEffect, useState, useRef } from 'react'
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
  country_code: string | null
  region: string | null
  city: string | null
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
  const [visitorFilter, setVisitorFilter] = useState('')
  const [excludeTerms, setExcludeTerms] = useState<string[]>([])
  const [events, setEvents] = useState<UserEvent[]>([])
  const [eventFilter, setEventFilter] = useState('')
  const [eventExcludeTerms, setEventExcludeTerms] = useState<string[]>([])
  const [visitorCount, setVisitorCount] = useState(0)
  const [eventCount, setEventCount] = useState(0)
  const [signups7d, setSignups7d] = useState(0)
  const [signups30d, setSignups30d] = useState(0)
  const [activeSessions, setActiveSessions] = useState(0)
  const [ghostVisits7d, setGhostVisits7d] = useState(0)
  const [pendingPins, setPendingPins] = useState(0)
  const [pendingNpcs, setPendingNpcs] = useState(0)
  const [topPages, setTopPages] = useState<{ page: string; count: number }[]>([])
  const [visitorMapData, setVisitorMapData] = useState<{ ip_hash: string; lat: number; lng: number; city: string | null; country_code: string | null; visit_count: number; first_visit: string; last_visit: string; is_ghost: boolean }[]>([])
  const [uniqueVisitors, setUniqueVisitors] = useState(0)
  const [uniqueCountries, setUniqueCountries] = useState(0)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

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
          supabase.from('visitor_logs').select('id, page, user_id, is_ghost, ip_address, ip_hash, country_code, region, city, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
          supabase.from('user_events').select('id, user_id, event_type, metadata, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d7),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d30),
          supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('session_status', 'active'),
          supabase.from('visitor_logs').select('id', { count: 'exact', head: true }).eq('is_ghost', true).gte('created_at', d7),
          supabase.from('map_pins').select('id', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending'),
          supabase.from('world_npcs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        setSignups7d(s7 ?? 0)
        setSignups30d(s30 ?? 0)
        setActiveSessions(ac ?? 0)
        setGhostVisits7d(gv ?? 0)
        setPendingPins(pp ?? 0)
        setPendingNpcs(pn ?? 0)

        // Top pages — resolve campaign UUIDs to names
        const { data: visitRows } = await supabase.from('visitor_logs').select('page').gte('created_at', d7)
        const pageCounts: Record<string, number> = {}
        for (const row of visitRows ?? []) pageCounts[row.page] = (pageCounts[row.page] ?? 0) + 1
        const topRaw = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)

        // Extract campaign IDs from paths like /stories/UUID/...
        const campaignIds = new Set<string>()
        for (const [page] of topRaw) {
          const match = page.match(/\/(?:campaigns|stories)\/([a-f0-9-]{36})/)
          if (match) campaignIds.add(match[1])
        }
        let campaignNames: Record<string, string> = {}
        if (campaignIds.size > 0) {
          const { data: camps } = await supabase.from('campaigns').select('id, name').in('id', [...campaignIds])
          campaignNames = Object.fromEntries((camps ?? []).map((c: any) => [c.id, c.name]))
        }
        setTopPages(topRaw.map(([page, count]) => {
          let displayPage = page
          for (const [id, name] of Object.entries(campaignNames)) {
            displayPage = displayPage.replace(id, name)
          }
          return { page: displayPage, count }
        }))
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
        // Fetch visitor map data — grouped by ip_hash
        const { data: mapRows } = await supabase.rpc('get_visitor_map_data')
        if (mapRows) {
          setVisitorMapData(mapRows)
          setUniqueVisitors(mapRows.length)
          setUniqueCountries(new Set(mapRows.map((r: any) => r.country_code).filter(Boolean)).size)
        }
      } catch (err) {
        console.error('[Logging] load error:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  // Render visitor map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || visitorMapData.length === 0) return
    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, { center: [20, 0], zoom: 2, zoomControl: true, minZoom: 2 })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO', maxZoom: 19,
      }).addTo(map)

      visitorMapData.forEach(v => {
        if (!v.lat || !v.lng) return
        const size = Math.min(20, 6 + Math.floor(v.visit_count / 2))
        const color = v.is_ghost ? '#c0392b' : '#7fc458'
        const icon = L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;opacity:0.8;border:1px solid rgba(255,255,255,0.3);"></div>`,
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        })
        const marker = L.marker([v.lat, v.lng], { icon })
        marker.bindPopup(`
          <div style="font-family:Barlow,sans-serif;min-width:160px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${[v.city, v.country_code].filter(Boolean).join(', ') || 'Unknown'}</div>
            <div style="font-size:12px;color:#555;">
              ${v.is_ghost ? 'Ghost' : 'Survivor'}<br/>
              Visits: ${v.visit_count}<br/>
              First: ${new Date(v.first_visit).toLocaleDateString()}<br/>
              Last: ${new Date(v.last_visit).toLocaleDateString()}
            </div>
          </div>
        `)
        marker.addTo(map)
      })

      mapInstanceRef.current = map
      setTimeout(() => map.invalidateSize(), 100)
    }
    initMap()
  }, [visitorMapData])

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

      {/* Visitor Map */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em' }}>Visitor Map</span>
          <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
            {uniqueVisitors} unique visitors from {uniqueCountries} {uniqueCountries === 1 ? 'country' : 'countries'}
          </span>
        </div>
        <div ref={mapRef} style={{ height: '400px', background: '#0d0d0d' }} />
        <div style={{ padding: '6px 14px', borderTop: '1px solid #2e2e2e', display: 'flex', gap: '16px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', color: '#cce0f5' }}>
          <span><span style={{ color: '#c0392b', fontSize: '14px' }}>●</span> Ghost</span>
          <span><span style={{ color: '#7fc458', fontSize: '14px' }}>●</span> Survivor</span>
          <span style={{ color: '#3a3a3a' }}>Dot size = visit frequency</span>
        </div>
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
          {/* Filter bar */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #2e2e2e', background: '#111' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={visitorFilter} onChange={e => setVisitorFilter(e.target.value)} placeholder="Search..."
                style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && visitorFilter.trim()) {
                    const term = visitorFilter.trim().toLowerCase()
                    if (!excludeTerms.includes(term)) setExcludeTerms(prev => [...prev, term])
                    setVisitorFilter('')
                  }
                }} />
              <span style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Enter = Exclude</span>
            </div>
            {excludeTerms.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '4px' }}>Excluding:</span>
                {excludeTerms.map(term => (
                  <button key={term} onClick={() => setExcludeTerms(prev => prev.filter(t => t !== term))}
                    style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {term} <span style={{ fontSize: '13px' }}>×</span>
                  </button>
                ))}
                <button onClick={() => setExcludeTerms([])}
                  style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', cursor: 'pointer' }}>
                  Clear All
                </button>
              </div>
            )}
          </div>
          {/* Table header */}
          <div style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid #2e2e2e', background: '#111' }}>
            <div style={{ flex: 2, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Page</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>User</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>IP</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Time</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>When</div>
          </div>
          {visitors.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px' }}>No visitor logs yet.</div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {visitors.filter(v => {
                const haystack = [v.username, v.ip_address, v.page, v.city, v.country_code].filter(Boolean).join(' ').toLowerCase()
                if (excludeTerms.some(term => haystack.includes(term))) return false
                if (!visitorFilter.trim()) return true
                return haystack.includes(visitorFilter.trim().toLowerCase())
              }).map(v => (
                <div key={v.id} style={{ display: 'flex', padding: '6px 12px', borderBottom: '1px solid #2e2e2e', alignItems: 'center' }}>
                  <div style={{ flex: 2, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.page}</div>
                  <div style={{ flex: 1, fontSize: '13px', color: v.username ? '#7fc458' : '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.username ?? (v.is_ghost ? 'Ghost' : 'User')}
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[v.city, v.region, v.country_code].filter(Boolean).join(', ') || v.ip_address || '—'}</div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>{new Date(v.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</div>
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
          {/* Filter bar */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #2e2e2e', background: '#111' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input value={eventFilter} onChange={e => setEventFilter(e.target.value)} placeholder="Search..."
                style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && eventFilter.trim()) {
                    const term = eventFilter.trim().toLowerCase()
                    if (!eventExcludeTerms.includes(term)) setEventExcludeTerms(prev => [...prev, term])
                    setEventFilter('')
                  }
                }} />
              <span style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Enter = Exclude</span>
            </div>
            {eventExcludeTerms.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '4px' }}>Excluding:</span>
                {eventExcludeTerms.map(term => (
                  <button key={term} onClick={() => setEventExcludeTerms(prev => prev.filter(t => t !== term))}
                    style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {term} <span style={{ fontSize: '13px' }}>×</span>
                  </button>
                ))}
                <button onClick={() => setEventExcludeTerms([])}
                  style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', cursor: 'pointer' }}>
                  Clear All
                </button>
              </div>
            )}
          </div>
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
              {events.filter(e => {
                const haystack = [e.username, e.event_type, e.metadata ? JSON.stringify(e.metadata) : ''].filter(Boolean).join(' ').toLowerCase()
                if (eventExcludeTerms.some(term => haystack.includes(term))) return false
                if (!eventFilter.trim()) return true
                return haystack.includes(eventFilter.trim().toLowerCase())
              }).map(e => (
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
