'use client'
// Thriver-only one-shot tool to publish the deprecated /stories/new
// settings (Chased, Mongrels, Empty, The Rock, The Arena) as Modules.
// Each click creates one module + one version, marks listed +
// approved so it shows in the marketplace immediately, and is
// idempotent (skips if a module with the same name already exists
// in the public-listed set).
//
// Source data: SETTING_NPCS / SETTING_PINS / SETTING_SCENES dicts in
// lib/. Synthetic UUIDs are used for snapshot row ids — cloneSnapshot
// rewrites them on subscribe-clone so the values don't matter, only
// uniqueness within the snapshot.
//
// SCOPE: ships NPCs + pins + scenes only. Vehicles (Mongrels' Minnie)
// and handouts aren't in the cloneSnapshotIntoCampaign path yet —
// extending that is Phase 2 of this migration. Each module's
// description flags the gap.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { SETTING_NPCS } from '../../../lib/setting-npcs'
import { SETTING_PINS } from '../../../lib/setting-pins'
import { SETTING_SCENES } from '../../../lib/setting-scenes'

interface SettingDef {
  key: string
  name: string
  parentSetting: string | null
  tagline: string
  description: string
  contentTags: string[]
  sessionEstimate: number
  playerCountRecommended: number
}

const SETTINGS_TO_MIGRATE: SettingDef[] = [
  {
    key: 'mongrels',
    name: 'Minnie & The Magnificent Mongrels',
    parentSetting: null,
    tagline: 'Road-warrior bootleggers, one Winnebago, the open American wasteland.',
    description: 'A flagship Distemper one-shot. Frankie\'s crew has just lost their compound to Kincaid. Load up the still, board Minnie, and run. Includes the Day One barn scene, the Minnie interior tactical map, and the full Mongrels NPC roster. Vehicles and handouts ship as a separate follow-up patch.',
    contentTags: ['one-shot', 'road', 'combat-heavy'],
    sessionEstimate: 2,
    playerCountRecommended: 4,
  },
  {
    key: 'chased',
    name: 'Chased',
    parentSetting: null,
    tagline: 'A small-town Delaware horror module — outrun the Connors, save Maddy.',
    description: 'A tense rescue scenario set around the Connor Boys Farmhouse. Includes the farmhouse tactical scene, the Chased NPC roster (Robertsons, Ortizes, Connors, Pastor Nick, Eric, Macy, Mikey, Maddy, Troy & Mark), and the Chased pin set across rural Sussex County. Handouts (in-world broadcasts, ham-radio transcripts) ship as a separate follow-up patch.',
    contentTags: ['one-shot', 'horror', 'rescue', 'rural'],
    sessionEstimate: 3,
    playerCountRecommended: 4,
  },
  {
    key: 'empty',
    name: 'Empty',
    parentSetting: null,
    tagline: 'A two-character encounter at an abandoned Delaware gas station.',
    description: 'A short tactical encounter built around Stansfield\'s Gas Station. Becky and Dylan are inside; the players have parked their truck out front. Outcome depends on stealth, timing, and whether anyone hits the door bell. Includes the gas station tactical scene and a small NPC set.',
    contentTags: ['one-shot', 'short', 'stealth'],
    sessionEstimate: 1,
    playerCountRecommended: 3,
  },
  {
    key: 'therock',
    name: 'The Rock',
    parentSetting: null,
    tagline: 'A long-running prison campaign frame.',
    description: 'A campaign starter set inside a converted island prison. Players negotiate factions, contraband, and the slow grinding politics of a world rebuilt behind walls. Ships with the starter NPC set; expand from there.',
    contentTags: ['campaign-frame', 'faction', 'long-running'],
    sessionEstimate: 8,
    playerCountRecommended: 4,
  },
  {
    key: 'arena',
    name: 'The Arena',
    parentSetting: null,
    tagline: 'A combat-heavy gladiatorial sandbox.',
    description: 'A standalone arena campaign — Distemper-era blood sport in a converted stadium. Players fight up the bracket between sessions of training, gambling, and political maneuvering. Stripped-down content; build out from the seed and publish your own variant.',
    contentTags: ['sandbox', 'combat-heavy', 'standalone'],
    sessionEstimate: 6,
    playerCountRecommended: 4,
  },
]

interface MigrationResult {
  setting: string
  ok: boolean
  moduleId?: string
  versionId?: string
  error?: string
  skipped?: string
  counts?: { npcs: number; pins: number; scenes: number }
}

export default function MigrateSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [isThriver, setIsThriver] = useState<boolean | null>(null)
  const [results, setResults] = useState<Record<string, MigrationResult | null>>({})
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { setIsThriver(false); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setIsThriver(((data?.role ?? '') as string).toLowerCase() === 'thriver')
    })()
  }, [supabase])

  function newId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }

  function buildSnapshot(setting: string) {
    // Map each seed array to the row shape cloneSnapshotIntoCampaign expects.
    // Field set is the union of campaign_npcs / campaign_pins /
    // tactical_scenes columns the clone reads. id+campaign_id get
    // rewritten on subscribe; we only need them present + unique.
    const npcSeeds = SETTING_NPCS[setting] ?? []
    const pinSeeds = SETTING_PINS[setting] ?? []
    const sceneSeeds = SETTING_SCENES[setting] ?? []
    const placeholderCampaignId = newId()

    const npcs = npcSeeds.map((n: any, idx) => ({
      id: newId(),
      campaign_id: placeholderCampaignId,
      name: n.name,
      npc_type: n.npc_type ?? 'goon',
      portrait_url: n.portrait_url ?? null,
      reason: n.reason ?? 0,
      acumen: n.acumen ?? 0,
      physicality: n.physicality ?? 0,
      influence: n.influence ?? 0,
      dexterity: n.dexterity ?? 0,
      wp_max: n.wp_max ?? 10,
      wp_current: n.wp_max ?? 10,
      rp_max: n.rp_max ?? 6,
      rp_current: n.rp_max ?? 6,
      morality: n.morality ?? 0,
      stress: 0,
      insight_dice: 0,
      status: 'active',
      skills: n.skills ?? null,
      inventory: n.inventory ?? [],
      notes: n.notes ?? '',
      hidden_from_players: false,
      sort_order: idx + 1,
      folder: n.folder ?? null,
    }))

    const pins = pinSeeds.map((p: any, idx) => ({
      id: newId(),
      campaign_id: placeholderCampaignId,
      title: p.title,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes ?? '',
      category: p.category ?? 'location',
      sort_order: idx + 1,
    }))

    const scenes = sceneSeeds.map((s: any) => {
      const sceneId = newId()
      return {
        scene: {
          id: sceneId,
          campaign_id: placeholderCampaignId,
          name: s.name,
          grid_cols: s.grid_cols,
          grid_rows: s.grid_rows,
          notes: s.notes ?? '',
          is_active: false,
          cell_feet: 3,
          cell_px: 35,
          has_grid: true,
        },
        // No tokens — seed scenes ship empty maps. The clone path's
        // npcIdMap remap will only rewrite tokens that reference an
        // npc_id in the snapshot's npcs[]; an empty array here is
        // exactly right.
        tokens: [] as any[],
      }
    })

    return {
      version: 1 as const,
      captured_at: new Date().toISOString(),
      campaign_id: placeholderCampaignId,
      includes_character_states: false,
      npcs,
      pins,
      scenes,
      notes: [] as any[],
    }
  }

  async function migrate(def: SettingDef) {
    setRunning(def.key)
    setResults(prev => ({ ...prev, [def.key]: null }))
    try {
      // Idempotency: skip if a module with this name already exists.
      // Match by name (case-sensitive) — Thriver can manage
      // duplicates manually if they ever crop up.
      const { data: existing } = await supabase
        .from('modules')
        .select('id, name')
        .eq('name', def.name)
        .limit(1)
      if (existing && existing.length > 0) {
        const result: MigrationResult = { setting: def.key, ok: true, skipped: `Module "${def.name}" already exists (id: ${existing[0].id}).` }
        setResults(prev => ({ ...prev, [def.key]: result }))
        return
      }

      const snapshot = buildSnapshot(def.key)
      const { user } = await getCachedAuth()
      if (!user) {
        setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: 'not authenticated' } }))
        return
      }

      // 1. Insert the module row. Listed + approved so it appears in
      //    /modules immediately. Source campaign null — these modules
      //    are synthetic from setting seeds, no source campaign.
      const { data: modRow, error: modErr } = await supabase
        .from('modules')
        .insert({
          author_user_id: user.id,
          source_campaign_id: null,
          name: def.name,
          tagline: def.tagline,
          description: def.description,
          parent_setting: def.parentSetting,
          content_tags: def.contentTags,
          session_count_estimate: def.sessionEstimate,
          player_count_recommended: def.playerCountRecommended,
          visibility: 'listed',
          moderation_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (modErr || !modRow) {
        setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: modErr?.message ?? 'module insert returned no row' } }))
        return
      }

      // 2. Insert the v1.0.0 module_version with the synthesized snapshot.
      const { data: verRow, error: verErr } = await supabase
        .from('module_versions')
        .insert({
          module_id: modRow.id,
          version: '1.0.0',
          version_major: 1,
          version_minor: 0,
          version_patch: 0,
          published_by: user.id,
          changelog: 'Initial publish — migrated from the deprecated /stories/new setting seed.',
          snapshot,
        })
        .select('id')
        .single()
      if (verErr || !verRow) {
        setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: verErr?.message ?? 'version insert returned no row' } }))
        return
      }

      // 3. Point modules.latest_version_id at the version we just inserted.
      const { error: updErr } = await supabase
        .from('modules')
        .update({ latest_version_id: verRow.id })
        .eq('id', modRow.id)
      if (updErr) {
        setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: `latest_version pointer: ${updErr.message}` } }))
        return
      }

      const result: MigrationResult = {
        setting: def.key,
        ok: true,
        moduleId: modRow.id,
        versionId: verRow.id,
        counts: { npcs: snapshot.npcs.length, pins: snapshot.pins.length, scenes: snapshot.scenes.length },
      }
      setResults(prev => ({ ...prev, [def.key]: result }))
    } catch (err: any) {
      setResults(prev => ({ ...prev, [def.key]: { setting: def.key, ok: false, error: err?.message ?? 'unknown' } }))
    } finally {
      setRunning(null)
    }
  }

  async function migrateAll() {
    for (const def of SETTINGS_TO_MIGRATE) {
      await migrate(def)
    }
  }

  if (isThriver === null) {
    return <div style={{ padding: '24px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>Checking…</div>
  }
  if (!isThriver) {
    return (
      <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto', color: '#d4cfc9' }}>
        <div style={{ fontSize: '20px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>Access Denied</div>
        <div style={{ fontSize: '14px' }}>Thriver-only tool. Contact xerosumgames@gmail.com if you think this is wrong.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '900px', margin: '0 auto', color: '#d4cfc9' }}>
      <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
        Thriver Tool
      </div>
      <h1 style={{ margin: 0, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
        Migrate Settings to Modules
      </h1>
      <p style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.5 }}>
        Publishes the five deprecated /stories/new settings (Chased, Mongrels, Empty, The Rock, The Arena) as Module-marketplace entries.
        Each migration creates one module + one v1.0.0 version, marks visibility=listed and moderation=approved so it appears immediately
        on /modules. Idempotent — clicking Migrate on an already-published setting reports "skipped".
      </p>
      <p style={{ marginTop: '4px', fontSize: '13px', color: '#cce0f5' }}>
        Scope: NPCs + pins + scenes ship in v1.0.0. Vehicles and handouts (Mongrels&apos; Minnie, Chased&apos;s broadcasts) need a v1.1.0 publish
        once cloneSnapshotIntoCampaign learns to clone them. Each module&apos;s description flags the gap so subscribers know.
      </p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '20px', marginBottom: '16px' }}>
        <button onClick={migrateAll} disabled={!!running}
          style={{ padding: '9px 22px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, cursor: running ? 'wait' : 'pointer', opacity: running ? 0.5 : 1 }}>
          {running ? `Migrating ${running}…` : 'Migrate All'}
        </button>
        <a href="/modules" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          → /modules
        </a>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SETTINGS_TO_MIGRATE.map(def => {
          const r = results[def.key]
          return (
            <div key={def.key} style={{ padding: '14px 16px', background: '#1a1a1a', border: `1px solid ${r?.ok === false ? '#c0392b' : r?.ok ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{def.name}</div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>{def.tagline}</div>
                </div>
                <button onClick={() => migrate(def)} disabled={!!running}
                  style={{ padding: '6px 14px', background: r?.ok ? '#1a2e10' : '#2a1a3e', border: `1px solid ${r?.ok ? '#2d5a1b' : '#5a2e5a'}`, borderRadius: '3px', color: r?.ok ? '#7fc458' : '#c4a7f0', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: running === def.key ? 'wait' : 'pointer', opacity: running === def.key ? 0.5 : 1, fontWeight: 600 }}>
                  {running === def.key ? 'Migrating…' : r?.ok ? 'Done' : 'Migrate'}
                </button>
              </div>
              {r && (
                <div style={{ marginTop: '8px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', color: r.ok ? '#7fc458' : '#f5a89a' }}>
                  {r.skipped && <>↩ {r.skipped}</>}
                  {r.ok && !r.skipped && r.counts && <>✓ Published — {r.counts.npcs} NPCs, {r.counts.pins} pins, {r.counts.scenes} scenes (module {r.moduleId?.slice(0, 8)}…)</>}
                  {!r.ok && <>✗ {r.error}</>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
