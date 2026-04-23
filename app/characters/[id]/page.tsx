'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { ATTRIBUTE_LABELS, AttributeName } from '../../../lib/xse-schema'

const ATTR_KEYS: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<AttributeName, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

export default function CharacterViewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [character, setCharacter] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const isThriver = profile?.role?.toLowerCase() === 'thriver'
      let query = supabase.from('characters').select('id, name, data').eq('id', id)
      if (!isThriver) query = query.eq('user_id', user.id)
      const { data: row, error } = await query.single()
      if (error || !row) { router.push('/characters'); return }
      setCharacter(row)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif' }}>
      Loading...
    </div>
  )

  const d = character.data
  const rapid = d.rapid ?? {}
  const skills = (d.skills ?? []).filter((s: any) => s.level > 0)
  const secondary = d.secondary ?? {}
  function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        {d.photoDataUrl && (
          <img src={d.photoDataUrl} alt={d.name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #3a3a3a', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            {d.name || 'Unnamed Character'}
          </div>
          <div style={{ fontSize: '13px', color: '#d4cfc9' }}>
            {[d.profession, d.gender, d.age ? `Age ${d.age}` : '', d.height, d.weight].filter(Boolean).join(' · ')}
          </div>
          {d.threeWords?.some((w: string) => w) && (
            <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '3px', fontStyle: 'italic' }}>
              {d.threeWords.filter((w: string) => w).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => router.push(`/characters/${id}/edit`)}
            style={{ padding: '6px 14px', background: 'none', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Edit
          </button>
          <button onClick={() => router.push('/characters')}
            style={{ padding: '6px 14px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Back
          </button>
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>RAPID Attributes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
          {ATTR_KEYS.map(k => {
            const val = rapid[k] ?? 0
            return (
              <div key={k} style={{ background: val > 0 ? '#1a2e10' : '#242424', border: `1px solid ${val > 0 ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '4px' }}>{ATTR_FULL[k]}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: val > 0 ? '#7fc458' : '#f5f2ee' }}>{sgn(val)}</div>
                <div style={{ fontSize: '13px', color: val > 0 ? '#7fc458' : '#d4cfc9' }}>{ATTRIBUTE_LABELS[val]}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>Secondary Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {[
            { label: 'Wound Points', value: secondary.woundPoints, hi: true },
            { label: 'Resilience Points', value: secondary.resiliencePoints, hi: true },
            { label: 'Initiative', value: sgn(secondary.initiative ?? 0), hi: false },
            { label: 'Perception', value: sgn(secondary.perception ?? 0), hi: false },
            { label: 'Encumbrance', value: secondary.encumbrance, hi: false },
            { label: 'Stress Modifier', value: sgn(secondary.stressModifier ?? 0), hi: false },
          ].map(({ label, value, hi }) => (
            <div key={label} style={{ background: '#242424', border: `1px solid ${hi ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', padding: '8px 10px' }}>
              <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: hi ? '#7fc458' : '#f5f2ee' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {(d.complication || d.motivation) && (
        <div style={section}>
          <div style={sectionTitle}>Character</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {d.complication && (
              <div>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '3px' }}>Complication</div>
                <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{d.complication}</div>
              </div>
            )}
            {d.motivation && (
              <div>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '3px' }}>Motivation</div>
                <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{d.motivation}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div style={section}>
          <div style={sectionTitle}>Trained Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {skills.map((s: any) => (
              <span key={s.skillName} style={{ fontSize: '13px', padding: '3px 10px', borderRadius: '3px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                {s.skillName} {sgn(s.level)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={section}>
        <div style={sectionTitle}>Weapons & Gear</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            ['Primary Weapon', d.weaponPrimary?.weaponName],
            ['Secondary Weapon', d.weaponSecondary?.weaponName],
            ['Equipment', d.equipment?.[0]],
            ['Incidental Item', d.incidentalItem],
            ['Rations', d.rations],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={String(label)}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '14px', color: '#f5f2ee' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={sectionTitle}>Tracking</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            { label: 'Morality', value: d.secondary?.morality ?? 3 },
            { label: 'Insight Dice', value: d.insightDice ?? 2 },
            { label: 'CDP', value: d.cdp ?? 0 },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f2ee' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

const section: React.CSSProperties = {
  border: '1px solid #2e2e2e', borderRadius: '4px',
  padding: '12px 14px', marginBottom: '10px', background: '#1a1a1a',
}

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Barlow Condensed, sans-serif',
  fontSize: '13px', fontWeight: 700, color: '#c0392b',
  textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px',
}
