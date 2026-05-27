// Repository: campaigns (grand re-architecture Phase 1b, lib/data seam).
//
// Typed seam for reads against the `campaigns` table, so call sites stop
// hand-rolling `supabase.from('campaigns')...`. Same convention as the other
// repos: return the raw Supabase `{ data, error }` result, just TYPED, so the
// call site stays a drop-in.

import { db } from './db'

/**
 * Just the in-game clock for a campaign. Drop-in for
 * `supabase.from('campaigns').select('clock').eq('id', id).maybeSingle()`.
 * Used by the catch-up reload on the campaign sheet.
 */
export function getCampaignClock(id: string) {
  return db().from('campaigns').select('clock').eq('id', id).maybeSingle()
}
