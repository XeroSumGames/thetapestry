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
