'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { prepareUpload } from '../lib/safe-upload'
import { searchNominatimUSFirst } from '../lib/nominatim-search'
import { osrmCoordsParam, waypointLabel, parseLatLng } from '../lib/campaign-route'
import { wrapBroadcast, wrapDbChange } from '../lib/sentry-realtime'
import { wrapCategoryEmojiHtml } from '../lib/pin-categories'
import { useHiddenPins } from '../lib/use-hidden-pins'

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
  // Bumped by the parent whenever the sibling CampaignPins sidebar mutates a
  // pin (reveal/hide/edit/delete/reorder). Same-client broadcast doesn't reach
  // this map's channel (the sender's own socket is excluded), and
  // postgres_changes on campaign_pins is laggy, so a GM's "Show" click wouldn't
  // un-ghost the marker until a manual refresh. This deterministic key forces a
  // reload. (Cross-client players still update via the broadcast/postgres path.)
  pinRefreshKey?: number
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

// maxZoom = the highest zoom level the provider actually serves
// tiles for, used as a hard cap on user zoom. Leaflet greys out the
// +/scroll-wheel zoom past this. Without the cap, OpenTopoMap (z17)
// returns a "max zoom layer = 17" placeholder image past its native
// max - users zooming in to inspect a pin got tiled with that
// placeholder. Hard-cap blocks the action entirely.
const TILE_LAYERS: Record<string, { url: string; attr: string; maxZoom: number }> = {
  street:       { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap', maxZoom: 19 },
  satellite:    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri', maxZoom: 19 },
  dark:         { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CARTO', maxZoom: 19 },
  positron:     { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© CARTO', maxZoom: 19 },
  voyager:      { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '© CARTO', maxZoom: 19 },
  topo:         { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenTopoMap', maxZoom: 17 },
  humanitarian: { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attr: '© HOT', maxZoom: 19 },
}

// Base-layer picker options [id, label]. Rendered as ONE dropdown (echoing
// the header Community menu) instead of 7 splayed buttons (Xero 2026-05-25).
const LAYER_OPTIONS: [string, string][] = [
  ['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'],
  ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'],
  ['positron', 'Positron'], ['dark', 'Dark'],
]

// Travel-mode lookup for the measure tool. mph drives time conversion;
// emoji is the inline chip glyph; label shows in the dropdown. Add
// modes here (horseback, boat, etc.) as the campaign evolves.
const TRAVEL_MODES: Record<string, { mph: number; label: string; emoji: string }> = {
  walking: { mph: 3,  label: 'Walking',  emoji: '🚶' },
  bicycle: { mph: 10, label: 'Bicycle',  emoji: '🚴' },
  minnie:  { mph: 22, label: 'Minnie',   emoji: '🚐' },
}

// Local PIN_CATEGORIES - mirrors lib/pin-categories.ts canonical list
// as of 2026-05-15. CampaignMap used to carry 'landmark' as a local-
// only overflow; that category was consolidated into 'location' via
// sql/pin-category-consolidation-2026-05-15.sql in the same change,
// so the local list now matches canonical exactly.
const PIN_CATEGORIES = [
  // Row 1
  { value: 'rumor',      label: 'Rumor',      emoji: '❓' },
  { value: 'location',   label: 'Location',   emoji: '📍' },
  { value: 'encounter',  label: 'Encounter',  emoji: '⚡' },
  { value: 'person',     label: 'Person',     emoji: '👤' },
  { value: 'group',      label: 'Group',      emoji: '👥' },
  { value: 'community',  label: 'Community',  emoji: '🏘️' },
  { value: 'residence',  label: 'Residence',  emoji: '🏠' },
  { value: 'camp',       label: 'Camp',       emoji: '🏕️' },
  // Row 2
  { value: 'danger',     label: 'Danger',     emoji: '☠️' },
  { value: 'business',   label: 'Commercial', emoji: '🏪' },
  { value: 'church',     label: 'Church',     emoji: '⛪' },
  { value: 'government', label: 'Government', emoji: '🏛️' },
  { value: 'resource',   label: 'Resource',   emoji: '📦' },
  { value: 'medical',    label: 'Medical',    emoji: '🩸' },
  { value: 'animals',    label: 'Animals',    emoji: '🐾' },
  { value: 'world_event', label: 'A Timeline of the Dog Flu', emoji: '🌍' },
]

function getCategoryEmoji(category: string): string {
  return PIN_CATEGORIES.find(c => c.value === category)?.emoji ?? '📍'
}

export default function CampaignMap({ campaignId, isGM, setting, mapStyle: defaultMapStyle, mapCenterLat, mapCenterLng, revealedNpcIds, focusPin, pinRefreshKey, onMapDoubleClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const clusterGroupRef = useRef<any>(null)
  const debounceRef = useRef<any>(null)
  const placingRef = useRef(false)
  // Ping channel + active-ping markers. Alt+click anywhere on the
  // campaign map drops a transient pulse and broadcasts it to every
  // other viewer of this campaign - same UX as the tactical map. GM
  // pings are orange; player pings are green.
  const pingChannelRef = useRef<any>(null)
  // View-share channel - GM broadcasts current center/zoom/tile-layer
  // to every other viewer of this campaign. Player receives → smooth
  // flyTo + matching tile layer. One-shot, not continuous-follow.
  const viewShareChannelRef = useRef<any>(null)
  // Pins + campaign-NPC realtime channels. Held in refs so the init
  // effect's cleanup can tear them down on unmount; otherwise a new
  // subscribed pair leaks every time the map remounts (e.g. toggling
  // between the campaign and tactical maps), since supabase-js does not
  // dedupe channels by name.
  const pinsChannelRef = useRef<any>(null)
  const npcsMapChannelRef = useRef<any>(null)
  const [sharedToast, setSharedToast] = useState<string | null>(null)
  const [lastSharedView, setLastSharedView] = useState<{ lat: number; lng: number; zoom: number; tile: string | null } | null>(null)
  const [shareFlash, setShareFlash] = useState(false)
  const pingMarkersRef = useRef<any[]>([])
  // Measure tool - click to drop point A, click again for point B,
  // shows total path distance + per-segment legs. Multi-click adds
  // segments (polyline-style); button toggle or Esc clears.
  const measureModeRef = useRef(false)
  const measurePointsRef = useRef<Array<{ lat: number; lng: number }>>([])
  const measureMarkersRef = useRef<any[]>([])
  const measureLineRef = useRef<any>(null)
  const measureLabelsRef = useRef<any[]>([])
  const [measureMode, setMeasureMode] = useState(false)
  // Per-leg breakdown for the toolbar. Each entry: "Leg N→N+1: <dist> · <time>".
  // The toolbar stacks these vertically with a TOTAL line at the bottom.
  // Replaced the prior single-string state 2026-05-11 per Xero - multi-
  // waypoint paths need the breakdown visible in the toolbar, not just
  // on the per-segment chips out on the map.
  const [measureLegs, setMeasureLegs] = useState<string[]>([])
  const [measureTotalText, setMeasureTotalText] = useState<string>('')
  // Travel mode for the measure tool. Walking = 3 mph (sustained foot
  // pace), Bicycle = 10 mph (post-apoc mixed terrain), Minnie = 22 mph
  // (sustained cross-country cruise per Xero 2026-05-18; was 32 mph
  // midpoint of 30-35 from the Mongrels doc, lowered for realism on
  // mixed terrain + fuel conservation).
  // Session-scoped - no localStorage. Defaults to walking.
  type TravelMode = 'walking' | 'bicycle' | 'minnie'
  const [travelMode, setTravelMode] = useState<TravelMode>('walking')
  const travelModeRef = useRef<TravelMode>('walking')
  useEffect(() => { travelModeRef.current = travelMode }, [travelMode])
  useEffect(() => { measureModeRef.current = measureMode }, [measureMode])

  // Route planner - OSRM road routing draws the real-world driving path
  // through one or more waypoints. Click a start (A), then click the
  // destination to plot A->B; hold SHIFT while clicking to drop extra
  // waypoints (C, D, E ...) the route must pass through, and a plain
  // click finishes. Distinct from Measure (straight-line). Esc/toggle
  // clears. Local-only just like Measure.
  const routeModeRef = useRef(false)
  const routeWaypointsRef = useRef<{ lat: number; lng: number }[]>([])
  const routeMarkersRef = useRef<any[]>([])
  const routeLineRef = useRef<any>(null)
  // Full polyline latlngs after OSRM/fallback resolves - stored so Share
  // Route can broadcast the exact geometry without re-hitting OSRM.
  const routeCoordsRef = useRef<[number, number][] | null>(null)
  const [routeMode, setRouteMode] = useState(false)
  const [routeStatus, setRouteStatus] = useState('')
  const [routeLoading, setRouteLoading] = useState(false)
  // Persist the last plotted route's distance + whether OSRM resolved
  // it (vs a straight-line fallback) so flipping the travel-mode
  // dropdown can recompute the ETA without re-hitting OSRM.
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null)
  const [routeIsFallback, setRouteIsFallback] = useState(false)
  const [routeShareFlash, setRouteShareFlash] = useState(false)
  useEffect(() => { routeModeRef.current = routeMode }, [routeMode])
  // Hold a ref to the latest onMapDoubleClick callback so the Leaflet
  // dblclick handler registered in the init effect can always call the
  // current parent version without re-subscribing.
  const dblClickRef = useRef<typeof onMapDoubleClick>(undefined)
  useEffect(() => { dblClickRef.current = onMapDoubleClick }, [onMapDoubleClick])
  const supabase = createClient()
  const [pins, setPins] = useState<CampaignPin[]>([])
  // Per-user "hidden on my map" pins (local declutter; never the GM's reveal).
  // Skipped when rendering markers; re-render when the set changes.
  const { hidden: locallyHiddenPins } = useHiddenPins(campaignId)
  const locallyHiddenPinsRef = useRef(locallyHiddenPins)
  useEffect(() => {
    locallyHiddenPinsRef.current = locallyHiddenPins
    if (mapInstanceRef.current) void loadPins()
  }, [locallyHiddenPins])
  // Last view + tile layer persist to localStorage per campaign so a
  // refresh lands back where you were instead of snapping to the
  // setting default or world fallback. Keys: tapestry:campaignMap:view
  // / :layer suffixed with campaignId. Lazy init below; save on
  // moveend/zoomend + every switchLayer call.
  const [mapLayer, setMapLayer] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`tapestry:campaignMap:layer:${campaignId}`)
        if (saved && TILE_LAYERS[saved]) return saved
      } catch {}
    }
    return defaultMapStyle ?? 'street'
  })
  // Mirror mapLayer in a ref so the view-share broadcast handler (set
  // up once in the init effect) can compare the latest value without
  // re-subscribing on every layer switch.
  const mapLayerRef = useRef<string>(mapLayer)
  useEffect(() => { mapLayerRef.current = mapLayer }, [mapLayer])
  // Base-layer dropdown (replaces the 7 splayed layer buttons).
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)
  const layerMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!layerMenuOpen) return
    const onDoc = (e: MouseEvent) => { if (layerMenuRef.current && !layerMenuRef.current.contains(e.target as Node)) setLayerMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [layerMenuOpen])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  // Feedback when a search finds nothing (was silent - "isn't going anywhere").
  const [searchMsg, setSearchMsg] = useState('')
  const [placing, setPlacing] = useState(false)
  const [newPin, setNewPin] = useState<{ lat: number; lng: number } | null>(null)
  const [pinForm, setPinForm] = useState({ name: '', notes: '', category: 'location' })
  const [saving, setSaving] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  // Brief inline confirmation after a non-GM player submits a pin -
  // their own pin lands as revealed=false so they can't see it back
  // until the GM approves. Without this confirmation the form just
  // disappears and the player can't tell whether the submission worked.
  const [submittedNotice, setSubmittedNotice] = useState(false)

  // Keep ref in sync so the Leaflet click handler sees current state
  useEffect(() => { placingRef.current = placing }, [placing])

  // Esc kills the measure tool - bail out of the multi-click flow
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

  // Esc bails out of the route tool - AND clears a lingering route line
  // even after route mode is off. Pre-2026-05-19 the listener only
  // attached while routeMode was true, so a completed route that the
  // user thought they could Esc away never cleared. Now attached on
  // mount; checks refs to decide what to do.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const hasRouteState = routeModeRef.current
        || !!routeLineRef.current
        || routeMarkersRef.current.length > 0
        || routeWaypointsRef.current.length > 0
      if (hasRouteState) {
        clearRoute()
        setRouteMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Inject ping pulse keyframes ONCE (per browser tab). Three staggered
  // rings (red -> green -> red) at 0.6s each with 0.4s stagger pop in
  // ~1.4s total. The alternating colors are deliberate - easier to
  // catch from peripheral vision than a single hue. The role color
  // passed to dropPing is now ignored; ping = always red/green/red.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('cm-ping-style')) return
    const s = document.createElement('style')
    s.id = 'cm-ping-style'
    s.textContent = `
@keyframes cm-ping-pulse {
  0%   { transform: scale(0.25); opacity: 1; }
  100% { transform: scale(1.8); opacity: 0; }
}
.cm-ping-ring {
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 5px solid currentColor;
  box-shadow: 0 0 18px currentColor, 0 0 36px currentColor, inset 0 0 14px currentColor;
  animation: cm-ping-pulse 0.6s ease-out 1 both;
  pointer-events: none;
}
`
    document.head.appendChild(s)
  }, [])

  // ── Measure tool helpers ──────────────────────────────────────
  // Haversine: great-circle distance between two lat/lng pairs in
  // metres. Earth radius 6,371 km is the conventional spherical
  // average - accurate to ~0.5% for terrestrial distances, which is
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
  // Travel time at the picked mode's mph. Walking is 3 mph (sustained
  // foot pace, unencumbered, flat ground). Bicycle is 10 mph (mixed
  // post-apoc terrain). Minnie is 22 mph (sustained cross-country
  // cruise per Xero 2026-05-18; was 32 mph from `Minnie ^0 The
  // Magnificent Mongrels v04.docx`).
  // Output: "23 min" sub-hour, "2h 4m" once past 60 min, "<1 min" for
  // very short legs so a chip never reads "0 min."
  function formatTravelTime(meters: number, mph: number): string {
    const metersPerMinute = mph * 1609.344 / 60
    const minutes = meters / metersPerMinute
    if (minutes < 1) return '<1 min'
    if (minutes < 60) return `${Math.round(minutes)} min`
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes - h * 60)
    return m === 0 ? `${h}h` : `${h}h ${m}m`
  }
  // Recompute every leg label + the TOTAL row using the current travel
  // mode. Called when the user switches mode after dropping waypoints
  // - the on-map midpoint chips get fresh icons via setIcon (no
  // marker churn), the toolbar legs/total restate. Cheap loop over
  // existing points; no re-fetch, no flicker.
  function recomputeMeasureLabels() {
    const L = (window as any).L
    const pts = measurePointsRef.current
    if (pts.length < 2 || !L) {
      setMeasureLegs([])
      setMeasureTotalText(pts.length === 1 ? 'Click a second point to measure…' : '')
      return
    }
    const mode = TRAVEL_MODES[travelModeRef.current] ?? TRAVEL_MODES.walking
    const nextLegs: string[] = []
    for (let i = 1; i < pts.length; i++) {
      const segMeters = haversineMeters(pts[i - 1], pts[i])
      nextLegs.push(`Leg ${i}→${i + 1}: ${formatDistance(segMeters)} · ${mode.emoji} ${formatTravelTime(segMeters, mode.mph)}`)
      // Update the on-map chip for this leg. measureLabelsRef[i-1]
      // corresponds to the leg between pts[i-1] and pts[i].
      const labelMarker = measureLabelsRef.current[i - 1]
      if (labelMarker) {
        const segText = `${formatDistance(segMeters)} · ${mode.emoji} ${formatTravelTime(segMeters, mode.mph)}`
        const labelHtml = `<div style="padding:3px 8px;background:rgba(15,15,15,0.92);border:1px solid #7ab3d4;border-radius:3px;color:#cce0f5;font-family:Carlito,sans-serif;font-size:13px;font-weight:600;letter-spacing:.04em;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5);">${segText}</div>`
        try { labelMarker.setIcon(L.divIcon({ html: labelHtml, className: '', iconSize: [0, 0], iconAnchor: [0, 0] })) } catch {}
      }
    }
    setMeasureLegs(nextLegs)
    const total = totalMeters(pts)
    setMeasureTotalText(`${formatDistance(total)} · ${mode.emoji} ${formatTravelTime(total, mode.mph)} total`)
  }
  // Recompute whenever the travel mode flips. No-op when measureMode
  // is off or fewer than 2 points have been dropped.
  useEffect(() => {
    if (measurePointsRef.current.length >= 2) recomputeMeasureLabels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelMode])

  // ── Route planner helpers ──────────────────────────────────────
  // Wipe route-tool layers + reset state.
  function clearRoute() {
    const map = mapInstanceRef.current
    routeMarkersRef.current.forEach(m => { try { map?.removeLayer(m) } catch {} })
    routeMarkersRef.current = []
    if (routeLineRef.current) { try { map?.removeLayer(routeLineRef.current) } catch {} ; routeLineRef.current = null }
    routeWaypointsRef.current = []
    routeCoordsRef.current = null
    setRouteStatus('')
    setRouteLoading(false)
    setRouteDistanceMeters(null)
    setRouteIsFallback(false)
  }

  // Handle a click while route mode is active. The FIRST click drops the
  // start marker (A). After that: a SHIFT-click drops an intermediate
  // waypoint (B, C, D ...) and keeps waiting; a PLAIN click drops the
  // destination and plots the road route through EVERY waypoint via OSRM.
  // OSRM demo server (router.project-osrm.org) is free + no-auth; fine for
  // tabletop pace. On API failure, falls back to a dashed straight line
  // through the waypoints so the user still gets visual feedback.
  async function handleRouteClick(lat: number, lng: number, addWaypoint: boolean) {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return
    // Starting a fresh route: if a COMPLETED route is still on the map
    // (markers/line present but no waypoints buffered), wipe it first so
    // we don't stack a new route on the old one.
    if (routeWaypointsRef.current.length === 0 && (routeLineRef.current || routeMarkersRef.current.length > 0)) {
      clearRoute()
    }
    const idx = routeWaypointsRef.current.length
    routeWaypointsRef.current.push({ lat, lng })
    const isFirst = idx === 0
    // Shift-click on the 2nd+ point is an intermediate waypoint; a plain
    // click there is the destination. The first click is always the start.
    const isFinal = !isFirst && !addWaypoint
    const letter = waypointLabel(idx)
    // A = green (start), final = red (destination), intermediate = purple.
    const bg = isFirst ? '#7fc458' : isFinal ? '#c0392b' : '#a855f7'
    const fg = isFirst ? '#0f1a0f' : isFinal ? '#2a0f0a' : '#1a0f2e'
    const html = `<div style="width:20px;height:20px;border-radius:50%;background:${bg};border:2px solid #f5f2ee;box-shadow:0 0 8px ${bg}e6;display:flex;align-items:center;justify-content:center;color:${fg};font-family:Carlito,sans-serif;font-size:13px;font-weight:700;">${letter}</div>`
    const icon = L.divIcon({ html, className: '', iconSize: [20, 20], iconAnchor: [10, 10] })
    routeMarkersRef.current.push(L.marker([lat, lng], { icon, interactive: false, keyboard: false, zIndexOffset: 9100 }).addTo(map))

    if (isFirst) {
      setRouteStatus('Click destination - Shift-click to add a waypoint')
      return
    }
    if (!isFinal) {
      // Intermediate waypoint: show a provisional straight line through the
      // points so far, then keep waiting for more (or the finishing click).
      if (routeLineRef.current) { try { map.removeLayer(routeLineRef.current) } catch {} ; routeLineRef.current = null }
      const provisional = routeWaypointsRef.current.map(p => [p.lat, p.lng]) as [number, number][]
      routeLineRef.current = L.polyline(provisional, { color: '#a855f7', weight: 2, opacity: 0.6, dashArray: '4,6' }).addTo(map)
      setRouteStatus(`Waypoint ${letter} added - click to finish, Shift-click to add more`)
      return
    }
    // Final click: plot the road route through every waypoint in order.
    const points = routeWaypointsRef.current
    if (routeLineRef.current) { try { map.removeLayer(routeLineRef.current) } catch {} ; routeLineRef.current = null }
    setRouteLoading(true)
    setRouteStatus('Plotting…')
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoordsParam(points)}?overview=full&geometries=geojson`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`OSRM returned ${res.status}`)
      const json = await res.json()
      const route = json?.routes?.[0]
      if (!route?.geometry?.coordinates) throw new Error('No route in response')
      // OSRM returns [lng, lat] - Leaflet wants [lat, lng].
      const latlngs = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]) as [number, number][]
      routeCoordsRef.current = latlngs
      routeLineRef.current = L.polyline(latlngs, { color: '#a855f7', weight: 4, opacity: 0.85 }).addTo(map)
      const mode = TRAVEL_MODES[travelModeRef.current] ?? TRAVEL_MODES.walking
      const meters = route.distance ?? 0
      setRouteDistanceMeters(meters)
      setRouteIsFallback(false)
      setRouteStatus(`${formatDistance(meters)} via roads · ${mode.emoji} ${formatTravelTime(meters, mode.mph)}`)
    } catch (err) {
      console.error('[campaign-map] OSRM route failed:', err)
      // Fallback: dashed straight line through the waypoints.
      const latlngs = points.map(p => [p.lat, p.lng]) as [number, number][]
      routeCoordsRef.current = latlngs
      routeLineRef.current = L.polyline(latlngs, { color: '#a855f7', weight: 3, opacity: 0.7, dashArray: '6,6' }).addTo(map)
      const meters = totalMeters(points)
      const mode = TRAVEL_MODES[travelModeRef.current] ?? TRAVEL_MODES.walking
      setRouteDistanceMeters(meters)
      setRouteIsFallback(true)
      setRouteStatus(`Routing unavailable - straight line (${formatDistance(meters)} · ${mode.emoji} ${formatTravelTime(meters, mode.mph)})`)
    } finally {
      setRouteLoading(false)
      // Reset so the next click starts a fresh route (the wipe-stale guard
      // above clears the finished line/markers on that first click).
      routeWaypointsRef.current = []
    }
  }

  // Recompute the route status whenever travel mode flips. Route
  // distance is whatever OSRM returned (or haversine on fallback) and
  // doesn't change with mode - just the ETA does, so we don't need
  // to re-hit OSRM.
  useEffect(() => {
    if (routeDistanceMeters == null) return
    const mode = TRAVEL_MODES[travelMode] ?? TRAVEL_MODES.walking
    const meters = routeDistanceMeters
    if (routeIsFallback) {
      setRouteStatus(`Routing unavailable - straight line (${formatDistance(meters)} · ${mode.emoji} ${formatTravelTime(meters, mode.mph)})`)
    } else {
      setRouteStatus(`${formatDistance(meters)} via roads · ${mode.emoji} ${formatTravelTime(meters, mode.mph)}`)
    }
  }, [travelMode, routeDistanceMeters, routeIsFallback])

  // Wipe every measure-tool layer + reset state. Used by the toggle
  // button, Esc keypress, and unmount cleanup.
  function clearMeasure() {
    const map = mapInstanceRef.current
    measureMarkersRef.current.forEach(m => { try { map?.removeLayer(m) } catch {} })
    measureMarkersRef.current = []
    if (measureLineRef.current) { try { map?.removeLayer(measureLineRef.current) } catch {} ; measureLineRef.current = null }
    measureLabelsRef.current.forEach(l => { try { map?.removeLayer(l) } catch {} })
    measureLabelsRef.current = []
    measurePointsRef.current = []
    setMeasureLegs([])
    setMeasureTotalText('')
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
      // Per-segment label - each leg gets its own distance + walk-time
      // chip at its midpoint so multi-waypoint paths show the breakdown
      // (not just the total). Walk time at 3 mph per `formatWalkTime`.
      const prev = measurePointsRef.current[i - 2]
      const cur = measurePointsRef.current[i - 1]
      const segMeters = haversineMeters(prev, cur)
      const mid = { lat: (prev.lat + cur.lat) / 2, lng: (prev.lng + cur.lng) / 2 }
      const mode = TRAVEL_MODES[travelModeRef.current] ?? TRAVEL_MODES.walking
      const segText = `${formatDistance(segMeters)} · ${mode.emoji} ${formatTravelTime(segMeters, mode.mph)}`
      const labelHtml = `<div style="padding:3px 8px;background:rgba(15,15,15,0.92);border:1px solid #7ab3d4;border-radius:3px;color:#cce0f5;font-family:Carlito,sans-serif;font-size:13px;font-weight:600;letter-spacing:.04em;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5);">${segText}</div>`
      const labelIcon = L.divIcon({ html: labelHtml, className: '', iconSize: [0, 0], iconAnchor: [0, 0] })
      const segLabel = L.marker([mid.lat, mid.lng], { icon: labelIcon, interactive: false, keyboard: false, zIndexOffset: 9500 }).addTo(map)
      measureLabelsRef.current.push(segLabel)
      // Toolbar shows per-leg breakdown stacked vertically + a TOTAL
      // row at the bottom. Each leg line: "Leg N→N+1: <dist> · <time>".
      setMeasureLegs(prev => [...prev, `Leg ${i - 1}→${i}: ${formatDistance(segMeters)} · ${mode.emoji} ${formatTravelTime(segMeters, mode.mph)}`])
      const total = totalMeters(measurePointsRef.current)
      setMeasureTotalText(`${formatDistance(total)} · ${mode.emoji} ${formatTravelTime(total, mode.mph)} total`)
    } else {
      setMeasureLegs([])
      setMeasureTotalText('Click a second point to measure…')
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
    // Three staggered rings - red, green, red - for an alternating-
    // color pop that catches peripheral attention. Each ring runs one
    // pulse (0.6s); delays of 0s / 0.4s / 0.8s create a continuous
    // rhythm with light overlap. The `color` param is preserved for
    // back-compat with the broadcast handler but no longer drives the
    // visual - the palette is fixed.
    const ringHtml = (col: string, delayMs: number) =>
      `<div class="cm-ping-ring" style="color:${col};animation-delay:${delayMs}ms;"></div>`
    const html =
      `<div style="position:relative;width:110px;height:110px;">` +
        ringHtml('#ff3a1d', 0) +
        ringHtml('#39ff14', 400) +
        ringHtml('#ff3a1d', 800) +
      `</div>`
    const icon = L.divIcon({ html, className: '', iconSize: [110, 110], iconAnchor: [55, 55] })
    const marker = L.marker([lat, lng], { icon, interactive: false, keyboard: false, zIndexOffset: 9999 }).addTo(map)
    pingMarkersRef.current.push(marker)
    // Last ring starts at 800ms + 600ms duration = 1400ms; small buffer
    // ensures the final frame renders before the DOM node is yanked.
    setTimeout(() => {
      try { map.removeLayer(marker) } catch {}
      pingMarkersRef.current = pingMarkersRef.current.filter(m => m !== marker)
    }, 1600)
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
      // Disable the default click-zooms-to-bounds so alt+click and
      // measure-mode click can pass through to the ping / measure
      // handlers instead. Plain-click still zooms - re-implemented in
      // the clusterclick handler below.
      zoomToBoundsOnClick: false,
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
      if (locallyHiddenPinsRef.current.has(pin.id)) return // player decluttered this pin off their own map
      const emoji = getCategoryEmoji(pin.category)
      // Group silhouette emoji disappears against the dark pin chrome;
      // see lib/pin-categories.ts for the white-filter rationale.
      const emojiHtml = wrapCategoryEmojiHtml(pin.category, emoji)
      const icon = leaflet.divIcon({
        html: `<div style="font-size:16px;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(26,26,26,0.85);border:2px solid #c0392b;box-shadow:0 0 6px rgba(192,57,43,0.5);${!pin.revealed && isGM ? 'opacity:0.4;border-color:#3a3a3a;box-shadow:none;' : ''}" title="${escapeHtml(pin.name)}">${emojiHtml}</div>`,
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
      // Pin markers swallow the click before the map sees it, so the
      // map-level alt-ping and measure-tool handlers never fire when a
      // pin sits where you want to gesture. Strip bindPopup's auto-
      // toggle and replace it with a router: alt -> ping at the pin's
      // coords, measure-mode -> add a waypoint at the pin's coords,
      // otherwise the normal open/close-popup behavior.
      marker.off('click')
      marker.on('click', (ev: any) => {
        const oe = ev?.originalEvent
        if (measureModeRef.current) {
          addMeasurePoint(pin.lat, pin.lng)
          return
        }
        // Route mode: ANY click on a pin (plain OR alt) drops the route
        // waypoint at the pin's exact coords. Matches the empty-map click
        // handler (which routes on any click in route mode) and the cluster
        // alt-click path, so a pin is a snappable start/end target however you
        // click it. Earlier this excluded alt+click (it fell through to ping),
        // which is exactly the gesture that felt broken - alt+click a pin now
        // sets the waypoint instead of pinging.
        if (routeModeRef.current) {
          void handleRouteClick(pin.lat, pin.lng, !!oe?.shiftKey)
          return
        }
        if (oe?.altKey) {
          const color = isGM ? '#ff3a1d' : '#39ff14'
          dropPing(pin.lat, pin.lng, color)
          pingChannelRef.current?.send({ type: 'broadcast', event: 'cm_ping', payload: { lat: pin.lat, lng: pin.lng, color } })
          return
        }
        marker.togglePopup()
      })
      if (isGM) {
        marker.on('dragend', async (ev: any) => {
          const ll = ev.target.getLatLng()
          await supabase.from('campaign_pins').update({ lat: ll.lat, lng: ll.lng }).eq('id', pin.id)
        })
      }
      clusterGroup.addLayer(marker)
      markersRef.current[pin.id] = marker
    })

    // Cluster click router. With zoomToBoundsOnClick: false above, the
    // default zoom is suppressed and we decide here: alt -> ping at the
    // cluster centroid; measure-mode -> add a waypoint at the centroid;
    // plain -> the previous default (zoom to fit the cluster's pins).
    // Without this, alt-clicking a cluster zooms in and the ping gets
    // lost as the map re-centers.
    clusterGroup.on('clusterclick', (a: any) => {
      const oe = a.originalEvent
      const center = a.layer.getLatLng()
      if (measureModeRef.current) {
        addMeasurePoint(center.lat, center.lng)
        return
      }
      // Route mode + alt-click on a cluster: use the cluster centroid
      // as a route waypoint. Plain click still zooms to the cluster
      // so the player can pick a specific pin underneath.
      if (routeModeRef.current && oe?.altKey) {
        void handleRouteClick(center.lat, center.lng, !!oe?.shiftKey)
        return
      }
      if (oe?.altKey) {
        const color = isGM ? '#ff3a1d' : '#39ff14'
        dropPing(center.lat, center.lng, color)
        pingChannelRef.current?.send({ type: 'broadcast', event: 'cm_ping', payload: { lat: center.lat, lng: center.lng, color } })
        return
      }
      const bounds = a.layer.getBounds?.()
      if (bounds) map.fitBounds(bounds, { padding: [30, 30] })
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
    try { localStorage.setItem(`tapestry:campaignMap:layer:${campaignId}`, layer) } catch {}
    if (!mapInstanceRef.current || !tileLayerRef.current) return
    const L = (window as any).L
    if (!L) return
    tileLayerRef.current.remove()
    const t = TILE_LAYERS[layer] ?? TILE_LAYERS.street
    tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: t.maxZoom }).addTo(mapInstanceRef.current)
    // Push the new layer's cap onto the map. If the user is currently
    // zoomed past it (e.g. switching from satellite z19 → topo z17),
    // pull them back to the cap so the view doesn't show placeholder
    // tiles for one frame before they zoom out manually.
    mapInstanceRef.current.setMaxZoom(t.maxZoom)
    if (mapInstanceRef.current.getZoom() > t.maxZoom) {
      mapInstanceRef.current.setZoom(t.maxZoom)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSuggestions([])
    setSearchMsg('')
    // Coordinate paste: "lat, lng" from Google Maps ("copy coordinates")
    // flies straight there - the reliable escape hatch for addresses our
    // OSM geocoder can't resolve (rural / Forest-Service roads).
    const coords = parseLatLng(searchQuery)
    if (coords) {
      mapInstanceRef.current?.flyTo([coords.lat, coords.lng], 15)
      setSearching(false)
      return
    }
    try {
      // Same US-first geocoder the typed suggestions use (Enter used to do a
      // separate global query, so Enter could land somewhere other than the
      // dropdown showed).
      const data = await searchNominatimUSFirst(searchQuery, { limit: 1 })
      if (data[0]) {
        mapInstanceRef.current?.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 14)
      } else {
        // OSM has no match (common for exact rural addresses Google has).
        // Tell the user instead of silently doing nothing.
        setSearchMsg('No match. Our map uses OpenStreetMap - try a city or ZIP, or paste coordinates (in Google Maps, right-click the spot then Copy coordinates).')
      }
    } catch (err) {
      console.error('[mapSearch] nominatim lookup failed:', err)
      setSearchMsg('Search failed - check your connection and try again.')
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
        const check = prepareUpload('pin-attachments', file)
        if (!check.ok) { alert(check.reason); continue }
        const path = `${campaignId}/${data.id}/${check.filename}`
        await supabase.storage.from('pin-attachments').upload(path, file, { contentType: check.contentType })
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
      // Saved view from a prior session for this campaign. Wins over
      // every other source so a refresh resumes exactly where the user
      // was looking. Cleared localStorage falls through to customCenter
      // / settingView / world default below.
      let savedView: { center: [number, number]; zoom: number } | undefined
      try {
        const raw = localStorage.getItem(`tapestry:campaignMap:view:${campaignId}`)
        if (raw) {
          const p = JSON.parse(raw)
          if (typeof p?.lat === 'number' && typeof p?.lng === 'number' && typeof p?.zoom === 'number') {
            savedView = { center: [p.lat, p.lng], zoom: p.zoom }
          }
        }
      } catch {}
      // Default fallback: Mediterranean (Tyrrhenian Sea, near Stromboli) at
      // zoom 3 - wide regional view that frames Europe + N Africa for any
      // campaign that hasn't picked a setting or set a custom center.
      const view = savedView ?? customCenter ?? settingView ?? { center: [38.6169, 15.2930] as [number, number], zoom: 3 }
      const t = TILE_LAYERS[mapLayer] ?? TILE_LAYERS.street
      const map = L.map(mapRef.current, { center: view.center, zoom: view.zoom, zoomControl: true, minZoom: 2, maxZoom: t.maxZoom })
      tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: t.maxZoom }).addTo(map)

      mapInstanceRef.current = map

      // Persist view on every move/zoom so the next refresh resumes
      // here. Cheap enough to fire on every settle event - no debounce
      // needed for a single localStorage write per gesture.
      const saveView = () => {
        try {
          const c = map.getCenter()
          const z = map.getZoom()
          localStorage.setItem(`tapestry:campaignMap:view:${campaignId}`, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: z }))
        } catch {}
      }
      map.on('moveend', saveView)
      map.on('zoomend', saveView)

      // Alt+click anywhere - drop a ping locally and broadcast it to
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
        if (routeModeRef.current) {
          void handleRouteClick(e.latlng.lat, e.latlng.lng, !!e?.originalEvent?.shiftKey)
          return
        }
        if (e?.originalEvent?.altKey) {
          const color = isGM ? '#ff3a1d' : '#39ff14'
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

      // Pin sync. Two listeners on the same channel:
      //   - postgres_changes is the lossy fallback (known flaky on RLS'd
      //     tables - see CampaignPins.tsx L151-153 + lessons memo
      //     2026-04-11). Kept as a belt.
      //   - broadcast 'pins_changed' is the reliable signal - every pin
      //     mutation in CampaignPins (toggleReveal / revealAll / hideAll /
      //     edit / delete / reorder) fires this. Pre-this-fix
      //     (post-2026-05-18-playtest), CampaignMap relied only on
      //     postgres_changes; a GM's "Show pin" click reliably updated
      //     the sidebar list but NOT the map markers until refresh.
      //     Adding the broadcast listener closes the gap.
      pinsChannelRef.current = supabase.channel(`campaign_pins_${campaignId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_pins', filter: `campaign_id=eq.${campaignId}` }, wrapDbChange('campaign_pins', () => loadPins()))
        .on('broadcast', { event: 'pins_changed' }, wrapBroadcast('pins_changed', () => loadPins()))
        // Catch-up reload on (re)subscribe: the pins_changed broadcast is
        // fire-and-forget, so a client that dropped/late-joined never reloads
        // and shows stale markers until refresh. Reloading on SUBSCRIBED (and
        // on tab-return-to-visible below) makes convergence not depend on
        // catching one ephemeral broadcast.
        .subscribe((status: string) => { if (status === 'SUBSCRIBED') void loadPins() })

      npcsMapChannelRef.current = supabase.channel(`campaign_npcs_map_${campaignId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_npcs', filter: `campaign_id=eq.${campaignId}` }, wrapDbChange('campaign_npcs_map', () => loadPins()))
        .subscribe()

      // Ping broadcast channel - receive only. The sender draws its
      // own ping locally before the broadcast goes out (zero-latency
      // self-feedback) so we don't echo it back here.
      const pingCh = supabase.channel(`campaign_ping_${campaignId}`)
        .on('broadcast', { event: 'cm_ping' }, wrapBroadcast('cm_ping', (msg: any) => {
          const p = msg?.payload ?? {}
          const lat = typeof p.lat === 'number' ? p.lat : p.payload?.lat
          const lng = typeof p.lng === 'number' ? p.lng : p.payload?.lng
          const color = p.color ?? p.payload?.color ?? '#ff3a1d'
          if (typeof lat === 'number' && typeof lng === 'number') dropPing(lat, lng, color)
        }))
        .subscribe()
      pingChannelRef.current = pingCh

      // View-share broadcast channel. GM Send-side fires payload
      // { lat, lng, zoom, tile }. Every other viewer flyTo()s to the
      // coords and switches their tile layer to match. One-shot.
      // (Self-receive is OK and ignored - the GM is already there.)
      const viewCh = supabase.channel(`campaign_view_share_${campaignId}`)
        .on('broadcast', { event: 'cm_view_share' }, wrapBroadcast('cm_view_share', (msg: any) => {
          if (isGM) return // GMs ignore their own share echo + other GMs' shares
          const p = msg?.payload ?? {}
          const lat = typeof p.lat === 'number' ? p.lat : null
          const lng = typeof p.lng === 'number' ? p.lng : null
          const zoom = typeof p.zoom === 'number' ? p.zoom : null
          const tile = typeof p.tile === 'string' ? p.tile : null
          if (lat == null || lng == null || zoom == null) return
          const map = mapInstanceRef.current
          if (!map) return
          if (tile && tile !== mapLayerRef.current) switchLayer(tile)
          map.flyTo([lat, lng], zoom, { duration: 0.6 })
          setLastSharedView({ lat, lng, zoom, tile })
          setSharedToast('GM shared a view')
        }))
        .on('broadcast', { event: 'cm_route_share' }, wrapBroadcast('cm_route_share', (msg: any) => {
          // Players (and other GMs) receive a shared route and draw it.
          const p = msg?.payload ?? {}
          const coords = Array.isArray(p.coords) ? p.coords as [number, number][] : null
          if (!coords || coords.length < 2) return
          const L = (window as any).L
          const map = mapInstanceRef.current
          if (!L || !map) return
          // Wipe any existing route layers before drawing the received one.
          routeMarkersRef.current.forEach(m => { try { map.removeLayer(m) } catch {} })
          routeMarkersRef.current = []
          if (routeLineRef.current) { try { map.removeLayer(routeLineRef.current) } catch {} ; routeLineRef.current = null }
          // Draw the shared polyline.
          const isFallback = p.isFallback === true
          routeLineRef.current = L.polyline(coords, { color: '#a855f7', weight: isFallback ? 3 : 4, opacity: isFallback ? 0.7 : 0.85, ...(isFallback ? { dashArray: '6,6' } : {}) }).addTo(map)
          routeCoordsRef.current = coords
          // Reconstruct waypoint markers from payload.
          const waypoints: { lat: number; lng: number }[] = Array.isArray(p.waypoints) ? p.waypoints : []
          const total = waypoints.length
          waypoints.forEach((wp, idx) => {
            const isFirst = idx === 0
            const isFinal = idx === total - 1
            const bg = isFirst ? '#7fc458' : isFinal ? '#c0392b' : '#a855f7'
            const fg = isFirst ? '#0f1a0f' : isFinal ? '#2a0f0a' : '#1a0f2e'
            const letter = waypointLabel(idx)
            const html = `<div style="width:20px;height:20px;border-radius:50%;background:${bg};border:2px solid #f5f2ee;box-shadow:0 0 8px ${bg}e6;display:flex;align-items:center;justify-content:center;color:${fg};font-family:Carlito,sans-serif;font-size:13px;font-weight:700;">${letter}</div>`
            const icon = L.divIcon({ html, className: '', iconSize: [20, 20], iconAnchor: [10, 10] })
            routeMarkersRef.current.push(L.marker([wp.lat, wp.lng], { icon, interactive: false, keyboard: false, zIndexOffset: 9100 }).addTo(map))
          })
          const meters = typeof p.meters === 'number' ? p.meters : null
          setRouteDistanceMeters(meters)
          setRouteIsFallback(isFallback)
          if (typeof p.travelMode === 'string' && TRAVEL_MODES[p.travelMode as TravelMode]) {
            setTravelMode(p.travelMode as TravelMode)
          }
          setSharedToast('GM shared a route')
        }))
        .subscribe()
      viewShareChannelRef.current = viewCh
    }
    init()
    // Tab-return catch-up: a backgrounded tab can miss the pins_changed
    // broadcast (Chrome pauses the socket); reload on hidden->visible so the
    // map markers converge with the DB without a manual refresh.
    function handlePinsVisibility() { if (!document.hidden && mapInstanceRef.current) void loadPins() }
    document.addEventListener('visibilitychange', handlePinsVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handlePinsVisibility)
      // Unmount cleanup: drop active pulses and unsubscribe EVERY channel
      // (ping, view-share, pins, npcs) so /table doesn't accumulate
      // subscribed channels each time the map remounts (e.g. campaign <->
      // tactical toggle).
      const map = mapInstanceRef.current
      pingMarkersRef.current.forEach(m => { try { map?.removeLayer(m) } catch {} })
      pingMarkersRef.current = []
      // Wipe any measure-tool layers along with the ping markers.
      measureMarkersRef.current.forEach(m => { try { map?.removeLayer(m) } catch {} })
      measureMarkersRef.current = []
      if (measureLineRef.current) { try { map?.removeLayer(measureLineRef.current) } catch {} ; measureLineRef.current = null }
      measureLabelsRef.current.forEach(l => { try { map?.removeLayer(l) } catch {} })
      measureLabelsRef.current = []
      measurePointsRef.current = []
      if (pingChannelRef.current) {
        try { supabase.removeChannel(pingChannelRef.current) } catch {}
        pingChannelRef.current = null
      }
      if (viewShareChannelRef.current) {
        try { supabase.removeChannel(viewShareChannelRef.current) } catch {}
        viewShareChannelRef.current = null
      }
      if (pinsChannelRef.current) {
        try { supabase.removeChannel(pinsChannelRef.current) } catch {}
        pinsChannelRef.current = null
      }
      if (npcsMapChannelRef.current) {
        try { supabase.removeChannel(npcsMapChannelRef.current) } catch {}
        npcsMapChannelRef.current = null
      }
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove() } catch {}
        mapInstanceRef.current = null
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

  // Reload markers when the sibling CampaignPins sidebar mutates a pin. The
  // parent bumps pinRefreshKey; same-client broadcast doesn't reach this map's
  // channel, so without this a GM's "Show" wouldn't un-ghost the marker live.
  useEffect(() => {
    if (!pinRefreshKey) return  // 0 / undefined = initial, skip (loadPins already ran on mount)
    void loadPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinRefreshKey])

  // Shared geometry/font for every control in the top-right toolbar row.
  // Locks height + font so the buttons, the <select>, the search input,
  // and the Go button all line up - and gives the flex row predictable
  // sizing so it never wraps when measure-mode adds the travel picker.
  const toolbarCtrl: React.CSSProperties = {
    height: 28,
    boxSizing: 'border-box',
    padding: '0 10px',
    fontSize: '13px',
    fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.04em',
    borderRadius: '3px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    cursor: 'pointer',
  }

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', cursor: (placing || measureMode) ? 'crosshair' : '' }} />

      {/* Search + layer switcher - single right column (matches MapView).
          Every control in the top form row shares `toolbarCtrl` for
          geometry + font so heights match and the row never wraps,
          regardless of how many conditional buttons are showing
          (measure-mode travel-picker, GM-only Share View, etc.). */}
      <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 1000, display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '4px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexWrap: 'nowrap', gap: '4px' }}>
          {/* + Pin opens to all campaign members, not just the GM. RLS
              already permits members to INSERT into campaign_pins; the
              old isGM gate was UI-only. Player pins land revealed=false
              so the GM sees them in CampaignPins for review/reveal. */}
          <button type="button" onClick={() => { setPlacing(p => !p); setNewPin(null); setAttachments([]) }}
            title={isGM ? 'Drop a pin on the campaign map' : 'Suggest a pin - GM will review and reveal it'}
            style={{ ...toolbarCtrl, textTransform: 'uppercase', border: `1px solid ${placing ? '#2d5a1b' : '#3a3a3a'}`, background: placing ? '#1a2e10' : 'rgba(15,15,15,.85)', color: placing ? '#7fc458' : '#d4cfc9' }}>
            {placing ? '✕ Cancel' : '+ Pin'}
          </button>
          {/* Measure tool - toggle on, click two (or more) points to
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
                setMeasureLegs([])
                setMeasureTotalText('Click a point to start measuring…')
              }
            }}
            title={measureMode ? 'Stop measuring (Esc)' : 'Click two points to measure distance'}
            style={{ ...toolbarCtrl, textTransform: 'uppercase', border: `1px solid ${measureMode ? '#7ab3d4' : '#3a3a3a'}`, background: measureMode ? '#0f1a2e' : 'rgba(15,15,15,.85)', color: measureMode ? '#7ab3d4' : '#d4cfc9' }}>
            {measureMode ? '✕ Stop' : '📏 Measure'}
          </button>
          {/* Route planner - pick start, pick destination, OSRM returns
              real road geometry. Distinct from Measure (which is
              straight-line, multi-waypoint). Anyone can plot a route;
              local-only display just like Measure. Esc clears. */}
          <button type="button"
            onClick={() => {
              if (routeMode) {
                clearRoute()
                setRouteMode(false)
              } else {
                setRouteMode(true)
                setMeasureMode(false)
                clearMeasure()
                setPlacing(false)
                setNewPin(null)
                setRouteStatus('Click your starting point…')
              }
            }}
            title={routeMode ? 'Stop planning (Esc)' : 'Plot a road route from A to B'}
            style={{ ...toolbarCtrl, textTransform: 'uppercase', border: `1px solid ${routeMode ? '#a855f7' : '#3a3a3a'}`, background: routeMode ? '#1c0e30' : 'rgba(15,15,15,.85)', color: routeMode ? '#a855f7' : '#d4cfc9' }}>
            {routeMode ? '✕ Stop' : '🛣 Route'}
          </button>
          {/* Travel-mode picker reused for route ETA. Same dropdown as
              Measure, just visible when EITHER tool is active. */}
          {routeMode && (
            <select value={travelMode} onChange={e => setTravelMode(e.target.value as TravelMode)}
              title="How are the characters traveling? Affects the ETA shown for the route."
              style={{ ...toolbarCtrl, padding: '0 6px', textTransform: 'uppercase', border: '1px solid #a855f7', background: '#1c0e30', color: '#cce0f5', width: '175px' }}>
              {Object.entries(TRAVEL_MODES).map(([key, m]) => (
                <option key={key} value={key} style={{ background: '#0f0f0f', color: '#cce0f5' }}>
                  {m.emoji} {m.label} ({m.mph} mph)
                </option>
              ))}
            </select>
          )}
          {/* Travel-mode picker - appears only while measure mode is
              active. Switching mode recomputes every leg + the TOTAL
              row in place, including the on-map midpoint chips, via
              the recomputeMeasureLabels effect. Walking / Bicycle /
              Minnie defined in TRAVEL_MODES at the module top.
              Session-scoped (no localStorage). */}
          {measureMode && (
            <select value={travelMode} onChange={e => setTravelMode(e.target.value as TravelMode)}
              title="How are the characters traveling? Affects time-of-travel display."
              style={{ ...toolbarCtrl, padding: '0 6px', textTransform: 'uppercase', border: '1px solid #7ab3d4', background: '#0f1a2e', color: '#cce0f5', width: '175px' }}>
              {Object.entries(TRAVEL_MODES).map(([key, m]) => (
                <option key={key} value={key} style={{ background: '#0f0f0f', color: '#cce0f5' }}>
                  {m.emoji} {m.label} ({m.mph} mph)
                </option>
              ))}
            </select>
          )}
          {/* SHARE VIEW - GM-only. Snapshots the current map state
              (center, zoom, tile layer) and broadcasts to every other
              viewer of this campaign. Players' maps smoothly flyTo
              the location and swap to the matching tile layer.
              One-shot - not a continuous follow-mode. Flash green for
              ~1.5s after click so the GM has visual confirmation the
              broadcast went out. Added 2026-05-11. */}
          {isGM && (
            <button type="button"
              onClick={() => {
                const map = mapInstanceRef.current
                if (!map) return
                const c = map.getCenter()
                const z = map.getZoom()
                viewShareChannelRef.current?.send({
                  type: 'broadcast',
                  event: 'cm_view_share',
                  payload: { lat: c.lat, lng: c.lng, zoom: z, tile: mapLayerRef.current },
                })
                setShareFlash(true)
                window.setTimeout(() => setShareFlash(false), 1500)
              }}
              title="Push your current map view (center/zoom/tile) to every player"
              style={{ ...toolbarCtrl, textTransform: 'uppercase', border: `1px solid ${shareFlash ? '#2d5a1b' : '#3a3a3a'}`, background: shareFlash ? '#1a2e10' : 'rgba(15,15,15,.85)', color: shareFlash ? '#7fc458' : '#d4cfc9' }}>
              {shareFlash ? '✓ Shared' : '👁 Share View'}
            </button>
          )}
          {/* SHARE ROUTE - visible to all users when a route is plotted.
              Broadcasts coords, waypoints, distance, fallback flag, and travel
              mode so the rest of the group can see the same route. */}
          {routeDistanceMeters !== null && (
            <button type="button"
              onClick={() => {
                const coords = routeCoordsRef.current
                if (!coords) return
                viewShareChannelRef.current?.send({
                  type: 'broadcast',
                  event: 'cm_route_share',
                  payload: {
                    coords,
                    waypoints: routeWaypointsRef.current,
                    meters: routeDistanceMeters,
                    isFallback: routeIsFallback,
                    travelMode,
                  },
                })
                setRouteShareFlash(true)
                window.setTimeout(() => setRouteShareFlash(false), 1500)
              }}
              title="Push the current plotted route to every player"
              style={{ ...toolbarCtrl, textTransform: 'uppercase', border: `1px solid ${routeShareFlash ? '#3d1a5e' : '#3a3a3a'}`, background: routeShareFlash ? '#1a0c2e' : 'rgba(15,15,15,.85)', color: routeShareFlash ? '#a855f7' : '#d4cfc9' }}>
              {routeShareFlash ? '✓ Shared' : '🛣 Share Route'}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <input value={searchQuery} onChange={e => {
              setSearchQuery(e.target.value)
              setSearchMsg('')
              if (debounceRef.current) clearTimeout(debounceRef.current)
              // Don't fire the name geocoder while typing a coordinate paste.
              if (e.target.value.length >= 3 && !parseLatLng(e.target.value)) {
                debounceRef.current = setTimeout(async () => {
                  try {
                    setSuggestions(await searchNominatimUSFirst(e.target.value))
                  } catch { setSuggestions([]) }
                }, 300)
              } else { setSuggestions([]) }
            }} placeholder="Search address or paste lat, lng..."
              style={{ ...toolbarCtrl, justifyContent: 'flex-start', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', color: '#f5f2ee', width: '175px', outline: 'none', cursor: 'text', textTransform: 'none', letterSpacing: 'normal' }} />
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
            {searchMsg && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', padding: '6px 10px', fontSize: '13px', color: '#cce0f5', lineHeight: 1.4, zIndex: 1001 }}>
                {searchMsg}
              </div>
            )}
          </div>
          <button type="submit" disabled={searching}
            style={{ ...toolbarCtrl, textTransform: 'uppercase', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', color: '#f5f2ee' }}>
            {searching ? '...' : 'Go'}
          </button>
        </form>
        {/* Base-layer picker - one dropdown echoing the header Community
            menu (trigger + cascading hdr-btn--child list) instead of 7
            splayed buttons (Xero 2026-05-25 "too much"). */}
        <div ref={layerMenuRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setLayerMenuOpen(o => !o)}
            className={`hdr-btn${layerMenuOpen ? ' hdr-btn--active' : ''}`}
            style={{ ...toolbarCtrl, width: '120px', justifyContent: 'space-between', textTransform: 'uppercase', border: '1px solid #3a3a3a', background: 'rgba(15,15,15,.85)', color: '#d4cfc9' }}>
            <span>{LAYER_OPTIONS.find(l => l[0] === mapLayer)?.[1] ?? 'Map'}</span>
            <span style={{ marginLeft: 6 }}>▾</span>
          </button>
          {layerMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 1001 }}>
              {LAYER_OPTIONS.map(([layer, label], i) => {
                const active = mapLayer === layer
                return (
                  <button key={layer} type="button" onClick={() => { switchLayer(layer); setLayerMenuOpen(false) }}
                    className="hdr-btn hdr-btn--child"
                    style={{ ...toolbarCtrl, width: '120px', justifyContent: 'flex-start', textTransform: 'uppercase', border: `1px solid ${active ? '#c0392b' : '#3a3a3a'}`, background: active ? '#2a1210' : '#151515', color: active ? '#f5a89a' : '#d4cfc9', animationDelay: `${i * 0.03}s` }}>
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Placing mode banner */}
      {placing && !newPin && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(26,46,16,0.95)', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          Click on the map to place a pin
        </div>
      )}

      {/* Measure mode banner - per-leg breakdown stacked vertically,
          TOTAL row at the bottom. Each leg has its own line: "Leg N→N+1:
          <dist> · <time>". Tucked above the placing banner spot so the
          two never overlap (measure forces placing off anyway). */}
      {measureMode && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(15,30,46,0.95)', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', minWidth: '280px' }}>
          {measureLegs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <span>📏 {measureTotalText || 'Click a point to start measuring…'}</span>
              <span style={{ marginLeft: 'auto', color: '#7ab3d4', fontSize: '13px' }}>Esc to clear</span>
            </div>
          ) : (
            <>
              {measureLegs.map((leg, idx) => (
                <div key={idx} style={{ color: '#cce0f5', fontWeight: 400, letterSpacing: '.04em' }}>{leg}</div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #1a3a5c' }}>
                <span style={{ color: '#f5f2ee', fontWeight: 700 }}>📏 {measureTotalText}</span>
                <span style={{ marginLeft: 'auto', color: '#7ab3d4', fontSize: '13px' }}>Esc to clear</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Route planner banner - mirrors the measure-tool banner but
          orange-tinted to keep the two visually distinct. Shows the
          current step (click start, click destination, plotting, or
          final distance + ETA). */}
      {(routeMode || routeDistanceMeters !== null) && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(26,15,40,0.95)', border: '1px solid #a855f7', borderRadius: '3px', color: '#a855f7', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '12px', minWidth: '280px', pointerEvents: routeMode ? 'none' : 'auto' }}>
          <span>🛣 {routeLoading ? 'Plotting...' : (routeStatus || 'Click your starting point... (Shift-click to add waypoints; Alt+click a pin to snap)')}</span>
          {routeMode
            ? <span style={{ marginLeft: 'auto', color: '#a855f7', fontSize: '13px' }}>Esc to clear</span>
            : <button type="button" onClick={clearRoute} title="Clear route" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#a855f7', fontSize: '13px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>✕</button>
          }
        </div>
      )}

      {/* Player view-share / route-share chip. Stays visible until a new
          share replaces it. View-share: clicking flies back to the GM's
          last shared position (useful after the player has navigated away).
          Route-share: non-interactive label only (no coords to fly back to).
          GM never sees this; their own confirmation is on the Share button. */}
      {sharedToast && !isGM && (
        lastSharedView && sharedToast === 'GM shared a view' ? (
          <button
            onClick={() => {
              const map = mapInstanceRef.current
              if (!map || !lastSharedView) return
              if (lastSharedView.tile && lastSharedView.tile !== mapLayerRef.current) switchLayer(lastSharedView.tile)
              map.flyTo([lastSharedView.lat, lastSharedView.lng], lastSharedView.zoom, { duration: 0.6 })
            }}
            style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(15,30,46,0.95)', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            👁 GM shared a view
          </button>
        ) : (
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(15,30,46,0.95)', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', pointerEvents: 'none' }}>
            👁 {sharedToast}
          </div>
        )
      )}

      {/* Player pin submitted - 3-second confirmation that the pin
          reached the GM for review. Only fires for non-GM submitters. */}
      {submittedNotice && (
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '8px 16px', background: 'rgba(26,46,16,0.95)', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          ✓ Pin submitted - GM will review
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
            style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none', marginBottom: '6px', boxSizing: 'border-box' }} />
          <input value={pinForm.notes} onChange={e => setPinForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)..."
            style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none', marginBottom: '6px', boxSizing: 'border-box' }} />
          <select value={pinForm.category} onChange={e => setPinForm(f => ({ ...f, category: e.target.value }))}
            style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}>
            {PIN_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <label style={{ display: 'block', padding: '10px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#666', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', cursor: 'pointer', marginBottom: '8px' }}>
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
          <div style={{ fontSize: '13px', color: '#666', marginTop: '6px', fontFamily: 'Carlito, sans-serif' }}>
            Pin will be hidden from players until revealed in Assets.
          </div>
        </div>
      )}
    </div>
  )
}
