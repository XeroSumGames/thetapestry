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
}

/**
 * The identity the site menu renders: username and role.
 *
 * Deliberately NOT selecting avatar_url. The old sidebar's single profile query
 * fetches username + role + avatar_url because its bottom account row needs the
 * avatar; the extracted menu (components/SiteMenu.tsx) never shows it, so the
 * frame has no reason to pull it.
 *
 * Returns empty rather than throwing when there is no profile row: that is the
 * ghost case, and the menu already renders a "You are a Ghost" state off an
 * empty username.
 */
export async function siteMenuProfile(userId: string): Promise<{ data: SiteMenuProfile; error: any | null }> {
  const { data, error } = await db()
    .from('profiles')
    .select('username, role')
    .eq('id', userId)
    .maybeSingle()
  const row = data as { username?: string | null; role?: string | null } | null
  return {
    data: { username: row?.username ?? '', role: row?.role ?? null },
    error: error ?? null,
  }
}
