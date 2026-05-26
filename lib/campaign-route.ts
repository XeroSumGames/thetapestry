// lib/campaign-route.ts
// Pure helpers for the campaign-map route tool (multi-waypoint plotting).

export interface RoutePoint { lat: number; lng: number }

// Build the coordinate path for an OSRM route request. OSRM expects
// `lon,lat` pairs (NOT lat,lon) separated by ';' - getting the order wrong
// silently routes to the wrong place (the lat/lng swap footgun). One pair
// per waypoint, in click order, so the route runs A -> B -> C -> ...
export function osrmCoordsParam(points: RoutePoint[]): string {
  return points.map(p => `${p.lng},${p.lat}`).join(';')
}

// The marker letter for the Nth dropped waypoint: 0 -> 'A', 1 -> 'B', ...
// Falls back to a number past 'Z' (26 waypoints is already absurd for a
// tabletop route, but never render a stray control character).
export function waypointLabel(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

// Detect a pasted "lat, lng" (or "lat lng") coordinate pair so the map search
// can fly there directly - the escape hatch for addresses our OSM geocoder
// can't find (rural / Forest-Service addresses Google has but Nominatim
// doesn't). Accepts comma- or space-separated, validates WGS84 ranges.
// Returns null for anything that isn't a clean coordinate pair (so normal
// place-name searches fall through to the geocoder).
export function parseLatLng(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
