'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase-browser'
import { generateRandomNpc, ALL_SKILLS, SkillEntry } from '../lib/npc-generator'
import { resizeImage } from '../lib/image-utils'
import { MELEE_WEAPONS, RANGED_WEAPONS, EXPLOSIVE_WEAPONS, HEAVY_WEAPONS, getWeaponByName } from '../lib/weapons'

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
  goon: { bg: '#2a2010', border: '#5a4a1b', color: '#EF9F27' },
  foe: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  antagonist: { bg: '#2a102a', border: '#8b2e8b', color: '#d48bd4' },
}

const PORTRAIT_BANK = [
  { label: 'M1', bg: '#2a1210', color: '#c0392b' },
  { label: 'M2', bg: '#1a2e10', color: '#7fc458' },
  { label: 'F1', bg: '#1a1a2e', color: '#7ab3d4' },
  { label: 'F2', bg: '#2a2010', color: '#EF9F27' },
  { label: 'N1', bg: '#2a102a', color: '#d48bd4' },
  { label: 'N2', bg: '#1a2e2e', color: '#58c4c4' },
  { label: 'X1', bg: '#2e2e2e', color: '#d4cfc9' },
  { label: 'X2', bg: '#1a1a1a', color: '#f5f2ee' },
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
  recruitment_role: string | null
  world_npc_id: string | null
  wp_current: number | null
  wp_max: number | null
  rp_current: number | null
  rp_max: number | null
  status: string
  created_at: string
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
  onAddToCombat?: (npcs: CampaignNpc[]) => void
  pcEntries?: PCEntry[]
  onViewNpc?: (npc: CampaignNpc) => void
  viewingNpcIds?: Set<string>
  editNpcId?: string | null
  onEditStarted?: () => void
}

const emptyForm = {
  name: '', portrait_url: null as string | null,
  reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0,
  skillEntries: [] as SkillEntry[], notes: '', status: 'active',
  npc_type: '' as string, motivation: '', complication: '', threeWords: ['', '', ''] as string[],
  weapon: null as any,
}

export default function NpcRoster({ campaignId, isGM, combatActive, initiativeNpcIds, onAddToCombat, pcEntries, onViewNpc, viewingNpcIds, editNpcId, onEditStarted }: Props) {
  const supabase = createClient()
  const [npcs, setNpcs] = useState<CampaignNpc[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function loadNpcs() {
    const { data } = await supabase
      .from('campaign_npcs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
    setNpcs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (isGM) loadNpcs()
    else setLoading(false)
  }, [campaignId, isGM])

  useEffect(() => {
    if (editNpcId && npcs.length > 0) {
      const npc = npcs.find(n => n.id === editNpcId)
      if (npc) { openEdit(npc); onEditStarted?.() }
    }
  }, [editNpcId, npcs.length])

  if (!isGM) return null

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
      motivation: (npc as any).motivation ?? '',
      complication: (npc as any).complication ?? '',
      threeWords: (npc as any).three_words ?? ['', '', ''],
      weapon: npc.skills?.weapon ?? null,
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
      skills: { entries: form.skillEntries, text: form.skillEntries.map(s => `${s.name} ${s.level}`).join(', '), weapon: (form as any).weapon ?? null },
      notes: form.notes.trim() || null,
      status: form.status,
      npc_type: form.npc_type || null,
      motivation: form.motivation || null,
      complication: form.complication || null,
      three_words: form.threeWords.filter(w => w),
      wp_max: 10 + form.physicality + form.dexterity,
      rp_max: 6 + form.physicality,
      ...(!editingId ? { wp_current: 10 + form.physicality + form.dexterity, rp_current: 6 + form.physicality } : {}),
    }
    if (editingId) {
      await supabase.from('campaign_npcs').update(row).eq('id', editingId)
    } else {
      await supabase.from('campaign_npcs').insert(row)
    }
    setShowForm(false)
    setSaving(false)
    await loadNpcs()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    await supabase.from('campaign_npcs').delete().eq('id', id)
    await loadNpcs()
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  const [showCombatPicker, setShowCombatPicker] = useState(false)
  const [combatPickerIds, setCombatPickerIds] = useState<Set<string>>(new Set())
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [showReveal, setShowReveal] = useState(false)
  const [revealIds, setRevealIds] = useState<Set<string>>(new Set())
  const [revealLevel, setRevealLevel] = useState<'name_portrait' | 'name_portrait_role'>('name_portrait')

  const availableForCombat = npcs.filter(n => n.status === 'active' && !initiativeNpcIds?.has(n.id))

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

  function applyGenerated(typeOverride: string) {
    const npc = generateRandomNpc(typeOverride)
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
    } as any))
    setGeneratedSummary(`Generated as ${npc.profession} — ${npc.motivation} / ${npc.complication}`)
    setShowGenerateTypePicker(false)
  }

  // Reveal tracking
  const [revealedNpcIds, setRevealedNpcIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadRevealed() {
      if (!isGM || !pcEntries || pcEntries.length === 0) return
      const { data } = await supabase.from('npc_relationships').select('npc_id').eq('revealed', true)
      if (data) setRevealedNpcIds(new Set(data.map((r: any) => r.npc_id)))
    }
    loadRevealed()
  }, [npcs, pcEntries])

  async function quickReveal(npcId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!pcEntries || pcEntries.length === 0) return
    const isRevealed = revealedNpcIds.has(npcId)
    for (const pc of pcEntries) {
      const { data: existing } = await supabase.from('npc_relationships').select('id').eq('npc_id', npcId).eq('character_id', pc.characterId).single()
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
    const { data: { user } } = await supabase.auth.getUser()
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
      <div style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px', textAlign: 'center' }}>{short}</div>
      <select value={form[key] as number} onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) }))}
        style={{ width: '100%', padding: '4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', appearance: 'none' }}>
        {[-2, -1, 0, 1, 2, 3, 4].map(v => (
          <option key={v} value={v}>{v > 0 ? `+${v}` : v} {RAPID_LABELS[v]}</option>
        ))}
      </select>
    </div>
  )

  return (
    <>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={openAdd}
          style={{ padding: '2px 8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Add NPC
        </button>
        {combatActive && availableForCombat.length > 0 && (
          <button onClick={() => { setCombatPickerIds(new Set()); setShowCombatPicker(true) }}
            style={{ padding: '2px 8px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + Combat
          </button>
        )}
        {npcs.length > 0 && pcEntries && pcEntries.length > 0 && (() => {
          const allRevealed = npcs.every(n => revealedNpcIds.has(n.id))
          return (
            <button onClick={async () => {
              for (const npc of npcs) {
                if (allRevealed ? !revealedNpcIds.has(npc.id) : revealedNpcIds.has(npc.id)) continue
                await quickReveal(npc.id, { stopPropagation: () => {} } as any)
              }
            }}
              style={{ padding: '2px 8px', background: allRevealed ? '#2a1210' : '#1a2e10', border: `1px solid ${allRevealed ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allRevealed ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {allRevealed ? 'Hide All' : 'Show All'}
            </button>
          )
        })()}
        <div style={{ flex: 1 }} />
        <button onClick={openLibrary}
          style={{ padding: '2px 8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Library
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#cce0f5', fontSize: '13px' }}>Loading...</div>
          ) : npcs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
              <div style={{ fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>No NPCs yet</div>
            </div>
          ) : (
            npcs.map(npc => {
              const sc = STATUS_COLORS[npc.status] ?? STATUS_COLORS.active
              return (
                <div key={npc.id} onClick={() => onViewNpc ? onViewNpc(npc) : openEdit(npc)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: viewingNpcIds?.has(npc.id) ? '#2a1210' : '#1a1a1a', border: `1px solid ${viewingNpcIds?.has(npc.id) ? '#c0392b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {npc.portrait_url ? (
                      <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(npc.name)}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</div>
                    <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                      {npc.npc_type && (() => {
                        const tc = TYPE_COLORS[npc.npc_type] ?? TYPE_COLORS.goon
                        return <span style={{ fontSize: '13px', padding: '0 4px', borderRadius: '2px', background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{npc.npc_type}</span>
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{npc.status}</span>
                    <button onClick={e => quickReveal(npc.id, e)}
                      style={{ fontSize: '13px', padding: '0 5px', borderRadius: '2px', background: revealedNpcIds.has(npc.id) ? '#2a1210' : '#1a2e10', border: `1px solid ${revealedNpcIds.has(npc.id) ? '#c0392b' : '#2d5a1b'}`, color: revealedNpcIds.has(npc.id) ? '#f5a89a' : '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                      {revealedNpcIds.has(npc.id) ? 'Hide' : 'Show'}
                    </button>
                    {combatActive && !initiativeNpcIds?.has(npc.id) && (
                      <button onClick={e => { e.stopPropagation(); onAddToCombat?.([npc]) }}
                        style={{ fontSize: '13px', padding: '0 5px', borderRadius: '2px', background: '#7a1f16', border: '1px solid #c0392b', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Fight
                      </button>
                    )}
                    {publishedNpcIds.has(npc.id) && <span style={{ fontSize: '13px', padding: '0 4px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>Published</span>}
                  </div>
                </div>
              )
            })
          )}
      </div>

      {/* Add/Edit NPC Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', width: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
                {editingId ? 'Edit NPC' : 'Add NPC'}
              </span>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
                {form.name || 'New NPC'}
              </span>
            </div>

            {/* Generate button */}
            {!editingId && (
              <div style={{ marginBottom: '8px' }}>
                {!showGenerateTypePicker ? (
                  <button onClick={() => setShowGenerateTypePicker(true)} type="button"
                    style={{ width: '100%', padding: '4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    ⚄ Generate NPC
                  </button>
                ) : (
                  <div>
                    <div style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Select NPC type to generate:</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['bystander', 'goon', 'foe', 'antagonist'].map(t => {
                        const tc = TYPE_COLORS[t]
                        return <button key={t} onClick={() => applyGenerated(t)} type="button"
                          style={{ flex: 1, padding: '4px', background: tc?.bg, border: `1px solid ${tc?.border}`, borderRadius: '3px', color: tc?.color, fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          {t}
                        </button>
                      })}
                    </div>
                  </div>
                )}
                {generatedSummary && (
                  <div style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', fontStyle: 'italic', marginTop: '4px' }}>
                    {generatedSummary}
                  </div>
                )}
              </div>
            )}

            {/* Portrait + bank + upload + status on one row */}
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {form.portrait_url ? (
                  <img src={form.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{form.name ? getInitials(form.name) : '?'}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 20px)', gap: '3px' }}>
                {PORTRAIT_BANK.map((p, i) => (
                  <button key={i} onClick={() => setForm(f => ({ ...f, portrait_url: p.url }))} type="button"
                    style={{ width: '20px', height: '20px', borderRadius: '50%', border: form.portrait_url === p.url ? '2px solid #c0392b' : '1px solid #3a3a3a', overflow: 'hidden', cursor: 'pointer', padding: 0, background: 'none' }}>
                    <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
              <label style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
                {uploading ? '...' : 'Upload'}
                <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handlePortraitUpload(e.target.files[0]) }} />
              </label>
              {form.portrait_url && (
                <button onClick={() => setForm(f => ({ ...f, portrait_url: null }))}
                  style={{ background: 'none', border: 'none', color: '#cce0f5', fontSize: '11px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif', flexShrink: 0 }}>×</button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', flexShrink: 0 }}>
                {[['active', '#7fc458', '#1a2e10', '#2d5a1b'], ['dead', '#f5a89a', '#2a1210', '#c0392b'], ['unknown', '#7ab3d4', '#1a1a2e', '#2e2e5a']].map(([val, color, bg, border]) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({ ...f, status: val }))}
                    style={{ padding: '2px 6px', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '2px', border: `1px solid ${form.status === val ? border : '#3a3a3a'}`, background: form.status === val ? bg : 'transparent', color: form.status === val ? color : '#3a3a3a' }}>
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Name + Type on one row */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Name</div>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
                  style={{ width: '100%', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ width: '130px', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Type</div>
              <select value={form.npc_type} onChange={e => handleTypeChange(e.target.value)}
                style={{ width: '100%', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
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
              <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>RAPID</div>
              {form.npc_type === 'antagonist' && (
                <div style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px', padding: '6px 8px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px' }}>
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
              <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Skills</div>
              {form.skillEntries.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  <select value={s.name} onChange={e => setForm(f => ({ ...f, skillEntries: f.skillEntries.map((sk, j) => j === i ? { ...sk, name: e.target.value } : sk) }))}
                    style={{ flex: 1, padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                    <option value="">Select skill...</option>
                    {ALL_SKILLS.map(sk => <option key={sk} value={sk}>{sk}</option>)}
                  </select>
                  <select value={s.level} onChange={e => setForm(f => ({ ...f, skillEntries: f.skillEntries.map((sk, j) => j === i ? { ...sk, level: parseInt(e.target.value) } : sk) }))}
                    style={{ width: '60px', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', appearance: 'none' }}>
                    {[-3, -2, -1, 0, 1, 2, 3, 4].map(v => <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>)}
                  </select>
                  <button onClick={() => setForm(f => ({ ...f, skillEntries: f.skillEntries.filter((_, j) => j !== i) }))} type="button"
                    style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</button>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, skillEntries: [...f.skillEntries, { name: '', level: 1 }] }))} type="button"
                style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', marginTop: '4px' }}>
                + Add Skill
              </button>
              {form.npc_type && SKILL_HINTS[form.npc_type] && (
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '6px', fontStyle: 'italic' }}>
                  {SKILL_HINTS[form.npc_type]}
                </div>
              )}
            </div>

            {/* Motivation & Complication */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Motivation</div>
                <select value={form.motivation} onChange={e => setForm(f => ({ ...f, motivation: e.target.value }))}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                  <option value="">None</option>
                  {MOTIVATIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Complication</div>
                <select value={form.complication} onChange={e => setForm(f => ({ ...f, complication: e.target.value }))}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                  <option value="">None</option>
                  {COMPLICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Three Words */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Three Words</div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2].map(i => (
                  <select key={i} value={form.threeWords[i] || ''} onChange={e => setForm(f => ({ ...f, threeWords: f.threeWords.map((w, j) => j === i ? e.target.value : w) }))}
                    style={{ flex: 1, padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                    <option value="">-</option>
                    {PERSONALITY_WORDS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                ))}
              </div>
            </div>

            {/* Weapon */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Weapon</div>
              <select value={(form as any).weapon?.weaponName ?? ''} onChange={e => {
                const weaponName = e.target.value
                if (!weaponName) { setForm(f => ({ ...f, weapon: null } as any)); return }
                const w = getWeaponByName(weaponName)
                setForm(f => ({ ...f, weapon: { weaponName, condition: 'Used', ammoCurrent: w?.clip ?? 0, ammoMax: w?.clip ?? 0, reloads: w?.ammo ? 2 : 0 } } as any))
              }}
                style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                <option value="">— None —</option>
                <optgroup label="Melee">{MELEE_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                <optgroup label="Ranged">{RANGED_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                <optgroup label="Explosive">{EXPLOSIVE_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
                <optgroup label="Heavy">{HEAVY_WEAPONS.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}</optgroup>
              </select>
              {(form as any).weapon?.weaponName && (() => {
                const w = getWeaponByName((form as any).weapon.weaponName)
                return w ? (
                  <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>
                    {w.skill} · {w.range} · DMG <span style={{ color: '#c0392b', fontWeight: 700 }}>{w.damage}</span> · RP <span style={{ color: '#7ab3d4' }}>{w.rpPercent}%</span>
                  </div>
                ) : null
              })()}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>GM Notes <span style={{ color: '#3a3a3a' }}>(private)</span></div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Private notes — never shown to players"
                rows={3}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
            </div>

            {/* Relationships (edit only) */}
            {editingId && pcEntries && pcEntries.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Relationships — First Impressions</div>
                {pcEntries.map(pc => {
                  const rel = relationships.find(r => r.character_id === pc.characterId)
                  const cmod = rel?.relationship_cmod ?? 0
                  return (
                    <div key={pc.characterId} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: '80px' }}>{pc.characterName}</span>
                      <select value={cmod} onChange={e => handleRelationshipChange(pc.characterId, parseInt(e.target.value))}
                        style={{ flex: 1, padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: cmod > 0 ? '#7fc458' : cmod < 0 ? '#f5a89a' : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
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
                    style={{ width: '100%', padding: '8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Reveal to Players
                  </button>
                ) : (
                  <div style={{ padding: '10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                    <div style={{ fontSize: '13px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Reveal to Players</div>
                    <div style={{ marginBottom: '8px' }}>
                      {pcEntries.map(pc => (
                        <label key={pc.characterId} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', cursor: 'pointer', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                          <input type="checkbox" checked={revealIds.has(pc.characterId)} onChange={() => {
                            setRevealIds(prev => { const n = new Set(prev); if (n.has(pc.characterId)) n.delete(pc.characterId); else n.add(pc.characterId); return n })
                          }} style={{ accentColor: '#7ab3d4' }} />
                          {pc.characterName}
                        </label>
                      ))}
                    </div>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>What to reveal:</div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>
                        <input type="radio" checked={revealLevel === 'name_portrait'} onChange={() => setRevealLevel('name_portrait')} style={{ accentColor: '#7ab3d4' }} />
                        Name + Portrait
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>
                        <input type="radio" checked={revealLevel === 'name_portrait_role'} onChange={() => setRevealLevel('name_portrait_role')} style={{ accentColor: '#7ab3d4' }} />
                        Name + Portrait + Role
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowReveal(false)} style={{ flex: 1, padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={handleRevealSave} style={{ flex: 1, padding: '6px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Save Reveal</button>
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
                    style={{ width: '100%', padding: '8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Publish to World Library
                  </button>
                ) : (
                  <div style={{ padding: '10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                    <div style={{ fontSize: '13px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Publish to World</div>
                    <textarea value={publishDesc} onChange={e => setPublishDesc(e.target.value)}
                      placeholder="Public description — what other GMs will see"
                      rows={2}
                      style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', marginBottom: '6px' }} />
                    <select value={publishSetting} onChange={e => setPublishSetting(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none', marginBottom: '8px' }}>
                      <option value="custom">Custom Setting</option>
                      <option value="district_zero">District Zero</option>
                      <option value="chased">Chased</option>
                    </select>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setShowPublish(false)} style={{ flex: 1, padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={handlePublish} disabled={publishing} style={{ flex: 1, padding: '6px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: publishing ? 'not-allowed' : 'pointer', opacity: publishing ? 0.5 : 1 }}>
                        {publishing ? 'Publishing...' : 'Submit for Review'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {editingId && publishedNpcIds.has(editingId) && (
              <div style={{ marginBottom: '1rem', padding: '6px 10px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center' }}>
                Submitted to World Library
              </div>
            )}

            {/* Status */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Status</div>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                <option value="active">Active</option>
                <option value="dead">Dead</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              {editingId && (
                <button onClick={() => { handleDelete(editingId, form.name); setShowForm(false) }}
                  style={{ padding: '10px 14px', background: 'none', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Delete</button>
              )}
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
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
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Add to Combat</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>Select NPCs</div>
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
                    {npc.portrait_url ? <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(npc.name)}</span>}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowCombatPicker(false)} style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddToCombat} disabled={combatPickerIds.size === 0}
                style={{ flex: 2, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: combatPickerIds.size === 0 ? 'not-allowed' : 'pointer', opacity: combatPickerIds.size === 0 ? 0.5 : 1 }}>
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
            <div style={{ fontSize: '13px', color: '#7ab3d4', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>World NPC Library</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>Browse &amp; Import</div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {libraryLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#cce0f5', fontSize: '13px' }}>Loading...</div>
              ) : libraryNpcs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif' }}>No approved NPCs in the library yet.</div>
              ) : (
                libraryNpcs.map((npc: any) => (
                  <div key={npc.id} style={{ padding: '10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {npc.portrait_url ? <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                          {npc.npc_type && <span style={{ fontSize: '13px', padding: '0 4px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
                          {npc.setting && <span style={{ fontSize: '13px', padding: '0 4px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.setting === 'district_zero' ? 'District Zero' : npc.setting === 'chased' ? 'Chased' : 'Custom'}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleImport(npc)} disabled={importing === npc.id}
                        style={{ padding: '4px 10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: importing === npc.id ? 'not-allowed' : 'pointer', opacity: importing === npc.id ? 0.5 : 1, flexShrink: 0 }}>
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
            <button onClick={() => setShowLibrary(false)} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}
