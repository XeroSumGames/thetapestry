'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { searchNominatimUSFirst } from '../lib/nominatim-search'

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
  // Double-click on any empty map location fires this callback with
  // the clicked coords. Table page wires it to open the Quick Add
  // modal pre-seeded with the location. Null = feature off.
  onMapDoubleClick?: (lat: number, lng: number) => void
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

export default function CampaignMap({ campaignId, isGM, setting, mapStyle: defaultMapStyle, mapCenterLat, mapCenterLng, revealedNpcIds, focusPin, onMapDoubleClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const clusterGroupRef = useRef<any>(null)
  const debounceRef = useRef<any>(null)
  const placingRef = useRef(false)
  // Ping channel + active-ping markers. Alt+click anywhere on the
  // campaign map drops a transient pulse and broadcasts it to every
  // other viewer of this campaign — same UX as the tactical map. GM
  // pings are orange; player pings are green.
  const pingChannelRef = useRef<any>(null)
  const pingMarkersRef = useRef<any[]>([])
  // Measure tool — click to drop point A, click again for point B,
  // shows total path distance + per-segment legs. Multi-click adds
  // segments (polyline-style); button toggle or Esc clears.
  const measureModeRef = useRef(false)
  const measurePointsRef = useRef<Array<{ lat: number; lng: number }>>([])
  const measureMarkersRef = useRef<any[]>([])
  const measureLineRef = useRef<any>(null)
  const measureLabelRef = useRef<any>(null)
  const [measureMode, setMeasureMode] = useState(false)
  const [measureDistanceText, setMeasureDistanceText] = useState<string>('')
  useEffect(() => { measureModeRef.current = measureMode }, [measureMode])
  // Hold a ref to the latest onMapDoubleClick callback so the Leaflet
  // dblclick handler registered in the init effect can always call the
  // current parent version without re-subscribing.
  const dblClickRef = useRef<typeof onMapDoubleClick>(undefined)
  useEffect(() => { dblClickRef.current = onMapDoubleClick }, [onMapDoubleClick])
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
  // Brief inline confirmation after a non-GM player submits a pin —
  // their own pin lands as revealed=false so they can't see it back
  // until the GM approves. Without this confirmation the form just
  // disappears and the player can't tell whether the submission worked.
  const [submittedNotice, setSubmittedNotice] = useState(false)

  // Keep ref in sync so the Leaflet click handler sees current state
  useEffect(() => { placingRef.current = placing }, [placing])

  // Esc kills the measure tool — bail out of the multi-click flow
  // without having to re-toggle the button. Only attached while the
  // tool is active so we don't leak listeners or block other Esc UX.
  useEffect(() => {
    if (!measureMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearMeasure()
        setMeasureMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [measureMode])

  // Inject ping pulse keyframes ONCE (per browser tab). Two pulses
  // over ~2.4s, then auto-removal of the marker. Same visual cadence
  // as TacticalMap so players recognize the gesture across surfaces.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('cm-ping-style')) return
    const s = document.createElement('style')
    s.id = 'cm-ping-style'
    s.textContent = `
@keyframes cm-ping-pulse {
  0%   { transform: scale(0.3); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}
.cm-ping-ring {
  width: 60px; height: 60px; border-radius: 50%;
  border: 3px solid currentColor;
  box-shadow: 0 0 12px currentColor;
  animation: cm-ping-pulse 1.2s ease-out 2 both;
  pointer-events: none;
}
.cm-ping-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
  position: absolute; left: 24px; top: 24px;
  animation: cm-ping-pulse 1.2s ease-out 2 both;
  pointer-events: none;
}
`
    document.head.appendChild(s)
  }, [])

  // ── Measure tool helpers ──────────────────────────────────────
  // Haversine: great-circle distance between two lat/lng pairs in
  // metres. Earth radius 6,371 km is the conventional spherical
  // average — accurate to ~0.5% for terrestrial distances, which is
  // fine for "how far apart are these pins" use cases.
  function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
    return 2 * R * Math.asin(Math.sqrt(x))
  }
  // Total distance along a polyline. Returns 0 for <2 points.
  function totalMeters(points: Array<{ lat: number; lng: number }>): number {
    let m = 0
    for (let i = 1; i < points.length; i++) m += haversineMeters(points[i - 1], points[i])
    return m
  }
  // "1.2 mi (1.9 km)" for >0.1 mi, "350 ft (107 m)" below that. Both
  // units shown so US-centric and metric players read the same line.
  function formatDistance(meters: number): string {
    const miles = meters / 1609.344
    if (miles >= 0.1) return `${miles.toFixed(2)} mi (${(meters / 1000).toFixed(2)} km)`
    const feet = meters * 3.28084
    return `${Math.round(feet)} ft (${Math.round(meters)} m)`
  }
  // Wipe every measure-tool layer + reset state. Used by the toggle
  // button, Esc keypress, and unmount cleanup.
  function clearMeasure() {
    const map = mapInstanceRef.current
    measureMarkersRef.current.forEach(m => { try { map?.removeLayer(m) } catch {} })
    measureMarkersRef.current = []
    if (measureLineRef.current) { try { map?.removeLayer(measureLineRef.current) } catch {} ; measureLineRef.current = null }
    if (measureLabelRef.current) { try { map?.removeLayer(measureLabelRef.current) } catch {} ; measureLabelRef.current = null }
    measurePointsRef.current = []
    setMeasureDistanceText('')
  }
  // Append a click point and redraw markers + connecting polyline +
  // distance label. Label sits at the latest segment's midpoint so it
  // stays visible as the user adds segments.
  function addMeasurePoint(lat: number, lng: number) {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return
    measurePointsRef.current = [...measurePointsRef.current, { lat, lng }]
    // Numbered dot marker for this point.
    const i = measurePointsRef.current.length
    const dotHtml = `<div style="width:18px;height:18px;border-radius:50%;background:#7ab3d4;border:2px solid #f5f2ee;box-shadow:0 0 6px rgba(122,179,212,.8);display:flex;align-items:center;justify-content:center;color:#0f1a2e;font-family:Carlito,sans-serif;font-size:13px;font-weight:700;">${i}</div>`
    const dotIcon = L.divIcon({ html: dotHtml, className: '', iconSize: [18, 18], iconAnchor: [9, 9] })
    const marker = L.marker([lat, lng], { icon: dotIcon, interactive: false, keyboard: false, zIndexOffset: 9000 }).addTo(map)
    measureMarkersRef.current.push(marker)
    // Polyline through every point so far.
    if (measurePointsRef.current.length >= 2) {
      const latlngs = measurePointsRef.current.map(p => [p.lat, p.lng]) as [number, number][]
      if (measureLineRef.current) { try { map.removeLayer(measureLineRef.current) } catch {} }
      measureLineRef.current = L.polyline(latlngs, { color: '#7ab3d4', weight: 3, opacity: 0.9, dashArray: '6,6' }).addTo(map)
      // Distance label at midpoint of the FULL polyline's last leg —
      // keeps the readout near the most recent click.
      const mid = {
        lat: (measurePointsRef.current[i - 1].lat + measurePointsRef.current[i - 2].lat) / 2,
        lng: (measurePointsRef.current[i - 1].lng + measurePointsRef.current[i - 2].lng) / 2,
      }
      const total = totalMeters(measurePointsRef.current)
      const text = formatDistance(total)
      setMeasureDistanceText(text)
      const labelHtml = `<div style="padding:3px 8px;background:rgba(15,15,15,0.92);border:1px solid #7ab3d4;border-radius:3px;color:#cce0f5;font-family:Carlito,sans-serif;font-size:13px;font-weight:600;letter-spacing:.04em;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5);">${text}</div>`
      const labelIcon = L.divIcon({ html: labelHtml, className: '', iconSize: [0, 0], iconAnchor: [0, 0] })
      if (measureLabelRef.current) { try { map.removeLayer(measureLabelRef.current) } catch {} }
      measureLabelRef.current = L.marker([mid.lat, mid.lng], { icon: labelIcon, interactive: false, keyboard: false, zIndexOffset: 9500 }).addTo(map)
    } else {
      setMeasureDistanceText('Click a second point to measure…')
    }
  }

  // Drop a transient pulsing marker at (lat, lng) and clear it after
  // the animation finishes. Keeping a list of active markers means we
  // can wipe everything in the unmount-cleanup, which matters when the
  // /table page re-mounts the map between scenes.
  function dropPing(lat: number, lng: number, color: string) {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return
    const html = `<div style="position:relative;width:60px;height:60px;color:${color};"><div class="cm-ping-ring"></div><div class="cm-ping-dot"></div></div>`
    const icon = L.divIcon({ html, className: '', iconSize: [60, 60], iconAnchor: [30, 30] })
    const marker = L.marker([lat, lng], { icon, interactive: false, keyboard: false, zIndexOffset: 9999 }).addTo(map)
    pingMarkersRef.current.push(marker)
    // 1.2s × 2 iterations = 2.4s total. Add a small buffer so the last
    // frame of the second pulse renders before we yank the DOM node.
    setTimeout(() => {
      try { map.removeLayer(marker) } catch {}
      pingMarkersRef.current = pingMarkersRef.current.filter(m => m !== marker)
    }, 2600)
  }

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
          html: `<div style="width:${size}px;height:${size}px;background:#1a1a1a;border:2px solid #c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#f5f2ee;font-family:'Carlito',sans-serif;font-size:${size < 40 ? 13 : 15}px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.5);">${count}</div>`,
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        })
      },
    })

    visible.forEach((pin: any) => {
      const emoji = getCategoryEmoji(pin.category)
      const icon = leaflet.divIcon({
        html: `<div style="font-size:16px;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(26,26,26,0.85);border:2px solid #c0392b;box-shadow:0 0 6px rgba(192,57,43,0.5);${!pin.revealed && isGM ? 'opacity:0.4;border-color:#3a3a3a;box-shadow:none;' : ''}" title="${escapeHtml(pin.name)}">${emoji}</div>`,
        className: '', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -20],
      })
      const npcsHere = npcsByPin[pin.id] ?? []
      const npcSection = npcsHere.length === 0 ? '' :
        `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #2e2e2e;">
           <div style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:3px;">Also Here</div>
           ${npcsHere.map(n => `<div style="font-size:15px;color:#d4cfc9;${n.status === 'dead' ? 'text-decoration:line-through;opacity:.6;' : ''}">${escapeHtml(n.name)}</div>`).join('')}
         </div>`
      const popupHtml =
        `<div style="font-family:Carlito,sans-serif;min-width:180px;">` +
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
    } catch (err) {
      // Silent fail keeps the map usable, but logging surfaces the
      // root cause (rate-limit / network) when a user reports "search
      // didn't find my city".
      console.warn('[mapSearch] nominatim lookup failed:', err)
    }
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
    // Player path: pins land as revealed=false and the GM moderates
    // them. Show a 3-second inline confirmation so the submitter has
    // a clear signal their pin reached the GM.
    if (!isGM) {
      setSubmittedNotice(true)
      setTimeout(() => setSubmittedNotice(false), 3000)
    }
  }

  useEffect(() => {
    async function init() {
      const L = (await import('leaflet')).default
      ;(window as any).L = L
      await import('leaflet/dist/leaflet.css')

      if (!mapRef.current || mapInstanceRef.current) return

      const settingView = setting ? SETTING_CENTERS[setting] : undefined
      const customCenter = (mapCenterLat != null && mapCenterLng != null) ? { center: [mapCenterLat, mapCenterLng] as [number, number], zoom: 12 } : undefined
      // Default fallback: Mediterranean (Tyrrhenian Sea, near Stromboli) at
      // zoom 3 — wide regional view that frames Europe + N Africa for any
      // campaign that hasn't picked a setting or set a custom center.
      const view = customCenter ?? settingView ?? { center: [38.6169, 15.2930] as [number, number], zoom: 3 }
      const map = L.map(mapRef.current, { center: view.center, zoom: view.zoom, zoomControl: true })
      const t = TILE_LAYERS[mapLayer]
      tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map)

      mapInstanceRef.current = map

      // Alt+click anywhere — drop a ping locally and broadcast it to
      // every other viewer of this campaign. GM/player both can ping;
      // color signals the role. Runs BEFORE the placing branch so an
      // alt-click while in placing mode pings instead of opening the
      // new-pin form.
      map.on('click', (e: any) => {
        // Measure tool wins over everything else when active. Each
        // click extends the polyline; toggle the button (or hit Esc)
        // to clear and exit.
        if (measureModeRef.current) {
          addMeasurePoint(e.latlng.lat, e.latlng.lng)
          return
        }
        if (e?.originalEvent?.altKey) {
          const color = isGM ? '#EF9F27' : '#7fc458'
          dropPing(e.latlng.lat, e.latlng.lng, color)
          pingChannelRef.current?.send({ type: 'broadcast', event: 'cm_ping', payload: { lat: e.latlng.lat, lng: e.latlng.lng, color } })
          return
        }
        if (!placingRef.current) return
        setNewPin({ lat: e.latlng.lat, lng: e.latlng.lng })
        setPinForm({ name: '', notes: '', category: 'location' })
      })
      // Double-click anywhere on the map fires the Quick Add parent
      // callback with the clicked coords. Prevented Leaflet's default
      // zoom-on-dblclick so the interaction is ours exclusively.
      map.doubleClickZoom.disable()
      map.on('dblclick', (e: any) => {
        if (dblClickRef.current) dblClickRef.current(e.latlng.lat, e.latlng.lng)
      })

      await loadPins(L)

      supabase.channel(`campaign_pins_${campaignId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_pins', filter: `campaign_id=eq.${campaignId}` }, () => loadPins())
        .subscribe()

      supabase.channel(`campaign_npcs_map_${campaignId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_npcs', filter: `campaign_id=eq.${campaignId}` }, () => loadPins())
        .subscribe()

      // Ping broadcast channel — receive only. The sender draws its
      // own ping locally before the broadcast goes out (zero-latency
      // self-feedback) so we don't echo it back here.
      const pingCh = supabase.channel(`campaign_ping_${campaignId}`)
        .on('broadcast', { event: 'cm_ping' }, (msg: any) => {
          const p = msg?.payload ?? {}
          const lat = typeof p.lat === 'number' ? p.lat : p.payload?.lat
          const lng = typeof p.lng === 'number' ? p.lng : p.payload?.lng
          const color = p.color ?? p.payload?.color ?? '#EF9F27'
          if (typeof lat === 'number' && typeof lng === 'number') dropPing(lat, lng, color)
        })
        .subscribe()
      pingChannelRef.current = pingCh
    }
    init()
    return () => {
      // Unmount cleanup: drop active pulses and unsubscribe the ping
      // channel so /table doesn't accumulate channels when scenes flip.
      const map = mapInstanceRef.current
      pingMarkersRef.current.forEach(m => { try { map?.removeLayer(m) } catch {} })
      pingMarkersRef.current = []
      // Wipe any measure-tool layers along with the ping markers.
      measureMarkersRef.current.forEach(m => { try { map?.removeLayer(m) } catch {} })
      measureMarkersRef.current = []
      if (measureLineRef.current) { try { map?.removeLayer(measureLineRef.current) } catch {} ; measureLineRef.current = null }
      if (measureLabelRef.current) { try { map?.removeLayer(measureLabelRef.current) } catch {} ; measureLabelRef.current = null }
      measurePointsRef.current = []
      if (pingChannelRef.current) {
        try { supabase.removeChannel(pingChannelRef.current) } catch {}
        pingChannelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div ref={mapRef} style={{ width: '100%', height: '100%', cursor: (placing || measureMode) ? 'crosshair' : '' }} />

      {/* Search + layer switcher — single right column (matches MapView) */}
      <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '4px' }}>
          {/* + Pin opens to all campaign members, not just the GM. RLS
              already permits members to INSERT into campaign_pins; the
              old isGM gate was UI-only. Player pins land revealed=false
              so the GM sees them in CampaignPins for review/reveal. */}
          <button type="button" onClick={() => { setPlacing(p => !p); setNewPin(null); setAttachments([]) }}
            title={isGM ? 'Drop a pin on the campaign map' : 'Suggest a pin — GM will review and reveal it'}
            style={{ padding: '5px 10px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${placing ? '#2d5a1b' : '#3a3a3a'}`, background: placing ? '#1a2e10' : 'rgba(15,15,15,.85)', color: placing ? '#7fc458' : '#d4cfc9' }}>
            {placing ? '✕ Cancel' : isGM ? '+ Pin' : '+ Suggest Pin'}
          </button>
          {/* Measure tool — toggle on, click two (or more) points to
              get total distance in mi/km. Esc or button-toggle clears.
              Anyone (GM + player) can measure; it's a local-only tool
              right now (no broadcast) so different viewers can run
              their own measurements simultaneously. */}
          <button type="button"
            onClick={() => {
              if (measureMode) {
                clearMeasure()
                setMeasureMode(false)
              } else {
                setMeasureMode(true)
                setPlacing(false)
                setNewPin(null)
                setMeasureDistanceText('Click a point to start measuring…')
              }
            }}
            title={measureMode ? 'Stop measuring (Esc)' : 'Click two points to measure distance'}
            style={{ padding: '5px 10px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${measureMode ? '#7ab3d4' : '#3a3a3a'}`, background: measureMode ? '#0f1a2e' : 'rgba(15,15,15,.85)', color: measureMode ? '#7ab3d4' : '#d4cfc9' }}>
            {measureMode ? '✕ Stop' : '📏 Measure'}
          </button>
          <div style={{ position: 'relative' }}>
            <input value={searchQuery} onChange={e => {
              setSearchQuery(e.target.value)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              if (e.target.value.length >= 3) {
                debounceRef.current = setTimeout(async () => {
                  try {
                    setSuggestions(await searchNominatimUSFirst(e.target.value))
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
            style={{ padding: '5px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
            {searching ? '...' : 'Go'}
          </button>
        </form>
        {[['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'], ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'], ['positron', 'Positron'], ['dark', 'Dark']].map(([layer, label]) => (
          <button key={layer} onClick={() => switchLayer(layer)}
            style={{ padding: '3px 0', width: '100px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapLayer === layer ? '#c0392b' : '#3a3a3a'}`, background: mapLayer === layer ? '#2a1210' : 'rgba(15,15,15,.85)', color: mapLayer === layer ? '#f5a89a' : '#d4cfc9' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Placing mode banner */}
      {placing && !newPin && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(26,46,16,0.95)', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          Click on the map to place a pin
        </div>
      )}

      {/* Measure mode banner — shows live total distance and a hint
          for next click. Tucked above the placing banner spot so the
          two never overlap (measure forces placing off anyway). */}
      {measureMode && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(15,30,46,0.95)', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>📏 {measureDistanceText || 'Click a point to start measuring…'}</span>
          <span style={{ color: '#7ab3d4', fontSize: '13px' }}>Esc to clear</span>
        </div>
      )}

      {/* Player pin submitted — 3-second confirmation that the pin
          reached the GM for review. Only fires for non-GM submitters. */}
      {submittedNotice && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(26,46,16,0.95)', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          ✓ Pin submitted — GM will review
        </div>
      )}

      {/* New pin form */}
      {newPin && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '12px', background: 'rgba(26,26,26,0.95)', border: '1px solid #3a3a3a', borderRadius: '4px', width: '300px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>New Pin</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'monospace' }}>{newPin.lat.toFixed(4)}, {newPin.lng.toFixed(4)}</div>
          </div>
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
              style={{ flex: 1, padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={savePin} disabled={!pinForm.name.trim() || saving}
              style={{ flex: 1, padding: '6px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: pinForm.name.trim() ? 'pointer' : 'not-allowed', opacity: pinForm.name.trim() ? 1 : 0.5 }}>
              {saving ? '...' : 'Save Pin'}
            </button>
          </div>
          <div style={{ fontSize: '13px', color: '#666', marginTop: '6px', fontFamily: 'Barlow, sans-serif' }}>
            Pin will be hidden from players until revealed in Assets.
          </div>
        </div>
      )}
    </div>
  )
}
