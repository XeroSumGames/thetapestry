'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'
import { logEvent } from '../lib/events'
import { getWeaponByName, conditionColor, CONDITION_CMOD, CONDITIONS, Condition, ALL_WEAPONS, MELEE_WEAPONS, RANGED_WEAPONS, EXPLOSIVE_WEAPONS, HEAVY_WEAPONS } from '../lib/weapons'
import PrintSheet from './wizard/PrintSheet'
import { WizardState, createWizardState } from '../lib/xse-engine'
import { SKILLS } from '../lib/xse-schema'

const ATTR_KEYS = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']

function sgn(v: number) { return v > 0 ? `+${v}` : String(v) }

const BREAKING_POINT_TABLE: { name: string; effect: string }[] = [
  { name: 'Catatonia', effect: '-1 on Dexterity checks' },           // 2
  { name: 'Compulsive Fixation', effect: '-2 Reason' },               // 3
  { name: 'Blind Rage', effect: '-1 Dexterity' },                     // 4
  { name: 'Dissociation', effect: '-1 max Resilience Points' },       // 5
  { name: 'Overwhelm', effect: '-1 max Wound Points' },               // 6
  { name: 'Panic Surge', effect: '-1 Initiative Modifier' },          // 7
  { name: 'Fatalism', effect: '-1 Influence' },                       // 8
  { name: 'Reckless Abandon', effect: '-1 Physicality' },             // 9
  { name: 'Self-Harm', effect: '-1 Acumen' },                         // 10
  { name: 'Self-Destructive Urges', effect: '-1 Perception, -1 Acumen' }, // 11
  { name: 'Irrational Outburst', effect: '-2 Dexterity' },            // 12
]

const LASTING_WOUNDS_TABLE: { name: string; effect: string }[] = [
  { name: 'Lost Eye', effect: '-1 on Dexterity checks' },             // 2
  { name: 'Brain Injury', effect: '-2 Reason' },                       // 3
  { name: 'Diminished', effect: '-1 Dexterity' },                     // 4
  { name: 'Shaken', effect: '-1 max Resilience Points' },             // 5
  { name: 'Weakened', effect: '-1 max Wound Points' },                // 6
  { name: 'Skittish', effect: '-1 Initiative Modifier' },             // 7
  { name: 'Scarring', effect: '-1 Influence' },                       // 8
  { name: 'Fragile', effect: '-1 Physicality' },                      // 9
  { name: 'Hearing Loss', effect: '-1 Acumen' },                      // 10
  { name: 'Crippled', effect: '-1 Perception, -1 Acumen' },           // 11
  { name: 'Shell Shock', effect: '-2 Dexterity' },                    // 12
]

function rollOnTable(table: { name: string; effect: string }[]): { roll: number; result: typeof table[0] } {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  const roll = die1 + die2
  return { roll, result: table[roll - 2] }
}

function stressColor(level: number): string {
  if (level <= 1) return '#7fc458'
  if (level <= 2) return '#EF9F27'
  if (level <= 3) return '#EF9F27'
  return '#c0392b'
}

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
  onClose?: () => void
  inline?: boolean
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
  onClose,
  inline = false,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [breakingPointResult, setBreakingPointResult] = useState<{ roll: number; result: { name: string; effect: string } } | null>(null)
  const [lastingWoundResult, setLastingWoundResult] = useState<{ roll: number; result: { name: string; effect: string } } | null>(null)

  // Weapon local state
  const [weaponPrimary, setWeaponPrimary] = useState(c.data?.weaponPrimary ?? { weaponName: '', condition: 'Used', ammoCurrent: 0, ammoMax: 0, reloads: 0 })
  const [weaponSecondary, setWeaponSecondary] = useState(c.data?.weaponSecondary ?? { weaponName: '', condition: 'Used', ammoCurrent: 0, ammoMax: 0, reloads: 0 })

  async function saveWeapon(slot: 'weaponPrimary' | 'weaponSecondary', data: any) {
    if (slot === 'weaponPrimary') setWeaponPrimary(data)
    else setWeaponSecondary(data)
    await supabase.from('characters').update({ data: { ...c.data, [slot]: data } }).eq('id', c.id)
  }

  function changeWeapon(slot: 'weaponPrimary' | 'weaponSecondary', weaponName: string) {
    const w = getWeaponByName(weaponName)
    const newData = { weaponName, condition: 'Used' as Condition, ammoCurrent: w?.clip ?? 0, ammoMax: w?.clip ?? 0, reloads: w?.ammo ? Math.floor(Math.random() * 3) + 1 : 0 }
    saveWeapon(slot, newData)
  }

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
    logEvent('character_deleted', { id: c.id, name: c.name })
    if (onDelete) { onDelete(c.id); setDeleting(false); return }
    await supabase.from('characters').delete().eq('id', c.id)
    setDeleting(false)
    router.refresh()
  }

  async function handleDuplicate() {
    setDuplicating(true)
    logEvent('character_duplicated', { id: c.id, name: c.name })
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
          <span style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</span>
          <span style={{ fontSize: '13px', color, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{current} / {max}</span>
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
              {!inline && <button onClick={handleDuplicate} disabled={duplicating} style={btn('#1a3a5c', '#7ab3d4')}>{duplicating ? '...' : 'Duplicate'}</button>}
              {!inline && <button onClick={handleDelete} disabled={deleting} style={btn('#2e2e2e', '#d4cfc9')}>{deleting ? '...' : 'Delete'}</button>}
              {inline && onClose && <button onClick={onClose} style={btn('#c0392b', '#f5a89a')}>Close</button>}
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
                {clickable && <div style={{ fontSize: '7px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>ROLL</div>}
              </div>
            )
          })}
        </div>

        {/* Complication / Motivation / Concept */}
        <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '8px', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {complication && <span><span style={{ color: '#cce0f5' }}>Complication:</span> {complication}</span>}
            {motivation && <span><span style={{ color: '#cce0f5' }}>Motivation:</span> {motivation}</span>}
            <span><span style={{ color: '#cce0f5' }}>Concept:</span> <span style={{ fontStyle: 'italic' }}>{c.data?.notes || 'A survivor, just trying to get by.'}</span></span>
          </div>
        </div>

        {/* Live trackers */}
        {localState && (
          <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <DotTracker label="Wound Points" current={localState.wp_current} max={localState.wp_max} field="wp_current" color="#c0392b" />
                {localState.wp_current === 0 && (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Mortally Wounded</div>
                    <button onClick={() => setLastingWoundResult(rollOnTable(LASTING_WOUNDS_TABLE))}
                      style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Roll Lasting Wound
                    </button>
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <DotTracker label="Resilience Points" current={localState.rp_current} max={localState.rp_max} field="rp_current" color="#7ab3d4" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'space-around' }}>
              {/* Stress bar with Breaking Point trigger */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>Stress</span>
                  {onRoll && (
                    <button onClick={() => { const sm = (rapid.RSN ?? 0) + (rapid.ACU ?? 0); onRoll('Stress Check', sm, 0) }}
                      style={{ padding: '1px 6px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '2px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Check</button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                  <button disabled={!canEdit || localState.stress <= 0}
                    onClick={() => canEdit && localState.stress > 0 && updateStat(localState.id, 'stress', localState.stress - 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.stress > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.stress > 0 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>-</button>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{ width: '10px', height: '16px', borderRadius: '2px', background: i <= localState.stress ? stressColor(localState.stress) : '#242424', border: `1px solid ${i <= localState.stress ? stressColor(localState.stress) : '#3a3a3a'}`, transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <button disabled={!canEdit || localState.stress >= 5}
                    onClick={() => {
                      if (!canEdit || localState.stress >= 5) return
                      const newStress = localState.stress + 1
                      updateStat(localState.id, 'stress', newStress)
                      if (newStress >= 5) {
                        // Trigger Breaking Point
                        const bp = rollOnTable(BREAKING_POINT_TABLE)
                        setBreakingPointResult(bp)
                        // Reset stress to 0 after breaking point
                        setTimeout(() => updateStat(localState.id, 'stress', 0), 100)
                      }
                    }}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.stress < 5 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.stress < 5 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>+</button>
                </div>
              </div>
              {/* Insight bar — 10 blocks */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>Insight</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                  <button disabled={!canEdit || localState.insight_dice <= 0}
                    onClick={() => canEdit && localState.insight_dice > 0 && updateStat(localState.id, 'insight_dice', localState.insight_dice - 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.insight_dice > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.insight_dice > 0 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>-</button>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} style={{ width: '10px', height: '16px', borderRadius: '2px', background: i < localState.insight_dice ? '#7fc458' : '#242424', border: `1px solid ${i < localState.insight_dice ? '#7fc458' : '#3a3a3a'}`, transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <button disabled={!canEdit || localState.insight_dice >= 10}
                    onClick={() => canEdit && localState.insight_dice < 10 && updateStat(localState.id, 'insight_dice', localState.insight_dice + 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.insight_dice < 10 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.insight_dice < 10 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>+</button>
                </div>
              </div>
              {/* CDP bar — 10 blocks */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>CDP</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                  <button disabled={!canEdit || localState.cdp <= 0}
                    onClick={() => canEdit && localState.cdp > 0 && updateStat(localState.id, 'cdp', localState.cdp - 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.cdp > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.cdp > 0 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>-</button>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} style={{ width: '10px', height: '16px', borderRadius: '2px', background: i < localState.cdp ? '#7ab3d4' : '#242424', border: `1px solid ${i < localState.cdp ? '#7ab3d4' : '#3a3a3a'}`, transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <button disabled={!canEdit || localState.cdp >= 10}
                    onClick={() => canEdit && localState.cdp < 10 && updateStat(localState.id, 'cdp', localState.cdp + 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.cdp < 10 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.cdp < 10 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>+</button>
                </div>
              </div>
              {/* Morality bar — 7 blocks */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>Morality</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                  <button disabled={!canEdit || localState.morality <= 0}
                    onClick={() => canEdit && localState.morality > 0 && updateStat(localState.id, 'morality', localState.morality - 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.morality > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.morality > 0 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>-</button>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} style={{ width: '10px', height: '16px', borderRadius: '2px', background: i < localState.morality ? '#d4cfc9' : '#242424', border: `1px solid ${i < localState.morality ? '#d4cfc9' : '#3a3a3a'}`, transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <button disabled={!canEdit || localState.morality >= 7}
                    onClick={() => canEdit && localState.morality < 7 && updateStat(localState.id, 'morality', localState.morality + 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.morality < 7 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.morality < 7 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>+</button>
                </div>
              </div>
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

        {/* Weapons */}
        <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '10px', marginTop: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([
              { label: 'Primary', slot: 'weaponPrimary' as const, weapon: weaponPrimary, setWeapon: (d: any) => saveWeapon('weaponPrimary', d) },
              { label: 'Secondary', slot: 'weaponSecondary' as const, weapon: weaponSecondary, setWeapon: (d: any) => saveWeapon('weaponSecondary', d) },
            ]).map(({ label, slot, weapon, setWeapon }) => {
              const w = getWeaponByName(weapon.weaponName)
              const cond = (weapon.condition as Condition) ?? 'Used'
              const cmodVal = CONDITION_CMOD[cond]
              return (
                <div key={label} style={{ flex: 1, minWidth: '200px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '8px 10px' }}>
                  {/* Weapon selector — inline with label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>{label}</span>
                    <select value={weapon.weaponName} onChange={e => changeWeapon(slot, e.target.value)} disabled={!canEdit}
                      style={{ flex: 1, padding: '4px 6px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none', cursor: canEdit ? 'pointer' : 'default' }}>
                      <option value="">— None —</option>
                      <optgroup label="Melee">{MELEE_WEAPONS.map(mw => <option key={mw.name} value={mw.name}>{mw.name}</option>)}</optgroup>
                      <optgroup label="Ranged">{RANGED_WEAPONS.map(rw => <option key={rw.name} value={rw.name}>{rw.name}</option>)}</optgroup>
                      <optgroup label="Explosive">{EXPLOSIVE_WEAPONS.map(ew => <option key={ew.name} value={ew.name}>{ew.name}</option>)}</optgroup>
                      <optgroup label="Heavy">{HEAVY_WEAPONS.map(hw => <option key={hw.name} value={hw.name}>{hw.name}</option>)}</optgroup>
                    </select>
                  </div>
                  {w && (
                    <>
                      {/* Line 1: Skill, Range, Condition */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>Skill:</span> {w.skill}</span>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>Range:</span> {w.range}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <span style={{ color: '#cce0f5' }}>Condition:</span>
                          <select value={cond} onChange={e => setWeapon({ ...weapon, condition: e.target.value })} disabled={!canEdit}
                            style={{ padding: '2px 4px', background: '#1a1a1a', border: `1px solid ${conditionColor(cond)}`, borderRadius: '3px', color: conditionColor(cond), fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none', cursor: canEdit ? 'pointer' : 'default', width: '110px' }}>
                            {CONDITIONS.map(co => <option key={co} value={co}>{co} ({CONDITION_CMOD[co] > 0 ? '+' : ''}{CONDITION_CMOD[co]})</option>)}
                          </select>
                        </span>
                      </div>
                      {/* Line 2: WP Damage, RP */}
                      <div style={{ display: 'flex', gap: '8px', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>WP Damage:</span> <span style={{ color: '#c0392b', fontWeight: 700 }}>{w.damage}</span></span>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>RP:</span> <span style={{ color: '#7ab3d4' }}>{w.rpPercent}%</span></span>
                      </div>
                      {/* Ammo pips + reload on one line */}
                      {w.clip && w.clip > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', flexShrink: 0 }}>Ammo</span>
                          <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap' }}>
                            {Array.from({ length: w.clip }).map((_, i) => (
                              <div key={i}
                                onClick={() => { if (!canEdit) return; const newAmmo = i < weapon.ammoCurrent ? i : i + 1; setWeapon({ ...weapon, ammoCurrent: newAmmo }) }}
                                style={{ width: '8px', height: '12px', borderRadius: '1px', background: i < weapon.ammoCurrent ? '#EF9F27' : '#242424', border: `1px solid ${i < weapon.ammoCurrent ? '#EF9F27' : '#3a3a3a'}`, cursor: canEdit ? 'pointer' : 'default', transition: 'background 0.1s' }} />
                            ))}
                          </div>
                          <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, flexShrink: 0 }}>{weapon.ammoCurrent}/{w.clip}</span>
                          <button onClick={() => { if (!canEdit || weapon.reloads <= 0) return; setWeapon({ ...weapon, ammoCurrent: w.clip, reloads: weapon.reloads - 1 }) }}
                            disabled={!canEdit || weapon.reloads <= 0}
                            style={{ padding: '2px 8px', background: weapon.reloads > 0 ? '#1a2e10' : '#2a1210', border: `1px solid ${weapon.reloads > 0 ? '#2d5a1b' : '#c0392b'}`, borderRadius: '3px', color: weapon.reloads > 0 ? '#7fc458' : '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: canEdit && weapon.reloads > 0 ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.5 }}>
                            Reload
                          </button>
                          {/* Reload tracker — 5 pips */}
                          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', flexShrink: 0 }}>Clips</span>
                          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                            <button disabled={!canEdit || weapon.reloads <= 0}
                              onClick={() => canEdit && weapon.reloads > 0 && setWeapon({ ...weapon, reloads: weapon.reloads - 1 })}
                              style={{ width: '14px', height: '14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && weapon.reloads > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && weapon.reloads > 0 ? 1 : 0.3, fontSize: '13px', lineHeight: 1, padding: 0 }}>-</button>
                            {[0, 1, 2, 3, 4].map(i => (
                              <div key={i} style={{ width: '10px', height: '14px', borderRadius: '2px', background: i < weapon.reloads ? '#7fc458' : '#242424', border: `1px solid ${i < weapon.reloads ? '#7fc458' : '#3a3a3a'}`, transition: 'background 0.2s' }} />
                            ))}
                            <button disabled={!canEdit || weapon.reloads >= 5}
                              onClick={() => canEdit && weapon.reloads < 5 && setWeapon({ ...weapon, reloads: weapon.reloads + 1 })}
                              style={{ width: '14px', height: '14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && weapon.reloads < 5 ? 'pointer' : 'not-allowed', opacity: canEdit && weapon.reloads < 5 ? 1 : 0.3, fontSize: '13px', lineHeight: 1, padding: 0 }}>+</button>
                          </div>
                        </div>
                      )}
                      {/* Traits */}
                      {w.traits.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', flexShrink: 0 }}>Traits:</span>
                          {w.traits.map(t => (
                            <span key={t} style={{ fontSize: '13px', padding: '0 4px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Hidden print sheet */}
      {printing && (
        <div className="print-sheet-container">
          <PrintSheet state={toWizardState(c.data)} />
        </div>
      )}

      {/* Breaking Point modal */}
      {breakingPointResult && (
        <div onClick={() => setBreakingPointResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '2px solid #c0392b', borderRadius: '4px', padding: '1.5rem', width: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Breaking Point</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px' }}>{breakingPointResult.result.name}</div>
            <div style={{ fontSize: '14px', color: '#d4cfc9', marginBottom: '8px' }}>Rolled: {breakingPointResult.roll}</div>
            <div style={{ fontSize: '15px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '1.5rem', padding: '10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px' }}>{breakingPointResult.result.effect}</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem' }}>Stress has been reset to 0.</div>
            <button onClick={() => setBreakingPointResult(null)} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Acknowledge</button>
          </div>
        </div>
      )}

      {/* Lasting Wound modal */}
      {lastingWoundResult && (
        <div onClick={() => setLastingWoundResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '2px solid #c0392b', borderRadius: '4px', padding: '1.5rem', width: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Lasting Wound</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px' }}>{lastingWoundResult.result.name}</div>
            <div style={{ fontSize: '14px', color: '#d4cfc9', marginBottom: '8px' }}>Rolled: {lastingWoundResult.roll}</div>
            <div style={{ fontSize: '15px', color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '1.5rem', padding: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px' }}>{lastingWoundResult.result.effect}</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem' }}>This wound is permanent and cannot be healed.</div>
            <button onClick={() => setLastingWoundResult(null)} style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Acknowledge</button>
          </div>
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
