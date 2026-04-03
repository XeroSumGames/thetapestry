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
  charName?: string
  username?: string
  charData?: any
}

const SETTINGS: Record<string, string> = {
  custom: 'New Setting',
  district0: 'District Zero',
  mongrels: 'Minnie & The Magnificent Mongrels',
  chased: 'Chased',
  empty: 'Empty',
  therock: 'The Rock',
}

const ATTR_KEYS = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<string, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

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

  async function loadStates(campaignId: string) {
    const { data: rawStates } = await supabase
      .from('character_states')
      .select('*')
      .eq('campaign_id', campaignId)

    if (!rawStates || rawStates.length === 0) { setStates([]); return }

    const charIds = rawStates.map((s: any) => s.character_id)
    const userIds = rawStates.map((s: any) => s.user_id)

    const { data: chars } = await supabase.from('characters').select('id, name, data').in('id', charIds)
    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds)

    const charMap = Object.fromEntries((chars ?? []).map((c: any) => [c.id, { name: c.name, data: c.data }]))
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))

    setStates(rawStates.map((s: any) => ({
      ...s,
      charName: charMap[s.character_id]?.name ?? 'Unknown',
      username: profileMap[s.user_id] ?? 'Unknown',
      charData: charMap[s.character_id]?.data ?? {},
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
          const { data: existing } = await supabase
            .from('character_states').select('id')
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

      await loadStates(id)
      setLoading(false)

      channelRef.current = supabase
        .channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'character_states', filter: `campaign_id=eq.${id}` }, () => loadStates(id))
        .subscribe()
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [id])

  async function updateStat(stateId: string, field: string, value: number) {
    setUpdating(stateId + field)
    await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
    await loadStates(id)
    setUpdating(null)
  }

  function DotTracker({ label, current, max, stateId, field, color, canEdit }: {
    label: string, current: number, max: number, stateId: string,
    field: string, color: string, canEdit: boolean
  }) {
    const isUpdating = updating === stateId + field
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '9px', color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</span>
          <span style={{ fontSize: '11px', color, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{current} / {max}</span>
        </div>
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {Array.from({ length: max }).map((_, i) => {
            const filled = i < current
            return (
              <button key={i}
                onClick={() => {
                  if (!canEdit || isUpdating) return
                  const newVal = filled ? i : i + 1
                  updateStat(stateId, field, newVal)
                }}
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', padding: 0,
                  border: `2px solid ${filled ? color : '#3a3a3a'}`,
                  background: filled ? color : 'transparent',
                  cursor: canEdit ? 'pointer' : 'default',
                  opacity: isUpdating ? 0.4 : 1,
                  transition: 'all .1s',
                }} />
            )
          })}
        </div>
      </div>
    )
  }

  function SheetCard({ s }: { s: CharacterState }) {
    const canEdit = isGM || s.user_id === userId
    const isMySheet = s.user_id === userId
    const rapid = s.charData?.rapid ?? {}
    const skills: { skillName: string; level: number }[] = s.charData?.skills ?? []
    const raisedSkills = skills.filter(sk => sk.level > 0)
    const unraisedSkills = skills.filter(sk => sk.level <= 0)
    const profession = s.charData?.profession ?? ''
    const complication = s.charData?.complication ?? ''
    const motivation = s.charData?.motivation ?? ''

    return (
      <div style={{
        background: '#1a1a1a',
        border: `1px solid ${isMySheet ? '#c0392b' : '#2e2e2e'}`,
        borderLeft: `3px solid ${isMySheet ? '#c0392b' : '#3a3a3a'}`,
        borderRadius: '4px', padding: '1rem',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #2e2e2e' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#f5f2ee' }}>
            {s.charName}
          </div>
          <div style={{ fontSize: '10px', color: '#5a5550', marginTop: '1px' }}>
            {s.username}{isMySheet ? ' (you)' : ''}
            {profession ? ` · ${profession}` : ''}
          </div>
          {(complication || motivation) && (
            <div style={{ fontSize: '10px', color: '#b0aaa4', marginTop: '3px' }}>
              {complication && <span style={{ marginRight: '8px' }}>⚡ {complication}</span>}
              {motivation && <span>🎯 {motivation}</span>}
            </div>
          )}
        </div>

        {/* RAPID Attributes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '10px' }}>
          {ATTR_KEYS.map(k => {
            const val = rapid[k] ?? 0
            const raised = val > 0
            return (
              <div key={k} style={{
                background: raised ? '#2a1210' : '#242424',
                border: `1px solid ${raised ? '#c0392b' : '#3a3a3a'}`,
                borderRadius: '3px', padding: '4px 2px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '8px', color: '#b0aaa4', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: raised ? '#f5a89a' : '#b0aaa4' }}>{sgn(val)}</div>
              </div>
            )
          })}
        </div>

        {/* WP / RP trackers */}
        <DotTracker label="Wound Points" current={s.wp_current} max={s.wp_max} stateId={s.id} field="wp_current" color="#c0392b" canEdit={canEdit} />
        <DotTracker label="Resilience Points" current={s.rp_current} max={s.rp_max} stateId={s.id} field="rp_current" color="#7ab3d4" canEdit={canEdit} />

        {/* Stress / Insight / Morality */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #2e2e2e' }}>
          {[
            { label: 'Stress', field: 'stress', value: s.stress, max: 5, color: '#EF9F27' },
            { label: 'Insight', field: 'insight_dice', value: s.insight_dice, max: 9, color: '#7fc458' },
            { label: 'Morality', field: 'morality', value: s.morality, max: 5, color: '#b0aaa4' },
          ].map(({ label, field, value, max, color }) => (
            <div key={field} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                <button disabled={!canEdit || value <= 0}
                  onClick={() => canEdit && value > 0 && updateStat(s.id, field, value - 1)}
                  style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && value > 0 ? 1 : 0.3, fontSize: '12px', lineHeight: 1, padding: 0 }}>-</button>
                <span style={{ fontSize: '16px', fontWeight: 700, color, fontFamily: 'Barlow Condensed, sans-serif', minWidth: '20px', textAlign: 'center' }}>{value}</span>
                <button disabled={!canEdit || value >= max}
                  onClick={() => canEdit && value < max && updateStat(s.id, field, value + 1)}
                  style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value < max ? 'pointer' : 'not-allowed', opacity: canEdit && value < max ? 1 : 0.3, fontSize: '12px', lineHeight: 1, padding: 0 }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Skills */}
        <div style={{ fontSize: '9px', color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '5px' }}>Skills</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {raisedSkills.map(sk => (
            <span key={sk.skillName} style={{
              fontSize: '10px', padding: '2px 6px', borderRadius: '3px',
              background: '#2a1210', border: '1px solid #7a1f16', color: '#f5a89a',
              fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em',
            }}>
              {sk.skillName} {sgn(sk.level)}
            </span>
          ))}
          {unraisedSkills.map(sk => (
            <span key={sk.skillName} style={{
              fontSize: '10px', padding: '2px 6px', borderRadius: '3px',
              background: '#1a1a1a', border: '1px solid #2e2e2e',
              color: sk.level < 0 ? '#5a3a3a' : '#3a3a3a',
              fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em',
            }}>
              {sk.skillName} {sgn(sk.level)}
            </span>
          ))}
        </div>

        {!canEdit && <div style={{ fontSize: '10px', color: '#5a5550', marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>View only</div>}
      </div>
    )
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

      {states.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#b0aaa4', marginBottom: '8px' }}>No character sheets yet.</div>
          <div style={{ fontSize: '12px', color: '#5a5550' }}>Players need to assign a character to this campaign first.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {states.map(s => <SheetCard key={s.id} s={s} />)}
      </div>

    </div>
  )
}
