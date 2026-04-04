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
    default: return '#b0aaa4'
  }
}

export default function TablePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const channelRef = useRef<any>(null)
  const rollChannelRef = useRef<any>(null)
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
  const [cmod, setCmod] = useState('0')
  const [rolling, setRolling] = useState(false)

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

    // Parallel: characters (no photo) + profiles
    const [{ data: chars }, { data: profiles }] = await Promise.all([
      supabase.from('characters').select('id, name, created_at, data').in('id', charIds),
      supabase.from('profiles').select('id, username').in('id', userIds),
    ])

    // Strip photo from bulk load — fetch separately below for portrait strip
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

    // Fetch photos separately and merge in — lightweight after main data is shown
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
      await Promise.all([loadEntries(id), loadRolls(id)])

      channelRef.current = supabase.channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'character_states', filter: `campaign_id=eq.${id}` }, () => loadEntries(id))
        .subscribe()

      rollChannelRef.current = supabase.channel(`rolls_${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roll_log', filter: `campaign_id=eq.${id}` }, () => loadRolls(id))
        .subscribe()
    }
    load()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (rollChannelRef.current) supabase.removeChannel(rollChannelRef.current)
    }
  }, [id])

  async function handleStatUpdate(stateId: string, field: string, value: number) {
    await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
    await loadEntries(id)
  }

  function handleRollRequest(label: string, amod: number, smod: number) {
    setPendingRoll({ label, amod, smod })
    setCmod('0')
  }

  async function executeRoll() {
    if (!pendingRoll || !userId) return
    setRolling(true)
    const die1 = Math.floor(Math.random() * 6) + 1
    const die2 = Math.floor(Math.random() * 6) + 1
    const cmodVal = parseInt(cmod) || 0
    const total = die1 + die2 + pendingRoll.amod + pendingRoll.smod + cmodVal
    const outcome = getOutcome(total, die1, die2)
    const insightAwarded = outcome === 'Low Insight' || outcome === 'High Insight'
    const myEntry = entries.find(e => e.userId === userId)
    const characterName = myEntry?.character.name ?? 'Unknown'

    await supabase.from('roll_log').insert({
      campaign_id: id, user_id: userId, character_name: characterName,
      label: pendingRoll.label, die1, die2,
      amod: pendingRoll.amod, smod: pendingRoll.smod, cmod: cmodVal,
      total, outcome, insight_awarded: insightAwarded,
    })

    if (insightAwarded && myEntry?.liveState) {
      const newInsight = Math.min(myEntry.liveState.insight_dice + 1, 9)
      await supabase.from('character_states').update({ insight_dice: newInsight, updated_at: new Date().toISOString() }).eq('id', myEntry.stateId)
    }

    setPendingRoll(null)
    setRolling(false)
    await loadEntries(id)
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
        <div style={{ flex: 1 }} />
        <a href={`/campaigns/${id}`} style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Back
        </a>
      </div>

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
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎲</div>
                <div style={{ fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Click a skill or attribute on your sheet to roll
                </div>
              </div>
            ) : (
              rolls.map(r => (
                <div key={r.id} style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: `3px solid ${outcomeColor(r.outcome)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.character_name}</span>
                    <span style={{ fontSize: '9px', color: '#5a5550' }}>{formatTime(r.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#b0aaa4', marginBottom: '4px' }}>{r.label}</div>
                  <div style={{ fontSize: '11px', color: '#b0aaa4', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>
                    [{r.die1}+{r.die2}]
                    {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
                    {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
                    {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
                    <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: outcomeColor(r.outcome), fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.outcome}</span>
                    {r.insight_awarded && <span style={{ fontSize: '9px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>+1 Insight Die</span>}
                  </div>
                </div>
              ))
            )}
          </div>
          {myEntry && (
            <div style={{ padding: '8px', borderTop: '1px solid #2e2e2e' }}>
              <button
                onClick={() => setSelectedEntry(myEntry)}
                style={{ width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Open My Sheet to Roll
              </button>
            </div>
          )}
        </div>

        {/* Center — Tactical Map */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>🗺</div>
          <div style={{ fontSize: '13px', color: '#3a3a3a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase' }}>Tactical Map — Coming Soon</div>
          {!entriesLoading && entries.length === 0 && (
            <div style={{ marginTop: '1rem', background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#b0aaa4', marginBottom: '4px' }}>No character sheets yet.</div>
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
          return (
            <button key={i} onClick={() => entry && setSelectedEntry(entry)}
              style={{ flex: 1, background: entry ? '#1a1a1a' : '#0d0d0d', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRight: i < PLAYER_SLOTS - 1 ? '1px solid #2e2e2e' : 'none', cursor: entry ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px', transition: 'background 0.15s' }}
              onMouseEnter={e => { if (entry) (e.currentTarget as HTMLElement).style.background = '#242424' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = entry ? '#1a1a1a' : '#0d0d0d' }}
            >
              {entry ? (
                <>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a3a5c', border: '2px solid #7ab3d4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '11px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(entry.character.name)}</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.character.name}</div>
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
        <div onClick={() => setSelectedEntry(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflow: 'auto', borderRadius: '4px' }}>
            <CharacterCard
              character={syncedSelectedEntry.character}
              liveState={syncedSelectedEntry.liveState}
              canEdit={isGM || syncedSelectedEntry.userId === userId}
              showButtons={true}
              isMySheet={syncedSelectedEntry.userId === userId}
              onStatUpdate={handleStatUpdate}
              onRoll={syncedSelectedEntry.userId === userId || isGM ? (label, amod, smod) => { setSelectedEntry(null); handleRollRequest(label, amod, smod) } : undefined}
            />
            <button onClick={() => setSelectedEntry(null)} style={{ marginTop: '8px', width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* CMod / Roll modal */}
      {pendingRoll && (
        <div onClick={() => setPendingRoll(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '320px' }}>
            <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Rolling</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>{pendingRoll.label}</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', fontSize: '12px', color: '#b0aaa4', fontFamily: 'Barlow Condensed, sans-serif' }}>
              <span>2d6</span>
              {pendingRoll.amod !== 0 && <span style={{ color: pendingRoll.amod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.amod > 0 ? '+' : ''}{pendingRoll.amod} AMod</span>}
              {pendingRoll.smod !== 0 && <span style={{ color: pendingRoll.smod > 0 ? '#7fc458' : '#c0392b' }}>{pendingRoll.smod > 0 ? '+' : ''}{pendingRoll.smod} SMod</span>}
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>CMod (Relationship / Situational)</div>
              <input
                type="number"
                value={cmod}
                onChange={e => setCmod(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') executeRoll() }}
                autoFocus
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setPendingRoll(null)} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={executeRoll} disabled={rolling} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer', opacity: rolling ? 0.6 : 1 }}>
                {rolling ? 'Rolling...' : '🎲 Roll'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
