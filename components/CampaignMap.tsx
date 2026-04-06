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

export default function CampaignMap({ campaignId, isGM }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const debounceRef = useRef<any>(null)
  const supabase = createClient()
  const [pins, setPins] = useState<CampaignPin[]>([])
  const [mapLayer, setMapLayer] = useState<'street' | 'satellite' | 'dark'>('dark')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])

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
      const icon = leaflet.divIcon({
        html: `<div style="font-size:16px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));cursor:pointer;${!pin.revealed && isGM ? 'opacity:0.4;' : ''}" title="${pin.name}">📍</div>`,
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
      await loadPins(L)

      supabase.channel(`campaign_pins_${campaignId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_pins', filter: `campaign_id=eq.${campaignId}` }, () => loadPins())
        .subscribe()
    }
    init()
  }, [campaignId])

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Search bar — positioned left of layer switcher */}
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

      {/* Layer switcher */}
      <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 1000, display: 'flex', gap: '4px' }}>
        {(['street', 'satellite', 'dark'] as const).map(layer => (
          <button key={layer} onClick={() => switchLayer(layer)}
            style={{ padding: '5px 10px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapLayer === layer ? '#c0392b' : '#3a3a3a'}`, background: mapLayer === layer ? '#2a1210' : 'rgba(15,15,15,.85)', color: mapLayer === layer ? '#f5a89a' : '#d4cfc9' }}>
            {layer === 'street' ? 'Street' : layer === 'satellite' ? 'Satellite' : 'Dark'}
          </button>
        ))}
      </div>
    </div>
  )
}
