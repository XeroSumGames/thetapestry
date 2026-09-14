// Data layer for the /twilight2000-generator-log visitor dashboard. The
// /twilight2000-generator generator lives in its own repo
// (github.com/XeroSumGames/twilight2000-generator) and is served here via a proxy
// rewrite, so it runs on this origin; its visit beacon posts
// page='/twilight2000-generator' to the log-visit edge function -> visitor_logs. Reads
// are Thriver-gated by RLS (visitor_logs.ip_address is Thriver-only); the page
// also gates in the UI. Mirrors lib/data/2300ad-generator-log.ts.
import { db } from './db'

export interface Twilight2000Visit {
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

/** Recent visits to /twilight2000-generator, newest first. Capped; the page reports if hit. */
export async function loadTwilight2000Visits(limit = 5000): Promise<Twilight2000Visit[]> {
  const { data } = await db()
    .from('visitor_logs')
    .select('id, ip_address, ip_hash, city, region, country_code, referrer, is_ghost, user_id, created_at')
    .eq('page', '/twilight2000-generator')
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as unknown) as Twilight2000Visit[]) ?? []
}
