'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

interface CampaignPin {
  id: string
  name: string
  lat: number
  lng: number
  notes: string | null
  category: string
  revealed: boolean
}

interface Props {
  campaignId: string
  isGM: boolean
}

const TILE_LAYERS: Record<string, { url: string; attr: string }> = {
  street: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
}

const PIN_CATEGORIES = [
  { value: 'location',   label: 'Location',   emoji: '📍' },
  { value: 'rumor',      label: 'Rumor',      emoji: '🎒' },
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
  { value: 'community',  label: 'Community',  emoji: '🏘️' },
  { value: 'animals',    label: 'Animals',    emoji: '🐾' },
  { value: 'group',      label: 'Group',      emoji: '👥' },
]

function getCategoryEmoji(category: string): string {
  return PIN_CATEGORIES.find(c => c.value === category)?.emoji ?? '📍'
}

export default function CampaignMap({ campaignId, isGM }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const debounceRef = useRef<any>(null)
  const placingRef = useRef(false)
  const supabase = createClient()
  const [pins, setPins] = useState<CampaignPin[]>([])
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite' | 'dark'>('street')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [placing, setPlacing] = useState(false)
  const [newPin, setNewPin] = useState<{ lat: number; lng: number } | null>(null)
  const [pinForm, setPinForm] = useState({ name: '', notes: '', category: 'location' })
  const [saving, setSaving] = useState(false)

  // Keep ref in sync so the Leaflet click handler sees current state
  useEffect(() => { placingRef.current = placing }, [placing])

  async function loadPins(L?: any) {
    const { data } = await supabase.from('campaign_pins').select('*').eq('campaign_id', campaignId)
    const allPins = data ?? []
    const visible = isGM ? allPins : allPins.filter(p => p.revealed)
    setPins(visible)

    const leaflet = L ?? (await import('leaflet')).default
    const map = mapInstanceRef.current
    if (!map) return

    Object.values(markersRef.current).forEach((m: any) => { try { m.remove() } catch {} })
    markersRef.current = {}

    visible.forEach(pin => {
      const emoji = getCategoryEmoji(pin.category)
      const icon = leaflet.divIcon({
        html: `<div style="font-size:16px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));cursor:pointer;${!pin.revealed && isGM ? 'opacity:0.4;' : ''}" title="${pin.name}">${emoji}</div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 20],
      })
      const marker = leaflet.marker([pin.lat, pin.lng], { icon }).addTo(map)
      marker.bindPopup(`<div style="font-family:Barlow Condensed,sans-serif;"><strong style="text-transform:uppercase;letter-spacing:.04em;">${pin.name}</strong>${pin.notes ? `<br/><span style="color:#666;">${pin.notes}</span>` : ''}${!pin.revealed && isGM ? '<br/><em style="color:#c0392b;">Hidden from players</em>' : ''}</div>`)
      markersRef.current[pin.id] = marker
    })
  }

  function switchLayer(layer: 'street' | 'satellite' | 'dark') {
    setMapLayer(layer)
    if (!mapInstanceRef.current || !tileLayerRef.current) return
    const L = (window as any).L
    if (!L) return
    tileLayerRef.current.remove()
    const t = TILE_LAYERS[layer]
    tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(mapInstanceRef.current)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSuggestions([])
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`)
      const data = await res.json()
      if (data[0]) mapInstanceRef.current?.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 14)
    } catch {}
    setSearching(false)
  }

  async function savePin() {
    if (!newPin || !pinForm.name.trim()) return
    setSaving(true)
    await supabase.from('campaign_pins').insert({
      campaign_id: campaignId,
      name: pinForm.name.trim(),
      lat: newPin.lat,
      lng: newPin.lng,
      notes: pinForm.notes.trim() || null,
      category: pinForm.category,
      revealed: false,
    })
    setNewPin(null)
    setPinForm({ name: '', notes: '', category: 'location' })
    setPlacing(false)
    setSaving(false)
  }

  useEffect(() => {
    async function init() {
      const L = (await import('leaflet')).default
      ;(window as any).L = L
      await import('leaflet/dist/leaflet.css')

      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, { center: [39, -111], zoom: 5, zoomControl: true })
      const t = TILE_LAYERS[mapLayer]
      tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map)

      mapInstanceRef.current = map

      // GM click-to-place handler
      map.on('click', (e: any) => {
        if (!placingRef.current) return
        setNewPin({ lat: e.latlng.lat, lng: e.latlng.lng })
        setPinForm({ name: '', notes: '', category: 'location' })
      })

      await loadPins(L)

      supabase.channel(`campaign_pins_${campaignId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_pins', filter: `campaign_id=eq.${campaignId}` }, () => loadPins())
        .subscribe()
    }
    init()
  }, [campaignId])

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', cursor: placing ? 'crosshair' : '' }} />

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ position: 'absolute', top: '6px', right: '220px', zIndex: 1000, display: 'flex', gap: '4px' }}>
        <div style={{ position: 'relative' }}>
          <input value={searchQuery} onChange={e => {
            setSearchQuery(e.target.value)
            if (debounceRef.current) clearTimeout(debounceRef.current)
            if (e.target.value.length >= 3) {
              debounceRef.current = setTimeout(async () => {
                try {
                  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(e.target.value)}&limit=5`)
                  setSuggestions(await res.json())
                } catch { setSuggestions([]) }
              }, 300)
            } else { setSuggestions([]) }
          }} placeholder="Search address..."
            style={{ padding: '5px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '200px', outline: 'none' }} />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', maxHeight: '200px', overflowY: 'auto', zIndex: 1001 }}>
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => {
                  mapInstanceRef.current?.flyTo([parseFloat(s.lat), parseFloat(s.lon)], 14)
                  setSearchQuery(s.display_name.split(',')[0])
                  setSuggestions([])
                }}
                  style={{ padding: '6px 10px', fontSize: '13px', color: '#d4cfc9', cursor: 'pointer', borderBottom: '1px solid #2e2e2e' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {s.display_name.length > 50 ? s.display_name.slice(0, 50) + '...' : s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={searching}
          style={{ padding: '5px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
          {searching ? '...' : 'Go'}
        </button>
      </form>

      {/* Layer switcher + Place Pin button */}
      <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 1000, display: 'flex', gap: '4px' }}>
        {isGM && (
          <button onClick={() => { setPlacing(p => !p); setNewPin(null) }}
            style={{ padding: '5px 10px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${placing ? '#2d5a1b' : '#3a3a3a'}`, background: placing ? '#1a2e10' : 'rgba(15,15,15,.85)', color: placing ? '#7fc458' : '#d4cfc9' }}>
            {placing ? '✕ Cancel' : '+ Pin'}
          </button>
        )}
        {(['street', 'satellite', 'dark'] as const).map(layer => (
          <button key={layer} onClick={() => switchLayer(layer)}
            style={{ padding: '5px 10px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapLayer === layer ? '#c0392b' : '#3a3a3a'}`, background: mapLayer === layer ? '#2a1210' : 'rgba(15,15,15,.85)', color: mapLayer === layer ? '#f5a89a' : '#d4cfc9' }}>
            {layer === 'street' ? 'Street' : layer === 'satellite' ? 'Satellite' : 'Dark'}
          </button>
        ))}
      </div>

      {/* Placing mode banner */}
      {placing && !newPin && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(26,46,16,0.95)', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          Click on the map to place a pin
        </div>
      )}

      {/* New pin form */}
      {newPin && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '12px', background: 'rgba(26,26,26,0.95)', border: '1px solid #3a3a3a', borderRadius: '4px', width: '300px' }}>
          <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>New Pin</div>
          <input value={pinForm.name} onChange={e => setPinForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && pinForm.name.trim()) savePin() }}
            placeholder="Pin name..."
            autoFocus
            style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', marginBottom: '6px', boxSizing: 'border-box' }} />
          <input value={pinForm.notes} onChange={e => setPinForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)..."
            style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', marginBottom: '6px', boxSizing: 'border-box' }} />
          <select value={pinForm.category} onChange={e => setPinForm(f => ({ ...f, category: e.target.value }))}
            style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}>
            {PIN_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => { setNewPin(null) }}
              style={{ flex: 1, padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={savePin} disabled={!pinForm.name.trim() || saving}
              style={{ flex: 1, padding: '6px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: pinForm.name.trim() ? 'pointer' : 'not-allowed', opacity: pinForm.name.trim() ? 1 : 0.5 }}>
              {saving ? '...' : 'Save Pin'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '6px', fontFamily: 'Barlow, sans-serif' }}>
            Pin will be hidden from players until revealed in Assets.
          </div>
        </div>
      )}
    </div>
  )
}
