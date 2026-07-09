// Data layer for the /ape-log visitor dashboard. The /apegenerator page lives
// in its own repo (github.com/XeroSumGames/apegenerator) and is served here via
// a proxy rewrite, so it runs on this origin; its visit beacon posts
// page='/apegenerator' to the log-visit edge function -> visitor_logs. Reads are
// Thriver-gated by RLS (visitor_logs.ip_address is Thriver-only); the page also
// gates in the UI. NOTE (follow-up): aggregation is client-side over a 5000-row
// cap; a page-filtered visitor-aggregate RPC (see sql/visitor-map-rpc.sql) would
// remove the cap and the ~1.5MB fetch.
import { db } from './db'

export interface ApeVisit {
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

/** Recent visits to /apegenerator, newest first. Capped; the page reports if hit. */
export async function loadApeVisits(limit = 5000): Promise<ApeVisit[]> {
  const { data } = await db()
    .from('visitor_logs')
    .select('id, ip_address, ip_hash, city, region, country_code, referrer, is_ghost, user_id, created_at')
    .eq('page', '/apegenerator')
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data as unknown) as ApeVisit[]) ?? []
}
