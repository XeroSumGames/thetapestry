// Repository: profiles.
//
// Reads against `profiles` were scattered across other repos (map, moderation,
// campaigns, vehicle, feature-checklist each hold their own), which is fine for
// a query that belongs to that feature. This module is for profile reads that
// belong to the SHELL rather than to any one feature.
//
// New queries live here rather than inline in a page because check-arch counts
// inline supabase reads outside lib/data repo-wide and strictly, and that count
// currently sits at its baseline with no headroom - so an inline read in a
// component fails the pre-commit gate outright. Inside lib/data it is exempt.

import { db } from './db'

export interface SiteMenuProfile {
  username: string
  role: string | null
  /**
   * Not used by the extracted menu - the old sidebar's bottom account row is
   * the only thing that renders it. Selected anyway, deliberately: see the
   * note on siteMenuProfile about this being Sidebar's replacement rather
   * than a second reader.
   */
  avatarUrl: string | null
}

/**
 * The identity the site menu renders: username and role.
 *
 * SHAPED AS SIDEBAR'S REPLACEMENT, NOT AS A SECOND READER. It selects exactly
 * the fields Sidebar's own inline profile query selects - including avatar_url,
 * which only Sidebar's bottom account row renders and the extracted menu never
 * shows. Pulling one unused column is the price of making the next step a
 * deletion rather than a reconciliation of two designs.
 *
 * That next step matters for more than tidiness. Sidebar currently holds THREE
 * inline reads (profiles, the pending-rumour count, and the profiles-by-id
 * lookup for presence names). Moving them behind helpers REMOVES three from the
 * inline-read count, which sits at exactly its baseline with zero headroom - so
 * it is what buys the next lane room to write a query at all.
 *
 * Returns empty rather than throwing when there is no profile row: that is the
 * ghost case, and the menu already renders a "You are a Ghost" state off an
 * empty username.
 */
export async function siteMenuProfile(userId: string): Promise<{ data: SiteMenuProfile; error: any | null }> {
  const { data, error } = await db()
    .from('profiles')
    .select('username, role, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  const row = data as { username?: string | null; role?: string | null; avatar_url?: string | null } | null
  return {
    data: {
      username: row?.username ?? '',
      role: row?.role ?? null,
      avatarUrl: row?.avatar_url ?? null,
    },
    error: error ?? null,
  }
}
