// Data layer for the /ape-log visitor dashboard (visits to the static
// /apegenerator page, logged via the beacon in public/apegenerator/index.html
// -> the log-visit edge function -> visitor_logs). Reads are Thriver-gated by
// RLS (visitor_logs.ip_address is Thriver-only); the page also gates in the UI.
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
