'use client'
import { memo, useState, useEffect, useRef } from 'react'
import { ModalBackdrop } from '../lib/style-helpers'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'
import { insertRollLog } from '../lib/data/roll-log'
import { advance as advanceClock } from '../lib/campaign-clock'
import { computeRestRecovery } from '../lib/rest'
import { fallingDamage, drowningDamage } from '../lib/env-damage'
import { travelPushCost } from '../lib/travel'
import { getCachedAuth } from '../lib/auth-cache'
import { logEvent } from '../lib/events'
import InventoryPanel, { InventoryItem } from './InventoryPanel'
import ProgressionLog, { LogEntry, createLogEntry } from './ProgressionLog'
import { appendProgressionEntry } from '../lib/progression-log'
import CharacterEvolution from './CharacterEvolution'
import { openPopout } from '../lib/popout'
import RollModal, { type RollResult } from './RollModal'
import { getWeaponByName, conditionColor, CONDITION_CMOD, CONDITIONS, Condition, ALL_WEAPONS, MELEE_WEAPONS, RANGED_WEAPONS, EXPLOSIVE_WEAPONS, HEAVY_WEAPONS, getTraitValue } from '../lib/weapons'
import { computeEncumbrance } from '../lib/encumbrance'
import PrintSheet from './wizard/PrintSheet'
import { WizardState, createWizardState } from '../lib/xse-engine'
import { SKILLS, normalizeRations, LASTING_WOUNDS } from '../lib/xse-schema'

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

// In-memory per-entry live state, built from a `character_states` row in
// the table page's loadEntries (and patched by mid-session stat writes).
// Field types mirror the `character_states` Row in lib/database.types.ts.
// Some fields are marked optional because not every construction/spread
// site populates them (e.g. loadEntries omits infection_started_at /
// infection_infected_by / kicked - they are written via onStatUpdate, not
// read off liveState). Optionality here matches what is actually present,
// so the type does not lie about the in-memory shape.
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
  // Infection (canon: /rules/combat/infection). DB columns are typed in
  // database.types.ts; infection_state / infection_severity are free-text
  // string | null in the schema ('wound' | 'sickness', 'auto' | manual).
  infection_state?: string | null
  infection_days_left?: number | null
  infection_lasting_risk?: boolean
  infection_started_at?: string | null
  infection_infected_by?: string | null
  infection_severity?: string | null
  infection_pending_lasting_check?: boolean
  kicked?: boolean
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
  // Drives GM-only affordances on this card - currently the Cancel
  // button on the at-max Stress Check modal (players have to roll;
  // GMs can dismiss the modal during testing or to course-correct
  // mid-session).
  isGM?: boolean
  onStatUpdate?: (stateId: string, field: string, value: number | string | boolean | null) => void
  onDelete?: (id: string) => void
  onDuplicate?: (c: any) => void
  onRoll?: (label: string, amod: number, smod: number, weaponContext?: { weaponName: string; damage: string; rpPercent: number; conditionCmod: number; traitCmod?: number; traitLabel?: string; traits?: string[] }) => void
  onClose?: () => void
  onKick?: () => void
  onPlaceOnMap?: () => void
  inline?: boolean
  campaignId?: string
  otherCharacters?: { id: string; name: string }[]
  onGiveItem?: (item: InventoryItem, targetCharId: string, qty: number) => void
  // PC ↔ NPC trade - when both are passed, the InventoryPanel's "Give"
  // picker also lists NPCs as recipients (orange-themed, distinct from
  // the blue PC chips). Parents pulling from `campaignNpcs` should
  // filter out hidden_from_players for non-GM viewers.
  otherNpcs?: { id: string; name: string }[]
  onGiveItemToNpc?: (item: InventoryItem, targetNpcId: string, qty: number) => void
  // PC ↔ Community deposit - when both are passed, the give picker also
  // lists communities the PC is a member of (purple-themed). Used for
  // depositing items into the shared community stockpile.
  otherCommunities?: { id: string; name: string }[]
  onGiveItemToCommunity?: (item: InventoryItem, targetCommunityId: string, qty: number) => void
  // Phase 4F (Inventory followup) - vehicle cargo recipients. Lets the
  // PC stash items in any campaign vehicle. Parent updates
  // campaigns.vehicles[N].cargo.
  otherVehicles?: { id: string; name: string }[]
  onGiveItemToVehicle?: (item: InventoryItem, targetVehicleId: string, qty: number) => void
  onInventoryChange?: (newInventory: InventoryItem[]) => void
  onWeaponChange?: (slot: 'weaponPrimary' | 'weaponSecondary', newWeapon: any) => void
}

function CharacterCardImpl({
  character: c,
  liveState,
  canEdit = true,
  showButtons = true,
  isMySheet = true,
  isGM = false,
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
  otherNpcs,
  onGiveItemToNpc,
  otherCommunities,
  onGiveItemToCommunity,
  otherVehicles,
  onGiveItemToVehicle,
  onInventoryChange,
  onWeaponChange,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [printLiveState, setPrintLiveState] = useState<{
    relationships: { name: string; cmod: number }[]
    wounds: string[]
    progressionLog: { date: string; type: string; text: string }[]
  } | null>(null)
  // Phase 4F (Modal Unification) - Stress Check, Breaking Point, and
  // Lasting Wound all migrated from bespoke inline JSX to the shared
  // <RollModal> shell. The state shape now mirrors the canonical
  // Attack Roll modal: `pending` controls visibility, `cmod` is a
  // numeric input, `result` is a RollResult-shaped object set after
  // the roll fires. Cascade is preserved (Stress Check failure auto-
  // opens Breaking Point on close).
  const [stressCheckPending, setStressCheckPending] = useState(false)
  const [stressCheckCmod, setStressCheckCmod] = useState<number>(0)
  const [stressCheckResult, setStressCheckResult] = useState<RollResult | null>(null)
  // Two distinct flows share the same modal shell:
  //   - 'mid-play':  GM-called stress check during play. Roll, success = no
  //                  change, failure = +1 stress (cap 5). If +1 brings the
  //                  bar to 5, cascade into 'at-max' immediately.
  //   - 'at-max':    Auto-fires when stress hits 5 (watcher at L227-240) or
  //                  via cascade from mid-play. Success = drop to 4. Failure
  //                  = Breaking Point (Table 13).
  // Mode resets to 'at-max' after every close so the watcher's auto-open
  // path always lands in at-max semantics.
  const [stressCheckMode, setStressCheckMode] = useState<'mid-play' | 'at-max'>('at-max')
  const [breakingPointPending, setBreakingPointPending] = useState(false)
  const [breakingPointCmod, setBreakingPointCmod] = useState<number>(0)
  // Breaking Point + Lasting Wound now carry the table-lookup result
  // alongside the dice in the RollResult shape so the shared shell
  // can render dice + the custom outcome card via renderOutcome.
  const [breakingPointResult, setBreakingPointResult] = useState<(RollResult & { table_name: string; table_effect: string; durationHours: number }) | null>(null)
  const [lastingWoundPending, setLastingWoundPending] = useState(false)
  const [lastingWoundCmod, setLastingWoundCmod] = useState<number>(0)
  const [lastingWoundResult, setLastingWoundResult] = useState<(RollResult & { table_name: string; table_effect: string }) | null>(null)
  const [showRestModal, setShowRestModal] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [showEvolution, setShowEvolution] = useState(false)
  const [restHours, setRestHours] = useState(0)
  const [restDays, setRestDays] = useState(0)
  const [restWeeks, setRestWeeks] = useState(0)
  // Stress Cooling Off (canon /rules/combat/stress #cooling-off): -1 Stress
  // per 8 uninterrupted in-game hours free from threat while doing something
  // the character enjoys. GM judgement - this toggle affirms the rest met
  // those gates. Default ON (the common case); GM flips it OFF if combat /
  // threat / un-enjoyable labour interrupted the window.
  const [restRestful, setRestRestful] = useState(true)

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
    // DB write returns - otherwise the combat action bar's Attack button,
    // which reads `entries[i].character.data.weaponPrimary`, keeps showing
    // the old weapon until the next loadEntries. Same pattern as
    // onInventoryChange added for the + From Catalog bug.
    onWeaponChange?.(slot, data)
    await supabase.from('characters').update({ data: { ...latestDataRef.current, [slot]: data } }).eq('id', c.id)
  }

  function changeWeapon(slot: 'weaponPrimary' | 'weaponSecondary', weaponName: string) {
    const w = getWeaponByName(weaponName)
    // Thrown explosives (grenade/molotov) are consumables - seed a carry
    // quantity so the sheet tracks how many the PC has.
    const newData = { weaponName, condition: 'Used' as Condition, ammoCurrent: w?.clip ?? 0, ammoMax: w?.clip ?? 0, reloads: w?.ammo ? Math.floor(Math.random() * 3) + 1 : 0, ...(w?.category === 'explosive' ? { qty: 1 } : {}) }
    saveWeapon(slot, newData)
  }

  // Local optimistic state - mirrors liveState, updates instantly on click
  const [localState, setLocalState] = useState<LiveState | null>(liveState ?? null)

  // Sync when liveState changes from outside (Realtime updates)
  const prevStressRef = useRef(-1)
  useEffect(() => {
    if (liveState) {
      const prevStress = prevStressRef.current
      prevStressRef.current = liveState.stress
      setLocalState(liveState)
      // Trigger Stress Check when stress reaches 5 on whichever screen has the sheet open
      // prevStress === -1 means first mount - also trigger if stress is already at 5
      if (liveState.stress >= 5 && prevStress < 5 && !stressCheckPending && !breakingPointPending) {
        setStressCheckPending(true)
        setStressCheckCmod(0)
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
      primaryQty: data.weaponPrimary?.qty ?? 1,
      secondaryQty: data.weaponSecondary?.qty ?? 1,
      equipment: data.equipment?.[0] ?? '',
      incidentalItem: data.incidentalItem ?? '',
      rations: normalizeRations(data.rations).type,
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
    const { user } = await getCachedAuth()
    if (user) await supabase.from('characters').insert({ user_id: user.id, name: `Copy of ${c.name}`, data: c.data })
    setDuplicating(false)
    router.refresh()
  }

  async function handlePrint() {
    // Gather live data so the print sheet reflects current relationships,
    // lasting wounds, and tracker pip counts. Wizard print paths
    // (characters/new, /quick, /[id]/edit) skip this and stay blank-form.
    let relationships: { name: string; cmod: number }[] = []
    try {
      const { data: rels } = await supabase
        .from('npc_relationships')
        .select('relationship_cmod, npc:campaign_npcs!inner(name)')
        .eq('character_id', c.id)
        .order('relationship_cmod', { ascending: false })
      relationships = (rels ?? []).map((r: any) => ({
        name: r.npc?.name ?? '?',
        cmod: r.relationship_cmod ?? 0,
      }))
    } catch (err) {
      console.error('[print] relationships fetch failed:', err)
    }
    // Wounds live in characters.data.progression_log entries with type='wound'.
    // The full log itself ships through too - printed at the bottom so a
    // player who prints months later still has the journey-marker record.
    const log: Array<{ date: string; type: string; text: string }> = Array.isArray((c.data as any)?.progression_log)
      ? (c.data as any).progression_log
      : []
    const wounds = log
      .filter(e => e.type === 'wound')
      .map(e => e.text.replace(/^🩸 Lasting Wound:\s*/, '').replace(/\.$/, ''))
    setPrintLiveState({
      relationships,
      wounds,
      progressionLog: log,
    })
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
      setPrintLiveState(null)
    }, 100)
  }

  // Optimistic update: update local state immediately, fire Supabase in background
  function updateStat(stateId: string, field: string, value: number) {
    if (!onStatUpdate || !localState) return
    setLocalState(prev => prev ? { ...prev, [field]: value } : prev)
    onStatUpdate(stateId, field, value) // fire and forget - no await
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
          <span style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif' }}>{label}</span>
          <span style={{ fontSize: '13px', color, fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>{current} / {max}</span>
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
        <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '3px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
          <button disabled={!canEdit || value <= 0}
            onClick={() => canEdit && value > 0 && localState && updateStat(localState.id, field, value - 1)}
            style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && value > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && value > 0 ? 1 : 0.3, fontSize: '13px', lineHeight: 1, padding: 0 }}>-</button>
          <span style={{ fontSize: '16px', fontWeight: 700, color, fontFamily: 'Carlito, sans-serif', minWidth: '20px', textAlign: 'center' }}>{value}</span>
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
            <a href={`/characters/${c.id}`} style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', textDecoration: 'none', display: 'block' }}>
              {c.name}
            </a>
          </div>
          {showButtons && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Button order is locked per Xero (2026-05-09):
                    Edit > Inventory > Apprentice > Reduce Stress >
                    Env. Damage > Rest > Evolution > Duplicate >
                    Print > Delete. Map / Popout / Kick / Close are
                    conditional and live at the edges (Map first if
                    present; Popout / Kick / Close after Delete). */}
              {onPlaceOnMap && <button onClick={onPlaceOnMap} style={btn('#2a2010', '#EF9F27')}>Map</button>}
              <button onClick={() => router.push(`/characters/${c.id}/edit`)} style={btn('#c0392b', '#f5a89a')}>Edit</button>
              <button onClick={() => setShowInventory(true)} style={btn('#2a2010', '#EF9F27')}>Inventory</button>
              {/* Apprentice placeholder - unwired for now. Will surface
                  the PC's Apprentice NPC card when clicked once the
                  picker/display is built. Matches Inventory styling
                  (green community-palette) so it reads as a paired
                  bond surface. */}
              <button onClick={() => alert('Apprentice view coming soon - check the Community roster for NPCs tagged ⇐ this PC.')} style={btn('#1a2e10', '#7fc458')}>Apprentice</button>
              {/* GM-action trio (Reduce Stress / Env. Damage / Rest)
                  is gated on canEdit + localState because they only
                  make sense in a campaign session. */}
              {canEdit && localState && (
                <>
                  <button onClick={() => {
                    if (!localState || localState.stress <= 0) { alert('Stress is already at 0.'); return }
                    if (confirm('Has this character had 8+ hours of uninterrupted rest doing something they enjoy?')) {
                      const newStress = Math.max(0, localState.stress - 1)
                      onStatUpdate?.(localState.id, 'stress', newStress)
                    }
                  }} style={btn('#3a3a3a', '#EF9F27')}>Reduce Stress</button>
                  <button onClick={() => {
                    if (!localState) return
                    const type = prompt('Environmental Damage Type:\n1 = Falling (3 WP+RP per 10ft)\n2 = Drowning (3 WP + 3 RP per round underwater)\n3 = Subsistence (1 WP + 1 RP/day, day 2+)')
                    if (type === '1') {
                      const ft = parseInt(prompt('How many feet fallen?') ?? '0', 10)
                      const dmg = Math.floor(ft / 10) * 3
                      if (dmg > 0) {
                        onStatUpdate?.(localState.id, 'wp_current', Math.max(0, localState.wp_current - dmg))
                        onStatUpdate?.(localState.id, 'rp_current', Math.max(0, localState.rp_current - dmg))
                        alert(`Falling: ${dmg} WP and ${dmg} RP damage`)
                      }
                    } else if (type === '2') {
                      const rounds = parseInt(prompt('How many rounds underwater (after held breath)?') ?? '0', 10)
                      const dmg = Math.max(0, rounds) * 3
                      if (dmg > 0) {
                        onStatUpdate?.(localState.id, 'wp_current', Math.max(0, localState.wp_current - dmg))
                        onStatUpdate?.(localState.id, 'rp_current', Math.max(0, localState.rp_current - dmg))
                        alert(`Drowning: ${dmg} WP and ${dmg} RP damage (${rounds} round${rounds === 1 ? '' : 's'} × 3)`)
                      }
                    } else if (type === '3') {
                      const days = parseInt(prompt('How many days without food/water? (Day 1 is free.)') ?? '0', 10)
                      const dmgDays = Math.max(0, days - 1)
                      if (dmgDays > 0) {
                        onStatUpdate?.(localState.id, 'wp_current', Math.max(0, localState.wp_current - dmgDays))
                        onStatUpdate?.(localState.id, 'rp_current', Math.max(0, localState.rp_current - dmgDays))
                        alert(`Subsistence: ${dmgDays} WP and ${dmgDays} RP damage (${days} day${days === 1 ? '' : 's'} - 1 free = ${dmgDays})`)
                      } else {
                        alert(`No damage - day 1 is free.`)
                      }
                    }
                  }} style={btn('#c0392b', '#f5a89a')}>Env. Damage</button>
                  {/* Infection - single button that does the right thing
                      based on current state (no nested dropdown). When
                      infection_state is null, prompts for which check to
                      roll (Wound vs. Sickness Progression) and routes
                      through onRoll. When already sick, prompts for Tick
                      Day or Resolve. See /rules/combat/infection. */}
                  <button onClick={() => {
                    if (!localState) return
                    const ls = localState
                    const phyAmod = c.data?.rapid?.PHY ?? 0
                    if (ls.infection_state) {
                      const days = ls.infection_days_left ?? 0
                      const choice = prompt(
                        `Currently sick (${ls.infection_state}, ${days} day${days === 1 ? '' : 's'} left).\n\n` +
                        `1 = Tick Day (-1 day)\n` +
                        `2 = Resolve / Clear (treat as Day 0 reached)\n` +
                        `3 = Treat with Medicine* (medic rolls separately - not yet wired here)`,
                      )
                      if (choice === '1' || choice === '2') {
                        const newDays = choice === '2' ? 0 : Math.max(0, days - 1)
                        onStatUpdate?.(localState.id, 'infection_days_left', newDays as any)
                        if (newDays === 0) {
                          // Day-0 resolution: fire Lasting Damage roll if
                          // risk is set; sickness branch also drops to mortal.
                          if (ls.infection_lasting_risk && onRoll) {
                            onRoll(`${c.name} - Infection Lasting-Damage Check`, phyAmod, 0)
                          }
                          if (ls.infection_state === 'sickness' && onStatUpdate) {
                            const dc = Math.max(1, 4 + phyAmod)
                            onStatUpdate(localState.id, 'wp_current', 0)
                            onStatUpdate(localState.id, 'death_countdown', dc as any)
                            alert(`${c.name} has progressed to Mortally Wounded. Death countdown: ${dc} rounds.`)
                          }
                          // Clear infection state regardless.
                          onStatUpdate?.(localState.id, 'infection_state', null as any)
                          onStatUpdate?.(localState.id, 'infection_lasting_risk', false as any)
                          onStatUpdate?.(localState.id, 'infection_started_at', null as any)
                          onStatUpdate?.(localState.id, 'infection_infected_by', null as any)
                        }
                      }
                    } else {
                      const choice = prompt(
                        `Roll Infection check:\n\n` +
                        `1 = Wound Infection (post-combat: shot/stab/cut)\n` +
                        `2 = Sickness Progression (environmental: corpse pit etc.)`,
                      )
                      if (choice === '1' || choice === '2') {
                        const kind = choice === '1' ? 'Wound' : 'Sickness'
                        const source = prompt(
                          `Source / cause? (free text - e.g. "Frankie's Sword", "Corpse pit", "Sewer wade")`,
                          '',
                        )?.trim() || ''
                        if (source) onStatUpdate?.(localState.id, 'infection_infected_by', source as any)
                        if (onRoll) onRoll(`${c.name} - Infection Check (${kind})`, phyAmod, 0)
                      }
                    }
                  }} style={btn('#5a2e5a', '#d48bd4')} title="Roll Infection / progress sick state">Infection</button>
                  <button onClick={async () => {
                    // Env damage picker - GM picks Falling or Drowning, prompts for the
                    // amount, applies WP+RP damage with the standard mortal-wound auto-fill.
                    // Subsistence is NOT here - it auto-drains via the campaign-clock tick.
                    if (!localState) return
                    const kind = prompt('Apply environmental damage:\n\n1 = Falling (3 WP+RP per 10 ft)\n2 = Drowning (3 WP+RP per round past hold-breath window: 6 + PHY AMod)')?.trim()
                    if (kind !== '1' && kind !== '2') return
                    let dmg = { wp: 0, rp: 0 }
                    let label = ''
                    let damageJson: Record<string, unknown> = { characterId: c.id }
                    if (kind === '1') {
                      const ft = parseInt(prompt('How many feet fallen?', '10') ?? '', 10)
                      if (!Number.isFinite(ft) || ft <= 0) return
                      dmg = fallingDamage(ft)
                      label = `${c.name} fell ${ft} ft (-${dmg.wp} WP, -${dmg.rp} RP)`
                      damageJson = { ...damageJson, feetFallen: ft, wpDealt: dmg.wp, rpDealt: dmg.rp }
                    } else {
                      const rounds = parseInt(prompt('How many rounds submerged?', '7') ?? '', 10)
                      if (!Number.isFinite(rounds) || rounds < 0) return
                      const phyAmod = c.data?.rapid?.PHY ?? 0
                      dmg = drowningDamage(phyAmod, rounds)
                      label = dmg.wp === 0
                        ? `${c.name} held breath ${rounds} rounds (within ${6 + phyAmod}-round window; no damage)`
                        : `${c.name} drowning - ${rounds} rounds submerged (-${dmg.wp} WP, -${dmg.rp} RP)`
                      damageJson = { ...damageJson, submergedRounds: rounds, phyAmod, wpDealt: dmg.wp, rpDealt: dmg.rp }
                    }
                    const newWP = Math.max(0, localState.wp_current - dmg.wp)
                    const newRP = Math.max(0, localState.rp_current - dmg.rp)
                    onStatUpdate?.(localState.id, 'wp_current', newWP)
                    onStatUpdate?.(localState.id, 'rp_current', newRP)
                    if (campaignIdProp) {
                      try {
                        const { user } = await getCachedAuth()
                        if (user) {
                          await insertRollLog({
                            campaign_id: campaignIdProp, user_id: user.id, character_name: c.name,
                            label, die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
                            outcome: kind === '1' ? 'falling' : 'drowning',
                            damage_json: damageJson,
                          })
                        }
                      } catch (e) {
                        console.error('[env-damage] log insert failed:', e)
                      }
                    }
                  }} style={btn('#3a2a10', '#d4a87f')} title="Apply Falling or Drowning damage (Subsistence auto-drains via clock)">Env Dmg</button>
                  <button onClick={async () => {
                    // Travel push - GM enters total hours traveled; if > 8 the
                    // character loses 1 RP per push-hour, the campaign clock
                    // advances by those hours, and a tagged feed row writes.
                    // Per-PC like Rest; the GM clicks per character after a haul.
                    if (!localState) return
                    const hoursStr = prompt('How many hours of contiguous travel?\n\n(8h = no cost; each hour past 8 drains 1 RP)', '8')?.trim()
                    if (!hoursStr) return
                    const hours = parseInt(hoursStr, 10)
                    if (!Number.isFinite(hours) || hours <= 0) return
                    const cost = travelPushCost(hours)
                    const newRP = Math.max(0, localState.rp_current - cost.rp)
                    onStatUpdate?.(localState.id, 'rp_current', newRP)
                    if (campaignIdProp) {
                      try {
                        await advanceClock(campaignIdProp, hours)
                        const { user } = await getCachedAuth()
                        if (user) {
                          const label = cost.rp === 0
                            ? `${c.name} traveled ${hours} hours (within the 8h soft cap; no RP cost)`
                            : `${c.name} pushed travel ${hours} hours (-${cost.rp} RP for ${cost.pushHours} hour${cost.pushHours === 1 ? '' : 's'} past the 8h cap)`
                          await insertRollLog({
                            campaign_id: campaignIdProp, user_id: user.id, character_name: c.name,
                            label, die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
                            outcome: 'travel',
                            damage_json: { characterId: c.id, hours, pushHours: cost.pushHours, rpDealt: cost.rp },
                          })
                        }
                      } catch (e) {
                        console.error('[travel] clock advance / log insert failed:', e)
                      }
                    }
                  }} style={btn('#10283a', '#7fb3d4')} title="Apply travel hours (push past 8h costs RP; advances the clock)">Travel</button>
                  <button onClick={() => setShowRestModal(true)} style={btn('#2d5a1b', '#7fc458')}>Rest</button>
                </>
              )}
              {/* Evolution - opens the Character Evolution / CDP
                  Calculator (spend CDP on RAPID raises, skill raises
                  + new-skill learns; SRD-canonical costs; Lv 4 needs
                  a Fill-In-The-Gaps narrative). Disabled when there's
                  no campaign-scoped state row to deduct CDP from
                  (e.g. browsing your own character outside a session).
                  Purple to read as a "growth" surface. */}
              <button onClick={() => setShowEvolution(true)} disabled={!localState}
                title={!localState ? 'Open Evolution from inside a campaign session - your CDP balance lives there.' : 'Spend CDP on RAPID + skill raises'}
                style={{ ...btn('#2a1a3e', '#c4a7f0'), opacity: localState ? 1 : 0.5, cursor: localState ? 'pointer' : 'not-allowed' }}>Evolution</button>
              {!inline && <button onClick={handleDuplicate} disabled={duplicating} style={btn('#1a3a5c', '#7ab3d4')}>{duplicating ? '...' : 'Duplicate'}</button>}
              <button onClick={handlePrint} disabled={printing} style={btn('#2d5a1b', '#7fc458')}>Print</button>
              {!inline && <button onClick={handleDelete} disabled={deleting} style={btn('#2e2e2e', '#d4cfc9')}>{deleting ? '...' : 'Delete'}</button>}
              {campaignIdProp && (
                <button onClick={() => openPopout(`/character-sheet?c=${campaignIdProp}&char=${c.id}`, `char-${c.id}`, { w: 800, h: 800 })} title="Pop out" style={btn('#2a102a', '#d48bd4')}>Popout</button>
              )}
              {inline && onKick && <button onClick={onKick} style={btn('#7a1f16', '#f5a89a')}>Kick</button>}
              {inline && onClose && <button onClick={onClose} style={btn('#c0392b', '#f5a89a')}>Close</button>}
            </div>
          )}
        </div>
        {/* Concept/Complication/Motivation/Words - two aligned rows */}
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
                <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.06em', fontFamily: 'Carlito, sans-serif' }}>{k}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: v > 0 ? '#7fc458' : '#d4cfc9' }}>{sgn(v)}</div>
                {clickable && <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>ROLL</div>}
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
                      <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>💀 Dead</div>
                    ) : (
                      <>
                        <div style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>
                          🩸 Mortally Wounded{localState.death_countdown != null ? ` - Death in ${localState.death_countdown} round${localState.death_countdown !== 1 ? 's' : ''}` : ''}
                        </div>
                        <button onClick={() => {
                          // PHY check first - success = no lasting wound,
                          // failure = open the unified Lasting Wound roll
                          // modal so the player can input a CMod (rare;
                          // specific traits/conditions might apply one).
                          const d1 = Math.floor(Math.random() * 6) + 1
                          const d2 = Math.floor(Math.random() * 6) + 1
                          const phyMod = rapid.PHY ?? 0
                          const total = d1 + d2 + phyMod
                          if (total >= 9) {
                            alert(`Physicality Check: ${d1}+${d2}+${phyMod} = ${total} - Success! No lasting wound.`)
                          } else {
                            setLastingWoundCmod(0)
                            setLastingWoundPending(true)
                          }
                        }}
                          style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Lasting Wound Check
                        </button>
                        {/* Stabilize button removed 2026-05-20: it was
                            using the patient's own RSN/Medicine as the
                            medic's amod/smod (a long-standing latent bug -
                            Stabilize is canon "medic stabilizes downed
                            ally", never self). The in-combat dropdown
                            (🩸 STABILIZE on the active combatant's row,
                            table/page.tsx L8060+) is now the only entry
                            point and correctly uses the medic's stats.
                            Follow-up: design a post-combat stabilize
                            surface if there's playtest demand - currently
                            mortally-wounded survivors are stabilized in
                            combat or die during the death_countdown. */}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <DotTracker label="Resilience Points" current={localState.rp_current} max={localState.rp_max} field="rp_current" color="#7ab3d4" />
                {localState.rp_current === 0 && localState.wp_current > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    💤 Incapacitated{localState.incap_rounds != null ? ` - ${localState.incap_rounds} round${localState.incap_rounds !== 1 ? 's' : ''} remaining` : ''}
                  </div>
                )}
              </div>
            </div>
            {/* Lasting Wounds (Table 12). One red chip per wound name
                stored on characters.data.lastingWounds; tooltip carries
                the canon effect from LASTING_WOUNDS. Written by the
                table page's Lasting Damage executeRoll branch on a
                failed Lasting Damage Check post-infection or
                post-wound. Hidden when none. */}
            {Array.isArray((c.data as any)?.lastingWounds) && ((c.data as any).lastingWounds as string[]).length > 0 && (
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '8px' }}>
                {((c.data as any).lastingWounds as string[]).map((name, i) => {
                  const def = Object.values(LASTING_WOUNDS).find(w => w.name === name)
                  const effect = def?.effect ?? ''
                  return (
                    <span key={i}
                      title={effect ? `${name} - ${effect}` : name}
                      style={{ fontSize: '13px', padding: '1px 6px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      🩸 {name}{effect ? ` (${effect})` : ''}
                    </span>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'space-around' }}>
              {/* Stress bar with Breaking Point trigger */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif' }}>Stress</span>
                  {/* Manual Stress Check: GM-called mid-play. Opens the
                      dedicated modal in 'mid-play' mode (success = no
                      change, failure = +1 stress, cascades to 'at-max'
                      if +1 fills the bar). Bypasses onRoll because that
                      path would lose the cascade. Always rollable (no
                      stress-level gate) - players are commanded to
                      check at the GM's discretion regardless of
                      current pip count. */}
                  <button onClick={() => {
                    if (stressCheckPending || breakingPointPending) return
                    setStressCheckMode('mid-play')
                    setStressCheckCmod(0)
                    setStressCheckResult(null)
                    setStressCheckPending(true)
                  }}
                    style={{ padding: '1px 6px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '2px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Check</button>
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
              {/* Insight bar - 10 blocks */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '3px' }}>Insight</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                  <button disabled={!canEdit || localState.insight_dice <= 0}
                    onClick={() => canEdit && localState.insight_dice > 0 && updateStat(localState.id, 'insight_dice', localState.insight_dice - 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit && localState.insight_dice > 0 ? 'pointer' : 'not-allowed', opacity: canEdit && localState.insight_dice > 0 ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>-</button>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} style={{ width: '10px', height: '16px', borderRadius: '2px', background: i < localState.insight_dice ? '#7fc458' : '#242424', border: `1px solid ${i < localState.insight_dice ? '#7fc458' : '#3a3a3a'}`, transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <button disabled={!canEdit}
                    onClick={() => canEdit && updateStat(localState.id, 'insight_dice', localState.insight_dice + 1)}
                    style={{ width: '16px', height: '16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.3, fontSize: '14px', lineHeight: 1, padding: 0 }}>+</button>
                </div>
              </div>
              {/* CDP bar - 10 blocks */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '3px' }}>CDP</div>
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
              {/* Morality bar - 7 blocks */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '3px' }}>Morality</div>
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
            const description = SKILLS.find(d => d.name === s.skillName)?.description ?? ''
            return (
              <span key={s.skillName}
                title={description}
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
            onRoll(`${c.name} - Unarmed Attack`, rapid.PHY ?? 0, skills.find(s => s.skillName === 'Unarmed Combat')?.level ?? 0, { weaponName: 'Unarmed', damage: '1d3', rpPercent: 100, conditionCmod: 0 })
          } : undefined}
            style={{ width: '100%', padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: onRoll ? 'pointer' : 'default', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
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
                  {/* Weapon selector - inline with label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', flexShrink: 0 }}>{label}</span>
                    <select value={weapon.weaponName} onChange={e => changeWeapon(slot, e.target.value)} disabled={!canEdit}
                      style={{ flex: 1, padding: '4px 6px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', appearance: 'none', cursor: canEdit ? 'pointer' : 'default' }}>
                      <option value="">- None -</option>
                      <optgroup label="Melee">{MELEE_WEAPONS.map(mw => <option key={mw.name} value={mw.name}>{mw.name}</option>)}</optgroup>
                      <optgroup label="Ranged">{RANGED_WEAPONS.map(rw => <option key={rw.name} value={rw.name}>{rw.name}</option>)}</optgroup>
                      <optgroup label="Explosive">{EXPLOSIVE_WEAPONS.map(ew => <option key={ew.name} value={ew.name}>{ew.name}</option>)}</optgroup>
                      <optgroup label="Heavy">{HEAVY_WEAPONS.map(hw => <option key={hw.name} value={hw.name}>{hw.name}</option>)}</optgroup>
                    </select>
                  </div>
                  {w && (
                    <>
                      {/* Line 1: Skill, WP Damage, RP */}
                      <div style={{ display: 'flex', gap: '8px', fontSize: '15px', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>Skill:</span> {w.skill}</span>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>WP Damage:</span> <span style={{ color: '#c0392b', fontWeight: 700 }}>{w.damage}</span></span>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>RP:</span> <span style={{ color: '#7ab3d4' }}>{w.rpPercent}%</span></span>
                        {w.category === 'explosive' && <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>Qty:</span> <span style={{ color: '#EF9F27', fontWeight: 700 }}>×{(weapon as any).qty ?? 1}</span></span>}
                      </div>
                      {/* Line 2: Range, Condition */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
                        <span style={{ color: '#d4cfc9' }}><span style={{ color: '#cce0f5' }}>Range:</span> {w.range}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <span style={{ color: '#cce0f5' }}>Condition:</span>
                          <select value={cond} onChange={e => setWeapon({ ...weapon, condition: e.target.value })} disabled={!canEdit}
                            style={{ padding: '2px 4px', background: '#1a1a1a', border: `1px solid ${conditionColor(cond)}`, borderRadius: '3px', color: conditionColor(cond), fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none', cursor: canEdit ? 'pointer' : 'default', width: '110px' }}>
                            {CONDITIONS.map(co => <option key={co} value={co}>{co} ({CONDITION_CMOD[co] > 0 ? '+' : ''}{CONDITION_CMOD[co]})</option>)}
                          </select>
                        </span>
                      </div>
                      {/* Carry quantity stepper for thrown explosives. */}
                      {w.category === 'explosive' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Quantity</span>
                          <button onClick={() => canEdit && setWeapon({ ...weapon, qty: Math.max(1, ((weapon as any).qty ?? 1) - 1) })} disabled={!canEdit}
                            style={{ padding: '2px 9px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', cursor: canEdit ? 'pointer' : 'default' }}>−</button>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', minWidth: '20px', textAlign: 'center', fontFamily: 'Carlito, sans-serif' }}>{(weapon as any).qty ?? 1}</span>
                          <button onClick={() => canEdit && setWeapon({ ...weapon, qty: ((weapon as any).qty ?? 1) + 1 })} disabled={!canEdit}
                            style={{ padding: '2px 9px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', cursor: canEdit ? 'pointer' : 'default' }}>+</button>
                        </div>
                      )}
                      {/* Upkeep Check + Unequip - weapon admin row */}
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                          {cond !== 'Pristine' && (
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
                              onRoll(`Upkeep - ${w.name}`, amod, smod)
                            }}
                              style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                              Upkeep Check
                            </button>
                          )}
                          <button onClick={() => changeWeapon(slot, '')}
                            title="Clear this weapon slot"
                            style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Unequip
                          </button>
                        </div>
                      )}
                      {/* Ammo pips + reload on one line */}
                      {w.clip && w.clip > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', flexShrink: 0 }}>Ammo</span>
                          <div style={{ display: 'flex', gap: '1px', flexWrap: 'wrap' }}>
                            {Array.from({ length: w.clip }).map((_, i) => (
                              <div key={i}
                                onClick={() => { if (!canEdit) return; const newAmmo = i < weapon.ammoCurrent ? i : i + 1; setWeapon({ ...weapon, ammoCurrent: newAmmo }) }}
                                style={{ width: '8px', height: '12px', borderRadius: '1px', background: i < weapon.ammoCurrent ? '#EF9F27' : '#242424', border: `1px solid ${i < weapon.ammoCurrent ? '#EF9F27' : '#3a3a3a'}`, cursor: canEdit ? 'pointer' : 'default', transition: 'background 0.1s' }} />
                            ))}
                          </div>
                          <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', fontWeight: 700, flexShrink: 0 }}>{weapon.ammoCurrent}/{w.clip}</span>
                          <button onClick={() => { if (!canEdit || weapon.reloads <= 0) return; setWeapon({ ...weapon, ammoCurrent: w.clip, reloads: weapon.reloads - 1 }) }}
                            disabled={!canEdit || weapon.reloads <= 0}
                            style={{ padding: '2px 8px', background: weapon.reloads > 0 ? '#1a2e10' : '#2a1210', border: `1px solid ${weapon.reloads > 0 ? '#2d5a1b' : '#c0392b'}`, borderRadius: '3px', color: weapon.reloads > 0 ? '#7fc458' : '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: canEdit && weapon.reloads > 0 ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.5 }}>
                            Reload
                          </button>
                          {/* Reload tracker - 5 pips */}
                          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', flexShrink: 0 }}>Clips</span>
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
                          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', flexShrink: 0 }}>Traits:</span>
                          {w.traits.map(t => (
                            <span key={t} style={{ fontSize: '13px', padding: '0 4px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>{t}</span>
                          ))}
                        </div>
                      )}
                      {/* Attack button - pushed to bottom */}
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
                          onRoll(`${c.name} - Attack (${w.name})`, amod, smod, { weaponName: w.name, damage: w.damage, rpPercent: w.rpPercent, conditionCmod: (condCmod !== -99 ? condCmod : 0) + traitCmod, traitCmod, traitLabel, traits: w.traits })
                        }}
                          style={{ marginTop: '6px', width: '100%', padding: '6px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: cond === 'Broken' ? 'not-allowed' : 'pointer', opacity: cond === 'Broken' ? 0.4 : 1 }}
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
            const { currentEnc, encLimit, overloaded } =
              computeEncumbrance(inv, weaponPrimary.weaponName, weaponSecondary.weaponName, rapid.PHY ?? 0)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
                <span style={{ color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.06em' }}>Encumbrance:</span>
                <span style={{ color: overloaded ? '#c0392b' : '#7fc458', fontWeight: 700 }}>{currentEnc}/{encLimit}</span>
                {overloaded && <span style={{ color: '#c0392b', fontSize: '13px' }}>OVERLOADED</span>}
              </div>
            )
          })()}

          {/* Progression Log - compact */}
          <div id={`progression-${c.id}`} style={{ marginTop: '8px', padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', scrollMarginTop: '12px' }}>
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
            // Optimistic local update first - the panel reads from this.
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
          otherNpcs={otherNpcs}
          onGiveToNpc={onGiveItemToNpc}
          otherCommunities={otherCommunities}
          onGiveToCommunity={onGiveItemToCommunity}
          otherVehicles={otherVehicles}
          onGiveToVehicle={onGiveItemToVehicle}
          onRemoveItem={campaignIdProp ? async (item, newQty) => {
            const { user } = await getCachedAuth()
            if (!user) return
            const label = newQty === 0
              ? `${c.name} used their last ${item.name}`
              : `${c.name} used ${item.name} (${newQty} remaining)`
            await insertRollLog({
              campaign_id: campaignIdProp,
              user_id: user.id,
              character_name: c.name,
              label,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
              outcome: 'item_consumed',
              damage_json: { characterId: c.id, itemName: item.name, newQty },
            })
          } : undefined}
        />
      )}

      {showRestModal && localState && (
        <ModalBackdrop onClose={() => setShowRestModal(false)} zIndex={10001} opacity={0.9} padding="1rem">
          <div style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '320px' }}>
            <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>Rest & Heal</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem' }}>How much time has passed resting?</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Hours</div>
                <input type="number" min={0} value={restHours} onChange={e => setRestHours(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Days</div>
                <input type="number" min={0} value={restDays} onChange={e => setRestDays(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '2px' }}>Weeks</div>
                <input type="number" min={0} value={restWeeks} onChange={e => setRestWeeks(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
            </div>
            {/* Cooling-Off gate - only relevant at 8h+ (canon minimum per pip). */}
            {(() => {
              const totalHours = restHours + (restDays * 24) + (restWeeks * 168)
              return totalHours >= 8 ? (
                <button onClick={() => setRestRestful(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '1rem', padding: '8px', background: '#242424', border: `1px solid ${restRestful ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: '14px', color: restRestful ? '#7fc458' : '#888' }}>{restRestful ? '☑' : '☐'}</span>
                  <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>Uninterrupted &amp; enjoyable (free from threat) - enables Stress cooling off</span>
                </button>
              ) : null
            })()}
            {(() => {
              const totalHours = restHours + (restDays * 24) + (restWeeks * 168)
              const r = computeRestRecovery(localState, totalHours, restRestful)
              const rpCap = r.isSick ? Math.floor(localState.rp_max / 2) : localState.rp_max
              return totalHours > 0 ? (
                <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem', padding: '8px', background: '#242424', borderRadius: '3px' }}>
                  <div>WP healed: <span style={{ color: '#c0392b', fontWeight: 700 }}>+{r.wpHeal}</span> ({r.wasMortal ? '1 per 2 days' : '1 per day'})</div>
                  <div>RP recovered: <span style={{ color: '#7ab3d4', fontWeight: 700 }}>+{r.rpGain}</span> (1 per hour{r.isSick ? `, sick cap ${rpCap}` : ''})</div>
                  {r.stressDrop > 0 && <div>Stress reduced: <span style={{ color: '#EF9F27', fontWeight: 700 }}>-{r.stressDrop}</span> (1 per 8h)</div>}
                </div>
              ) : null
            })()}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowRestModal(false)}
                style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => {
                const totalHours = restHours + (restDays * 24) + (restWeeks * 168)
                if (totalHours <= 0) { setShowRestModal(false); return }
                // All four-track recovery math lives in lib/rest.ts (pure,
                // unit-tested). WP rate, sick RP cap, and Stress cooling-off
                // are computed there so the preview + apply never diverge.
                const { wpHeal, newWP, rpGain, newRP, stressDrop, newStress, wasMortal, isSick } =
                  computeRestRecovery(localState, totalHours, restRestful)
                onStatUpdate?.(localState.id, 'wp_current', newWP)
                onStatUpdate?.(localState.id, 'rp_current', newRP)
                if (stressDrop > 0) onStatUpdate?.(localState.id, 'stress', newStress)
                // Advance the campaign clock by the rested duration so all the
                // time-based drainers fire (pending heals, rations, subsistence,
                // infection) and a System "Time advances Nh" row shows in feed.
                // Then write a Rest-specific row so players see what the patient
                // recovered. Best-effort: never block the heal on a clock error.
                if (campaignIdProp) {
                  try {
                    await advanceClock(campaignIdProp, totalHours)
                    const { user } = await getCachedAuth()
                    if (user) {
                      const hoursText = totalHours === 1 ? '1 hour' : `${totalHours} hours`
                      const recovered = [`+${rpGain} RP`, `+${wpHeal} WP`, stressDrop > 0 ? `-${stressDrop} Stress` : null].filter(Boolean).join(', ')
                      await insertRollLog({
                        campaign_id: campaignIdProp,
                        user_id: user.id,
                        character_name: c.name,
                        label: `${c.name} rested ${hoursText} (${recovered})`,
                        die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
                        outcome: 'rest',
                        damage_json: { characterId: c.id, hours: totalHours, wpHeal, rpHeal: rpGain, stressDrop, wasMortal, wasSick: isSick },
                      })
                    }
                  } catch (e) {
                    console.error('[rest] clock advance / log insert failed:', e)
                  }
                }
                setShowRestModal(false)
                setRestHours(0); setRestDays(0); setRestWeeks(0); setRestRestful(true)
              }}
                style={{ flex: 2, padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Apply Healing</button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* Hidden print sheet */}
      {printing && (
        <div className="print-sheet-container print-sheet-active">
          <PrintSheet state={toWizardState(c.data)} liveState={printLiveState ?? undefined} />
        </div>
      )}

      {/* ── Phase 4F: unified roll modals via <RollModal> shell ────── */}
      {/* Stress Check - two modes share this shell.
          'mid-play' (manual CHECK button): success = no change, failure
            = +1 stress (cap 5). If +1 fills the bar to 5, cascade into
            'at-max' on the same close.
          'at-max'   (auto-fires when stress hits 5, watcher at L227-240,
            or via mid-play cascade): success ≥ 7 = drop to 4,
            failure = Breaking Point (Table 13). */}
      <RollModal
        open={stressCheckPending}
        onClose={() => { setStressCheckPending(false); setStressCheckResult(null); setStressCheckCmod(0); setStressCheckMode('at-max') }}
        title="Stress Check"
        eyebrow="Stress Check"
        accent="#EF9F27"
        dimBackdrop={true}
        subtitle={stressCheckMode === 'at-max'
          ? `${c.name} - Stress at maximum`
          : `${c.name} - Stress Check`}
        rollFormula="2d6 + RSN + ACU + CMod"
        amod={(rapid.RSN ?? 0) + (rapid.ACU ?? 0)}
        smod={0}
        cmod={stressCheckCmod}
        setCmod={stressCheckResult ? undefined : setStressCheckCmod}
        warnings={stressCheckResult ? null : (
          <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', padding: '6px 10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', textAlign: 'center' }}>
            {stressCheckMode === 'at-max'
              ? 'Success ≥ 7 → drop to 4 stress · Failure → Breaking Point'
              : 'Success ≥ 7 → no change · Failure → +1 stress (Breaking Point if it fills the bar)'}
          </div>
        )}
        onRoll={() => {
          const amod = (rapid.RSN ?? 0) + (rapid.ACU ?? 0)
          const d1 = Math.floor(Math.random() * 6) + 1
          const d2 = Math.floor(Math.random() * 6) + 1
          const total = d1 + d2 + amod + stressCheckCmod
          // Outcome strings differ per mode so the postRollCloseLabel +
          // onPostRollClose branches can read them unambiguously.
          const success = total >= 7
          let outcomeStr: string
          if (stressCheckMode === 'at-max') {
            outcomeStr = success ? 'Success - Held It Together' : 'Failure - Breaking Point'
          } else {
            outcomeStr = success ? 'Success - No new stress' : 'Failure - +1 stress'
          }
          setStressCheckResult({
            die1: d1, die2: d2, amod, smod: 0, cmod: stressCheckCmod, total,
            outcome: outcomeStr,
          })
        }}
        rollLabel="Roll Stress Check"
        result={stressCheckResult}
        postRollCloseLabel={(() => {
          if (!stressCheckResult) return 'Continue'
          const success = stressCheckResult.outcome.startsWith('Success')
          if (stressCheckMode === 'at-max') {
            return success ? 'Continue' : 'Roll on Breaking Point Table'
          }
          return 'Continue'
        })()}
        onPostRollClose={async () => {
          if (!localState || !stressCheckResult) return
          const r = stressCheckResult
          const success = r.outcome.startsWith('Success')
          const mode = stressCheckMode
          // Close current modal first; cascade re-opens below if needed.
          setStressCheckPending(false)
          setStressCheckResult(null)
          if (mode === 'at-max') {
            if (success) {
              updateStat(localState.id, 'stress', 4)
              setStressCheckMode('at-max') // already at-max; explicit reset
            } else {
              updateStat(localState.id, 'stress', 5)
              setBreakingPointPending(true)
              setBreakingPointCmod(0)
              setStressCheckMode('at-max')
            }
          } else {
            // mid-play
            if (success) {
              // No state change. Just reset mode for next manual open.
              setStressCheckMode('at-max')
            } else {
              const newStress = Math.min(5, localState.stress + 1)
              updateStat(localState.id, 'stress', newStress)
              if (newStress === 5) {
                // Cascade: open at-max modal immediately. Cleared
                // result + cmod above so the at-max render starts
                // fresh. The auto-fire watcher won't double-fire
                // because pending is true before liveState echoes back.
                setStressCheckMode('at-max')
                setStressCheckCmod(0)
                setStressCheckPending(true)
              } else {
                setStressCheckMode('at-max') // reset for next manual open
              }
            }
          }
          // Log to roll_log so the GM + table see the result.
          // Label format matches the new attribute-check narrative shape
          // (ASCII hyphen, no em-dash per project rule).
          if (campaignIdProp) {
            try {
              const { user } = await getCachedAuth()
              if (user) {
                const labelSuffix = mode === 'at-max' ? 'Stress Check (at max)' : 'Stress Check'
                await insertRollLog({
                  campaign_id: campaignIdProp,
                  user_id: user.id,
                  character_name: c.name,
                  label: `${c.name} - ${labelSuffix}`,
                  die1: r.die1, die2: r.die2,
                  amod: r.amod, smod: 0, cmod: r.cmod,
                  total: r.total,
                  outcome: success ? 'Success' : 'Failure',
                })
              }
            } catch (e) {
              console.error('[stress-check] roll_log insert failed:', e)
            }
          }
        }}
      />

      {/* Breaking Point - d6+d6+CMod table lookup. Custom outcome
          renderer shows the table result + 1d6h duration. */}
      <RollModal
        open={breakingPointPending}
        onClose={() => { setBreakingPointPending(false); setBreakingPointResult(null); setBreakingPointCmod(0) }}
        title="Breaking Point"
        eyebrow="Breaking Point"
        accent="#c0392b"
        dimBackdrop={true}
        subtitle={`${c.name} has broken`}
        rollFormula="2d6 + CMod (Table 13)"
        amod={0}
        smod={0}
        cmod={breakingPointCmod}
        setCmod={breakingPointResult ? undefined : setBreakingPointCmod}
        onRoll={() => {
          if (!localState) return
          const bp = rollOnTable(BREAKING_POINT_TABLE, breakingPointCmod)
          const d1 = Math.floor(Math.random() * 6) + 1
          const d2 = Math.floor(Math.random() * 6) + 1
          // rollOnTable already rolled internally; for the shared shell
          // we want consistent dice in the output, so re-derive d1/d2
          // from the raw total. (The table result is what matters; the
          // dice display is cosmetic for the shell.)
          const adjusted = Math.max(2, Math.min(12, bp.roll + breakingPointCmod))
          const durationHours = Math.floor(Math.random() * 6) + 1
          setBreakingPointResult({
            die1: Math.min(6, Math.max(1, Math.ceil(bp.roll / 2))),
            die2: bp.roll - Math.min(6, Math.max(1, Math.ceil(bp.roll / 2))),
            amod: 0, smod: 0, cmod: breakingPointCmod, total: adjusted,
            outcome: bp.result.name,
            table_name: bp.result.name,
            table_effect: bp.result.effect,
            durationHours,
          })
          setBreakingPointPending(false)
          updateStat(localState.id, 'stress', 0)
          void appendProgressionEntry(supabase, c.id, 'stress', `⚡ Breaking Point: ${bp.result.name} (${durationHours}h).`)
        }}
        rollLabel="Roll Breaking Point"
        result={breakingPointResult}
        renderOutcome={(r) => {
          const br = r as RollResult & { table_name: string; table_effect: string; durationHours: number }
          return (
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '24px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
                {br.table_name}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px' }}>
                Rolled: {br.die1 + br.die2}{r.cmod !== 0 ? ` ${r.cmod > 0 ? '+' : ''}${r.cmod} CMod = ${r.total}` : ''}
              </div>
              <div style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', padding: '10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px' }}>
                {br.table_effect}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5' }}>Stress has been reset to 0.</div>
              <div style={{ fontSize: '13px', color: '#EF9F27', marginTop: '4px' }}>Duration: {br.durationHours} hour{br.durationHours !== 1 ? 's' : ''}</div>
            </div>
          )
        }}
        postRollCloseLabel="Acknowledge"
        onPostRollClose={() => { setBreakingPointResult(null); setBreakingPointCmod(0) }}
      />

      {/* Lasting Wound - Table 12 lookup, opens after a failed PHY
          check. Permanent; no rerolls. */}
      <RollModal
        open={lastingWoundPending}
        onClose={() => { setLastingWoundPending(false); setLastingWoundResult(null); setLastingWoundCmod(0) }}
        title="Lasting Wound Check"
        eyebrow="Lasting Wound Check"
        accent="#c0392b"
        dimBackdrop={true}
        subtitle={`${c.name} - Physicality check failed`}
        rollFormula="2d6 + CMod (Table 12)"
        amod={0}
        smod={0}
        cmod={lastingWoundCmod}
        setCmod={lastingWoundResult ? undefined : setLastingWoundCmod}
        onRoll={() => {
          const lw = rollOnTable(LASTING_WOUNDS_TABLE, lastingWoundCmod)
          const adjusted = Math.max(2, Math.min(12, lw.roll + lastingWoundCmod))
          const d1 = Math.min(6, Math.max(1, Math.ceil(lw.roll / 2)))
          setLastingWoundResult({
            die1: d1,
            die2: lw.roll - d1,
            amod: 0, smod: 0, cmod: lastingWoundCmod, total: adjusted,
            outcome: lw.result.name,
            table_name: lw.result.name,
            table_effect: lw.result.effect,
          })
          setLastingWoundPending(false)
          // Lasting Wounds are permanent - durable journey marker.
          void appendProgressionEntry(supabase, c.id, 'wound', `🩸 Lasting Wound: ${lw.result.name}.`)
        }}
        rollLabel="Roll Lasting Wound"
        result={lastingWoundResult}
        renderOutcome={(r) => {
          const lw = r as RollResult & { table_name: string; table_effect: string }
          return (
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '24px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
                {lw.table_name}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px' }}>
                Rolled: {lw.die1 + lw.die2}{r.cmod !== 0 ? ` ${r.cmod > 0 ? '+' : ''}${r.cmod} CMod = ${r.total}` : ''}
              </div>
              <div style={{ fontSize: '14px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', padding: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px' }}>
                {lw.table_effect}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5' }}>This wound is permanent and cannot be healed.</div>
            </div>
          )
        }}
        postRollCloseLabel="Acknowledge"
        onPostRollClose={() => { setLastingWoundResult(null); setLastingWoundCmod(0) }}
      />

      {/* Character Evolution / CDP Calculator - opens from the
          purple Evolution button. Owns its own confirm overlay +
          Lv 4 narrative input. Refreshes the parent's character row
          after a successful spend so the new RAPID / skill values
          reflect on this card without a manual close + reopen. */}
      {showEvolution && localState && campaignIdProp && (
        <CharacterEvolution
          supabase={supabase}
          characterId={c.id}
          characterName={c.name}
          characterData={c.data}
          stateId={localState.id}
          cdpBalance={localState.cdp ?? 0}
          campaignId={campaignIdProp}
          onClose={() => setShowEvolution(false)}
          onSaved={() => {
            // Force a parent refresh so the spend's effects show up.
            // The parent already listens to character_states realtime
            // for CDP changes; the `characters` row update needs an
            // explicit nudge if the parent isn't subscribed there.
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('tapestry:character-evolved', { detail: { characterId: c.id } }))
            }
          }}
        />
      )}
    </div>
  )
}

// Memo so unrelated parent re-renders (chat updates, modal toggles,
// rolls feed, etc.) skip the sheet. Default shallow comparison; the
// parent passes data props by reference and stabilized callbacks via
// useStableCallback.
const CharacterCard = memo(CharacterCardImpl)
export default CharacterCard

function btn(borderColor: string, color: string): React.CSSProperties {
  return {
    background: 'none', border: `1px solid ${borderColor}`,
    borderRadius: '3px', color, fontSize: '13px',
    padding: '4px 10px', cursor: 'pointer',
    fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase',
  }
}
