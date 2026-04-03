'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'

interface Campaign {
  id: string
  name: string
  setting: string
  gm_user_id: string
}

interface CharacterState {
  id: string
  campaign_id: string
  character_id: string
  user_id: string
  wp_current: number
  wp_max: number
  rp_current: number
  rp_max: number
  stress: number
  insight_dice: number
  morality: number
  updated_at: string
  characters?: { name: string; data: any }
  profiles?: { username: string }
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
  const [states, setStates] = useState<CharacterState[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/campaigns'); return }
      setCampaign(camp)
      setIsGM(camp.gm_user_id === user.id)

      // Load or create character states for all members
      const { data: members } = await supabase
        .from('campaign_members')
        .select('user_id, character_id, characters(id, name, data), profiles:user_id(username)')
        .eq('campaign_id', id)
        .not('character_id', 'is', null)

      if (members && members.length > 0) {
        for (const m of members as any[]) {
          if (!m.character_id) continue
          const { data: existing } = await supabase
            .from('character_states')
            .select('id')
            .eq('campaign_id', id)
            .eq('character_id', m.character_id)
            .single()

          if (!existing) {
            // Derive WP/RP from character data
            const rapid = m.characters?.data?.rapid ?? {}
            const php = rapid.PHY ?? 0
            const rsn = rapid.RSN ?? 0
            const wp = 10 + php
            const rp = 6 + rsn
            await supabase.from('character_states').insert({
              campaign_id: id,
              character_id: m.character_id,
              user_id: m.user_id,
              wp_current: wp, wp_max: wp,
              rp_current: rp, rp_max: rp,
              stress: 0, insight_dice: 2, morality: 3,
            })
          }
        }
      }

      await loadStates()
      setLoading(false)

      // Realtime subscription
      channelRef.current = supabase
        .channel(`table_${id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'character_states',
          filter: `campaign_id=eq.${id}`
        }, () => { loadStates() })
        .subscribe()
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [id])

  async function loadStates() {
    const { data } = await supabase
      .from('character_states')
      .select('*, characters(name, data), profiles:user_id(username)')
      .eq('campaign_id', id)
    setStates((data ?? []) as any)
  }

  async function updateStat(stateId: string, field: string, value: number) {
    setUpdating(stateId + field)
    await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
    setUpdating(null)
  }

  function Tracker({ label, current, max, stateId, currentField, maxField, color, canEdit }: {
    label: string, current: number, max: number, stateId: string,
    currentField: string, maxField?: string, color: string, canEdit: boolean
  }) {
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '9px', color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</span>
          <span style={{ fontSize: '11px', color, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{current}{max !== undefined ? ` / ${max}` : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
          {Array.from({ length: max }).map((_, i) => (
            <button
              key={i}
              disabled={!canEdit}
              onClick={() => canEdit && updateStat(stateId, currentField, i < current ? i : i + 1)}
              style={{
                width: '14px', height: '14px', borderRadius: '2px', padding: 0,
                border: `1px solid ${i < current ? color : '#3a3a3a'}`,
                background: i < current ? color : '#1a1a1a',
                cursor: canEdit ? 'pointer' : 'default',
                opacity: updating === stateId + currentField ? 0.5 : 1,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  function StatCounter({ label, value, stateId, field, min, max, color, canEdit }: {
    label: string, value: number, stateId: string, field: string,
    min: number, max: number, color: string, canEdit: boolean
  }) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '9px', color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
          <button
            disabled={!canEdit || value <= min}
            onClick={() => canEdit && value > min && updateStat(stateId, field, value - 1)}
            style={{ width: '20px', height: '20px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value > min ? 'pointer' : 'not-allowed', opacity: canEdit && value > min ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>
            -
          </button>
          <span style={{ fontSize: '18px', fontWeight: 700, color, fontFamily: 'Barlow Condensed, sans-serif', minWidth: '24px', textAlign: 'center' }}>{value}</span>
          <button
            disabled={!canEdit || value >= max}
            onClick={() => canEdit && value < max && updateStat(stateId, field, value + 1)}
            style={{ width: '20px', height: '20px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value < max ? 'pointer' : 'not-allowed', opacity: canEdit && value < max ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>
            +
          </button>
        </div>
      </div>
    )
  }

  if (loading || !campaign) return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>Loading table...</div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
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

      {states.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#b0aaa4', marginBottom: '8px' }}>No character sheets yet.</div>
          <div style={{ fontSize: '12px', color: '#5a5550' }}>Players need to assign a character to this campaign first.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
        {states.map(s => {
          const canEdit = isGM || s.user_id === userId
          const charName = (s.characters as any)?.name ?? 'Unknown'
          const username = (s.profiles as any)?.username ?? 'Unknown'
          const isMySheet = s.user_id === userId

          return (
            <div key={s.id} style={{
              background: '#1a1a1a',
              border: `1px solid ${isMySheet ? '#c0392b' : '#2e2e2e'}`,
              borderLeft: `3px solid ${isMySheet ? '#c0392b' : '#3a3a3a'}`,
              borderRadius: '4px', padding: '1rem',
            }}>
              {/* Character header */}
              <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #2e2e2e' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#f5f2ee' }}>
                  {charName}
                </div>
                <div style={{ fontSize: '10px', color: '#5a5550', marginTop: '1px' }}>
                  {username}{isMySheet ? ' (you)' : ''}
                  {isGM && s.user_id === campaign.gm_user_id ? ' — GM' : ''}
                </div>
              </div>

              {/* WP tracker */}
              <Tracker label="Wound Points" current={s.wp_current} max={s.wp_max}
                stateId={s.id} currentField="wp_current" color="#c0392b" canEdit={canEdit} />

              {/* RP tracker */}
              <Tracker label="Resilience Points" current={s.rp_current} max={s.rp_max}
                stateId={s.id} currentField="rp_current" color="#7ab3d4" canEdit={canEdit} />

              {/* Counters row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #2e2e2e' }}>
                <StatCounter label="Stress" value={s.stress} stateId={s.id} field="stress"
                  min={0} max={5} color="#EF9F27" canEdit={canEdit} />
                <StatCounter label="Insight" value={s.insight_dice} stateId={s.id} field="insight_dice"
                  min={0} max={9} color="#7fc458" canEdit={canEdit} />
                <StatCounter label="Morality" value={s.morality} stateId={s.id} field="morality"
                  min={0} max={5} color="#b0aaa4" canEdit={canEdit} />
              </div>

              {!canEdit && (
                <div style={{ fontSize: '10px', color: '#5a5550', marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>
                  View only
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
