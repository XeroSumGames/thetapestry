'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { logFirstEvent } from '../lib/events'

const PIN_CATEGORIES = [
  { value: 'rumor',      label: 'Rumor',      emoji: '🎒' },
  { value: 'location',   label: 'Location',   emoji: '📍' },
  { value: 'residence',  label: 'Residence',  emoji: '🏠' },
  { value: 'business',   label: 'Business',   emoji: '🏪' },
  { value: 'church',     label: 'Church',     emoji: '⛪' },
  { value: 'government', label: 'Government', emoji: '🏛️' },
  { value: 'airport',    label: 'Transport',  emoji: '✈️' },
  { value: 'hospital',   label: 'Hospital',   emoji: '🏥' },
  { value: 'military',   label: 'Military',   emoji: '⚔️' },
  { value: 'person',     label: 'Person',     emoji: '👤' },
  { value: 'danger',     label: 'Danger',     emoji: '☠️' },
  { value: 'resource',   label: 'Resource',   emoji: '🎒' },
  { value: 'medical',    label: 'Medical',    emoji: '🩸' },
  { value: 'group',      label: 'Group',      emoji: '👥' },
  { value: 'animals',    label: 'Animals',    emoji: '🐾' },
  { value: 'community',  label: 'Community',  emoji: '🏘️' },
  { value: 'world_event', label: 'World Event', emoji: '🌍' },
  { value: 'settlement', label: 'Settlement', emoji: '🏚️' },
]

type PinTier = 'landmark' | 'location' | 'event' | 'personal'

function getPinTier(pin: { category?: string; pin_type?: string }): PinTier {
  const cat = pin.category ?? ''
  const type = pin.pin_type ?? ''
  if (cat === 'settlement' || cat === 'government') return 'landmark'
  if (cat === 'world_event') return 'event'
  if (type === 'rumor' || type === 'private') return 'personal'
  return 'location'
}

function getTierStyles(tier: PinTier) {
  switch (tier) {
    case 'landmark': return { mapSize: 28, fontSize: '26px', shadow: 'drop-shadow(0 0 4px rgba(192,57,43,.5))', sidebarWeight: 700, sidebarSize: '15px' }
    case 'event': return { mapSize: 26, fontSize: '24px', shadow: 'drop-shadow(0 0 3px rgba(239,159,39,.4))', sidebarWeight: 700, sidebarSize: '14px' }
    case 'location': return { mapSize: 24, fontSize: '20px', shadow: 'drop-shadow(0 1px 3px rgba(0,0,0,.6))', sidebarWeight: 600, sidebarSize: '14px' }
    case 'personal': return { mapSize: 20, fontSize: '16px', shadow: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))', sidebarWeight: 400, sidebarSize: '13px' }
  }
}

function getNearSetting(lat: number, lng: number): string | null {
  if (Math.abs(lat - 36.052) < 0.05 && Math.abs(lng - (-95.790)) < 0.05) return 'District Zero'
  if (Math.abs(lat - 38.710) < 0.05 && Math.abs(lng - (-75.510)) < 0.05) return 'Chased'
  if (lat >= 33 && lat <= 46 && lng >= -113 && lng <= -111) return 'Mongrels'
  return null
}

const REGION_BOUNDS: Record<string, { label: string; latMin: number; latMax: number; lngMin: number; lngMax: number; lat: number; lng: number; zoom: number }> = {
  district_zero: { label: 'District Zero', latMin: 36.04, latMax: 36.07, lngMin: -95.81, lngMax: -95.77, lat: 36.052, lng: -95.790, zoom: 15 },
  chased:        { label: 'Chased',        latMin: 38.65, latMax: 38.78, lngMin: -75.75, lngMax: -75.30, lat: 38.710, lng: -75.510, zoom: 12 },
  mongrels:      { label: 'Mongrels',      latMin: 33.0,  latMax: 46.0,  lngMin: -113.5, lngMax: -110.5, lat: 38.0,   lng: -112.0,  zoom: 5  },
}
const REGION_KEYS = Object.keys(REGION_BOUNDS)

function pinInRegion(p: { lat: number; lng: number }, key: string): boolean {
  const r = REGION_BOUNDS[key]
  if (!r) return false
  return p.lat >= r.latMin && p.lat <= r.latMax && p.lng >= r.lngMin && p.lng <= r.lngMax
}

function getCategoryEmoji(category: string): string {
  return PIN_CATEGORIES.find(c => c.value === category)?.emoji ?? '📍'
}

interface Pin {
  id: string
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: string
  status: string
  user_id: string
  category: string
  created_at?: string
  sort_order?: number
}

interface PinForm {
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: 'private' | 'rumor'
  category: string
}

interface MapViewProps {
  embedded?: boolean
  showSidebar?: boolean
  showHeader?: boolean
}

export default function MapView({ embedded = false, showHeader = true, showSidebar: showSidebarProp = false }: MapViewProps) {
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const clusterGroupRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const channelRef = useRef<any>(null)
  const [pins, setPins] = useState<Pin[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'survivor' | 'thriver'>('survivor')
  const [showForm, setShowForm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(!embedded || showSidebarProp)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']))
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set())
  const [sortMode, setSortMode] = useState<'newest' | 'name'>('newest')
  const [pinSearch, setPinSearch] = useState('')
  const [expandedPinId, setExpandedPinId] = useState<string | null>(null)
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  const [pinAttachments, setPinAttachments] = useState<Record<string, { name: string; url: string }[]>>({})
  const [pinsVisible, setPinsVisible] = useState(true)
  const [form, setForm] = useState<PinForm>({ lat: 0, lng: 0, title: '', notes: '', pin_type: 'private', category: 'location' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingPin, setEditingPin] = useState<Pin | null>(null)
  const [editForm, setEditForm] = useState({ title: '', notes: '', category: 'location' })
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem('tapestry_folder_state'); if (saved) return new Set(JSON.parse(saved)) } catch {}
    }
    return new Set<string>()
  })
  const [mapLayer, setMapLayer] = useState<string>('street')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const debounceRef = useRef<any>(null)
  const [searching, setSearching] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile) setUserRole((profile.role as string).toLowerCase() as 'survivor' | 'thriver')
      }

      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, { center: [10, 15], zoom: 3, zoomControl: true, minZoom: 2 })

      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map

      map.on('click', (e: any) => {
        if (!user) return // Ghost mode — read only
        setForm({ lat: e.latlng.lat, lng: e.latlng.lng, title: '', notes: '', pin_type: 'private', category: 'location' })
        setAttachments([])
        setShowForm(true)
        setEditingPin(null)
      })

      await loadPins(L, map)

      // Listen for fly-to events from dashboard search
      const flyToHandler = (e: Event) => {
        const { lat, lon } = (e as CustomEvent).detail
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lon], 13, { duration: 1.2 })
        }
      }
      window.addEventListener('tapestry-fly-to', flyToHandler)

      channelRef.current = supabase
        .channel('map_pins_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'map_pins' }, () => {
          loadPins()
        })
        .subscribe()
    }

    init()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    }
  }, [])

  async function loadPins(L?: any, map?: any) {
    const leaflet = L ?? (await import('leaflet')).default
    const mapInst = map ?? mapInstanceRef.current
    if (!mapInst) return
    await import('leaflet.markercluster')
    await import('leaflet.markercluster/dist/MarkerCluster.css')
    await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

    const { data } = await supabase.from('map_pins').select('*').order('created_at', { ascending: false })
    if (!data) return
    setPins(data)

    // Resolve usernames
    const uids = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))]
    if (uids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', uids)
      if (profiles) setUsernames(Object.fromEntries(profiles.map((p: any) => [p.id, p.username])))
    }

    // Remove old cluster group
    if (clusterGroupRef.current) { mapInst.removeLayer(clusterGroupRef.current) }
    markersRef.current = {}

    const clusterGroup = (leaflet as any).markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount()
        const size = count < 10 ? 32 : count < 50 ? 40 : 48
        return leaflet.divIcon({
          html: `<div style="width:${size}px;height:${size}px;background:#1a1a1a;border:2px solid #c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#f5f2ee;font-family:'Barlow Condensed',sans-serif;font-size:${size < 40 ? 13 : 15}px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.5);">${count}</div>`,
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        })
      },
    })

    const visibleData = userId ? data : data.filter((p: Pin) => p.category === 'world_event')
    visibleData.forEach((pin: Pin) => {
      const emoji = getCategoryEmoji(pin.category ?? 'location')
      const tier = getPinTier(pin)
      const ts = getTierStyles(tier)
      const icon = leaflet.divIcon({
        html: `<div style="font-size:${ts.fontSize};line-height:1;filter:${ts.shadow};cursor:pointer;" title="${pin.title}">${emoji}</div>`,
        className: '', iconSize: [ts.mapSize, ts.mapSize], iconAnchor: [ts.mapSize / 2, ts.mapSize / 2],
      })
      const nearSetting = getNearSetting(pin.lat, pin.lng)
      const nearbyCount = data.filter((p: Pin) => p.id !== pin.id && Math.abs(p.lat - pin.lat) < 0.1 && Math.abs(p.lng - pin.lng) < 0.1).length
      const dateStr = pin.created_at ? new Date(pin.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
      const marker = leaflet.marker([pin.lat, pin.lng], { icon })
        .bindPopup(`
          <div style="font-family:Barlow,sans-serif;min-width:220px;max-width:300px">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">${emoji} ${pin.title}</div>
            ${pin.notes ? `<div style="font-size:13px;color:#555;margin-bottom:6px;line-height:1.4">${pin.notes}</div>` : ''}
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em;padding:1px 4px;background:#f0f0f0;border-radius:2px">${pin.category ?? 'location'}</span>
              <span style="font-size:10px;color:#999;text-transform:uppercase">${pin.pin_type === 'rumor' ? 'Rumor' : pin.pin_type === 'gm' ? 'GM' : 'Private'}</span>
            </div>
            ${dateStr ? `<div style="font-size:10px;color:#aaa">${dateStr}</div>` : ''}
            ${nearSetting ? `<div style="font-size:10px;color:#c0392b;font-weight:700;margin-top:2px">Near ${nearSetting}</div>` : ''}
            ${nearbyCount > 0 ? `<div style="font-size:10px;color:#7ab3d4;margin-top:2px">${nearbyCount} nearby pin${nearbyCount !== 1 ? 's' : ''}</div>` : ''}
            ${(pin as any).view_count ? `<div style="font-size:10px;color:#aaa;margin-top:2px">👁 ${(pin as any).view_count} views</div>` : ''}
          </div>
        `)
      marker.on('popupopen', () => {
        supabase.from('map_pins').update({ view_count: ((pin as any).view_count ?? 0) + 1 }).eq('id', pin.id)
      })
      clusterGroup.addLayer(marker)
      markersRef.current[pin.id] = marker
    })

    clusterGroup.addTo(mapInst)
    clusterGroupRef.current = clusterGroup

    setTimeout(() => mapInst.invalidateSize(), 100)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim() || !mapInstanceRef.current) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`, {
        headers: { 'Accept-Language': 'en' }
      })
      const results = await res.json()
      if (results.length > 0) {
        const { lat, lon } = results[0]
        mapInstanceRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 13, { duration: 1.2 })
      }
    } catch (e) {
      console.error('Search failed:', e)
    }
    setSearching(false)
  }

  async function switchLayer(layer: string) {
    const L = (await import('leaflet')).default
    const map = mapInstanceRef.current
    if (!map) return
    if (tileLayerRef.current) tileLayerRef.current.remove()
    const tiles: Record<string, { url: string, attribution: string }> = {
      street: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
      satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; <a href="https://www.esri.com">Esri</a>' },
      dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>' },
      positron: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>' },
      voyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>' },
      topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>' },
      humanitarian: { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://hot.openstreetmap.org">HOT</a>' },
    }
    const t = tiles[layer] ?? tiles.street
    tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 }).addTo(map)
    setMapLayer(layer)
  }

  function flyToPin(pin: Pin) {
    if (!mapInstanceRef.current) return
    const zoom = (pin.category === 'world_event' || pin.category === 'settlement') ? 8 : 14
    mapInstanceRef.current.flyTo([pin.lat, pin.lng], zoom, { duration: 1.2 })
    setTimeout(() => markersRef.current[pin.id]?.openPopup(), 1300)
  }

  async function handleSavePin() {
    if (!form.title.trim()) return
    if (!userId) { alert('Not logged in'); return }
    setSaving(true)
    const isThriver = userRole === 'thriver'
    const { error, data } = await supabase.from('map_pins').insert({
      user_id: userId, lat: form.lat, lng: form.lng,
      title: form.title, notes: form.notes,
      pin_type: isThriver ? 'gm' : 'rumor',
      status: isThriver ? 'approved' : 'pending',
      category: form.category,
    }).select().single()
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    logFirstEvent('first_pin_placed', { pin_id: data.id, title: form.title })

    if (attachments.length > 0 && data) {
      setUploading(true)
      for (const file of attachments) {
        const path = `${userId}/${data.id}/${file.name}`
        await supabase.storage.from('pin-attachments').upload(path, file)
      }
      setUploading(false)
    }

    setAttachments([])
    setShowForm(false)
    setSaving(false)
    await loadPins()
  }

  async function handleDeletePin(id: string) {
  setDeletingId(id)
  await supabase.from('map_pins').delete().eq('id', id)
  setDeletingId(null)
  await loadPins()
}

  async function handleTogglePublic(pin: Pin) {
    const newStatus = pin.status === 'approved' ? 'active' : 'approved'
    await supabase.from('map_pins').update({ status: newStatus }).eq('id', pin.id)
    await loadPins()
  }

  function startEdit(pin: Pin) {
  setEditingPin(pin)
  setEditForm({ title: pin.title, notes: pin.notes, category: pin.category ?? 'location' })
  setShowForm(false)
}

  async function handleSaveEdit() {
  if (!editingPin || !editForm.title.trim()) return
  const { error } = await supabase.from('map_pins').update({ title: editForm.title, notes: editForm.notes, category: editForm.category }).eq('id', editingPin.id)
  if (!error) { setEditingPin(null); await loadPins() }
  else alert('Error: ' + error.message)
}

  // Filter chips
  const FILTER_CHIPS_ROW1 = ['mine', 'all', 'public'] as const
  const FILTER_CHIPS_ROW2 = ['canon', 'rumors', 'timeline'] as const
  const FILTER_CHIPS = [...FILTER_CHIPS_ROW1, ...FILTER_CHIPS_ROW2] as const
  const allFiltersActive = FILTER_CHIPS.filter(f => f !== 'all').every(f => activeFilters.has(f))

  function toggleFilter(chip: string) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (chip === 'all') {
        // Toggle all on
        FILTER_CHIPS.forEach(f => next.add(f))
        return next
      }
      if (next.has(chip)) next.delete(chip); else next.add(chip)
      // Sync 'all' state
      if (FILTER_CHIPS.filter(f => f !== 'all').every(f => next.has(f))) next.add('all')
      else next.delete('all')
      // Persist for authenticated users
      if (userId) localStorage.setItem('tapestry_pin_filters', JSON.stringify([...next]))
      return next
    })
  }

  function matchesFilter(p: Pin): boolean {
    // Ghosts see world_event + settlement pins only
    if (!userId) return p.category === 'world_event' || p.category === 'settlement'
    // Logged-in users see everything (folders handle grouping)
    return true
  }

  function chipCount(chip: string): number {
    if (chip === 'all') return pins.length
    return pins.filter(p => {
      if (chip === 'public') return p.status === 'approved'
      if (chip === 'mine') return p.user_id === userId
      if (chip === 'canon') return p.category === 'world_event' || p.category === 'settlement' || p.pin_type === 'gm'
      if (chip === 'rumors') return p.pin_type === 'rumor'
      if (chip === 'timeline') return p.category === 'world_event'
      return false
    }).length
  }

  function regionCount(key: string): number {
    return pins.filter(p => pinInRegion(p, key)).length
  }

  function toggleRegion(key: string) {
    setActiveRegions(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        const r = REGION_BOUNDS[key]
        if (r) mapInstanceRef.current?.flyTo([r.lat, r.lng], r.zoom, { duration: 1.2 })
      }
      if (userId) localStorage.setItem('tapestry_pin_regions', JSON.stringify([...next]))
      return next
    })
  }

  const timelineOnly = activeFilters.has('timeline') && activeFilters.size === 1

  const filteredPins = pins.filter(matchesFilter).filter(p => {
    if (activeRegions.size === 0) return true
    return [...activeRegions].some(r => pinInRegion(p, r))
  }).filter(p => {
    if (!pinSearch.trim()) return true
    const q = pinSearch.trim().toLowerCase()
    return (p.title?.toLowerCase().includes(q)) || (p.notes?.toLowerCase().includes(q)) || (p.category?.toLowerCase().includes(q))
  })
  const displayedPins = [...filteredPins].sort((a, b) => {
    if (timelineOnly) return (a.sort_order ?? 999) - (b.sort_order ?? 999)
    if (sortMode === 'name') return (a.title ?? '').localeCompare(b.title ?? '')
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  })

  function pinTypeLabel(p: Pin) {
    if (p.pin_type === 'gm' && p.status === 'approved') return 'GM -” public'
    if (p.pin_type === 'gm') return 'GM -” pending'
    if (p.pin_type === 'rumor' && p.status === 'approved') return 'Rumor -” public'
    if (p.pin_type === 'rumor' && p.status === 'pending') return 'Submitted -” awaiting review'
    if (p.pin_type === 'rumor' && p.status === 'rejected') return 'Rejected'
    return 'Private'
  }

  function pinColor(p: Pin) {
    return p.pin_type === 'rumor' ? '#EF9F27' : p.pin_type === 'gm' ? '#c0392b' : '#7ab3d4'
  }

  // Toggle map pin markers visibility
  useEffect(() => {
    const map = mapInstanceRef.current
    const cluster = clusterGroupRef.current
    if (!map || !cluster) return
    if (pinsVisible) { if (!map.hasLayer(cluster)) map.addLayer(cluster) }
    else { if (map.hasLayer(cluster)) map.removeLayer(cluster) }
  }, [pinsVisible])

  // Load persisted filters for authenticated users, Timeline default for Ghosts
  useEffect(() => {
    if (!userId) {
      setActiveFilters(new Set(['timeline']))
      setActiveRegions(new Set())
    } else {
      const saved = localStorage.getItem('tapestry_pin_filters')
      if (saved) { try { setActiveFilters(new Set(JSON.parse(saved))) } catch {} }
      else setActiveFilters(new Set(['all', 'public', 'mine', 'canon', 'rumors', 'timeline']))
      const savedRegions = localStorage.getItem('tapestry_pin_regions')
      if (savedRegions) { try { setActiveRegions(new Set(JSON.parse(savedRegions))) } catch {} }
    }
  }, [userId])

  const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#f5f2ee', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: '4px' }
  const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {!embedded && showHeader && (
        <div style={{ flexShrink: 0, zIndex: 1000, background: '#0f0f0f', borderBottom: '1px solid #c0392b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>The Tapestry</div>
          <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.08em', textTransform: 'uppercase' }}>World Map</div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setSidebarOpen(p => !p)} style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {sidebarOpen ? 'Hide Pins' : 'Show Pins'}
          </button>
          <a href="/dashboard" style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Dashboard</a>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        <div ref={mapRef} style={{ flex: 1, height: '100%', background: '#aad3df' }} />

        {(!embedded || showSidebarProp) && sidebarOpen && (
          <div style={{ width: '300px', flexShrink: 0, background: '#1a1a1a', borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', zIndex: 500 }}>
            {/* Search + regions header */}
            <div style={{ padding: '8px', borderBottom: '1px solid #2e2e2e' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <button onClick={() => setSidebarOpen(false)}
                  style={{ padding: '2px 6px', background: 'none', border: 'none', color: '#3a3a3a', fontSize: '14px', cursor: 'pointer', lineHeight: 1, marginRight: '4px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f5a89a')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>✕</button>
                <span style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>Pins</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>{displayedPins.length} total</span>
              </div>
              <input value={pinSearch} onChange={e => setPinSearch(e.target.value)} placeholder="Search pins..."
                style={{ width: '100%', padding: '5px 8px', marginBottom: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              {!userId && (
                <div onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tapestry-ghost-wall')) }}
                  style={{ marginBottom: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', cursor: 'pointer', fontStyle: 'italic' }}>
                  Sign up to add your own story to this world.
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px' }}>
                {REGION_KEYS.map(key => {
                  const r = REGION_BOUNDS[key]
                  const active = activeRegions.has(key)
                  return (
                    <button key={key} onClick={() => toggleRegion(key)}
                      style={{ flex: 1, padding: '3px 4px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${active ? '#c0392b' : '#3a3a3a'}`, background: active ? '#2a1210' : '#242424', color: active ? '#f5a89a' : '#d4cfc9', whiteSpace: 'nowrap' }}>
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Folder tree */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(() => {
                // Group displayed pins by category
                const folderMap: Record<string, Pin[]> = {}
                for (const p of displayedPins) {
                  const cat = p.category ?? 'location'
                  if (!folderMap[cat]) folderMap[cat] = []
                  folderMap[cat].push(p)
                }
                // Sort categories: ones with pins first, then alphabetically by label
                const sortedCats = PIN_CATEGORIES.filter(c => folderMap[c.value] && folderMap[c.value].length > 0)
                if (sortedCats.length === 0) {
                  return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>{pinSearch.trim() ? 'No pins match your search.' : 'No pins to display.'}</div>
                }
                // If searching, auto-expand all folders with matches
                const isSearching = pinSearch.trim().length > 0
                return sortedCats.map(cat => {
                  const folderPins = folderMap[cat.value] ?? []
                  const isOpen = isSearching || expandedFolders.has(cat.value)
                  return (
                    <div key={cat.value}>
                      <div onClick={() => {
                        setExpandedFolders(prev => {
                          const next = new Set(prev)
                          next.has(cat.value) ? next.delete(cat.value) : next.add(cat.value)
                          if (typeof window !== 'undefined') localStorage.setItem('tapestry_folder_state', JSON.stringify([...next]))
                          return next
                        })
                      }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #2e2e2e', userSelect: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span style={{ fontSize: '10px', color: '#5a5550', width: '12px', textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</span>
                        <span style={{ fontSize: '14px' }}>{cat.emoji}</span>
                        <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1 }}>{cat.label}</span>
                        <span style={{ fontSize: '11px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>{folderPins.length}</span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '2px 0 4px' }}>
                          {folderPins.map(p => {
                            const isExpanded = expandedPinId === p.id
                            return (
                              <div key={p.id} onClick={() => {
                                if (isExpanded) { setExpandedPinId(null) }
                                else { setExpandedPinId(p.id); flyToPin(p); supabase.from('map_pins').update({ view_count: ((p as any).view_count ?? 0) + 1 }).eq('id', p.id) }
                              }}
                                style={{ padding: '4px 10px 4px 34px', cursor: 'pointer', borderLeft: `2px solid ${isExpanded ? '#c0392b' : 'transparent'}`, background: isExpanded ? '#1a1a1a' : 'transparent' }}
                                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#1a1a1a' }}
                                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}>
                                <div style={{ fontSize: '13px', color: '#f5f2ee', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>{p.title}</div>
                                {isExpanded && (
                                  <div style={{ marginTop: '4px' }}>
                                    {p.notes && <div style={{ fontSize: '12px', color: '#d4cfc9', lineHeight: 1.5, marginBottom: '6px' }}>{p.notes}</div>}
                                    <div style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
                                      {usernames[p.user_id] ? `By ${usernames[p.user_id]}` : ''}{p.created_at ? ` · ${new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                                    </div>
                                    {(p.user_id === userId || userRole === 'thriver') && (
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                        {userRole === 'thriver' && (
                                          <button onClick={e => { e.stopPropagation(); handleTogglePublic(p) }}
                                            style={{ background: 'none', border: 'none', color: p.status === 'approved' ? '#7fc458' : '#cce0f5', cursor: 'pointer', fontSize: '11px', padding: '0', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                            {p.status === 'approved' ? 'Public' : 'Private'}
                                          </button>
                                        )}
                                        <button onClick={e => { e.stopPropagation(); startEdit(p) }}
                                          style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '11px', padding: '0', fontFamily: 'Barlow Condensed, sans-serif' }}>Edit</button>
                                        <button onClick={e => { e.stopPropagation(); if (confirm('Delete this pin?')) handleDeletePin(p.id) }}
                                          style={{ background: 'none', border: 'none', color: '#f5a89a', cursor: 'pointer', fontSize: '13px', padding: '0' }}>×</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}

        {/* Pins toggle button is rendered inside the search bar row below */}
        {!embedded && showHeader && (
          <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(15,15,15,.85)', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '6px 14px', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif', pointerEvents: 'none' }}>
            Click anywhere on the map to place a pin
          </div>
        )}

          <div style={{ position: 'absolute', top: '6px', right: sidebarOpen ? '306px' : '6px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', transition: 'right .2s' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {(!embedded || showSidebarProp) && !sidebarOpen && (
                <button type="button" onClick={() => setSidebarOpen(true)}
                  style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Pins ☰
                </button>
              )}
              <div style={{ position: 'relative', flex: 1 }}>
                <input value={searchQuery} onChange={e => {
                  setSearchQuery(e.target.value)
                  if (debounceRef.current) clearTimeout(debounceRef.current)
                  if (e.target.value.length >= 3) {
                    debounceRef.current = setTimeout(async () => {
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(e.target.value)}&limit=5`)
                        const data = await res.json()
                        setSuggestions(data)
                      } catch { setSuggestions([]) }
                    }, 300)
                  } else { setSuggestions([]) }
                }} placeholder="Search address..." style={{ padding: '5px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '175px', outline: 'none' }} />
                {suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', maxHeight: '200px', overflowY: 'auto', zIndex: 1001 }}>
                    {suggestions.map((s, i) => (
                      <div key={i} onClick={() => {
                        const lat = parseFloat(s.lat)
                        const lon = parseFloat(s.lon)
                        mapInstanceRef.current?.flyTo([lat, lon], 14)
                        setSearchQuery(s.display_name.split(',')[0])
                        setSuggestions([])
                      }}
                        style={{ padding: '6px 10px', fontSize: '13px', color: '#d4cfc9', cursor: 'pointer', borderBottom: '1px solid #2e2e2e' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {s.display_name.length > 60 ? s.display_name.slice(0, 60) + '...' : s.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={searching} style={{ padding: '5px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: searching ? '#cce0f5' : '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: searching ? 'not-allowed' : 'pointer' }}>{searching ? '...' : 'Go'}</button>
            </form>
            {[['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'], ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'], ['positron', 'Positron'], ['dark', 'Dark']].map(([layer, label]) => (
              <button key={layer} onClick={() => switchLayer(layer)}
                style={{ padding: '3px 0', width: '100px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapLayer === layer ? '#c0392b' : '#3a3a3a'}`, background: mapLayer === layer ? '#2a1210' : 'rgba(15,15,15,.85)', color: mapLayer === layer ? '#f5a89a' : '#d4cfc9' }}>
                {label}
              </button>
            ))}
          </div>

        {showForm && (
          <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1001, background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '1rem', width: '320px', resize: 'both', overflow: 'auto', minWidth: '280px', maxWidth: '600px' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 600, color: '#c0392b', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Add a Pin</div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
  <input
    value={form.lat.toFixed(4)}
    onChange={e => setForm(p => ({ ...p, lat: parseFloat(e.target.value) || p.lat }))}
    style={{ flex: 1, padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif' }}
  />
  <input
    value={form.lng.toFixed(4)}
    onChange={e => setForm(p => ({ ...p, lng: parseFloat(e.target.value) || p.lng }))}
    style={{ flex: 1, padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif' }}
  />
</div>
            <div style={{ marginBottom: '10px' }}>
              <label style={lbl}>Category</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                {PIN_CATEGORIES.map(cat => (
                  <button key={cat.value} onClick={() => setForm(p => ({ ...p, category: cat.value }))}
                    style={{ padding: '6px 4px', border: `1px solid ${form.category === cat.value ? '#c0392b' : '#3a3a3a'}`, background: form.category === cat.value ? '#2a1210' : '#242424', borderRadius: '3px', cursor: 'pointer', textAlign: 'center', fontFamily: 'Barlow, sans-serif' }}>
                    <div style={{ fontSize: '18px', marginBottom: '2px' }}>{cat.emoji}</div>
                    <div style={{ fontSize: '11px', color: '#f5f2ee', lineHeight: 1.2 }}>{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={lbl}>Title</label>
              <input style={inp} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Abandoned hospital" />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="What did you find here?" />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={lbl}>Attachments</label>
              <label style={{ display: 'block', padding: '8px 10px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', cursor: 'pointer', textAlign: 'center', fontSize: '13px', color: '#d4cfc9' }}>
                {attachments.length > 0 ? `${attachments.length} file${attachments.length > 1 ? 's' : ''} selected` : 'Click to attach files'}
                <input type="file" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) setAttachments(Array.from(e.target.files)) }} />
              </label>
              {attachments.length > 0 && (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {attachments.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#d4cfc9', padding: '3px 6px', background: '#0f0f0f', borderRadius: '2px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '14px', padding: '0 2px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: '10px', fontSize: '13px', padding: '6px 8px', borderRadius: '3px', background: userRole === 'thriver' ? '#1a2e10' : '#1a1a2e', border: `1px solid ${userRole === 'thriver' ? '#2d5a1b' : '#2e2e5a'}`, color: userRole === 'thriver' ? '#7fc458' : '#d4cfc9', lineHeight: 1.5 }}>
              {userRole === 'thriver' ? 'As a Thriver, your pins are immediately public on the map.' : 'Your pin will be visible to you and submitted to the Thriver queue. If approved, it will appear as a Rumor for all players.'}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={handleSavePin} disabled={saving || uploading || !form.title.trim()}
                style={{ flex: 1, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', opacity: saving || uploading || !form.title.trim() ? 0.5 : 1 }}>
                {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Pin'}
              </button>
              <button onClick={() => { setShowForm(false); setAttachments([]) }}
                style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {editingPin && (
  <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1001, background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #7ab3d4', borderRadius: '4px', padding: '1rem', width: '300px', resize: 'both', overflow: 'auto', minWidth: '260px', maxWidth: '600px' }}>
    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 600, color: '#7ab3d4', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Edit Pin</div>
    <div style={{ marginBottom: '8px' }}>
      <label style={lbl}>Title</label>
      <input style={inp} value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
    </div>
    <div style={{ marginBottom: '8px' }}>
      <label style={lbl}>Notes</label>
      <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
    </div>
    <div style={{ marginBottom: '12px' }}>
      <label style={lbl}>Category</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
        {PIN_CATEGORIES.map(cat => (
          <button key={cat.value} onClick={() => setEditForm(p => ({ ...p, category: cat.value }))}
            style={{ padding: '6px 4px', border: `1px solid ${editForm.category === cat.value ? '#7ab3d4' : '#3a3a3a'}`, background: editForm.category === cat.value ? '#0f2035' : '#242424', borderRadius: '3px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', marginBottom: '2px' }}>{cat.emoji}</div>
            <div style={{ fontSize: '8px', color: editForm.category === cat.value ? '#7ab3d4' : '#d4cfc9', lineHeight: 1.2 }}>{cat.label.split('/')[0].trim()}</div>
          </button>
        ))}
      </div>
    </div>
    {userRole === 'thriver' && editingPin && (
      <div style={{ marginBottom: '12px' }}>
        <label style={lbl}>Pin Type</label>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[['gm', 'GM'], ['rumor', 'Rumor'], ['private', 'Private']].map(([val, label]) => (
            <button key={val} onClick={() => {
              supabase.from('map_pins').update({ pin_type: val }).eq('id', editingPin.id)
            }}
              style={{ flex: 1, padding: '4px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${editingPin.pin_type === val ? '#c0392b' : '#3a3a3a'}`, background: editingPin.pin_type === val ? '#2a1210' : '#242424', color: editingPin.pin_type === val ? '#f5a89a' : '#d4cfc9' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    )}
    <div style={{ display: 'flex', gap: '6px' }}>
      <button onClick={handleSaveEdit} disabled={!editForm.title.trim()}
        style={{ flex: 1, padding: '8px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Save
      </button>
      <button onClick={() => { handleDeletePin(editingPin.id); setEditingPin(null) }}
        style={{ padding: '8px 12px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', cursor: 'pointer', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Delete
      </button>
      <button onClick={() => setEditingPin(null)}
        style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Cancel
      </button>
    </div>
  </div>
)}

      </div>
    </div>
  )
}


