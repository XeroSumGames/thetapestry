'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'
import { logEvent } from '../lib/events'
import InventoryPanel, { InventoryItem } from './InventoryPanel'
import ProgressionLog, { LogEntry, createLogEntry } from './ProgressionLog'
import { openPopout } from '../lib/popout'
import { getWeaponByName, conditionColor, CONDITION_CMOD, CONDITIONS, Condition, ALL_WEAPONS, MELEE_WEAPONS, RANGED_WEAPONS, EXPLOSIVE_WEAPONS, HEAVY_WEAPONS, getTraitValue } from '../lib/weapons'
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

function rollOnTable(table: { name: string; effect: string }[], cmod = 0): { roll: number; cmod: number; result: typeof table[0] } {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  const raw = die1 + die2
  const adjusted = Math.max(2, Math.min(12, raw + cmod))
  return { roll: raw, cmod, result: table[adjusted - 2] }
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
  death_countdown?: number | null
  incap_rounds?: number | null
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
  onRoll?: (label: string, amod: number, smod: number, weaponContext?: { weaponName: string; damage: string; rpPercent: number; conditionCmod: number; traitCmod?: number; traitLabel?: string; traits?: string[] }) => void
  onClose?: () => void
  onKick?: () => void
  onPlaceOnMap?: () => void
  inline?: boolean
  campaignId?: string
  otherCharacters?: { id: string; name: string }[]
  onGiveItem?: (item: InventoryItem, targetCharId: string) => void
  onInventoryChange?: (newInventory: InventoryItem[]) => void
  onWeaponChange?: (slot: 'weaponPrimary' | 'weaponSecondary', newWeapon: any) => void
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
  onKick,
  onPlaceOnMap,
  inline = false,
  campaignId: campaignIdProp,
  otherCharacters,
  onGiveItem,
  onInventoryChange,
  onWeaponChange,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [stressCheckPending, setStressCheckPending] = useState(false)
  const [stressCheckCmod, setStressCheckCmod] = useState('0')
  const [stressCheckResult, setStressCheckResult] = useState<{ die1: number; die2: number; amod: number; cmod: number; total: number; success: boolean } | null>(null)
  const [breakingPointPending, setBreakingPointPending] = useState(false)
  const [breakingPointCmod, setBreakingPointCmod] = useState('0')
  const [breakingPointResult, setBreakingPointResult] = useState<{ roll: number; cmod: number; result: { name: string; effect: string }; durationHours: number } | null>(null)
  const [lastingWoundResult, setLastingWoundResult] = useState<{ roll: number; cmod: number; result: { name: string; effect: string } } | null>(null)
  const [showRestModal, setShowRestModal] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [restHours, setRestHours] = useState(0)
  const [restDays, setRestDays] = useState(0)
  const [restWeeks, setRestWeeks] = useState(0)

  // Weapon local state
  const [weaponPrimary, setWeaponPrimary] = useState(c.data?.weaponPrimary ?? { weaponName: '', condition: 'Used', ammoCurrent: 0, ammoMax: 0, reloads: 0 })
  const [weaponSecondary, setWeaponSecondary] = useState(c.data?.weaponSecondary ?? { weaponName: '', condition: 'Used', ammoCurrent: 0, ammoMax: 0, reloads: 0 })

  // Local inventory mirror. Reads from c.data at mount; updates optimistically
  // on edits so the InventoryPanel displays changes immediately. Re-syncs when
  // the character prop changes (e.g. loadEntries on the parent fetched fresh).
  const [inventoryState, setInventoryState] = useState<InventoryItem[]>(c.data?.inventory ?? [])
  useEffect(() => { setInventoryState(c.data?.inventory ?? []) }, [c.data?.inventory])

  const latestDataRef = useRef(c.data)
  useEffect(() => { latestDataRef.current = c.data }, [c.data])

  async function saveWeapon(slot: 'weaponPrimary' | 'weaponSecondary', data: any) {
    if (slot === 'weaponPrimary') { setWeaponPrimary(data); latestDataRef.current = { ...latestDataRef.current, weaponPrimary: data } }
    else { setWeaponSecondary(data); latestDataRef.current = { ...latestDataRef.current, weaponSecondary: data } }
    // Notify parent synchronously so its `entries` state patches before the
    // DB write returns — otherwise the combat action bar's Attack button,
    // which reads `entries[i].character.data.weaponPrimary`, keeps showing
    // the old weapon until the next loadEntries. Same pattern as
    // onInventoryChange added for the + From Catalog bug.
    onWeaponChange?.(slot, data)
    await supabase.from('characters').update({ data: { ...latestDataRef.current, [slot]: data } }).eq('id', c.id)
  }

  function changeWeapon(slot: 'weaponPrimary' | 'weaponSecondary', weaponName: string) {
    const w = getWeaponByName(weaponName)
    const newData = { weaponName, condition: 'Used' as Condition, ammoCurrent: w?.clip ?? 0, ammoMax: w?.clip ?? 0, reloads: w?.ammo ? Math.floor(Math.random() * 3) + 1 : 0 }
    saveWeapon(slot, newData)
  }

  // Local optimistic state — mirrors liveState, updates instantly on click
  const [localState, setLocalState] = useState<LiveState | null>(liveState ?? null)

  // Sync when liveState changes from outside (Realtime updates)
  const prevStressRef = useRef(-1)
  useEffect(() => {
    if (liveState) {
      const prevStress = prevStressRef.current
      prevStressRef.current = liveState.stress
      setLocalState(liveState)
      // Trigger Stress Check when stress reaches 5 on whichever screen has the sheet open
      // prevStress === -1 means first mount — also trigger if stress is already at 5
      if (liveState.stress >= 5 && prevStress < 5 && !stressCheckPending && !breakingPointPending) {
        setStressCheckPending(true)
        setStressCheckCmod('0')
        setStressCheckResult(null)
      }
    }
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
        <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
          <button disabled={!canEdit || value <= 0}
            onClick={() => canEdit && value > 0 && localState && updateStat(localState.id, field, value - 1)}
            style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && value > 0 ? 1 : 0.3, fontSize: '13px', lineHeight: 1, padding: 0 }}>-</button>
          <span style={{ fontSize: '16px', fontWeight: 700, color, fontFamily: 'Barlow Condensed, sans-serif', minWidth: '20px', textAlign: 'center' }}>{value}</span>
          <button disabled={!canEdit || value >= max}
            onClick={() => canEdit && value < max && localState && updateStat(localState.id, field, value + 1)}
            style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value < max ? 'pointer' : 'not-allowed', opacity: canEdit && value < max ? 1 : 0.3, fontSize: '13px', lineHeight: 1, padding: 0 }}>+</button>
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
              <img src={c.data.photoDataUrl} alt={c.name} loading="lazy" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #3a3a3a', float: 'left', marginRight: '12px' }} />
            )}
            <a href={`/characters/${c.id}`} style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', textDecoration: 'none', display: 'block' }}>
              {c.name}
            </a>
          </div>
          {showButtons && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {onPlaceOnMap && <button onClick={onPlaceOnMap} style={btn('#1a1a2e', '#7ab3d4')}>Map</button>}
              <button onClick={() => router.push(`/characters/${c.id}/edit`)} style={btn('#c0392b', '#f5a89a')}>Edit</button>
              <button onClick={() => setShowInventory(true)} style={btn('#2a2010', '#EF9F27')}>Inventory</button>
              {/* Apprentice placeholder — unwired for now. Will surface
                  the PC's Apprentice NPC card when clicked once the
                  picker/display is built. Matches Inventory styling
                  (green community-palette) so it reads as a paired
                  bond surface. */}
              <button onClick={() => alert('Apprentice view coming soon — check the Community roster for NPCs tagged ⇐ this PC.')} style={btn('#1a2e10', '#7fc458')}>Apprentice</button>
              {campaignIdProp && (
                <button onClick={() => openPopout(`/character-sheet?c=${campaignIdProp}&char=${c.id}`, `char-${c.id}`, { w: 800, h: 800 })} title="Pop out" style={btn('#2a102a', '#d48bd4')}>Popout</button>
              )}
              <button onClick={handlePrint} disabled={printing} style={btn('#2d5a1b', '#7fc458')}>Print</button>
              {!inline && <button onClick={handleDuplicate} disabled={duplicating} style={btn('#1a3a5c', '#7ab3d4')}>{duplicating ? '...' : 'Duplicate'}</button>}
              {!inline && <button onClick={handleDelete} disabled={deleting} style={btn('#2e2e2e', '#d4cfc9')}>{deleting ? '...' : 'Delete'}</button>}
              {inline && onKick && <button onClick={() => { if (confirm(`Remove ${c.name} from this campaign?`)) onKick() }} style={btn('#7a1f16', '#f5a89a')}>Kick</button>}
              {inline && onClose && <button onClick={onClose} style={btn('#c0392b', '#f5a89a')}>Close</button>}
            </div>
          )}
        </div>
        {/* Concept/Complication/Motivation/Words — two aligned rows */}
        <div style={{ display: 'flex', marginBottom: '8px', fontSize: '13px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#d4cfc9' }}>{profession || 'No profession'} &middot; Created {formatDate(c.created_at)}</div>
            <div style={{ color: '#cce0f5', fontStyle: 'italic', marginTop: '2px' }}>Concept: {c.data?.notes || 'A survivor, just trying to get by.'}</div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ color: '#d4cfc9' }}>
              {complication && <span><span style={{ color: '#c0392b' }}>Complication:</span> {complication} &nbsp;</span>}
              {motivation && <span><span style={{ color: '#7fc458' }}>Motivation:</span> {motivation}</span>}
            </div>
            <div style={{ color: '#EF9F27', marginTop: '2px' }}>
              {c.data?.threeWords?.some((w: string) => w) ? c.data.threeWords.filter((w: string) => w).join(' · ') : ''}
            </div>
          </div>
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
                <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: v > 0 ? '#7fc458' : '#d4cfc9' }}>{sgn(v)}</div>
                {clickable && <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>ROLL</div>}
              </div>
            )
          })}
        </div>

        {/* Live trackers */}
        {localState && (
          <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <DotTracker label="Wound Points" current={localState.wp_current} max={localState.wp_max} field="wp_current" color="#c0392b" />
                {localState.wp_current === 0 && (
                  <div style={{ marginTop: '4px' }}>
                    {localState.death_countdown != null && localState.death_countdown <= 0 ? (
                      <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>💀 Dead</div>
                    ) : (
                      <>
                        <div style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>
                          🩸 Mortally Wounded{localState.death_countdown != null ? ` — Death in ${localState.death_countdown} round${localState.death_countdown !== 1 ? 's' : ''}` : ''}
                        </div>
                        <button onClick={() => {
                          // PHY check first — success = no lasting wound, failure = roll Table 12
                          const d1 = Math.floor(Math.random() * 6) + 1
                          const d2 = Math.floor(Math.random() * 6) + 1
                          const phyMod = rapid.PHY ?? 0
                          const total = d1 + d2 + phyMod
                          if (total >= 9) {
                            alert(`Physicality Check: ${d1}+${d2}+${phyMod} = ${total} — Success! No lasting wound.`)
                          } else {
                            setLastingWoundResult(rollOnTable(LASTING_WOUNDS_TABLE))
                          }
                        }}
                          style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Lasting Wound Check
                        </button>
                        {onRoll && (
                          <button onClick={() => {
                            const amod = rapid.RSN ?? 0
                            const smod = skills.find(s => s.skillName === 'Medicine')?.level ?? 0
                            onRoll(`Stabilize ${c.name}`, amod, smod)
                          }}
                            style={{ marginLeft: '6px', padding: '4px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Stabilize
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <DotTracker label="Resilience Points" current={localState.rp_current} max={localState.rp_max} field="rp_current" color="#7ab3d4" />
                {localState.rp_current === 0 && localState.wp_current > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    💤 Incapacitated{localState.incap_rounds != null ? ` — ${localState.incap_rounds} round${localState.incap_rounds !== 1 ? 's' : ''} remaining` : ''}
                  </div>
                )}
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
                  fontSize: '13px', padding: '3px 6px', borderRadius: '3px',
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

        {/* Unarmed attack button */}
        <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '10px', marginTop: '10px' }}>
          <button onClick={onRoll ? () => {
            onRoll(`${c.name} — Unarmed Attack`, rapid.PHY ?? 0, skills.find(s => s.skillName === 'Unarmed Combat')?.level ?? 0, { weaponName: 'Unarmed', damage: '1d3', rpPercent: 100, conditionCmod: 0 })
          } : undefined}
            style={{ width: '100%', padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: onRoll ? 'pointer' : 'default', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <span>👊 Unarmed Attack</span>
            <span style={{ color: '#7ab3d4', fontWeight: 400, letterSpacing: 0 }}>
              Damage: <span style={{ color: '#c0392b', fontWeight: 700 }}>1d3{((rapid.PHY ?? 0) + (skills.find(s => s.skillName === 'Unarmed Combat')?.level ?? 0)) !== 0 ? `+${(rapid.PHY ?? 0) + (skills.find(s => s.skillName === 'Unarmed Combat')?.level ?? 0)}` : ''}</span> (PHY + Unarmed)
            </span>
          </button>
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
                <div key={label} style={{ flex: 1, minWidth: '200px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '8px 10px', display: 'flex', flexDirection: 'column' }}>
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
                      {/* Line 1: Skill, WP Damage, RP */}
                      <div style={{ display: 'flex', gap: '8px', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>Skill:</span> {w.skill}</span>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>WP Damage:</span> <span style={{ color: '#c0392b', fontWeight: 700 }}>{w.damage}</span></span>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>RP:</span> <span style={{ color: '#7ab3d4' }}>{w.rpPercent}%</span></span>
                      </div>
                      {/* Line 2: Range, Condition */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
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
                      {/* Upkeep Check button */}
                      {canEdit && cond !== 'Pristine' && (
                        <button onClick={() => {
                          if (!onRoll) return
                          // Upkeep uses Mechanic, Tinkerer, or the weapon's combat skill
                          const upkeepSkills = ['Mechanic', 'Tinkerer', w.skill]
                          const bestSkill = skills.reduce((best, s) => {
                            if (upkeepSkills.includes(s.skillName) && s.level > (best?.level ?? -99)) return s
                            return best
                          }, null as any)
                          const smod = bestSkill?.level ?? 0
                          const skillName = bestSkill?.skillName ?? 'Mechanic'
                          const skillDef = SKILLS.find(s => s.name === skillName)
                          const attrKey = skillDef?.attribute ?? 'RSN'
                          const amod = rapid[attrKey] ?? 0
                          onRoll(`Upkeep — ${w.name}`, amod, smod)
                        }}
                          style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '4px', alignSelf: 'flex-start' }}>
                          Upkeep Check
                        </button>
                      )}
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
                            {Array.from({ length: Math.max(5, weapon.reloads + 1) }).map((_, i) => (
                              <div key={i} style={{ width: '10px', height: '14px', borderRadius: '2px', background: i < weapon.reloads ? '#7fc458' : '#242424', border: `1px solid ${i < weapon.reloads ? '#7fc458' : '#3a3a3a'}`, transition: 'background 0.2s' }} />
                            ))}
                            <button disabled={!canEdit || weapon.reloads >= 5}
                              onClick={() => canEdit && weapon.reloads < 10 && setWeapon({ ...weapon, reloads: weapon.reloads + 1 })}
                              style={{ width: '14px', height: '14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && weapon.reloads < 10 ? 'pointer' : 'not-allowed', opacity: canEdit && weapon.reloads < 10 ? 1 : 0.3, fontSize: '13px', lineHeight: 1, padding: 0 }}>+</button>
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
                      {/* Attack button — pushed to bottom */}
                      <div style={{ flex: 1 }} />
                      {onRoll && (
                        <button onClick={() => {
                          const skillDef = SKILLS.find(s => s.name === w.skill)
                          const attrKey = skillDef?.attribute ?? (w.category === 'melee' ? 'PHY' : 'DEX')
                          const amod = rapid[attrKey] ?? 0
                          const skillEntry = skills.find(s => s.skillName === w.skill)
                          const smod = skillEntry?.level ?? 0
                          const condCmod = CONDITION_CMOD[cond]
                          let traitCmod = 0
                          let traitLabel = ''
                          const cumbersome = getTraitValue(w.traits, 'Cumbersome')
                          if (cumbersome !== null) { const deficit = cumbersome - (rapid.PHY ?? 0); if (deficit > 0) { traitCmod -= deficit; traitLabel = `Cumbersome -${deficit}` } }
                          const unwieldy = getTraitValue(w.traits, 'Unwieldy')
                          if (unwieldy !== null) { const deficit = unwieldy - (rapid.DEX ?? 0); if (deficit > 0) { traitCmod -= deficit; traitLabel = traitLabel ? `${traitLabel}, Unwieldy -${deficit}` : `Unwieldy -${deficit}` } }
                          onRoll(`${c.name} — Attack (${w.name})`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: (condCmod !== -99 ? condCmod : 0) + traitCmod, traitCmod, traitLabel, traits: w.traits })
                        }}
                          style={{ marginTop: '6px', width: '100%', padding: '6px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: cond === 'Broken' ? 'not-allowed' : 'pointer', opacity: cond === 'Broken' ? 0.4 : 1 }}
                          disabled={cond === 'Broken'}>
                          {cond === 'Broken' ? 'Weapon Broken' : `Attack with ${w.name}`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {/* Encumbrance tracker */}
          {(() => {
            const inv: InventoryItem[] = c.data?.inventory ?? []
            const invEnc = inv.reduce((sum: number, item: InventoryItem) => sum + item.enc * item.qty, 0)
            const hasBackpack = inv.some((i: InventoryItem) => i.name === 'Backpack' || i.name === 'Military Backpack')
            const backpackBonus = hasBackpack ? 2 : 0
            const encLimit = 6 + (rapid.PHY ?? 0) + backpackBonus
            const wp = getWeaponByName(weaponPrimary.weaponName)
            const ws = getWeaponByName(weaponSecondary.weaponName)
            const currentEnc = (wp?.enc ?? 0) + (ws?.enc ?? 0) + invEnc
            const overloaded = currentEnc > encLimit
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                <span style={{ color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.06em' }}>Encumbrance:</span>
                <span style={{ color: overloaded ? '#c0392b' : '#7fc458', fontWeight: 700 }}>{currentEnc}/{encLimit}</span>
                {overloaded && <span style={{ color: '#c0392b', fontSize: '13px' }}>OVERLOADED</span>}
              </div>
            )
          })()}

          {/* Progression Log — compact */}
          <div style={{ marginTop: '8px', padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
            <ProgressionLog
              characterId={c.id}
              log={c.data?.progression_log ?? []}
              canEdit={canEdit}
              compact={true}
              onUpdate={async (newLog) => {
                const newData = { ...latestDataRef.current, progression_log: newLog }
                latestDataRef.current = newData
                await supabase.from('characters').update({ data: newData }).eq('id', c.id)
              }}
            />
          </div>

          {/* GM Actions: Rest, Stress, Environmental Damage */}
          {canEdit && localState && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => setShowRestModal(true)}
                style={{ padding: '3px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                Rest
              </button>
              <button onClick={() => {
                if (!localState || localState.stress <= 0) { alert('Stress is already at 0.'); return }
                if (confirm('Has this character had 8+ hours of uninterrupted rest doing something they enjoy?')) {
                  const newStress = Math.max(0, localState.stress - 1)
                  onStatUpdate?.(localState.id, 'stress', newStress)
                }
              }}
                style={{ padding: '3px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                Reduce Stress
              </button>
              <button onClick={() => {
                if (!localState) return
                const type = prompt('Environmental Damage Type:\n1 = Falling (3 WP+RP per 10ft)\n2 = Drowning (3 WP + 3 RP)\n3 = Subsistence (1 RP/day)')
                if (type === '1') {
                  const ft = parseInt(prompt('How many feet fallen?') ?? '0')
                  const dmg = Math.floor(ft / 10) * 3
                  if (dmg > 0) {
                    onStatUpdate?.(localState.id, 'wp_current', Math.max(0, localState.wp_current - dmg))
                    onStatUpdate?.(localState.id, 'rp_current', Math.max(0, localState.rp_current - dmg))
                    alert(`Falling: ${dmg} WP and ${dmg} RP damage`)
                  }
                } else if (type === '2') {
                  onStatUpdate?.(localState.id, 'wp_current', Math.max(0, localState.wp_current - 3))
                  onStatUpdate?.(localState.id, 'rp_current', Math.max(0, localState.rp_current - 3))
                  alert('Drowning: 3 WP and 3 RP damage')
                } else if (type === '3') {
                  onStatUpdate?.(localState.id, 'rp_current', Math.max(0, localState.rp_current - 1))
                  alert('Subsistence: 1 RP damage')
                }
              }}
                style={{ padding: '3px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                Env. Damage
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Rest Modal */}
      {/* Inventory Panel */}
      {showInventory && (
        <InventoryPanel
          inventory={inventoryState}
          weaponPrimaryName={weaponPrimary.weaponName}
          weaponSecondaryName={weaponSecondary.weaponName}
          phyMod={rapid.PHY ?? 0}
          canEdit={canEdit}
          onUpdate={async (newInventory) => {
            // Optimistic local update first — the panel reads from this.
            setInventoryState(newInventory)
            const newData = { ...latestDataRef.current, inventory: newInventory }
            latestDataRef.current = newData
            const { error } = await supabase.from('characters').update({ data: newData }).eq('id', c.id)
            if (error) {
              console.error('[inventory] DB update failed:', error.message)
              alert(`Failed to save inventory: ${error.message}`)
              // Roll back local state on failure so UI matches DB.
              setInventoryState(c.data?.inventory ?? [])
              return
            }
            // Notify parent so entries state stays in sync across close/reopen.
            onInventoryChange?.(newInventory)
          }}
          onClose={() => setShowInventory(false)}
          otherCharacters={otherCharacters}
          onGiveTo={onGiveItem}
        />
      )}

      {showRestModal && localState && (
        <div onClick={() => setShowRestModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '320px' }}>
            <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Rest & Heal</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginBottom: '1rem' }}>How much time has passed resting?</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Hours</div>
                <input type="number" min={0} value={restHours} onChange={e => setRestHours(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Days</div>
                <input type="number" min={0} value={restDays} onChange={e => setRestDays(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>Weeks</div>
                <input type="number" min={0} value={restWeeks} onChange={e => setRestWeeks(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
            </div>
            {(() => {
              const totalHours = restHours + (restDays * 24) + (restWeeks * 168)
              const totalDays = totalHours / 24
              const wasMortal = localState.wp_current === 0 || (localState as any).death_countdown != null
              const wpHeal = wasMortal ? Math.floor(totalDays / 2) : Math.floor(totalDays)
              const rpHeal = totalHours
              return totalHours > 0 ? (
                <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif', marginBottom: '1rem', padding: '8px', background: '#242424', borderRadius: '3px' }}>
                  <div>WP healed: <span style={{ color: '#c0392b', fontWeight: 700 }}>+{wpHeal}</span> ({wasMortal ? '1 per 2 days' : '1 per day'})</div>
                  <div>RP recovered: <span style={{ color: '#7ab3d4', fontWeight: 700 }}>+{rpHeal}</span> (1 per hour)</div>
                </div>
              ) : null
            })()}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowRestModal(false)}
                style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => {
                const totalHours = restHours + (restDays * 24) + (restWeeks * 168)
                const totalDays = totalHours / 24
                const wasMortal = localState.wp_current === 0 || (localState as any).death_countdown != null
                const wpHeal = wasMortal ? Math.floor(totalDays / 2) : Math.floor(totalDays)
                const rpHeal = totalHours
                const newWP = Math.min(localState.wp_max, localState.wp_current + wpHeal)
                const newRP = Math.min(localState.rp_max, localState.rp_current + rpHeal)
                onStatUpdate?.(localState.id, 'wp_current', newWP)
                onStatUpdate?.(localState.id, 'rp_current', newRP)
                setShowRestModal(false)
                setRestHours(0); setRestDays(0); setRestWeeks(0)
              }}
                style={{ flex: 2, padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Apply Healing</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print sheet */}
      {printing && (
        <div className="print-sheet-container print-sheet-active">
          <PrintSheet state={toWizardState(c.data)} />
        </div>
      )}

      {/* Stress Check modal — triggers when stress hits 5 */}
      {stressCheckPending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '2px solid #EF9F27', borderRadius: '4px', padding: '1.5rem', width: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Stress Check</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px' }}>Stress has reached maximum</div>
            <div style={{ fontSize: '14px', color: '#d4cfc9', marginBottom: '4px' }}>Roll 2d6 + RSN ({rapid.RSN ?? 0 >= 0 ? '+' : ''}{rapid.RSN ?? 0}) + ACU ({rapid.ACU ?? 0 >= 0 ? '+' : ''}{rapid.ACU ?? 0})</div>
            <div style={{ fontSize: '13px', color: '#7fc458', marginBottom: '12px' }}>Success = drop to 4 stress. Failure = Breaking Point.</div>
            {!stressCheckResult ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Conditional Modifier</label>
                  <input type="number" value={stressCheckCmod} onChange={e => setStressCheckCmod(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') {
                      const cmodVal = parseInt(stressCheckCmod) || 0
                      const amod = (rapid.RSN ?? 0) + (rapid.ACU ?? 0)
                      const d1 = Math.floor(Math.random() * 6) + 1
                      const d2 = Math.floor(Math.random() * 6) + 1
                      const total = d1 + d2 + amod + cmodVal
                      setStressCheckResult({ die1: d1, die2: d2, amod, cmod: cmodVal, total, success: total >= 7 })
                    }}}
                    autoFocus
                    style={{ display: 'block', width: '80px', margin: '6px auto 0', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '18px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', outline: 'none' }} />
                </div>
                <button onClick={() => {
                  const cmodVal = parseInt(stressCheckCmod) || 0
                  const amod = (rapid.RSN ?? 0) + (rapid.ACU ?? 0)
                  const d1 = Math.floor(Math.random() * 6) + 1
                  const d2 = Math.floor(Math.random() * 6) + 1
                  const total = d1 + d2 + amod + cmodVal
                  setStressCheckResult({ die1: d1, die2: d2, amod, cmod: cmodVal, total, success: total >= 7 })
                }}
                  style={{ width: '100%', padding: '10px', background: '#EF9F27', border: 'none', borderRadius: '3px', color: '#1a1a1a', fontSize: '14px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Roll Stress Check</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f2ee', marginBottom: '4px' }}>
                  {stressCheckResult.die1} + {stressCheckResult.die2}
                  <span style={{ color: '#7ab3d4' }}> {stressCheckResult.amod >= 0 ? '+' : ''}{stressCheckResult.amod}</span>
                  {stressCheckResult.cmod !== 0 && <span style={{ color: '#EF9F27' }}> {stressCheckResult.cmod >= 0 ? '+' : ''}{stressCheckResult.cmod}</span>}
                  <span style={{ color: '#d4cfc9' }}> = {stressCheckResult.total}</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', color: stressCheckResult.success ? '#7fc458' : '#c0392b', marginBottom: '12px' }}>
                  {stressCheckResult.success ? 'Success — Held It Together' : 'Failure — Breaking Point'}
                </div>
                <button onClick={() => {
                  if (!localState) return
                  setStressCheckPending(false)
                  if (stressCheckResult.success) {
                    updateStat(localState.id, 'stress', 4)
                  } else {
                    updateStat(localState.id, 'stress', 5)
                    setBreakingPointPending(true)
                    setBreakingPointCmod('0')
                  }
                  setStressCheckResult(null)
                }}
                  style={{ width: '100%', padding: '10px', background: stressCheckResult.success ? '#1a2e10' : '#c0392b', border: `1px solid ${stressCheckResult.success ? '#2d5a1b' : '#c0392b'}`, borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {stressCheckResult.success ? 'Continue' : 'Roll on Breaking Point Table'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Breaking Point — CMod prompt */}
      {breakingPointPending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '2px solid #c0392b', borderRadius: '4px', padding: '1.5rem', width: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Breaking Point</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '16px' }}>You have broken</div>
            <button onClick={() => {
              if (!localState) return
              const bp = rollOnTable(BREAKING_POINT_TABLE)
              setBreakingPointResult({ ...bp, durationHours: Math.floor(Math.random() * 6) + 1 })
              setBreakingPointPending(false)
              updateStat(localState.id, 'stress', 0)
            }}
              style={{ width: '100%', padding: '10px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Roll Breaking Point</button>
          </div>
        </div>
      )}

      {/* Breaking Point result modal */}
      {breakingPointResult && (
        <div onClick={() => setBreakingPointResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '2px solid #c0392b', borderRadius: '4px', padding: '1.5rem', width: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Breaking Point</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px' }}>{breakingPointResult.result.name}</div>
            <div style={{ fontSize: '14px', color: '#d4cfc9', marginBottom: '8px' }}>Rolled: {breakingPointResult.roll}{breakingPointResult.cmod !== 0 ? ` (${breakingPointResult.cmod > 0 ? '+' : ''}${breakingPointResult.cmod} CMod = ${Math.max(2, Math.min(12, breakingPointResult.roll + breakingPointResult.cmod))})` : ''}</div>
            <div style={{ fontSize: '15px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '1.5rem', padding: '10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px' }}>{breakingPointResult.result.effect}</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '4px' }}>Stress has been reset to 0.</div>
            <div style={{ fontSize: '13px', color: '#EF9F27', marginBottom: '1rem' }}>Duration: {breakingPointResult.durationHours} hour{breakingPointResult.durationHours !== 1 ? 's' : ''}</div>
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
    borderRadius: '3px', color, fontSize: '13px',
    padding: '4px 10px', cursor: 'pointer',
    fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase',
  }
}
