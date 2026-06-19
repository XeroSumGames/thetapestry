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
  if (!(story as any)?.campaign_id) return { campaignId: null, setting: null }
  const { data: camp } = await db().from('campaigns').select('setting').eq('id', (story as any).campaign_id).single()
  return { campaignId: (story as any).campaign_id, setting: (camp as any)?.setting ?? null }
}

/** Assign a character to a campaign member. */
export function assignMemberCharacter(campaignId: string, userId: string, charId: string) {
  return db().from('campaign_members' as any).update({ character_id: charId }).eq('campaign_id', campaignId).eq('user_id', userId)
}

/** Get a user's profile role. */
export function getUserRole(userId: string) {
  return db().from('profiles' as any).select('role').eq('id', userId).single()
}

/**
 * Fetch the cover_image_url from the first active module subscription for
 * a campaign. Used to inherit the /rumors module's cover image into the
 * story page hero when the campaign has no custom cover of its own.
 */
export async function getCampaignModuleCover(campaignId: string): Promise<string | null> {
  const { data } = await db()
    .from('module_subscriptions' as any)
    .select('modules:module_id(cover_image_url)')
    .eq('campaign_id', campaignId)
    .eq('status', 'active')
    .maybeSingle()
  const modRow = (data as any)?.modules
  return (Array.isArray(modRow) ? modRow[0] : modRow)?.cover_image_url ?? null
}

/**
 * Upload a cover image file to the campaign-covers bucket and persist the
 * public URL to campaigns.cover_image_url. Returns the public URL on
 * success or an error string on failure.
 */
export async function uploadCampaignCover(
  campaignId: string,
  file: File,
  contentType: string,
): Promise<{ url: string } | { error: string }> {
  const client = db()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${campaignId}/cover.${ext}`
  const { error: upErr } = await (client as any).storage
    .from('campaign-covers')
    .upload(path, file, { upsert: true, contentType })
  if (upErr) return { error: (upErr as any).message }
  const { data: pub } = (client as any).storage.from('campaign-covers').getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}`
  const { error: dbErr } = await client.from('campaigns').update({ cover_image_url: url } as any).eq('id', campaignId)
  if (dbErr) return { error: dbErr.message }
  return { url }
}

/** Clear campaigns.cover_image_url (leaves the file in storage, just un-references it). */
export async function removeCampaignCover(campaignId: string): Promise<{ error?: string }> {
  const { error } = await db().from('campaigns').update({ cover_image_url: null } as any).eq('id', campaignId)
  return error ? { error: error.message } : {}
}
