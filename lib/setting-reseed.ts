// setting-reseed.ts
// Compute + apply an idempotent re-seed of a campaign's setting content.
// Used by /tools/reseed-campaign — when the canonical seed configs evolve
// (new pins, NPCs, tactical scenes, handouts), existing campaigns can pull
// the missing items in without losing GM customizations.
//
// Diff strategy is "match by name/title; insert what's missing." This is
// the natural-key approach the seed configs already use (no UUIDs in the
// .ts files). The known fragility: if a GM renames a seeded item, the
// reseed sees the seeded version as missing and re-inserts a duplicate.
// The /tools/reseed-campaign UI mitigates by showing a preview-then-confirm
// step so the GM can spot duplicates before committing. A future
// `seed_source` column would be the bulletproof fix.

import type { SupabaseClient } from '@supabase/supabase-js'
import { SETTING_PINS } from './setting-pins'
import { SETTING_NPCS } from './setting-npcs'
import { SETTING_SCENES } from './setting-scenes'
import { SETTING_HANDOUTS } from './setting-handouts'

export interface ReseedPlan {
  campaignId: string
  setting: string
  pinsToAdd:    Array<{ name: string; lat: number; lng: number; notes: string; category: string }>
  npcsToAdd:    Array<{ name: string; pin_title?: string; row: any }>
  scenesToAdd:  Array<{ name: string; row: any }>
  handoutsToAdd: Array<{ title: string; content: string; row: any }>
  // Items that already existed and were skipped, surfaced for the
  // preview UI so the GM sees the full picture.
  pinsSkipped: number
  npcsSkipped: number
  scenesSkipped: number
  handoutsSkipped: number
}

// Resolve seed source: DB seeds first, TS constants as fallback. Mirrors
// the same precedence the create-campaign flow uses in
// app/stories/new/page.tsx so reseeds match what new campaigns get.
async function resolveSeeds(supabase: SupabaseClient, setting: string): Promise<{
  pins: any[]
  npcs: any[]
  scenes: any[]
  handouts: any[]
}> {
  const [pinsDb, npcsDb, scenesDb, handoutsDb] = await Promise.all([
    supabase.from('setting_seed_pins').select('*').eq('setting', setting).order('sort_order'),
    supabase.from('setting_seed_npcs').select('*').eq('setting', setting).order('sort_order'),
    supabase.from('setting_seed_scenes').select('*').eq('setting', setting),
    supabase.from('setting_seed_handouts').select('*').eq('setting', setting),
  ])

  const pins = (pinsDb.data && pinsDb.data.length > 0)
    ? pinsDb.data
    : (SETTING_PINS[setting] ?? []).map((p, i) => ({
        name: p.title, lat: p.lat, lng: p.lng,
        notes: p.notes ?? '', category: p.category ?? 'location',
        sort_order: i + 1,
      }))

  const scenes = (scenesDb.data && scenesDb.data.length > 0)
    ? scenesDb.data
    : (SETTING_SCENES[setting] ?? [])

  const handouts = (handoutsDb.data && handoutsDb.data.length > 0)
    ? handoutsDb.data
    : (SETTING_HANDOUTS[setting] ?? [])

  // NPCs need a touch more shaping when falling back to TS — the .ts
  // constants don't pre-build the `notes` jsonb that campaign_npcs
  // expects. Match the create-campaign flow's normalization.
  let npcs: any[]
  if (npcsDb.data && npcsDb.data.length > 0) {
    npcs = npcsDb.data
  } else {
    const ts = SETTING_NPCS[setting] ?? []
    npcs = ts.map((n, i) => {
      const notes = [
        n.role && `Role: ${n.role}`,
        n.description,
        n.how_to_meet && `How to meet: ${n.how_to_meet}`,
      ].filter(Boolean).join('\n\n')
      return {
        name: n.name,
        reason: n.reason, acumen: n.acumen, physicality: n.physicality,
        influence: n.influence, dexterity: n.dexterity,
        skills: {
          entries: n.skills.map(s => ({ name: s.name, level: s.level })),
          text: n.skills.map(s => `${s.name} ${s.level}`).join(', '),
          weapon: null,
        },
        equipment: n.equipment,
        notes,
        motivation: n.motivation || null,
        wp_max: n.wp_max, rp_max: n.rp_max,
        sort_order: i + 1,
        pin_title: n.pin_title,
      }
    })
  }

  return { pins, npcs, scenes, handouts }
}

export async function computeReseedPlan(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<ReseedPlan | { error: string }> {
  // Look up the campaign's setting.
  const { data: camp, error: campErr } = await supabase
    .from('campaigns').select('id, setting').eq('id', campaignId).maybeSingle()
  if (campErr) return { error: `campaigns: ${campErr.message}` }
  if (!camp) return { error: 'Campaign not found.' }
  const setting = (camp as any).setting as string
  if (!setting) return { error: 'Campaign has no setting.' }

  // Pull all four seed sources for this setting.
  const seeds = await resolveSeeds(supabase, setting)

  // Pull the campaign's existing rows so we can compute the diff.
  const [exPinsR, exNpcsR, exScenesR, exHandoutsR] = await Promise.all([
    supabase.from('campaign_pins').select('id, name').eq('campaign_id', campaignId),
    supabase.from('campaign_npcs').select('id, name').eq('campaign_id', campaignId),
    supabase.from('tactical_scenes').select('id, name').eq('campaign_id', campaignId),
    supabase.from('campaign_notes').select('id, title').eq('campaign_id', campaignId),
  ])

  const havePinNames     = new Set((exPinsR.data ?? []).map((r: any) => r.name))
  const haveNpcNames     = new Set((exNpcsR.data ?? []).map((r: any) => r.name))
  const haveSceneNames   = new Set((exScenesR.data ?? []).map((r: any) => r.name))
  const haveHandoutTitles = new Set((exHandoutsR.data ?? []).map((r: any) => r.title))

  // Pins
  const pinsToAdd: ReseedPlan['pinsToAdd'] = []
  let pinsSkipped = 0
  for (const p of seeds.pins) {
    const name = (p.name ?? p.title) as string
    if (havePinNames.has(name)) { pinsSkipped++; continue }
    pinsToAdd.push({
      name,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes ?? '',
      category: p.category ?? 'location',
    })
  }

  // NPCs
  const npcsToAdd: ReseedPlan['npcsToAdd'] = []
  let npcsSkipped = 0
  for (const n of seeds.npcs) {
    if (haveNpcNames.has(n.name)) { npcsSkipped++; continue }
    npcsToAdd.push({ name: n.name, pin_title: n.pin_title, row: n })
  }

  // Scenes
  const scenesToAdd: ReseedPlan['scenesToAdd'] = []
  let scenesSkipped = 0
  for (const s of seeds.scenes) {
    if (haveSceneNames.has(s.name)) { scenesSkipped++; continue }
    scenesToAdd.push({ name: s.name, row: s })
  }

  // Handouts (campaign_notes)
  const handoutsToAdd: ReseedPlan['handoutsToAdd'] = []
  let handoutsSkipped = 0
  for (const h of seeds.handouts) {
    if (haveHandoutTitles.has(h.title)) { handoutsSkipped++; continue }
    handoutsToAdd.push({ title: h.title, content: h.content, row: h })
  }

  return {
    campaignId, setting,
    pinsToAdd, npcsToAdd, scenesToAdd, handoutsToAdd,
    pinsSkipped, npcsSkipped, scenesSkipped, handoutsSkipped,
  }
}

export async function applyReseedPlan(
  supabase: SupabaseClient,
  plan: ReseedPlan,
): Promise<{ pins: number; npcs: number; scenes: number; handouts: number; errors: string[] }> {
  const errors: string[] = []
  let pins = 0, npcs = 0, scenes = 0, handouts = 0

  // ── Pins (insert first so we can resolve pin_title → campaign_pin_id) ──
  let insertedPinsByName: Record<string, string> = {}
  if (plan.pinsToAdd.length > 0) {
    const rows = plan.pinsToAdd.map((p, i) => ({
      campaign_id: plan.campaignId,
      name: p.name, lat: p.lat, lng: p.lng,
      notes: p.notes, category: p.category,
      revealed: false,
      sort_order: i + 1,
    }))
    const { data, error } = await supabase.from('campaign_pins').insert(rows).select('id, name')
    if (error) errors.push(`pins: ${error.message}`)
    else {
      pins = data?.length ?? 0
      for (const row of (data ?? []) as any[]) insertedPinsByName[row.name] = row.id
    }
  }

  // Build a full pin-name → id map by also querying existing pins (so
  // NPCs whose pin_title matches an already-present pin still link).
  const { data: allPins } = await supabase
    .from('campaign_pins').select('id, name').eq('campaign_id', plan.campaignId)
  const pinNameToId: Record<string, string> = {}
  for (const p of (allPins ?? []) as any[]) pinNameToId[p.name] = p.id

  // ── NPCs ──
  if (plan.npcsToAdd.length > 0) {
    const npcRows = plan.npcsToAdd.map(({ row: n }, i) => ({
      campaign_id: plan.campaignId,
      campaign_pin_id: n.pin_title ? (pinNameToId[n.pin_title] ?? null) : null,
      name: n.name,
      reason: n.reason, acumen: n.acumen, physicality: n.physicality,
      influence: n.influence, dexterity: n.dexterity,
      skills: n.skills, equipment: n.equipment,
      notes: n.notes, motivation: n.motivation,
      portrait_url: n.portrait_url || null,
      npc_type: n.npc_type || null,
      wp_max: n.wp_max, rp_max: n.rp_max,
      wp_current: n.wp_max, rp_current: n.rp_max,
      status: 'active',
      sort_order: n.sort_order ?? i + 1,
    }))
    const { error, count } = await supabase.from('campaign_npcs').insert(npcRows, { count: 'exact' })
    if (error) errors.push(`npcs: ${error.message}`)
    else npcs = count ?? npcRows.length
  }

  // ── Scenes ──
  if (plan.scenesToAdd.length > 0) {
    const sceneRows = plan.scenesToAdd.map(({ row: s }) => ({
      campaign_id: plan.campaignId,
      name: s.name,
      grid_cols: s.grid_cols,
      grid_rows: s.grid_rows,
      is_active: false,
      background_url: s.background_url ?? null,
      cell_px: s.cell_px ?? 35,
      cell_feet: s.cell_feet ?? 3,
    }))
    const { error, count } = await supabase.from('tactical_scenes').insert(sceneRows, { count: 'exact' })
    if (error) errors.push(`scenes: ${error.message}`)
    else scenes = count ?? sceneRows.length
  }

  // ── Handouts (campaign_notes) ──
  if (plan.handoutsToAdd.length > 0) {
    const handoutRows = plan.handoutsToAdd.map(({ row: h }) => ({
      campaign_id: plan.campaignId,
      title: h.title,
      content: h.content,
      attachments: Array.isArray(h.attachments) ? h.attachments : [],
    }))
    const { error, count } = await supabase.from('campaign_notes').insert(handoutRows, { count: 'exact' })
    if (error) errors.push(`handouts: ${error.message}`)
    else handouts = count ?? handoutRows.length
  }

  return { pins, npcs, scenes, handouts, errors }
}
