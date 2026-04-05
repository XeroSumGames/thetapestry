'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'
import PrintSheet from './wizard/PrintSheet'
import { WizardState, createWizardState } from '../lib/xse-engine'
import { SKILLS } from '../lib/xse-schema'

const ATTR_KEYS = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']

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
  cdp: number
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
  onRoll?: (label: string, amod: number, smod: number) => void
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
  onRoll,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [printing, setPrinting] = useState(false)

  // Local optimistic state — mirrors liveState, updates instantly on click
  const [localState, setLocalState] = useState<LiveState | null>(liveState ?? null)

  // Sync when liveState changes from outside (Realtime updates)
  useEffect(() => {
    if (liveState) setLocalState(liveState)
  }, [liveState])

  const rapid = c.data?.rapid ?? {}
  const skills: { skillName: string; level: number }[] = c.data?.skills ?? []
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
    setTimeout(() => { window.print(); setPrinting(false) }, 100)
  }

  // Optimistic update: update local state immediately, fire Supabase in background
  function updateStat(stateId: string, field: string, value: number) {
    if (!onStatUpdate || !localState) return
    setLocalState(prev => prev ? { ...prev, [field]: value } : prev)
    onStatUpdate(stateId, field, value) // fire and forget — no await
  }

  function handleSkillClick(skillName: string, level: number) {
    if (!onRoll) return
    const skillDef = SKILLS.find(s => s.name === skillName)
    const attrKey = skillDef?.attribute ?? 'RSN'
    const amod = rapid[attrKey] ?? 0
    onRoll(`${skillName} (${attrKey})`, amod, level)
  }

  function handleAttrClick(attrKey: string) {
    if (!onRoll) return
    const amod = rapid[attrKey] ?? 0
    onRoll(`${attrKey} Check`, amod, 0)
  }

  function DotTracker({ label, current, max, field, color }: {
    label: string, current: number, max: number, field: string, color: string
  }) {
    if (!localState) return null
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '9px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</span>
          <span style={{ fontSize: '11px', color, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{current} / {max}</span>
        </div>
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {Array.from({ length: max }).map((_, i) => {
            const filled = i < current
            return (
              <button key={i}
                onClick={() => { if (!canEdit || !localState) return; updateStat(localState.id, field, filled ? i : i + 1) }}
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', padding: 0,
                  border: `2px solid ${filled ? color : '#3a3a3a'}`,
                  background: filled ? color : 'transparent',
                  cursor: canEdit ? 'pointer' : 'default',
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
    if (!localState) return null
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '9px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
          <button disabled={!canEdit || value <= 0}
            onClick={() => canEdit && value > 0 && localState && updateStat(localState.id, field, value - 1)}
            style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && value > 0 ? 1 : 0.3, fontSize: '12px', lineHeight: 1, padding: 0 }}>-</button>
          <span style={{ fontSize: '16px', fontWeight: 700, color, fontFamily: 'Barlow Condensed, sans-serif', minWidth: '20px', textAlign: 'center' }}>{value}</span>
          <button disabled={!canEdit || value >= max}
            onClick={() => canEdit && value < max && localState && updateStat(localState.id, field, value + 1)}
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
              <img src={c.data.photoDataUrl} alt={c.name} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #3a3a3a', float: 'left', marginRight: '12px' }} />
            )}
            <a href={`/characters/${c.id}`} style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', textDecoration: 'none', display: 'block' }}>
              {c.name}
            </a>
            <div style={{ fontSize: '11px', color: '#d4cfc9', marginTop: '2px' }}>
              {profession || 'No profession'} &middot; Created {formatDate(c.created_at)}
            </div>
          </div>
          {showButtons && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => router.push(`/characters/${c.id}/edit`)} style={btn('#c0392b', '#f5a89a')}>Edit</button>
              <button onClick={handlePrint} disabled={printing} style={btn('#2d5a1b', '#7fc458')}>Print</button>
              <button onClick={handleDuplicate} disabled={duplicating} style={btn('#1a3a5c', '#7ab3d4')}>{duplicating ? '...' : 'Duplicate'}</button>
              <button onClick={handleDelete} disabled={deleting} style={btn('#2e2e2e', '#d4cfc9')}>{deleting ? '...' : 'Delete'}</button>
            </div>
          )}
        </div>

        {/* RAPID Attributes */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {ATTR_KEYS.map(k => {
            const v = rapid[k] ?? 0
            const clickable = !!onRoll
            return (
              <div key={k}
                onClick={() => handleAttrClick(k)}
                style={{
                  flex: 1, background: v > 0 ? '#1a2e10' : '#242424',
                  border: `1px solid ${v > 0 ? '#2d5a1b' : '#3a3a3a'}`,
                  borderRadius: '3px', padding: '4px 2px', textAlign: 'center',
                  cursor: clickable ? 'pointer' : 'default',
                  transition: clickable ? 'border-color 0.1s, background 0.1s' : undefined,
                }}
                onMouseEnter={e => { if (clickable) { (e.currentTarget as HTMLElement).style.borderColor = '#7fc458'; (e.currentTarget as HTMLElement).style.background = v > 0 ? '#243e14' : '#2e2e2e' } }}
                onMouseLeave={e => { if (clickable) { (e.currentTarget as HTMLElement).style.borderColor = v > 0 ? '#2d5a1b' : '#3a3a3a'; (e.currentTarget as HTMLElement).style.background = v > 0 ? '#1a2e10' : '#242424' } }}
              >
                <div style={{ fontSize: '8px', color: '#d4cfc9', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: v > 0 ? '#7fc458' : '#d4cfc9' }}>{sgn(v)}</div>
                {clickable && <div style={{ fontSize: '7px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>ROLL</div>}
              </div>
            )
          })}
        </div>

        {/* Complication / Motivation / Concept / Description */}
        {(complication || motivation || c.data?.notes || c.data?.physdesc) && (
          <div style={{ fontSize: '11px', color: '#d4cfc9', marginBottom: '8px', lineHeight: 1.6 }}>
            {(complication || motivation) && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
                {complication && <span><span style={{ color: '#5a5550' }}>Complication:</span> {complication}</span>}
                {motivation && <span><span style={{ color: '#5a5550' }}>Motivation:</span> {motivation}</span>}
              </div>
            )}
            {(c.data?.notes || c.data?.physdesc) && (
              <div>
                {c.data?.notes && <span><span style={{ color: '#5a5550' }}>Concept:</span> {c.data.notes}</span>}
                {c.data?.notes && c.data?.physdesc && <span style={{ color: '#5a5550' }}> &middot; </span>}
                {c.data?.physdesc && <span><span style={{ color: '#5a5550' }}>Description:</span> {c.data.physdesc}</span>}
              </div>
            )}
          </div>
        )}

        {/* Live trackers */}
        {localState && (
          <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <DotTracker label="Wound Points" current={localState.wp_current} max={localState.wp_max} field="wp_current" color="#c0392b" />
              </div>
              <div style={{ flex: 1 }}>
                <DotTracker label="Resilience Points" current={localState.rp_current} max={localState.rp_max} field="rp_current" color="#7ab3d4" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'space-around' }}>
              <Counter label="Stress" value={localState.stress} field="stress" max={5} color="#EF9F27" />
              <Counter label="Insight" value={localState.insight_dice} field="insight_dice" max={99} color="#7fc458" />
              <Counter label="CDP" value={localState.cdp} field="cdp" max={20} color="#7ab3d4" />
              <Counter label="Morality" value={localState.morality} field="morality" max={5} color="#d4cfc9" />
            </div>
          </div>
        )}

        {/* Skills grid */}
        <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
          {skills.map(s => {
            const raised = s.level > 0
            const clickable = !!onRoll
            return (
              <span key={s.skillName}
                onClick={() => handleSkillClick(s.skillName, s.level)}
                style={{
                  fontSize: '10px', padding: '3px 6px', borderRadius: '3px',
                  background: raised ? '#1a2e10' : '#1a1a1a',
                  border: `1px solid ${raised ? '#2d5a1b' : '#2e2e2e'}`,
                  color: raised ? '#7fc458' : s.level < 0 ? '#7a4a4a' : '#f5f2ee',
                  textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  cursor: clickable ? 'pointer' : 'default',
                  transition: clickable ? 'border-color 0.1s' : undefined,
                }}
                onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.borderColor = '#7ab3d4' }}
                onMouseLeave={e => { if (clickable) (e.currentTarget as HTMLElement).style.borderColor = raised ? '#2d5a1b' : '#2e2e2e' }}
              >
                {s.skillName.replace('Specific Knowledge', 'Specific Know.')} {sgn(s.level)}
              </span>
            )
          })}
        </div>

      </div>

      {/* Hidden print sheet */}
      {printing && (
        <div className="print-sheet-container">
          <PrintSheet state={toWizardState(c.data)} />
        </div>
      )}
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
