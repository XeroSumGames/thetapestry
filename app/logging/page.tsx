'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase-browser'
import { loginPathForCurrent } from '../../lib/login-redirect'
import { getCachedAuth } from '../../lib/auth-cache'
import { isThriver as roleIsThriver } from '../../lib/auth/roles'
import { useRouter } from 'next/navigation'

interface VisitorLog {
  id: string
  session_id: string
  page: string
  site?: string | null
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
  const [site, setSite] = useState<'all' | 'tapestry' | 'tableau' | 'table'>('all')
  const [visitors, setVisitors] = useState<VisitorLog[]>([])
  const [visitorFilter, setVisitorFilter] = useState('')
  const [excludeTerms, setExcludeTerms] = useState<string[]>([])
  const [includeTerms, setIncludeTerms] = useState<string[]>([])
  const [events, setEvents] = useState<UserEvent[]>([])
  const [eventFilter, setEventFilter] = useState('')
  const [eventExcludeTerms, setEventExcludeTerms] = useState<string[]>([])
  const [eventIncludeTerms, setEventIncludeTerms] = useState<string[]>([])
  // Shared toggle - which chip list Enter adds to. One preference for both
  // tabs since only one tab is visible at a time.
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
  const markerLayerRef = useRef<any>(null)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { router.push(loginPathForCurrent()); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!roleIsThriver(profile)) { router.push('/dashboard'); return }

      try {
        const now = new Date()
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

        // Site filter: 'all' = no filter; 'tapestry' also includes legacy rows
        // logged before the site column existed (site IS NULL).
        const applySite = (q: any) =>
          site === 'all' ? q
            : site === 'tapestry' ? q.or('site.eq.tapestry,site.is.null')
            : q.eq('site', site)

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
          applySite(supabase.from('visitor_logs').select('id, page, site, user_id, is_ghost, ip_address, ip_hash, country_code, region, city, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100)),
          supabase.from('user_events').select('id, user_id, event_type, metadata, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d7),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d30),
          supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('session_status', 'active'),
          applySite(supabase.from('visitor_logs').select('id', { count: 'exact', head: true }).eq('is_ghost', true).gte('created_at', d7)),
          supabase.from('map_pins').select('id', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending'),
          supabase.from('world_npcs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        setSignups7d(s7 ?? 0)
        setSignups30d(s30 ?? 0)
        setActiveSessions(ac ?? 0)
        setGhostVisits7d(gv ?? 0)
        setPendingPins(pp ?? 0)
        setPendingNpcs(pn ?? 0)

        // Top pages - resolve campaign UUIDs to names
        const { data: visitRows } = await applySite(supabase.from('visitor_logs').select('page').gte('created_at', d7))
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
        // Fetch visitor map data - grouped by ip_hash
        const { data: mapRows } = await supabase.rpc('get_visitor_map_data', site === 'all' ? {} : { p_site: site })
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
  }, [site])

  // Server-side visitor search. The initial load() only pulls the newest 100
  // rows, and filtering the search box against that capped snapshot meant a
  // user whose last logged visit had scrolled past row 100 returned ZERO hits
  // even though the tab count showed 11k+ rows (Xero hit this searching for a
  // live "Online Now" user - presence is a separate system with no dependency
  // on visitor_logs, so their last logged visit can be arbitrarily old). When
  // a term is typed, query the DB directly instead: username lives on profiles
  // (not visitor_logs), so resolve matching user_ids first, then ilike across
  // the visitor_logs columns OR user_id in that set. The include/exclude chips
  // still refine client-side on top of the returned set. Debounced + seq-
  // guarded (fast typing can't let a slow response clobber a newer one); an
  // empty term restores the newest 100.
  const searchMountRef = useRef(false)
  const searchSeqRef = useRef(0)
  useEffect(() => {
    if (!searchMountRef.current) { searchMountRef.current = true; return }
    // Strip PostgREST-reserved + wildcard chars so the term is a safe literal
    // substring in the .or() filter (PostgREST parameterizes values, so this
    // is about not breaking the filter grammar, not SQL injection).
    const term = visitorFilter.trim().toLowerCase().replace(/[,()"*%\\]/g, '')
    const handle = setTimeout(async () => {
      const seq = ++searchSeqRef.current
      const COLS = 'id, page, site, user_id, is_ghost, ip_address, ip_hash, country_code, region, city, created_at'
      const applySite = (q: any) =>
        site === 'all' ? q : site === 'tapestry' ? q.or('site.eq.tapestry,site.is.null') : q.eq('site', site)
      let q = applySite(supabase.from('visitor_logs').select(COLS).order('created_at', { ascending: false }).limit(term ? 500 : 100))
      if (term) {
        const { data: users } = await supabase.from('profiles').select('id').ilike('username', `%${term}%`).limit(500)
        const uids = (users ?? []).map((u: any) => u.id)
        // Columns kept in sync with the client haystack (below) so a
        // server match is never hidden by the client re-filter. (username
        // is matched via the user_id.in set resolved above.)
        const parts = [`page.ilike.*${term}*`, `city.ilike.*${term}*`, `country_code.ilike.*${term}*`, `ip_address.ilike.*${term}*`]
        if (uids.length) parts.push(`user_id.in.(${uids.join(',')})`)
        q = q.or(parts.join(','))
      }
      const { data } = await q
      if (seq !== searchSeqRef.current) return // superseded by a newer search
      const rows = data ?? []
      const rUids = [...new Set(rows.filter((v: any) => v.user_id).map((v: any) => v.user_id))]
      let nameMap: Record<string, string> = {}
      if (rUids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, username').in('id', rUids)
        nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
      }
      if (seq !== searchSeqRef.current) return
      setVisitors(rows.map((v: any) => ({ ...v, username: v.user_id ? nameMap[v.user_id] : undefined })))
    }, 300)
    return () => clearTimeout(handle)
  }, [visitorFilter, site])

  // Server-side User Events search - same capped-100 bug as the visitor
  // search above, same fix. username lives on profiles, so resolve matching
  // user_ids first, then .or() ilike on event_type OR user_id.in(...). NOTE:
  // metadata is jsonb and PostgREST can't ilike a whole-column text cast, so a
  // term that appears ONLY inside a metadata payload stays window-bounded
  // (the client haystack below still matches it within the returned set) -
  // full metadata search across all rows is what the deferred SQL search RPC
  // would add. Debounced + seq-guarded; empty term restores the newest 100.
  const eventSearchMountRef = useRef(false)
  const eventSearchSeqRef = useRef(0)
  useEffect(() => {
    if (!eventSearchMountRef.current) { eventSearchMountRef.current = true; return }
    const term = eventFilter.trim().toLowerCase().replace(/[,()"*%\\]/g, '')
    const handle = setTimeout(async () => {
      const seq = ++eventSearchSeqRef.current
      let q = supabase.from('user_events').select('id, user_id, event_type, metadata, created_at').order('created_at', { ascending: false }).limit(term ? 500 : 100)
      if (term) {
        const { data: users } = await supabase.from('profiles').select('id').ilike('username', `%${term}%`).limit(500)
        const uids = (users ?? []).map((u: any) => u.id)
        const parts = [`event_type.ilike.*${term}*`]
        if (uids.length) parts.push(`user_id.in.(${uids.join(',')})`)
        q = q.or(parts.join(','))
      }
      const { data } = await q
      if (seq !== eventSearchSeqRef.current) return // superseded by a newer search
      const rows = data ?? []
      const rUids = [...new Set(rows.map((e: any) => e.user_id).filter(Boolean))]
      let nameMap: Record<string, string> = {}
      if (rUids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, username').in('id', rUids)
        nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
      }
      if (seq !== eventSearchSeqRef.current) return
      setEvents(rows.map((e: any) => ({ ...e, username: nameMap[e.user_id] ?? 'Unknown' })))
    }, 300)
    return () => clearTimeout(handle)
  }, [eventFilter])

  // Render visitor map. Inits once, then re-draws its markers whenever the data
  // changes (e.g. switching the site filter) via a dedicated marker layer.
  useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false
    async function render() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !mapRef.current) return

      let map = mapInstanceRef.current
      if (!map) {
        map = L.map(mapRef.current, { center: [20, 0], zoom: 2, zoomControl: true, minZoom: 2 })
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; CARTO', maxZoom: 19,
        }).addTo(map)
        mapInstanceRef.current = map
        markerLayerRef.current = L.layerGroup().addTo(map)
        setTimeout(() => map.invalidateSize(), 100)
      }

      const layer = markerLayerRef.current
      layer.clearLayers()
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
          <div style="font-family:Carlito,sans-serif;min-width:160px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${[v.city, v.country_code].filter(Boolean).join(', ') || 'Unknown'}</div>
            <div style="font-size:12px;color:#555;">
              ${v.is_ghost ? 'Ghost' : 'Survivor'}<br/>
              Visits: ${v.visit_count}<br/>
              First: ${new Date(v.first_visit).toLocaleDateString()}<br/>
              Last: ${new Date(v.last_visit).toLocaleDateString()}
            </div>
          </div>
        `)
        marker.addTo(layer)
      })
    }
    render()
    return () => { cancelled = true }
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
    <div style={{ padding: '2rem', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>Loading logs...</div>
  )

  const tabStyle = (active: boolean) => ({
    padding: '7px 16px',
    border: `1px solid ${active ? '#c0392b' : '#3a3a3a'}`,
    background: active ? '#2a1210' : '#242424',
    color: active ? '#f5a89a' : '#f5f2ee',
    borderRadius: '3px', cursor: 'pointer' as const,
    fontSize: '13px', fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase' as const,
  })

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Carlito, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Activity Log
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/moderate" style={{ padding: '5px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Moderation</Link>
      </div>

      {/* Site selector - which property's logs to view */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {([
          ['all', 'All Sites', '#8a8a8a'],
          ['tapestry', 'The Tapestry', '#c0392b'],
          ['tableau', 'The Tableau', '#7ab3d4'],
          ['table', 'The Table', '#b8873f'],
        ] as const).map(([key, label, color]) => {
          const active = site === key
          return (
            <button key={key} onClick={() => setSite(key)} style={{
              padding: '8px 16px',
              border: `1px solid ${active ? color : '#3a3a3a'}`,
              borderLeft: `4px solid ${color}`,
              background: active ? '#242424' : '#1a1a1a',
              color: active ? '#f5f2ee' : '#cce0f5',
              borderRadius: '3px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'Carlito, sans-serif',
              letterSpacing: '.06em', textTransform: 'uppercase',
              fontWeight: active ? 700 : 400,
            }}>{label}</button>
          )
        })}
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
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color, fontFamily: 'Carlito, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Moderation queue */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <Link href="/moderate" style={{ flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Pending Pins</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: pendingPins > 0 ? '#EF9F27' : '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>{pendingPins}</span>
        </Link>
        <Link href="/moderate" style={{ flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Pending NPCs</span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: pendingNpcs > 0 ? '#EF9F27' : '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>{pendingNpcs}</span>
        </Link>
      </div>

      {/* Visitor Map */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em' }}>Visitor Map</span>
          <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
            {uniqueVisitors} unique visitors from {uniqueCountries} {uniqueCountries === 1 ? 'country' : 'countries'}
          </span>
        </div>
        <div ref={mapRef} style={{ height: '400px', background: '#0d0d0d' }} />
        <div style={{ padding: '6px 14px', borderTop: '1px solid #2e2e2e', display: 'flex', gap: '16px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', color: '#cce0f5' }}>
          <span><span style={{ color: '#c0392b', fontSize: '14px' }}>●</span> Ghost</span>
          <span><span style={{ color: '#7fc458', fontSize: '14px' }}>●</span> Survivor</span>
          <span style={{ color: '#3a3a3a' }}>Dot size = visit frequency</span>
        </div>
      </div>

      {/* Top Pages */}
      {topPages.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>Top Pages (7d)</div>
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
            {topPages.map((p, i) => (
              <div key={p.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < topPages.length - 1 ? '1px solid #2e2e2e' : 'none' }}>
                <span style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>{p.page}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>{p.count}</span>
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
                style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none' }} />
              <button onClick={() => { const term = visitorFilter.trim().toLowerCase(); if (term && !includeTerms.includes(term)) setIncludeTerms(prev => [...prev, term]); setVisitorFilter('') }}
                title="Add the search text as an Include filter"
                style={{ padding: '4px 10px', background: '#0f1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                + Include
              </button>
              <button onClick={() => { const term = visitorFilter.trim().toLowerCase(); if (term && !excludeTerms.includes(term)) setExcludeTerms(prev => [...prev, term]); setVisitorFilter('') }}
                title="Add the search text as an Exclude filter"
                style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                + Exclude
              </button>
            </div>
            {(includeTerms.length > 0 || excludeTerms.length > 0) && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                {includeTerms.length > 0 && (<>
                  <span style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '4px' }}>Including:</span>
                  {includeTerms.map(term => (
                    <button key={term} onClick={() => setIncludeTerms(prev => prev.filter(t => t !== term))}
                      style={{ padding: '2px 8px', background: '#0f1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {term} <span style={{ fontSize: '13px' }}>×</span>
                    </button>
                  ))}
                  <button onClick={() => setIncludeTerms([])}
                    style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer' }}>
                    Clear All
                  </button>
                </>)}
                {excludeTerms.length > 0 && (<>
                  <span style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '4px', marginLeft: includeTerms.length > 0 ? '10px' : 0 }}>Excluding:</span>
                  {excludeTerms.map(term => (
                    <button key={term} onClick={() => setExcludeTerms(prev => prev.filter(t => t !== term))}
                      style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {term} <span style={{ fontSize: '13px' }}>×</span>
                    </button>
                  ))}
                  <button onClick={() => setExcludeTerms([])}
                    style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer' }}>
                    Clear All
                  </button>
                </>)}
              </div>
            )}
          </div>
          {/* Table header */}
          <div style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid #2e2e2e', background: '#111' }}>
            <div style={{ flex: 2, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Page</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>User</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>IP</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Time</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>When</div>
          </div>
          {visitors.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px' }}>No visitor logs yet.</div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {visitors.filter(v => {
                const haystack = [v.username, v.ip_address, v.page, v.city, v.country_code].filter(Boolean).join(' ').toLowerCase()
                if (excludeTerms.some(term => haystack.includes(term))) return false
                if (includeTerms.length > 0 && !includeTerms.some(term => haystack.includes(term))) return false
                if (!visitorFilter.trim()) return true
                return haystack.includes(visitorFilter.trim().toLowerCase())
              }).map(v => (
                <div key={v.id} style={{ display: 'flex', padding: '6px 12px', borderBottom: '1px solid #2e2e2e', alignItems: 'center' }}>
                  <div style={{ flex: 2, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {v.site && <span style={{ fontSize: '13px', padding: '0 6px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#0d0d0d', fontWeight: 700, flexShrink: 0, background: v.site === 'tableau' ? '#7ab3d4' : v.site === 'table' ? '#b8873f' : '#c0392b' }}>{v.site}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.page}</span>
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: v.username ? '#7fc458' : '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.username ?? (v.is_ghost ? 'Ghost' : 'User')}
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[v.city, v.region, v.country_code].filter(Boolean).join(', ') || v.ip_address || '-'}</div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>{new Date(v.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</div>
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
                style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none' }} />
              <button onClick={() => { const term = eventFilter.trim().toLowerCase(); if (term && !eventIncludeTerms.includes(term)) setEventIncludeTerms(prev => [...prev, term]); setEventFilter('') }}
                title="Add the search text as an Include filter"
                style={{ padding: '4px 10px', background: '#0f1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                + Include
              </button>
              <button onClick={() => { const term = eventFilter.trim().toLowerCase(); if (term && !eventExcludeTerms.includes(term)) setEventExcludeTerms(prev => [...prev, term]); setEventFilter('') }}
                title="Add the search text as an Exclude filter"
                style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                + Exclude
              </button>
            </div>
            {(eventIncludeTerms.length > 0 || eventExcludeTerms.length > 0) && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                {eventIncludeTerms.length > 0 && (<>
                  <span style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '4px' }}>Including:</span>
                  {eventIncludeTerms.map(term => (
                    <button key={term} onClick={() => setEventIncludeTerms(prev => prev.filter(t => t !== term))}
                      style={{ padding: '2px 8px', background: '#0f1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {term} <span style={{ fontSize: '13px' }}>×</span>
                    </button>
                  ))}
                  <button onClick={() => setEventIncludeTerms([])}
                    style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer' }}>
                    Clear All
                  </button>
                </>)}
                {eventExcludeTerms.length > 0 && (<>
                  <span style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '4px', marginLeft: eventIncludeTerms.length > 0 ? '10px' : 0 }}>Excluding:</span>
                  {eventExcludeTerms.map(term => (
                    <button key={term} onClick={() => setEventExcludeTerms(prev => prev.filter(t => t !== term))}
                      style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {term} <span style={{ fontSize: '13px' }}>×</span>
                    </button>
                  ))}
                  <button onClick={() => setEventExcludeTerms([])}
                    style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer' }}>
                    Clear All
                  </button>
                </>)}
              </div>
            )}
          </div>
          {/* Table header */}
          <div style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid #2e2e2e', background: '#111' }}>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>User</div>
            <div style={{ flex: 2, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Event</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>When</div>
            <div style={{ flex: 2, fontSize: '13px', fontWeight: 600, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Details</div>
          </div>
          {events.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px' }}>No user events yet.</div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {events.filter(e => {
                const haystack = [e.username, e.event_type, e.metadata ? JSON.stringify(e.metadata) : ''].filter(Boolean).join(' ').toLowerCase()
                if (eventExcludeTerms.some(term => haystack.includes(term))) return false
                if (eventIncludeTerms.length > 0 && !eventIncludeTerms.some(term => haystack.includes(term))) return false
                if (!eventFilter.trim()) return true
                return haystack.includes(eventFilter.trim().toLowerCase())
              }).map(e => (
                <div key={e.id} style={{ display: 'flex', padding: '6px 12px', borderBottom: '1px solid #2e2e2e', alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{e.username}</div>
                  <div style={{ flex: 2 }}>
                    <span style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                      {e.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5' }}>{timeAgo(e.created_at)}</div>
                  <div style={{ flex: 2, fontSize: '13px', color: '#cce0f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.metadata ? JSON.stringify(e.metadata) : '-'}
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
