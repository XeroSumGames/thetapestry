// Communities Phase E — World Event CMod propagation helper.
//
// Distemper Timeline pins (map_pins.category='world_event') with a
// non-null cmod_impact and cmod_active=true apply a CMod to Weekly
// Morale Checks for every community within cmod_radius_km of the pin.
// See sql/map-pins-world-event-cmod.sql + spec-communities.md §13 #1.
//
// We don't have PostGIS or earthdistance enabled, so the proximity
// filter is a haversine done client-side. Active events are typically
// a handful at most, so fetching all and filtering in JS is cheaper
// than adding a Postgres extension dependency.

import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_RADIUS_KM = 500
const EARTH_RADIUS_KM = 6371

export interface ActiveWorldEvent {
  pinId: string
  title: string
  label: string         // cmod_label || title
  cmod: number          // signed integer — sums into moraleSlotsTotal
  distanceKm: number    // distance from the community's Homestead
  radiusKm: number      // the event's reach
  pinLat: number
  pinLng: number
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

// Fetch every active timeline pin and filter to those whose effect
// reaches the given location. Sorted by distance ascending so the
// closest / most acute events appear first in the Morale modal.
export async function getActiveWorldEventsNearLocation(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
): Promise<ActiveWorldEvent[]> {
  const { data, error } = await supabase
    .from('map_pins')
    .select('id, title, lat, lng, cmod_impact, cmod_radius_km, cmod_label')
    .eq('category', 'world_event')
    .eq('cmod_active', true)
    .not('cmod_impact', 'is', null)
  if (error || !data) return []

  const results: ActiveWorldEvent[] = []
  for (const p of data as any[]) {
    if (p.lat == null || p.lng == null || p.cmod_impact == null) continue
    const radiusKm = p.cmod_radius_km ?? DEFAULT_RADIUS_KM
    const distanceKm = haversineKm(lat, lng, p.lat, p.lng)
    if (distanceKm > radiusKm) continue
    results.push({
      pinId: p.id,
      title: p.title,
      label: p.cmod_label || p.title,
      cmod: p.cmod_impact,
      distanceKm,
      radiusKm,
      pinLat: p.lat,
      pinLng: p.lng,
    })
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm)
  return results
}

// Resolve a community's Homestead coordinates by following its
// homestead_pin_id into campaign_pins. Returns null if the community
// has no Homestead pin, or the pin is missing coords. Without coords
// we can't filter events by proximity, so the caller should treat
// null as "no world events apply this week."
export async function getCommunityHomesteadCoords(
  supabase: SupabaseClient,
  communityId: string,
): Promise<{ lat: number; lng: number } | null> {
  const { data: community } = await supabase
    .from('communities')
    .select('homestead_pin_id')
    .eq('id', communityId)
    .maybeSingle()
  const pinId = (community as any)?.homestead_pin_id
  if (!pinId) return null
  const { data: pin } = await supabase
    .from('campaign_pins')
    .select('lat, lng')
    .eq('id', pinId)
    .maybeSingle()
  const p = pin as any
  if (!p || p.lat == null || p.lng == null) return null
  return { lat: p.lat, lng: p.lng }
}
