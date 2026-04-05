'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import CharacterCard, { LiveState } from '../../../../components/CharacterCard'

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

interface PendingRoll {
  label: string
  amod: number
  smod: number
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
}

interface InitiativeEntry {
  id: string
  character_name: string
  character_id: string | null
  user_id: string | null
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

const PLAYER_SLOTS = 5

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

export default function TablePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const channelRef = useRef<any>(null)
  const rollChannelRef = useRef<any>(null)
  const initChannelRef = useRef<any>(null)
  const rollFeedRef = useRef<HTMLDivElement>(null)

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

  // Session
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active'>('idle')
  const [sessionCount, setSessionCount] = useState(0)
  const [showEndSessionModal, setShowEndSessionModal] = useState(false)
  const [sessionSummary, setSessionSummary] = useState('')
  const [sessionActing, setSessionActing] = useState(false)
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
      await Promise.all([loadEntries(id), loadRolls(id), loadInitiative(id)])

      channelRef.current = supabase.channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'character_states', filter: `campaign_id=eq.${id}` }, () => loadEntries(id))
        .subscribe()

      rollChannelRef.current = supabase.channel(`rolls_${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roll_log', filter: `campaign_id=eq.${id}` }, () => loadRolls(id))
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
      if (rollChannelRef.current) supabase.removeChannel(rollChannelRef.current)
      if (initChannelRef.current) supabase.removeChannel(initChannelRef.current)
      if (campaignChannelRef.current) supabase.removeChannel(campaignChannelRef.current)
    }
  }, [id])

  async function handleStatUpdate(stateId: string, field: string, value: number) {
    supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
  }

  // ── Initiative functions ──

  async function startCombat() {
    if (!isGM) return
    setStartingCombat(true)

    // Clear any existing initiative
    await supabase.from('initiative_order').delete().eq('campaign_id', id)

    // Roll initiative for all PCs: 2d6 + ACU AMod + DEX AMod
    const toInsert = entries.map(e => {
      const rapid = e.character.data?.rapid ?? {}
      const acu = rapid.ACU ?? 0
      const dex = rapid.DEX ?? 0
      const roll = rollD6() + rollD6() + acu + dex
      return {
        campaign_id: id,
        character_name: e.character.name,
        character_id: e.character.id,
        user_id: e.userId,
        roll,
        is_active: false,
        is_npc: false,
      }
    })

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

  async function removeFromInitiative(entryId: string) {
    if (!isGM) return
    await supabase.from('initiative_order').delete().eq('id', entryId)
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
    await supabase.from('sessions').update({
      ended_at: now,
      gm_summary: sessionSummary.trim() || null,
    }).eq('campaign_id', id).eq('session_number', sessionCount).is('ended_at', null)
    setSessionStatus('idle')
    setShowEndSessionModal(false)
    setSessionSummary('')
    setSessionActing(false)
  }

  // ── Roll functions ──

  function handleRollRequest(label: string, amod: number, smod: number) {
    setPendingRoll({ label, amod, smod })
    setRollResult(null)
    setCmod('0')
    setTargetName('')
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

    return { total, outcome, insightAwarded }
  }

  async function executeRoll() {
    if (!pendingRoll || !userId) return
    setRolling(true)
    const die1 = rollD6()
    const die2 = rollD6()
    const cmodVal = parseInt(cmod) || 0
    const myEntry = entries.find(e => e.userId === userId)
    const characterName = myEntry?.character.name ?? 'Unknown'

    const { total, outcome, insightAwarded } = await saveRollToLog(die1, die2, pendingRoll.amod, pendingRoll.smod, cmodVal, pendingRoll.label, characterName, false, targetName || null)

    if (insightAwarded && myEntry?.liveState) {
      const newInsight = myEntry.liveState.insight_dice + 1
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
    }

    setRollResult({
      die1, die2, amod: pendingRoll.amod, smod: pendingRoll.smod, cmod: cmodVal,
      total, outcome, label: pendingRoll.label, insightAwarded, spent: false,
    })

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
    const characterName = myEntry.character.name ?? 'Unknown'

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
    <div style={{ height: 'calc(100vh - 74px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow, sans-serif', color: '#5a5550', background: '#0f0f0f' }}>
      Loading table...
    </div>
  )

  const gmEntry = entries.find(e => e.userId === campaign.gm_user_id) ?? null
  const playerEntries = entries.filter(e => e.userId !== campaign.gm_user_id)
  const syncedSelectedEntry = selectedEntry ? entries.find(e => e.stateId === selectedEntry.stateId) ?? selectedEntry : null
  const myEntry = entries.find(e => e.userId === userId) ?? null
  const myInsightDice = myEntry?.liveState?.insight_dice ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 74px)', overflow: 'hidden', fontFamily: 'Barlow, sans-serif', background: '#0f0f0f' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #c0392b', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, background: '#0f0f0f' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
            {SETTINGS[campaign.setting] ?? campaign.setting} &mdash; {isGM ? 'GM View' : 'Player View'}
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1 }}>
            {campaign.name}
          </div>
        </div>
        {sessionStatus === 'active' && (
          <div style={{ padding: '4px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458' }}>
            Session {sessionCount}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {isGM && sessionStatus === 'idle' && (
          <button onClick={startSession} disabled={sessionActing}
            style={{ padding: '6px 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.5 : 1 }}>
            {sessionActing ? 'Starting...' : 'Start Session'}
          </button>
        )}
        {isGM && sessionStatus === 'active' && (
          <button onClick={() => setShowEndSessionModal(true)}
            style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            End Session
          </button>
        )}
        {isGM && sessionStatus === 'active' && !combatActive && (
          <button onClick={startCombat} disabled={startingCombat || entries.length === 0}
            style={{ padding: '6px 14px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: startingCombat || entries.length === 0 ? 'not-allowed' : 'pointer', opacity: startingCombat || entries.length === 0 ? 0.5 : 1 }}>
            {startingCombat ? 'Rolling...' : '⚔️ Start Combat'}
          </button>
        )}
        {isGM && combatActive && (
          <button onClick={endCombat}
            style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            End Combat
          </button>
        )}
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
                <span style={{ fontSize: '11px', fontWeight: entry.is_active ? 700 : 400, color: entry.is_active ? '#f5f2ee' : '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {entry.character_name}
                </span>
                {entry.is_npc && (
                  <span style={{ fontSize: '8px', color: '#EF9F27', background: '#2a2010', border: '1px solid #EF9F27', padding: '0 4px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>NPC</span>
                )}
                <span style={{ fontSize: '11px', color: entry.is_active ? '#c0392b' : '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>{entry.roll}</span>
                {isGM && (
                  <button onClick={() => removeFromInitiative(entry.id)}
                    style={{ background: 'none', border: 'none', color: '#5a5550', cursor: 'pointer', fontSize: '12px', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
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

        {/* Left — Roll Feed */}
        <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #2e2e2e', fontSize: '10px', fontWeight: 600, color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Roll Feed
          </div>
          <div ref={rollFeedRef} style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {rolls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{sessionStatus === 'idle' ? '⏸' : '🎲'}</div>
                <div style={{ fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {sessionStatus === 'idle' ? 'Session not active' : 'Click a skill or attribute on your sheet to roll'}
                </div>
              </div>
            ) : (
              rolls.map(r => (
                <div key={r.id} style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: `3px solid ${outcomeColor(r.outcome)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.character_name}</span>
                    <span style={{ fontSize: '10px', color: '#5a5550' }}>{formatTime(r.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#d4cfc9', marginBottom: '4px' }}>
                    {r.label}
                    {r.target_name && <span style={{ color: '#EF9F27' }}> → {r.target_name}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>
                    [{r.die1}+{r.die2}]
                    {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
                    {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
                    {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
                    <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: outcomeColor(r.outcome), fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.outcome}</span>
                    {r.insight_awarded && <span style={{ fontSize: '10px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>+1 Insight Die</span>}
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ padding: '8px', borderTop: '1px solid #2e2e2e' }}>
            {sessionStatus === 'idle' ? (
              <div style={{ textAlign: 'center', padding: '6px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#5a5550' }}>
                Waiting for GM to open the session
              </div>
            ) : myEntry ? (
              <button
                onClick={() => setSelectedEntry(myEntry)}
                style={{ width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Open My Sheet to Roll
              </button>
            ) : null}
          </div>
        </div>

        {/* Center — Tactical Map */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>🗺</div>
          <div style={{ fontSize: '13px', color: '#3a3a3a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase' }}>Tactical Map — Coming Soon</div>
          {!entriesLoading && entries.length === 0 && (
            <div style={{ marginTop: '1rem', background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '4px' }}>No character sheets yet.</div>
              <div style={{ fontSize: '11px', color: '#5a5550' }}>Players need to assign a character before entering the table.</div>
            </div>
          )}
        </div>

      </div>

      {/* Bottom portrait strip */}
      <div style={{ borderTop: '1px solid #2e2e2e', display: 'flex', flexShrink: 0, background: '#0f0f0f', height: '80px' }}>
        <button
          onClick={() => gmEntry && setSelectedEntry(gmEntry)}
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
          <div style={{ fontSize: '9px', color: '#5a5550', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {gmEntry ? gmEntry.username : 'Game Master'}
          </div>
        </button>

        {Array.from({ length: PLAYER_SLOTS }).map((_, i) => {
          const entry = playerEntries[i] ?? null
          const photo = entry ? getCharPhoto(entry) : null
          const isActive = combatActive && initiativeOrder.some(o => o.is_active && o.character_id === entry?.character.id)
          return (
            <button key={i} onClick={() => (isGM || entry?.userId === userId) && entry && setSelectedEntry(entry)}
              style={{ flex: 1, background: isActive ? '#1a0f0f' : entry ? '#1a1a1a' : '#0d0d0d', borderTop: isActive ? '2px solid #c0392b' : 'none', borderBottom: 'none', borderLeft: 'none', borderRight: i < PLAYER_SLOTS - 1 ? '1px solid #2e2e2e' : 'none', cursor: entry && (isGM || entry.userId === userId) ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px', transition: 'background 0.15s' }}
              onMouseEnter={e => { if (entry) (e.currentTarget as HTMLElement).style.background = '#242424' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive ? '#1a0f0f' : entry ? '#1a1a1a' : '#0d0d0d' }}
            >
              {entry ? (
                <>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a3a5c', border: `2px solid ${isActive ? '#c0392b' : '#7ab3d4'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '11px', fontWeight: 700, color: isActive ? '#c0392b' : '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(entry.character.name)}</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: isActive ? '#f5a89a' : '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.character.name}</div>
                  <div style={{ fontSize: '9px', color: '#5a5550', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{entry.username}</div>
                </>
              ) : (
                <div style={{ fontSize: '9px', color: '#2e2e2e', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {entriesLoading ? '' : `Player ${i + 1}`}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Character sheet overlay */}
      {syncedSelectedEntry && (
        <div onClick={() => setSelectedEntry(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflow: 'auto', borderRadius: '4px' }}>
            <CharacterCard
              character={syncedSelectedEntry.character}
              liveState={syncedSelectedEntry.liveState}
              canEdit={isGM || syncedSelectedEntry.userId === userId}
              showButtons={true}
              isMySheet={syncedSelectedEntry.userId === userId}
              onStatUpdate={handleStatUpdate}
              onRoll={sessionStatus === 'active' && (syncedSelectedEntry.userId === userId || isGM) ? (label, amod, smod) => { setSelectedEntry(null); handleRollRequest(label, amod, smod) } : undefined}
            />
            <button onClick={() => setSelectedEntry(null)} style={{ marginTop: '8px', width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
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
                <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Rolling</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>{pendingRoll.label}</div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', fontSize: '12px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  <span>2d6</span>
                  {pendingRoll.amod !== 0 && <span style={{ color: pendingRoll.amod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.amod > 0 ? '+' : ''}{pendingRoll.amod} AMod</span>}
                  {pendingRoll.smod !== 0 && <span style={{ color: pendingRoll.smod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.smod > 0 ? '+' : ''}{pendingRoll.smod} SMod</span>}
                </div>
                {combatActive && initiativeOrder.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Target</div>
                    <select value={targetName} onChange={e => setTargetName(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                      <option value="" style={{ color: '#5a5550' }}>No target</option>
                      {initiativeOrder.map(entry => (
                        <option key={entry.id} value={entry.character_name} style={{ color: entry.is_npc ? '#7fc458' : '#c0392b' }}>
                          {entry.character_name}{entry.is_npc ? ' (NPC)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>CMod (Relationship / Situational)</div>
                  <input type="number" value={cmod} onChange={e => setCmod(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') executeRoll() }} autoFocus
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={closeRollModal} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={executeRoll} disabled={rolling} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.6 : 1 }}>
                    {rolling ? 'Rolling...' : '🎲 Roll'}
                  </button>
                </div>
              </>
            )}

            {rollResult && (
              <>
                <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>{rollResult.label}</div>
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
                    <div style={{ fontSize: '11px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '3px 8px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif', display: 'inline-block', marginTop: '6px' }}>+1 Insight Die</div>
                  )}
                </div>
                {!rollResult.spent && myInsightDice > 0 && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '10px', color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', textAlign: 'center' }}>
                      Spend Insight Dice ({myInsightDice} available)
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => spendInsightDie('die1')} disabled={rolling} style={{ flex: 1, padding: '8px 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Die 1</button>
                      <button onClick={() => spendInsightDie('die2')} disabled={rolling} style={{ flex: 1, padding: '8px 4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Die 2</button>
                      <button onClick={() => spendInsightDie('both')} disabled={rolling || myInsightDice < 2} style={{ flex: 1, padding: '8px 4px', background: myInsightDice >= 2 ? '#1a2e10' : '#1a1a1a', border: `1px solid ${myInsightDice >= 2 ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: myInsightDice >= 2 ? '#7fc458' : '#3a3a3a', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: rolling || myInsightDice < 2 ? 'not-allowed' : 'pointer', opacity: rolling ? 0.5 : 1 }}>Re-roll<br />Both (2)</button>
                    </div>
                  </div>
                )}
                {rollResult.spent && (
                  <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1rem', marginBottom: '1rem', textAlign: 'center', fontSize: '11px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>Insight Die spent</div>
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
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px' }}>
            <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>End Session</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>Session {sessionCount} Summary</div>
            <textarea
              value={sessionSummary}
              onChange={e => setSessionSummary(e.target.value)}
              placeholder="What happened this session? (optional)"
              autoFocus
              rows={5}
              style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
              <button onClick={() => setShowEndSessionModal(false)} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={endSession} disabled={sessionActing} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.6 : 1 }}>
                {sessionActing ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
