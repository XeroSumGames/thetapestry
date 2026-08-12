// Data layer for the /traveller-generator-log visitor dashboard. The
// /traveller-generator generator lives in its own repo
// (github.com/XeroSumGames/traveller-generator) and is served here via a proxy
// rewrite, so it runs on this origin; its visit beacon posts
// page='/traveller-generator' to the log-visit edge function -> visitor_logs. Reads
// are Thriver-gated by RLS (visitor_logs.ip_address is Thriver-only); the page
// also gates in the UI. Mirrors lib/data/dredd-generator-log.ts.
import { db } from './db'

export interface TravellerVisit {
  id: string
  ip_address: string | null
  ip_hash: string | null
  city: string | null
  region: string | null
  country_code: string | null
  referrer: string | null
  is_ghost: boolean
  user_id: string | null
  created_at: string
}

/** Recent visits to /traveller-generator, newest first. Capped; the page reports if hit. */
export async function loadTravellerVisits(limit = 5000): Promise<TravellerVisit[]> {
  const { data } = await db()
    .from('visitor_logs')
    .select('id, ip_address, ip_hash, city, region, country_code, referrer, is_ghost, user_id, created_at')
    .eq('page', '/traveller-generator')
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as unknown) as TravellerVisit[]) ?? []
}
