// Data layer for the /2300ad-generator-log visitor dashboard. The
// /2300ad-generator generator lives in its own repo
// (github.com/XeroSumGames/2300ad-generator) and is served here via a proxy
// rewrite, so it runs on this origin; its visit beacon posts
// page='/2300ad-generator' to the log-visit edge function -> visitor_logs. Reads
// are Thriver-gated by RLS (visitor_logs.ip_address is Thriver-only); the page
// also gates in the UI. Mirrors lib/data/dredd-generator-log.ts.
import { db } from './db'

export interface AD2300Visit {
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

/** Recent visits to /2300ad-generator, newest first. Capped; the page reports if hit. */
export async function loadAD2300Visits(limit = 5000): Promise<AD2300Visit[]> {
  const { data } = await db()
    .from('visitor_logs')
    .select('id, ip_address, ip_hash, city, region, country_code, referrer, is_ghost, user_id, created_at')
    .eq('page', '/2300ad-generator')
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as unknown) as AD2300Visit[]) ?? []
}
