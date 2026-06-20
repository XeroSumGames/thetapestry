import { db, type Insert, type Update } from './db'
import type { ModerationStatus } from './moderation'

export function insertPregen(row: Insert<'pregen_library'>) {
  return db().from('pregen_library').insert(row)
}

/** Official pregens, including all campaign associations for display/grouping. */
export function loadOfficialPregens() {
  return db()
    .from('pregen_library')
    .select('id, name, data, portrait_url, setting, campaign_id, pregen_campaign_map(campaign_id, campaigns:campaign_id(id, name))')
    .is('author_id', null)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: true }) as any
}

/** Official pregens assigned to a specific campaign via the join table (for story-page picker). */
export async function loadOfficialPregensByCampaign(campaignId: string) {
  const { data: links, error: linksErr } = await db()
    .from('pregen_campaign_map' as any)
    .select('pregen_id')
    .eq('campaign_id', campaignId)
  if (linksErr) return { data: null, error: linksErr }
  const ids = (links ?? []).map((l: any) => l.pregen_id) as string[]
  if (!ids.length) return { data: [] as any[], error: null }
  return db()
    .from('pregen_library')
    .select('id, name, data, portrait_url, setting, campaign_id')
    .in('id', ids)
    .is('author_id', null)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: true })
}

export function loadApprovedPregens(setting?: string) {
  let q = db()
    .from('pregen_library')
    .select('*, profiles!pregen_library_author_id_fkey(username)')
    .eq('moderation_status', 'approved')
    .not('author_id', 'is', null)
    .order('created_at', { ascending: false })
  if (setting) q = q.eq('setting', setting)
  return q
}

export function loadAuthorPregens(userId: string) {
  return db()
    .from('pregen_library')
    .select('id, name, setting, moderation_status, created_at, portrait_url')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
}

export function loadPregensByStatus(status: ModerationStatus) {
  return db()
    .from('pregen_library')
    .select('*')
    .eq('moderation_status', status)
    .order('created_at', { ascending: false })
}

export function loadPregenById(id: string) {
  return db().from('pregen_library').select('*').eq('id', id).single()
}

export function updatePregen(id: string, patch: Update<'pregen_library'>) {
  return db().from('pregen_library').update(patch).eq('id', id)
}

export function deletePregen(id: string) {
  return db().from('pregen_library').delete().eq('id', id)
}

/** Published modules for the story/module dropdown in the pregen editor. */
export function loadModulesForPregenDropdown() {
  return db()
    .from('modules')
    .select('name, parent_setting')
    .not('parent_setting', 'is', null)
    .neq('visibility', 'draft')
    .order('sort_order', { ascending: true })
}

/** All campaign links for a pregen (for the editor multi-select). */
export function loadPregenCampaignLinks(pregenId: string) {
  return db()
    .from('pregen_campaign_map' as any)
    .select('campaign_id')
    .eq('pregen_id', pregenId)
}

/** Replace all campaign associations for a pregen atomically. */
export async function syncPregenCampaignLinks(pregenId: string, campaignIds: string[]) {
  const client = db()
  const { error: delErr } = await client
    .from('pregen_campaign_map' as any)
    .delete()
    .eq('pregen_id', pregenId)
  if (delErr) return { error: delErr }
  if (!campaignIds.length) return { error: null }
  const rows = campaignIds.map(campaign_id => ({ pregen_id: pregenId, campaign_id }))
  const { error: insErr } = await client
    .from('pregen_campaign_map' as any)
    .insert(rows)
  return { error: insErr }
}

/** Approved pregens linked to a campaign via the join table, for module snapshot capture. */
export async function loadPregensByCampaignForSnapshot(campaignId: string) {
  const { data: links, error: linksErr } = await db()
    .from('pregen_campaign_map' as any)
    .select('pregen_id')
    .eq('campaign_id', campaignId)
  if (linksErr) return { data: null, error: linksErr }
  const ids = (links ?? []).map((l: any) => l.pregen_id) as string[]
  if (!ids.length) return { data: [] as any[], error: null }
  return db()
    .from('pregen_library')
    .select('id, name, data, portrait_url')
    .in('id', ids)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: true })
}

/** Stamp module_id on pregens linked to a campaign via the join table (called after publish). */
export async function stampModuleIdOnPregens(campaignId: string, moduleId: string) {
  const { data: links } = await db()
    .from('pregen_campaign_map' as any)
    .select('pregen_id')
    .eq('campaign_id', campaignId)
  const ids = (links ?? []).map((l: any) => l.pregen_id) as string[]
  if (!ids.length) return { data: null, error: null }
  return db()
    .from('pregen_library')
    .update({ module_id: moduleId } as any)
    .in('id', ids)
    .eq('moderation_status', 'approved')
}

/** Insert pregens cloned from a module snapshot into pregen_library. */
export function insertClonedPregens(rows: Array<{
  campaign_id: string
  module_id: string
  name: string
  data: any
  portrait_url: string | null
  author_id: null
  moderation_status: string
  approved_at: string
}>) {
  return db().from('pregen_library').insert(rows as any)
}
