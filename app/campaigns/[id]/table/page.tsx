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

const SETTINGS: Record<string, string> = {
  custom: 'New Setting',
  district0: 'District Zero',
  mongrels: 'Minnie & The Magnificent Mongrels',
  chased: 'Chased',
  empty: 'Empty',
  therock: 'The Rock',
}

// How many total portrait slots to show in the bottom strip (excluding GM)
const PLAYER_SLOTS = 5

export default function TablePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const channelRef = useRef<any>(null)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isGM, setIsGM] = useState(false)
  const [entries, setEntries] = useState<TableEntry[]>([])
  const [gmInfo, setGmInfo] = useState<GmInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<TableEntry | null>(null)

  async function loadEntries(campaignId: string) {
  // Get current character assignments from campaign_members
  const { data: members } = await supabase
    .from('campaign_members')
    .select('user_id, character_id')
    .eq('campaign_id', campaignId)
    .not('character_id', 'is', null)

  if (!members || members.length === 0) { setEntries([]); return }

  // Build a map of user_id → currently assigned character_id
  const currentAssignment: Record<string, string> = {}
  for (const m of members) {
    currentAssignment[m.user_id] = m.character_id
  }

  const { data: rawStates } = await supabase
    .from('character_states')
    .select('*')
    .eq('campaign_id', campaignId)

  if (!rawStates || rawStates.length === 0) { setEntries([]); return }

  // Only keep the state that matches the current assignment for each user
  const filteredStates = rawStates.filter(
    (s: any) => currentAssignment[s.user_id] === s.character_id
  )

  if (filteredStates.length === 0) { setEntries([]); return }

  const charIds = filteredStates.map((s: any) => s.character_id)
  const userIds = filteredStates.map((s: any) => s.user_id)

  const { data: chars } = await supabase.from('characters').select('id, name, created_at, data').in('id', charIds)
  const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds)

  const charMap = Object.fromEntries((chars ?? []).map((c: any) => [c.id, c]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))

  setEntries(filteredStates.map((s: any) => ({
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
  })))
}

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/campaigns'); return }
      setCampaign(camp)
      const gm = camp.gm_user_id === user.id
      setIsGM(gm)

      // Fetch GM username
      const { data: gmProfile } = await supabase.from('profiles').select('id, username').eq('id', camp.gm_user_id).single()
      setGmInfo({ userId: camp.gm_user_id, username: gmProfile?.username ?? 'GM' })

      const { data: members } = await supabase
        .from('campaign_members')
        .select('user_id, character_id, characters:character_id(id, name, data)')
        .eq('campaign_id', id)
        .not('character_id', 'is', null)

      if (members && members.length > 0) {
        for (const m of members as any[]) {
          if (!m.character_id) continue
          const { data: existing } = await supabase.from('character_states').select('id')
            .eq('campaign_id', id).eq('character_id', m.character_id).maybeSingle()
          if (!existing) {
            const rapid = m.characters?.data?.rapid ?? {}
            const wp = 10 + (rapid.PHY ?? 0)
            const rp = 6 + (rapid.RSN ?? 0)
            await supabase.from('character_states').insert({
              campaign_id: id, character_id: m.character_id, user_id: m.user_id,
              wp_current: wp, wp_max: wp, rp_current: rp, rp_max: rp,
              stress: 0, insight_dice: 2, morality: 3,
            })
          }
        }
      }

      await loadEntries(id)
      setLoading(false)

      channelRef.current = supabase
        .channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'character_states', filter: `campaign_id=eq.${id}` }, () => loadEntries(id))
        .subscribe()
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [id])

  async function handleStatUpdate(stateId: string, field: string, value: number) {
    await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
    await loadEntries(id)
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  function getCharPhoto(entry: TableEntry): string | null {
    return entry.character?.data?.photoDataUrl ?? null
  }

  if (loading || !campaign) return (
    <div style={{ height: 'calc(100vh - 74px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow, sans-serif', color: '#5a5550', background: '#0f0f0f' }}>
      Loading table...
    </div>
  )

  // Separate GM entry (if GM has a character) from player entries
  const gmEntry = entries.find(e => e.userId === campaign.gm_user_id) ?? null
  const playerEntries = entries.filter(e => e.userId !== campaign.gm_user_id)

  // Update selected entry when entries reload (keep in sync)
  const syncedSelectedEntry = selectedEntry
    ? entries.find(e => e.stateId === selectedEntry.stateId) ?? selectedEntry
    : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 74px)',
      overflow: 'hidden',
      fontFamily: 'Barlow, sans-serif',
      background: '#0f0f0f',
    }}>

      {/* ── Header ── */}
      <div style={{
        borderBottom: '1px solid #c0392b',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
        background: '#0f0f0f',
      }}>
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

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left panel — Dice / Chat feed */}
        <div style={{
          width: '260px',
          flexShrink: 0,
          borderRight: '1px solid #2e2e2e',
          display: 'flex',
          flexDirection: 'column',
          background: '#111',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #2e2e2e', fontSize: '10px', fontWeight: 600, color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Dice &amp; Chat
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: '#3a3a3a', padding: '1rem' }}>
            <div style={{ fontSize: '32px' }}>🎲</div>
            <div style={{ fontSize: '12px', color: '#3a3a3a', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Coming Soon</div>
          </div>
        </div>

        {/* Center — Tactical Map */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a1a',
          flexDirection: 'column',
          gap: '12px',
          color: '#2e2e2e',
          overflow: 'hidden',
        }}>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>🗺</div>
          <div style={{ fontSize: '13px', color: '#3a3a3a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase' }}>Tactical Map — Coming Soon</div>
          {entries.length === 0 && (
            <div style={{ marginTop: '1rem', background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#b0aaa4', marginBottom: '4px' }}>No character sheets yet.</div>
              <div style={{ fontSize: '11px', color: '#5a5550' }}>Players need to assign a character before entering the table.</div>
            </div>
          )}
        </div>

      </div>

      {/* ── Bottom portrait strip ── */}
      <div style={{
        borderTop: '1px solid #2e2e2e',
        display: 'flex',
        flexShrink: 0,
        background: '#0f0f0f',
        height: '80px',
      }}>

        {/* GM slot */}
        <button
          onClick={() => gmEntry && setSelectedEntry(gmEntry)}
          style={{
            width: '120px',
            flexShrink: 0,
            background: gmEntry ? '#1a1a1a' : '#111',
            borderTop: 'none', borderBottom: 'none', borderLeft: 'none',
            borderRight: '1px solid #2e2e2e',
            cursor: gmEntry ? 'pointer' : 'default',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (gmEntry) (e.currentTarget as HTMLElement).style.background = '#242424' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = gmEntry ? '#1a1a1a' : '#111' }}
        >
          {/* GM badge */}
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {gmEntry && getCharPhoto(gmEntry)
              ? <img src={getCharPhoto(gmEntry)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '10px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>GM</span>
            }
          </div>
          <div style={{ fontSize: '10px', color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>
            {gmInfo?.username ?? 'GM'}
          </div>
          {gmEntry && (
            <div style={{ fontSize: '9px', color: '#5a5550', fontFamily: 'Barlow, sans-serif', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {gmEntry.character.name}
            </div>
          )}
        </button>

        {/* Player slots */}
        {Array.from({ length: PLAYER_SLOTS }).map((_, i) => {
          const entry = playerEntries[i] ?? null
          const photo = entry ? getCharPhoto(entry) : null
          return (
            <button
              key={i}
              onClick={() => entry && setSelectedEntry(entry)}
              style={{
                flex: 1,
                background: entry ? '#1a1a1a' : '#0d0d0d',
                borderTop: 'none', borderBottom: 'none', borderLeft: 'none',
                borderRight: i < PLAYER_SLOTS - 1 ? '1px solid #2e2e2e' : 'none',
                cursor: entry ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '8px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (entry) (e.currentTarget as HTMLElement).style.background = '#242424' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = entry ? '#1a1a1a' : '#0d0d0d' }}
            >
              {entry ? (
                <>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a3a5c', border: '2px solid #7ab3d4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {photo
                      ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '11px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(entry.character.name)}</span>
                    }
                  </div>
                  <div style={{ fontSize: '10px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.username}
                  </div>
                  <div style={{ fontSize: '9px', color: '#5a5550', fontFamily: 'Barlow, sans-serif', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.character.name}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '9px', color: '#2e2e2e', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {`Player ${i + 1}`}
                </div>
              )}
            </button>
          )
        })}

      </div>

      {/* ── Character sheet modal ── */}
      {syncedSelectedEntry && (
        <div
          onClick={() => setSelectedEntry(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '420px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              borderRadius: '4px',
            }}
          >
            <CharacterCard
              character={syncedSelectedEntry.character}
              liveState={syncedSelectedEntry.liveState}
              canEdit={isGM || syncedSelectedEntry.userId === userId}
              showButtons={false}
              isMySheet={syncedSelectedEntry.userId === userId}
              onStatUpdate={handleStatUpdate}
            />
            <button
              onClick={() => setSelectedEntry(null)}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '10px',
                background: '#242424',
                border: '1px solid #3a3a3a',
                borderRadius: '3px',
                color: '#b0aaa4',
                fontSize: '12px',
                fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
