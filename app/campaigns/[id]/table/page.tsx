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

const SETTINGS: Record<string, string> = {
  custom: 'New Setting',
  district0: 'District Zero',
  mongrels: 'Minnie & The Magnificent Mongrels',
  chased: 'Chased',
  empty: 'Empty',
  therock: 'The Rock',
}

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
  const [loading, setLoading] = useState(true)

  async function loadEntries(campaignId: string) {
    const { data: rawStates } = await supabase.from('character_states').select('*').eq('campaign_id', campaignId)
    if (!rawStates || rawStates.length === 0) { setEntries([]); return }

    const charIds = rawStates.map((s: any) => s.character_id)
    const userIds = rawStates.map((s: any) => s.user_id)

    const { data: chars } = await supabase.from('characters').select('id, name, created_at, data').in('id', charIds)
    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds)

    const charMap = Object.fromEntries((chars ?? []).map((c: any) => [c.id, c]))
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))

    setEntries(rawStates.map((s: any) => ({
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

  if (loading || !campaign) return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>Loading table...</div>
  )

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
            {SETTINGS[campaign.setting] ?? campaign.setting} — {isGM ? 'GM View' : 'Player View'}
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '24px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            {campaign.name}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <a href={`/campaigns/${id}`} style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Back
        </a>
      </div>

      {entries.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#b0aaa4', marginBottom: '8px' }}>No character sheets yet.</div>
          <div style={{ fontSize: '12px', color: '#5a5550' }}>Players need to assign a character to this campaign first.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
        {entries.map(e => (
          <CharacterCard
            key={e.stateId}
            character={e.character}
            liveState={e.liveState}
            canEdit={isGM || e.userId === userId}
            showButtons={true}
            isMySheet={e.userId === userId}
            onStatUpdate={handleStatUpdate}
          />
        ))}
      </div>
    </div>
  )
}
