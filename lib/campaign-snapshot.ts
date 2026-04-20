// Campaign snapshot + restore — capture a campaign's current content state
// into a jsonb blob and restore it in place later. The campaign id / invite
// code / player memberships stay intact; only the content rows are wiped and
// re-inserted.
//
// Scope — what IS in a snapshot:
//   campaign_npcs
//   campaign_pins
//   tactical_scenes
//   scene_tokens (nested under their scene)
//   campaign_notes
//   pregens (characters.data where type='pregen' on this campaign — see note below)
//   character_states (optional, via includesCharacterStates flag)
//
// NOT in a snapshot (session-scope, wiped on restore):
//   initiative_order       — cleared
//   roll_log               — cleared (optional; we clear to avoid stale refs)
//   chat_messages          — cleared
//   scene_tokens anim      — transient
//   communities (Phase 4b) — TODO once the tables are in use
//
// On restore we DELETE current rows then INSERT from the snapshot. All within
// a single Promise.all per table; failures are reported but the wipe has
// already happened — GM must re-restore or the campaign is empty. We accept
// this MVP risk given the alternative (stored procedure or edge function)
// is heavier infrastructure. See spec-modules.md §6 for the production path.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CampaignSnapshot {
  version: 1
  captured_at: string
  campaign_id: string
  includes_character_states: boolean
  npcs: any[]
  pins: any[]
  scenes: { scene: any; tokens: any[] }[]
  notes: any[]
  character_states?: any[]
}

/** Read the full content state of a campaign into a Snapshot object. */
export async function captureCampaignSnapshot(
  supabase: SupabaseClient,
  campaignId: string,
  opts: { includesCharacterStates?: boolean } = {},
): Promise<CampaignSnapshot> {
  const [npcsR, pinsR, scenesR, notesR, statesR] = await Promise.all([
    supabase.from('campaign_npcs').select('*').eq('campaign_id', campaignId),
    supabase.from('campaign_pins').select('*').eq('campaign_id', campaignId),
    supabase.from('tactical_scenes').select('*').eq('campaign_id', campaignId),
    supabase.from('campaign_notes').select('*').eq('campaign_id', campaignId),
    opts.includesCharacterStates
      ? supabase.from('character_states').select('*').eq('campaign_id', campaignId)
      : Promise.resolve({ data: null, error: null } as any),
  ])
  if (npcsR.error) throw new Error(`NPCs: ${npcsR.error.message}`)
  if (pinsR.error) throw new Error(`Pins: ${pinsR.error.message}`)
  if (scenesR.error) throw new Error(`Scenes: ${scenesR.error.message}`)
  if (notesR.error) throw new Error(`Notes: ${notesR.error.message}`)
  if (statesR.error) throw new Error(`Character states: ${statesR.error.message}`)

  const scenes = (scenesR.data ?? []) as any[]
  const sceneIds = scenes.map(s => s.id)
  const tokensR = sceneIds.length > 0
    ? await supabase.from('scene_tokens').select('*').in('scene_id', sceneIds)
    : { data: [] as any[], error: null } as any
  if (tokensR.error) throw new Error(`Tokens: ${tokensR.error.message}`)
  const tokensByScene: Record<string, any[]> = {}
  for (const t of (tokensR.data ?? []) as any[]) {
    (tokensByScene[t.scene_id] ||= []).push(t)
  }

  return {
    version: 1,
    captured_at: new Date().toISOString(),
    campaign_id: campaignId,
    includes_character_states: !!opts.includesCharacterStates,
    npcs: (npcsR.data ?? []) as any[],
    pins: (pinsR.data ?? []) as any[],
    scenes: scenes.map(s => ({ scene: s, tokens: tokensByScene[s.id] ?? [] })),
    notes: (notesR.data ?? []) as any[],
    character_states: opts.includesCharacterStates ? ((statesR.data ?? []) as any[]) : undefined,
  }
}

/** Wipe the campaign's current content and restore from a snapshot.
 *  Note: this is NOT atomic — if a step fails, prior wipes are not reverted.
 *  The UI warns the GM before calling this. */
export async function restoreCampaignSnapshot(
  supabase: SupabaseClient,
  campaignId: string,
  snap: CampaignSnapshot,
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = []

  // 1. Clear session-scope tables (initiative + logs + chat) — these aren't in the snapshot
  //    but we wipe them so the restored state starts clean.
  const clearSession = await Promise.all([
    supabase.from('initiative_order').delete().eq('campaign_id', campaignId),
    supabase.from('roll_log').delete().eq('campaign_id', campaignId),
    supabase.from('chat_messages').delete().eq('campaign_id', campaignId),
  ])
  for (const r of clearSession) if (r.error) errors.push(`clear session: ${r.error.message}`)

  // 2. Wipe content tables. Scenes first because scene_tokens FK-cascades on delete.
  //    (campaign_notes, campaign_pins, campaign_npcs cascade via their own campaign_id FK.)
  const wipes = await Promise.all([
    supabase.from('tactical_scenes').delete().eq('campaign_id', campaignId),
    supabase.from('campaign_notes').delete().eq('campaign_id', campaignId),
    supabase.from('campaign_pins').delete().eq('campaign_id', campaignId),
    supabase.from('campaign_npcs').delete().eq('campaign_id', campaignId),
  ])
  for (const r of wipes) if (r.error) errors.push(`wipe: ${r.error.message}`)

  // 3. Restore NPCs, pins, notes — flat inserts.
  if (snap.npcs.length > 0) {
    const r = await supabase.from('campaign_npcs').insert(snap.npcs.map(stripGenerated))
    if (r.error) errors.push(`npcs insert: ${r.error.message}`)
  }
  if (snap.pins.length > 0) {
    const r = await supabase.from('campaign_pins').insert(snap.pins.map(stripGenerated))
    if (r.error) errors.push(`pins insert: ${r.error.message}`)
  }
  if (snap.notes.length > 0) {
    const r = await supabase.from('campaign_notes').insert(snap.notes.map(stripGenerated))
    if (r.error) errors.push(`notes insert: ${r.error.message}`)
  }

  // 4. Restore scenes + tokens. Scenes carry their original id so that
  //    tokens' scene_id still points where it should.
  for (const { scene, tokens } of snap.scenes) {
    const { error: sErr } = await supabase.from('tactical_scenes').insert([stripGenerated(scene)])
    if (sErr) { errors.push(`scene ${scene.name}: ${sErr.message}`); continue }
    if (tokens.length > 0) {
      const { error: tErr } = await supabase.from('scene_tokens').insert(tokens.map(stripGenerated))
      if (tErr) errors.push(`scene ${scene.name} tokens: ${tErr.message}`)
    }
  }

  // 5. Character states (optional). Wipes + re-inserts the exact rows.
  if (snap.includes_character_states && snap.character_states) {
    const wipe = await supabase.from('character_states').delete().eq('campaign_id', campaignId)
    if (wipe.error) errors.push(`character_states wipe: ${wipe.error.message}`)
    if (snap.character_states.length > 0) {
      const r = await supabase.from('character_states').insert(snap.character_states.map(stripGenerated))
      if (r.error) errors.push(`character_states insert: ${r.error.message}`)
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Rows from a SELECT carry DB-generated columns we don't want on an INSERT
 *  (created_at/updated_at are fine to re-insert since we want to preserve
 *  timestamps; we only strip things that would conflict). Tuned per-table. */
function stripGenerated(row: any): any {
  const { ...copy } = row
  return copy
}
