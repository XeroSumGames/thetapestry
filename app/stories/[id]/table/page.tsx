'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import CharacterCard, { LiveState } from '../../../../components/CharacterCard'
import NpcRoster from '../../../../components/NpcRoster'
import NpcCard from '../../../../components/NpcCard'
import CampaignPins from '../../../../components/CampaignPins'
import GmNotes from '../../../../components/GmNotes'
import PlayerNotes from '../../../../components/PlayerNotes'
import { SETTINGS } from '../../../../lib/settings'
import dynamic from 'next/dynamic'
const CampaignMap = dynamic(() => import('../../../../components/CampaignMap'), { ssr: false })
import type { CampaignNpc } from '../../../../components/NpcRoster'
import { logEvent } from '../../../../lib/events'
import { rollDamage, calculateDamage } from '../../../../lib/damage'
import { getWeaponByName, getTraitValue } from '../../../../lib/weapons'
import { SKILLS } from '../../../../lib/xse-schema'

interface Campaign {
  id: string
  name: string
  setting: string
  gm_user_id: string
  session_status: string
  session_count: number
  session_started_at: string | null
  invite_code: string
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
  damage_json: DamageResult | null
}

interface WeaponContext {
  weaponName: string
  damage: string
  rpPercent: number
  conditionCmod: number
  traitCmod?: number
  traitLabel?: string
  traits?: string[]
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
  weaponJammed?: boolean
  traitNotes?: string[]
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
  actions_remaining: number
  aim_bonus: number
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
  const npcsChannelRef = useRef<any>(null)
  const npcFetchInFlightRef = useRef(false)  // Suppress realtime callback during manual NPC re-fetch
  const rollFeedRef = useRef<HTMLDivElement>(null)
  const revealChannelRef = useRef<any>(null)
  const myCharIdRef = useRef<string | null>(null)
  // loadEntries sequence guard — see definition below.
  const loadEntriesSeqRef = useRef(0)

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
  const actionPreConsumedRef = useRef(false)  // Set when Charge/Rapid Fire/Stabilize pre-consume before the roll modal
  const rollExecutedRef = useRef(false)       // Set in executeRoll, read in closeRollModal — refs survive React batching
  const [insightSavePrompt, setInsightSavePrompt] = useState<{ stateId: string; targetName: string; newWP: number; newRP: number; phyAmod: number; insightDice: number } | null>(null)
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
  const [dropCharacter, setDropCharacter] = useState<string>('')
  const [selectedNpcIds, setSelectedNpcIds] = useState<Set<string>>(new Set())
  const [rosterNpcs, setRosterNpcs] = useState<any[]>([])
  const [showRestorePicker, setShowRestorePicker] = useState(false)
  const [restoreNpcIds, setRestoreNpcIds] = useState<Set<string>>(new Set())

  // Session
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active'>('idle')
  const [sessionCount, setSessionCount] = useState(0)
  const [showEndSessionModal, setShowEndSessionModal] = useState(false)
  const [submittedPlayerNotes, setSubmittedPlayerNotes] = useState<{ id: string; user_id: string; title: string | null; content: string; submitted_at: string | null; character_name: string }[]>([])
  const [showSpecialCheck, setShowSpecialCheck] = useState<'group' | 'opposed' | 'perception' | 'gut' | 'first_impression' | null>(null)
  const [groupCheckParticipants, setGroupCheckParticipants] = useState<Set<string>>(new Set())
  const [groupCheckSkill, setGroupCheckSkill] = useState('')
  const [opposedTarget, setOpposedTarget] = useState('')
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
  const [publishedNpcIds, setPublishedNpcIds] = useState<Set<string>>(new Set())
  const [pendingEditNpcId, setPendingEditNpcId] = useState<string | null>(null)
  const [sheetPos, setSheetPos] = useState<{ x: number; y: number } | null>(null)
  const sheetDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const campaignChannelRef = useRef<any>(null)

  async function loadEntries(campaignId: string) {
    // Sequence guard — multiple realtime callbacks fire in quick succession
    // (character_states + campaign_members + others) and a slower earlier
    // call can finish AFTER a faster later one, overwriting good state with
    // stale data. Each call gets a sequence number; only the latest one
    // commits to React state.
    const seq = ++loadEntriesSeqRef.current
    const isLatest = () => seq === loadEntriesSeqRef.current

    const [{ data: members }, { data: rawStates }] = await Promise.all([
      supabase.from('campaign_members').select('user_id, character_id').eq('campaign_id', campaignId).not('character_id', 'is', null),
      supabase.from('character_states').select('*').eq('campaign_id', campaignId),
    ])

    if (!members || members.length === 0 || !rawStates || rawStates.length === 0) {
      if (isLatest()) { setEntries([]); setEntriesLoading(false) }
      return
    }

    const currentAssignment: Record<string, string> = {}
    for (const m of members) currentAssignment[m.user_id] = m.character_id

    const filteredStates = rawStates.filter((s: any) => currentAssignment[s.user_id] === s.character_id)
    if (filteredStates.length === 0) { if (isLatest()) { setEntries([]); setEntriesLoading(false) } return }

    const charIds = filteredStates.map((s: any) => s.character_id)
    const userIds = filteredStates.map((s: any) => s.user_id)

    const [{ data: chars, error: charsErr }, { data: profiles, error: profilesErr }] = await Promise.all([
      supabase.from('characters').select('id, name, created_at, data').in('id', charIds),
      supabase.from('profiles').select('id, username').in('id', userIds),
    ])
    if (charsErr) console.error('[loadEntries] characters query error:', charsErr.message)
    if (profilesErr) console.error('[loadEntries] profiles query error:', profilesErr.message)

    const charMap = Object.fromEntries((chars ?? []).map((c: any) => {
      const { photoDataUrl, ...dataWithoutPhoto } = c.data ?? {}
      return [c.id, { ...c, data: dataWithoutPhoto }]
    }))
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))
    const missingChars = charIds.filter((cid: string) => !(cid in charMap))
    if (missingChars.length > 0) {
      console.warn('[loadEntries] missing chars for ids — likely RLS blocking cross-user reads:', missingChars, 'returned chars:', chars?.map((c: any) => c.id))
    }

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

    if (!isLatest()) return
    setEntries(newEntries)
    setEntriesLoading(false)

    const { data: photoRows } = await supabase
      .from('characters')
      .select('id, data->photoDataUrl')
      .in('id', charIds)

    if (!isLatest()) return
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
    setTimeout(() => { rollFeedRef.current?.scrollTo(0, rollFeedRef.current.scrollHeight) }, 50)
  }

  async function sendChat() {
    if (!chatInput.trim() || !userId) return
    const myEntry = entries.find(e => e.userId === userId)
    const characterName = myEntry?.character.name ?? (isGM ? 'Game Master' : 'Unknown')
    await supabase.from('chat_messages').insert({
      campaign_id: id, user_id: userId, character_name: characterName, message: chatInput.trim(),
    })
    setChatInput('')
  }

  async function loadRevealedNpcs(characterId: string | null, cnpcs: any[]) {
    const query = characterId
      ? supabase.from('npc_relationships').select('npc_id, relationship_cmod, reveal_level').eq('character_id', characterId).eq('revealed', true)
      : supabase.from('npc_relationships').select('npc_id, relationship_cmod, reveal_level').eq('revealed', true)
    const { data: rels } = await query
    if (rels && rels.length > 0 && cnpcs.length > 0) {
      const seen = new Set<string>()
      const revealed = rels.map((r: any) => {
        if (seen.has(r.npc_id)) return null
        seen.add(r.npc_id)
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
      if (!camp) { router.push('/stories'); return }
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
      const [,,,, cnpcsResult, pubDataResult] = await Promise.all([
        loadEntries(id), loadRolls(id), loadInitiative(id), loadChat(id),
        supabase.from('campaign_npcs').select('*').eq('campaign_id', id),
        supabase.from('world_npcs').select('source_campaign_npc_id').not('source_campaign_npc_id', 'is', null),
      ])
      const cnpcs = cnpcsResult.data ?? []
      setCampaignNpcs(cnpcs)
      setRosterNpcs(cnpcs.filter((n: any) => {
          if (n.status !== 'active') return false
          const wp = n.wp_current ?? n.wp_max ?? 10
          return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
        }))
      if (pubDataResult.data) setPublishedNpcIds(new Set(pubDataResult.data.map((d: any) => d.source_campaign_npc_id!)))

      // Load revealed NPCs — GM sees all, players see their own
      if (camp.gm_user_id === user.id) {
        await loadRevealedNpcs(null, cnpcs)
        revealChannelRef.current = supabase.channel(`reveals_${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'npc_relationships' }, () => {
            loadRevealedNpcs(null, cnpcs)
          })
          .subscribe()
      } else {
        const myMember = (members ?? []).find((m: any) => m.user_id === user.id)
        if (myMember?.character_id) {
          myCharIdRef.current = myMember.character_id
          await loadRevealedNpcs(myMember.character_id, cnpcs)
          revealChannelRef.current = supabase.channel(`reveals_${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'npc_relationships' }, () => {
              if (myCharIdRef.current) loadRevealedNpcs(myCharIdRef.current, cnpcs)
            })
            .subscribe()
        }
      }

      channelRef.current = supabase.channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'character_states', filter: `campaign_id=eq.${id}` }, () => loadEntries(id))
        .subscribe()

      membersChannelRef.current = supabase.channel(`members_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_members', filter: `campaign_id=eq.${id}` }, async () => {
          // Refetch members with character data, ensure their character_state exists,
          // then refresh entries. Without ensureCharacterStates here, a player who
          // picks a character won't appear in the GM's table until they navigate to
          // /table themselves and trigger state creation on their own browser.
          const { data: refreshedMembers } = await supabase
            .from('campaign_members')
            .select('user_id, character_id, characters:character_id(id, name, data->rapid)')
            .eq('campaign_id', id)
            .not('character_id', 'is', null)
          if (refreshedMembers && refreshedMembers.length > 0) {
            await ensureCharacterStates(id, refreshedMembers as any[])
          }
          await loadEntries(id)
        })
        .subscribe()

      rollChannelRef.current = supabase.channel(`rolls_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'roll_log', filter: `campaign_id=eq.${id}` }, () => loadRolls(id))
        .subscribe()

      chatChannelRef.current = supabase.channel(`chat_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `campaign_id=eq.${id}` }, () => loadChat(id))
        .subscribe()

      initChannelRef.current = supabase.channel(`initiative_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'initiative_order', filter: `campaign_id=eq.${id}` }, () => loadInitiative(id))
        .on('broadcast', { event: 'combat_ended' }, () => { setInitiativeOrder([]); setCombatActive(false); setViewingNpcs([]) })
        .on('broadcast', { event: 'combat_started' }, () => { loadInitiative(id); loadRolls(id) })
        .on('broadcast', { event: 'turn_changed' }, () => { loadInitiative(id); loadEntries(id); loadRolls(id) })
        .on('broadcast', { event: 'npc_damaged' }, (msg: any) => {
          // Another client dealt damage to an NPC — apply the patch locally
          const { npcId, patch } = msg.payload ?? {}
          if (npcId && patch) {
            setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
            setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
            setViewingNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } as CampaignNpc : n))
          }
        })
        .on('broadcast', { event: 'pc_damaged' }, () => {
          // Another client dealt damage to a PC — refresh entries to see updated HP
          loadEntries(id)
        })
        .on('broadcast', { event: 'pc_mortal_wound' }, (msg: any) => {
          // Show insight save modal on the PLAYER's screen when their PC is mortally wounded
          const data = msg.payload
          if (data && data.targetUserId === userId) {
            setInsightSavePrompt(data)
          }
        })
        .on('broadcast', { event: 'pc_mortal_wound_resolved' }, () => {
          // Another client resolved the insight save — close our modal and refresh
          setInsightSavePrompt(null)
          loadEntries(id)
        })
        // Players' postgres_changes subscription on npc_relationships is
        // unreliable (RLS / publication), so mid-combat reveals go over this
        // broadcast channel instead. Refetch cnpcs fresh so newly-added roster
        // NPCs aren't missed due to a stale closure.
        .on('broadcast', { event: 'npcs_revealed' }, async () => {
          const { data: fresh } = await supabase.from('campaign_npcs').select('*').eq('campaign_id', id)
          const freshList = fresh ?? []
          if (freshList.length > 0) {
            setCampaignNpcs(freshList)
            setRosterNpcs(freshList.filter((n: any) => {
              if (n.status !== 'active') return false
              const wp = n.wp_current ?? n.wp_max ?? 10
              return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
            }))
          }
          loadRevealedNpcs(myCharIdRef.current, freshList)
        })
        .subscribe()

      campaignChannelRef.current = supabase.channel(`campaign_${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${id}` }, (payload: any) => {
          const row = payload.new
          setSessionStatus(row.session_status === 'active' ? 'active' : 'idle')
          setSessionCount(row.session_count ?? 0)
          setCampaign((prev: Campaign | null) => prev ? { ...prev, session_status: row.session_status, session_count: row.session_count, session_started_at: row.session_started_at } : prev)
        })
        .subscribe()

      // NPC roster realtime — without this, damage applied to an NPC updates
      // the DB but the GM (and players) keep seeing the old HP because
      // rosterNpcs/campaignNpcs only refresh on combat-start or page reload.
      npcsChannelRef.current = supabase.channel(`campaign_npcs_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_npcs', filter: `campaign_id=eq.${id}` }, async () => {
          // Skip if a manual re-fetch is in progress (e.g. after dealing damage)
          // to avoid a race condition where this stale fetch overwrites fresh data.
          if (npcFetchInFlightRef.current) return
          const { data: cnpcs } = await supabase.from('campaign_npcs').select('*').eq('campaign_id', id)
          if (cnpcs && !npcFetchInFlightRef.current) {
            setCampaignNpcs(cnpcs)
            setRosterNpcs(cnpcs.filter((n: any) => {
              if (n.status !== 'active') return false
              const wp = n.wp_current ?? n.wp_max ?? 10
              return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
            }))
          }
        })
        .subscribe()
    }
    load()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (membersChannelRef.current) supabase.removeChannel(membersChannelRef.current)
      if (npcsChannelRef.current) supabase.removeChannel(npcsChannelRef.current)
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
    const aliveRoster = (roster ?? []).filter((n: any) => {
      const wp = n.wp_current ?? n.wp_max ?? 10
      return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
    })
    setRosterNpcs(aliveRoster)
    setSelectedNpcIds(new Set(aliveRoster.map((n: any) => n.id)))
    setShowNpcPicker(true)
  }

  async function confirmStartCombat() {
    setStartingCombat(true)
    setShowNpcPicker(false)

    // Getting The Drop: selected character gets -2 on initiative but acts first with 1 action
    const dropPenalty = -2

    // Refetch members + characters fresh from DB rather than reading `entries`,
    // because `entries` only includes PCs that already have a character_states
    // row — a player who joined moments ago may not be in entries yet, but they
    // still belong in combat. Also ensure their state row exists so damage can
    // be applied to them later.
    const [, { data: freshMembers }] = await Promise.all([
      supabase.from('initiative_order').delete().eq('campaign_id', id),
      supabase.from('campaign_members')
        .select('user_id, character_id, characters:character_id(id, name, data->rapid)')
        .eq('campaign_id', id)
        .not('character_id', 'is', null),
    ])
    if (freshMembers && freshMembers.length > 0) {
      await ensureCharacterStates(id, freshMembers as any[])
    }
    const charIds = (freshMembers ?? []).map((m: any) => m.character_id)
    const { data: freshChars } = charIds.length > 0
      ? await supabase.from('characters').select('id, name, data').in('id', charIds)
      : { data: [] }
    const charMap = Object.fromEntries((freshChars ?? []).map((c: any) => [c.id, c]))

    // Roll initiative for all PCs: 2d6 + ACU AMod + DEX AMod
    const initDetails: { name: string; d1: number; d2: number; acu: number; dex: number; drop: number; total: number; is_npc: boolean }[] = []
    const pcRows = (freshMembers ?? []).map((m: any) => {
      const char = charMap[m.character_id]
      const rapid = char?.data?.rapid ?? {}
      const acu = rapid.ACU ?? 0
      const dex = rapid.DEX ?? 0
      const charName = char?.name ?? 'Unknown'
      const isDropChar = dropCharacter === charName
      const d1 = rollD6(), d2 = rollD6()
      const drop = isDropChar ? dropPenalty : 0
      const roll = d1 + d2 + acu + dex + drop
      initDetails.push({ name: charName, d1, d2, acu, dex, drop, total: roll, is_npc: false })
      return {
        campaign_id: id,
        character_name: charName,
        character_id: m.character_id,
        user_id: m.user_id,
        npc_id: null,
        portrait_url: null,
        npc_type: null,
        roll,
        is_active: false,
        is_npc: false,
        actions_remaining: 2,
      }
    })

    // Roll initiative for selected NPCs: 2d6 + ACU AMod + DEX AMod
    const npcRows = rosterNpcs
      .filter(n => selectedNpcIds.has(n.id))
      .map(n => {
        const isDropChar = dropCharacter === n.name
        const d1 = rollD6(), d2 = rollD6()
        const acu = n.acumen ?? 0
        const dex = n.dexterity ?? 0
        const drop = isDropChar ? dropPenalty : 0
        const roll = d1 + d2 + acu + dex + drop
        initDetails.push({ name: n.name, d1, d2, acu, dex, drop, total: roll, is_npc: true })
        return {
          campaign_id: id,
          character_name: n.name,
          character_id: null,
          user_id: null,
          npc_id: n.id,
          portrait_url: n.portrait_url,
          npc_type: n.npc_type,
          roll,
          is_active: false,
          is_npc: true,
          actions_remaining: 2,
        }
      })

    // Sort client-side to determine first active combatant (avoids a re-fetch)
    const allRows = [...pcRows, ...npcRows]
    const sorted = [...initDetails].sort((a, b) => b.total - a.total)

    // Determine who goes first and mark them active in the insert
    let firstCharName = sorted[0]?.name
    let firstActions = 2
    if (dropCharacter) {
      const dropExists = allRows.some(r => r.character_name === dropCharacter)
      if (dropExists) { firstCharName = dropCharacter; firstActions = 1 }
    }
    const toInsert = allRows.map(r => r.character_name === firstCharName
      ? { ...r, is_active: true, actions_remaining: firstActions }
      : r
    )

    // Combatant name list for the new "Combat Started" box (PCs and NPCs in roll order).
    const combatants = sorted.map(s => s.name)

    // Insert initiative rows + log combat start in parallel.
    if (toInsert.length > 0) {
      const [{ data: insertedInit, error: initInsertErr }, { error: rollInsertErr }] = await Promise.all([
        supabase.from('initiative_order').insert(toInsert).select(),
        // Explicit timestamps so Combat Started always renders above Initiative.
        // A multi-row insert otherwise gives both rows the same NOW() and the
        // tie-break is non-deterministic.
        (() => {
          const now = Date.now()
          return supabase.from('roll_log').insert([
            { campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Started',
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'combat_start',
              damage_json: { combatants } as any,
              created_at: new Date(now).toISOString() },
            { campaign_id: id, user_id: userId, character_name: 'System', label: 'Initiative',
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'initiative',
              damage_json: { initiative: sorted } as any,
              created_at: new Date(now + 1).toISOString() },
          ])
        })(),
      ])
      if (initInsertErr) console.error('[confirmStartCombat] initiative insert error:', initInsertErr.message)
      if (rollInsertErr) console.error('[confirmStartCombat] roll_log insert error:', rollInsertErr.message)
      // Optimistic local state — sorted by roll desc to match loadInitiative behavior.
      const sortedInit = (insertedInit ?? []).slice().sort((a: any, b: any) => b.roll - a.roll)
      setInitiativeOrder(sortedInit)
      setCombatActive(sortedInit.length > 0)
    }
    setDropCharacter('')

    // Auto-open NPC cards for all NPCs in combat
    const combatNpcObjs = rosterNpcs.filter(n => selectedNpcIds.has(n.id))
    if (combatNpcObjs.length > 0) {
      setViewingNpcs(combatNpcObjs as CampaignNpc[])
      setSelectedEntry(null)
    }

    setStartingCombat(false)
    // Refresh the GM's log feed so the new entries appear immediately, then
    // broadcast combat start so players also reload their state. We rely on
    // postgres_changes for the player log refresh; broadcast is the trigger
    // for loadInitiative on the player side.
    await loadRolls(id)
    initChannelRef.current?.send({ type: 'broadcast', event: 'combat_started', payload: {} })
  }

  async function nextTurn() {
    console.warn('[nextTurn] called')
    // Fetch fresh initiative order from DB to avoid stale state
    const { data: freshOrder, error: orderErr } = await supabase.from('initiative_order').select('*').eq('campaign_id', id).order('roll', { ascending: false })
    if (orderErr) console.warn('[nextTurn] order fetch error:', orderErr.message)
    const order = freshOrder ?? initiativeOrder
    if (order.length === 0) { console.warn('[nextTurn] empty order, bailing'); return }
    const currentIdx = order.findIndex((e: any) => e.is_active)
    console.warn('[nextTurn] currentIdx:', currentIdx, 'order length:', order.length, 'active name:', order[currentIdx]?.character_name)

    // Guard: if no active entry found, forcibly activate the first alive combatant
    if (currentIdx < 0) {
      console.warn('[nextTurn] no active entry found — activating first combatant as fallback')
      await supabase.from('initiative_order').update({ is_active: true, actions_remaining: 2, aim_bonus: 0 }).eq('id', order[0].id)
      await loadInitiative(id)
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      return
    }

    // New round when wrapping — re-roll initiative + decrement death countdowns
    if (currentIdx === order.length - 1) {
      // Decrement death countdown + incapacitation + RP recovery
      for (const e of entries) {
        if (!e.liveState) continue
        const ls = e.liveState as any
        const updates: any = {}
        // Death countdown
        if (ls.wp_current === 0 && ls.death_countdown != null && ls.death_countdown > 0) {
          updates.death_countdown = ls.death_countdown - 1
          if (ls.death_countdown - 1 <= 0) {
            await supabase.from('roll_log').insert({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `💀 ${e.character.name} has died.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'death',
            })
          }
        }
        // Incapacitation countdown
        if (ls.incap_rounds != null && ls.incap_rounds > 0) {
          updates.incap_rounds = ls.incap_rounds - 1
          if (ls.incap_rounds - 1 <= 0) {
            // Regain consciousness: 1 RP, and 1 WP if was stabilized (WP=0)
            updates.rp_current = Math.max(1, ls.rp_current)
            if (ls.wp_current === 0) updates.wp_current = 1
            updates.incap_rounds = null
          }
        }
        // RP recovery: conscious characters below max RP recover 1 per round
        if (ls.rp_current > 0 && ls.rp_current < e.liveState.rp_max && ls.wp_current > 0 && (ls.incap_rounds == null || ls.incap_rounds <= 0)) {
          updates.rp_current = Math.min(e.liveState.rp_max, (updates.rp_current ?? ls.rp_current) + 1)
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('character_states').update(updates).eq('id', e.stateId)
        }
      }

      // NPC death countdown + incapacitation + RP recovery (mirrors PC logic above)
      const combatNpcIds = order.filter((e: any) => e.npc_id).map((e: any) => e.npc_id)
      for (const npcId of combatNpcIds) {
        const npc = campaignNpcs.find((n: any) => n.id === npcId)
        if (!npc) continue
        const updates: any = {}
        // Death countdown
        if ((npc.wp_current ?? npc.wp_max ?? 10) === 0 && npc.death_countdown != null && npc.death_countdown > 0) {
          updates.death_countdown = npc.death_countdown - 1
          // NPC dies when countdown expires — mark status and log
          if (npc.death_countdown - 1 <= 0) {
            updates.status = 'dead'
            await supabase.from('roll_log').insert({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `💀 ${npc.name} has died.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'death',
            })
          }
        }
        // Incapacitation countdown
        if (npc.incap_rounds != null && npc.incap_rounds > 0) {
          updates.incap_rounds = npc.incap_rounds - 1
          if (npc.incap_rounds - 1 <= 0) {
            updates.rp_current = Math.max(1, npc.rp_current ?? 0)
            if ((npc.wp_current ?? 0) === 0) updates.wp_current = 1
            updates.incap_rounds = null
          }
        }
        // RP recovery
        const npcWP = npc.wp_current ?? npc.wp_max ?? 10
        const npcRP = npc.rp_current ?? npc.rp_max ?? 6
        const npcRPMax = npc.rp_max ?? 6
        if (npcRP > 0 && npcRP < npcRPMax && npcWP > 0 && (npc.incap_rounds == null || npc.incap_rounds <= 0)) {
          updates.rp_current = Math.min(npcRPMax, (updates.rp_current ?? npcRP) + 1)
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('campaign_npcs').update(updates).eq('id', npcId)
          setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...updates } : n))
          setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...updates } : n))
        }
      }

      // Re-roll initiative for all combatants
      const rerollDetails: { name: string; d1: number; d2: number; acu: number; dex: number; drop: number; total: number; is_npc: boolean }[] = []
      for (const entry of order) {
        const charEntry = entries.find((e: any) => entry.character_id ? e.character.id === entry.character_id : e.character.name === entry.character_name)
        const rapid = charEntry?.character.data?.rapid ?? {}
        const acu = entry.is_npc ? (rosterNpcs.find(n => n.id === entry.npc_id)?.acumen ?? 0) : (rapid.ACU ?? 0)
        const dex = entry.is_npc ? (rosterNpcs.find(n => n.id === entry.npc_id)?.dexterity ?? 0) : (rapid.DEX ?? 0)
        const d1 = rollD6(), d2 = rollD6()
        const newRoll = d1 + d2 + acu + dex
        rerollDetails.push({ name: entry.character_name, d1, d2, acu, dex, drop: 0, total: newRoll, is_npc: !!entry.is_npc })
        await supabase.from('initiative_order').update({ roll: newRoll, actions_remaining: 2, aim_bonus: 0, is_active: false }).eq('id', entry.id)
      }

      // Log new round initiative
      const sortedReroll = [...rerollDetails].sort((a, b) => b.total - a.total)
      await supabase.from('roll_log').insert({
        campaign_id: id, user_id: userId, character_name: 'System', label: 'New Round — Initiative',
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'initiative',
        damage_json: { initiative: sortedReroll } as any,
      })

      // Re-sort and set first as active (PCs beat NPCs on ties)
      const { data: rerolled } = await supabase.from('initiative_order').select('*').eq('campaign_id', id).order('roll', { ascending: false })
      if (rerolled && rerolled.length > 0) {
        // On ties, PCs go first
        rerolled.sort((a: any, b: any) => b.roll - a.roll || (a.is_npc ? 1 : 0) - (b.is_npc ? 1 : 0))
        await supabase.from('initiative_order').update({ is_active: true, actions_remaining: 2 }).eq('id', rerolled[0].id)
      }
      await Promise.all([loadInitiative(id), loadEntries(id), loadRolls(id)])
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
      return
    }

    // Find next combatant who can act — skip dead, mortally wounded, and incapacitated
    let nextIdx = (currentIdx + 1) % order.length
    let attempts = 0
    while (attempts < order.length) {
      const nextEntry = order[nextIdx]
      let skipTurn = false
      if (nextEntry.is_npc && nextEntry.npc_id) {
        const npc = campaignNpcs.find((n: any) => n.id === nextEntry.npc_id)
        if (npc) {
          const npcWP = npc.wp_current ?? npc.wp_max ?? 10
          const npcRP = npc.rp_current ?? npc.rp_max ?? 6
          skipTurn = npcWP === 0 || npcRP === 0 || npc.status === 'dead'
        }
      } else {
        const charEntry = entries.find((ce: any) => nextEntry.character_id ? ce.character.id === nextEntry.character_id : ce.character.name === nextEntry.character_name)
        const ls = charEntry?.liveState
        skipTurn = !!(ls && (ls.wp_current === 0 || ls.rp_current === 0))
      }
      if (!skipTurn) break
      nextIdx = (nextIdx + 1) % order.length
      attempts++
    }

    // Deactivate current + activate next
    const currentEntry = order.find((e: any) => e.is_active)
    console.warn('[nextTurn] deactivating:', currentEntry?.character_name, '→ activating:', order[nextIdx]?.character_name)
    if (currentEntry) {
      const { error: deactErr } = await supabase.from('initiative_order').update({ is_active: false, actions_remaining: 0, aim_bonus: 0 }).eq('id', currentEntry.id)
      if (deactErr) console.warn('[nextTurn] deactivate error:', deactErr.message)
    }
    const { error: actErr } = await supabase.from('initiative_order').update({ is_active: true, actions_remaining: 2, aim_bonus: 0 }).eq('id', order[nextIdx].id)
    if (actErr) console.warn('[nextTurn] activate error:', actErr.message)
    await Promise.all([loadInitiative(id), loadEntries(id)])
    initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
  }

  async function consumeAction(entryId: string, actionLabel?: string, cost = 1) {
    // Re-fetch from DB to avoid stale state
    const { data: freshEntry, error: freshErr } = await supabase.from('initiative_order').select('*').eq('id', entryId).single()
    if (freshErr) console.warn('[consumeAction] fetch error:', freshErr.message)
    const entry = freshEntry ?? initiativeOrder.find(e => e.id === entryId)
    console.warn('[consumeAction] entryId:', entryId, 'entry:', entry, 'cost:', cost, 'label:', actionLabel)
    if (!entry) { console.warn('[consumeAction] no entry found, bailing'); return }
    if ((entry.actions_remaining ?? 0) < cost) { console.warn('[consumeAction] actions_remaining', entry.actions_remaining, '< cost', cost, '— bailing'); return }
    const newRemaining = (entry.actions_remaining ?? 0) - cost
    console.warn('[consumeAction] newRemaining:', newRemaining)

    // Log the action to game feed
    if (actionLabel) {
      const { error: actionLogErr } = await supabase.from('roll_log').insert({
        campaign_id: id,
        user_id: userId,
        character_name: entry.character_name,
        label: actionLabel,
        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
        outcome: 'action',
      })
      if (actionLogErr) console.error('[consumeAction] action log insert error:', actionLogErr.message)
    }

    // Clear aim bonus after a roll (no actionLabel = called from closeRollModal)
    const clearAim = !actionLabel && entry.aim_bonus > 0

    // Always persist the new action count to DB first — if nextTurn fails or
    // races, the DB is at least consistent with "this combatant is spent".
    const { error: updErr } = await supabase.from('initiative_order')
      .update({ actions_remaining: newRemaining, ...(clearAim ? { aim_bonus: 0 } : {}) })
      .eq('id', entryId)
    if (updErr) console.warn('[consumeAction] update error:', updErr.message)

    if (newRemaining <= 0) {
      console.warn('[consumeAction] newRemaining<=0 → calling nextTurn')
      await nextTurn()
      // Safety: ensure local state reflects the advance even if nextTurn's
      // internal loadInitiative raced with something else.
      await loadInitiative(id)
    } else {
      await loadInitiative(id)
    }
  }

  async function handleAim(entryId: string) {
    const entry = initiativeOrder.find(e => e.id === entryId)
    if (!entry || entry.actions_remaining <= 0) return
    const newAim = (entry.aim_bonus ?? 0) + 1
    await supabase.from('initiative_order').update({ aim_bonus: newAim }).eq('id', entryId)
    await consumeAction(entryId, `${entry.character_name} — Aim (+${newAim} CMod)`)
  }

  async function handleReadyWeapon(entryId: string) {
    const entry = initiativeOrder.find(e => e.id === entryId)
    if (!entry) return
    // Check if combatant has a Tracking weapon
    const charEntry = entries.find(e => e.character.name === entry.character_name)
    const weaponData = charEntry?.character.data?.weaponPrimary ?? null
    const w = weaponData ? getWeaponByName(weaponData.weaponName) : null
    const hasTracking = w ? getTraitValue(w.traits, 'Tracking') !== null : false
    if (hasTracking) {
      const newAim = (entry.aim_bonus ?? 0) + 1
      await supabase.from('initiative_order').update({ aim_bonus: newAim }).eq('id', entryId)
      await consumeAction(entryId, `${entry.character_name} — Ready Weapon (Tracking +${newAim} CMod)`)
    } else {
      await consumeAction(entryId, `${entry.character_name} — Ready Weapon`)
    }
  }

  async function endCombat() {
    if (!isGM) return
    // Snapshot the combatants for the log entry before clearing initiative.
    const combatants = initiativeOrder.map(e => e.character_name)
    const { error: endLogErr } = await supabase.from('roll_log').insert({
      campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Ended',
      die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
      outcome: 'combat_end',
      damage_json: { combatants } as any,
    })
    if (endLogErr) console.error('[endCombat] roll_log insert error:', endLogErr.message)
    await supabase.from('initiative_order').delete().eq('campaign_id', id)
    setInitiativeOrder([])
    setCombatActive(false)
    setViewingNpcs([])
    await loadRolls(id)
    initChannelRef.current?.send({ type: 'broadcast', event: 'combat_ended', payload: {} })
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
      actions_remaining: 2,
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
      actions_remaining: 2,
    }))
    if (rows.length > 0) {
      await supabase.from('initiative_order').insert(rows)
      await loadInitiative(id)
      // Open NPC cards in the center for the newly added NPCs
      setViewingNpcs(prev => {
        const existingIds = new Set(prev.map(n => n.id))
        const newCards = npcsToAdd.filter(n => !existingIds.has(n.id))
        return newCards.length > 0 ? [...prev, ...newCards as CampaignNpc[]] : prev
      })
    }

    // If combat is already underway, offer to reveal the newly-added NPC(s) to
    // the players so they appear in the player-side NPC window. Mirrors the
    // reveal logic in NpcRoster.revealAllNpcs: one npc_relationships row per
    // (npc × pc) with revealed=true, reveal_level='name_portrait'. The realtime
    // subscription on npc_relationships (see loadRevealedNpcs channel above)
    // auto-refreshes player views when these rows land.
    if (!combatActive || npcsToAdd.length === 0) return
    const pcCharIds = entries
      .filter(e => e.character?.id && e.userId !== campaign?.gm_user_id)
      .map(e => e.character.id)
    if (pcCharIds.length === 0) return

    const npcIds = npcsToAdd.map(n => n.id)
    const { data: existingRels } = await supabase
      .from('npc_relationships')
      .select('id, npc_id, character_id, revealed')
      .in('npc_id', npcIds)

    // If every added NPC is already fully revealed to every PC, skip the prompt.
    const allFullyRevealed = npcIds.every(nid =>
      pcCharIds.every(pcId => (existingRels ?? []).some((r: any) =>
        r.npc_id === nid && r.character_id === pcId && r.revealed))
    )
    if (allFullyRevealed) return

    const label = npcsToAdd.length === 1 ? npcsToAdd[0].name : `${npcsToAdd.length} NPCs`
    if (!confirm(`Show ${label} to the players?`)) return

    const existing = existingRels ?? []
    const seen = new Set<string>(existing.map((r: any) => `${r.npc_id}|${r.character_id}`))
    const updateIds = existing.map((r: any) => r.id)
    const inserts: any[] = []
    for (const npc of npcsToAdd) {
      for (const pcId of pcCharIds) {
        if (!seen.has(`${npc.id}|${pcId}`)) {
          inserts.push({
            npc_id: npc.id,
            character_id: pcId,
            relationship_cmod: 0,
            revealed: true,
            reveal_level: 'name_portrait',
          })
        }
      }
    }
    if (updateIds.length > 0) {
      await supabase.from('npc_relationships')
        .update({ revealed: true, reveal_level: 'name_portrait' })
        .in('id', updateIds)
    }
    if (inserts.length > 0) {
      await supabase.from('npc_relationships').insert(inserts)
    }
    // Nudge the player clients to refetch — their postgres_changes subscription
    // on npc_relationships doesn't reliably fire (see handler in initChannelRef
    // setup). Broadcast bypasses RLS/publication and always lands.
    initChannelRef.current?.send({ type: 'broadcast', event: 'npcs_revealed', payload: {} })
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
    // Set current's roll to 1 below next, and bump next up to current's old roll.
    const updates: Promise<any>[] = [
      supabase.from('initiative_order').update({ roll: next.roll - 1 }).eq('id', current.id),
      supabase.from('initiative_order').update({ roll: current.roll }).eq('id', next.id),
    ]
    // If the deferring combatant is currently active, hand the turn directly
    // to the swap partner. We can't reuse nextTurn() here because after the
    // swap the deferring combatant is now sorted BELOW the swap partner, so
    // nextTurn would walk forward from the deferring entry's new position and
    // land on the wrong combatant. The direct transfer keeps the semantics
    // clean: "I defer → you go next → I'll act later in the round".
    const wasActive = !!current.is_active
    if (wasActive) {
      updates.push(
        supabase.from('initiative_order').update({ is_active: false, actions_remaining: current.actions_remaining ?? 2, aim_bonus: 0 }).eq('id', current.id),
        supabase.from('initiative_order').update({ is_active: true, actions_remaining: 2, aim_bonus: 0 }).eq('id', next.id),
      )
    }
    await Promise.all(updates)
    await loadInitiative(id)
    if (wasActive) {
      initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
    }
  }

  // ── Session functions ──

  async function startSession() {
    if (!isGM) return
    // UI updates instantly; DB writes fire in the background (mirrors endSession).
    const newCount = sessionCount + 1
    const startedAt = new Date().toISOString()
    setRolls([])
    setChatMessages([])
    setSessionStatus('active')
    setSessionCount(newCount)
    logEvent('session_started', { campaign_id: id, session_number: newCount })
    // Fire all four DB calls in parallel — none depend on each other.
    void Promise.all([
      supabase.from('campaigns').update({
        session_status: 'active',
        session_count: newCount,
        session_started_at: startedAt,
      }).eq('id', id),
      supabase.from('sessions').insert({
        campaign_id: id,
        session_number: newCount,
        started_at: startedAt,
      }),
      supabase.from('roll_log').delete().eq('campaign_id', id),
      supabase.from('chat_messages').delete().eq('campaign_id', id),
    ]).catch(err => console.error('[startSession] background error:', err))
  }

  async function endSession() {
    if (!isGM) return
    // Close modal & update local state instantly
    setShowEndSessionModal(false)
    setSessionActing(true)
    if (combatActive) {
      setInitiativeOrder([])
      setCombatActive(false)
      initChannelRef.current?.send({ type: 'broadcast', event: 'combat_ended', payload: {} })
    }
    setRolls([])
    setChatMessages([])
    setSessionStatus('idle')
    const endedCount = sessionCount
    setSessionSummary('')
    setNextSessionNotes('')
    setSessionCliffhanger('')
    const filesToUpload = [...sessionFiles]
    setSessionFiles([])
    setSessionActing(false)
    logEvent('session_ended', { campaign_id: id, session_number: endedCount })

    // Fire all DB work in the background — UI is already updated
    const now = new Date().toISOString()
    const bgWork = async () => {
      try {
        await Promise.all([
          supabase.from('campaigns').update({ session_status: 'idle', session_started_at: null }).eq('id', id),
          supabase.from('roll_log').delete().eq('campaign_id', id),
          supabase.from('chat_messages').delete().eq('campaign_id', id),
          combatActive ? Promise.all([
            supabase.from('roll_log').insert({ campaign_id: id, user_id: userId, character_name: 'System', label: '⚔️ Combat Ended', die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'action' }),
            supabase.from('initiative_order').delete().eq('campaign_id', id),
          ]) : Promise.resolve(),
        ])

        const { data: sessionRow } = await supabase.from('sessions')
          .select('id')
          .eq('campaign_id', id).eq('session_number', endedCount).is('ended_at', null)
          .single()

        if (sessionRow) {
          await supabase.from('sessions').update({
            ended_at: now,
            gm_summary: sessionSummary.trim() || null,
            next_session_notes: nextSessionNotes.trim() || null,
            cliffhanger: sessionCliffhanger.trim() || null,
          }).eq('id', sessionRow.id)

          if (filesToUpload.length > 0 && userId) {
            for (const file of filesToUpload) {
              const path = `${sessionRow.id}/${file.name}`
              const { error: upErr } = await supabase.storage.from('session-attachments').upload(path, file)
              if (!upErr) {
                const { data: urlData } = supabase.storage.from('session-attachments').getPublicUrl(path)
                await supabase.from('session_attachments').insert({
                  session_id: sessionRow.id,
                  file_url: urlData.publicUrl,
                  file_name: file.name,
                  file_type: file.type,
                  uploaded_by: userId,
                })
              }
            }
          }
        }
      } catch (err) {
        console.error('[EndSession] background save error:', err)
      }
    }
    bgWork()
  }

  // ── Roll functions ──

  const [preRollInsight, setPreRollInsight] = useState<'none' | '3d6' | '+3cmod'>('none')
  const [useBurst, setUseBurst] = useState(false)
  const [rangeBand, setRangeBand] = useState<'engaged' | 'close' | 'medium' | 'long' | 'distant'>('medium')
  const [socialTarget, setSocialTarget] = useState<{ action: string } | null>(null)
  const [socialNpcId, setSocialNpcId] = useState<string>('')
  const [socialCmod, setSocialCmod] = useState<{ npcName: string; cmod: number } | null>(null)
  const [campaignNpcs, setCampaignNpcs] = useState<any[]>([])
  const [revealedNpcs, setRevealedNpcs] = useState<any[]>([])
  const revealedNpcIds = useMemo(() => new Set<string>(revealedNpcs.map((n: any) => n.id)), [revealedNpcs])
  const [focusPin, setFocusPin] = useState<{ id: string; lat: number; lng: number } | null>(null)

  // Re-sync any open NpcCards (centered "viewing" cards) whenever the underlying
  // campaignNpcs list refreshes from realtime — without this, an open card keeps
  // showing the snapshot HP from when it was first opened, even after damage lands.
  useEffect(() => {
    if (campaignNpcs.length === 0) return
    setViewingNpcs(prev => {
      if (prev.length === 0) return prev
      let changed = false
      const next = prev.map(vn => {
        const fresh = campaignNpcs.find((c: any) => c.id === vn.id)
        if (fresh && fresh !== vn) { changed = true; return fresh as CampaignNpc }
        return vn
      })
      return changed ? next : prev
    })
  }, [campaignNpcs])

  async function handlePublishNpc(npc: CampaignNpc) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('world_npcs').insert({
      source_campaign_npc_id: npc.id,
      created_by: user.id,
      name: npc.name,
      portrait_url: npc.portrait_url,
      reason: npc.reason, acumen: npc.acumen, physicality: npc.physicality,
      influence: npc.influence, dexterity: npc.dexterity,
      skills: npc.skills,
      notes: npc.notes,
      npc_type: npc.npc_type,
      status: 'pending',
    })
    if (error) { alert(`Publish failed: ${error.message}`); return }
    setPublishedNpcIds(prev => new Set([...prev, npc.id]))
  }

  // Special check handlers
  function triggerPerceptionCheck(characterName: string) {
    const charEntry = entries.find(e => e.character.name === characterName)
    if (!charEntry) return
    const rapid = charEntry.character.data?.rapid ?? {}
    const perMod = (rapid.RSN ?? 0) + (rapid.ACU ?? 0)
    handleRollRequest(`${characterName} — Perception Check`, perMod, 0)
    setShowSpecialCheck(null)
  }

  function triggerGutInstinct(characterName: string) {
    const charEntry = entries.find(e => e.character.name === characterName)
    if (!charEntry) return
    const rapid = charEntry.character.data?.rapid ?? {}
    const perMod = (rapid.RSN ?? 0) + (rapid.ACU ?? 0)
    // Can substitute Psychology, Streetwise, or Tactics
    const skills = charEntry.character.data?.skills ?? []
    const subSkills = ['Psychology', 'Streetwise', 'Tactics']
    const bestSub = skills.filter((s: any) => subSkills.includes(s.skillName)).sort((a: any, b: any) => b.level - a.level)[0]
    const smod = bestSub?.level ?? 0
    handleRollRequest(`${characterName} — Gut Instinct`, perMod, smod)
    setShowSpecialCheck(null)
  }

  function triggerFirstImpression(characterName: string) {
    const charEntry = entries.find(e => e.character.name === characterName)
    if (!charEntry) return
    const rapid = charEntry.character.data?.rapid ?? {}
    const infMod = rapid.INF ?? 0
    const skills = charEntry.character.data?.skills ?? []
    const socialSkills = ['Manipulation', 'Streetwise', 'Psychology']
    const bestSkill = skills.filter((s: any) => socialSkills.includes(s.skillName)).sort((a: any, b: any) => b.level - a.level)[0]
    const smod = bestSkill?.level ?? 0
    handleRollRequest(`${characterName} — First Impression`, infMod, smod)
    setShowSpecialCheck(null)
  }

  function triggerGroupCheck() {
    if (groupCheckParticipants.size === 0 || !groupCheckSkill) return
    const participants = entries.filter(e => groupCheckParticipants.has(e.character.id))
    if (participants.length === 0) return
    // Find the attribute for this skill
    const skillDef = SKILLS.find(s => s.name === groupCheckSkill)
    const attrKey = skillDef?.attribute ?? 'RSN'
    // Leader = highest AMod + SMod
    const scored = participants.map(p => {
      const amod = p.character.data?.rapid?.[attrKey] ?? 0
      const smod = (p.character.data?.skills ?? []).find((s: any) => s.skillName === groupCheckSkill)?.level ?? 0
      return { ...p, amod, smod, total: amod + smod }
    }).sort((a, b) => b.total - a.total)
    const leader = scored[0]
    // Others contribute their AMod or SMod (whichever is used)
    const bonusMods = scored.slice(1).reduce((sum, p) => sum + p.smod, 0)
    handleRollRequest(`Group Check — ${groupCheckSkill} (led by ${leader.character.name})`, leader.amod, leader.smod + bonusMods)
    setShowSpecialCheck(null)
    setGroupCheckParticipants(new Set())
    setGroupCheckSkill('')
  }

  function getRangeCMod(): number {
    if (!pendingRoll?.weapon) return 0
    const w = getWeaponByName(pendingRoll.weapon.weaponName)
    if (!w) return 0
    const isMelee = w.category === 'melee'
    const isPistol = w.name.toLowerCase().includes('pistol')
    const isRifle = w.name.toLowerCase().includes('rifle') || w.name.toLowerCase().includes('carbine')
    if (rangeBand === 'engaged') return isMelee ? 1 : -1
    if (rangeBand === 'close') return isMelee ? -1 : 1
    if (rangeBand === 'long') return isPistol ? -5 : isRifle ? 1 : 0
    return 0
  }

  async function handleInsightSave(spend: boolean) {
    if (!insightSavePrompt) return
    const { stateId, phyAmod, insightDice } = insightSavePrompt
    if (spend) {
      // Trade ALL Insight Dice per SRD, regain 1 WP and 1 RP
      await supabase.from('character_states').update({
        wp_current: 1, rp_current: 1, insight_dice: 0, updated_at: new Date().toISOString(),
      }).eq('id', stateId)
      setEntries(prev => prev.map(e => e.stateId === stateId ? { ...e, liveState: { ...e.liveState, wp_current: 1, rp_current: 1, insight_dice: 0 } } : e))
    } else {
      // Apply full damage — WP=0 with death countdown
      const deathCountdown = Math.max(1, 4 + phyAmod)
      await supabase.from('character_states').update({
        wp_current: 0, death_countdown: deathCountdown, updated_at: new Date().toISOString(),
      }).eq('id', stateId)
      setEntries(prev => prev.map(e => e.stateId === stateId ? { ...e, liveState: { ...e.liveState, wp_current: 0, death_countdown: deathCountdown } as any } : e))
    }
    setInsightSavePrompt(null)
    // Broadcast resolution so other clients close their modal and refresh
    initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound_resolved', payload: {} })
    await loadEntries(id)
  }

  async function applySocialAction(action: string, targetEntryId: string) {
    const activeEntry = initiativeOrder.find(e => e.is_active)
    if (!activeEntry) return
    const targetEntry = initiativeOrder.find(e => e.id === targetEntryId)
    if (!targetEntry) return
    const isBoost = action === 'Coordinate' || action === 'Inspire'
    const delta = isBoost ? 1 : -1
    const newBonus = (targetEntry.aim_bonus ?? 0) + delta
    await supabase.from('initiative_order').update({ aim_bonus: newBonus }).eq('id', targetEntryId)
    await consumeAction(activeEntry.id, `${activeEntry.character_name} — ${action} → ${targetEntry.character_name}`)
    setSocialTarget(null)
  }

  function handleRollRequest(label: string, amod: number, smod: number, weapon?: WeaponContext) {
    // During active combat, ALL rolls (weapon + skill) are gated to the active
    // combatant with actions remaining.  Without this, a player whose turn ended
    // could still open a skill check, and closeRollModal would then consume an
    // action from whichever OTHER combatant is now active — corrupting the turn.
    if (combatActive) {
      const active = initiativeOrder.find(e => e.is_active)
      if (!active || (active.actions_remaining ?? 0) <= 0) {
        alert('No actions remaining — wait for your next turn.')
        return
      }

      // Determine the roller's identity so we can verify it matches the active
      // combatant.  Weapon attacks: inferred from label prefix or selected sheet.
      // Skill/other rolls: inferred from the roller's PC or GM-controlled NPC.
      let rollerName: string | null
      if (weapon) {
        const firstPart = label.split(' — ')[0]
        const firstPartIsKnownName =
          campaignNpcs.some((n: any) => n.name === firstPart) ||
          entries.some(e => e.character.name === firstPart)
        if (firstPartIsKnownName) {
          rollerName = firstPart
        } else if (isGM && selectedEntry) {
          rollerName = selectedEntry.character.name
        } else {
          const myChar = entries.find(e => e.userId === userId)
          rollerName = myChar?.character.name ?? null
        }
      } else {
        // Non-weapon roll — figure out who is rolling.
        // Label may start with "CharName — Skill" (NPC rolls from NpcCard).
        const firstPart = label.split(' — ')[0]
        const firstPartIsKnownName =
          campaignNpcs.some((n: any) => n.name === firstPart) ||
          entries.some(e => e.character.name === firstPart)
        if (firstPartIsKnownName) {
          rollerName = firstPart
        } else if (isGM && active.is_npc) {
          // GM rolling a skill for the active NPC — allow it
          rollerName = active.character_name
        } else if (isGM && selectedEntry) {
          rollerName = selectedEntry.character.name
        } else {
          const myChar = entries.find(e => e.userId === userId)
          rollerName = myChar?.character.name ?? null
        }
      }

      if (!rollerName || active.character_name !== rollerName) {
        alert(`It's not ${rollerName ?? 'that character'}'s turn.`)
        return
      }
    }
    rollExecutedRef.current = false
    setPendingRoll({ label, amod, smod, weapon })
    setRollResult(null)
    // Include aim bonus from Aim action or Tracking trait
    const activeEntry = combatActive ? initiativeOrder.find(e => e.is_active) : null
    const aimBonus = activeEntry?.aim_bonus ?? 0
    const baseCmod = (weapon?.conditionCmod ?? 0) + aimBonus
    setCmod(baseCmod ? String(baseCmod) : '0')
    setTargetName('')
    setPreRollInsight('none')
    setUseBurst(false)
    setRangeBand('medium')
    setSocialTarget(null)
    setSocialNpcId('')
    setSocialCmod(null)
  }

  async function saveRollToLog(die1: number, die2: number, amod: number, smod: number, cmodVal: number, label: string, characterName: string, isReroll = false, target: string | null = null, damageData?: DamageResult) {
    const total = die1 + die2 + amod + smod + cmodVal
    const outcome = getOutcome(total, die1, die2)
    // Non-antagonist NPCs never get Insight Dice
    const isHighLow = outcome === 'Low Insight' || outcome === 'High Insight'
    const isNPC = isHighLow && !entries.some(e => e.character.name === characterName)
    const npcTypeForLog = isNPC ? (rosterNpcs.find((n: any) => n.name === characterName)?.npc_type ?? campaignNpcs.find((n: any) => n.name === characterName)?.npc_type ?? '') : ''
    const insightAwarded = isHighLow && !(isNPC && npcTypeForLog !== 'antagonist')

    await supabase.from('roll_log').insert({
      campaign_id: id, user_id: userId, character_name: characterName,
      label: isReroll ? `${label} (Re-roll)` : label,
      die1, die2, amod, smod, cmod: cmodVal, total, outcome, insight_awarded: insightAwarded,
      target_name: target || null,
      damage_json: damageData || null,
    })
    logEvent('roll', { campaign_id: id, label, total, outcome, target, character: characterName })

    return { total, outcome, insightAwarded }
  }

  async function executeRoll() {
    if (!pendingRoll || !userId) return
    rollExecutedRef.current = true
    setRolling(true)
    // Determine character name. Most labels containing " — " put the attacker
    // name first (e.g. "Goon 1 — Attack (Pistol)", "David Battersby — Aim"),
    // but the PC weapon-attack button builds its label as "Attack — <weapon>"
    // which previously made the code write the literal string "Attack" into
    // roll_log.character_name. Guard against that by only trusting the first
    // split-part when it actually matches a known PC or NPC name.
    const labelParts = pendingRoll.label.split(' — ')
    const myEntry = entries.find(e => e.userId === userId)
    const firstPart = labelParts[0]
    const firstPartIsKnownName = labelParts.length > 1 && (
      entries.some(e => e.character.name === firstPart) ||
      campaignNpcs.some((n: any) => n.name === firstPart)
    )
    const characterName = firstPartIsKnownName
      ? firstPart
      : (syncedSelectedEntry?.character.name ?? myEntry?.character.name ?? 'Unknown')
    let cmodVal = parseInt(cmod) || 0
    // Add range band CMod for weapon attacks
    if (pendingRoll.weapon) cmodVal += getRangeCMod()
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

    const total = die1 + die2 + pendingRoll.amod + pendingRoll.smod + cmodVal
    const outcome = getOutcome(total, die1, die2)
    // Award Insight Die — only to PCs, or Antagonist NPCs (Bystanders/Goons/Foes never get Insight Dice)
    const isHighLow = outcome === 'Low Insight' || outcome === 'High Insight'
    const isNPCRoll = isHighLow && pendingRoll.label.includes(' — ') && !entries.some(e => pendingRoll.label.startsWith(e.character.name))
    const npcType = isNPCRoll ? (rosterNpcs.find((n: any) => pendingRoll.label.includes(n.name))?.npc_type ?? campaignNpcs.find((n: any) => pendingRoll.label.includes(n.name))?.npc_type ?? '') : ''
    const insightAwarded = isHighLow && !(isNPCRoll && npcType !== 'antagonist')
    if (insightAwarded && myEntry?.liveState) {
      const currentInsight = preRollSpent ? myEntry.liveState.insight_dice - 1 : myEntry.liveState.insight_dice
      const newInsight = currentInsight + 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
    }

    // Calculate and apply damage for successful weapon attacks
    let damageResult: DamageResult | undefined
    let traitNotes: string[] = []
    if (pendingRoll.weapon && targetName && (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight')) {
      const weapon = pendingRoll.weapon
      const w = getWeaponByName(weapon.weaponName)
      // 'Unarmed' is a pseudo-weapon fabricated inline by the CharacterCard
      // Unarmed Attack button — it has no entry in getWeaponByName, so we
      // have to recognize it explicitly as melee. Without this, PHY AMod is
      // never added to damage (rollDamage skips phyBonus) and the defensive
      // mod uses DEX instead of PHY, easily producing 0 damage.
      const isMelee = w?.category === 'melee' || weapon.weaponName === 'Unarmed'
      const attackerPhy = myEntry?.character.data?.rapid?.PHY ?? 0
      const traits = weapon.traits ?? []
      const isStun = getTraitValue(traits, 'Stun') !== null
      const burstCount = getTraitValue(traits, 'Automatic Burst')
      const hasBlast = getTraitValue(traits, 'Blast Radius') !== null
      const burningVal = getTraitValue(traits, 'Burning')
      const hasCloseUp = getTraitValue(traits, 'Close-Up') !== null
      const hasConeUp = getTraitValue(traits, 'Cone-Up') !== null

      // Automatic Burst: roll damage multiple times (only if player opted in)
      const rolls = (useBurst && burstCount !== null && burstCount > 0) ? burstCount : 1
      let totalBase = 0, totalDice = 0, totalPhy = 0
      let diceDesc = ''
      for (let i = 0; i < rolls; i++) {
        const dmg = rollDamage(weapon.damage, attackerPhy, !!isMelee)
        totalBase += dmg.base
        totalDice += dmg.diceRoll
        totalPhy += dmg.phyBonus
        if (i === 0) diceDesc = dmg.diceDesc
      }
      const totalWP = totalBase + totalDice + totalPhy

      // Unarmed adds SMod to damage
      const unarmedBonus = weapon.weaponName === 'Unarmed' ? pendingRoll.smod : 0

      // Find target — could be PC (in entries) or NPC (in initiativeOrder + rosterNpcs)
      const targetInitEntry = initiativeOrder.find(e => e.character_name === targetName)
      const targetEntry = entries.find(e => e.character.name === targetName) ?? (targetInitEntry?.character_id ? entries.find(e => e.character.id === targetInitEntry.character_id) : undefined)
      const targetNpc = targetInitEntry?.is_npc
        ? (rosterNpcs.find(n => n.id === targetInitEntry.npc_id) ?? campaignNpcs.find((n: any) => n.id === targetInitEntry.npc_id))
        : null
      const targetRapid = targetEntry?.character.data?.rapid ?? (targetNpc ? { PHY: targetNpc.physicality ?? 0, DEX: targetNpc.dexterity ?? 0 } : {})
      const defensiveMod = isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0)

      let { finalWP, finalRP, mitigated } = calculateDamage(totalWP + unarmedBonus, weapon.rpPercent, defensiveMod)

      // Stun: zero WP damage
      if (isStun) {
        finalWP = 0
        traitNotes.push('Stun — no WP damage dealt')
        if (outcome === 'Wild Success' || outcome === 'High Insight') {
          const targetPhy = targetRapid.PHY ?? 0
          const stunRounds = Math.max(1, Math.floor(Math.random() * 6) + 1 - targetPhy)
          traitNotes.push(`Target incapacitated for ${stunRounds} round${stunRounds !== 1 ? 's' : ''}`)
        }
      }

      // Burst note
      if (useBurst && rolls > 1) {
        traitNotes.push(`Automatic Burst — ${rolls} rounds fired`)
      }

      // Blast Radius note
      if (hasBlast) {
        const halfWP = Math.floor(finalWP / 2)
        const quarterWP = Math.floor(finalWP / 4)
        traitNotes.push(`Blast Radius — Engaged: ${finalWP} WP | Close: ${halfWP} WP | Further: ${quarterWP} WP`)
      }

      // Burning note
      if (burningVal !== null && burningVal > 0) {
        const burnRounds = Math.floor(Math.random() * 3) + 1
        traitNotes.push(`Burning — ${burningVal} WP/RP per round for ${burnRounds} round${burnRounds !== 1 ? 's' : ''}`)
      }

      // Close-Up / Cone-Up note
      if (hasCloseUp) traitNotes.push('Close-Up — at Engaged range, 50% damage to bystanders')
      if (hasConeUp) traitNotes.push('Cone-Up — at Engaged range, 50% damage to bystanders')

      damageResult = { base: totalBase, diceRoll: totalDice, diceDesc: rolls > 1 ? `${rolls}x ${diceDesc}` : diceDesc, phyBonus: totalPhy, totalWP: totalWP + unarmedBonus, finalWP, finalRP, mitigated, targetName }

      // Auto-decrement ammo for ranged attacks
      if (w && !isMelee && w.clip && myEntry) {
        const charData = myEntry.character.data ?? {}
        const slots = ['weaponPrimary', 'weaponSecondary'] as const
        for (const slot of slots) {
          if (charData[slot]?.weaponName === weapon.weaponName && charData[slot]?.ammoCurrent > 0) {
            const ammoUsed = rolls > 1 ? rolls : 1
            const newAmmo = Math.max(0, charData[slot].ammoCurrent - ammoUsed)
            await supabase.from('characters').update({
              data: { ...charData, [slot]: { ...charData[slot], ammoCurrent: newAmmo } }
            }).eq('id', myEntry.character.id)
            break
          }
        }
      }

      // Auto-apply damage to target (PC or NPC)
      console.warn('[damage] target lookup:', { targetName, targetEntry: !!targetEntry, hasLiveState: !!targetEntry?.liveState, targetNpc: !!targetNpc, finalWP, finalRP })
      if (targetEntry?.liveState) {
        // PC target — use character_states
        // Re-fetch fresh HP from DB to avoid stale closure values
        const { data: freshState } = await supabase.from('character_states').select('*').eq('id', targetEntry.stateId).single()
        const currentWP = freshState?.wp_current ?? targetEntry.liveState.wp_current
        const currentRP = freshState?.rp_current ?? targetEntry.liveState.rp_current
        const currentInsight = freshState?.insight_dice ?? targetEntry.liveState.insight_dice ?? 0
        const newWP = Math.max(0, currentWP - finalWP)
        const newRP = Math.max(0, currentRP - finalRP)
        console.warn('[damage] PC target', targetEntry.character.name, 'WP:', currentWP, '→', newWP, 'RP:', currentRP, '→', newRP)

        if (newWP === 0 && currentWP > 0 && currentInsight > 0) {
          const { error: csErr, data: csData } = await supabase.from('character_states').update({ rp_current: newRP, updated_at: new Date().toISOString() }).eq('id', targetEntry.stateId).select()
          if (csErr) console.error('[damage] PC character_states update error:', csErr.message)
          else console.warn('[damage] PC character_states update returned', csData?.length, 'rows')
          setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, rp_current: newRP } } : e))
          // Broadcast RP change so the player sees updated sheet
          initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
          const insightData = {
            stateId: targetEntry.stateId,
            targetName: targetEntry.character.name,
            targetUserId: targetEntry.userId,
            newWP, newRP,
            phyAmod: targetEntry.character.data?.rapid?.PHY ?? 0,
            insightDice: currentInsight,
          }
          // Show modal only on the PLAYER's screen (or GM if they own the PC)
          if (targetEntry.userId === userId) {
            setInsightSavePrompt(insightData)
          }
          // Broadcast so the player's client shows the modal
          initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound', payload: insightData })
        } else {
          const update: any = { wp_current: newWP, rp_current: newRP, updated_at: new Date().toISOString() }
          if (newWP === 0 && targetEntry.liveState.wp_current > 0) {
            update.death_countdown = Math.max(1, 4 + (targetEntry.character.data?.rapid?.PHY ?? 0))
            await supabase.from('roll_log').insert({
              campaign_id: id, user_id: userId,
              character_name: 'Death is in the air',
              label: `${targetEntry.character.name} is mortally wounded by ${characterName} and will die if not stabilized in ${update.death_countdown} rounds.`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'death',
            })
            // Notify the player whose PC is dying (even without insight dice)
            initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound', payload: {
              stateId: targetEntry.stateId,
              targetName: targetEntry.character.name,
              targetUserId: targetEntry.userId,
              newWP, newRP,
              phyAmod: targetEntry.character.data?.rapid?.PHY ?? 0,
              insightDice: 0,
            } })
          }
          // Set incapacitation when RP first hits 0
          if (newRP === 0 && targetEntry.liveState.rp_current > 0 && newWP > 0) {
            update.incap_rounds = Math.max(1, 4 - (targetEntry.character.data?.rapid?.PHY ?? 0))
          }
          const { error: csErr, data: csData } = await supabase.from('character_states').update(update).eq('id', targetEntry.stateId).select()
          if (csErr) console.error('[damage] PC character_states update error:', csErr.message)
          else console.warn('[damage] PC character_states update returned', csData?.length, 'rows')
          setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, ...update } } : e))
          // Broadcast so other clients (the player whose PC took damage) refresh
          initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
          // Mortally wounded / incapacitated — zero their actions and auto-advance if active
          if (combatActive && (newWP === 0 || newRP === 0)) {
            const initEntry = initiativeOrder.find(e => e.character_id === targetEntry.character.id)
            if (initEntry) {
              await supabase.from('initiative_order').update({ actions_remaining: 0 }).eq('id', initEntry.id)
              if (initEntry.is_active) {
                await nextTurn()
              }
              await loadInitiative(id)
              initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
            }
          }
        }
      } else if (targetNpc) {
        // NPC target — use campaign_npcs
        const npcWP = targetNpc.wp_current ?? targetNpc.wp_max ?? 10
        const npcRP = targetNpc.rp_current ?? targetNpc.rp_max ?? 6
        const newWP = Math.max(0, npcWP - finalWP)
        const newRP = Math.max(0, npcRP - finalRP)
        console.warn('[damage] NPC target', targetNpc.name, 'id:', targetNpc.id, 'WP:', npcWP, '→', newWP, 'RP:', npcRP, '→', newRP)
        const npcUpdate: any = { wp_current: newWP, rp_current: newRP }
        // Mortal wound — NPC enters death countdown when WP first hits 0
        if (newWP === 0 && npcWP > 0) {
          npcUpdate.death_countdown = Math.max(1, 4 + (targetNpc.physicality ?? 0))
          // Log the mortal wound to the game feed
          await supabase.from('roll_log').insert({
            campaign_id: id, user_id: userId,
            character_name: 'Death is in the air',
            label: `${targetNpc.name} is mortally wounded by ${characterName} and will die if not stabilized in ${npcUpdate.death_countdown} rounds.`,
            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: 'death',
          })
        }
        // Incapacitation — NPC loses consciousness when RP first hits 0
        if (newRP === 0 && npcRP > 0 && newWP > 0) {
          npcUpdate.incap_rounds = Math.max(1, 4 - (targetNpc.physicality ?? 0))
        }
        const { error: npcUpdErr, data: npcUpdData } = await supabase
          .from('campaign_npcs')
          .update(npcUpdate)
          .eq('id', targetNpc.id)
          .select()
        if (npcUpdErr) console.error('[damage] campaign_npcs update error:', npcUpdErr.message)
        else console.warn('[damage] campaign_npcs update returned', npcUpdData?.length, 'rows')
        // Direct state update for THIS client (the roller).
        const npcId = targetNpc.id
        const patch = { ...npcUpdate }
        npcFetchInFlightRef.current = true  // suppress realtime overwrite
        setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
        setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
        setViewingNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } as CampaignNpc : n))
        setTimeout(() => { npcFetchInFlightRef.current = false }, 500)
        // Broadcast to OTHER clients (GM) so they re-fetch NPC data.
        // Without this, a player dealing damage only updates their own state.
        initChannelRef.current?.send({ type: 'broadcast', event: 'npc_damaged', payload: { npcId, patch } })
        // Mortally wounded / incapacitated — zero their actions and auto-advance if active
        if (combatActive && (newWP === 0 || newRP === 0)) {
          const initEntry = initiativeOrder.find(e => e.npc_id === npcId)
          if (initEntry) {
            await supabase.from('initiative_order').update({ actions_remaining: 0 }).eq('id', initEntry.id)
            if (initEntry.is_active) {
              await nextTurn()
            }
            await loadInitiative(id)
            initChannelRef.current?.send({ type: 'broadcast', event: 'turn_changed', payload: {} })
          }
        }
      } else {
        console.warn('[damage] no target resolved — damage NOT applied. targetName was:', targetName)
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

    // Upkeep Check result — adjust weapon condition
    let upkeepResult = ''
    if (pendingRoll.label.startsWith('Upkeep — ') && myEntry) {
      const weaponName = pendingRoll.label.replace('Upkeep — ', '')
      const charData = myEntry.character.data ?? {}
      const conditions = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']
      const slots = ['weaponPrimary', 'weaponSecondary'] as const
      for (const slot of slots) {
        if (charData[slot]?.weaponName === weaponName) {
          const currentIdx = conditions.indexOf(charData[slot].condition ?? 'Used')
          let newIdx = currentIdx
          if (outcome === 'Wild Success') { newIdx = Math.max(1, currentIdx - 1); upkeepResult = 'Condition improved by 1 level' }
          else if (outcome === 'High Insight') { newIdx = Math.max(1, currentIdx - 2); upkeepResult = 'Condition improved by 2 levels' }
          else if (outcome === 'Failure') { newIdx = Math.min(4, currentIdx + 1); upkeepResult = 'Condition degraded by 1 level' }
          else if (outcome === 'Dire Failure') { newIdx = 4; upkeepResult = 'Item breaks immediately!' }
          else if (outcome === 'Low Insight') {
            newIdx = 4; upkeepResult = 'Item breaks immediately! 1 WP damage.'
            if (myEntry.liveState) {
              const newWP = Math.max(0, myEntry.liveState.wp_current - 1)
              await supabase.from('character_states').update({ wp_current: newWP }).eq('id', myEntry.stateId)
            }
          }
          else { upkeepResult = 'No change to condition' }
          if (newIdx !== currentIdx) {
            await supabase.from('characters').update({
              data: { ...charData, [slot]: { ...charData[slot], condition: conditions[newIdx] } }
            }).eq('id', myEntry.character.id)
          }
          break
        }
      }
    }

    // Stabilize result — stop death countdown on success (PC or NPC)
    let stabilizeResult = ''
    if (pendingRoll.label.includes('Stabilize ')) {
      const stTargetName = pendingRoll.label.split('Stabilize ')[1]
      const targetEntry = entries.find(e => e.character.name === stTargetName)
      const targetNpcStab = campaignNpcs.find((n: any) => n.name === stTargetName)
      if (targetEntry?.liveState && targetEntry.liveState.wp_current === 0) {
        // PC stabilization
        if (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight') {
          const phyAmod = targetEntry.character.data?.rapid?.PHY ?? 0
          const incapRounds = Math.max(1, Math.floor(Math.random() * 6) + 1 - phyAmod)
          await supabase.from('character_states').update({ death_countdown: null, incap_rounds: incapRounds, updated_at: new Date().toISOString() }).eq('id', targetEntry.stateId)
          setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, death_countdown: null, incap_rounds: incapRounds } as any } : e))
          stabilizeResult = `${stTargetName} stabilized! Incapacitated for ${incapRounds} round${incapRounds !== 1 ? 's' : ''}, then regains 1 WP + 1 RP.`
        } else {
          stabilizeResult = `Failed to stabilize ${stTargetName}.`
        }
      } else if (targetNpcStab && (targetNpcStab.wp_current ?? targetNpcStab.wp_max ?? 10) === 0) {
        // NPC stabilization
        if (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight') {
          const phyAmod = targetNpcStab.physicality ?? 0
          const incapRounds = Math.max(1, Math.floor(Math.random() * 6) + 1 - phyAmod)
          await supabase.from('campaign_npcs').update({ death_countdown: null, incap_rounds: incapRounds }).eq('id', targetNpcStab.id)
          const npcPatch = { death_countdown: null, incap_rounds: incapRounds }
          setCampaignNpcs(prev => prev.map(n => n.id === targetNpcStab.id ? { ...n, ...npcPatch } : n))
          setRosterNpcs(prev => prev.map(n => n.id === targetNpcStab.id ? { ...n, ...npcPatch } : n))
          setViewingNpcs(prev => prev.map(n => n.id === targetNpcStab.id ? { ...n, ...npcPatch } as CampaignNpc : n))
          stabilizeResult = `${stTargetName} stabilized! Incapacitated for ${incapRounds} round${incapRounds !== 1 ? 's' : ''}, then regains 1 WP + 1 RP.`
        } else {
          stabilizeResult = `Failed to stabilize ${stTargetName}.`
        }
      }
    }

    await saveRollToLog(die1, die2, pendingRoll.amod, pendingRoll.smod, cmodVal, pendingRoll.label, characterName, false, targetName || null, damageResult)

    setRollResult({
      die1, die2, amod: pendingRoll.amod, smod: pendingRoll.smod, cmod: cmodVal,
      total, outcome, label: pendingRoll.label, insightAwarded, spent: preRollSpent,
      damage: damageResult, weaponJammed, traitNotes: [...traitNotes, ...(upkeepResult ? [upkeepResult] : []), ...(stabilizeResult ? [stabilizeResult] : [])],
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

    // Calculate and apply damage if the reroll turned a failure into a hit
    let rerollDamage: DamageResult | undefined
    if (pendingRoll?.weapon && targetName && (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight')) {
      const weapon = pendingRoll.weapon
      const w = getWeaponByName(weapon.weaponName)
      const isMelee = w?.category === 'melee' || weapon.weaponName === 'Unarmed'
      const targetInitEntry = initiativeOrder.find(e => e.character_name === targetName)
      const targetEntry = entries.find(e => e.character.name === targetName) ?? (targetInitEntry?.character_id ? entries.find(e => e.character.id === targetInitEntry.character_id) : undefined)
      const targetNpcObj = targetInitEntry?.is_npc ? (rosterNpcs.find(n => n.id === targetInitEntry.npc_id) ?? campaignNpcs.find((n: any) => n.id === targetInitEntry.npc_id)) : null
      const targetRapid = targetEntry?.character.data?.rapid ?? (targetNpcObj ? { PHY: targetNpcObj.physicality ?? 0, DEX: targetNpcObj.dexterity ?? 0 } : {})
      const defensiveMod = isMelee ? (targetRapid.PHY ?? 0) : (targetRapid.DEX ?? 0)

      const attackerPhy = myEntry.character.data?.rapid?.PHY ?? 0
      const dmg = rollDamage(weapon.damage, attackerPhy, !!isMelee)
      const unarmedBonus = weapon.weaponName === 'Unarmed' ? rollResult.smod : 0
      const { finalWP, finalRP, mitigated } = calculateDamage(dmg.totalWP + unarmedBonus, weapon.rpPercent, defensiveMod)

      rerollDamage = { base: dmg.base, diceRoll: dmg.diceRoll, diceDesc: dmg.diceDesc, phyBonus: dmg.phyBonus, totalWP: dmg.totalWP + unarmedBonus, finalWP, finalRP, mitigated, targetName }

      // Apply damage to target
      if (targetEntry?.liveState) {
        const tNewWP = Math.max(0, targetEntry.liveState.wp_current - finalWP)
        const tNewRP = Math.max(0, targetEntry.liveState.rp_current - finalRP)
        const update: any = { wp_current: tNewWP, rp_current: tNewRP, updated_at: new Date().toISOString() }
        if (tNewWP === 0 && targetEntry.liveState.wp_current > 0) {
          update.death_countdown = Math.max(1, 4 + (targetEntry.character.data?.rapid?.PHY ?? 0))
        }
        if (tNewRP === 0 && targetEntry.liveState.rp_current > 0 && tNewWP > 0) {
          update.incap_rounds = Math.max(1, 4 - (targetEntry.character.data?.rapid?.PHY ?? 0))
        }
        await supabase.from('character_states').update(update).eq('id', targetEntry.stateId)
        setEntries(prev => prev.map(e => e.stateId === targetEntry.stateId ? { ...e, liveState: { ...e.liveState, ...update } } : e))
        initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
      } else if (targetNpcObj) {
        const tNpcWP = targetNpcObj.wp_current ?? targetNpcObj.wp_max ?? 10
        const tNpcRP = targetNpcObj.rp_current ?? targetNpcObj.rp_max ?? 6
        const tNewWP = Math.max(0, tNpcWP - finalWP)
        const tNewRP = Math.max(0, tNpcRP - finalRP)
        const npcUpdate: any = { wp_current: tNewWP, rp_current: tNewRP }
        if (tNewWP === 0 && tNpcWP > 0) npcUpdate.death_countdown = Math.max(1, 4 + (targetNpcObj.physicality ?? 0))
        if (tNewRP === 0 && tNpcRP > 0 && tNewWP > 0) npcUpdate.incap_rounds = Math.max(1, 4 - (targetNpcObj.physicality ?? 0))
        await supabase.from('campaign_npcs').update(npcUpdate).eq('id', targetNpcObj.id)
        const npcId = targetNpcObj.id
        const patch = { ...npcUpdate }
        npcFetchInFlightRef.current = true
        setCampaignNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
        setRosterNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } : n))
        setViewingNpcs(prev => prev.map(n => n.id === npcId ? { ...n, ...patch } as CampaignNpc : n))
        setTimeout(() => { npcFetchInFlightRef.current = false }, 500)
        initChannelRef.current?.send({ type: 'broadcast', event: 'npc_damaged', payload: { npcId, patch } })
      }

      // Save damage to log
      await saveRollToLog(newDie1, newDie2, rollResult.amod, rollResult.smod, rollResult.cmod, rollResult.label, characterName, true, targetName, rerollDamage)
    }

    setRollResult({ ...rollResult, die1: newDie1, die2: newDie2, total, outcome, insightAwarded, spent: true, damage: rerollDamage ?? (rollResult as any).damage })
    setRolling(false)
    await Promise.all([loadEntries(id), loadRolls(id)])
  }

  async function closeRollModal() {
    // Use ref (synchronous, immune to React batching) to determine if a roll
    // was actually executed — rollResult state can be stale in closures.
    const didRoll = rollExecutedRef.current
    const preConsumed = actionPreConsumedRef.current
    rollExecutedRef.current = false
    actionPreConsumedRef.current = false
    setPendingRoll(null)
    setRollResult(null)

    console.warn('[closeRollModal] didRoll:', didRoll, 'combatActive:', combatActive, 'preConsumed:', preConsumed)
    // Consume an action if a roll was actually executed.
    // Skip if the action was already pre-consumed (Charge/Rapid Fire/Stabilize).
    if (didRoll && combatActive && !preConsumed) {
      // Re-fetch active entry from DB to avoid stale closure state
      const { data: freshOrder, error: foErr } = await supabase.from('initiative_order').select('*').eq('campaign_id', id).eq('is_active', true).limit(1)
      if (foErr) console.warn('[closeRollModal] active fetch error:', foErr.message)
      const activeEntry = freshOrder?.[0]
      console.warn('[closeRollModal] activeEntry:', activeEntry?.character_name, 'user_id:', activeEntry?.user_id, 'me:', userId, 'isGM:', isGM, 'is_npc:', activeEntry?.is_npc)
      if (activeEntry) {
        const isMyTurn = activeEntry.user_id === userId
        const isGMRollingNPC = isGM && activeEntry.is_npc
        const isGMRollingPC = isGM && !activeEntry.is_npc
        if (isMyTurn || isGMRollingNPC || isGMRollingPC) {
          await consumeAction(activeEntry.id)
        } else {
          console.warn('[closeRollModal] not consuming — not my turn / not GM authority')
        }
      } else {
        console.warn('[closeRollModal] no active entry found')
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
  const playerEntries = (() => {
    const filtered = entries.filter(e => e.userId !== campaign.gm_user_id)
    // Float the current viewer's own character to position 0 (right next to GM).
    if (!userId) return filtered
    const meIdx = filtered.findIndex(e => e.userId === userId)
    if (meIdx <= 0) return filtered
    return [filtered[meIdx], ...filtered.slice(0, meIdx), ...filtered.slice(meIdx + 1)]
  })()
  const syncedSelectedEntry = selectedEntry ? entries.find(e => e.stateId === selectedEntry.stateId) ?? selectedEntry : null
  const myEntry = entries.find(e => e.userId === userId) ?? null
  const myInsightDice = myEntry?.liveState?.insight_dice ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: 'Barlow, sans-serif', background: '#0f0f0f' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #c0392b', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, background: '#0f0f0f', position: 'relative', zIndex: 10001 }}>
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
            style={{ ...hdrBtn('#1a2e10', '#7fc458', '#2d5a1b'), opacity: sessionActing ? 0.5 : 1, cursor: sessionActing ? 'not-allowed' : 'pointer' }}>
            {sessionActing ? 'Starting...' : 'Start Session'}
          </button>
        )}
        {isGM && sessionStatus === 'active' && (
          <button onClick={async () => {
            // Fetch any submitted player notes so the GM sees them in the modal.
            // Only pull notes that were written DURING this session — notes from
            // prior sessions must not carry forward (see sql/player-notes-session-tag.sql).
            const { data } = await supabase
              .from('player_notes')
              .select('id, user_id, title, content, submitted_at')
              .eq('campaign_id', id)
              .eq('submitted_to_summary', true)
              .eq('session_number', sessionCount)
              .order('submitted_at', { ascending: true })
            // Resolve character name for each note via the entries table snapshot.
            const enriched = (data ?? []).map((n: any) => {
              const entry = entries.find(e => e.userId === n.user_id)
              return { ...n, character_name: entry?.character.name ?? 'Unknown' }
            })
            setSubmittedPlayerNotes(enriched)
            setShowEndSessionModal(true)
          }}
            style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>
            End Session
          </button>
        )}
        {sessionStatus === 'active' && (
          <div style={hdrBtn('#1a2e10', '#7fc458', '#2d5a1b')}>
            Session {sessionCount}
          </div>
        )}
        {isGM && sessionStatus === 'active' && !combatActive && (
          <button onClick={startCombat} disabled={startingCombat || entries.length === 0}
            style={{ ...hdrBtn('#7a1f16', '#f5a89a', '#c0392b'), opacity: startingCombat || entries.length === 0 ? 0.5 : 1, cursor: startingCombat || entries.length === 0 ? 'not-allowed' : 'pointer' }}>
            {startingCombat ? 'Rolling...' : '⚔️ Start Combat'}
          </button>
        )}
        {isGM && combatActive && (
          <button onClick={endCombat}
            style={hdrBtn('#0f2035', '#7ab3d4', '#1a3a5c')}>
            End Combat
          </button>
        )}
        {combatActive && (
          <div style={hdrBtn('#2a1210', '#f5a89a', '#c0392b')}>
            In Combat
          </div>
        )}
        <div style={{ flex: 1 }} />
        {sessionStatus === 'active' && (
          <select value="" onChange={e => { if (e.target.value) setShowSpecialCheck(e.target.value as any); e.target.value = '' }}
            style={{ ...hdrBtn('#1a1a2e', '#7ab3d4', '#2e2e5a'), width: '80px' }}>
            <option value="">Checks</option>
            <option value="perception">Perception</option>
            <option value="gut">Gut Instinct</option>
            <option value="first_impression">First Impression</option>
            <option value="group">Group Check</option>
            <option value="opposed">Opposed Check</option>
          </select>
        )}
        {campaign?.invite_code && (
          <button onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/join/${campaign.invite_code}`)
            alert('Invite link copied to clipboard!')
          }}
            style={hdrBtn('#1a1a2e', '#7ab3d4', '#2e2e5a')}
            title={`Code: ${campaign.invite_code}`}>
            Share
          </button>
        )}
        <button onClick={() => { setSheetMode(m => m === 'inline' ? 'overlay' : 'inline'); setSheetPos(null) }}
          style={hdrBtn('#242424', '#cce0f5', '#3a3a3a')}>
          {sheetMode === 'inline' ? 'Overlay' : 'Inline'}
        </button>
        {isGM && (
          <button onClick={() => {
            // Pre-select everyone who's damaged, dead, or wounded
            const damagedNpcs = campaignNpcs.filter((n: any) => {
              const wp = n.wp_current ?? n.wp_max ?? 10
              const wpMax = n.wp_max ?? 10
              const rp = n.rp_current ?? n.rp_max ?? 6
              const rpMax = n.rp_max ?? 6
              return n.status === 'dead' || wp < wpMax || rp < rpMax
            }).map(n => `npc:${n.id}`)
            const damagedPCs = entries.filter(e => e.liveState && (e.liveState.wp_current < e.liveState.wp_max || e.liveState.rp_current < e.liveState.rp_max))
              .map(e => `pc:${e.stateId}`)
            setRestoreNpcIds(new Set([...damagedNpcs, ...damagedPCs]))
            setShowRestorePicker(true)
          }}
            style={hdrBtn('#1a2e10', '#7fc458', '#2d5a1b')}>
            Restore
          </button>
        )}
        {sessionCount > 0 && (
          <a href={`/stories/${id}/sessions`}
            style={{ ...hdrBtn('#242424', '#d4cfc9', '#3a3a3a'), textDecoration: 'none' }}>
            Sessions
          </a>
        )}
        <a href={`/stories/${id}`} style={{ ...hdrBtn('#242424', '#d4cfc9', '#3a3a3a'), textDecoration: 'none' }}>
          Back
        </a>
        <a href="/stories" style={{ ...hdrBtn('#7a1f16', '#f5a89a', '#c0392b'), textDecoration: 'none' }}>
          Exit
        </a>
      </div>

      {/* Initiative Tracker — shown when combat is active */}
      {combatActive && (
        <div style={{ borderBottom: '1px solid #2e2e2e', background: '#0d0d0d', padding: '8px 12px', flexShrink: 0, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'max-content' }}>
            <div style={{ fontSize: '9px', color: '#c0392b', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginRight: '4px', flexShrink: 0 }}>
              ⚔️ Initiative
            </div>

            {(() => {
              // Filter out only DEAD combatants (death countdown expired).
              // Mortally wounded and incapacitated stay visible — they need stabilizing.
              const alive = initiativeOrder.filter(entry => {
                if (entry.is_npc && entry.npc_id) {
                  const npc = campaignNpcs.find((n: any) => n.id === entry.npc_id)
                  if (npc) {
                    const wp = npc.wp_current ?? npc.wp_max ?? 10
                    if (wp === 0 && npc.death_countdown != null && npc.death_countdown <= 0) return false
                    if (npc.status === 'dead') return false
                  }
                } else {
                  const ce = entries.find(e => entry.character_id ? e.character.id === entry.character_id : e.character.name === entry.character_name)
                  if (ce?.liveState) {
                    if (ce.liveState.wp_current === 0 && (ce.liveState as any).death_countdown != null && (ce.liveState as any).death_countdown <= 0) return false
                  }
                }
                return true
              })
              // Rotate so active combatant is first (leftmost), rest follow in turn order
              const activeIdx = alive.findIndex(e => e.is_active)
              return activeIdx >= 0
                ? [...alive.slice(activeIdx), ...alive.slice(0, activeIdx)]
                : alive
            })().map((entry, idx) => {
              // Green = active (has initiative), Yellow = waiting (hasn't gone yet), Red = already acted
              const hasActed = !entry.is_active && entry.actions_remaining != null && entry.actions_remaining <= 0
              const borderColor = entry.is_active ? '#7fc458' : hasActed ? '#c0392b' : '#EF9F27'
              const bgColor = entry.is_active ? '#1a2e10' : hasActed ? '#1a1010' : '#1a1a1a'
              return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px',
                background: bgColor,
                border: `1px solid ${borderColor}`,
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
                      <img src={entry.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '7px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{entry.character_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                    )}
                  </div>
                )}
                <span style={{ fontSize: '11px', fontWeight: entry.is_active ? 700 : 400, color: entry.is_active ? '#f5f2ee' : '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {entry.character_name}
                </span>
                {entry.is_npc && entry.npc_type && (
                  <span style={{ fontSize: '8px', color: entry.npc_type === 'bystander' ? '#7fc458' : entry.npc_type === 'antagonist' ? '#d48bd4' : entry.npc_type === 'foe' ? '#f5a89a' : '#EF9F27', background: entry.npc_type === 'bystander' ? '#1a2e10' : entry.npc_type === 'antagonist' ? '#2a102a' : entry.npc_type === 'foe' ? '#2a1210' : '#2a2010', border: `1px solid ${entry.npc_type === 'bystander' ? '#2d5a1b' : entry.npc_type === 'antagonist' ? '#8b2e8b' : entry.npc_type === 'foe' ? '#c0392b' : '#5a4a1b'}`, padding: '0 4px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>{entry.npc_type}</span>
                )}
                {entry.is_npc && !entry.npc_type && (
                  <span style={{ fontSize: '8px', color: '#EF9F27', background: '#2a2010', border: '1px solid #EF9F27', padding: '0 4px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>NPC</span>
                )}
                <span style={{ fontSize: '11px', color: entry.is_active ? '#c0392b' : '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>{entry.roll}</span>
                <span style={{ fontSize: '10px', letterSpacing: '2px' }}>
                  {Array.from({ length: 2 }).map((_, i) => {
                    const remaining = entry.actions_remaining ?? 0
                    const hasActions = i < remaining
                    const color = hasActions ? '#7fc458' : '#3a3a3a'
                    return <span key={i} style={{ color }}>●</span>
                  })}
                </span>
                {/* Aim/social bonus badge */}
                {(entry.aim_bonus ?? 0) !== 0 && (
                  <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: entry.aim_bonus > 0 ? '#7fc458' : '#c0392b' }}>
                    {entry.aim_bonus > 0 ? '+' : ''}{entry.aim_bonus}
                  </span>
                )}
                {/* Status badges — PCs and NPCs */}
                {(() => {
                  if (entry.is_npc && entry.npc_id) {
                    const npc = campaignNpcs.find((n: any) => n.id === entry.npc_id)
                    if (!npc) return null
                    const npcWP = npc.wp_current ?? npc.wp_max ?? 10
                    const npcRP = npc.rp_current ?? npc.rp_max ?? 6
                    const isDead = npcWP === 0 && npc.death_countdown != null && npc.death_countdown <= 0
                    const isMortal = npcWP === 0 && !isDead
                    const isUnconscious = npcRP === 0 && npcWP > 0
                    return <>
                      {isDead && <span style={{ fontSize: '10px' }} title="Dead">💀</span>}
                      {isMortal && <span style={{ fontSize: '10px' }} title={`Death in ${npc.death_countdown ?? '?'} rounds`}>🩸</span>}
                      {isUnconscious && <span style={{ fontSize: '10px' }} title="Unconscious">💤</span>}
                    </>
                  }
                  const charEntry = entries.find(e => entry.character_id ? e.character.id === entry.character_id : e.character.name === entry.character_name)
                  if (!charEntry?.liveState) return null
                  const ls = charEntry.liveState
                  const isDead = ls.wp_current === 0 && (ls as any).death_countdown != null && (ls as any).death_countdown <= 0
                  const isMortal = ls.wp_current === 0 && !isDead
                  const isUnconscious = ls.rp_current === 0 && ls.wp_current > 0
                  const isStressed = ls.stress >= 3
                  return <>
                    {isDead && <span style={{ fontSize: '10px' }} title="Dead">💀</span>}
                    {isMortal && <span style={{ fontSize: '10px' }} title={`Death in ${(ls as any).death_countdown ?? '?'} rounds`}>🩸</span>}
                    {isUnconscious && <span style={{ fontSize: '10px' }} title="Unconscious">💤</span>}
                    {isStressed && !isDead && !isMortal && <span style={{ fontSize: '10px' }} title="Stressed">⚡</span>}
                  </>
                })()}
                {/* Defer — GM can defer anyone, players can defer their own */}
                {(isGM || entry.user_id === userId) && idx < initiativeOrder.length - 1 && (
                  <button onClick={() => deferInitiative(entry.id)}
                    style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }} title="Defer">↓</button>
                )}
                {/* Done/Remove — player can end own turn, GM can end anyone or remove */}
                {(isGM || (entry.user_id === userId && entry.is_active)) && (
                  <button onClick={async () => {
                    if (isGM && !entry.is_active) { removeFromInitiative(entry.id); return }
                    await nextTurn()
                  }}
                    style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
                )}
              </div>
            )})}

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
          {/* Action buttons — shown for active combatant or GM */}
          {(() => {
            const activeEntry = initiativeOrder.find(e => e.is_active)
            if (!activeEntry || (activeEntry.actions_remaining ?? 0) <= 0) return null
            const myChar = entries.find(e => e.userId === userId)
            const isMyTurn = !!(activeEntry.character_id && myChar && activeEntry.character_id === myChar.character.id)
            const canAct = isMyTurn || isGM
            if (!canAct) return null
            console.warn('[CombatActions]', { isMyTurn, isGM, activeChar: activeEntry.character_name, myCharId: myChar?.character.id, activeCharId: activeEntry.character_id, userId })

            // Determine combatant's weapon for conditional buttons
            const charEntry = entries.find(e => e.character.name === activeEntry.character_name)
            const weaponData = charEntry?.character.data?.weaponPrimary ?? null
            const w = weaponData ? getWeaponByName(weaponData.weaponName) : null
            const hasBurst = w ? getTraitValue(w.traits, 'Automatic Burst') !== null : false
            const isMelee = w?.category === 'melee'
            const has2Actions = (activeEntry.actions_remaining ?? 0) >= 2

            const actBtn = (bg: string, color: string, border: string): React.CSSProperties => ({
              padding: '2px 8px', background: bg, border: `1px solid ${border}`, borderRadius: '3px',
              color, fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer',
            })

            const disabledBtn = (bg: string, color: string, border: string): React.CSSProperties => ({
              ...actBtn(bg, color, border), opacity: 0.3, cursor: 'not-allowed',
            })

            return (
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '2px', display: 'flex', alignItems: 'center', gap: '3px', lineHeight: 1 }}>
                  Actions
                  <span style={{ color: (activeEntry.actions_remaining ?? 0) >= 1 ? '#7fc458' : '#EF9F27', fontSize: '24px', lineHeight: 0, position: 'relative', top: '-1px' }}>●</span>
                  <span style={{ color: (activeEntry.actions_remaining ?? 0) >= 2 ? '#7fc458' : '#EF9F27', fontSize: '24px', lineHeight: 0, position: 'relative', top: '-1px' }}>●</span>
                </span>
                <button onClick={() => handleAim(activeEntry.id)}
                  style={actBtn('#1a2e10', '#7fc458', '#2d5a1b')}>
                  Aim{(activeEntry.aim_bonus ?? 0) > 0 ? ` (+${activeEntry.aim_bonus})` : ''}
                </button>
                <span style={{ ...actBtn('#7a1f16', '#f5a89a', '#c0392b'), cursor: 'default', opacity: 0.7 }} title="Use weapon buttons on character sheet">Attack</span>
                {isMelee && w ? (
                  <button onClick={has2Actions ? () => {
                    const rapid = charEntry?.character.data?.rapid ?? {}
                    const amod = rapid.PHY ?? 0
                    const smod = charEntry?.character.data?.skills?.find((s: any) => s.skillName === 'Melee Combat')?.level ?? 0
                    handleRollRequest(`${activeEntry.character_name} — Charge (${w.name})`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: 1, traits: w.traits })
                    actionPreConsumedRef.current = true
                    consumeAction(activeEntry.id, undefined, 2)
                  } : undefined} disabled={!has2Actions}
                    style={has2Actions ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}>Charge</button>
                ) : (
                  <button disabled style={disabledBtn('#242424', '#d4cfc9', '#3a3a3a')}>Charge</button>
                )}
                {['Coordinate', 'Cover Fire', 'Distract', 'Inspire'].map(action => {
                  const isBoost = action === 'Coordinate' || action === 'Inspire'
                  const targets = initiativeOrder.filter(e => {
                    if (e.id === activeEntry.id) return false
                    return isBoost ? !e.is_npc : e.is_npc
                  })
                  const isOpen = socialTarget?.action === action
                  return (
                    <span key={action} style={{ position: 'relative' }}>
                      <button onClick={() => setSocialTarget(isOpen ? null : { action })}
                        style={actBtn(isOpen ? '#1a2e10' : '#242424', isOpen ? '#7fc458' : '#d4cfc9', isOpen ? '#2d5a1b' : '#3a3a3a')}>{action}</button>
                      {isOpen && targets.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', minWidth: '120px', marginTop: '2px' }}>
                          {targets.map(t => (
                            <div key={t.id} onClick={() => applySocialAction(action, t.id)}
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderBottom: '1px solid #2e2e2e' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              {t.character_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </span>
                  )
                })}
                <button onClick={() => consumeAction(activeEntry.id, `${activeEntry.character_name} — Defend`)}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Defend</button>
                <button onClick={() => consumeAction(activeEntry.id, `${activeEntry.character_name} — Move`)}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Move</button>
                {hasBurst && w ? (
                  <button onClick={has2Actions ? () => {
                    setUseBurst(true)
                    const skillName = w.skill
                    const attrKey = w.category === 'melee' ? 'PHY' : 'DEX'
                    const rapid = charEntry?.character.data?.rapid ?? {}
                    const amod = rapid[attrKey] ?? 0
                    const smod = charEntry?.character.data?.skills?.find((s: any) => s.skillName === skillName)?.level ?? 0
                    handleRollRequest(`${activeEntry.character_name} — Rapid Fire (${w.name})`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: 0, traits: w.traits })
                    actionPreConsumedRef.current = true
                    consumeAction(activeEntry.id, undefined, 2)
                  } : undefined} disabled={!has2Actions}
                    style={has2Actions ? actBtn('#7a1f16', '#f5a89a', '#c0392b') : disabledBtn('#7a1f16', '#f5a89a', '#c0392b')}>Rapid Fire</button>
                ) : (
                  <button disabled style={disabledBtn('#242424', '#d4cfc9', '#3a3a3a')}>Rapid Fire</button>
                )}
                <button onClick={() => handleReadyWeapon(activeEntry.id)}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Ready Weapon</button>
                <button onClick={() => consumeAction(activeEntry.id, `${activeEntry.character_name} — Reload`)}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Reload</button>
                <button onClick={has2Actions ? () => consumeAction(activeEntry.id, `${activeEntry.character_name} — Sprint`, 2) : undefined} disabled={!has2Actions}
                  style={has2Actions ? actBtn('#242424', '#d4cfc9', '#3a3a3a') : disabledBtn('#242424', '#d4cfc9', '#3a3a3a')}>Sprint</button>
                <button onClick={() => consumeAction(activeEntry.id, `${activeEntry.character_name} — Subdue`)}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Subdue</button>
                <button onClick={() => consumeAction(activeEntry.id, `${activeEntry.character_name} — Take Cover`)}
                  style={actBtn('#242424', '#d4cfc9', '#3a3a3a')}>Take Cover</button>
                {/* Stabilize — PC or NPC with mortal wounds (WP=0, not yet dead) */}
                {(() => {
                  const woundedPC = entries.find(e => e.liveState && e.liveState.wp_current === 0 && ((e.liveState as any).death_countdown == null || (e.liveState as any).death_countdown > 0))
                  const woundedNPC = campaignNpcs.find((n: any) => {
                    const wp = n.wp_current ?? n.wp_max ?? 10
                    return wp === 0 && (n.death_countdown == null || n.death_countdown > 0)
                  })
                  if (!woundedPC && !woundedNPC) return null
                  const targetName = woundedPC ? woundedPC.character.name : woundedNPC!.name
                  return (
                    <button onClick={() => {
                      // Determine roller's Medicine stats — use active combatant's stats
                      // (could be PC via charEntry, or NPC via campaignNpcs)
                      let amod = 0, smod = 0
                      if (charEntry) {
                        const rapid = charEntry.character.data?.rapid ?? {}
                        amod = rapid.RSN ?? 0
                        smod = charEntry.character.data?.skills?.find((s: any) => s.skillName === 'Medicine')?.level ?? 0
                      } else {
                        const npcRoller = campaignNpcs.find((n: any) => n.name === activeEntry.character_name)
                        if (npcRoller) {
                          amod = npcRoller.reason ?? 0
                          const npcSkills: any[] = Array.isArray(npcRoller.skills?.entries) ? npcRoller.skills.entries : []
                          smod = npcSkills.find((s: any) => s.name === 'Medicine')?.level ?? 0
                        }
                      }
                      // Open roll FIRST (before consumeAction changes the active combatant)
                      handleRollRequest(`${activeEntry.character_name} — Stabilize ${targetName}`, amod, smod)
                      actionPreConsumedRef.current = true
                      consumeAction(activeEntry.id)
                    }}
                      style={actBtn('#1a2e10', '#7fc458', '#2d5a1b')}>🩸 Stabilize {targetName}</button>
                  )
                })()}
              </div>
            )
          })()}
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
                {tab === 'rolls' ? 'Logs' : tab === 'chat' ? 'Chat' : 'Both'}
              </button>
            ))}
          </div>
          <div ref={rollFeedRef} style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {sessionStatus === 'idle' && (
              isGM ? (
                <button onClick={startSession} disabled={sessionActing}
                  style={{ width: '100%', textAlign: 'center', padding: '8px', marginBottom: '8px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.6 : 1 }}>
                  {sessionActing ? 'Starting...' : 'Start Session'}
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '8px', marginBottom: '8px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
                  Waiting for GM to open the session
                </div>
              )
            )}
            {/* Roll entries (Logs tab only) */}
            {feedTab === 'rolls' && (
              rolls.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{sessionStatus === 'idle' ? '⏸' : '🎲'}</div>
                  <div style={{ fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {sessionStatus === 'idle' ? 'Session not active' : 'Click a skill or attribute on your sheet to roll'}
                  </div>
                </div>
              ) : (
                rolls.map(r => r.outcome === 'combat_start' && (r.damage_json as any)?.combatants ? (
                  <div key={r.id} style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1010', border: '1px solid #c0392b', borderRadius: '3px', borderLeft: '3px solid #c0392b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Combat Started</span>
                      <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.5 }}>
                      Between {((r.damage_json as any).combatants as string[]).map((n, i, arr) => (
                        <span key={i}>
                          <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{n}</span>
                          {i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' and ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (r.outcome === 'death' || r.character_name === 'Death is in the air') ? (
                  <div key={r.id} style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a0a0a', border: '1px solid #5a1b1b', borderRadius: '3px', borderLeft: '3px solid #c0392b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.character_name}</span>
                      <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.label}</div>
                  </div>
                ) : r.outcome === 'combat_end' && (r.damage_json as any)?.combatants ? (
                  <div key={r.id} style={{ marginBottom: '8px', padding: '8px 10px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', borderLeft: '3px solid #7ab3d4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Combat Ended</span>
                      <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
                    </div>
                    {((r.damage_json as any).combatants as string[]).length > 0 && (
                      <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.5 }}>
                        Between {((r.damage_json as any).combatants as string[]).map((n, i, arr) => (
                          <span key={i}>
                            <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{n}</span>
                            {i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' and ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : r.outcome === 'initiative' && (r.damage_json as any)?.initiative ? (
                  <div key={r.id} style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #EF9F27', borderRadius: '3px', borderLeft: '3px solid #EF9F27' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Initiative</span>
                      <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
                    </div>
                    {((r.damage_json as any).initiative as any[]).map((e: any, i: number) => {
                      const init = (e.acu ?? 0) + (e.dex ?? 0)
                      const nameColor = e.is_npc === false ? '#7ab3d4' : '#f5f2ee'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', padding: '3px 0', borderBottom: i < (r.damage_json as any).initiative.length - 1 ? '1px solid #2e2e2e' : 'none' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: nameColor, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', minWidth: '80px' }}>{e.name}</span>
                          <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                            [{e.d1}+{e.d2}]
                            {init !== 0 && <span style={{ color: '#7fc458' }}> {init > 0 ? '+' : ''}{init} Init</span>}
                            {e.drop !== 0 && <span style={{ color: '#f5a89a' }}> {e.drop} Drop</span>}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif' }}>{e.total}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div key={r.id} style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: `3px solid ${outcomeColor(r.outcome)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.character_name}</span>
                      <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '4px' }}>
                      {/* Strip character name prefix from label to avoid redundancy with the header */}
                      {r.label.startsWith(r.character_name + ' — ') ? r.label.slice(r.character_name.length + 3) : r.label}
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
                    {r.damage_json && (
                      <div style={{ marginTop: '6px', padding: '6px 8px', background: '#1a1010', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', color: '#d4cfc9' }}>
                        <span style={{ color: '#f5a89a', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: '11px' }}>Damage → {r.damage_json.targetName}</span>
                        <div style={{ marginTop: '2px' }}>
                          {r.damage_json.base > 0 && <span>{r.damage_json.base}</span>}
                          {r.damage_json.diceDesc && <span>{r.damage_json.base > 0 ? '+' : ''}{r.damage_json.diceDesc} ({r.damage_json.diceRoll})</span>}
                          {r.damage_json.phyBonus > 0 && <span> +{r.damage_json.phyBonus} PHY</span>}
                          <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.damage_json.totalWP} raw</span>
                          <span style={{ color: '#c0392b' }}> → {r.damage_json.finalWP} WP</span>
                          <span style={{ color: '#7ab3d4' }}> / {r.damage_json.finalRP} RP</span>
                          {r.damage_json.mitigated > 0 && <span style={{ color: '#cce0f5' }}> ({r.damage_json.mitigated} mitigated)</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )
            )}
            {/* Chat messages (Chat tab only) */}
            {feedTab === 'chat' && (
              chatMessages.length === 0 ? (
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
            {/* Both tab — merged chronological feed */}
            {feedTab === 'both' && (() => {
              const merged: { type: 'roll' | 'chat'; created_at: string; data: any }[] = [
                ...rolls.map(r => ({ type: 'roll' as const, created_at: r.created_at, data: r })),
                ...chatMessages.map(m => ({ type: 'chat' as const, created_at: m.created_at, data: m })),
              ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              if (merged.length === 0) return (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>{sessionStatus === 'idle' ? '⏸' : '💬'}</div>
                  <div style={{ fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {sessionStatus === 'idle' ? 'Session not active' : 'No activity yet'}
                  </div>
                </div>
              )
              return merged.map(item => item.type === 'chat' ? (
                <div key={`chat-${item.data.id}`} style={{ marginBottom: '6px', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: '3px solid #7ab3d4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{item.data.character_name}</span>
                    <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(item.data.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#f5f2ee', lineHeight: 1.4 }}>{item.data.message}</div>
                </div>
              ) : item.data.outcome === 'combat_start' && (item.data.damage_json as any)?.combatants ? (
                <div key={`roll-${item.data.id}`} style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1010', border: '1px solid #c0392b', borderRadius: '3px', borderLeft: '3px solid #c0392b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Combat Started</span>
                    <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(item.data.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.5 }}>
                    Between {((item.data.damage_json as any).combatants as string[]).map((n, i, arr) => (
                      <span key={i}>
                        <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{n}</span>
                        {i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' and ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : item.data.outcome === 'combat_end' && (item.data.damage_json as any)?.combatants ? (
                <div key={`roll-${item.data.id}`} style={{ marginBottom: '8px', padding: '8px 10px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', borderLeft: '3px solid #7ab3d4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Combat Ended</span>
                    <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(item.data.created_at)}</span>
                  </div>
                  {((item.data.damage_json as any).combatants as string[]).length > 0 && (
                    <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.5 }}>
                      Between {((item.data.damage_json as any).combatants as string[]).map((n, i, arr) => (
                        <span key={i}>
                          <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{n}</span>
                          {i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' and ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : item.data.outcome === 'initiative' && (item.data.damage_json as any)?.initiative ? (
                <div key={`roll-${item.data.id}`} style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #EF9F27', borderRadius: '3px', borderLeft: '3px solid #EF9F27' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Initiative</span>
                    <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(item.data.created_at)}</span>
                  </div>
                  {((item.data.damage_json as any).initiative as any[]).map((e: any, i: number) => {
                    const init = (e.acu ?? 0) + (e.dex ?? 0)
                    const nameColor = e.is_npc === false ? '#7ab3d4' : '#f5f2ee'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', padding: '3px 0', borderBottom: i < (item.data.damage_json as any).initiative.length - 1 ? '1px solid #2e2e2e' : 'none' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: nameColor, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', minWidth: '80px' }}>{e.name}</span>
                        <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                          [{e.d1}+{e.d2}]
                          {init !== 0 && <span style={{ color: '#7fc458' }}> {init > 0 ? '+' : ''}{init} Init</span>}
                          {e.drop !== 0 && <span style={{ color: '#f5a89a' }}> {e.drop} Drop</span>}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif' }}>{e.total}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div key={`roll-${item.data.id}`} style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: `3px solid ${outcomeColor(item.data.outcome)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{item.data.character_name}</span>
                    <span style={{ fontSize: '12px', color: '#cce0f5' }}>{formatTime(item.data.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '4px' }}>
                    {item.data.label}
                    {item.data.target_name && <span style={{ color: '#EF9F27' }}> → {item.data.target_name}</span>}
                  </div>
                  <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>
                    [{item.data.die1}+{item.data.die2}]
                    {item.data.amod !== 0 && <span style={{ color: item.data.amod > 0 ? '#7fc458' : '#c0392b' }}> {item.data.amod > 0 ? '+' : ''}{item.data.amod} AMod</span>}
                    {item.data.smod !== 0 && <span style={{ color: item.data.smod > 0 ? '#7fc458' : '#c0392b' }}> {item.data.smod > 0 ? '+' : ''}{item.data.smod} SMod</span>}
                    {item.data.cmod !== 0 && <span style={{ color: item.data.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {item.data.cmod > 0 ? '+' : ''}{item.data.cmod} CMod</span>}
                    <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {item.data.total}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: outcomeColor(item.data.outcome), fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{item.data.outcome}</span>
                    {item.data.insight_awarded && <span style={{ fontSize: '12px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>+1 Insight Die</span>}
                  </div>
                  {item.data.damage_json && (
                    <div style={{ marginTop: '6px', padding: '6px 8px', background: '#1a1010', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', color: '#d4cfc9' }}>
                      <span style={{ color: '#f5a89a', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: '11px' }}>Damage → {item.data.damage_json.targetName}</span>
                      <div style={{ marginTop: '2px' }}>
                        {item.data.damage_json.base > 0 && <span>{item.data.damage_json.base}</span>}
                        {item.data.damage_json.diceDesc && <span>{item.data.damage_json.base > 0 ? '+' : ''}{item.data.damage_json.diceDesc} ({item.data.damage_json.diceRoll})</span>}
                        {item.data.damage_json.phyBonus > 0 && <span> +{item.data.damage_json.phyBonus} PHY</span>}
                        <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {item.data.damage_json.totalWP} raw</span>
                        <span style={{ color: '#c0392b' }}> → {item.data.damage_json.finalWP} WP</span>
                        <span style={{ color: '#7ab3d4' }}> / {item.data.damage_json.finalRP} RP</span>
                        {item.data.damage_json.mitigated > 0 && <span style={{ color: '#cce0f5' }}> ({item.data.damage_json.mitigated} mitigated)</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))
            })()}
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
                  onClick={() => { if (selectedEntry?.character.id === myEntry.character.id) { setSelectedEntry(null) } else { setSelectedEntry(myEntry); setViewingNpcs([]); setSheetPos(null) } }}
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
          <CampaignMap campaignId={id} isGM={isGM} setting={campaign?.setting} mapStyle={(campaign as any)?.map_style} mapCenterLat={(campaign as any)?.map_center_lat} mapCenterLng={(campaign as any)?.map_center_lng} revealedNpcIds={revealedNpcIds} focusPin={focusPin} />

          {/* NPC Card(s) grid — floats over map */}
          {viewingNpcs.length > 0 && (
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '8px', background: 'rgba(26,26,26,0.95)', zIndex: 1100, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', alignContent: 'start' }}>
              {(() => {
                // During combat, sort cards in initiative order (active combatant first)
                if (!combatActive) return viewingNpcs
                const activeIdx = initiativeOrder.findIndex(e => e.is_active)
                const rotated = activeIdx >= 0
                  ? [...initiativeOrder.slice(activeIdx), ...initiativeOrder.slice(0, activeIdx)]
                  : initiativeOrder
                const npcOrder = rotated.filter(e => e.npc_id).map(e => e.npc_id!)
                const idIdx = new Map(npcOrder.map((id, i) => [id, i]))
                const isDead = (n: CampaignNpc) => {
                  const wp = n.wp_current ?? n.wp_max ?? 10
                  return n.status === 'dead' || wp === 0
                }
                return [...viewingNpcs].sort((a, b) => {
                  const ad = isDead(a) ? 1 : 0
                  const bd = isDead(b) ? 1 : 0
                  if (ad !== bd) return ad - bd
                  const ai = idIdx.has(a.id) ? idIdx.get(a.id)! : Infinity
                  const bi = idIdx.has(b.id) ? idIdx.get(b.id)! : Infinity
                  return ai - bi
                })
              })().map(npc => {
                // Always use latest data from campaignNpcs (optimistically patched on damage)
                // so NPC cards reflect HP changes instantly even if viewingNpcs is stale.
                const fresh = campaignNpcs.find((c: any) => c.id === npc.id)
                const liveNpc = fresh ? { ...fresh } as CampaignNpc : npc
                return (
                <NpcCard key={`${npc.id}-${liveNpc.wp_current}-${liveNpc.rp_current}-${liveNpc.death_countdown}`}
                  npc={liveNpc}
                  onClose={() => setViewingNpcs(prev => prev.filter(n => n.id !== npc.id))}
                  onEdit={() => { setViewingNpcs(prev => prev.filter(n => n.id !== npc.id)); setGmTab('npcs'); setPendingEditNpcId(npc.id) }}
                  onRoll={sessionStatus === 'active' ? (label, amod, smod, weapon) => { handleRollRequest(label, amod, smod, weapon) } : undefined}
                  onPublish={isGM ? () => handlePublishNpc(npc) : undefined}
                  isPublished={publishedNpcIds.has(npc.id)}
                />
              )})}
            </div>
          )}

          {/* Inline character sheet — full screen over map */}
          {syncedSelectedEntry && sheetMode === 'inline' && (
            <div style={{
              position: 'absolute', inset: 0,
              overflowY: 'auto',
              padding: '1rem',
              background: 'rgba(26,26,26,1)',
              zIndex: 1100,
            }}>
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
        </div>

        {/* Right — Asset panel. GM gets NPCs/Assets/GM Notes; players get
            NPCs (revealed only) and Assets (read-only). */}
        <div style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
            {(['npcs', 'assets', 'notes'] as const).map(tab => (
              <button key={tab} onClick={() => setGmTab(tab)}
                style={{ flex: 1, padding: '8px 0', background: gmTab === tab ? '#1a1a1a' : 'transparent', border: 'none', borderBottom: gmTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: gmTab === tab ? '#f5f2ee' : '#cce0f5', fontSize: '12px', fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {tab === 'npcs' ? 'NPCs' : tab === 'assets' ? 'Assets' : isGM ? 'GM Notes' : 'Notes'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {gmTab === 'npcs' && isGM && (() => {
              // Rotate initiative order so the currently-active combatant is first.
              const activeIdx = initiativeOrder.findIndex(e => e.is_active)
              const rotated = activeIdx >= 0
                ? [...initiativeOrder.slice(activeIdx), ...initiativeOrder.slice(0, activeIdx)]
                : initiativeOrder
              const initiativeNpcOrder = rotated.filter(e => e.npc_id).map(e => e.npc_id!)
              return <NpcRoster campaignId={id} isGM={isGM} combatActive={combatActive} initiativeNpcIds={new Set(initiativeOrder.filter(e => e.npc_id).map(e => e.npc_id!))} initiativeNpcOrder={initiativeNpcOrder} onAddToCombat={addNpcsToCombat} pcEntries={entries.map(e => ({ characterId: e.character.id, characterName: e.character.name, userId: e.userId }))} onViewNpc={npc => { setViewingNpcs(prev => prev.some(n => n.id === npc.id) ? prev.filter(n => n.id !== npc.id) : [...prev, npc]); setSelectedEntry(null) }} viewingNpcIds={new Set(viewingNpcs.map(n => n.id))} editNpcId={pendingEditNpcId} onEditStarted={() => setPendingEditNpcId(null)} externalNpcs={campaignNpcs} />
            })()}
            {gmTab === 'npcs' && !isGM && (() => {
              // Merge revealed NPCs with any NPCs currently in combat,
              // sorted in initiative order (active combatant first) — mirrors GM view.
              const revealedIds = new Set(revealedNpcs.map((n: any) => n.id))
              const activeIdx = initiativeOrder.findIndex(e => e.is_active)
              const rotated = activeIdx >= 0
                ? [...initiativeOrder.slice(activeIdx), ...initiativeOrder.slice(0, activeIdx)]
                : initiativeOrder
              const combatNpcOrder = rotated.filter(e => e.npc_id).map(e => e.npc_id!)
              const combatIdSet = new Set(combatNpcOrder)
              // Build combat NPCs in initiative order
              const combatNpcsInOrder = combatActive
                ? combatNpcOrder.map(npcId => {
                    const revealed = revealedNpcs.find((n: any) => n.id === npcId)
                    if (revealed) return revealed
                    const base = campaignNpcs.find((n: any) => n.id === npcId)
                    return base ? { ...base, _combatOnly: true } : null
                  }).filter(Boolean)
                : []
              const playerNpcs = [
                // Combat NPCs first, in initiative turn order
                ...combatNpcsInOrder,
                // Then non-combat revealed NPCs
                ...revealedNpcs.filter((n: any) => !combatIdSet.has(n.id)),
              ]
              return (
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {playerNpcs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    No NPCs revealed yet
                  </div>
                ) : (
                  playerNpcs.map((npc: any) => {
                    const isOpen = viewingNpcs.some(n => n.id === npc.id)
                    const inCombat = combatIdSet.has(npc.id)
                    // Derive status from fresh campaignNpcs data
                    const freshNpc = campaignNpcs.find((n: any) => n.id === npc.id)
                    const npcWP = freshNpc?.wp_current ?? npc.wp_current ?? npc.wp_max ?? 10
                    const npcIsDead = freshNpc?.status === 'dead' || (npcWP === 0 && freshNpc?.death_countdown != null && freshNpc.death_countdown <= 0)
                    const npcIsMortal = npcWP === 0 && !npcIsDead
                    return (
                      <div
                        key={npc.id}
                        onClick={() => {
                          setViewingNpcs(prev => prev.some(n => n.id === npc.id) ? prev.filter(n => n.id !== npc.id) : [...prev, npc])
                          setSelectedEntry(null)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: isOpen ? '#2a1210' : npcIsDead ? '#0f0f0f' : '#1a1a1a', border: `1px solid ${isOpen ? '#c0392b' : npcIsDead ? '#3a3a3a' : inCombat ? '#5a1b1b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer', transition: 'background 0.15s', opacity: npcIsDead ? 0.5 : 1 }}
                      >
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {npc.portrait_url ? (
                            <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</div>
                          {npcIsDead && (
                            <div style={{ fontSize: '11px', color: '#3a3a3a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>💀 Dead</div>
                          )}
                          {npcIsMortal && (
                            <div style={{ fontSize: '11px', color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>🩸 Mortally Wounded</div>
                          )}
                          {inCombat && !npcIsDead && !npcIsMortal && (
                            <div style={{ fontSize: '11px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>In Combat</div>
                          )}
                          {!npc._combatOnly && npc.reveal_level === 'name_portrait_role' && npc.recruitment_role && (
                            <div style={{ fontSize: '11px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.recruitment_role}</div>
                          )}
                          {!npc._combatOnly && npc.relationship_cmod !== 0 && npc.relationship_cmod != null && (
                            <div style={{ fontSize: '11px', color: npc.relationship_cmod > 0 ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                              {npc.relationship_cmod > 0 ? `+${npc.relationship_cmod}` : npc.relationship_cmod} CMod
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              )
            })()}
            {gmTab === 'assets' && <CampaignPins campaignId={id} isGM={isGM} onPinFocus={p => setFocusPin({ ...p })} />}
            {gmTab === 'notes' && isGM && <GmNotes campaignId={id} />}
            {gmTab === 'notes' && !isGM && <PlayerNotes campaignId={id} />}
          </div>
        </div>

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
            {gmEntry && getCharPhoto(gmEntry) ? <img src={getCharPhoto(gmEntry)!} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '10px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>GM</span>}
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
                  {photo ? <img src={photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: isCompact ? '9px' : '11px', fontWeight: 700, color: isActive ? '#c0392b' : '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(entry.character.name)}</span>}
                </div>
                <div style={{ fontSize: nameSize, color: isActive ? '#f5a89a' : '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.character.name} <span style={{ color: '#cce0f5', fontWeight: 400 }}>({entry.username})</span>
                </div>
              </button>
            )
          })
        })()}
      </div>

      {/* Character sheet overlay — draggable floating window */}
      {syncedSelectedEntry && sheetMode === 'overlay' && (
        <div onClick={() => { setSelectedEntry(null); setSheetPos(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9999 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute',
            left: sheetPos?.x ?? '50%',
            top: sheetPos?.y ?? '50%',
            transform: sheetPos ? 'none' : 'translate(-50%, -50%)',
            maxWidth: '780px', width: '95%', maxHeight: '90vh', overflow: 'auto', borderRadius: '4px',
            border: '1px solid #3a3a3a',
          }}>
            {/* Drag handle */}
            <div
              onMouseDown={e => {
                const el = e.currentTarget.parentElement as HTMLElement
                const rect = el.getBoundingClientRect()
                sheetDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: rect.left,
                  origY: rect.top,
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', cursor: 'grab', borderRadius: '4px 4px 0 0', background: '#242424', border: '1px solid #3a3a3a', borderBottom: 'none', userSelect: 'none' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#5a5a5a' }} />
            </div>
            <CharacterCard
              character={syncedSelectedEntry.character}
              liveState={syncedSelectedEntry.liveState}
              canEdit={isGM || syncedSelectedEntry.userId === userId}
              showButtons={true}
              isMySheet={syncedSelectedEntry.userId === userId}
              onStatUpdate={handleStatUpdate}
              onRoll={sessionStatus === 'active' && (syncedSelectedEntry.userId === userId || isGM) ? (label, amod, smod, weapon) => { setSelectedEntry(null); handleRollRequest(label, amod, smod, weapon) } : undefined}
            />
            <button onClick={() => { setSelectedEntry(null); setSheetPos(null) }} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderTop: 'none', borderRadius: '0 0 4px 4px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
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
                    <div>
                      <span style={{ color: '#cce0f5' }}>WP Damage:</span> <span style={{ color: '#c0392b', fontWeight: 700 }}>{pendingRoll.weapon.damage}</span>
                      &nbsp;&nbsp;<span style={{ color: '#cce0f5' }}>RP:</span> <span style={{ color: '#7ab3d4' }}>{pendingRoll.weapon.rpPercent}%</span>
                    </div>
                    {((pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) !== 0 || pendingRoll.weapon.traitLabel) && (
                      <div style={{ marginTop: '4px' }}>
                        {(pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) !== 0 && (
                          <span><span style={{ color: '#cce0f5' }}>Condition:</span> <span style={{ color: (pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) > 0 ? '#7fc458' : '#EF9F27' }}>{(pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) > 0 ? '+' : ''}{pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)} CMod</span></span>
                        )}
                        {pendingRoll.weapon.traitLabel && (
                          <span>{(pendingRoll.weapon.conditionCmod - (pendingRoll.weapon.traitCmod ?? 0)) !== 0 && <>&nbsp;&nbsp;</>}<span style={{ color: '#EF9F27' }}>{pendingRoll.weapon.traitLabel.replace(/-(\d+)/, '(-$1 CMod)')}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {pendingRoll.weapon?.traits && getTraitValue(pendingRoll.weapon.traits, 'Automatic Burst') !== null && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button onClick={() => setUseBurst(prev => !prev)}
                      style={{ width: '100%', padding: '6px', background: useBurst ? '#2d5a1b' : '#242424', border: `1px solid ${useBurst ? '#7fc458' : '#3a3a3a'}`, borderRadius: '3px', color: useBurst ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      {useBurst ? `✓ Automatic Burst (${getTraitValue(pendingRoll.weapon.traits, 'Automatic Burst') || 3} rounds)` : `Automatic Burst (${getTraitValue(pendingRoll.weapon.traits, 'Automatic Burst') || 3} rounds)`}
                    </button>
                  </div>
                )}
                {pendingRoll.weapon && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Range Band</div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {([['engaged', 'Engaged'], ['close', 'Close'], ['medium', 'Medium'], ['long', 'Long'], ['distant', 'Distant']] as const).map(([band, label]) => (
                        <button key={band} onClick={() => setRangeBand(band)}
                          style={{ flex: 1, padding: '4px 2px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${rangeBand === band ? '#c0392b' : '#3a3a3a'}`, background: rangeBand === band ? '#2a1210' : '#242424', color: rangeBand === band ? '#f5a89a' : '#d4cfc9' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {(() => {
                      const w = pendingRoll.weapon ? getWeaponByName(pendingRoll.weapon.weaponName) : null
                      const isMelee = w?.category === 'melee'
                      const isRanged = w?.category === 'ranged' || w?.category === 'explosive' || w?.category === 'heavy'
                      let note = ''
                      if (rangeBand === 'engaged') note = isMelee ? '+1 CMod (Melee)' : isRanged ? '-1 CMod (Ranged)' : ''
                      if (rangeBand === 'close') note = isMelee ? '-1 CMod (Melee at Close)' : isRanged ? '+1 CMod (Ranged)' : ''
                      if (rangeBand === 'medium') note = 'No modifiers'
                      if (rangeBand === 'long') note = 'Pistols: -5 CMod | Rifles: +1 CMod'
                      if (rangeBand === 'distant') note = 'Hunting/Sniper Rifle only'
                      return note ? <div style={{ fontSize: '11px', color: '#cce0f5', marginTop: '4px', fontFamily: 'Barlow, sans-serif' }}>{note}</div> : null
                    })()}
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
                      {[...initiativeOrder].sort((a, b) => (a.is_npc === b.is_npc ? 0 : a.is_npc ? -1 : 1))
                        .filter(entry => {
                          // Filter out dead NPCs (only if wp_current has been set and is 0)
                          if (entry.is_npc) {
                            const npc = rosterNpcs.find((n: any) => n.id === entry.npc_id)
                            if (npc && npc.wp_current != null && npc.wp_current <= 0) return false
                          }
                          // Filter out dead PCs
                          const pcEntry = entries.find(e => e.character.id === entry.character_id)
                          if (pcEntry?.liveState && pcEntry.liveState.wp_current === 0 && (pcEntry.liveState as any).death_countdown != null && (pcEntry.liveState as any).death_countdown <= 0) return false
                          return true
                        })
                        .map(entry => (
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
                      const { data: rel } = await supabase.from('npc_relationships').select('relationship_cmod').eq('npc_id', npcId).eq('character_id', myChar.character.id).maybeSingle()
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
                    {(rollResult.traitNotes ?? []).length > 0 && (
                      <div style={{ marginTop: '8px', padding: '6px 8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px' }}>
                        {(rollResult.traitNotes ?? []).map((note: string, i: number) => (
                          <div key={i} style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', marginBottom: i < (rollResult.traitNotes ?? []).length - 1 ? '4px' : 0 }}>{note}</div>
                        ))}
                      </div>
                    )}
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

      {/* Restore modal — NPCs and PCs */}
      {showRestorePicker && (() => {
        const deadNpcs = campaignNpcs.map(n => {
          const wp = n.wp_current ?? n.wp_max ?? 10
          const wpMax = n.wp_max ?? 10
          const rp = n.rp_current ?? n.rp_max ?? 6
          const rpMax = n.rp_max ?? 6
          const damaged = n.status === 'dead' || wp < wpMax || rp < rpMax
          return { key: `npc:${n.id}`, name: n.name, type: n.npc_type ?? 'NPC', isPC: false, id: n.id, damaged }
        })
        const deadPCs = entries.filter(e => e.liveState)
          .map(e => ({ key: `pc:${e.stateId}`, name: e.character.name, type: 'PC', isPC: true, id: e.stateId, damaged: e.liveState!.wp_current < e.liveState!.wp_max || e.liveState!.rp_current < e.liveState!.rp_max }))
        const allDead = [...deadPCs, ...deadNpcs]
        const allSelected = allDead.length > 0 && allDead.every(d => restoreNpcIds.has(d.key))
        return (
        <div onClick={() => setShowRestorePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '10px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Restore</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '0.5rem' }}>Restore to full health</div>
            {allDead.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{restoreNpcIds.size} of {allDead.length} selected</span>
                <button onClick={() => setRestoreNpcIds(allSelected ? new Set() : new Set(allDead.map(d => d.key)))}
                  style={{ padding: '2px 8px', background: allSelected ? '#2a1210' : '#1a2e10', border: `1px solid ${allSelected ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allSelected ? '#f5a89a' : '#7fc458', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {allDead.length === 0 ? (
                <div style={{ color: '#cce0f5', fontSize: '12px', textAlign: 'center', padding: '1rem' }}>No characters in this campaign.</div>
              ) : (
                allDead.map(d => (
                  <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: restoreNpcIds.has(d.key) ? '#1a2e10' : '#1a1a1a', border: `1px solid ${restoreNpcIds.has(d.key) ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={restoreNpcIds.has(d.key)} onChange={() => {
                      setRestoreNpcIds(prev => { const next = new Set(prev); if (next.has(d.key)) next.delete(d.key); else next.add(d.key); return next })
                    }} style={{ accentColor: '#7fc458' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{d.name}</div>
                      <span style={{ fontSize: '9px', color: d.isPC ? '#7ab3d4' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{d.type}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowRestorePicker(false)}
                style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={async () => {
                if (restoreNpcIds.size === 0) return
                const selected = Array.from(restoreNpcIds)
                // Restore NPCs
                for (const key of selected.filter(k => k.startsWith('npc:'))) {
                  const npcId = key.slice(4)
                  const npc = campaignNpcs.find((n: any) => n.id === npcId)
                  const wpMax = npc?.wp_max ?? (10 + (npc?.physicality ?? 0) + (npc?.dexterity ?? 0))
                  const rpMax = npc?.rp_max ?? (6 + (npc?.physicality ?? 0))
                  await supabase.from('campaign_npcs').update({ wp_current: wpMax, rp_current: rpMax, status: 'active', death_countdown: null, incap_rounds: null }).eq('id', npcId)
                }
                // Restore PCs
                for (const key of selected.filter(k => k.startsWith('pc:'))) {
                  const stateId = key.slice(3)
                  const entry = entries.find(e => e.stateId === stateId)
                  if (entry) {
                    await supabase.from('character_states').update({ wp_current: entry.liveState.wp_max, rp_current: entry.liveState.rp_max, death_countdown: null, incap_rounds: null, updated_at: new Date().toISOString() }).eq('id', stateId)
                  }
                }
                // Refresh all data
                const { data: freshNpcs } = await supabase.from('campaign_npcs').select('*').eq('campaign_id', id)
                if (freshNpcs) {
                  setCampaignNpcs(freshNpcs)
                  setRosterNpcs(freshNpcs.filter((n: any) => {
                    if (n.status !== 'active') return false
                    const wp = n.wp_current ?? n.wp_max ?? 10
                    return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
                  }))
                  setViewingNpcs(prev => prev.map(vn => {
                    const fresh = freshNpcs.find((f: any) => f.id === vn.id)
                    return fresh ? { ...fresh } as CampaignNpc : vn
                  }))
                }
                await loadEntries(id)
                initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
                setShowRestorePicker(false)
                setRestoreNpcIds(new Set())
              }}
                disabled={restoreNpcIds.size === 0}
                style={{ flex: 1, padding: '10px', background: restoreNpcIds.size > 0 ? '#1a2e10' : '#242424', border: `1px solid ${restoreNpcIds.size > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: restoreNpcIds.size > 0 ? '#7fc458' : '#3a3a3a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: restoreNpcIds.size > 0 ? 'pointer' : 'not-allowed' }}>
                Restore {restoreNpcIds.size > 0 ? `(${restoreNpcIds.size})` : ''}
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* End Session modal */}
      {showEndSessionModal && (
        <div onClick={() => setShowEndSessionModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>End Session</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1.25rem' }}>Session {sessionCount} Summary</div>

            {/* Player submissions — notes the players flagged "Add to Session Summary". */}
            {submittedPlayerNotes.length > 0 && (
              <div style={{ marginBottom: '1.25rem', padding: '10px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
                <div style={{ fontSize: '10px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Player Submissions ({submittedPlayerNotes.length})</div>
                {submittedPlayerNotes.map(n => (
                  <div key={n.id} style={{ marginBottom: '8px', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '2px' }}>{n.character_name}</div>
                    {n.title && <div style={{ fontSize: '12px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', marginBottom: '2px' }}>{n.title}</div>}
                    <div style={{ fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4, marginBottom: '6px' }}>{n.content}</div>
                    <button onClick={() => {
                      const titlePart = n.title ? ` — ${n.title}` : ''
                      const block = (sessionSummary.trim() ? '\n\n' : '') + `${n.character_name}${titlePart}: ${n.content}`
                      setSessionSummary(prev => prev + block)
                    }}
                      style={{ padding: '3px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Append to Summary
                    </button>
                  </div>
                ))}
              </div>
            )}

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
                <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Drop files here or click to browse
                </div>
                <div style={{ fontSize: '14px', color: '#cce0f5', marginTop: '4px' }}>Maps, handouts, references — images, PDFs, text, and Word docs</div>
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
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '0.5rem' }}>Select NPCs for this encounter</div>
            {(() => {
              // Exclude dead NPCs from the combat picker
              const aliveNpcs = rosterNpcs.filter(n => {
                const wp = n.wp_current ?? n.wp_max ?? 10
                const isDead = wp === 0 && n.death_countdown != null && n.death_countdown <= 0
                return !isDead
              })
              const allSelected = aliveNpcs.length > 0 && aliveNpcs.every(n => selectedNpcIds.has(n.id))
              return aliveNpcs.length > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{selectedNpcIds.size} of {aliveNpcs.length} selected</span>
                  <button onClick={() => setSelectedNpcIds(allSelected ? new Set() : new Set(aliveNpcs.map(n => n.id)))}
                    style={{ padding: '2px 8px', background: allSelected ? '#2a1210' : '#1a2e10', border: `1px solid ${allSelected ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allSelected ? '#f5a89a' : '#7fc458', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              ) : null
            })()}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {(() => {
                const aliveNpcs = rosterNpcs.filter(n => {
                  const wp = n.wp_current ?? n.wp_max ?? 10
                  const isDead = wp === 0 && n.death_countdown != null && n.death_countdown <= 0
                  return !isDead
                })
                return aliveNpcs.length === 0 ? (
                <div style={{ color: '#cce0f5', fontSize: '12px', textAlign: 'center', padding: '1rem' }}>No active NPCs in roster. You can add them during combat.</div>
              ) : (
                aliveNpcs.map(npc => (
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
                        <img src={npc.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
              )})()}
            </div>
            {/* Getting The Drop */}
            <div style={{ marginBottom: '1rem', padding: '8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              <div style={{ fontSize: '11px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Getting The Drop (optional)</div>
              <select value={dropCharacter} onChange={e => setDropCharacter(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none', cursor: 'pointer' }}>
                <option value="">No one gets the drop</option>
                <optgroup label="Players">
                  {entries.map(e => <option key={e.character.id} value={e.character.name}>{e.character.name}</option>)}
                </optgroup>
                {rosterNpcs.filter(n => selectedNpcIds.has(n.id)).length > 0 && (
                  <optgroup label="NPCs">
                    {rosterNpcs.filter(n => selectedNpcIds.has(n.id)).map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                  </optgroup>
                )}
              </select>
              {dropCharacter && <div style={{ fontSize: '11px', color: '#cce0f5', marginTop: '4px', fontFamily: 'Barlow, sans-serif' }}>{dropCharacter} acts first with 1 action, then takes -2 CMod on initiative roll.</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowNpcPicker(false); setDropCharacter('') }} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmStartCombat} disabled={startingCombat}
                style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: startingCombat ? 'not-allowed' : 'pointer', opacity: startingCombat ? 0.6 : 1 }}>
                {startingCombat ? 'Rolling...' : `⚔️ Start Combat${selectedNpcIds.size > 0 ? ` (${selectedNpcIds.size} NPCs)` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Special Check Modal */}
      {showSpecialCheck && (
        <div onClick={() => setShowSpecialCheck(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '380px' }}>
            {showSpecialCheck === 'perception' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Perception Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Uses Perception modifier (RSN + ACU)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {entries.map(e => (
                    <button key={e.character.id} onClick={() => triggerPerceptionCheck(e.character.name)}
                      style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>{e.character.name} (PER {(e.character.data?.rapid?.RSN ?? 0) + (e.character.data?.rapid?.ACU ?? 0)})</button>
                  ))}
                </div>
              </>
            )}
            {showSpecialCheck === 'gut' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Gut Instinct</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Uses Perception + best of Psychology, Streetwise, Tactics</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {entries.map(e => (
                    <button key={e.character.id} onClick={() => triggerGutInstinct(e.character.name)}
                      style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>{e.character.name}</button>
                  ))}
                </div>
              </>
            )}
            {showSpecialCheck === 'first_impression' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>First Impression</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Uses Influence + best of Manipulation, Streetwise, Psychology. Result sets Relationship CMod.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {entries.map(e => (
                    <button key={e.character.id} onClick={() => triggerFirstImpression(e.character.name)}
                      style={hdrBtn('#242424', '#d4cfc9', '#3a3a3a')}>{e.character.name} (INF {e.character.data?.rapid?.INF ?? 0})</button>
                  ))}
                </div>
              </>
            )}
            {showSpecialCheck === 'group' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Group Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Highest modifier leads. Others contribute their SMod. No Insight Dice.</div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Skill</div>
                  <select value={groupCheckSkill} onChange={e => setGroupCheckSkill(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                    <option value="">Select skill...</option>
                    {SKILLS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Participants</div>
                  {entries.map(e => (
                    <label key={e.character.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={groupCheckParticipants.has(e.character.id)} onChange={() => {
                        setGroupCheckParticipants(prev => { const next = new Set(prev); if (next.has(e.character.id)) next.delete(e.character.id); else next.add(e.character.id); return next })
                      }} style={{ accentColor: '#c0392b' }} />
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{e.character.name}</span>
                    </label>
                  ))}
                </div>
                <button onClick={triggerGroupCheck} disabled={groupCheckParticipants.size === 0 || !groupCheckSkill}
                  style={{ width: '100%', padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: groupCheckParticipants.size === 0 || !groupCheckSkill ? 0.5 : 1 }}>
                  Roll Group Check
                </button>
              </>
            )}
            {showSpecialCheck === 'opposed' && (
              <>
                <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Opposed Check</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', fontFamily: 'Barlow, sans-serif' }}>Both sides roll until one succeeds and the other fails. Use standard skill rolls for each side.</div>
                <div style={{ fontSize: '11px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', padding: '1rem' }}>
                  Have each participant roll their relevant skill check normally. Compare outcomes — first to get Success while opponent gets Failure wins.
                </div>
              </>
            )}
            <button onClick={() => setShowSpecialCheck(null)}
              style={{ marginTop: '1rem', width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Insight Die Save Modal */}
      {insightSavePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #c0392b', borderRadius: '4px', padding: '1.5rem', width: '340px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🩸</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#c0392b', marginBottom: '8px' }}>
              Mortal Injury
            </div>
            <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', marginBottom: '6px' }}>
              <strong>{insightSavePrompt.targetName}</strong> is mortally wounded!
            </div>
            {insightSavePrompt.insightDice > 0 ? (
              <>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginBottom: '1.5rem' }}>
                  Trade ALL Insight Dice to survive with 1 WP and 1 RP?
                  <br /><span style={{ fontSize: '13px', color: '#7fc458' }}>({insightSavePrompt.insightDice} Insight {insightSavePrompt.insightDice === 1 ? 'Die' : 'Dice'} will be lost)</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleInsightSave(true)}
                    style={{ flex: 1, padding: '10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Trade All Dice — Survive
                  </button>
                  <button onClick={() => handleInsightSave(false)}
                    style={{ flex: 1, padding: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Accept Fate
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '14px', color: '#f5a89a', fontFamily: 'Barlow, sans-serif', marginBottom: '1.5rem' }}>
                  No Insight Dice available to trade. {insightSavePrompt.targetName} will die if not stabilized.
                </div>
                <button onClick={() => { setInsightSavePrompt(null); initChannelRef.current?.send({ type: 'broadcast', event: 'pc_mortal_wound_resolved', payload: {} }) }}
                  style={{ width: '100%', padding: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Understood
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

const hdrBtn = (bg: string, color: string, border: string): React.CSSProperties => ({
  padding: '4px 14px', background: bg, border: `1px solid ${border}`, borderRadius: '3px',
  color, fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif',
  letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  height: '28px', minWidth: '70px', boxSizing: 'border-box',
  appearance: 'none', lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0, verticalAlign: 'middle',
})
