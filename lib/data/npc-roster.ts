// Repository: the NPC roster panel (components/NpcRoster.tsx) queries
// (grand re-architecture Phase 5).
//
// NpcRoster hand-rolled ~46 inline `supabase.from(...)` DB calls + 2 storage
// calls across 8 tables (community_members, campaign_npcs, scene_tokens,
// initiative_order, npc_relationships, portrait_bank, campaign_portrait_usage,
// world_npcs). This seam centralises them as drop-in builders: each returns
// the raw typed builder so `const { data, error } = await fn(args)` is a
// one-line swap and the call-site orchestration stays put. Every
// .eq/.in/.is/.order filter is preserved verbatim; deletes stay scoped.
//
// campaign_npcs single-id update + insert reuse lib/data/campaign-npcs.ts
// (updateCampaignNpc / insertCampaignNpcs); the roster-specific shapes
// (.in bulk, select-max, the other 7 tables) live here.

import { db, type Insert, type Update } from './db'

// --- community_members ------------------------------------------------------

/** Community memberships for a set of NPCs (joins the community name). */
export function communityMembersForNpcs(npcIds: string[]) {
  return db().from('community_members')
    .select('npc_id, community_id, communities(name)')
    .in('npc_id', npcIds)
    .is('left_at', null)
    .not('npc_id', 'is', null)
}

// --- campaign_npcs (roster-specific shapes) ---------------------------------

/** All NPCs for the roster, sorted by sort_order then created_at. */
export function npcsForRoster(campaignId: string) {
  return db().from('campaign_npcs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
}

/** The current max sort_order in the campaign (next-sort computation). */
export function maxNpcSortOrder(campaignId: string) {
  return db().from('campaign_npcs')
    .select('sort_order')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
}

export function deleteCampaignNpc(id: string) {
  return db().from('campaign_npcs').delete().eq('id', id)
}

/** Bulk folder assignment. */
export function setNpcsFolder(ids: string[], folder: string) {
  return db().from('campaign_npcs').update({ folder }).in('id', ids)
}

/** Bulk hidden-from-players toggle. */
export function setNpcsHidden(ids: string[], hidden: boolean) {
  return db().from('campaign_npcs').update({ hidden_from_players: hidden }).in('id', ids)
}

// --- scene_tokens (roster-driven) -------------------------------------------

export function updateSceneTokenColorByNpc(npcId: string, color: string) {
  return db().from('scene_tokens').update({ color }).eq('npc_id', npcId)
}
export function deleteSceneTokensByNpc(npcId: string) {
  return db().from('scene_tokens').delete().eq('npc_id', npcId)
}
export function setSceneTokensVisibleByNpcs(npcIds: string[], visible: boolean) {
  return db().from('scene_tokens').update({ is_visible: visible }).in('npc_id', npcIds)
}
export function setSceneTokenVisibleByNpc(npcId: string, visible: boolean) {
  return db().from('scene_tokens').update({ is_visible: visible }).eq('npc_id', npcId)
}

// --- initiative_order -------------------------------------------------------

export function deleteInitiativeByNpc(npcId: string) {
  return db().from('initiative_order').delete().eq('npc_id', npcId)
}

// --- npc_relationships ------------------------------------------------------

/** All relationship rows for one NPC (the relationship modal). */
export function relationshipsForNpc(npcId: string) {
  return db().from('npc_relationships').select('*').eq('npc_id', npcId)
}
export function updateRelationship(id: string, patch: Update<'npc_relationships'>) {
  return db().from('npc_relationships').update(patch).eq('id', id)
}
/** Insert one or many relationship rows (callers build payloads dynamically). */
export function insertRelationships(rows: Insert<'npc_relationships'> | Insert<'npc_relationships'>[]) {
  return db().from('npc_relationships').insert(rows as any)
}
/** NPC ids that already have a revealed relationship (reveal-all gate). */
export function revealedRelationshipNpcIds(npcIds: string[]) {
  return db().from('npc_relationships').select('npc_id').eq('revealed', true).in('npc_id', npcIds)
}
/** Existing relationship rows for a set of NPCs (reveal-all dedupe). */
export function existingRelationshipsByNpcs(npcIds: string[]) {
  return db().from('npc_relationships').select('id, npc_id, character_id').in('npc_id', npcIds)
}
/** Reveal a set of relationships by row id (reveal-all). */
export function revealRelationshipsByIds(ids: string[]) {
  return db().from('npc_relationships').update({ revealed: true, reveal_level: 'name_portrait' }).in('id', ids)
}
/** Hide all relationships for a set of NPCs (hide-all). */
export function hideRelationshipsByNpcs(npcIds: string[]) {
  return db().from('npc_relationships').update({ revealed: false, reveal_level: null }).in('npc_id', npcIds)
}
/** One relationship row for an NPC+character pair (inline reveal toggle). */
export function findRelationship(npcId: string, characterId: string) {
  return db().from('npc_relationships').select('id').eq('npc_id', npcId).eq('character_id', characterId).maybeSingle()
}

// --- portrait_bank / campaign_portrait_usage --------------------------------

export function portraitBankByGender(gender: string) {
  return db().from('portrait_bank').select('url_256').eq('gender', gender).eq('is_private', false)
}
export function portraitUsage(campaignId: string, gender: string) {
  return db().from('campaign_portrait_usage').select('portrait_url').eq('campaign_id', campaignId).eq('gender', gender)
}
export function deletePortraitUsage(campaignId: string, gender: string) {
  return db().from('campaign_portrait_usage').delete().eq('campaign_id', campaignId).eq('gender', gender)
}
export function insertPortraitUsage(campaignId: string, portraitUrl: string, gender: string) {
  return db().from('campaign_portrait_usage').insert({ campaign_id: campaignId, portrait_url: portraitUrl, gender })
}

// Pick one portrait per NPC in a batch, same dedup logic as single-NPC
// GENERATE: unused-first within the campaign, cycle-resets when exhausted,
// no repeat within the batch itself. Returns one URL per entry (null if the
// bank is empty for that gender). Logs all picks to campaign_portrait_usage
// in a single insert.
export async function pickPortraitsForBatch(
  campaignId: string,
  genders: Array<'man' | 'woman'>,
): Promise<Array<string | null>> {
  if (genders.length === 0) return []
  try {
    const [manBank, womanBank, manUsed, womanUsed] = await Promise.all([
      portraitBankByGender('man'),
      portraitBankByGender('woman'),
      portraitUsage(campaignId, 'man'),
      portraitUsage(campaignId, 'woman'),
    ])
    const bankMap: Record<string, string[]> = {
      man: (manBank.data ?? []).map((r: any) => r.url_256),
      woman: (womanBank.data ?? []).map((r: any) => r.url_256),
    }
    const usedMap: Record<string, Set<string>> = {
      man: new Set((manUsed.data ?? []).map((r: any) => r.portrait_url)),
      woman: new Set((womanUsed.data ?? []).map((r: any) => r.portrait_url)),
    }
    const resetGenders = new Set<string>()
    const batchPicked = new Set<string>()
    const results: Array<string | null> = []
    const toInsert: Array<{ campaign_id: string; portrait_url: string; gender: string }> = []

    for (const gender of genders) {
      const bank = bankMap[gender]
      if (!bank || bank.length === 0) { results.push(null); continue }
      const used = usedMap[gender]
      let candidates = bank.filter(u => !used.has(u) && !batchPicked.has(u))
      if (candidates.length === 0) {
        // Cycle exhausted - reset this gender and start fresh
        resetGenders.add(gender)
        used.clear()
        candidates = bank.filter(u => !batchPicked.has(u))
        if (candidates.length === 0) candidates = bank
      }
      const url = candidates[Math.floor(Math.random() * candidates.length)]
      results.push(url)
      batchPicked.add(url)
      used.add(url)
      toInsert.push({ campaign_id: campaignId, portrait_url: url, gender })
    }

    // Reset exhausted genders first, then log all new picks
    await Promise.all([...resetGenders].map(g => deletePortraitUsage(campaignId, g)))
    if (toInsert.length > 0) {
      await db().from('campaign_portrait_usage').insert(toInsert)
    }
    return results
  } catch {
    return genders.map(() => null)
  }
}

// --- world_npcs (publish / import marketplace) ------------------------------

/** Source campaign-npc ids already published to the world (dedupe publish). */
export function publishedWorldNpcSourceIds() {
  return db().from('world_npcs').select('source_campaign_npc_id').not('source_campaign_npc_id', 'is', null)
}
export function insertWorldNpc(row: Insert<'world_npcs'>) {
  return db().from('world_npcs').insert(row)
}
/** Approved world NPCs for the import browser, most-imported first. */
export function approvedWorldNpcs() {
  return db().from('world_npcs').select('*').eq('status', 'approved').order('import_count', { ascending: false })
}
export function bumpWorldNpcImportCount(id: string, current: number) {
  return db().from('world_npcs').update({ import_count: current + 1 }).eq('id', id)
}

// --- Storage (campaign-npcs portrait bucket) --------------------------------

const NPC_BUCKET = 'campaign-npcs'

export function uploadNpcPortrait(path: string, blob: Blob) {
  return db().storage.from(NPC_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
}
export function npcPortraitPublicUrl(path: string) {
  return db().storage.from(NPC_BUCKET).getPublicUrl(path)
}
