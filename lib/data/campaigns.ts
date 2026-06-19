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

/** Count of GM-owned campaigns for a user. Returns {count, error}. */
export function countGmCampaigns(userId: string) {
  return db().from('campaigns').select('id', { count: 'exact', head: true }).eq('gm_user_id', userId)
}

/** Get the campaign_id + setting for a given story. Returns { campaignId, setting }. */
export async function getStoryCampaignSetting(storyId: string): Promise<{ campaignId: string | null; setting: string | null }> {
  const { data: story } = await db().from('stories' as any).select('campaign_id').eq('id', storyId).single()
  if (!story?.campaign_id) return { campaignId: null, setting: null }
  const { data: camp } = await db().from('campaigns').select('setting').eq('id', story.campaign_id).single()
  return { campaignId: story.campaign_id, setting: (camp as any)?.setting ?? null }
}

/** Assign a character to a campaign member. */
export function assignMemberCharacter(campaignId: string, userId: string, charId: string) {
  return db().from('campaign_members' as any).update({ character_id: charId }).eq('campaign_id', campaignId).eq('user_id', userId)
}

/** Get a user's profile role. */
export function getUserRole(userId: string) {
  return db().from('profiles' as any).select('role').eq('id', userId).single()
}
