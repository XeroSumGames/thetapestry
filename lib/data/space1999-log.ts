// Data layer for the /space1999-log visitor dashboard. The /space1999 generator
// lives in its own repo (github.com/XeroSumGames/space1999generator) and is
// served here via a proxy rewrite, so it runs on this origin; its visit beacon
// posts page='/space1999' to the log-visit edge function -> visitor_logs. Reads
// are Thriver-gated by RLS (visitor_logs.ip_address is Thriver-only); the page
// also gates in the UI. Mirrors lib/data/ape-log.ts.
import { db } from './db'

export interface Space1999Visit {
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

/** Recent visits to /space1999, newest first. Capped; the page reports if hit. */
export async function loadSpace1999Visits(limit = 5000): Promise<Space1999Visit[]> {
  const { data } = await db()
    .from('visitor_logs')
    .select('id, ip_address, ip_hash, city, region, country_code, referrer, is_ghost, user_id, created_at')
    .eq('page', '/space1999')
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as unknown) as Space1999Visit[]) ?? []
}
