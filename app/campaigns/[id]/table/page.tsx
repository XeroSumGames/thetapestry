'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import CharacterCard, { LiveState } from '../../../../components/CharacterCard'
import NpcRoster from '../../../../components/NpcRoster'
import NpcCard from '../../../../components/NpcCard'
import CampaignPins from '../../../../components/CampaignPins'
import dynamic from 'next/dynamic'
const CampaignMap = dynamic(() => import('../../../../components/CampaignMap'), { ssr: false })
import type { CampaignNpc } from '../../../../components/NpcRoster'
import { logEvent } from '../../../../lib/events'
import { rollDamage, calculateDamage } from '../../../../lib/damage'
import { getWeaponByName } from '../../../../lib/weapons'

interface Campaign {
  id: string
  name: string
  setting: string
  gm_user_id: string
  session_status: string
  session_count: number
  session_started_at: string | null
}

interface TableEntry {
  stateId: string
  userId: string
  username: string
  character: { id: string; name: string; created_at: string; data: any }
  liveState: LiveState
}

interface GmInfo {
  userId: string
  username: string
}

interface RollEntry {
  id: string
  character_name: string
  label: string
  target_name: string | null
  die1: number
  die2: number
  amod: number
  smod: number
  cmod: number
  total: number
  outcome: string
  insight_awarded: boolean
  created_at: string
}

interface WeaponContext {
  weaponName: string
  damage: string
  rpPercent: number
  conditionCmod: number
}

interface PendingRoll {
  label: string
  amod: number
  smod: number
  weapon?: WeaponContext
}

interface DamageResult {
  base: number
  diceRoll: number
  diceDesc: string
  phyBonus: number
  totalWP: number
  finalWP: number
  finalRP: number
  mitigated: number
  targetName: string
}

interface RollResult {
  die1: number
  die2: number
  amod: number
  smod: number
  cmod: number
  total: number
  outcome: string
  label: string
  insightAwarded: boolean
  spent: boolean
  damage?: DamageResult
}

interface InitiativeEntry {
  id: string
  character_name: string
  character_id: string | null
  user_id: string | null
  npc_id: string | null
  portrait_url: string | null
  npc_type: string | null
  roll: number
  is_active: boolean
  is_npc: boolean
}

const SETTINGS: Record<string, string> = {
  custom: 'New Setting',
  district0: 'District Zero',
  mongrels: 'Minnie & The Magnificent Mongrels',
  chased: 'Chased',
  empty: 'Empty',
  therock: 'The Rock',
}

const MAX_PLAYER_SLOTS = 9

function getOutcome(total: number, die1: number, die2: number): string {
  if (die1 === 1 && die2 === 1) return 'Low Insight'
  if (die1 === 6 && die2 === 6) return 'High Insight'
  if (total <= 3) return 'Dire Failure'
  if (total <= 8) return 'Failure'
  if (total <= 13) return 'Success'
  return 'Wild Success'
}

function outcomeColor(outcome: string): string {
  switch (outcome) {
    case 'Wild Success': return '#7fc458'
    case 'High Insight': return '#7fc458'
    case 'Success': return '#7ab3d4'
    case 'Failure': return '#EF9F27'
    case 'Dire Failure': return '#c0392b'
    case 'Low Insight': return '#c0392b'
    default: return '#d4cfc9'
  }
}

function rollD6() { return Math.floor(Math.random() * 6) + 1 }

const SOCIAL_SKILLS = ['Manipulation', 'Inspiration', 'Barter', 'Psychology', 'INF Check']

export default function TablePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const channelRef = useRef<any>(null)
  const rollChannelRef = useRef<any>(null)
  const initChannelRef = useRef<any>(null)
  const membersChannelRef = useRef<any>(null)
  const rollFeedRef = useRef<HTMLDivElement>(null)
  const revealChannelRef = useRef<any>(null)
  const myCharIdRef = useRef<string | null>(null)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isGM, setIsGM] = useState(false)
  const [entries, setEntries] = useState<TableEntry[]>([])
  const [gmInfo, setGmInfo] = useState<GmInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<TableEntry | null>(null)
  const [rolls, setRolls] = useState<RollEntry[]>([])
  const [pendingRoll, setPendingRoll] = useState<PendingRoll | null>(null)
  const [rollResult, setRollResult] = useState<RollResult | null>(null)
  const [cmod, setCmod] = useState('0')
  const [rolling, setRolling] = useState(false)
  const [targetName, setTargetName] = useState<string>('')

  // Initiative
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeEntry[]>([])
  const [combatActive, setCombatActive] = useState(false)
  const [showAddNPC, setShowAddNPC] = useState(false)
  const [npcName, setNpcName] = useState('')
  const [startingCombat, setStartingCombat] = useState(false)
  const [showNpcPicker, setShowNpcPicker] = useState(false)
  const [selectedNpcIds, setSelectedNpcIds] = useState<Set<string>>(new Set())
  const [rosterNpcs, setRosterNpcs] = useState<any[]>([])

  // Session
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active'>('idle')
  const [sessionCount, setSessionCount] = useState(0)
  const [showEndSessionModal, setShowEndSessionModal] = useState(false)
  const [sessionSummary, setSessionSummary] = useState('')
  const [nextSessionNotes, setNextSessionNotes] = useState('')
  const [sessionCliffhanger, setSessionCliffhanger] = useState('')
  const [sessionFiles, setSessionFiles] = useState<File[]>([])
  const [sessionActing, setSessionActing] = useState(false)
  const [gmTab, setGmTab] = useState<'npcs' | 'assets' | 'notes'>('npcs')
  const [sheetMode, setSheetMode] = useState<'inline' | 'overlay'>('inline')
  const [feedTab, setFeedTab] = useState<'rolls' | 'chat' | 'both'>('both')
  const [chatMessages, setChatMessages] = useState<{ id: string; user_id: string; character_name: string; message: string; created_at: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatChannelRef = useRef<any>(null)
  const [viewingNpcs, setViewingNpcs] = useState<CampaignNpc[]>([])
  const [sheetPos, setSheetPos] = useState<{ x: number; y: number } | null>(null)
  const sheetDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const campaignChannelRef = useRef<any>(null)

  async function loadEntries(campaignId: string) {
    const [{ data: members }, { data: rawStates }] = await Promise.all([
      supabase.from('campaign_members').select('user_id, character_id').eq('campaign_id', campaignId).not('character_id', 'is', null),
      supabase.from('character_states').select('*').eq('campaign_id', campaignId),
    ])

    if (!members || members.length === 0 || !rawStates || rawStates.length === 0) {
      setEntries([])
      setEntriesLoading(false)
      return
    }

    const currentAssignment: Record<string, string> = {}
    for (const m of members) currentAssignment[m.user_id] = m.character_id

    const filteredStates = rawStates.filter((s: any) => currentAssignment[s.user_id] === s.character_id)
    if (filteredStates.length === 0) { setEntries([]); setEntriesLoading(false); return }

    const charIds = filteredStates.map((s: any) => s.character_id)
    const userIds = filteredStates.map((s: any) => s.user_id)

    const [{ data: chars }, { data: profiles }] = await Promise.all([
      supabase.from('characters').select('id, name, created_at, data').in('id', charIds),
      supabase.from('profiles').select('id, username').in('id', userIds),
    ])

    const charMap = Object.fromEntries((chars ?? []).map((c: any) => {
      const { photoDataUrl, ...dataWithoutPhoto } = c.data ?? {}
      return [c.id, { ...c, data: dataWithoutPhoto }]
    }))
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))

    const newEntries: TableEntry[] = filteredStates.map((s: any) => ({
      stateId: s.id,
      userId: s.user_id,
      username: profileMap[s.user_id] ?? 'Unknown',
      character: charMap[s.character_id] ?? { id: s.character_id, name: 'Unknown', created_at: '', data: {} },
      liveState: {
        id: s.id,
        wp_current: s.wp_current, wp_max: s.wp_max,
        rp_current: s.rp_current, rp_max: s.rp_max,
        stress: s.stress, insight_dice: s.insight_dice, morality: s.morality, cdp: s.cdp ?? 0,
      },
    }))

    setEntries(newEntries)
    setEntriesLoading(false)

    const { data: photoRows } = await supabase
      .from('characters')
      .select('id, data->photoDataUrl')
      .in('id', charIds)

    if (photoRows && photoRows.length > 0) {
      const photoMap: Record<string, string> = {}
      for (const row of photoRows as any[]) {
        if (row.photoDataUrl) photoMap[row.id] = row.photoDataUrl
      }
      setEntries(prev => prev.map(e => ({
        ...e,
        character: {
          ...e.character,
          data: { ...e.character.data, photoDataUrl: photoMap[e.character.id] ?? null },
        },
      })))
    }
  }

  async function loadRolls(campaignId: string) {
    const { data } = await supabase
      .from('roll_log')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(50)
    setRolls((data ?? []).reverse())
    setTimeout(() => { rollFeedRef.current?.scrollTo(0, rollFeedRef.current.scrollHeight) }, 50)
  }

  async function loadChat(campaignId: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(50)
    setChatMessages((data ?? []).reverse())
  }

  async function sendChat() {
    if (!chatInput.trim() || !userId) return
    const myEntry = entries.find(e => e.userId === userId)
    const characterName = myEntry?.character.name ?? 'Unknown'
    await supabase.from('chat_messages').insert({
      campaign_id: id, user_id: userId, character_name: characterName, message: chatInput.trim(),
    })
    setChatInput('')
  }

  async function loadRevealedNpcs(characterId: string, cnpcs: any[]) {
    const { data: rels } = await supabase.from('npc_relationships').select('npc_id, relationship_cmod, reveal_level').eq('character_id', characterId).eq('revealed', true)
    if (rels && rels.length > 0 && cnpcs.length > 0) {
      const revealed = rels.map(r => {
        const npc = cnpcs.find((n: any) => n.id === r.npc_id)
        return npc ? { ...npc, relationship_cmod: r.relationship_cmod, reveal_level: r.reveal_level } : null
      }).filter(Boolean)
      setRevealedNpcs(revealed)
    } else {
      setRevealedNpcs([])
    }
  }

  async function loadInitiative(campaignId: string) {
    const { data } = await supabase
      .from('initiative_order')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('roll', { ascending: false })
    const order = data ?? []
    setInitiativeOrder(order)
    setCombatActive(order.length > 0)
  }

  async function ensureCharacterStates(campaignId: string, members: any[]) {
    const charIds = members.map((m: any) => m.character_id).filter(Boolean)
    if (charIds.length === 0) return
    const { data: existingStates } = await supabase
      .from('character_states').select('character_id')
      .eq('campaign_id', campaignId).in('character_id', charIds)
    const existingCharIds = new Set((existingStates ?? []).map((s: any) => s.character_id))
    const toInsert = members
      .filter((m: any) => m.character_id && !existingCharIds.has(m.character_id))
      .map((m: any) => {
        const rapid = m.characters?.data?.rapid ?? {}
        const wp = 10 + (rapid.PHY ?? 0) + (rapid.DEX ?? 0)
        const rp = 6 + (rapid.RSN ?? 0)
        return { campaign_id: campaignId, character_id: m.character_id, user_id: m.user_id, wp_current: wp, wp_max: wp, rp_current: rp, rp_max: rp, stress: 0, insight_dice: 2, morality: 3 }
      })
    if (toInsert.length > 0) await supabase.from('character_states').insert(toInsert)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/campaigns'); return }
      setCampaign(camp)
      setIsGM(camp.gm_user_id === user.id)
      setSessionStatus(camp.session_status === 'active' ? 'active' : 'idle')
      setSessionCount(camp.session_count ?? 0)
      setLoading(false)

      const [{ data: gmProfile }, { data: members }] = await Promise.all([
        supabase.from('profiles').select('id, username').eq('id', camp.gm_user_id).single(),
        supabase.from('campaign_members')
          .select('user_id, character_id, characters:character_id(id, name, data->rapid)')
          .eq('campaign_id', id)
          .not('character_id', 'is', null),
      ])

      setGmInfo({ userId: camp.gm_user_id, username: (gmProfile as any)?.username ?? 'GM' })

      if (members && members.length > 0) ensureCharacterStates(id, members as any[])
      await Promise.all([loadEntries(id), loadRolls(id), loadInitiative(id), loadChat(id)])

      // Load campaign NPCs for social skill rolls (all users need this)
      const { data: cnpcs } = await supabase.from('campaign_npcs').select('id, name, portrait_url, npc_type, recruitment_role').eq('campaign_id', id)
      setCampaignNpcs(cnpcs ?? [])

      // Load revealed NPCs for this player
      if (camp.gm_user_id !== user.id) {
        const myMember = (members ?? []).find((m: any) => m.user_id === user.id)
        if (myMember?.character_id) {
          myCharIdRef.current = myMember.character_id
          await loadRevealedNpcs(myMember.character_id, cnpcs ?? [])

          // Realtime subscription for reveal changes
          revealChannelRef.current = supabase.channel(`reveals_${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'npc_relationships' }, () => {
              if (myCharIdRef.current) loadRevealedNpcs(myCharIdRef.current, cnpcs ?? [])
            })
            .subscribe()
        }
      }

      channelRef.current = supabase.channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'character_states', filter: `campaign_id=eq.${id}` }, () => loadEntries(id))
        .subscribe()

      membersChannelRef.current = supabase.channel(`members_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_members' }, (payload: any) => {
          if (payload.new?.campaign_id === id || payload.old?.campaign_id === id) loadEntries(id)
        })
        .subscribe()

      rollChannelRef.current = supabase.channel(`rolls_${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roll_log', filter: `campaign_id=eq.${id}` }, () => loadRolls(id))
        .subscribe()

      chatChannelRef.current = supabase.channel(`chat_${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `campaign_id=eq.${id}` }, () => loadChat(id))
        .subscribe()

      initChannelRef.current = supabase.channel(`initiative_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'initiative_order', filter: `campaign_id=eq.${id}` }, () => loadInitiative(id))
        .subscribe()

      campaignChannelRef.current = supabase.channel(`campaign_${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${id}` }, (payload: any) => {
          const row = payload.new
          setSessionStatus(row.session_status === 'active' ? 'active' : 'idle')
          setSessionCount(row.session_count ?? 0)
          setCampaign((prev: Campaign | null) => prev ? { ...prev, session_status: row.session_status, session_count: row.session_count, session_started_at: row.session_started_at } : prev)
        })
        .subscribe()
    }
    load()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (membersChannelRef.current) supabase.removeChannel(membersChannelRef.current)
      if (rollChannelRef.current) supabase.removeChannel(rollChannelRef.current)
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current)
      if (initChannelRef.current) supabase.removeChannel(initChannelRef.current)
      if (campaignChannelRef.current) supabase.removeChannel(campaignChannelRef.current)
      if (revealChannelRef.current) supabase.removeChannel(revealChannelRef.current)
    }
  }, [id])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pendingRoll) { closeRollModal(); return }
        if (selectedEntry) { setSelectedEntry(null); return }
        if (showEndSessionModal) { setShowEndSessionModal(false); return }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [pendingRoll, selectedEntry, showEndSessionModal])

  async function handleStatUpdate(stateId: string, field: string, value: number) {
    await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
    // Update the entries in-place so the value persists immediately
    setEntries(prev => prev.map(e => e.stateId === stateId ? { ...e, liveState: { ...e.liveState, [field]: value } } : e))
  }

  // ── Initiative functions ──

  async function startCombat() {
    if (!isGM) return
    // Load roster NPCs for picker
    const { data: roster } = await supabase
      .from('campaign_npcs')
      .select('*')
      .eq('campaign_id', id)
      .eq('status', 'active')
      .order('name')
    setRosterNpcs(roster ?? [])
    setSelectedNpcIds(new Set((roster ?? []).map((n: any) => n.id)))
    setShowNpcPicker(true)
  }

  async function confirmStartCombat() {
    setStartingCombat(true)
    setShowNpcPicker(false)

    // Clear any existing initiative
    await supabase.from('initiative_order').delete().eq('campaign_id', id)

    // Roll initiative for all PCs: 2d6 + ACU AMod + DEX AMod
    const pcRows = entries.map(e => {
      const rapid = e.character.data?.rapid ?? {}
      const acu = rapid.ACU ?? 0
      const dex = rapid.DEX ?? 0
      const roll = rollD6() + rollD6() + acu + dex
      return {
        campaign_id: id,
        character_name: e.character.name,
        character_id: e.character.id,
        user_id: e.userId,
        npc_id: null,
        portrait_url: null,
        npc_type: null,
        roll,
        is_active: false,
        is_npc: false,
      }
    })

    // Roll initiative for selected NPCs: 2d6 + ACU AMod + DEX AMod
    const npcRows = rosterNpcs
      .filter(n => selectedNpcIds.has(n.id))
      .map(n => ({
        campaign_id: id,
        character_name: n.name,
        character_id: null,
        user_id: null,
        npc_id: n.id,
        portrait_url: n.portrait_url,
        npc_type: n.npc_type,
        roll: rollD6() + rollD6() + (n.acumen ?? 0) + (n.dexterity ?? 0),
        is_active: false,
        is_npc: true,
      }))

    const toInsert = [...pcRows, ...npcRows]
    if (toInsert.length > 0) {
      await supabase.from('initiative_order').insert(toInsert)
    }

    // Set first combatant as active
    const { data: order } = await supabase
      .from('initiative_order')
      .select('*')
      .eq('campaign_id', id)
      .order('roll', { ascending: false })

    if (order && order.length > 0) {
      await supabase.from('initiative_order').update({ is_active: true }).eq('id', order[0].id)
    }

    setStartingCombat(false)
    await loadInitiative(id)
  }

  async function nextTurn() {
    if (!isGM || initiativeOrder.length === 0) return
    const currentIdx = initiativeOrder.findIndex(e => e.is_active)
    const nextIdx = (currentIdx + 1) % initiativeOrder.length

    await Promise.all([
      supabase.from('initiative_order').update({ is_active: false }).eq('campaign_id', id),
    ])
    await supabase.from('initiative_order').update({ is_active: true }).eq('id', initiativeOrder[nextIdx].id)
    await loadInitiative(id)
  }

  async function endCombat() {
    if (!isGM) return
    await supabase.from('initiative_order').delete().eq('campaign_id', id)
    setInitiativeOrder([])
    setCombatActive(false)
  }

  async function addNPC() {
    if (!isGM || !npcName.trim()) return
    const roll = rollD6() + rollD6()
    await supabase.from('initiative_order').insert({
      campaign_id: id,
      character_name: npcName.trim(),
      character_id: null,
      user_id: null,
      roll,
      is_active: false,
      is_npc: true,
    })
    setNpcName('')
    setShowAddNPC(false)
    await loadInitiative(id)
  }

  async function addNpcsToCombat(npcsToAdd: any[]) {
    const rows = npcsToAdd.map(n => ({
      campaign_id: id,
      character_name: n.name,
      character_id: null,
      user_id: null,
      npc_id: n.id,
      portrait_url: n.portrait_url,
      npc_type: n.npc_type,
      roll: rollD6() + rollD6() + (n.acumen ?? 0) + (n.dexterity ?? 0),
      is_active: false,
      is_npc: true,
    }))
    if (rows.length > 0) {
      await supabase.from('initiative_order').insert(rows)
      await loadInitiative(id)
    }
  }

  async function removeFromInitiative(entryId: string) {
    if (!isGM) return
    await supabase.from('initiative_order').delete().eq('id', entryId)
    await loadInitiative(id)
  }

  async function deferInitiative(entryId: string) {
    const idx = initiativeOrder.findIndex(e => e.id === entryId)
    if (idx < 0 || idx >= initiativeOrder.length - 1) return
    const current = initiativeOrder[idx]
    const next = initiativeOrder[idx + 1]
    // Set current's roll to 1 below next, and bump next up to current's old roll
    await Promise.all([
      supabase.from('initiative_order').update({ roll: next.roll - 1 }).eq('id', current.id),
      supabase.from('initiative_order').update({ roll: current.roll }).eq('id', next.id),
    ])
    await loadInitiative(id)
  }

  // ── Session functions ──

  async function startSession() {
    if (!isGM) return
    setSessionActing(true)
    const newCount = sessionCount + 1
    await supabase.from('campaigns').update({
      session_status: 'active',
      session_count: newCount,
      session_started_at: new Date().toISOString(),
    }).eq('id', id)
    await supabase.from('sessions').insert({
      campaign_id: id,
      session_number: newCount,
      started_at: new Date().toISOString(),
    })
    setSessionStatus('active')
    setSessionCount(newCount)
    logEvent('session_started', { campaign_id: id, session_number: newCount })
    setSessionActing(false)
  }

  async function endSession() {
    if (!isGM) return
    setSessionActing(true)
    const now = new Date().toISOString()
    await supabase.from('campaigns').update({
      session_status: 'idle',
      session_started_at: null,
    }).eq('id', id)

    // Find the current session row
    const { data: sessionRow } = await supabase.from('sessions')
      .select('id')
      .eq('campaign_id', id).eq('session_number', sessionCount).is('ended_at', null)
      .single()

    if (sessionRow) {
      await supabase.from('sessions').update({
        ended_at: now,
        gm_summary: sessionSummary.trim() || null,
        next_session_notes: nextSessionNotes.trim() || null,
        cliffhanger: sessionCliffhanger.trim() || null,
      }).eq('id', sessionRow.id)

      // Upload attachments
      console.log('[EndSession] files to upload:', sessionFiles.length)
      if (sessionFiles.length > 0 && userId) {
        for (const file of sessionFiles) {
          const path = `${sessionRow.id}/${file.name}`
          const { error: upErr } = await supabase.storage.from('session-attachments').upload(path, file)
          console.log('[EndSession] upload', file.name, 'error:', upErr?.message)
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('session-attachments').getPublicUrl(path)
            const { error: insErr } = await supabase.from('session_attachments').insert({
              session_id: sessionRow.id,
              file_url: urlData.publicUrl,
              file_name: file.name,
              file_type: file.type,
              uploaded_by: userId,
            })
            console.log('[EndSession] insert attachment error:', insErr?.message)
          }
        }
      }
    }

    setSessionStatus('idle')
    setShowEndSessionModal(false)
    setSessionSummary('')
    setNextSessionNotes('')
    setSessionCliffhanger('')
    setSessionFiles([])
    logEvent('session_ended', { campaign_id: id, session_number: sessionCount })
    setSessionActing(false)
  }

  // ── Roll functions ──

  const [preRollInsight, setPreRollInsight] = useState<'none' | '3d6' | '+3cmod'>('none')
  const [socialNpcId, setSocialNpcId] = useState<string>('')
  const [socialCmod, setSocialCmod] = useState<{ npcName: string; cmod: number } | null>(null)
  const [campaignNpcs, setCampaignNpcs] = useState<any[]>([])
  const [revealedNpcs, setRevealedNpcs] = useState<any[]>([])

  function handleRollRequest(label: string, amod: number, smod: number, weapon?: WeaponContext) {
    setPendingRoll({ label, amod, smod, weapon })
    setRollResult(null)
    setCmod(weapon?.conditionCmod ? String(weapon.conditionCmod) : '0')
    setTargetName('')
    setPreRollInsight('none')
    setSocialNpcId('')
    setSocialCmod(null)
  }

  async function saveRollToLog(die1: number, die2: number, amod: number, smod: number, cmodVal: number, label: string, characterName: string, isReroll = false, target: string | null = null) {
    const total = die1 + die2 + amod + smod + cmodVal
    const outcome = getOutcome(total, die1, die2)
    const insightAwarded = outcome === 'Low Insight' || outcome === 'High Insight'

    await supabase.from('roll_log').insert({
      campaign_id: id, user_id: userId, character_name: characterName,
      label: isReroll ? `${label} (Re-roll)` : label,
      die1, die2, amod, smod, cmod: cmodVal, total, outcome, insight_awarded: insightAwarded,
      target_name: target || null,
    })
    logEvent('roll', { campaign_id: id, label, total, outcome, target, character: characterName })

    return { total, outcome, insightAwarded }
  }

  async function executeRoll() {
    if (!pendingRoll || !userId) return
    setRolling(true)
    // Determine character name: NPC labels have "NpcName — Action", otherwise use selected entry or own entry
    const labelParts = pendingRoll.label.split(' — ')
    const myEntry = entries.find(e => e.userId === userId)
    const characterName = labelParts.length > 1 ? labelParts[0] : (syncedSelectedEntry?.character.name ?? myEntry?.character.name ?? 'Unknown')
    let cmodVal = parseInt(cmod) || 0
    let die1: number, die2: number
    let preRollSpent = false

    if (preRollInsight === '3d6' && myEntry?.liveState && myEntry.liveState.insight_dice >= 1) {
      // Roll 3d6, keep best 2
      const rolls = [rollD6(), rollD6(), rollD6()].sort((a, b) => b - a)
      die1 = rolls[0]
      die2 = rolls[1]
      const newInsight = myEntry.liveState.insight_dice - 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
      preRollSpent = true
    } else if (preRollInsight === '+3cmod' && myEntry?.liveState && myEntry.liveState.insight_dice >= 1) {
      die1 = rollD6()
      die2 = rollD6()
      cmodVal += 3
      const newInsight = myEntry.liveState.insight_dice - 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
      preRollSpent = true
    } else {
      die1 = rollD6()
      die2 = rollD6()
    }

    const { total, outcome, insightAwarded } = await saveRollToLog(die1, die2, pendingRoll.amod, pendingRoll.smod, cmodVal, pendingRoll.label, characterName, false, targetName || null)

    if (insightAwarded && myEntry?.liveState) {
      const currentInsight = preRollSpent ? myEntry.liveState.insight_dice - 1 : myEntry.liveState.insight_dice
      const newInsight = currentInsight + 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
    }

    // Calculate and apply damage for successful weapon attacks
    let damageResult: DamageResult | undefined
    if (pendingRoll.weapon && targetName && (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight')) {
      const weapon = pendingRoll.weapon
      const w = getWeaponByName(weapon.weaponName)
      const isMelee = w?.category === 'melee'
      const attackerPhy = myEntry?.character.data?.rapid?.PHY ?? 0

      const dmg = rollDamage(weapon.damage, attackerPhy, !!isMelee)

      // Find target's defensive modifier (DMR for ranged, DMM for melee)
      const targetEntry = entries.find(e => e.character.name === targetName)
      const targetRapid = targetEntry?.character.data?.rapid ?? {}
      const defensiveMod = isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0)

      const { finalWP, finalRP, mitigated } = calculateDamage(dmg.totalWP, weapon.rpPercent, defensiveMod)

      damageResult = { ...dmg, finalWP, finalRP, mitigated, targetName }

      // Auto-apply damage to target
      if (targetEntry?.liveState) {
        const newWP = Math.max(0, targetEntry.liveState.wp_current - finalWP)
        const newRP = Math.max(0, targetEntry.liveState.rp_current - finalRP)
        await supabase.from('character_states').update({
          wp_current: newWP,
          rp_current: newRP,
          updated_at: new Date().toISOString(),
        }).eq('id', targetEntry.stateId)
        setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, wp_current: newWP, rp_current: newRP } } : e))
      }
    }

    // Weapon jam/break on Low Insight
    let weaponJammed = false
    if (pendingRoll.weapon && pendingRoll.weapon.weaponName !== 'Unarmed' && outcome === 'Low Insight') {
      weaponJammed = true
      // Degrade the weapon condition on the character's data
      if (myEntry) {
        const charData = myEntry.character.data ?? {}
        const slots = ['weaponPrimary', 'weaponSecondary'] as const
        for (const slot of slots) {
          if (charData[slot]?.weaponName === pendingRoll.weapon.weaponName) {
            const conditions = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']
            const currentIdx = conditions.indexOf(charData[slot].condition ?? 'Used')
            const newCondition = conditions[Math.min(currentIdx + 1, conditions.length - 1)]
            await supabase.from('characters').update({
              data: { ...charData, [slot]: { ...charData[slot], condition: newCondition } }
            }).eq('id', myEntry.character.id)
            break
          }
        }
      }
    }

    setRollResult({
      die1, die2, amod: pendingRoll.amod, smod: pendingRoll.smod, cmod: cmodVal,
      total, outcome, label: pendingRoll.label, insightAwarded, spent: preRollSpent,
      damage: damageResult, weaponJammed,
    } as any)

    setRolling(false)
    await Promise.all([loadEntries(id), loadRolls(id)])
  }

  async function spendInsightDie(rerollDie: 'die1' | 'die2' | 'both') {
    if (!rollResult || !userId) return
    const myEntry = entries.find(e => e.userId === userId)
    if (!myEntry?.liveState) return

    const cost = rerollDie === 'both' ? 2 : 1
    if (myEntry.liveState.insight_dice < cost) return

    setRolling(true)

    const newInsight = myEntry.liveState.insight_dice - cost
    await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)

    const newDie1 = rerollDie === 'die2' ? rollResult.die1 : rollD6()
    const newDie2 = rerollDie === 'die1' ? rollResult.die2 : rollD6()
    const rerollLabelParts = rollResult.label.split(' — ')
    const characterName = rerollLabelParts.length > 1 ? rerollLabelParts[0] : (myEntry.character.name ?? 'Unknown')

    const { total, outcome, insightAwarded } = await saveRollToLog(newDie1, newDie2, rollResult.amod, rollResult.smod, rollResult.cmod, rollResult.label, characterName, true, targetName || null)

    if (insightAwarded) {
      await supabase.from('character_states').update({ insight_dice: newInsight + 1, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
    }

    setRollResult({ ...rollResult, die1: newDie1, die2: newDie2, total, outcome, insightAwarded, spent: true })
    setRolling(false)
    await Promise.all([loadEntries(id), loadRolls(id)])
  }

  async function closeRollModal() {
    const rolledResult = rollResult
    setPendingRoll(null)
    setRollResult(null)

    // Auto-advance initiative if the roller was the active combatant
    if (rolledResult && combatActive && initiativeOrder.length > 0) {
      const activeEntry = initiativeOrder.find(e => e.is_active)
      if (activeEntry) {
        const myChar = entries.find(e => e.userId === userId)
        const isMyTurn = activeEntry.character_id && myChar && activeEntry.character_id === myChar.character.id
        const isGMRollingNPC = isGM && activeEntry.is_npc
        if (isMyTurn || isGMRollingNPC) {
          await nextTurn()
        }
      }
    }
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  function getCharPhoto(entry: TableEntry): string | null {
    return entry.character?.data?.photoDataUrl ?? null
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (loading || !campaign) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow, sans-serif', color: '#cce0f5', background: '#0f0f0f' }}>
      Loading The Table...
    </div>
  )

  const gmEntry = entries.find(e => e.userId === campaign.gm_user_id) ?? null
  const playerEntries = entries.filter(e => e.userId !== campaign.gm_user_id)
  const syncedSelectedEntry = selectedEntry ? entries.find(e => e.stateId === selectedEntry.stateId) ?? selectedEntry : null
  const myEntry = entries.find(e => e.userId === userId) ?? null
  const myInsightDice = myEntry?.liveState?.insight_dice ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Barlow, sans-serif', background: '#0f0f0f' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #c0392b', padding: '8px 16px', display: 'flex', alignItems: 'stretch', gap: '12px', flexShrink: 0, background: '#0f0f0f', position: 'relative', zIndex: 10001 }}>
        <div>
          <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
            {SETTINGS[campaign.setting] ?? campaign.setting} &mdash; {isGM ? 'GM View' : 'Player View'}
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1 }}>
            {campaign.name}
          </div>
        </div>
        {isGM && sessionStatus === 'idle' && (
          <button onClick={startSession} disabled={sessionActing}
            style={{ padding: '0 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
            {sessionActing ? 'Starting...' : 'Start Session'}
          </button>
        )}
        {isGM && sessionStatus === 'active' && (
          <button onClick={() => setShowEndSessionModal(true)}
            style={{ padding: '0 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            End Session
          </button>
        )}
        {sessionStatus === 'active' && (
          <div style={{ padding: '0 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458', display: 'flex', alignItems: 'center' }}>
            Game Session {sessionCount}
          </div>
        )}
        {isGM && sessionStatus === 'active' && !combatActive && (
          <button onClick={startCombat} disabled={startingCombat || entries.length === 0}
            style={{ padding: '0 14px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: startingCombat || entries.length === 0 ? 'not-allowed' : 'pointer', opacity: startingCombat || entries.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
            {startingCombat ? 'Rolling...' : '⚔️ Start Combat'}
          </button>
        )}
        {isGM && combatActive && (
          <button onClick={endCombat}
            style={{ padding: '0 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            End Combat
          </button>
        )}
        {combatActive && (
          <div style={{ padding: '0 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5a89a', display: 'flex', alignItems: 'center' }}>
            ⚔️ In Combat
          </div>
        )}
        <div style={{ flex: 1 }} />
        {isGM && sessionCount > 0 && (
          <a href={`/campaigns/${id}/sessions`}
            style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Previous Sessions
          </a>
        )}
        <button onClick={() => { setSheetMode(m => m === 'inline' ? 'overlay' : 'inline'); setSheetPos(null) }}
          style={{ padding: '0 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {sheetMode === 'inline' ? 'Overlay' : 'Inline'}
        </button>
        <a href={`/campaigns/${id}`} style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Back
        </a>
      </div>

      {/* Initiative Tracker — shown when combat is active */}
      {combatActive && (
        <div style={{ borderBottom: '1px solid #2e2e2e', background: '#0d0d0d', padding: '8px 12px', flexShrink: 0, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'max-content' }}>
            <div style={{ fontSize: '9px', color: '#c0392b', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginRight: '4px', flexShrink: 0 }}>
              ⚔️ Initiative
            </div>

            {initiativeOrder.map((entry, idx) => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px',
                background: entry.is_active ? '#2a1210' : '#1a1a1a',
                border: `1px solid ${entry.is_active ? '#c0392b' : '#2e2e2e'}`,
                borderRadius: '3px',
                flexShrink: 0,
                position: 'relative',
              }}>
                {entry.is_active && (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c0392b', flexShrink: 0 }} />
                )}
                {entry.is_npc && (
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {entry.portrait_url ? (
                      <img src={entry.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '7px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{entry.character_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                    )}
                  </div>
                )}
                <span style={{ fontSize: '11px', fontWeight: entry.is_active ? 700 : 400, color: entry.is_active ? '#f5f2ee' : '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {entry.character_name}
                </span>
                {entry.is_npc && entry.npc_type && (
                  <span style={{ fontSize: '8px', color: entry.npc_type === 'friendly' ? '#7fc458' : entry.npc_type === 'antagonist' ? '#d48bd4' : entry.npc_type === 'foe' ? '#f5a89a' : '#EF9F27', background: entry.npc_type === 'friendly' ? '#1a2e10' : entry.npc_type === 'antagonist' ? '#2a102a' : entry.npc_type === 'foe' ? '#2a1210' : '#2a2010', border: `1px solid ${entry.npc_type === 'friendly' ? '#2d5a1b' : entry.npc_type === 'antagonist' ? '#8b2e8b' : entry.npc_type === 'foe' ? '#c0392b' : '#5a4a1b'}`, padding: '0 4px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>{entry.npc_type}</span>
                )}
                {entry.is_npc && !entry.npc_type && (
                  <span style={{ fontSize: '8px', color: '#EF9F27', background: '#2a2010', border: '1px solid #EF9F27', padding: '0 4px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>NPC</span>
                )}
                <span style={{ fontSize: '11px', color: entry.is_active ? '#c0392b' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>{entry.roll}</span>
                {/* Defer — GM can defer anyone, players can defer their own */}
                {(isGM || entry.user_id === userId) && idx < initiativeOrder.length - 1 && (
                  <button onClick={() => deferInitiative(entry.id)}
                    style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }} title="Defer">↓</button>
                )}
                {/* Remove — GM only */}
                {isGM && (
                  <button onClick={() => removeFromInitiative(entry.id)}
                    style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
                )}
              </div>
            ))}

            {isGM && (
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {!showAddNPC ? (
                  <button onClick={() => setShowAddNPC(true)}
                    style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    + NPC
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={npcName}
                      onChange={e => setNpcName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addNPC(); if (e.key === 'Escape') { setShowAddNPC(false); setNpcName('') } }}
                      placeholder="NPC name..."
                      style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow, sans-serif', width: '120px' }}
                    />
                    <button onClick={addNPC} style={{ padding: '4px 8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>Add</button>
                    <button onClick={() => { setShowAddNPC(false); setNpcName('') }} style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                <button onClick={nextTurn}
                  style={{ padding: '4px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left — Game Feed */}
        <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
            {(['rolls', 'chat', 'both'] as const).map(tab => (
              <button key={tab} onClick={() => setFeedTab(tab)}
                style={{ flex: 1, padding: '8px 0', background: feedTab === tab ? '#1a1a1a' : 'transparent', border: 'none', borderBottom: feedTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: feedTab === tab ? '#f5f2ee' : '#cce0f5', fontSize: '12px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {tab === 'rolls' ? 'Rolls' : tab === 'chat' ? 'Chat' : 'Both'}
              </button>
            ))}
          </div>
          <div ref={rollFeedRef} style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {sessionStatus === 'idle' && (
              <div style={{ textAlign: 'center', padding: '8px', marginBottom: '8px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                Waiting for GM to open the session
              </div>
            )}
            {/* Roll entries */}
            {(feedTab === 'rolls' || feedTab === 'both') && (
              rolls.length === 0 && feedTab === 'rolls' ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{sessionStatus === 'idle' ? '⏸' : '🎲'}</div>
                  <div style={{ fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {sessionStatus === 'idle' ? 'Session not active' : 'Click a skill or attribute on your sheet to roll'}
                  </div>
                </div>
              ) : (
                rolls.map(r => (
                  <div key={r.id} style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: `3px solid ${outcomeColor(r.outcome)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.character_name}</span>
                      <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '4px' }}>
                      {r.label}
                      {r.target_name && <span style={{ color: '#EF9F27' }}> → {r.target_name}</span>}
                    </div>
                    <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>
                      [{r.die1}+{r.die2}]
                      {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
                      {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
                      {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
                      <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: outcomeColor(r.outcome), fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.outcome}</span>
                      {r.insight_awarded && <span style={{ fontSize: '12px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>+1 Insight Die</span>}
                    </div>
                  </div>
                ))
              )
            )}
            {/* Chat messages */}
            {(feedTab === 'chat' || feedTab === 'both') && (
              chatMessages.length === 0 && feedTab === 'chat' ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>No messages yet</div>
              ) : (
                chatMessages.map(m => (
                  <div key={m.id} style={{ marginBottom: '6px', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: '3px solid #7ab3d4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{m.character_name}</span>
                      <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(m.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#f5f2ee', lineHeight: 1.4 }}>{m.message}</div>
                  </div>
                ))
              )
            )}
          </div>
          {/* Bottom: chat input + sheet button */}
          <div style={{ borderTop: '1px solid #2e2e2e', flexShrink: 0 }}>
            {(feedTab === 'chat' || feedTab === 'both') && (
              <div style={{ display: 'flex', gap: '0', padding: '6px 8px', alignItems: 'stretch' }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  placeholder="Type a message..."
                  rows={2}
                  style={{ flex: 1, padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRight: 'none', borderRadius: '3px 0 0 3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', resize: 'none', lineHeight: '1.4' }} />
                <button onClick={sendChat}
                  style={{ width: '24px', flexShrink: 0, background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '0 3px 3px 0', color: '#7fc458', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', writingMode: 'vertical-rl', letterSpacing: '.08em', padding: 0, transform: 'rotate(180deg)' }}>Send</button>
              </div>
            )}
            {sessionStatus !== 'idle' && myEntry && (
              <div style={{ padding: '6px 8px' }}>
                <button
                  onClick={() => { setSelectedEntry(myEntry); setViewingNpcs([]); setSheetPos(null) }}
                  style={{ width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Open My Sheet to Roll
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center — Map always rendered, sheets float on top */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1a1a1a', overflow: 'hidden', position: 'relative' }}>
          {/* Campaign Map — always rendered */}
          <CampaignMap campaignId={id} isGM={isGM} />

          {/* NPC Card(s) stacked — floats over map */}
          {viewingNpcs.length > 0 && (
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '8px', background: 'rgba(26,26,26,0.95)', zIndex: 1100 }}>
              {viewingNpcs.map(npc => (
                <NpcCard key={npc.id}
                  npc={npc}
                  onClose={() => setViewingNpcs(prev => prev.filter(n => n.id !== npc.id))}
                  onEdit={() => { setViewingNpcs(prev => prev.filter(n => n.id !== npc.id)) }}
                  onRoll={sessionStatus === 'active' ? (label, amod, smod, weapon) => { handleRollRequest(label, amod, smod, weapon) } : undefined}
                />
              ))}
            </div>
          )}

          {/* Inline character sheet — draggable, floats over map */}
          {syncedSelectedEntry && sheetMode === 'inline' && (
            <div style={{
              position: 'absolute',
              left: sheetPos?.x ?? 8,
              top: sheetPos?.y ?? 8,
              width: 'calc(100% - 16px)',
              maxWidth: '780px',
              maxHeight: 'calc(100% - 16px)',
              overflowY: 'auto',
              padding: '1rem',
              paddingBottom: revealedNpcs.length > 0 ? '60px' : '1rem',
              background: 'rgba(26,26,26,0.95)',
              borderRadius: '4px',
              border: '1px solid #3a3a3a',
              zIndex: 1100,
              cursor: 'default',
            }}>
              {/* Drag handle */}
              <div
                onMouseDown={e => {
                  const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
                  sheetDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: sheetPos?.x ?? 0,
                    origY: sheetPos?.y ?? 0,
                  }
                  const onMove = (ev: MouseEvent) => {
                    if (!sheetDragRef.current) return
                    const dx = ev.clientX - sheetDragRef.current.startX
                    const dy = ev.clientY - sheetDragRef.current.startY
                    setSheetPos({ x: sheetDragRef.current.origX + dx, y: sheetDragRef.current.origY + dy })
                  }
                  const onUp = () => {
                    sheetDragRef.current = null
                    window.removeEventListener('mousemove', onMove)
                    window.removeEventListener('mouseup', onUp)
                  }
                  window.addEventListener('mousemove', onMove)
                  window.addEventListener('mouseup', onUp)
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', marginBottom: '4px', cursor: 'grab', borderRadius: '3px', background: '#242424', border: '1px solid #3a3a3a', userSelect: 'none' }}>
                <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#5a5a5a' }} />
              </div>
              <CharacterCard
                character={syncedSelectedEntry.character}
                liveState={syncedSelectedEntry.liveState}
                canEdit={isGM || syncedSelectedEntry.userId === userId}
                showButtons={true}
                isMySheet={syncedSelectedEntry.userId === userId}
                onStatUpdate={handleStatUpdate}
                onRoll={sessionStatus === 'active' && (syncedSelectedEntry.userId === userId || isGM) ? (label, amod, smod, weapon) => { handleRollRequest(label, amod, smod, weapon) } : undefined}
                onClose={() => { setSelectedEntry(null); setSheetPos(null) }}
                inline={true}
              />
            </div>
          )}
          {/* Revealed NPCs — always visible at bottom */}
          {!isGM && revealedNpcs.length > 0 && (
            <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', pointerEvents: 'none' }}>
              {revealedNpcs.map((npc: any) => (
                <div key={npc.id} style={{ padding: '6px 10px', background: 'rgba(26,26,26,0.9)', border: '1px solid #2e2e2e', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px', pointerEvents: 'auto' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {npc.portrait_url ? <img src={npc.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</div>
                    {npc.reveal_level === 'name_portrait_role' && npc.recruitment_role && (
                      <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.recruitment_role}</div>
                    )}
                    {npc.relationship_cmod !== 0 && (
                      <div style={{ fontSize: '13px', color: npc.relationship_cmod > 0 ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        Your relationship: {npc.relationship_cmod > 0 ? `+${npc.relationship_cmod}` : npc.relationship_cmod}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — GM Assets (GM only) */}
        {isGM && (
          <div style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
              {(['npcs', 'assets', 'notes'] as const).map(tab => (
                <button key={tab} onClick={() => setGmTab(tab)}
                  style={{ flex: 1, padding: '8px 0', background: gmTab === tab ? '#1a1a1a' : 'transparent', border: 'none', borderBottom: gmTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: gmTab === tab ? '#f5f2ee' : '#cce0f5', fontSize: '12px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {tab === 'npcs' ? 'NPCs' : tab === 'assets' ? 'Assets' : 'GM Notes'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {gmTab === 'npcs' && <NpcRoster campaignId={id} isGM={isGM} combatActive={combatActive} initiativeNpcIds={new Set(initiativeOrder.filter(e => e.npc_id).map(e => e.npc_id!))} onAddToCombat={addNpcsToCombat} pcEntries={entries.map(e => ({ characterId: e.character.id, characterName: e.character.name, userId: e.userId }))} onViewNpc={npc => { setViewingNpcs(prev => prev.some(n => n.id === npc.id) ? prev : [...prev, npc]); setSelectedEntry(null) }} viewingNpcIds={new Set(viewingNpcs.map(n => n.id))} />}
              {gmTab === 'assets' && <CampaignPins campaignId={id} isGM={isGM} />}
              {gmTab === 'notes' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a3a3a', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Coming Soon
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Bottom portrait strip */}
      <div style={{ borderTop: '1px solid #2e2e2e', display: 'flex', flexShrink: 0, background: '#0f0f0f', height: '80px' }}>
        <button
          onClick={() => { if (gmEntry) { setSelectedEntry(gmEntry); setViewingNpcs([]); setSheetPos(null) } }}
          style={{ width: '120px', flexShrink: 0, background: gmEntry ? '#1a1a1a' : '#111', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRight: '1px solid #2e2e2e', cursor: gmEntry ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px', transition: 'background 0.15s' }}
          onMouseEnter={e => { if (gmEntry) (e.currentTarget as HTMLElement).style.background = '#242424' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = gmEntry ? '#1a1a1a' : '#111' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {gmEntry && getCharPhoto(gmEntry) ? <img src={getCharPhoto(gmEntry)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '10px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>GM</span>}
          </div>
          <div style={{ fontSize: '11px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {gmEntry ? gmEntry.character.name : (gmInfo?.username ?? 'GM')}
          </div>
          <div style={{ fontSize: '9px', color: '#cce0f5', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {gmEntry ? gmEntry.username : 'Game Master'}
          </div>
        </button>

        {(() => {
          const slotCount = Math.max(playerEntries.length, 3)
          const isCompact = slotCount > 5
          const avatarSize = isCompact ? '28px' : '36px'
          const nameSize = isCompact ? '11px' : '13px'
          const subSize = isCompact ? '9px' : '10px'
          const pad = isCompact ? '4px' : '8px'
          return playerEntries.map((entry, i) => {
            const photo = getCharPhoto(entry)
            const isActive = combatActive && initiativeOrder.some(o => o.is_active && o.character_id === entry.character.id)
            const isMe = entry.userId === userId
            return (
              <button key={entry.stateId} onClick={() => { if (isGM || isMe) { setSelectedEntry(entry); setViewingNpcs([]); setSheetPos(null) } }}
                style={{ flex: 1, minWidth: 0, background: isActive ? '#1a0f0f' : '#1a1a1a', borderTop: isActive ? '2px solid #c0392b' : isMe ? '2px solid #2d5a1b' : 'none', borderBottom: 'none', borderLeft: 'none', borderRight: i < playerEntries.length - 1 ? '1px solid #2e2e2e' : 'none', cursor: (isGM || isMe) ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: isCompact ? '2px' : '4px', padding: pad, transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                onMouseLeave={e => (e.currentTarget.style.background = isActive ? '#1a0f0f' : '#1a1a1a')}
              >
                <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', background: '#1a3a5c', border: `2px solid ${isActive ? '#c0392b' : '#7ab3d4'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: isCompact ? '9px' : '11px', fontWeight: 700, color: isActive ? '#c0392b' : '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(entry.character.name)}</span>}
                </div>
                <div style={{ fontSize: nameSize, color: isActive ? '#f5a89a' : '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.character.name} <span style={{ color: '#cce0f5', fontWeight: 400 }}>({entry.username})</span>
                </div>
              </button>
            )
          })
        })()}
      </div>

      {/* Character sheet overlay — only in overlay mode */}
      {syncedSelectedEntry && sheetMode === 'overlay' && (
        <div onClick={() => { setSelectedEntry(null); setSheetPos(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflow: 'auto', borderRadius: '4px' }}>
            <CharacterCard
              character={syncedSelectedEntry.character}
              liveState={syncedSelectedEntry.liveState}
              canEdit={isGM || syncedSelectedEntry.userId === userId}
              showButtons={true}
              isMySheet={syncedSelectedEntry.userId === userId}
              onStatUpdate={handleStatUpdate}
              onRoll={sessionStatus === 'active' && (syncedSelectedEntry.userId === userId || isGM) ? (label, amod, smod, weapon) => { setSelectedEntry(null); handleRollRequest(label, amod, smod, weapon) } : undefined}
            />
            <button onClick={() => { setSelectedEntry(null); setSheetPos(null) }} style={{ marginTop: '8px', width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Roll modal */}
      {pendingRoll && (
        <div onClick={closeRollModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '340px' }}>

            {!rollResult && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>{pendingRoll.weapon ? 'Attack Roll' : 'Rolling'}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>{pendingRoll.label}</div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: pendingRoll.weapon ? '6px' : '1rem', fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  <span>2d6</span>
                  {pendingRoll.amod !== 0 && <span style={{ color: pendingRoll.amod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.amod > 0 ? '+' : ''}{pendingRoll.amod} AMod</span>}
                  {pendingRoll.smod !== 0 && <span style={{ color: pendingRoll.smod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.smod > 0 ? '+' : ''}{pendingRoll.smod} SMod</span>}
                </div>
                {pendingRoll.weapon && (
                  <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '1rem', padding: '6px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                    <span style={{ color: '#cce0f5' }}>WP Damage:</span> <span style={{ color: '#c0392b', fontWeight: 700 }}>{pendingRoll.weapon.damage}</span>
                    &nbsp;&nbsp;<span style={{ color: '#cce0f5' }}>RP:</span> <span style={{ color: '#7ab3d4' }}>{pendingRoll.weapon.rpPercent}%</span>
                    {pendingRoll.weapon.conditionCmod !== 0 && (
                      <span>&nbsp;&nbsp;<span style={{ color: '#cce0f5' }}>Condition:</span> <span style={{ color: pendingRoll.weapon.conditionCmod > 0 ? '#7fc458' : '#EF9F27' }}>{pendingRoll.weapon.conditionCmod > 0 ? '+' : ''}{pendingRoll.weapon.conditionCmod} CMod</span></span>
                    )}
                  </div>
                )}
                {(combatActive || pendingRoll.weapon) && initiativeOrder.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Target</div>
                    <select value={targetName} onChange={e => {
                      setTargetName(e.target.value)
                      // Auto-apply target's defensive modifier for weapon attacks
                      if (pendingRoll.weapon && e.target.value) {
                        const w = getWeaponByName(pendingRoll.weapon.weaponName)
                        const isMelee = w?.category === 'melee'
                        const targetEntry = entries.find(en => en.character.name === e.target.value)
                        const targetRapid = targetEntry?.character.data?.rapid ?? {}
                        const defensiveMod = isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0)
                        const baseCmod = pendingRoll.weapon.conditionCmod ?? 0
                        setCmod(String(baseCmod - defensiveMod))
                      }
                    }}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                      <option value="" style={{ color: '#cce0f5' }}>No target</option>
                      {[...initiativeOrder].sort((a, b) => (a.is_npc === b.is_npc ? 0 : a.is_npc ? -1 : 1)).map(entry => (
                        <option key={entry.id} value={entry.character_name} style={{ color: entry.is_npc ? '#7fc458' : '#c0392b' }}>
                          {entry.character_name}{entry.is_npc ? ' (NPC)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {SOCIAL_SKILLS.some(s => pendingRoll.label.includes(s)) && campaignNpcs.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Interacting with an NPC?</div>
                    <select value={socialNpcId} onChange={async e => {
                      const npcId = e.target.value
                      setSocialNpcId(npcId)
                      if (!npcId) { setSocialCmod(null); return }
                      const npc = campaignNpcs.find((n: any) => n.id === npcId)
                      const myChar = entries.find(en => en.userId === userId)
                      if (!myChar) { setSocialCmod(null); return }
                      const { data: rel } = await supabase.from('npc_relationships').select('relationship_cmod').eq('npc_id', npcId).eq('character_id', myChar.character.id).single()
                      if (rel) {
                        setSocialCmod({ npcName: npc?.name ?? '', cmod: rel.relationship_cmod })
                        setCmod(String(rel.relationship_cmod))
                      } else {
                        setSocialCmod({ npcName: npc?.name ?? '', cmod: 0 })
                      }
                    }}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                      <option value="">No NPC</option>
                      {campaignNpcs.map((n: any) => (
                        <option key={n.id} value={n.id}>{n.name}</option>
                      ))}
                    </select>
                    {socialCmod && (
                      <div style={{ fontSize: '13px', color: socialCmod.cmod > 0 ? '#7fc458' : socialCmod.cmod < 0 ? '#f5a89a' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>
                        Relationship CMod with {socialCmod.npcName}: {socialCmod.cmod > 0 ? `+${socialCmod.cmod}` : socialCmod.cmod}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Conditional Modifier</div>
                  <input type="number" value={cmod} onChange={e => setCmod(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') executeRoll() }} autoFocus
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
                {myInsightDice > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>
                      Spend Insight Die ({myInsightDice} available)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setPreRollInsight(preRollInsight === '3d6' ? 'none' : '3d6')}
                        style={{ flex: 1, padding: '8px 4px', background: preRollInsight === '3d6' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${preRollInsight === '3d6' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Roll 3d6<br /><span style={{ fontSize: '9px', color: preRollInsight === '3d6' ? '#7fc458' : '#cce0f5' }}>Keep best 2</span>
                      </button>
                      <button onClick={() => setPreRollInsight(preRollInsight === '+3cmod' ? 'none' : '+3cmod')}
                        style={{ flex: 1, padding: '8px 4px', background: preRollInsight === '+3cmod' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${preRollInsight === '+3cmod' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        +3 CMod<br /><span style={{ fontSize: '9px', color: preRollInsight === '+3cmod' ? '#7fc458' : '#cce0f5' }}>Added to roll</span>
                      </button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={closeRollModal} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={executeRoll} disabled={rolling} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.6 : 1 }}>
                    {rolling ? 'Rolling...' : preRollInsight === '3d6' ? '🎲 Roll 3d6' : '🎲 Roll'}
                  </button>
                </div>
              </>
            )}

            {rollResult && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>{rollResult.label}</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '1rem 0' }}>
                  {[rollResult.die1, rollResult.die2].map((d, i) => (
                    <div key={i} style={{ width: '52px', height: '52px', background: '#242424', border: '2px solid #3a3a3a', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, color: '#f5f2ee' }}>{d}</div>
                  ))}
                </div>
                <div style={{ fontSize: '12px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', marginBottom: '8px' }}>
                  [{rollResult.die1}+{rollResult.die2}]
                  {rollResult.amod !== 0 && <span style={{ color: rollResult.amod > 0 ? '#7fc458' : '#c0392b' }}> {rollResult.amod > 0 ? '+' : ''}{rollResult.amod}</span>}
                  {rollResult.smod !== 0 && <span style={{ color: rollResult.smod > 0 ? '#7fc458' : '#c0392b' }}> {rollResult.smod > 0 ? '+' : ''}{rollResult.smod}</span>}
                  {rollResult.cmod !== 0 && <span style={{ color: rollResult.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {rollResult.cmod > 0 ? '+' : ''}{rollResult.cmod}</span>}
                  <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {rollResult.total}</span>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: outcomeColor(rollResult.outcome) }}>{rollResult.outcome}</div>
                  {rollResult.insightAwarded && (
                    <div style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '3px 8px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif', display: 'inline-block', marginTop: '6px' }}>+1 Insight Die</div>
                  )}
                  {(rollResult as any).weaponJammed && (
                    <div style={{ fontSize: '14px', color: '#c0392b', background: '#2a1210', border: '1px solid #c0392b', padding: '6px 10px', borderRadius: '3px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '8px' }}>
                      ⚠️ Weapon Jammed! Condition degraded. Requires Ready Weapon action to unjam.
                    </div>
                  )}
                </div>
                {/* Damage result */}
                {rollResult.damage && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>
                      Damage to {rollResult.damage.targetName}
                    </div>
                    <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
                      {rollResult.damage.base > 0 && <span>{rollResult.damage.base}</span>}
                      {rollResult.damage.diceDesc && <span>{rollResult.damage.base > 0 ? '+' : ''}{rollResult.damage.diceDesc} ({rollResult.damage.diceRoll})</span>}
                      {rollResult.damage.phyBonus > 0 && <span> +{rollResult.damage.phyBonus} PHY</span>}
                      <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {rollResult.damage.totalWP} raw WP</span>
                    </div>
                    {rollResult.damage.mitigated > 0 && (
                      <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
                        Defense mitigates {rollResult.damage.mitigated} WP
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '6px' }}>
                      <div style={{ padding: '6px 12px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{rollResult.damage.finalWP}</div>
                        <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>WP</div>
                      </div>
                      <div style={{ padding: '6px 12px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{rollResult.damage.finalRP}</div>
                        <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>RP</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '6px' }}>Applied automatically</div>
                  </div>
                )}
                {!rollResult.spent && myInsightDice > 0 && rollResult.outcome !== 'High Insight' && rollResult.outcome !== 'Low Insight' && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '13px', color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', textAlign: 'center' }}>
                      Spend Insight Dice ({myInsightDice} available)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => spendInsightDie('die1')} disabled={rolling} style={{ flex: 1, padding: '8px 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Die 1</button>
                      <button onClick={() => spendInsightDie('die2')} disabled={rolling} style={{ flex: 1, padding: '8px 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Die 2</button>
                      <button onClick={() => spendInsightDie('both')} disabled={rolling || myInsightDice < 2} style={{ flex: 1, padding: '8px 4px', background: myInsightDice >= 2 ? '#1a2e10' : '#1a1a1a', border: `1px solid ${myInsightDice >= 2 ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: myInsightDice >= 2 ? '#7fc458' : '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling || myInsightDice < 2 ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Both (2)</button>
                    </div>
                  </div>
                )}
                {rollResult.spent && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem', textAlign: 'center', fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>Insight Die spent</div>
                )}
                <button onClick={closeRollModal} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Done</button>
              </>
            )}

          </div>
        </div>
      )}

      {/* End Session modal */}
      {showEndSessionModal && (
        <div onClick={() => setShowEndSessionModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>End Session</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1.25rem' }}>Session {sessionCount} Summary</div>

            {/* What happened */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '10px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>What happened this session?</div>
              <textarea
                value={sessionSummary}
                onChange={e => setSessionSummary(e.target.value)}
                placeholder="Summarise the session — key events, decisions, outcomes."
                autoFocus
                rows={6}
                style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
            </div>

            {/* How did the session end */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>How did the session end?</div>
              <textarea
                value={sessionCliffhanger}
                onChange={e => setSessionCliffhanger(e.target.value)}
                placeholder="What do you need to remember? What was the cliffhanger? Who had the last word?"
                rows={3}
                style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
            </div>

            {/* Notes for next session */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Notes for next session</div>
              <textarea
                value={nextSessionNotes}
                onChange={e => setNextSessionNotes(e.target.value)}
                placeholder="Prep notes, loose threads, things to follow up on."
                rows={4}
                style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
            </div>

            {/* File upload */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '10px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Attach files (optional)</div>
              <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#c0392b' }}
                onDragLeave={e => { e.currentTarget.style.borderColor = '#3a3a3a' }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = '#3a3a3a'
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || f.type === 'text/plain' || f.type === 'application/msword' || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                  if (files.length > 0) setSessionFiles(prev => [...prev, ...files])
                }}
                style={{ border: '2px dashed #3a3a3a', borderRadius: '4px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'image/*,.pdf,.txt,.doc,.docx'; input.onchange = () => { const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || f.type === 'text/plain' || f.type === 'application/msword' || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); if (files.length > 0) setSessionFiles(prev => [...prev, ...files]) }; input.click() }}
              >
                <div style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Drop files here or click to browse
                </div>
                <div style={{ fontSize: '10px', color: '#3a3a3a', marginTop: '4px' }}>Maps, handouts, references — images, PDFs, text, and Word docs</div>
              </div>
              {sessionFiles.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {sessionFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#d4cfc9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button onClick={() => setSessionFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowEndSessionModal(false)} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={endSession} disabled={sessionActing} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.6 : 1 }}>
                {sessionActing ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NPC Picker for Start Combat */}
      {showNpcPicker && (
        <div onClick={() => setShowNpcPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Start Combat</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>Select NPCs for this encounter</div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {rosterNpcs.length === 0 ? (
                <div style={{ color: '#cce0f5', fontSize: '12px', textAlign: 'center', padding: '1rem' }}>No active NPCs in roster. You can add them during combat.</div>
              ) : (
                rosterNpcs.map(npc => (
                  <label key={npc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: selectedNpcIds.has(npc.id) ? '#2a1210' : '#1a1a1a', border: `1px solid ${selectedNpcIds.has(npc.id) ? '#c0392b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedNpcIds.has(npc.id)} onChange={() => {
                      setSelectedNpcIds(prev => {
                        const next = new Set(prev)
                        if (next.has(npc.id)) next.delete(npc.id)
                        else next.add(npc.id)
                        return next
                      })
                    }} style={{ accentColor: '#c0392b' }} />
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {npc.portrait_url ? (
                        <img src={npc.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</div>
                      {npc.npc_type && <span style={{ fontSize: '9px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
                    </div>
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowNpcPicker(false)} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmStartCombat} disabled={startingCombat}
                style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: startingCombat ? 'not-allowed' : 'pointer', opacity: startingCombat ? 0.6 : 1 }}>
                {startingCombat ? 'Rolling...' : `⚔️ Start Combat${selectedNpcIds.size > 0 ? ` (${selectedNpcIds.size} NPCs)` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
