'use client'
import { memo, useState, useEffect } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { generateRandomNpc, ALL_SKILLS, SkillEntry } from '../lib/npc-generator'
import { resizeImage } from '../lib/image-utils'
import { MELEE_WEAPONS, RANGED_WEAPONS, EXPLOSIVE_WEAPONS, HEAVY_WEAPONS, getWeaponByName } from '../lib/weapons'
import PortraitBankPicker from './PortraitBankPicker'
import { openPopout } from '../lib/popout'

function parseSkillText(text: string): SkillEntry[] {
  if (!text.trim()) return []
  return text.split(',').map(s => {
    const match = s.trim().match(/^(.+?)\s+(-?\d+)$/)
    if (match) return { name: match[1], level: parseInt(match[2]) }
    return null
  }).filter(Boolean) as SkillEntry[]
}

const RAPID_LABELS: Record<number, string> = {
  [-2]: 'Diminished', [-1]: 'Weak', 0: 'Average', 1: 'Good',
  2: 'Strong', 3: 'Exceptional', 4: 'Human Peak',
}

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  friendly: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  bystander: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  goon: { bg: '#2a2010', border: '#5a4a1b', color: '#EF9F27' },
  foe: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  antagonist: { bg: '#2a102a', border: '#8b2e8b', color: '#d48bd4' },
}

// Ring color of the NPC portrait circle — driven by DISPOSITION
// (friendly / neutral / hostile), not npc_type. Disposition is
// how the NPC feels toward the PCs; type is their role/threat
// level. A Goon can be a friendly ally, a Bystander can be hostile
// — the two concerns are independent. Exported so NpcCard,
// PlayerNpcCard, and the edit form all render the same palette.
// Null/unset disposition falls back to neutral gray.
const DISPOSITION_COLORS: Record<string, { border: string; bg: string; color: string }> = {
  friendly: { border: '#2d5a1b', bg: '#1a2e10', color: '#7fc458' },
  // Was dark grey (#3a3a3a / #2e2e2e) — too indistinct against the dark
  // roster background and on the tactical map. Switched to dim goldenrod
  // border + dark amber bg + warm-yellow tag color so neutral reads as
  // an actual signal instead of vanishing into UI chrome. Mirrors the
  // brightness profile of friendly/hostile.
  neutral:  { border: '#a17a14', bg: '#2a2010', color: '#fcd34d' },
  hostile:  { border: '#c0392b', bg: '#2a1210', color: '#f5a89a' },
}
// Single source-of-truth for NPC ring/border colors used by both the
// roster cards (border around the portrait) and the tactical map
// tokens (border around the token). Disposition wins when set; falls
// back to npc_type when disposition is unset/empty so legacy or
// setting-imported NPCs that never had an explicit disposition still
// show the right threat signal. Both surfaces use this helper so a
// friendly NPC can never look green on the map and red on the roster
// (or vice versa) — they're always rendered from the same palette.
export function getNpcRingColor(npc: { disposition?: string | null; npc_type?: string | null } | string | null | undefined): { border: string; bg: string; color: string } {
  // Back-compat: callers used to pass just the disposition string.
  const obj = (typeof npc === 'object' && npc !== null) ? npc : { disposition: (npc ?? null) as string | null, npc_type: null }
  const d = obj.disposition
  if (d === 'friendly') return DISPOSITION_COLORS.friendly
  if (d === 'hostile')  return DISPOSITION_COLORS.hostile
  if (d === 'neutral')  return DISPOSITION_COLORS.neutral
  // disposition unset → infer from type
  const t = (obj.npc_type ?? '').toLowerCase()
  if (t === 'bystander' || t === 'friendly')             return DISPOSITION_COLORS.friendly
  if (t === 'foe' || t === 'goon' || t === 'antagonist') return DISPOSITION_COLORS.hostile
  return DISPOSITION_COLORS.neutral
}

// Token rings on the tactical map render at small size against busy
// background art (terrain, buildings, etc.) and need to read at a
// glance — use brighter variants of the disposition palette than the
// roster cards. Friendly = vivid green, Hostile = vivid red, Neutral =
// medium gray. Roster cards keep the dimmer base palette since they
// sit on a flat dark UI background where the muted tones work fine.
const TOKEN_BORDER_OVERRIDES: Record<string, string> = {
  '#2d5a1b': '#4ade80', // friendly: forest green → vivid green
  '#c0392b': '#ef4444', // hostile: brand red → vivid red
  '#a17a14': '#facc15', // neutral: dim goldenrod → vivid yellow
  // Legacy fallbacks — tokens placed before the yellow swap stored
  // either '#3a3a3a' (the dim picker color, via cell-throw / quick-add
  // paths) or '#9ca3af' (the OLD vivid medium gray, via placeTokenOnMap
  // which writes the *vivid* color straight into scene_tokens.color).
  // Map both through to the new vivid yellow so old maps don't render
  // as gray rings — no DB migration needed.
  '#3a3a3a': '#facc15',
  '#9ca3af': '#facc15',
}

export function getNpcTokenBorderColor(npc: { disposition?: string | null; npc_type?: string | null }): string {
  const base = getNpcRingColor(npc).border
  return TOKEN_BORDER_OVERRIDES[base] ?? base
}

// Brightens a stored token color (from scene_tokens.color) to its vivid
// map variant. Lets the canvas render legacy tokens placed before the
// vivid-palette switch without a DB migration — anything that doesn't
// match a known muted hex passes through unchanged (custom colors etc.)
export function vividTokenBorder(color: string | null | undefined): string {
  if (!color) return '#ef4444'
  return TOKEN_BORDER_OVERRIDES[color] ?? color
}

// Placeholder silhouette portraits by type. Clicking one sets
// portrait_url to that colored SVG. Used when the GM wants a
// typed-looking stand-in without uploading art. The ring color of
// the outer circle is driven by npc_type separately — these are
// just the INSIDE image.
const PORTRAIT_BANK = [
  { label: 'Bystander', bg: '#1a2e10', color: '#7fc458' },
  { label: 'Goon', bg: '#2a2010', color: '#EF9F27' },
  { label: 'Foe', bg: '#2a1210', color: '#c0392b' },
  { label: 'Antagonist', bg: '#2a102a', color: '#d48bd4' },
  { label: 'Neutral', bg: '#2e2e2e', color: '#d4cfc9' },
].map((p, i) => ({
  ...p,
  url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${p.bg}"/><circle cx="32" cy="24" r="12" fill="${p.color}" opacity="0.6"/><ellipse cx="32" cy="52" rx="18" ry="14" fill="${p.color}" opacity="0.4"/></svg>`)}`,
}))

const COMPLICATIONS = [
  'Addiction', 'Betrayed', 'Code of Honor', 'Criminal Past', 'Daredevil', 'Dark Secret',
  'Family Obligation', 'Famous', 'Loss', 'Outstanding Debt', 'Personal Enemy',
]

const MOTIVATIONS = [
  'Accumulate', 'Build', 'Find Safety', 'Hedonism', 'Make Amends', 'Preach',
  'Protect', 'Reunite', 'Revenge', 'Stay Alive', 'Take Advantage',
]

const PERSONALITY_WORDS = [
  'Calculating', 'Reckless', 'Stoic', 'Paranoid', 'Loyal', 'Bitter',
  'Resourceful', 'Haunted', 'Ruthless', 'Idealistic', 'Cynical', 'Protective',
  'Quiet', 'Volatile', 'Generous', 'Suspicious', 'Stubborn', 'Cunning',
  'Hopeful', 'Pragmatic', 'Vengeful', 'Patient', 'Impulsive', 'Sardonic',
  'Devout', 'Desperate', 'Defiant', 'Weary', 'Fierce', 'Compassionate',
  'Cold', 'Charming', 'Blunt', 'Cautious', 'Driven', 'Melancholy',
  'Jovial', 'Fearless', 'Guarded', 'Gruff', 'Tender', 'Obsessive',
  'Resigned', 'Ambitious', 'Humble', 'Secretive', 'Brash', 'Methodical',
  'Sentimental', 'Detached', 'Restless', 'Territorial', 'Adaptable', 'Wry',
  'Earnest', 'Sullen', 'Scrappy', 'Unflinching', 'Pensive', 'Gregarious',
]

const TYPE_PRESETS: Record<string, { reason: number; acumen: number; physicality: number; influence: number; dexterity: number }> = {
  friendly: { reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0 },
  goon: { reason: 0, acumen: 0, physicality: 1, influence: 0, dexterity: 0 },
  foe: { reason: 0, acumen: 1, physicality: 1, influence: 0, dexterity: 1 },
}

const SKILL_HINTS: Record<string, string> = {
  goon: 'Goons typically have up to 3 skills at level 1.',
  foe: 'Foes typically have two skills at level 2 and three at level 1.',
  antagonist: 'Antagonists typically have one skill at 3, two at 2, three at 1.',
}

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  active: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  dead: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  unknown: { bg: '#1a1a2e', border: '#2e2e5a', color: '#7ab3d4' },
}

export interface CampaignNpc {
  id: string
  campaign_id: string
  name: string
  portrait_url: string | null
  reason: number
  acumen: number
  physicality: number
  influence: number
  dexterity: number
  skills: any
  notes: string | null
  npc_type: string | null
  disposition: 'friendly' | 'neutral' | 'hostile' | null
  recruitment_role: string | null
  world_npc_id: string | null
  wp_current: number | null
  wp_max: number | null
  rp_current: number | null
  rp_max: number | null
  status: string
  created_at: string
  sort_order: number | null
  death_countdown: number | null
  incap_rounds: number | null
  equipment: { name: string; damage?: number; roll?: string; notes?: string }[] | null
  inventory?: { name: string; qty: number; enc?: number; rarity?: string; notes?: string; custom?: boolean }[] | null
  folder: string | null
  hidden_from_players?: boolean
}

interface Relationship {
  id: string
  npc_id: string
  character_id: string
  relationship_cmod: number
  notes: string | null
  revealed: boolean
  reveal_level: string | null
}

interface PCEntry {
  characterId: string
  characterName: string
  userId: string
}

const FIRST_IMPRESSIONS = [
  { label: 'High Insight (6+6)', value: 3 },
  { label: 'Wild Success (14+)', value: 2 },
  { label: 'Success (9-13)', value: 0 },
  { label: 'Failure (4-8)', value: -1 },
  { label: 'Dire Failure (0-3)', value: -2 },
  { label: 'Low Insight (1+1)', value: -3 },
]

interface Props {
  campaignId: string
  isGM: boolean
  combatActive?: boolean
  initiativeNpcIds?: Set<string>
  initiativeNpcOrder?: string[]   // NPC ids in turn order; first = currently acting
  onAddToCombat?: (npcs: CampaignNpc[]) => void
  pcEntries?: PCEntry[]
  onViewNpc?: (npc: CampaignNpc) => void
  viewingNpcIds?: Set<string>
  editNpcId?: string | null
  onEditStarted?: () => void
  externalNpcs?: CampaignNpc[]    // Parent's optimistic NPC state — syncs HP/status without waiting for realtime
  onPlaceOnMap?: (npc: CampaignNpc) => void
  onRemoveFromMap?: (npc: CampaignNpc) => void
  // Bulk-placement for the per-folder "Map" button: places every NPC in
  // the array onto the active scene in a tidy NxN cluster, skipping any
  // that already have a token. Parent owns the placement logic so the
  // single-broadcast / scene-lookup pattern stays in one place.
  onPlaceFolderOnMap?: (npcs: CampaignNpc[]) => void
  // Fires after a reveal/hide flips is_visible on scene_tokens. Parent
  // wires to broadcast token_changed so player TacticalMaps re-fetch
  // and pick up the new is_visible state without a manual refresh.
  // Without this nudge the postgres_changes subscription on
  // scene_tokens fires inconsistently for is_visible UPDATEs.
  onTacticalRefresh?: () => void
  // Symmetric removal: when every NPC in the folder already has a token,
  // the Map button flips to UNMAP and calls this. Removes all the
  // folder's tokens from the active scene in one shot.
  onUnmapFolder?: (npcs: CampaignNpc[]) => void
  npcIdsOnMap?: Set<string>
  // Fired after an NPC row (and its orphaned map tokens / initiative rows)
  // are deleted, so the parent page can refresh local state without waiting
  // on a realtime DELETE event that postgres_changes sometimes drops.
  onNpcDeleted?: (npcId: string) => void
}

const emptyForm = {
  name: '', portrait_url: null as string | null,
  reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0,
  skillEntries: [] as SkillEntry[], notes: '', status: 'active',
  npc_type: '' as string, disposition: '' as '' | 'friendly' | 'neutral' | 'hostile',
  motivation: '', complication: '', threeWords: ['', '', ''] as string[],
  weapon: null as any,
  weapon2: null as any,
  folder: '' as string,
}

function NpcRosterImpl({ campaignId, isGM, combatActive, initiativeNpcIds, initiativeNpcOrder, onAddToCombat, pcEntries, onViewNpc, viewingNpcIds, editNpcId, onEditStarted, externalNpcs, onPlaceOnMap, onRemoveFromMap, onPlaceFolderOnMap, onTacticalRefresh, onUnmapFolder, npcIdsOnMap, onNpcDeleted }: Props) {
  const supabase = createClient()
  const [npcs, setNpcs] = useState<CampaignNpc[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [npcSearch, setNpcSearch] = useState('')
  const [npcTypeFilter, setNpcTypeFilter] = useState<string | null>(null)
  const [npcStatusFilter, setNpcStatusFilter] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showPortraitPicker, setShowPortraitPicker] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem(`npc_folders_${campaignId}`); if (saved) return new Set(JSON.parse(saved)) } catch {}
    }
    return new Set<string>()
  })
  const [folderOrder, setFolderOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem(`npc_folder_order_${campaignId}`); if (saved) return JSON.parse(saved) } catch {}
    }
    return []
  })
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragFolderId, setDragFolderId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [dragNpcToFolder, setDragNpcToFolder] = useState<string | null>(null)
  // Map of npc_id → { communityId, communityName } for recruited NPCs.
  const [communityMap, setCommunityMap] = useState<Record<string, { communityId: string; communityName: string }>>({})

  // Fetch community memberships for a given list of NPCs. Extracted from
  // loadNpcs so the initial-mount path can reuse parent's externalNpcs
  // for the npc list while still needing this separate fetch.
  async function loadCommunityMap(npcList: { id: string }[]) {
    const npcIds = npcList.map(n => n.id)
    if (npcIds.length === 0) {
      setCommunityMap({})
      return
    }
    const { data: members } = await supabase
      .from('community_members')
      .select('npc_id, community_id, communities(name)')
      .in('npc_id', npcIds)
      .is('left_at', null)
      .not('npc_id', 'is', null)
    const map: Record<string, { communityId: string; communityName: string }> = {}
    ;(members ?? []).forEach((m: any) => {
      if (m.npc_id) map[m.npc_id] = { communityId: m.community_id, communityName: m.communities?.name ?? 'Community' }
    })
    setCommunityMap(map)
  }

  async function loadNpcs() {
    const { data } = await supabase
      .from('campaign_npcs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    setNpcs(data ?? [])

    // Fetch community memberships for these NPCs.
    const npcIds = (data ?? []).map((n: any) => n.id)
    if (npcIds.length > 0) {
      const { data: members } = await supabase
        .from('community_members')
        .select('npc_id, community_id, communities(name)')
        .in('npc_id', npcIds)
        .is('left_at', null)
        .not('npc_id', 'is', null)
      const map: Record<string, { communityId: string; communityName: string }> = {}
      ;(members ?? []).forEach((m: any) => {
        if (m.npc_id) map[m.npc_id] = { communityId: m.community_id, communityName: m.communities?.name ?? 'Community' }
      })
      setCommunityMap(map)
    } else {
      setCommunityMap({})
    }

    setLoading(false)
  }

  // Drag and drop reorder
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  async function handleNpcDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const fromIdx = npcs.findIndex(n => n.id === dragId)
    const toIdx = npcs.findIndex(n => n.id === targetId)
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); setDragOverId(null); return }
    const next = [...npcs]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    const renumbered = next.map((n, i) => ({ ...n, sort_order: i + 1 }))
    setNpcs(renumbered)
    setDragId(null)
    setDragOverId(null)
    await Promise.all(renumbered.map(n =>
      supabase.from('campaign_npcs').update({ sort_order: n.sort_order }).eq('id', n.id)
    ))
  }

  useEffect(() => {
    // Initial load — if the parent already populated externalNpcs (Wave
    // 2 on the table page), reuse that instead of firing our own
    // campaign_npcs query. Saves one round-trip per mount, which adds
    // up under multi-browser playtest pressure. Community memberships
    // still fetched separately (different table). Falls back to the
    // own-fetch path when the prop isn't passed (component used outside
    // the table page mount, or before parent's Wave 2 finishes).
    if (externalNpcs && externalNpcs.length > 0) {
      const sorted = [...externalNpcs].sort((a: any, b: any) => {
        const aSort = a.sort_order ?? Number.MAX_SAFE_INTEGER
        const bSort = b.sort_order ?? Number.MAX_SAFE_INTEGER
        if (aSort !== bSort) return aSort - bSort
        return (a.created_at || '').localeCompare(b.created_at || '')
      })
      setNpcs(sorted as CampaignNpc[])
      loadCommunityMap(sorted)
    } else {
      loadNpcs()
    }

    // Realtime subscription — refresh when any campaign_npcs row changes
    // (e.g. damage applied from table page updates WP/RP in DB).
    const channel = supabase.channel(`npc_roster_${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_npcs', filter: `campaign_id=eq.${campaignId}` }, () => {
        loadNpcs()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members' }, () => {
        loadNpcs()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [campaignId, isGM])

  // Sync HP/status from parent's optimistic state so damage appears instantly
  useEffect(() => {
    if (!externalNpcs || externalNpcs.length === 0) return
    setNpcs(prev => {
      if (prev.length === 0) return prev
      let changed = false
      const next = prev.map(n => {
        const ext = externalNpcs.find(e => e.id === n.id)
        if (!ext) return n
        if (ext.wp_current !== n.wp_current || ext.rp_current !== n.rp_current ||
            ext.death_countdown !== n.death_countdown || ext.incap_rounds !== n.incap_rounds ||
            ext.status !== n.status) {
          changed = true
          return { ...n, wp_current: ext.wp_current, rp_current: ext.rp_current,
            death_countdown: ext.death_countdown, incap_rounds: ext.incap_rounds, status: ext.status }
        }
        return n
      })
      return changed ? next : prev
    })
  }, [externalNpcs])

  useEffect(() => {
    if (editNpcId && npcs.length > 0) {
      const npc = npcs.find(n => n.id === editNpcId)
      if (npc) { openEdit(npc); onEditStarted?.() }
    }
  }, [editNpcId, npcs.length])


  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setGeneratedSummary('')
    setShowForm(true)
  }

  async function openEdit(npc: CampaignNpc) {
    setForm({
      name: npc.name,
      portrait_url: npc.portrait_url,
      reason: npc.reason,
      acumen: npc.acumen,
      physicality: npc.physicality,
      influence: npc.influence,
      dexterity: npc.dexterity,
      skillEntries: Array.isArray(npc.skills?.entries) ? npc.skills.entries : (typeof npc.skills?.text === 'string' ? parseSkillText(npc.skills.text) : []),
      notes: npc.notes ?? '',
      status: npc.status,
      npc_type: npc.npc_type ?? '',
      disposition: (npc.disposition ?? '') as '' | 'friendly' | 'neutral' | 'hostile',
      motivation: (npc as any).motivation ?? '',
      complication: (npc as any).complication ?? '',
      threeWords: (npc as any).three_words ?? ['', '', ''],
      weapon: npc.skills?.weapon ?? null,
      weapon2: npc.skills?.weapon2 ?? null,
      folder: npc.folder ?? '',
    })
    setEditingId(npc.id)
    setShowForm(true)
    setShowReveal(false)
    // Load relationships for this NPC
    const { data: rels } = await supabase
      .from('npc_relationships')
      .select('*')
      .eq('npc_id', npc.id)
    setRelationships(rels ?? [])
  }

  async function handlePortraitUpload(file: File) {
    setUploading(true)
    const resized = await resizeImage(file, 256)
    const blob = await fetch(resized).then(r => r.blob())
    const path = `${campaignId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from('campaign-npcs').upload(path, blob, { contentType: 'image/jpeg' })
    if (!error) {
      const { data: urlData } = supabase.storage.from('campaign-npcs').getPublicUrl(path)
      setForm(f => ({ ...f, portrait_url: urlData.publicUrl }))
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const row = {
      campaign_id: campaignId,
      name: form.name.trim(),
      portrait_url: form.portrait_url,
      reason: form.reason,
      acumen: form.acumen,
      physicality: form.physicality,
      influence: form.influence,
      dexterity: form.dexterity,
      skills: { entries: form.skillEntries, text: form.skillEntries.map(s => `${s.name} ${s.level}`).join(', '), weapon: (form as any).weapon ?? null, weapon2: (form as any).weapon2 ?? null },
      notes: form.notes.trim() || null,
      status: form.status,
      npc_type: form.npc_type || null,
      disposition: form.disposition || null,
      motivation: form.motivation || null,
      complication: form.complication || null,
      three_words: form.threeWords.filter(w => w),
      folder: form.folder.trim() || null,
      wp_max: 10 + form.physicality + form.dexterity,
      rp_max: 6 + form.physicality,
      ...(!editingId ? { wp_current: 10 + form.physicality + form.dexterity, rp_current: 6 + form.physicality } : {}),
    }
    if (editingId) {
      await supabase.from('campaign_npcs').update(row).eq('id', editingId)
      // Same token-color sync as quickSetDisposition — the full Edit
      // modal can change disposition or npc_type, and either flip
      // changes the ring color callsite (placeFolderOnMap /
      // placeTokenOnMap) computes for new placements. Without this,
      // existing tokens keep their old color until the GM unmaps + re-
      // places them.
      const newColor = getNpcTokenBorderColor({ disposition: row.disposition, npc_type: row.npc_type })
      await supabase.from('scene_tokens').update({ color: newColor }).eq('npc_id', editingId)
    } else {
      // Append new NPCs at the end of the existing sort order.
      const { data: maxRow } = await supabase.from('campaign_npcs').select('sort_order').eq('campaign_id', campaignId).order('sort_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
      const nextSort = ((maxRow as any)?.sort_order ?? 0) + 1
      await supabase.from('campaign_npcs').insert({ ...row, sort_order: nextSort })
    }
    setShowForm(false)
    setSaving(false)
    await loadNpcs()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    // scene_tokens.npc_id and initiative_order.npc_id have no FK constraint,
    // so the related rows would otherwise orphan and leave the NPC's token on
    // the map / initiative list after the campaign_npcs row is gone. Delete
    // all three tables in the same click. Tokens first so realtime listeners
    // see the token vanish before the NPC row disappears (cleaner visual).
    const tokenRes = await supabase.from('scene_tokens').delete().eq('npc_id', id)
    if (tokenRes.error) console.warn('[handleDelete] scene_tokens delete error:', tokenRes.error.message)
    const initRes = await supabase.from('initiative_order').delete().eq('npc_id', id)
    if (initRes.error) console.warn('[handleDelete] initiative_order delete error:', initRes.error.message)
    await supabase.from('campaign_npcs').delete().eq('id', id)
    await loadNpcs()
    // Tell the parent to refresh + broadcast — Supabase Realtime DELETE
    // events over postgres_changes sometimes drop when REPLICA IDENTITY
    // isn't FULL, leaving the initiative bar stale until a manual reload.
    onNpcDeleted?.(id)
  }

  function toggleFolder(folderName: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(folderName) ? next.delete(folderName) : next.add(folderName)
      if (typeof window !== 'undefined') localStorage.setItem(`npc_folders_${campaignId}`, JSON.stringify([...next]))
      return next
    })
  }

  async function renameFolder(oldName: string, newName: string) {
    if (!newName.trim() || newName.trim() === oldName) { setRenamingFolder(null); return }
    const trimmed = newName.trim()
    await Promise.all(npcs.filter(n => (n.folder ?? 'Uncategorized') === oldName).map(n =>
      supabase.from('campaign_npcs').update({ folder: trimmed }).eq('id', n.id)
    ))
    setFolderOrder(prev => {
      const next = prev.map(f => f === oldName ? trimmed : f)
      if (typeof window !== 'undefined') localStorage.setItem(`npc_folder_order_${campaignId}`, JSON.stringify(next))
      return next
    })
    setRenamingFolder(null)
    await loadNpcs()
  }

  async function moveNpcToFolder(npcId: string, folderName: string) {
    await supabase.from('campaign_npcs').update({ folder: folderName === 'Uncategorized' ? null : folderName }).eq('id', npcId)
    setNpcs(prev => prev.map(n => n.id === npcId ? { ...n, folder: folderName === 'Uncategorized' ? null : folderName } : n))
  }

  function handleFolderDrop(targetFolder: string) {
    if (!dragFolderId || dragFolderId === targetFolder) { setDragFolderId(null); setDragOverFolderId(null); return }
    setFolderOrder(prev => {
      const fromIdx = prev.indexOf(dragFolderId!)
      const toIdx = prev.indexOf(targetFolder)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      if (typeof window !== 'undefined') localStorage.setItem(`npc_folder_order_${campaignId}`, JSON.stringify(next))
      return next
    })
    setDragFolderId(null)
    setDragOverFolderId(null)
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  async function handleClone(npc: CampaignNpc) {
    const baseName = npc.name.replace(/\s*#\d+$/, '')
    const existing = npcs.filter(n => n.name === baseName || n.name.startsWith(baseName + ' #'))
    const num = existing.length + 1
    const cloneName = `${baseName} #${num}`
    // Insert right after the source NPC — bump everything below down
    const srcSort = npc.sort_order ?? 0
    const below = npcs.filter(n => (n.sort_order ?? 0) > srcSort)
    if (below.length > 0) {
      await Promise.all(below.map(n =>
        supabase.from('campaign_npcs').update({ sort_order: (n.sort_order ?? 0) + 1 }).eq('id', n.id)
      ))
    }
    await supabase.from('campaign_npcs').insert({
      campaign_id: campaignId, name: cloneName, portrait_url: npc.portrait_url,
      reason: npc.reason, acumen: npc.acumen, physicality: npc.physicality,
      influence: npc.influence, dexterity: npc.dexterity, skills: npc.skills,
      notes: npc.notes, npc_type: npc.npc_type, status: 'active',
      wp_max: npc.wp_max, rp_max: npc.rp_max, wp_current: npc.wp_max, rp_current: npc.rp_max,
      equipment: npc.equipment, sort_order: srcSort + 1,
    })
    await loadNpcs()
  }

  const [showCombatPicker, setShowCombatPicker] = useState(false)
  const [combatPickerIds, setCombatPickerIds] = useState<Set<string>>(new Set())
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [showReveal, setShowReveal] = useState(false)
  const [revealIds, setRevealIds] = useState<Set<string>>(new Set())
  const [revealLevel, setRevealLevel] = useState<'name_portrait' | 'name_portrait_role'>('name_portrait')

  const availableForCombat = npcs.filter(n => {
    if (n.status !== 'active' || initiativeNpcIds?.has(n.id)) return false
    // Exclude dead NPCs (WP=0 and death countdown expired)
    const wp = n.wp_current ?? n.wp_max ?? 10
    if (wp === 0 && n.death_countdown != null && n.death_countdown <= 0) return false
    return true
  })

  function handleAddToCombat() {
    const selected = npcs.filter(n => combatPickerIds.has(n.id))
    if (selected.length > 0 && onAddToCombat) onAddToCombat(selected)
    setShowCombatPicker(false)
    setCombatPickerIds(new Set())
  }

  async function handleRelationshipChange(characterId: string, cmod: number) {
    if (!editingId) return
    const existing = relationships.find(r => r.character_id === characterId)
    if (existing) {
      await supabase.from('npc_relationships').update({ relationship_cmod: cmod }).eq('id', existing.id)
      setRelationships(prev => prev.map(r => r.id === existing.id ? { ...r, relationship_cmod: cmod } : r))
    } else {
      const { data } = await supabase.from('npc_relationships').insert({
        npc_id: editingId, character_id: characterId, relationship_cmod: cmod,
      }).select().single()
      if (data) setRelationships(prev => [...prev, data])
    }
  }

  async function handleRevealSave() {
    if (!editingId) return
    const pcs = pcEntries ?? []
    for (const pc of pcs) {
      const isRevealed = revealIds.has(pc.characterId)
      const existing = relationships.find(r => r.character_id === pc.characterId)
      if (existing) {
        await supabase.from('npc_relationships').update({ revealed: isRevealed, reveal_level: isRevealed ? revealLevel : null }).eq('id', existing.id)
      } else if (isRevealed) {
        await supabase.from('npc_relationships').insert({
          npc_id: editingId, character_id: pc.characterId, relationship_cmod: 0, revealed: true, reveal_level: revealLevel,
        })
      }
    }
    // Reload
    const { data: rels } = await supabase.from('npc_relationships').select('*').eq('npc_id', editingId)
    setRelationships(rels ?? [])
    setShowReveal(false)
  }

  function openReveal() {
    const alreadyRevealed = relationships.filter(r => r.revealed).map(r => r.character_id)
    const allPcIds = (pcEntries ?? []).map(pc => pc.characterId)
    const revealed = new Set(alreadyRevealed.length > 0 ? alreadyRevealed : allPcIds)
    setRevealIds(revealed)
    const firstLevel = relationships.find(r => r.revealed)?.reveal_level
    setRevealLevel((firstLevel as any) ?? 'name_portrait')
    setShowReveal(true)
  }

  // Generate
  const [generatedSummary, setGeneratedSummary] = useState<string>('')
  const [showGenerateTypePicker, setShowGenerateTypePicker] = useState(false)

  async function applyGenerated(typeOverride: string) {
    const npc = generateRandomNpc(typeOverride)
    // Pick a random UNUSED portrait — "used" = previously auto-assigned in THIS campaign.
    // Manual Library picks on the NPC edit form don't count. Recycles once exhausted.
    let portraitUrl: string | null = null
    try {
      const [allRes, usedRes] = await Promise.all([
        supabase.from('portrait_bank').select('url_256').eq('gender', npc.gender),
        supabase.from('campaign_portrait_usage').select('portrait_url').eq('campaign_id', campaignId).eq('gender', npc.gender),
      ])
      const all = (allRes.data ?? []) as { url_256: string }[]
      if (all.length > 0) {
        const usedSet = new Set((usedRes.data ?? []).map((r: any) => r.portrait_url))
        let unused = all.filter(p => !usedSet.has(p.url_256))
        if (unused.length === 0) {
          // Cycle exhausted — reset the log for this gender so we start fresh
          await supabase.from('campaign_portrait_usage').delete().eq('campaign_id', campaignId).eq('gender', npc.gender)
          unused = all
        }
        portraitUrl = unused[Math.floor(Math.random() * unused.length)].url_256
        // Log the assignment so we don't pick it again this cycle
        await supabase.from('campaign_portrait_usage').insert({ campaign_id: campaignId, portrait_url: portraitUrl, gender: npc.gender })
      }
    } catch { /* bank unavailable — skip portrait */ }
    setForm(f => ({
      ...f,
      name: npc.name,
      npc_type: npc.npc_type,
      reason: npc.reason,
      acumen: npc.acumen,
      physicality: npc.physicality,
      influence: npc.influence,
      dexterity: npc.dexterity,
      skillEntries: npc.skillEntries,
      notes: npc.notes,
      motivation: npc.motivation,
      complication: npc.complication,
      threeWords: npc.words,
      weapon: npc.weapon ?? null,
      portrait_url: portraitUrl ?? f.portrait_url,
    } as any))
    setGeneratedSummary(`Generated as ${npc.profession} — ${npc.motivation} / ${npc.complication}`)
    setShowGenerateTypePicker(false)
  }

  // Reveal tracking
  const [revealedNpcIds, setRevealedNpcIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadRevealed() {
      if (!isGM || !pcEntries || pcEntries.length === 0) return
      // Filter to this campaign's NPCs — earlier code scanned the full
      // npc_relationships table on every mount. For GMs with multiple
      // campaigns this fanned out across all of them.
      const npcIds = npcs.map((n: any) => n.id)
      if (npcIds.length === 0) { setRevealedNpcIds(new Set()); return }
      const { data } = await supabase.from('npc_relationships').select('npc_id').eq('revealed', true).in('npc_id', npcIds)
      if (data) setRevealedNpcIds(new Set(data.map((r: any) => r.npc_id)))
    }
    loadRevealed()
  }, [npcs, pcEntries])

  // Bulk reveal/hide helpers. Both Show-All / Hide-All buttons and the
  // per-folder Show/Hide buttons delegate here so the npc_relationships +
  // scene_tokens update logic lives in one place.
  async function revealNpcsByIds(npcIds: string[]) {
    if (!pcEntries || pcEntries.length === 0 || npcIds.length === 0) return
    const { data: existing } = await supabase.from('npc_relationships').select('id, npc_id, character_id').in('npc_id', npcIds)
    const seen = new Set<string>((existing ?? []).map((r: any) => `${r.npc_id}|${r.character_id}`))
    const updates = (existing ?? []).map((r: any) => r.id)
    const inserts: any[] = []
    for (const npcId of npcIds) {
      for (const pc of pcEntries) {
        const key = `${npcId}|${pc.characterId}`
        if (!seen.has(key)) inserts.push({ npc_id: npcId, character_id: pc.characterId, relationship_cmod: 0, revealed: true, reveal_level: 'name_portrait' })
      }
    }
    if (updates.length > 0) {
      await supabase.from('npc_relationships').update({ revealed: true, reveal_level: 'name_portrait' }).in('id', updates)
    }
    if (inserts.length > 0) {
      await supabase.from('npc_relationships').insert(inserts)
    }
    setRevealedNpcIds(prev => {
      const next = new Set(prev)
      for (const id of npcIds) next.add(id)
      return next
    })
    await supabase.from('scene_tokens').update({ is_visible: true }).in('npc_id', npcIds)
  }

  async function hideNpcsByIds(npcIds: string[]) {
    if (npcIds.length === 0) return
    await supabase.from('npc_relationships').update({ revealed: false, reveal_level: null }).in('npc_id', npcIds)
    setRevealedNpcIds(prev => {
      const next = new Set(prev)
      for (const id of npcIds) next.delete(id)
      return next
    })
    // Toggle is_visible on existing scene_tokens so positions are preserved
    // across Hide → Show. Realtime propagates this to players so they see
    // tokens vanish without refreshing; GMs continue to see hidden tokens
    // faded so they can keep working with the placement.
    await supabase.from('scene_tokens').update({ is_visible: false }).in('npc_id', npcIds)
  }

  async function revealAllNpcs() {
    await revealNpcsByIds(npcs.map(n => n.id))
  }

  async function hideAllNpcs() {
    await hideNpcsByIds(npcs.map(n => n.id))
  }

  // Inline disposition update for the roster card. Wraps the supabase
  // write + local state update so the picker on each card can fire
  // without opening the full Edit modal — fastest way to fix a
  // mis-set disposition in bulk.
  async function quickSetDisposition(npcId: string, value: 'friendly' | 'neutral' | 'hostile' | null) {
    const { error } = await supabase.from('campaign_npcs').update({ disposition: value }).eq('id', npcId)
    if (error) { alert('Error: ' + error.message); return }
    // Keep any existing tactical-map tokens in sync — without this, a
    // token placed when the NPC was Foe (red) keeps the red ring even
    // after the GM flips disposition to Neutral. Computes the new ring
    // color from the new disposition + existing npc_type fallback,
    // mirroring the placeFolderOnMap / placeTokenOnMap logic.
    const npc = npcs.find(n => n.id === npcId)
    const newColor = getNpcTokenBorderColor({ disposition: value, npc_type: npc?.npc_type ?? null })
    await supabase.from('scene_tokens').update({ color: newColor }).eq('npc_id', npcId)
    setNpcs(prev => prev.map(n => n.id === npcId ? ({ ...n, disposition: value } as any) : n))
  }

  async function quickReveal(npcId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!pcEntries || pcEntries.length === 0) return
    const isRevealed = revealedNpcIds.has(npcId)
    // Hard visibility gate — keeps the new hidden_from_players flag in
    // sync with the per-PC npc_relationships reveal rows. Without this
    // the RLS would still hide the NPC from players even after they're
    // "revealed" via npc_relationships.
    await supabase.from('campaign_npcs').update({ hidden_from_players: isRevealed }).eq('id', npcId)
    for (const pc of pcEntries) {
      const { data: existing } = await supabase.from('npc_relationships').select('id').eq('npc_id', npcId).eq('character_id', pc.characterId).maybeSingle()
      if (existing) {
        await supabase.from('npc_relationships').update({ revealed: !isRevealed, reveal_level: isRevealed ? null : 'name_portrait' }).eq('id', existing.id)
      } else if (!isRevealed) {
        await supabase.from('npc_relationships').insert({ npc_id: npcId, character_id: pc.characterId, relationship_cmod: 0, revealed: true, reveal_level: 'name_portrait' })
      }
    }
    setRevealedNpcIds(prev => {
      const next = new Set(prev)
      if (isRevealed) next.delete(npcId); else next.add(npcId)
      return next
    })
    // Sync token visibility on the tactical map
    await supabase.from('scene_tokens').update({ is_visible: !isRevealed }).eq('npc_id', npcId)
  }

  // Publish to World
  const [showPublish, setShowPublish] = useState(false)
  const [publishDesc, setPublishDesc] = useState('')
  const [publishSetting, setPublishSetting] = useState('custom')
  const [publishing, setPublishing] = useState(false)
  const [publishedNpcIds, setPublishedNpcIds] = useState<Set<string>>(new Set())

  // Browse Library
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryNpcs, setLibraryNpcs] = useState<any[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)

  useEffect(() => {
    // Check which NPCs have been published
    async function checkPublished() {
      const { data } = await supabase.from('world_npcs').select('source_campaign_npc_id').not('source_campaign_npc_id', 'is', null)
      if (data) setPublishedNpcIds(new Set(data.map((d: any) => d.source_campaign_npc_id!)))
    }
    if (isGM) checkPublished()
  }, [npcs])

  async function handlePublish() {
    if (!editingId) return
    setPublishing(true)
    const npc = npcs.find(n => n.id === editingId)
    if (!npc) { setPublishing(false); return }
    const { user } = await getCachedAuth()
    if (!user) { setPublishing(false); return }
    await supabase.from('world_npcs').insert({
      source_campaign_npc_id: npc.id,
      created_by: user.id,
      name: npc.name,
      portrait_url: npc.portrait_url,
      reason: npc.reason, acumen: npc.acumen, physicality: npc.physicality,
      influence: npc.influence, dexterity: npc.dexterity,
      skills: npc.skills,
      npc_type: npc.npc_type,
      public_description: publishDesc.trim() || null,
      setting: publishSetting,
      status: 'pending',
    })
    setPublishedNpcIds(prev => new Set([...prev, npc.id]))
    setShowPublish(false)
    setPublishing(false)
    setPublishDesc('')
  }

  async function openLibrary() {
    setShowLibrary(true)
    setLibraryLoading(true)
    const { data } = await supabase.from('world_npcs').select('*').eq('status', 'approved').order('import_count', { ascending: false })
    setLibraryNpcs(data ?? [])
    setLibraryLoading(false)
  }

  async function handleImport(worldNpc: any) {
    setImporting(worldNpc.id)
    await supabase.from('campaign_npcs').insert({
      campaign_id: campaignId,
      name: worldNpc.name,
      portrait_url: worldNpc.portrait_url,
      reason: worldNpc.reason, acumen: worldNpc.acumen, physicality: worldNpc.physicality,
      influence: worldNpc.influence, dexterity: worldNpc.dexterity,
      skills: worldNpc.skills,
      npc_type: worldNpc.npc_type,
      world_npc_id: worldNpc.id,
      status: 'active',
    })
    await supabase.from('world_npcs').update({ import_count: (worldNpc.import_count ?? 0) + 1 }).eq('id', worldNpc.id)
    setImporting(null)
    await loadNpcs()
  }

  function handleTypeChange(type: string) {
    setForm(f => {
      const preset = TYPE_PRESETS[type]
      if (preset) {
        return { ...f, npc_type: type, ...preset }
      }
      return { ...f, npc_type: type }
    })
  }

  const rapidField = (label: string, key: keyof typeof form, short: string) => (
    <div style={{ flex: 1, minWidth: '60px' }}>
      <div style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '3px', textAlign: 'center' }}>{short}</div>
      <select value={form[key] as number} onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) }))}
        style={{ width: '100%', padding: '4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', appearance: 'none' }}>
        {[-2, -1, 0, 1, 2, 3, 4].map(v => (
          <option key={v} value={v}>{v > 0 ? `+${v}` : v} {RAPID_LABELS[v]}</option>
        ))}
      </select>
    </div>
  )

  return (
    <>
      {showPortraitPicker && (
        <PortraitBankPicker
          onPick={url => setForm(f => ({ ...f, portrait_url: url }))}
          onClose={() => setShowPortraitPicker(false)}
        />
      )}
      {isGM && <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={openAdd}
          style={{ padding: '2px 8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Add NPC
        </button>
        {combatActive && availableForCombat.length > 0 && (
          <button onClick={() => { setCombatPickerIds(new Set()); setShowCombatPicker(true) }}
            style={{ padding: '2px 8px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + Combat
          </button>
        )}
        {npcs.length > 0 && (() => {
          const noPlayers = !pcEntries || pcEntries.length === 0
          const allRevealed = !noPlayers && npcs.every(n => revealedNpcIds.has(n.id))
          return (
            <button
              onClick={() => allRevealed ? hideAllNpcs() : revealAllNpcs()}
              disabled={noPlayers}
              title={noPlayers ? 'Add players to reveal NPCs to' : undefined}
              style={{ padding: '2px 8px', background: allRevealed ? '#2a1210' : '#1a2e10', border: `1px solid ${allRevealed ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allRevealed ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: noPlayers ? 'not-allowed' : 'pointer', opacity: noPlayers ? 0.5 : 1 }}>
              {allRevealed ? 'Hide All' : 'Show All'}
            </button>
          )
        })()}
        <div style={{ flex: 1 }} />
        <button onClick={openLibrary}
          style={{ padding: '2px 8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Library
        </button>
      </div>}
      {/* Search & filter — GM only */}
      {isGM && npcs.length > 3 && (
        <div style={{ padding: '4px 10px 6px' }}>
          <input value={npcSearch} onChange={e => setNpcSearch(e.target.value)} placeholder="Search NPCs..."
            style={{ width: '100%', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', boxSizing: 'border-box', marginBottom: '4px' }} />
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            {['friendly', 'goon', 'foe', 'antagonist'].map(t => {
              const tc = TYPE_COLORS[t]
              const active = npcTypeFilter === t
              return (
                <button key={t} onClick={() => setNpcTypeFilter(active ? null : t)}
                  style={{ padding: '1px 6px', borderRadius: '2px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', background: active ? tc.bg : 'transparent', border: `1px solid ${active ? tc.border : '#3a3a3a'}`, color: active ? tc.color : '#5a5550' }}>
                  {t}
                </button>
              )
            })}
            {['active', 'dead'].map(s => {
              const active = npcStatusFilter === s
              const sc = STATUS_COLORS[s]
              return (
                <button key={s} onClick={() => setNpcStatusFilter(active ? null : s)}
                  style={{ padding: '1px 6px', borderRadius: '2px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', background: active ? sc.bg : 'transparent', border: `1px solid ${active ? sc.border : '#3a3a3a'}`, color: active ? sc.color : '#5a5550' }}>
                  {s}
                </button>
              )
            })}
            {(npcSearch || npcTypeFilter || npcStatusFilter) && (
              <button onClick={() => { setNpcSearch(''); setNpcTypeFilter(null); setNpcStatusFilter(null) }}
                style={{ padding: '1px 6px', borderRadius: '2px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', background: 'none', border: '1px solid #3a3a3a', color: '#f5a89a' }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#cce0f5', fontSize: '13px' }}>Loading...</div>
          ) : npcs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
              <div style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>No NPCs yet</div>
            </div>
          ) : (
            (() => {
              const isDead = (n: CampaignNpc) => {
                const wp = n.wp_current ?? n.wp_max ?? 10
                return n.status === 'dead' || (wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
              }

              // Build the sorted NPC list
              let sortedNpcs: CampaignNpc[]
              if (combatActive && initiativeNpcOrder && initiativeNpcOrder.length > 0) {
                const idIdx = new Map(initiativeNpcOrder.map((id, i) => [id, i]))
                sortedNpcs = [...npcs].sort((a, b) => {
                  const ad = isDead(a) ? 1 : 0
                  const bd = isDead(b) ? 1 : 0
                  if (ad !== bd) return ad - bd
                  const ai = idIdx.has(a.id) ? idIdx.get(a.id)! : Infinity
                  const bi = idIdx.has(b.id) ? idIdx.get(b.id)! : Infinity
                  if (ai !== bi) return ai - bi
                  return 0
                })
              } else {
                sortedNpcs = [...npcs].sort((a, b) => {
                  const ad = isDead(a) ? 1 : 0
                  const bd = isDead(b) ? 1 : 0
                  return ad - bd
                })
              }

              // Apply search and filters
              if (npcSearch.trim()) {
                const q = npcSearch.trim().toLowerCase()
                sortedNpcs = sortedNpcs.filter(n => n.name.toLowerCase().includes(q) || (n.notes ?? '').toLowerCase().includes(q) || (n.folder ?? '').toLowerCase().includes(q))
              }
              if (npcTypeFilter) sortedNpcs = sortedNpcs.filter(n => n.npc_type === npcTypeFilter)
              if (npcStatusFilter) sortedNpcs = sortedNpcs.filter(n => npcStatusFilter === 'dead' ? isDead(n) : !isDead(n))

              const renderNpcCard = (npc: CampaignNpc) => {
              const sc = STATUS_COLORS[npc.status] ?? STATUS_COLORS.active
              return (
                <div key={npc.id} onClick={() => onViewNpc ? onViewNpc(npc) : openEdit(npc)}
                  onDragOver={e => { if (dragId) { e.preventDefault(); setDragOverId(npc.id) } }}
                  onDragLeave={() => { if (dragOverId === npc.id) setDragOverId(null) }}
                  onDrop={() => handleNpcDrop(npc.id)}
                  style={{ padding: '6px 8px', background: dragOverId === npc.id ? '#242424' : viewingNpcIds?.has(npc.id) ? '#1a1a2e' : '#1a1a1a', border: `1px solid ${dragOverId === npc.id ? '#7fc458' : viewingNpcIds?.has(npc.id) ? '#8b2e8b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer', transition: 'background 0.15s', opacity: dragId === npc.id ? 0.4 : 1 }}
                  onMouseEnter={e => { if (!dragId) e.currentTarget.style.background = '#242424' }}
                  onMouseLeave={e => { if (!dragId && dragOverId !== npc.id) e.currentTarget.style.background = viewingNpcIds?.has(npc.id) ? '#1a1a2e' : '#1a1a1a' }}
                >
                <div style={{ display: 'flex', gap: '6px' }}>
                  {/* Left column: drag handle + delete */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                    <div
                      draggable
                      onDragStart={e => { e.stopPropagation(); setDragId(npc.id) }}
                      onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                      onClick={e => e.stopPropagation()}
                      title="Drag to reorder"
                      style={{ cursor: 'grab', color: '#3a3a3a', fontSize: '14px', lineHeight: 1, userSelect: 'none' }}
                    >⠿</div>
                    <button onClick={e => { e.stopPropagation(); handleDelete(npc.id, npc.name) }}
                      title="Remove NPC"
                      style={{ fontSize: '13px', padding: '0 3px', borderRadius: '2px', background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', lineHeight: 1.2 }}>
                      ×
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleClone(npc) }}
                      title="Clone NPC"
                      style={{ fontSize: '13px', padding: '0 3px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', lineHeight: 1.4, textTransform: 'uppercase' }}>
                      +
                    </button>
                    <button onClick={e => { e.stopPropagation(); openEdit(npc) }}
                      title="Edit NPC"
                      style={{ fontSize: '13px', padding: '0 3px', borderRadius: '2px', background: '#242424', border: '1px solid #3a3a3a', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', lineHeight: 1.4, textTransform: 'uppercase' }}>
                      ✎
                    </button>
                  </div>
                  {/* Center: name + badges */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1.2 }}>{npc.name}</div>
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '3px', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', padding: '1px 4px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{npc.status}</span>
                      {/* Inline disposition picker — three dots
                          (friendly / neutral / hostile). Click cycles
                          to that value; clicking the already-picked
                          dot clears it back to null (which falls back
                          to npc_type via getNpcRingColor). The picked
                          dot gets a white outline so the current value
                          is unmistakable from a glance. */}
                      <span title={`Disposition: ${npc.disposition ?? 'unset'} · npc_type: ${npc.npc_type ?? 'unset'}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0 2px' }}>
                        {([
                          ['friendly', '#2d5a1b', '#1a2e10'],
                          ['neutral',  '#a17a14', '#2a2010'],
                          ['hostile',  '#c0392b', '#2a1210'],
                        ] as const).map(([val, border, bg]) => {
                          const picked = npc.disposition === val
                          return (
                            <button key={val} type="button"
                              onClick={e => { e.stopPropagation(); quickSetDisposition(npc.id, picked ? null : val) }}
                              title={`Set disposition: ${val}${picked ? ' (click to clear)' : ''}`}
                              style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${border}`, background: bg, cursor: 'pointer', padding: 0, outline: picked ? '2px solid #f5f2ee' : 'none', outlineOffset: '1px' }} />
                          )
                        })}
                        {/* Diagnostic — shows the actual disposition value
                            stored in the roster's local state. If this
                            says "—" but you've set the disposition in a
                            popout, the realtime sub on campaign_npcs
                            isn't firing — run
                            sql/campaign-npcs-realtime-publication.sql. */}
                        <span style={{ fontSize: '13px', color: npc.disposition === 'friendly' ? '#7fc458' : npc.disposition === 'hostile' ? '#f5a89a' : npc.disposition === 'neutral' ? '#fcd34d' : '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginLeft: '2px' }}>
                          {npc.disposition ?? '—'}
                        </span>
                      </span>
                      <button onClick={e => quickReveal(npc.id, e)}
                        style={{ fontSize: '13px', padding: '1px 4px', borderRadius: '2px', background: revealedNpcIds.has(npc.id) ? '#2a1210' : '#1a2e10', border: `1px solid ${revealedNpcIds.has(npc.id) ? '#c0392b' : '#2d5a1b'}`, color: revealedNpcIds.has(npc.id) ? '#f5a89a' : '#7fc458', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                        {revealedNpcIds.has(npc.id) ? 'Hide' : 'Show'}
                      </button>
                      {combatActive && !initiativeNpcIds?.has(npc.id) && !((npc.wp_current ?? npc.wp_max ?? 10) === 0 && npc.death_countdown != null && npc.death_countdown <= 0) && (
                        <button onClick={e => { e.stopPropagation(); onAddToCombat?.([npc]) }}
                          style={{ fontSize: '13px', padding: '1px 4px', borderRadius: '2px', background: '#7a1f16', border: '1px solid #c0392b', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Fight
                        </button>
                      )}
                      {onPlaceOnMap && (() => {
                        const isOnMap = npcIdsOnMap?.has(npc.id) ?? false
                        return (
                          <button onClick={e => { e.stopPropagation(); isOnMap && onRemoveFromMap ? onRemoveFromMap(npc) : onPlaceOnMap(npc) }}
                            style={{ fontSize: '13px', padding: '1px 4px', borderRadius: '2px', background: isOnMap ? '#1a2e10' : '#2a2010', border: `1px solid ${isOnMap ? '#2d5a1b' : '#5a4a1b'}`, color: isOnMap ? '#7fc458' : '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Map
                          </button>
                        )
                      })()}
                      <button onClick={e => { e.stopPropagation(); openPopout(`/npc-sheet?c=${campaignId}&npc=${npc.id}&gm=${isGM ? 1 : 0}`, `npc-${npc.id}`, { w: 571, h: 400 }) }}
                        title="Pop this NPC out into its own window"
                        style={{ fontSize: '13px', padding: '1px 4px', borderRadius: '2px', background: '#2a102a', border: '1px solid #8b2e8b', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Popout
                      </button>
                      {publishedNpcIds.has(npc.id) && <span style={{ fontSize: '13px', padding: '1px 4px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>Published</span>}
                    </div>
                  </div>
                  {/* Right: portrait — ring color comes from disposition
                      first, npc_type as a fallback (so a Foe-typed NPC
                      with no explicit disposition still rings red, a
                      Bystander rings green, etc.). Same helper drives
                      the tactical-map token border so the two surfaces
                      can never disagree. */}
                  {(() => {
                    const ring = getNpcRingColor(npc)
                    // Use the vivid border (same as the tactical map
                    // tokens) so the roster reads at a glance without
                    // squinting at the dim base palette. Background +
                    // text color stay muted so the portrait stays
                    // legible.
                    const vividBorder = getNpcTokenBorderColor(npc)
                    return (
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: ring.bg, border: `2px solid ${vividBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {npc.portrait_url ? (
                          <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '15px', fontWeight: 700, color: ring.color, fontFamily: 'Carlito, sans-serif' }}>{getInitials(npc.name)}</span>
                        )}
                      </div>
                    )
                  })()}
                </div>
                </div>
              )
              }

              // Folder tree renders in both combat and non-combat modes — GMs
              // with lots of NPCs want groupings visible so they can scan by
              // faction / encounter batch while combat is live.

              // Recruited NPCs float to a pinned Community section; the rest
              // stay in their regular folders.
              const recruitedNpcs = sortedNpcs.filter(n => communityMap[n.id])
              const unrecruitedNpcs = sortedNpcs.filter(n => !communityMap[n.id])

              // Group recruited NPCs by community name.
              const communityGroups: Record<string, CampaignNpc[]> = {}
              for (const npc of recruitedNpcs) {
                const cname = communityMap[npc.id].communityName
                if (!communityGroups[cname]) communityGroups[cname] = []
                communityGroups[cname].push(npc)
              }

              const folderMap: Record<string, CampaignNpc[]> = {}
              for (const npc of unrecruitedNpcs) {
                const f = npc.folder ?? 'Uncategorized'
                if (!folderMap[f]) folderMap[f] = []
                folderMap[f].push(npc)
              }
              // Build ordered folder list — saved order first, then any new folders
              const allFolderNames = Object.keys(folderMap)
              const ordered = [...folderOrder.filter(f => allFolderNames.includes(f)), ...allFolderNames.filter(f => !folderOrder.includes(f))]
              // Sync folderOrder if new folders appeared
              if (ordered.length !== folderOrder.length || ordered.some((f, i) => f !== folderOrder[i])) {
                setFolderOrder(ordered)
                if (typeof window !== 'undefined') localStorage.setItem(`npc_folder_order_${campaignId}`, JSON.stringify(ordered))
              }

              // Community sections rendered before regular folders.
              const communitySections = Object.entries(communityGroups).map(([cname, cnpcs]) => {
                const key = `__community__${cname}`
                const isOpen = expandedFolders.has(key)
                // Same SHOW/HIDE toggle as regular folders. Community
                // groups are just NPC collections — the underlying
                // place/reveal operations work the same way.
                const cIds = cnpcs.map(n => n.id)
                const cAllRevealed = cIds.length > 0 && cIds.every(id => revealedNpcIds.has(id))
                const cLabel = cAllRevealed ? 'Hide' : 'Show'
                const cUnplaced = npcIdsOnMap
                  ? cnpcs.filter(n => !npcIdsOnMap.has(n.id))
                  : cnpcs
                return (
                  <div key={key} style={{ marginBottom: '2px' }}>
                    <div onClick={() => toggleFolder(key)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', cursor: 'pointer', borderRadius: '3px', background: 'transparent', borderBottom: '1px solid #2e2e2e', userSelect: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: '13px', color: '#5a5550', width: '12px', textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</span>
                      <span style={{ fontSize: '13px', color: '#7fc458', marginRight: '2px' }}>🏘</span>
                      <span style={{ flex: 1, fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>Community — {cname}</span>
                      {cnpcs.length > 0 && (
                        <button onClick={async e => {
                          e.stopPropagation()
                          if (cAllRevealed) {
                            if (onUnmapFolder) await onUnmapFolder(cnpcs)
                            await hideNpcsByIds(cIds)
                          } else {
                            if (onPlaceFolderOnMap && cUnplaced.length > 0) {
                              await onPlaceFolderOnMap(cUnplaced)
                            }
                            await revealNpcsByIds(cIds)
                          }
                          onTacticalRefresh?.()
                        }}
                          title={cAllRevealed
                            ? `Hide all ${cnpcs.length} NPCs (vanish from every map; positions preserved)`
                            : `Place + reveal all ${cnpcs.length} NPCs (visible to GM + players)`}
                          style={{ padding: '1px 8px', background: cAllRevealed ? '#2a1210' : '#1a2e10', border: `1px solid ${cAllRevealed ? '#7a1f16' : '#2d5a1b'}`, borderRadius: '2px', color: cAllRevealed ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', lineHeight: 1.3 }}>
                          {cLabel}
                        </button>
                      )}
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>{cnpcs.length}</span>
                    </div>
                    {isOpen && cnpcs.map(renderNpcCard)}
                  </div>
                )
              })

              return [...communitySections, ...(isGM ? ordered : []).map(folderName => {
                const folderNpcs = folderMap[folderName] ?? []
                if (folderNpcs.length === 0) return null
                const isOpen = expandedFolders.has(folderName)
                return (
                  <div key={folderName}
                    onDragOver={e => { if (dragFolderId) { e.preventDefault(); setDragOverFolderId(folderName) } }}
                    onDragLeave={() => { if (dragOverFolderId === folderName) setDragOverFolderId(null) }}
                    onDrop={() => {
                      if (dragFolderId) handleFolderDrop(folderName)
                      if (dragId) { moveNpcToFolder(dragId, folderName); setDragId(null) }
                    }}
                    style={{ marginBottom: '2px' }}>
                    <div
                      draggable
                      onDragStart={() => setDragFolderId(folderName)}
                      onDragEnd={() => { setDragFolderId(null); setDragOverFolderId(null) }}
                      onClick={() => toggleFolder(folderName)}
                      onDoubleClick={e => { e.stopPropagation(); setRenamingFolder(folderName); setRenameValue(folderName) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', cursor: 'pointer', borderRadius: '3px', background: dragOverFolderId === folderName ? '#242424' : 'transparent', borderBottom: '1px solid #2e2e2e', userSelect: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                      onMouseLeave={e => (e.currentTarget.style.background = dragOverFolderId === folderName ? '#242424' : 'transparent')}>
                      <span style={{ fontSize: '13px', color: '#5a5550', width: '12px', textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</span>
                      {renamingFolder === folderName ? (
                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => renameFolder(folderName, renameValue)}
                          onKeyDown={e => { if (e.key === 'Enter') renameFolder(folderName, renameValue); if (e.key === 'Escape') setRenamingFolder(null) }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          style={{ flex: 1, padding: '1px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none' }} />
                      ) : (
                        <span style={{ flex: 1, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{folderName}</span>
                      )}
                      {/* One-button folder toggle that does EVERYTHING.
                          SHOW: place any missing tokens (or un-archive
                          existing ones to restore prior positions) +
                          set revealed=true + is_visible=true. Result:
                          tokens visible on every map (GM + players) AND
                          listed in the player NPC sidebar. HIDE: archive
                          all tokens (so they vanish from every map —
                          GM included — but the row keeps grid_x / grid_y
                          / scale / rotation for the next SHOW) + set
                          revealed=false. Position is never lost. */}
                      {folderNpcs.length > 0 && (() => {
                        // Gate previously required pcEntries.length > 0 (a
                        // PC must be in the session). Dropped per playtest:
                        // GM testing solo / before players join still wants
                        // to place + hide tokens on the map. The reveal-
                        // to-players half just becomes a no-op when there
                        // are no PCs to reveal to.
                        const folderIds = folderNpcs.map(n => n.id)
                        const allRevealed = folderIds.every(id => revealedNpcIds.has(id))
                        const label = allRevealed ? 'Hide' : 'Show'
                        const unplaced = npcIdsOnMap
                          ? folderNpcs.filter(n => !npcIdsOnMap.has(n.id))
                          : folderNpcs
                        return (
                          <button onClick={async e => {
                            e.stopPropagation()
                            if (allRevealed) {
                              // HIDE: archive tokens (off every map,
                              // position preserved) + sidebar reveal off.
                              if (onUnmapFolder) await onUnmapFolder(folderNpcs)
                              await hideNpcsByIds(folderIds)
                            } else {
                              // SHOW: place / un-archive first, then
                              // reveal so players see them on their
                              // canvas + sidebar in one click.
                              if (onPlaceFolderOnMap && unplaced.length > 0) {
                                await onPlaceFolderOnMap(unplaced)
                              }
                              await revealNpcsByIds(folderIds)
                            }
                            // Final nudge so player TacticalMaps
                            // re-fetch and pick up the latest
                            // is_visible / archived_at state. Without
                            // this the player has to manually refresh
                            // because postgres_changes on scene_tokens
                            // is unreliable for is_visible UPDATEs.
                            onTacticalRefresh?.()
                          }}
                            title={allRevealed
                              ? `Hide all ${folderNpcs.length} NPCs (vanish from every map; positions preserved)`
                              : `Place + reveal all ${folderNpcs.length} NPCs (visible to GM + players)`}
                            style={{ padding: '1px 8px', background: allRevealed ? '#2a1210' : '#1a2e10', border: `1px solid ${allRevealed ? '#7a1f16' : '#2d5a1b'}`, borderRadius: '2px', color: allRevealed ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', lineHeight: 1.3 }}>
                            {label}
                          </button>
                        )
                      })()}
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>{folderNpcs.length}</span>
                    </div>
                    {isOpen && folderNpcs.map(renderNpcCard)}
                  </div>
                )
              })]
            })()
          )}
      </div>

      {/* Add/Edit NPC Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', width: '560px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>
                {editingId ? 'Edit NPC' : 'Add NPC'}
              </span>
              <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
                {form.name || 'New NPC'}
              </span>
            </div>

            {/* Generate button */}
            {!editingId && (
              <div style={{ marginBottom: '8px' }}>
                {!showGenerateTypePicker ? (
                  <button onClick={() => setShowGenerateTypePicker(true)} type="button"
                    style={{ width: '100%', padding: '4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    ⚄ Generate NPC
                  </button>
                ) : (
                  <div>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Select NPC type to generate:</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['bystander', 'goon', 'foe', 'antagonist'].map(t => {
                        const tc = TYPE_COLORS[t]
                        return <button key={t} onClick={() => applyGenerated(t)} type="button"
                          style={{ flex: 1, padding: '4px', background: tc?.bg, border: `1px solid ${tc?.border}`, borderRadius: '3px', color: tc?.color, fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          {t}
                        </button>
                      })}
                    </div>
                  </div>
                )}
                {generatedSummary && (
                  <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', fontStyle: 'italic', marginTop: '4px' }}>
                    {generatedSummary}
                  </div>
                )}
              </div>
            )}

            {/* Portrait + bank + upload + status on one row. Ring
                color = npc_type color; changes as soon as the user
                picks a type. Placeholder bank lets them pick a
                colored silhouette as the INSIDE image. */}
            {(() => {
              const ring = getNpcRingColor({ disposition: form.disposition || null, npc_type: form.npc_type || null })
              return (
                <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: ring.bg, border: `2px solid ${ring.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {form.portrait_url ? (
                      <img src={form.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 700, color: ring.color, fontFamily: 'Carlito, sans-serif' }}>{form.name ? getInitials(form.name) : '?'}</span>
                    )}
                  </div>
                  {/* Disposition picker — sets the ring color (friendly
                      green / neutral yellow / hostile red). Independent
                      of portrait; can pick any disposition whether or
                      not there's an uploaded image. */}
                  <div style={{ display: 'flex', gap: '3px' }} title="Disposition — drives ring color">
                    {([
                      ['friendly', '#2d5a1b', '#1a2e10'],
                      ['neutral',  '#a17a14', '#2a2010'],
                      ['hostile',  '#c0392b', '#2a1210'],
                    ] as const).map(([val, border, bg]) => {
                      const picked = form.disposition === val
                      return (
                        <button key={val} type="button"
                          onClick={() => setForm(f => ({ ...f, disposition: picked ? '' : val }))}
                          title={val}
                          style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${border}`, background: bg, cursor: 'pointer', padding: 0, outline: picked ? '2px solid #f5f2ee' : 'none', outlineOffset: '1px' }} />
                      )
                    })}
                  </div>
              <label style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
                {uploading ? '...' : 'Upload'}
                <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handlePortraitUpload(e.target.files[0]) }} />
              </label>
              <button type="button" onClick={() => setShowPortraitPicker(true)}
                style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
                Library
              </button>
              {form.portrait_url && (
                <button onClick={() => setForm(f => ({ ...f, portrait_url: null }))}
                  style={{ background: 'none', border: 'none', color: '#cce0f5', fontSize: '13px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif', flexShrink: 0 }}>×</button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', flexShrink: 0 }}>
                {[['active', '#7fc458', '#1a2e10', '#2d5a1b'], ['dead', '#f5a89a', '#2a1210', '#c0392b'], ['unknown', '#7ab3d4', '#1a1a2e', '#2e2e5a']].map(([val, color, bg, border]) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({ ...f, status: val }))}
                    style={{ padding: '2px 6px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '2px', border: `1px solid ${form.status === val ? border : '#3a3a3a'}`, background: form.status === val ? bg : 'transparent', color: form.status === val ? color : '#3a3a3a' }}>
                    {val}
                  </button>
                ))}
              </div>
            </div>
              )
            })()}

            {/* Name + Type on one row */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Name</div>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
                  style={{ width: '100%', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ width: '130px', flexShrink: 0 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Type</div>
              <select value={form.npc_type} onChange={e => handleTypeChange(e.target.value)}
                style={{ width: '100%', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                <option value="">No type</option>
                <option value="bystander">Bystander</option>
                <option value="goon">Goon</option>
                <option value="foe">Foe</option>
                <option value="antagonist">Antagonist</option>
              </select>
              </div>
            </div>

            {/* RAPID */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>RAPID</div>
              {form.npc_type === 'antagonist' && (
                <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', padding: '6px 8px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px' }}>
                  Choose one attribute to set to 3, two others to 2, and one to 1.
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px' }}>
                {rapidField('Reason', 'reason', 'RSN')}
                {rapidField('Acumen', 'acumen', 'ACU')}
                {rapidField('Physicality', 'physicality', 'PHY')}
                {rapidField('Influence', 'influence', 'INF')}
                {rapidField('Dexterity', 'dexterity', 'DEX')}
              </div>
            </div>

            {/* Skills */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Skills</div>
              {form.skillEntries.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  <select value={s.name} onChange={e => setForm(f => ({ ...f, skillEntries: f.skillEntries.map((sk, j) => j === i ? { ...sk, name: e.target.value } : sk) }))}
                    style={{ flex: 1, padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                    <option value="">Select skill...</option>
                    {ALL_SKILLS.map(sk => <option key={sk} value={sk}>{sk}</option>)}
                  </select>
                  <select value={s.level} onChange={e => setForm(f => ({ ...f, skillEntries: f.skillEntries.map((sk, j) => j === i ? { ...sk, level: parseInt(e.target.value) } : sk) }))}
                    style={{ width: '60px', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', appearance: 'none' }}>
                    {[-3, -2, -1, 0, 1, 2, 3, 4].map(v => <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>)}
                  </select>
                  <button onClick={() => setForm(f => ({ ...f, skillEntries: f.skillEntries.filter((_, j) => j !== i) }))} type="button"
                    style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</button>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, skillEntries: [...f.skillEntries, { name: '', level: 1 }] }))} type="button"
                style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', marginTop: '4px' }}>
                + Add Skill
              </button>
              {form.npc_type && SKILL_HINTS[form.npc_type] && (
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginTop: '6px', fontStyle: 'italic' }}>
                  {SKILL_HINTS[form.npc_type]}
                </div>
              )}
            </div>

            {/* Motivation & Complication */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Motivation</div>
                <select value={form.motivation} onChange={e => setForm(f => ({ ...f, motivation: e.target.value }))}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                  <option value="">None</option>
                  {MOTIVATIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Complication</div>
                <select value={form.complication} onChange={e => setForm(f => ({ ...f, complication: e.target.value }))}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                  <option value="">None</option>
                  {COMPLICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Three Words */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Three Words</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2].map(i => (
                  <select key={i} value={form.threeWords[i] || ''} onChange={e => setForm(f => ({ ...f, threeWords: f.threeWords.map((w, j) => j === i ? e.target.value : w) }))}
                    style={{ flex: 1, padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                    <option value="">-</option>
                    {PERSONALITY_WORDS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                ))}
              </div>
            </div>

            {/* Weapon */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Weapon</div>
              <select value={(form as any).weapon?.weaponName ?? ''} onChange={e => {
                const weaponName = e.target.value
                if (!weaponName) { setForm(f => ({ ...f, weapon: null } as any)); return }
                const w = getWeaponByName(weaponName)
                setForm(f => ({ ...f, weapon: { weaponName, condition: 'Used', ammoCurrent: w?.clip ?? 0, ammoMax: w?.clip ?? 0, reloads: w?.ammo ? 2 : 0 } } as any))
              }}
                style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                <option value="">— None —</option>
                <optgroup label="Melee">{MELEE_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                <optgroup label="Ranged">{RANGED_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                <optgroup label="Explosive">{EXPLOSIVE_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                <optgroup label="Heavy">{HEAVY_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
              </select>
              {(form as any).weapon?.weaponName && (() => {
                const w = getWeaponByName((form as any).weapon.weaponName)
                return w ? (
                  <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                    {w.skill} · {w.range} · DMG <span style={{ color: '#c0392b', fontWeight: 700 }}>{w.damage}</span> · RP <span style={{ color: '#7ab3d4' }}>{w.rpPercent}%</span>
                  </div>
                ) : null
              })()}
            </div>

            {/* Secondary Weapon (Foe/Antagonist only) */}
            {(form.npc_type === 'foe' || form.npc_type === 'antagonist') && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Secondary Weapon</div>
                <select value={(form as any).weapon2?.weaponName ?? ''} onChange={e => {
                  const weaponName = e.target.value
                  if (!weaponName) { setForm(f => ({ ...f, weapon2: null } as any)); return }
                  const w = getWeaponByName(weaponName)
                  setForm(f => ({ ...f, weapon2: { weaponName, condition: 'Used', ammoCurrent: w?.clip ?? 0, ammoMax: w?.clip ?? 0, reloads: w?.ammo ? 2 : 0 } } as any))
                }}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                  <option value="">— None —</option>
                  <optgroup label="Melee">{MELEE_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                  <optgroup label="Ranged">{RANGED_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                  <optgroup label="Explosive">{EXPLOSIVE_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                  <optgroup label="Heavy">{HEAVY_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                </select>
                {(form as any).weapon2?.weaponName && (() => {
                  const w = getWeaponByName((form as any).weapon2.weaponName)
                  return w ? (
                    <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                      {w.skill} · {w.range} · DMG <span style={{ color: '#c0392b', fontWeight: 700 }}>{w.damage}</span> · RP <span style={{ color: '#7ab3d4' }}>{w.rpPercent}%</span>
                    </div>
                  ) : null
                })()}
              </div>
            )}

            {/* Folder */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Folder</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select value={form.folder} onChange={e => setForm(f => ({ ...f, folder: e.target.value }))}
                  style={{ flex: 1, padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                  <option value="">Uncategorized</option>
                  {[...new Set(npcs.map(n => n.folder).filter(Boolean))].map(f => (
                    <option key={f} value={f!}>{f}</option>
                  ))}
                </select>
                <input value={form.folder} onChange={e => setForm(f => ({ ...f, folder: e.target.value }))}
                  placeholder="Or type new..."
                  style={{ width: '100px', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>GM Notes <span style={{ color: '#cce0f5', opacity: 0.6 }}>(private)</span></div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Private notes — never shown to players"
                rows={3}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
            </div>

            {/* Relationships (edit only) */}
            {editingId && pcEntries && pcEntries.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Relationships — First Impressions</div>
                {pcEntries.map(pc => {
                  const rel = relationships.find(r => r.character_id === pc.characterId)
                  const cmod = rel?.relationship_cmod ?? 0
                  return (
                    <div key={pc.characterId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: '80px' }}>{pc.characterName}</span>
                      <select value={cmod} onChange={e => handleRelationshipChange(pc.characterId, parseInt(e.target.value))}
                        style={{ flex: 1, padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: cmod > 0 ? '#7fc458' : cmod < 0 ? '#f5a89a' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
                        {FIRST_IMPRESSIONS.map(fi => (
                          <option key={fi.value} value={fi.value}>{fi.value > 0 ? `+${fi.value}` : fi.value} — {fi.label}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Reveal to Players (edit only) */}
            {editingId && pcEntries && pcEntries.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {!showReveal ? (
                  <button onClick={openReveal}
                    style={{ width: '100%', padding: '8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Reveal to Players
                  </button>
                ) : (
                  <div style={{ padding: '10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                    <div style={{ fontSize: '13px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>Reveal to Players</div>
                    <div style={{ marginBottom: '8px' }}>
                      {pcEntries.map(pc => (
                        <label key={pc.characterId} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', cursor: 'pointer', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                          <input type="checkbox" checked={revealIds.has(pc.characterId)} onChange={() => {
                            setRevealIds(prev => { const n = new Set(prev); if (n.has(pc.characterId)) n.delete(pc.characterId); else n.add(pc.characterId); return n })
                          }} style={{ accentColor: '#7ab3d4' }} />
                          {pc.characterName}
                        </label>
                      ))}
                    </div>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>What to reveal:</div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>
                        <input type="radio" checked={revealLevel === 'name_portrait'} onChange={() => setRevealLevel('name_portrait')} style={{ accentColor: '#7ab3d4' }} />
                        Name + Portrait
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>
                        <input type="radio" checked={revealLevel === 'name_portrait_role'} onChange={() => setRevealLevel('name_portrait_role')} style={{ accentColor: '#7ab3d4' }} />
                        Name + Portrait + Role
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowReveal(false)} style={{ flex: 1, padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={handleRevealSave} style={{ flex: 1, padding: '6px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Save Reveal</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Publish to World */}
            {editingId && !publishedNpcIds.has(editingId) && (
              <div style={{ marginBottom: '1rem' }}>
                {!showPublish ? (
                  <button onClick={() => setShowPublish(true)}
                    style={{ width: '100%', padding: '8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Publish to World Library
                  </button>
                ) : (
                  <div style={{ padding: '10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                    <div style={{ fontSize: '13px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>Publish to World</div>
                    <textarea value={publishDesc} onChange={e => setPublishDesc(e.target.value)}
                      placeholder="Public description — what other GMs will see"
                      rows={2}
                      style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', marginBottom: '6px' }} />
                    <select value={publishSetting} onChange={e => setPublishSetting(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', appearance: 'none', marginBottom: '8px' }}>
                      <option value="custom">Custom Setting</option>
                      <option value="district_zero">District Zero</option>
                      <option value="chased">Chased</option>
                    </select>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowPublish(false)} style={{ flex: 1, padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={handlePublish} disabled={publishing} style={{ flex: 1, padding: '6px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: publishing ? 'not-allowed' : 'pointer', opacity: publishing ? 0.5 : 1 }}>
                        {publishing ? 'Publishing...' : 'Submit for Review'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {editingId && publishedNpcIds.has(editingId) && (
              <div style={{ marginBottom: '1rem', padding: '6px 10px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center' }}>
                Submitted to World Library
              </div>
            )}

            {/* Status */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Status</div>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                <option value="active">Active</option>
                <option value="dead">Dead</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              {editingId && (
                <button onClick={() => { handleDelete(editingId, form.name); setShowForm(false) }}
                  style={{ padding: '10px 14px', background: 'none', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Delete</button>
              )}
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
                {saving ? 'Saving...' : editingId ? 'Save' : 'Add NPC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Combat picker */}
      {showCombatPicker && (
        <div onClick={() => setShowCombatPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '360px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Add to Combat</div>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>Select NPCs</div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {availableForCombat.map(npc => (
                <label key={npc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: combatPickerIds.has(npc.id) ? '#2a1210' : '#1a1a1a', border: `1px solid ${combatPickerIds.has(npc.id) ? '#c0392b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={combatPickerIds.has(npc.id)} onChange={() => {
                    setCombatPickerIds(prev => {
                      const next = new Set(prev)
                      if (next.has(npc.id)) next.delete(npc.id)
                      else next.add(npc.id)
                      return next
                    })
                  }} style={{ accentColor: '#c0392b' }} />
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {npc.portrait_url ? <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Carlito, sans-serif' }}>{getInitials(npc.name)}</span>}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowCombatPicker(false)} style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddToCombat} disabled={combatPickerIds.size === 0}
                style={{ flex: 2, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: combatPickerIds.size === 0 ? 'not-allowed' : 'pointer', opacity: combatPickerIds.size === 0 ? 0.5 : 1 }}>
                Add {combatPickerIds.size > 0 ? `(${combatPickerIds.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Browse Library modal */}
      {showLibrary && (
        <div onClick={() => setShowLibrary(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: '#7ab3d4', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>World NPC Library</div>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>Browse &amp; Import</div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {libraryLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#cce0f5', fontSize: '13px' }}>Loading...</div>
              ) : libraryNpcs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>No approved NPCs in the library yet.</div>
              ) : (
                libraryNpcs.map((npc: any) => (
                  <div key={npc.id} style={{ padding: '10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {npc.portrait_url ? <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Carlito, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                          {npc.npc_type && <span style={{ fontSize: '13px', padding: '0 4px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
                          {npc.setting && <span style={{ fontSize: '13px', padding: '0 4px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{npc.setting === 'district_zero' ? 'District Zero' : npc.setting === 'chased' ? 'Chased' : 'Custom'}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleImport(npc)} disabled={importing === npc.id}
                        style={{ padding: '4px 10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: importing === npc.id ? 'not-allowed' : 'pointer', opacity: importing === npc.id ? 0.5 : 1, flexShrink: 0 }}>
                        {importing === npc.id ? '...' : 'Import'}
                      </button>
                    </div>
                    {npc.public_description && (
                      <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5 }}>{npc.public_description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowLibrary(false)} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}

// Memo so unrelated parent re-renders skip the roster. Default
// shallow comparison; parent passes data props by reference (npcs,
// pcEntries, externalNpcs) and stabilized callbacks via useStableCallback.
const NpcRoster = memo(NpcRosterImpl)
export default NpcRoster
