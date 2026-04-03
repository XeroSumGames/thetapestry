'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'
import PrintSheet from './wizard/PrintSheet'
import { WizardState, createWizardState } from '../lib/xse-engine'

const ATTR_KEYS = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']
const ATTR_FULL: Record<string, string> = {
  RSN: 'Reason', ACU: 'Acumen', PHY: 'Physicality', INF: 'Influence', DEX: 'Dexterity'
}

function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

export interface LiveState {
  id: string
  wp_current: number
  wp_max: number
  rp_current: number
  rp_max: number
  stress: number
  insight_dice: number
  morality: number
}

interface Props {
  character: {
    id: string
    name: string
    created_at: string
    data: any
  }
  liveState?: LiveState
  canEdit?: boolean
  showButtons?: boolean
  isMySheet?: boolean
  onStatUpdate?: (stateId: string, field: string, value: number) => void
  onDelete?: (id: string) => void
  onDuplicate?: (c: any) => void
}

export default function CharacterCard({
  character: c,
  liveState,
  canEdit = true,
  showButtons = true,
  isMySheet = true,
  onStatUpdate,
  onDelete,
  onDuplicate,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const rapid = c.data?.rapid ?? {}
  const skills: { skillName: string; level: number }[] = c.data?.skills ?? []
  const raisedSkills = skills.filter(s => s.level > 0)
  const unraisedSkills = skills.filter(s => s.level <= 0)
  const profession = c.data?.profession ?? ''
  const complication = c.data?.complication ?? ''
  const motivation = c.data?.motivation ?? ''

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function toWizardState(data: any): WizardState {
    const base = createWizardState()
    return {
      ...base,
      name: data.name ?? '',
      gender: data.gender ?? '',
      height: data.height ?? '',
      weight: data.weight ?? '',
      concept: data.notes ?? '',
      physdesc: data.physdesc ?? '',
      photoDataUrl: data.photoDataUrl ?? '',
      threeWords: data.threeWords ?? ['', '', ''],
      weaponPrimary: data.weaponPrimary?.weaponName ?? '',
      weaponSecondary: data.weaponSecondary?.weaponName ?? '',
      primaryAmmo: data.weaponPrimary?.ammoCurrent ?? 0,
      secondaryAmmo: data.weaponSecondary?.ammoCurrent ?? 0,
      equipment: data.equipment?.[0] ?? '',
      incidentalItem: data.incidentalItem ?? '',
      rations: data.rations ?? '',
      steps: [
        { attrKey: null, skillDeltas: {}, skillCDPSpent: 0, note: '', complication: data.complication, motivation: data.motivation },
        { attrKey: null, skillDeltas: {}, skillCDPSpent: 0, note: '' },
        { attrKey: null, skillDeltas: {}, skillCDPSpent: 0, note: '' },
        { attrSpent: {}, skillDeltas: {}, skillCDPSpent: 0, profession: data.profession ?? '', note: '' },
        { skillDeltas: {}, skillCDPSpent: 0, note: '' },
        { complication: data.complication ?? '', motivation: data.motivation ?? '' },
        {},
      ],
    }
  }

  async function handleDelete() {
    setDeleting(true)
    if (onDelete) { onDelete(c.id); setDeleting(false); return }
    await supabase.from('characters').delete().eq('id', c.id)
    setDeleting(false)
    router.refresh()
  }

  async function handleDuplicate() {
    setDuplicating(true)
    if (onDuplicate) { onDuplicate(c); setDuplicating(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('characters').insert({ user_id: user.id, name: `Copy of ${c.name}`, data: c.data })
    setDuplicating(false)
    router.refresh()
  }

  function handlePrint() {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 100)
  }

  async function updateStat(stateId: string, field: string, value: number) {
    if (!onStatUpdate) return
    setUpdating(stateId + field)
    onStatUpdate(stateId, field, value)
    setUpdating(null)
  }

  function DotTracker({ label, current, max, field, color }: {
    label: string, current: number, max: number, field: string, color: string
  }) {
    if (!liveState) return null
    const isUpd = updating === liveState.id + field
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
                onClick={() => { if (!canEdit || isUpd || !liveState) return; updateStat(liveState.id, field, filled ? i : i + 1) }}
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', padding: 0,
                  border: `2px solid ${filled ? color : '#3a3a3a'}`,
                  background: filled ? color : 'transparent',
                  cursor: canEdit ? 'pointer' : 'default',
                  opacity: isUpd ? 0.4 : 1,
                  transition: 'all .1s',
                }} />
            )
          })}
        </div>
      </div>
    )
  }

  function Counter({ label, value, field, max, color }: {
    label: string, value: number, field: string, max: number, color: string
  }) {
    if (!liveState) return null
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '9px', color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
          <button disabled={!canEdit || value <= 0}
            onClick={() => canEdit && value > 0 && liveState && updateStat(liveState.id, field, value - 1)}
            style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && value > 0 ? 1 : 0.3, fontSize: '12px', lineHeight: 1, padding: 0 }}>-</button>
          <span style={{ fontSize: '16px', fontWeight: 700, color, fontFamily: 'Barlow Condensed, sans-serif', minWidth: '20px', textAlign: 'center' }}>{value}</span>
          <button disabled={!canEdit || value >= max}
            onClick={() => canEdit && value < max && liveState && updateStat(liveState.id, field, value + 1)}
            style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value < max ? 'pointer' : 'not-allowed', opacity: canEdit && value < max ? 1 : 0.3, fontSize: '12px', lineHeight: 1, padding: 0 }}>+</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        background: '#1a1a1a',
        border: `1px solid ${isMySheet ? '#c0392b' : '#2e2e2e'}`,
        borderLeft: `3px solid ${isMySheet ? '#c0392b' : '#3a3a3a'}`,
        borderRadius: '4px', padding: '1rem 1.25rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            {c.data?.photoDataUrl && (
              <img src={c.data.photoDataUrl} alt={c.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #3a3a3a', float: 'left', marginRight: '10px' }} />
            )}
            <a href={`/characters/${c.id}`} style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', textDecoration: 'none', display: 'block' }}>
              {c.name}
            </a>
            <div style={{ fontSize: '11px', color: '#b0aaa4', marginTop: '2px' }}>
              {profession || 'No profession'} &middot; Created {formatDate(c.created_at)}
            </div>
          </div>
          {showButtons && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => router.push(`/characters/${c.id}/edit`)} style={btn('#c0392b', '#f5a89a')}>Edit</button>
              <button onClick={handlePrint} disabled={printing} style={btn('#2d5a1b', '#7fc458')}>Print</button>
              <button onClick={handleDuplicate} disabled={duplicating} style={btn('#1a3a5c', '#7ab3d4')}>{duplicating ? '...' : 'Duplicate'}</button>
              <button onClick={handleDelete} disabled={deleting} style={btn('#2e2e2e', '#b0aaa4')}>{deleting ? '...' : 'Delete'}</button>
            </div>
          )}
        </div>

        {/* RAPID Attributes */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {ATTR_KEYS.map(k => {
            const v = rapid[k] ?? 0
            return (
              <div key={k} style={{ flex: 1, background: v > 0 ? '#2a1210' : '#242424', border: `1px solid ${v > 0 ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', padding: '4px 2px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#b0aaa4', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: v > 0 ? '#f5a89a' : '#b0aaa4' }}>{sgn(v)}</div>
              </div>
            )
          })}
        </div>

        {/* Complication + Motivation */}
        {(complication || motivation) && (
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#b0aaa4', marginBottom: '8px' }}>
            {complication && <span><span style={{ color: '#5a5550' }}>Complication:</span> {complication}</span>}
            {motivation && <span><span style={{ color: '#5a5550' }}>Motivation:</span> {motivation}</span>}
          </div>
        )}

        {/* Live trackers — only shown when liveState provided */}
        {liveState && (
          <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '10px', marginBottom: '10px' }}>
            <DotTracker label="Wound Points" current={liveState.wp_current} max={liveState.wp_max} field="wp_current" color="#c0392b" />
            <DotTracker label="Resilience Points" current={liveState.rp_current} max={liveState.rp_max} field="rp_current" color="#7ab3d4" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
              <Counter label="Stress" value={liveState.stress} field="stress" max={5} color="#EF9F27" />
              <Counter label="Insight" value={liveState.insight_dice} field="insight_dice" max={9} color="#7fc458" />
              <Counter label="Morality" value={liveState.morality} field="morality" max={5} color="#b0aaa4" />
            </div>
          </div>
        )}

        {/* Skills */}
        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {raisedSkills.map(s => (
            <span key={s.skillName} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', background: '#2a1210', border: '1px solid #7a1f16', color: '#f5a89a' }}>
              {s.skillName} {sgn(s.level)}
            </span>
          ))}
          {unraisedSkills.map(s => (
            <span key={s.skillName} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', background: '#1a1a1a', border: '1px solid #2e2e2e', color: s.level < 0 ? '#4a3030' : '#3a3a3a' }}>
              {s.skillName} {sgn(s.level)}
            </span>
          ))}
        </div>

      </div>

      {/* Hidden print sheet */}
      <div id={`print-container-${c.id}`} style={{ display: printing ? 'block' : 'none' }}>
        <PrintSheet state={toWizardState(c.data)} />
      </div>
    </div>
  )
}

function btn(borderColor: string, color: string): React.CSSProperties {
  return {
    background: 'none', border: `1px solid ${borderColor}`,
    borderRadius: '3px', color, fontSize: '11px',
    padding: '4px 10px', cursor: 'pointer',
    fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase',
  }
}
