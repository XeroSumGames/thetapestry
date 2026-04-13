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
  setting?: string
  mapStyle?: string
  mapCenterLat?: number | null
  mapCenterLng?: number | null
  revealedNpcIds?: Set<string>
  focusPin?: { id: string; lat: number; lng: number } | null
}

interface PinNpc {
  id: string
  name: string
  campaign_pin_id: string | null
  npc_type: string | null
  status: string
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const SETTING_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  district_zero: { center: [36.052, -95.790], zoom: 15 },
  chased: { center: [38.710, -75.510], zoom: 12 },
  mongrels: { center: [38.0, -112.0], zoom: 5 },
}

const TILE_LAYERS: Record<string, { url: string; attr: string }> = {
  street: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  positron: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  voyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenTopoMap' },
  humanitarian: { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attr: '© HOT' },
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
  { value: 'landmark',   label: 'Landmark',   emoji: '🗿' },
  { value: 'encounter',  label: 'Encounter',  emoji: '⚡' },
  { value: 'resource',   label: 'Resource',   emoji: '🎒' },
  { value: 'community',  label: 'Community',  emoji: '🏘️' },
  { value: 'animals',    label: 'Animals',    emoji: '🐾' },
  { value: 'world_event', label: 'World Event', emoji: '🌍' },
  { value: 'settlement', label: 'Settlement', emoji: '🏚️' },
  { value: 'group',      label: 'Group',      emoji: '👥' },
]

function getCategoryEmoji(category: string): string {
  return PIN_CATEGORIES.find(c => c.value === category)?.emoji ?? '📍'
}

export default function CampaignMap({ campaignId, isGM, setting, mapStyle: defaultMapStyle, mapCenterLat, mapCenterLng, revealedNpcIds, focusPin }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const clusterGroupRef = useRef<any>(null)
  const debounceRef = useRef<any>(null)
  const placingRef = useRef(false)
  const supabase = createClient()
  const [pins, setPins] = useState<CampaignPin[]>([])
  const [mapLayer, setMapLayer] = useState<string>(defaultMapStyle ?? 'street')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [placing, setPlacing] = useState(false)
  const [newPin, setNewPin] = useState<{ lat: number; lng: number } | null>(null)
  const [pinForm, setPinForm] = useState({ name: '', notes: '', category: 'location' })
  const [saving, setSaving] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])

  // Keep ref in sync so the Leaflet click handler sees current state
  useEffect(() => { placingRef.current = placing }, [placing])

  async function loadPins(L?: any) {
    const [{ data: pinData }, { data: npcData }] = await Promise.all([
      supabase.from('campaign_pins').select('*').eq('campaign_id', campaignId),
      supabase.from('campaign_npcs').select('id, name, campaign_pin_id, npc_type, status').eq('campaign_id', campaignId),
    ])
    const allPins = pinData ?? []
    const visible = isGM ? allPins : allPins.filter((p: any) => p.revealed)
    setPins(visible)

    // Group NPCs by pin, filtering out NPCs hidden from non-GM players.
    const npcsByPin: Record<string, PinNpc[]> = {}
    ;(npcData ?? []).forEach((n: PinNpc) => {
      if (!n.campaign_pin_id) return
      if (!isGM && revealedNpcIds && !revealedNpcIds.has(n.id)) return
      ;(npcsByPin[n.campaign_pin_id] ??= []).push(n)
    })

    const leaflet = L ?? (await import('leaflet')).default
    const map = mapInstanceRef.current
    if (!map) return
    await import('leaflet.markercluster')
    await import('leaflet.markercluster/dist/MarkerCluster.css')
    await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

    if (clusterGroupRef.current) { map.removeLayer(clusterGroupRef.current) }
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

    visible.forEach((pin: any) => {
      const emoji = getCategoryEmoji(pin.category)
      const icon = leaflet.divIcon({
        html: `<div style="font-size:16px;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(26,26,26,0.85);border:2px solid #c0392b;box-shadow:0 0 6px rgba(192,57,43,0.5);${!pin.revealed && isGM ? 'opacity:0.4;border-color:#3a3a3a;box-shadow:none;' : ''}" title="${escapeHtml(pin.name)}">${emoji}</div>`,
        className: '', iconSize: [28, 28], iconAnchor: [14, 28],
      })
      const npcsHere = npcsByPin[pin.id] ?? []
      const npcSection = npcsHere.length === 0 ? '' :
        `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #2e2e2e;">
           <div style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:3px;">Also Here</div>
           ${npcsHere.map(n => `<div style="font-size:15px;color:#d4cfc9;${n.status === 'dead' ? 'text-decoration:line-through;opacity:.6;' : ''}">${escapeHtml(n.name)}${n.npc_type ? ` <span style="color:#888;font-size:13px;">· ${escapeHtml(n.npc_type)}</span>` : ''}</div>`).join('')}
         </div>`
      const popupHtml =
        `<div style="font-family:Barlow Condensed,sans-serif;min-width:180px;">` +
          `<strong style="text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(pin.name)}</strong>` +
          `${pin.notes ? `<br/><span style="color:#666;">${escapeHtml(pin.notes)}</span>` : ''}` +
          `${!pin.revealed && isGM ? '<br/><em style="color:#c0392b;">Hidden from players</em>' : ''}` +
          npcSection +
        `</div>`
      const marker = leaflet.marker([pin.lat, pin.lng], { icon, draggable: isGM }).bindPopup(popupHtml)
      if (isGM) {
        marker.on('dragend', async (ev: any) => {
          const ll = ev.target.getLatLng()
          await supabase.from('campaign_pins').update({ lat: ll.lat, lng: ll.lng }).eq('id', pin.id)
        })
      }
      clusterGroup.addLayer(marker)
      markersRef.current[pin.id] = marker
    })

    clusterGroup.addTo(map)
    clusterGroupRef.current = clusterGroup
  }

  // React to GM changing map style from header
  useEffect(() => {
    if (defaultMapStyle && defaultMapStyle !== mapLayer && mapInstanceRef.current) {
      switchLayer(defaultMapStyle as any)
    }
  }, [defaultMapStyle])

  function switchLayer(layer: string) {
    setMapLayer(layer)
    if (!mapInstanceRef.current || !tileLayerRef.current) return
    const L = (window as any).L
    if (!L) return
    tileLayerRef.current.remove()
    const t = TILE_LAYERS[layer] ?? TILE_LAYERS.street
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
    // Append new pins at the end of the existing sort order.
    const { data: maxRow } = await supabase.from('campaign_pins').select('sort_order').eq('campaign_id', campaignId).order('sort_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    const nextSort = ((maxRow as any)?.sort_order ?? 0) + 1
    const { data } = await supabase.from('campaign_pins').insert({
      campaign_id: campaignId,
      name: pinForm.name.trim(),
      lat: newPin.lat,
      lng: newPin.lng,
      notes: pinForm.notes.trim() || null,
      category: pinForm.category,
      revealed: false,
      sort_order: nextSort,
    }).select().single()

    if (data && attachments.length > 0) {
      for (const file of attachments) {
        const path = `${campaignId}/${data.id}/${file.name}`
        await supabase.storage.from('pin-attachments').upload(path, file)
      }
    }

    setNewPin(null)
    setPinForm({ name: '', notes: '', category: 'location' })
    setAttachments([])
    setPlacing(false)
    setSaving(false)
  }

  useEffect(() => {
    async function init() {
      const L = (await import('leaflet')).default
      ;(window as any).L = L
      await import('leaflet/dist/leaflet.css')

      if (!mapRef.current || mapInstanceRef.current) return

      const settingView = setting ? SETTING_CENTERS[setting] : undefined
      const customCenter = (mapCenterLat != null && mapCenterLng != null) ? { center: [mapCenterLat, mapCenterLng] as [number, number], zoom: 12 } : undefined
      const view = customCenter ?? settingView ?? { center: [39, -111] as [number, number], zoom: 5 }
      const map = L.map(mapRef.current, { center: view.center, zoom: view.zoom, zoomControl: true })
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

      supabase.channel(`campaign_npcs_map_${campaignId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_npcs', filter: `campaign_id=eq.${campaignId}` }, () => loadPins())
        .subscribe()
    }
    init()
  }, [campaignId])

  // Rebuild popups when the player's revealed-NPC set changes.
  useEffect(() => {
    if (!mapInstanceRef.current) return
    loadPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedNpcIds])

  // Fly to and open the popup for an externally requested pin (e.g. Assets tab click).
  useEffect(() => {
    if (!focusPin || !mapInstanceRef.current) return
    const marker = markersRef.current[focusPin.id]
    const cg = clusterGroupRef.current
    if (marker && cg && typeof cg.zoomToShowLayer === 'function') {
      cg.zoomToShowLayer(marker, () => marker.openPopup())
    } else {
      mapInstanceRef.current.flyTo([focusPin.lat, focusPin.lng], 17, { duration: 0.8 })
      if (marker) setTimeout(() => marker.openPopup(), 900)
    }
  }, [focusPin])

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', cursor: placing ? 'crosshair' : '' }} />

      {/* Search + layer switcher — single right column (matches MapView) */}
      <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '4px' }}>
          {isGM && (
            <button type="button" onClick={() => { setPlacing(p => !p); setNewPin(null); setAttachments([]) }}
              style={{ padding: '5px 10px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${placing ? '#2d5a1b' : '#3a3a3a'}`, background: placing ? '#1a2e10' : 'rgba(15,15,15,.85)', color: placing ? '#7fc458' : '#d4cfc9' }}>
              {placing ? '✕ Cancel' : '+ Pin'}
            </button>
          )}
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
              style={{ padding: '5px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '175px', outline: 'none' }} />
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
                    {s.display_name.length > 60 ? s.display_name.slice(0, 60) + '...' : s.display_name}
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
        {[['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'], ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'], ['positron', 'Positron'], ['dark', 'Dark']].map(([layer, label]) => (
          <button key={layer} onClick={() => switchLayer(layer)}
            style={{ padding: '3px 0', width: '100px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapLayer === layer ? '#c0392b' : '#3a3a3a'}`, background: mapLayer === layer ? '#2a1210' : 'rgba(15,15,15,.85)', color: mapLayer === layer ? '#f5a89a' : '#d4cfc9' }}>
            {label}
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
          <label style={{ display: 'block', padding: '10px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#666', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', cursor: 'pointer', marginBottom: '8px' }}>
            {attachments.length > 0 ? (
              <span style={{ color: '#7fc458' }}>{attachments.length} file{attachments.length > 1 ? 's' : ''} selected</span>
            ) : (
              'Click to attach files (optional)'
            )}
            <input type="file" multiple onChange={e => { if (e.target.files) setAttachments(Array.from(e.target.files)) }} style={{ display: 'none' }} />
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => { setNewPin(null); setAttachments([]) }}
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
