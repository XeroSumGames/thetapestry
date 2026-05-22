'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { insertRollLog } from '../../lib/data/roll-log'
import { getCachedAuth } from '../../lib/auth-cache'
import { useSearchParams } from 'next/navigation'
import VehicleCard, { Vehicle } from '../../components/VehicleCard'
import { classifyRoll } from '../../lib/community-logic'
import { getWeaponByName } from '../../lib/weapons'
import { rollDamage, calculateDamage } from '../../lib/damage'
import { decrementInitiativeAction } from '../../lib/initiative-actions'
import { type InventoryItem, normalizeInventoryItem } from '../../lib/inventory'
import { rarityColor } from '../../lib/rarity-colors'
import { ModalBackdrop } from '../../lib/style-helpers'
import RollModal, { type RollResult as SharedRollResult } from '../../components/RollModal'
import { outcomeColor as feedOutcomeColor } from '../../lib/roll-helpers'
import { EQUIPMENT, findEquipmentByName, SKILLS } from '../../lib/xse-schema'
import {
  installFuelDrum, removeFuelDrum, effectiveFuelMaxBase,
  installedDrumCount, remainingDrumCapacity, drumsInCargo,
} from '../../lib/fuel-storage'
import {
  canBrew, canGatherMaterials, gatherMaterials, consumeBrewingSupplies,
  effectiveBrewingMax, currentBrewingSupplies,
} from '../../lib/brewing-supplies'
import { isThriver as roleIsThriver } from '../../lib/auth/roles'

// Eligible driver / brewer - a campaign PC or campaign NPC. Stats are
// pulled at load time so the Driving / Brew check modal can prefill
// AMOD + SMOD without a second round trip.
interface CrewMember {
  id: string
  name: string
  kind: 'pc' | 'npc'
  dex: number
  rsn: number
  drivingLevel: number       // SMOD for Driving check
  mechanicLevel: number      // SMOD for Mechanic* (uses RSN)
  tinkererLevel: number      // SMOD for Tinkerer (uses DEX)
  rangedCombatLevel: number  // SMOD for mounted-weapon attack (uses DEX)
  // Full attribute + skill maps so the Navigate check (and any future
  // open-ended skill check off this sheet) can pick AMod and SMod
  // dynamically when the player swaps which skill they're rolling.
  // Both default to {} so empty-record lookups give 0 below.
  attributes: Record<string, number>   // 'DEX' | 'PHY' | 'ACU' | ... -> level
  skillByName: Record<string, number>  // 'Navigation' | 'Survival' | ... -> level
}

type CheckKind = 'driving' | 'brew' | 'attack' | 'navigate'
type BrewSkill = 'mechanic' | 'tinkerer'

// Mirrors the table in components/TacticalMap.tsx - a weapon's primary
// range band in feet. Used for the firing-arc target gate so an out-of-
// range NPC chips ⛔ in the dropdown even if they're inside the cone.
const RANGE_BAND_FEET: Record<string, number> = {
  'Engaged': 5,
  'Close': 30,
  'Medium': 100,
  'Long': 300,
  'Distant': 600,
}

interface AttackTarget {
  id: string         // campaign_npcs.id
  name: string
  // Tactical-map gating fields. When the weapon has firing-arc data
  // (mount_angle + arc_degrees) we precompute whether each target
  // sits inside the cone so the dropdown can chip ✓ / ✗ and the
  // roll button can hard-block out-of-arc shots.
  inArc?: boolean
  outOfRange?: boolean
}

interface CheckState {
  kind: CheckKind
  crewId: string
  amod: number
  smod: number
  cmod: number
  brewSkill: BrewSkill         // ignored for driving / attack / navigate
  // for kind='navigate': which skill is being rolled. Defaults to
  // 'Navigation' (the navigator's canonical skill, ACU-based) but a
  // player can swap it after making the case for a different skill
  // (e.g. Survival for off-road navigation, Awareness for spotting a
  // route, etc.). Both AMod and SMod recompute on change.
  navigateSkill?: string
  weaponIndex?: number         // for kind='attack': index into vehicle.mounted_weapons
  targetNpcId?: string          // for kind='attack': which NPC is being shot at
  targets?: AttackTarget[]     // for kind='attack': dropdown options (NPCs on active scene)
  rolling: boolean
  result: { die1: number; die2: number; total: number; outcome: string } | null
}

// Render a signed integer for display: '+2' / '-3' / '0'. Used in the
// crew dropdown + brew skill picker labels so negative skill levels
// don't render as "+-3" (hardcoded '+' prefix collided with the
// numeric sign). Post-2026-05-18 playtest: that ugly "+-3" was misread
// as "+3" and reported as "brew showed Mechanic* +3 when the player
// didn't have it."
function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${n}`
  return '0'
}

export default function VehiclePage() {
  const supabase = createClient()
  const params = useSearchParams()
  const campaignId = params.get('c')
  const vehicleId = params.get('v')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [floorplanEnlarged, setFloorplanEnlarged] = useState(false)
  const [isGM, setIsGM] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingNotes, setEditingNotes] = useState(false)
  // Last error from the Fuel Storage install/uninstall buttons (Q4-c).
  // Cleared when the next action succeeds. Surface stays inline under
  // the storage row so the player sees WHY install failed (no drum in
  // cargo / at cap / feature disabled).
  const [fuelStorageError, setFuelStorageError] = useState<string | null>(null)
  // Last error from the Brewing Supplies Gather button + the brew-blocked
  // guard. Cleared on the next successful action. Surfaced inline under
  // the supplies row (and under the Brew button when the guard fires).
  const [brewingSuppliesError, setBrewingSuppliesError] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [showAddCargo, setShowAddCargo] = useState(false)
  const [addName, setAddName] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addEnc, setAddEnc] = useState('0')
  const [addNotes, setAddNotes] = useState('')
  // Driver/Brewer crew pool - populated alongside the vehicle.
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [check, setCheck] = useState<CheckState | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  // Slot-assignment staging state (2026-05-15). Each select stages its
  // candidate value here on change; the existing setter is not called
  // until the user clicks MOVE HERE, which acts as the implicit confirm
  // and snaps the token to the seat. To revert a stage, pick the
  // original value back in the dropdown (stagePending clears the entry
  // when the new value matches the saved one). Keyed by slot identifier:
  //   'driver' | 'brewer' | 'navigator' | `passenger:${0..5}` | `shooter:${0..N}`
  // Submitting holds the slots whose commit is currently in flight so
  // the button disables until the await chain resolves.
  const [pendingSlot, setPendingSlot] = useState<Record<string, string>>({})
  const [submittingSlot, setSubmittingSlot] = useState<Set<string>>(new Set())

  // Range-gate state (2026-05-17). Crew/passenger seats can only be
  // assigned to a character whose scene_token is within Close range
  // (<= 30 ft per RANGE_BAND_MAX_FEET) of the vehicle token, computed
  // edge-to-edge over multi-cell footprints. characterRangeFeet maps
  // every PC/NPC id we found a token for to its current distance in
  // feet from the vehicle. Anyone with no scene_token entry is absent
  // from the map and treated as out-of-range (can't board what isn't
  // on the scene). Recomputed on the token_moved broadcast.
  const [sceneInfo, setSceneInfo] = useState<{ id: string; cellFeet: number } | null>(null)
  const [vehicleTokenPos, setVehicleTokenPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [characterRangeFeet, setCharacterRangeFeet] = useState<Record<string, number>>({})
  // Long-lived tactical channel ref. The popout uses this for outbound
  // broadcasts (vehicle_updated on board/disembark; token_moved on
  // dismount placement). Sending through a long-lived channel avoids
  // the subscribe/send/remove race where the teardown can drop the
  // outbound message before the server fans it out.
  const tacticalChannelRef = useRef<any>(null)

  useEffect(() => {
    async function load() {
      if (!campaignId || !vehicleId) { setLoading(false); return }
      const { user } = await getCachedAuth()
      if (!user) { setLoading(false); return }
      setMyUserId(user.id)
      const { data: camp } = await supabase.from('campaigns').select('gm_user_id, vehicles').eq('id', campaignId).single()
      if (!camp) { setLoading(false); return }
      // Thriver godmode: profile.role check widens GM affordances.
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const isThriver = roleIsThriver(profile)
      setIsGM(camp.gm_user_id === user.id || isThriver)
      // Check if user is a campaign member or GM (or Thriver)
      const { data: membership } = await supabase.from('campaign_members').select('id').eq('campaign_id', campaignId).eq('user_id', user.id).maybeSingle()
      setCanEdit(camp.gm_user_id === user.id || !!membership || isThriver)
      const v = (camp.vehicles ?? []).find((v: Vehicle) => v.id === vehicleId)
      setVehicle(v ?? null)

      // ── Crew pool: PCs (campaign_members → characters) + NPCs ──
      const [memberRes, npcRes] = await Promise.all([
        supabase.from('campaign_members')
          .select('character_id, characters:character_id(id, name, data)')
          .eq('campaign_id', campaignId)
          .not('character_id', 'is', null),
        supabase.from('campaign_npcs')
          .select('id, name, reason, dexterity, physicality, influence, acumen, skills, status, wp_current, death_countdown')
          .eq('campaign_id', campaignId),
      ])
      // Surface partial failures. Pre-fix both .data fell through to
      // empty arrays on RLS denial / network blip, rendering as "no
      // crew" with no debug trail. Same defensive pattern as
      // CampaignCommunity loaders.
      if (memberRes.error) console.error('[vehicle] campaign_members fetch:', memberRes.error.message)
      if (npcRes.error) console.error('[vehicle] campaign_npcs fetch:', npcRes.error.message)

      const pcs: CrewMember[] = ((memberRes.data ?? []) as any[])
        .map(r => r.characters as { id: string; name: string; data: any } | null)
        .filter((c): c is { id: string; name: string; data: any } => !!c && !!c.id && !!c.name)
        .map(c => {
          const rapid = c.data?.rapid ?? {}
          const skills: { skillName: string; level: number }[] = c.data?.skills ?? []
          const lvl = (n: string) => skills.find(s => s.skillName === n)?.level ?? 0
          // Flatten the full skill list into a lookup map - Navigate
          // check's skill picker reads any of these.
          const skillByName: Record<string, number> = {}
          for (const s of skills) skillByName[s.skillName] = s.level ?? 0
          return {
            id: c.id, name: c.name, kind: 'pc' as const,
            dex: rapid.DEX ?? 0,
            rsn: rapid.RSN ?? 0,
            drivingLevel: lvl('Driving'),
            mechanicLevel: lvl('Mechanic*'),
            tinkererLevel: lvl('Tinkerer'),
            rangedCombatLevel: lvl('Ranged Combat'),
            attributes: { ...(rapid as Record<string, number>) },
            skillByName,
          }
        })

      // NPCs: filter out dead ones (status='dead' or wp=0 + countdown elapsed)
      const npcs: CrewMember[] = ((npcRes.data ?? []) as any[])
        .filter(n => {
          if (n.status === 'dead') return false
          const wp = n.wp_current ?? 0
          if (wp === 0 && n.death_countdown != null && n.death_countdown <= 0) return false
          return true
        })
        .map(n => {
          // NPC skills.entries shape: [{ name, level }]
          const entries: { name: string; level: number }[] = n.skills?.entries ?? []
          const lvl = (name: string) => entries.find(e => e.name === name)?.level ?? 0
          const skillByName: Record<string, number> = {}
          for (const e of entries) skillByName[e.name] = e.level ?? 0
          // NPCs store attributes as top-level columns. Backfilled
          // 2026-05-15 to populate the full set so the Navigate
          // skill-picker reads the correct AMod for any skill the
          // player swaps to. campaign_npcs schema only carries PHY /
          // DEX / RSN / INF - ACU (Acuity) is NOT on the NPC table,
          // so any ACU-based skill (Navigation, Farming, Gambling,
          // Lock-Picking) still falls back to 0 for NPC navigators.
          // That's a schema gap, not a vehicle-popout bug; queued
          // separately in tasks/todo.md.
          const attributes: Record<string, number> = {
            DEX: n.dexterity ?? 0,
            RSN: n.reason ?? 0,
            PHY: n.physicality ?? 0,
            INF: n.influence ?? 0,
            ACU: n.acumen ?? 0,
          }
          return {
            id: n.id, name: n.name, kind: 'npc' as const,
            dex: n.dexterity ?? 0,
            rsn: n.reason ?? 0,
            drivingLevel: lvl('Driving'),
            mechanicLevel: lvl('Mechanic*'),
            tinkererLevel: lvl('Tinkerer'),
            rangedCombatLevel: lvl('Ranged Combat'),
            attributes,
            skillByName,
          }
        })

      setCrew([...pcs, ...npcs])
      setLoading(false)
    }
    load()

    // Realtime sync - refresh when campaign.vehicles changes
    if (!campaignId) return
    const channel = supabase.channel(`vehicle_${campaignId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, (payload: any) => {
        const vehicles = payload.new?.vehicles ?? []
        const v = vehicles.find((v: Vehicle) => v.id === vehicleId)
        if (v) setVehicle(v)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [campaignId, vehicleId])

  // Range-gate token loader (2026-05-17). Loads the active scene's
  // vehicle token + every PC/NPC token, computes edge-to-edge distance
  // in feet from each to the vehicle's bounding box, and stashes the
  // result so dropdowns can show a "⛔ Too far" tag on anyone outside
  // Close range. Recomputes on the tactical_${campaignId} channel's
  // token_moved broadcast (fired by TacticalMap drags AND by this
  // popout's own MOVE HERE snaps).
  useEffect(() => {
    if (!campaignId || !vehicle?.name) return
    let cancelled = false

    async function loadTokens() {
      const { data: scene } = await supabase
        .from('tactical_scenes')
        .select('id, cell_feet')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .maybeSingle()
      if (cancelled || !scene) {
        setSceneInfo(null); setVehicleTokenPos(null); setCharacterRangeFeet({})
        return
      }
      const sceneRow = scene as { id: string; cell_feet: number | null }
      const cellFeet = sceneRow.cell_feet ?? 3
      const { data: tokens } = await supabase
        .from('scene_tokens')
        .select('name, token_type, character_id, npc_id, grid_x, grid_y, grid_w, grid_h')
        .eq('scene_id', sceneRow.id)
        .is('archived_at', null)
      if (cancelled) return
      const all = (tokens ?? []) as any[]
      const vehTok = all.find(t => t.token_type === 'object' && t.name === vehicle!.name)
      if (!vehTok) {
        setSceneInfo({ id: sceneRow.id, cellFeet }); setVehicleTokenPos(null); setCharacterRangeFeet({})
        return
      }
      const vBox = {
        x: vehTok.grid_x, y: vehTok.grid_y,
        w: vehTok.grid_w ?? 1, h: vehTok.grid_h ?? 1,
      }
      const distances: Record<string, number> = {}
      for (const t of all) {
        const id: string | null = t.character_id ?? t.npc_id ?? null
        if (!id) continue
        const tBox = { x: t.grid_x, y: t.grid_y, w: t.grid_w ?? 1, h: t.grid_h ?? 1 }
        // Edge-to-edge gap on each axis (0 when boxes overlap on that
        // axis); diagonal distance via hypot, multiplied by cellFeet.
        const gx = Math.max(0, vBox.x - (tBox.x + tBox.w), tBox.x - (vBox.x + vBox.w))
        const gy = Math.max(0, vBox.y - (tBox.y + tBox.h), tBox.y - (vBox.y + vBox.h))
        distances[id] = Math.hypot(gx, gy) * cellFeet
      }
      setSceneInfo({ id: sceneRow.id, cellFeet })
      setVehicleTokenPos(vBox)
      setCharacterRangeFeet(distances)
    }

    loadTokens()

    const ch = supabase.channel(`tactical_${campaignId}`)
      .on('broadcast', { event: 'token_moved' }, () => { loadTokens() })
      .subscribe()
    tacticalChannelRef.current = ch
    return () => {
      cancelled = true
      tacticalChannelRef.current = null
      supabase.removeChannel(ch)
    }
  }, [campaignId, vehicle?.name])

  if (loading) return <div style={{ background: '#0f0f0f', color: '#cce0f5', minHeight: '100vh', padding: '2rem', fontFamily: 'Carlito, sans-serif' }}>Loading...</div>
  if (!vehicle) return <div style={{ background: '#0f0f0f', color: '#f5a89a', minHeight: '100vh', padding: '2rem', fontFamily: 'Carlito, sans-serif' }}>Vehicle not found.</div>

  const wpPct = vehicle.wp_max > 0 ? vehicle.wp_current / vehicle.wp_max : 1
  const wpColor = wpPct > 0.5 ? '#7fc458' : wpPct > 0.25 ? '#EF9F27' : '#c0392b'
  const fuelPct = vehicle.fuel_max > 0 ? vehicle.fuel_current / vehicle.fuel_max : 0

  async function updateVehicle(updated: Vehicle) {
    setVehicle(updated)
    if (!campaignId) return
    // Route through update_vehicle_in_campaign RPC instead of a direct
    // UPDATE on campaigns. The "GM can update campaigns" RLS policy
    // silently rejects any non-GM write, so the popout's optimistic
    // setVehicle was the only thing visually changing - the DB stayed
    // stale, no realtime UPDATE fired, the table page never refreshed
    // its vehicles state, and TacticalMap kept rendering aboard
    // tokens. The RPC is SECURITY DEFINER + authorized by campaign
    // membership, with a narrow swap-one-vehicle scope.
    const { error } = await supabase.rpc('update_vehicle_in_campaign', {
      p_campaign_id: campaignId,
      p_vehicle_id: updated.id,
      p_new_vehicle: updated as any,
    })
    if (error) {
      console.error('[vehicle-popout] updateVehicle RPC failed:', error.message)
      return
    }
    // Belt-and-suspenders cross-tab signal:
    //   (1) localStorage 'storage' event - browser-native, fires
    //       synchronously on every OTHER same-origin tab on this
    //       machine. The reliable path. Supabase broadcasts kept
    //       around for the remote-tab case (player viewing the GM
    //       map from a different browser session).
    //   (2) Supabase broadcast on the long-lived tactical channel.
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`vehicle_updated_${campaignId}`, `${updated.id}:${Date.now()}`)
      }
    } catch { /* private mode / quota - fall through */ }
    // BroadcastChannel - second browser-native cross-context signal,
    // separate from 'storage' so a flaky 'storage' event doesn't take
    // down the whole cross-tab path. Listeners on other same-origin
    // contexts get postMessage on their bc.onmessage handler.
    try {
      if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(`tapestry-vehicle-updates-${campaignId}`)
        bc.postMessage({ vehicle_id: updated.id, ts: Date.now() })
        setTimeout(() => { try { bc.close() } catch {} }, 100)
      }
    } catch { /* unsupported / disabled - fall through */ }
    if (tacticalChannelRef.current) {
      try {
        await tacticalChannelRef.current.send({ type: 'broadcast', event: 'vehicle_updated', payload: { vehicle_id: updated.id } })
      } catch (err) {
        console.error('[vehicle-popout] vehicle_updated broadcast failed:', err)
      }
    } else {
      const ch = supabase.channel(`tactical_${campaignId}`)
      ch.subscribe(async (status: string) => {
        if (status !== 'SUBSCRIBED') return
        await ch.send({ type: 'broadcast', event: 'vehicle_updated', payload: { vehicle_id: updated.id } })
        // Hold briefly so the server has time to fan out before tearing down.
        setTimeout(() => { supabase.removeChannel(ch) }, 500)
      })
    }
  }

  // Auto-vacate helper (2026-05-17): when a character is assigned to
  // a new seat, clear them from every OTHER seat on the same vehicle.
  // Without this, Mikey could be Driver AND Shooter AND Passenger #3
  // simultaneously, which is incoherent. `keep` names the slot we
  // just wrote into so we don't immediately wipe it.
  //
  // Empty crewId (slot being cleared, not filled) skips the vacate
  // pass entirely - there's no character to deduplicate.
  function vacateCrewExcept(
    v: Vehicle,
    crewId: string | null,
    keep: { slot: 'driver' | 'brewer' | 'navigator' | 'shooter' | 'passenger'; idx?: number },
  ): Vehicle {
    if (!crewId) return v
    const next: Vehicle = { ...v }
    if (keep.slot !== 'driver' && next.driver_character_id === crewId) {
      next.driver_character_id = null
      next.driver_kind = null
    }
    if (keep.slot !== 'brewer' && next.brewer_character_id === crewId) {
      next.brewer_character_id = null
      next.brewer_kind = null
    }
    if (keep.slot !== 'navigator' && next.navigator_character_id === crewId) {
      next.navigator_character_id = null
      next.navigator_kind = null
    }
    if (Array.isArray(next.mounted_weapons)) {
      next.mounted_weapons = next.mounted_weapons.map((w, i) => {
        if (keep.slot === 'shooter' && keep.idx === i) return w
        if (w?.shooter_character_id === crewId) {
          return { ...w, shooter_character_id: null, shooter_kind: null }
        }
        return w
      })
    }
    if (Array.isArray(next.passenger_seats)) {
      next.passenger_seats = next.passenger_seats.map((s, i) => {
        if (keep.slot === 'passenger' && keep.idx === i) return s
        if (s?.character_id === crewId) return null
        return s
      }) as any
    }
    return next
  }

  // Slot-key parsing helpers for the Confirm-gate UX. Each select on
  // the popout has a unique slot key; pending values + submit state are
  // keyed by this string.
  type SlotKey = 'driver' | 'brewer' | 'navigator' | `passenger:${number}` | `shooter:${number}`

  // True when crewId is currently occupying ANY seat on this vehicle
  // (driver / navigator / brewer / passenger / shooter). Used by the
  // range gate to keep currently-aboard members selectable even when
  // their token is far from the vehicle - the auto-vacate flow on
  // confirm will reassign them between seats without dragging their
  // token first.
  function isCurrentlyOnVehicle(crewId: string): boolean {
    if (!vehicle || !crewId) return false
    if (vehicle.driver_character_id === crewId) return true
    if (vehicle.brewer_character_id === crewId) return true
    if (vehicle.navigator_character_id === crewId) return true
    if (vehicle.passenger_seats?.some(s => s?.character_id === crewId)) return true
    if (vehicle.mounted_weapons?.some(w => w?.shooter_character_id === crewId)) return true
    return false
  }

  // Out-of-range gate. Returns true when the candidate has a token on
  // the active scene and that token is beyond Close range (30 ft per
  // RANGE_BAND_MAX_FEET) from the vehicle's bounding box. Returns
  // false when:
  //  - no scene info loaded yet (can't gate, allow)
  //  - candidate isn't on the map at all (let the GM place them first;
  //    the range gate only blocks people who ARE on the map but too far)
  //  - candidate is already aboard this vehicle (reassigns are free)
  function isOutOfRangeForVehicle(crewId: string): boolean {
    if (!crewId) return false
    if (!sceneInfo || !vehicleTokenPos) return false
    if (isCurrentlyOnVehicle(crewId)) return false
    const feet = characterRangeFeet[crewId]
    if (feet === undefined) return false
    return feet > 30
  }

  function getSavedSlotValue(slot: SlotKey): string {
    if (!vehicle) return ''
    if (slot === 'driver') return vehicle.driver_character_id ?? ''
    if (slot === 'brewer') return vehicle.brewer_character_id ?? ''
    if (slot === 'navigator') return vehicle.navigator_character_id ?? ''
    if (slot.startsWith('passenger:')) {
      const idx = parseInt(slot.split(':')[1], 10)
      return vehicle.passenger_seats?.[idx]?.character_id ?? ''
    }
    if (slot.startsWith('shooter:')) {
      const idx = parseInt(slot.split(':')[1], 10)
      return vehicle.mounted_weapons?.[idx]?.shooter_character_id ?? ''
    }
    return ''
  }

  // Stage a candidate slot value. Writing the same value the slot
  // already has clears the pending entry (no-op confirm needed).
  function stagePending(slot: SlotKey, newValue: string) {
    const saved = getSavedSlotValue(slot)
    setPendingSlot(prev => {
      const next = { ...prev }
      if (newValue === saved) delete next[slot]
      else next[slot] = newValue
      return next
    })
  }

  function cancelPending(slot: SlotKey) {
    setPendingSlot(prev => {
      const next = { ...prev }
      delete next[slot]
      return next
    })
  }

  // Disembark a character: place their scene_token at the first free
  // cell adjacent to the vehicle's bounding box. Used by the
  // dismount path in confirmPending when a seat is cleared. Routes
  // through the snap_token_to_seat RPC (SECURITY DEFINER) so any
  // campaign member can disembark anyone - the popout already lets
  // them clear seats, this just keeps the map state consistent.
  //
  // Search pattern: expanding ring around the vehicle's footprint.
  // First-found wins; we don't try to put them on a specific side.
  // If every nearby cell is occupied (rare), we silently bail -
  // their token stays wherever it was last (usually the boarding
  // spot). GM can drag them in by hand.
  async function dismountToAdjacent(assigneeId: string) {
    if (!campaignId || !vehicle || !assigneeId) return
    const { data: scene } = await supabase
      .from('tactical_scenes')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .maybeSingle()
    if (!scene) return
    const sceneId = (scene as any).id
    const { data: tokens } = await supabase
      .from('scene_tokens')
      .select('grid_x, grid_y, grid_w, grid_h, character_id, npc_id, name, token_type')
      .eq('scene_id', sceneId)
      .is('archived_at', null)
    const all = (tokens ?? []) as any[]
    const vehTok = all.find(t => t.token_type === 'object' && t.name === vehicle!.name)
    if (!vehTok) return
    const vx = vehTok.grid_x as number
    const vy = vehTok.grid_y as number
    const vw = (vehTok.grid_w ?? 1) as number
    const vh = (vehTok.grid_h ?? 1) as number

    // Build "occupied" set from every other token's footprint; skip
    // the disembarking character themselves (their old cell is the
    // boarding spot, which is usually under the vehicle now, but if
    // it isn't we'd rather place them elsewhere anyway).
    const occupied = new Set<string>()
    for (const t of all) {
      if (t.character_id === assigneeId || t.npc_id === assigneeId) continue
      const tw = (t.grid_w ?? 1) as number
      const th = (t.grid_h ?? 1) as number
      for (let ddx = 0; ddx < tw; ddx++) {
        for (let ddy = 0; ddy < th; ddy++) {
          occupied.add(`${t.grid_x + ddx},${t.grid_y + ddy}`)
        }
      }
    }

    // Walk rings outward (r=1..5). Each ring traces the rectangle
    // exactly r cells outside the vehicle's footprint.
    let target: { x: number; y: number } | null = null
    for (let r = 1; r <= 5 && !target; r++) {
      const candidates: Array<{ x: number; y: number }> = []
      // Top + bottom edges (full width including the corners)
      for (let i = -r; i <= vw + r - 1; i++) {
        candidates.push({ x: vx + i, y: vy - r })
        candidates.push({ x: vx + i, y: vy + vh + r - 1 })
      }
      // Left + right edges (excluding the corners, already in top/bottom)
      for (let j = -r + 1; j <= vh + r - 2; j++) {
        candidates.push({ x: vx - r, y: vy + j })
        candidates.push({ x: vx + vw + r - 1, y: vy + j })
      }
      const hit = candidates.find(c => !occupied.has(`${c.x},${c.y}`))
      if (hit) target = hit
    }
    if (!target) return

    const member = crew.find(c => c.id === assigneeId)
    if (!member) return
    const { error } = await supabase.rpc('snap_token_to_seat', {
      p_scene_id: sceneId,
      p_assignee_id: assigneeId,
      p_kind: member.kind,
      p_target_x: target.x,
      p_target_y: target.y,
    })
    if (error) {
      console.error('[vehicle-popout] dismount placement failed:', error.message)
      return
    }
    const ch = supabase.channel(`tactical_${campaignId}`)
    ch.subscribe(async (status: string) => {
      if (status !== 'SUBSCRIBED') return
      await ch.send({ type: 'broadcast', event: 'token_moved', payload: {} })
      await supabase.removeChannel(ch)
    })
  }

  // Confirm a pending slot change. Calls the existing setter
  // (setCrewAssignment / setPassengerSlot / setShooterAssignment) and
  // then drops the prior occupant next to the bus on disembark.
  // `valueOverride` lets a caller (e.g. the instant-disembark button)
  // commit a value without going through pendingSlot first - useful
  // when we don't want to wait for a React state flush before
  // running the await chain.
  async function confirmPending(slot: SlotKey, valueOverride?: string) {
    const newValue = valueOverride !== undefined ? valueOverride : pendingSlot[slot]
    if (newValue === undefined) return
    // Defense in depth on the range gate: the dropdown disables
    // out-of-range options visually, but if the staged value somehow
    // becomes out-of-range between selection and click (vehicle drives
    // away after pick), refuse the commit and tell the user why.
    if (newValue && isOutOfRangeForVehicle(newValue)) {
      const name = crew.find(c => c.id === newValue)?.name ?? 'that character'
      alert(`${name} is too far from ${vehicle?.name ?? 'the vehicle'} to board. Move within Close range (30 ft) first.`)
      return
    }
    setSubmittingSlot(prev => {
      const next = new Set(prev)
      next.add(slot)
      return next
    })
    try {
      // Snapshot who was in the seat BEFORE the write, so the dismount
      // branch below can place them next to the bus.
      const priorOccupant = getSavedSlotValue(slot)
      if (slot === 'driver' || slot === 'brewer' || slot === 'navigator') {
        await setCrewAssignment(slot, newValue)
      } else if (slot.startsWith('passenger:')) {
        const idx = parseInt(slot.split(':')[1], 10)
        await setPassengerSlot(idx, newValue)
      } else if (slot.startsWith('shooter:')) {
        const idx = parseInt(slot.split(':')[1], 10)
        await setShooterAssignment(idx, newValue)
      }
      // Boarding/reseating (newValue truthy): no map work needed.
      // The TacticalMap aboard-filter hides their token; the popout's
      // own range/badge state updates via realtime + the vehicle
      // refresh listener.
      //
      // Disembarking (newValue empty, priorOccupant truthy AND the
      // character is no longer aboard ANY seat on this vehicle): drop
      // their token at the first free cell adjacent to the vehicle.
      // The "no longer aboard ANY seat" check matters because
      // setCrewAssignment uses vacateCrewExcept, which may have
      // already cleared them from this slot as part of a reassign
      // elsewhere on the bus - in that case the dismount placement
      // would visually eject them mid-ride. The vehicle state mutates
      // synchronously through updateVehicle's setVehicle, so by the
      // time we check, isCurrentlyOnVehicle reflects the post-write
      // state.
      if (!newValue && priorOccupant && !isCurrentlyOnVehicle(priorOccupant)) {
        await dismountToAdjacent(priorOccupant)
      }
      cancelPending(slot)
    } finally {
      setSubmittingSlot(prev => {
        const next = new Set(prev)
        next.delete(slot)
        return next
      })
    }
  }

  // Persist driver / brewer / navigator assignment back to the vehicle.
  async function setCrewAssignment(slot: 'driver' | 'brewer' | 'navigator', crewId: string) {
    if (!vehicle) return
    const member = crew.find(c => c.id === crewId)
    const patch: Partial<Vehicle> =
      slot === 'driver'    ? { driver_character_id: crewId || null, driver_kind: member?.kind ?? null }
    : slot === 'brewer'    ? { brewer_character_id: crewId || null, brewer_kind: member?.kind ?? null }
    : /* navigator */        { navigator_character_id: crewId || null, navigator_kind: member?.kind ?? null }
    const withPatch = { ...vehicle, ...patch }
    await updateVehicle(vacateCrewExcept(withPatch, crewId || null, { slot }))
  }

  // Persist a passenger-slot assignment. Slots are a fixed-length 6
  // array; null = empty seat. Writing slot N replaces only that
  // entry, leaves the others untouched. Used by the Passenger Seats
  // section on the popout.
  async function setPassengerSlot(slotIndex: number, crewId: string) {
    if (!vehicle) return
    const seats = (vehicle.passenger_seats ?? Array(6).fill(null)).slice()
    // Pad to 6 if a legacy vehicle row was written with fewer entries.
    while (seats.length < 6) seats.push(null)
    const member = crew.find(c => c.id === crewId)
    seats[slotIndex] = crewId && member
      ? { character_id: crewId, kind: member.kind }
      : null
    const withPatch = { ...vehicle, passenger_seats: seats as any }
    await updateVehicle(vacateCrewExcept(withPatch, crewId || null, { slot: 'passenger', idx: slotIndex }))
  }

  // Persist the shooter assignment for a specific mounted weapon.
  // Updates that weapon's entry in the mounted_weapons array; leaves
  // other weapons (and their shooters) untouched.
  async function setShooterAssignment(weaponIdx: number, crewId: string) {
    if (!vehicle) return
    const weapons = (vehicle.mounted_weapons ?? []).slice()
    if (!weapons[weaponIdx]) return
    const member = crew.find(c => c.id === crewId)
    weapons[weaponIdx] = {
      ...weapons[weaponIdx],
      shooter_character_id: crewId || null,
      shooter_kind: member?.kind ?? null,
    }
    const withPatch = { ...vehicle, mounted_weapons: weapons }
    await updateVehicle(vacateCrewExcept(withPatch, crewId || null, { slot: 'shooter', idx: weaponIdx }))
  }

  // Open the check modal for the assigned driver / brewer with sensible
  // defaults. Brew picks Mechanic* vs Tinkerer by whichever is higher
  // (ties → Mechanic*); GM can override in the modal.
  async function openCheck(kind: CheckKind, weaponIdx?: number) {
    if (!vehicle) return
    let crewId: string | null | undefined
    if (kind === 'driving') crewId = vehicle.driver_character_id
    else if (kind === 'brew') crewId = vehicle.brewer_character_id
    else if (kind === 'navigate') crewId = vehicle.navigator_character_id
    else crewId = vehicle.mounted_weapons?.[weaponIdx ?? 0]?.shooter_character_id
    const member = crew.find(c => c.id === crewId)
    if (!member) {
      alert(kind === 'driving'
        ? 'Pick a driver from the dropdown first.'
        : kind === 'brew'
          ? 'Pick a brewer from the dropdown first.'
          : kind === 'navigate'
            ? 'Pick a navigator from the dropdown first.'
            : 'Pick a shooter for this weapon first.')
      return
    }
    if (kind === 'driving') {
      setCheck({
        kind, crewId: member.id,
        amod: member.dex,
        smod: member.drivingLevel,
        cmod: 0,
        brewSkill: 'mechanic',
        rolling: false, result: null,
      })
    } else if (kind === 'navigate') {
      // Default to canonical Navigation (ACU). Player can swap via
      // the skill picker in the modal if they make the case for a
      // different skill.
      const defaultSkill = 'Navigation'
      const skillDef = SKILLS.find(s => s.name === defaultSkill)
      const attr = skillDef?.attribute ?? 'ACU'
      setCheck({
        kind, crewId: member.id,
        amod: member.attributes[attr] ?? 0,
        smod: member.skillByName[defaultSkill] ?? 0,
        cmod: 0,
        brewSkill: 'mechanic',
        navigateSkill: defaultSkill,
        rolling: false, result: null,
      })
    } else if (kind === 'brew') {
      const useTinkerer = member.tinkererLevel > member.mechanicLevel
      setCheck({
        kind, crewId: member.id,
        amod: useTinkerer ? member.dex : member.rsn,
        smod: useTinkerer ? member.tinkererLevel : member.mechanicLevel,
        cmod: 0,
        brewSkill: useTinkerer ? 'tinkerer' : 'mechanic',
        rolling: false, result: null,
      })
    } else {
      // attack - Ranged Combat (DEX) check against the weapon. Pull
      // the NPCs currently on the active tactical scene as the target
      // dropdown so the GM can fire at someone who's actually there.
      // Also fetch token coords for both the SHOOTER (this vehicle)
      // and every TARGET so we can gate by firing arc + range when
      // the weapon has mount_angle + arc_degrees set.
      let targets: AttackTarget[] = []
      const weapon = vehicle.mounted_weapons?.[weaponIdx ?? 0]
      const wDef = weapon ? getWeaponByName(weapon.name) : undefined
      const hasArc = !!weapon && typeof weapon.mount_angle === 'number' && typeof weapon.arc_degrees === 'number'
      if (campaignId) {
        const { data: activeScene } = await supabase
          .from('tactical_scenes')
          .select('id, cell_feet')
          .eq('campaign_id', campaignId)
          .eq('is_active', true)
          .maybeSingle()
        if (activeScene?.id) {
          // One fetch for every visible token on the scene - cheaper
          // than two filtered fetches and gives us the shooter row
          // (matched by name) + all NPC targets (matched by npc_id).
          const { data: tokenRows } = await supabase
            .from('scene_tokens')
            .select('id, name, npc_id, grid_x, grid_y, grid_w, grid_h, rotation, token_type')
            .eq('scene_id', activeScene.id)
            .is('archived_at', null)
          const allTokens = (tokenRows ?? []) as any[]
          const shooterTok = allTokens.find(t => t.token_type === 'object' && t.name === vehicle.name) ?? null
          const cellFt = activeScene.cell_feet ?? 3
          const npcTokens = allTokens.filter(t => t.npc_id != null)
          const npcIds = Array.from(new Set(npcTokens.map(t => t.npc_id))).filter(Boolean)
          let nameMap: Record<string, string> = {}
          if (npcIds.length > 0) {
            const { data: npcRows } = await supabase
              .from('campaign_npcs')
              .select('id, name')
              .in('id', npcIds)
            for (const n of (npcRows ?? []) as any[]) nameMap[n.id] = n.name
          }
          // Build targets, annotating each with in-arc / in-range
          // when the weapon has cone data. Without arc data, every
          // target is implicitly in arc (no gate).
          const built: AttackTarget[] = []
          for (const t of npcTokens) {
            const name = nameMap[t.npc_id]
            if (!name) continue
            let inArc = true
            let outOfRange = false
              if (hasArc && shooterTok) {
                const sgw = shooterTok.grid_w ?? 1
                const sgh = shooterTok.grid_h ?? 1
                const sx = shooterTok.grid_x + sgw / 2
                const sy = shooterTok.grid_y + sgh / 2
                const tx = t.grid_x + (t.grid_w ?? 1) / 2
                const ty = t.grid_y + (t.grid_h ?? 1) / 2
                const dx = tx - sx
                const dy = ty - sy
                const distCells = Math.hypot(dx, dy)
                // Range gate - weapon's primary range band in feet
                // → cells. Falls back to 33 cells (~100ft) when the
                // weapon isn't in the catalog.
                const rangeFeet = wDef ? (RANGE_BAND_FEET[wDef.range] ?? 100) : 100
                const rangeCells = rangeFeet / cellFt
                outOfRange = distCells > rangeCells
                // Angle gate - facing = token rotation + mount angle.
                // Both expressed clockwise from "up". Canvas math
                // already used 0° = right (+X) by subtracting 90°;
                // here we measure relative angle in token-space and
                // compare to the half-arc directly, so the offset
                // doesn't matter as long as we're consistent.
                const tokenRot = (shooterTok.rotation ?? 0) * Math.PI / 180
                const mountRad = (weapon!.mount_angle! * Math.PI) / 180
                // Forward-vector for the weapon: (sin, -cos) at 0°
                // since 0° = up, then rotate by token rotation +
                // mount_angle.
                const facing = tokenRot + mountRad
                const fx = Math.sin(facing)
                const fy = -Math.cos(facing)
                // Angle between the facing vector and the (target -
                // shooter) vector via dot product / magnitudes.
                const mag = Math.hypot(dx, dy)
                if (mag < 1e-6) {
                  inArc = true // target on top of shooter - degenerate; allow
                } else {
                  const cosAng = (fx * dx + fy * dy) / mag
                  const angle = Math.acos(Math.max(-1, Math.min(1, cosAng)))
                  const halfArc = (weapon!.arc_degrees! / 2) * Math.PI / 180
                  inArc = angle <= halfArc
                }
              }
            built.push({ id: t.npc_id as string, name, inArc, outOfRange })
          }
          built.sort((a, b) => a.name.localeCompare(b.name))
          // De-dup if a name was on two tokens (two of the same NPC)
          // - keep the first.
          const seen = new Set<string>()
          targets = built.filter(t => seen.has(t.id) ? false : (seen.add(t.id), true))
        }
      }
      // Default the picked target to the first IN-ARC option so the
      // GM doesn't have to manually skip past out-of-arc names. Falls
      // back to the first target overall when nothing's in arc.
      const defaultTarget = targets.find(t => t.inArc !== false && !t.outOfRange) ?? targets[0]
      setCheck({
        kind: 'attack', crewId: member.id,
        amod: member.dex,
        smod: member.rangedCombatLevel,
        cmod: 0,
        brewSkill: 'mechanic',
        weaponIndex: weaponIdx,
        targets,
        targetNpcId: defaultTarget?.id ?? undefined,
        rolling: false, result: null,
      })
    }
  }

  // Switch brew skill within the modal - also rewires AMOD/SMOD to the
  // chosen attribute/skill so the GM doesn't have to re-enter them.
  function switchBrewSkill(next: BrewSkill) {
    if (!check || check.kind !== 'brew') return
    const member = crew.find(c => c.id === check.crewId)
    if (!member) return
    setCheck({
      ...check,
      brewSkill: next,
      amod: next === 'tinkerer' ? member.dex : member.rsn,
      smod: next === 'tinkerer' ? member.tinkererLevel : member.mechanicLevel,
    })
  }

  // Navigate check skill swap. Default is Navigation (ACU); the picker
  // lets a player swap to any other skill they argued was relevant
  // (Survival for off-road, Awareness for spotting routes, etc.).
  // AMod reads from the new skill's canonical attribute via the SKILLS
  // table; SMod reads the navigator's level in that skill.
  function switchNavigateSkill(nextSkillName: string) {
    if (!check || check.kind !== 'navigate') return
    const member = crew.find(c => c.id === check.crewId)
    if (!member) return
    const skillDef = SKILLS.find(s => s.name === nextSkillName)
    const attr = skillDef?.attribute ?? 'ACU'
    setCheck({
      ...check,
      navigateSkill: nextSkillName,
      amod: member.attributes[attr] ?? 0,
      smod: member.skillByName[nextSkillName] ?? 0,
    })
  }

  // Roll 2d6 + amod + smod + cmod, classify, log to roll_log, and apply
  // any rules-mandated mechanical effect. For brew: Wild Success / Success
  // produces a full tank (+1 fuel_current, capped at fuel_max). Failure
  // and Dire Failure produce no fuel - already a no-op on the vehicle's
  // state. Driving outcomes are GM-narrative only (no auto-WP, no auto-
  // time-cost).
  async function rollCheck() {
    if (!check || !vehicle || !campaignId || !myUserId) return
    // Brew check guard (Q4-d, 2026-05-19): block when no brewing
    // supplies on hand. UI disables the button via canBrew(), but
    // a stale client could still fire this - defense in depth. The
    // feature is opt-in per vehicle; vehicles without
    // brewing_supplies_max skip the guard entirely (no still / no
    // stockpile, no constraint).
    if (check.kind === 'brew' && effectiveBrewingMax(vehicle) > 0 && !canBrew(vehicle)) {
      setBrewingSuppliesError('No brewing materials on hand - click Gather Materials first.')
      return
    }
    setBrewingSuppliesError(null)
    setCheck({ ...check, rolling: true })
    const die1 = Math.floor(Math.random() * 6) + 1
    const die2 = Math.floor(Math.random() * 6) + 1
    const total = die1 + die2 + check.amod + check.smod + check.cmod
    const outcome = classifyRoll(total, die1, die2)
    const member = crew.find(c => c.id === check.crewId)
    const weapon = check.kind === 'attack' && check.weaponIndex != null
      ? vehicle.mounted_weapons?.[check.weaponIndex]
      : undefined
    const weaponDef = weapon ? getWeaponByName(weapon.name) : undefined
    const navAttr = check.kind === 'navigate'
      ? (SKILLS.find(s => s.name === check.navigateSkill)?.attribute ?? 'ACU')
      : ''
    const skillLabel = check.kind === 'driving'
      ? 'Driving (DEX)'
      : check.kind === 'brew'
        ? (check.brewSkill === 'tinkerer' ? 'Tinkerer (DEX)' : 'Mechanic* (RSN)')
        : check.kind === 'navigate'
          ? `${check.navigateSkill ?? 'Navigation'} (${navAttr})`
          : 'Ranged Combat (DEX)'
    const targetName = check.kind === 'attack' && check.targetNpcId
      ? (check.targets?.find(t => t.id === check.targetNpcId)?.name ?? null)
      : null
    const verb = check.kind === 'driving'
      ? '🚗 Driving check'
      : check.kind === 'brew'
        ? '⚗️ Brew check'
        : check.kind === 'navigate'
          ? '🧭 Navigate check'
          : `🎯 ${weapon?.name ?? 'Mounted weapon'} attack${targetName ? ` → ${targetName}` : ''}`
    const fuelDelta = check.kind === 'brew' && (outcome === 'Wild Success' || outcome === 'Success' || outcome === 'High Insight') ? 1 : 0
    const newFuel = Math.min(vehicle.fuel_max, vehicle.fuel_current + fuelDelta)
    const fuelNote = fuelDelta > 0 && newFuel > vehicle.fuel_current
      ? ` - produced 1 day of fuel (${newFuel}/${vehicle.fuel_max})`
      : fuelDelta > 0
        ? ' - full tank but reserves are already full'
        : ''
    // 2026-05-19 narrative-polish: switch driving/brew/navigate to the
    // "<name> - <Verb> - <vehicle>" shape the prefix-CAPS parsers in
    // lib/roll-helpers.ts expect (DRIVE / BREW / NAVIGATE - mirrors
    // HEAL / UNJAM / REPAIR / STABILIZE). Old "🚗 Driving check · ..."
    // flat-string format bypassed every narrative path we'd built.
    // Mounted-weapon attacks still use the legacy "🎯 ... · ... · ..."
    // shape because the existing attack-narrative parser (commit
    // 54c46a1) already handles it well.
    const driverName = member?.name ?? '-'
    // Skill name only (no "(DEX)" / "(RSN)" attribute parens) for
    // the new label format - the parser uses `(<skill>)` as a
    // delimiter and double parens would break it. AMOD on the
    // roll_log row already carries the attribute contribution.
    const bareSkill = check.kind === 'brew'
      ? (check.brewSkill === 'tinkerer' ? 'Tinkerer' : 'Mechanic*')
      : check.kind === 'navigate'
        ? (check.navigateSkill ?? 'Navigation')
        : skillLabel  // attack path; unused below
    let label: string
    if (check.kind === 'driving') {
      label = `${driverName} - Drive - ${vehicle.name}`
    } else if (check.kind === 'brew') {
      // Three label tails for the brew narrative paths:
      //   "<after>/<max>"        had room, produced 1 day
      //   "full <max>/<max>"     tank already full, no delta
      //   ""                     failure path, no fuel
      const tail = fuelDelta > 0 && newFuel > vehicle.fuel_current
        ? ` ${newFuel}/${vehicle.fuel_max}`
        : fuelDelta > 0
          ? ` full ${vehicle.fuel_max}/${vehicle.fuel_max}`
          : ''
      label = `${driverName} - Brew - ${vehicle.name} (${bareSkill})${tail}`
    } else if (check.kind === 'navigate') {
      label = `${driverName} - Navigate - ${vehicle.name} (${bareSkill})`
    } else {
      // Attack path - keep the legacy flat-string format; the
      // attack-narrative parser at L730+ of roll-helpers.ts handles it.
      label = `${verb} · ${vehicle.name} · ${driverName} · ${skillLabel} · ${outcome}${fuelNote}`
    }

    // ── Damage resolution for mounted-weapon attacks ──
    // Pre-fix this block didn't exist - the vehicle popup logged the
    // attack roll but never rolled damage or applied it to the target.
    // Symptom: "no damage to <target>" with the rolls feed showing an
    // empty "= raw → WP / RP" line. Now mirrors the /table single-
    // target damage path: roll the weapon's damage formula, apply the
    // target's DEX AMod as defensive mod, mitigate by RP%, then update
    // the target NPC's wp_current / rp_current. Burst trait is honored
    // (Automatic Burst (N) → N damage rolls summed), matching player
    // expectations for a mounted machine gun.
    let damageJsonExtras: Record<string, any> = {}
    if (
      check.kind === 'attack' &&
      weapon && weaponDef &&
      check.targetNpcId &&
      (outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight')
    ) {
      const traits = weaponDef.traits ?? []
      // Automatic Burst (N) - find the trait, parse N, default 1 roll.
      const burstTrait = traits.find(t => /^Automatic Burst/i.test(t))
      const burstMatch = burstTrait?.match(/Automatic Burst\s*\((\d+)\)/i)
      const rolls = burstMatch ? parseInt(burstMatch[1], 10) : 1
      let totalBase = 0, totalDice = 0
      let diceDesc = ''
      for (let i = 0; i < rolls; i++) {
        const dmg = rollDamage(weaponDef.damage, 0, false)
        totalBase += dmg.base
        totalDice += dmg.diceRoll
        if (i === 0) diceDesc = dmg.diceDesc
      }
      const totalWP = totalBase + totalDice
      // Pull the target NPC's current state so we can compute their
      // DEX AMod (defensive mod for ranged) and apply the WP/RP delta.
      const { data: tgtNpc } = await supabase
        .from('campaign_npcs')
        .select('id, dexterity, wp_current, rp_current, wp_max, rp_max')
        .eq('id', check.targetNpcId)
        .maybeSingle()
      const targetDex = (tgtNpc as any)?.dexterity ?? 0
      const { finalWP, finalRP, mitigated } = calculateDamage(totalWP, weaponDef.rpPercent, targetDex)
      // Apply the damage. Clamp at 0 - going negative would let a
      // future heal "uncritically" push the NPC back into combat at
      // weird WP. Don't write wp_max/rp_max; this only mutates
      // current pools.
      if (tgtNpc) {
        const newWp = Math.max(0, ((tgtNpc as any).wp_current ?? 0) - finalWP)
        const newRp = Math.max(0, ((tgtNpc as any).rp_current ?? 0) - finalRP)
        await supabase.from('campaign_npcs')
          .update({ wp_current: newWp, rp_current: newRp })
          .eq('id', check.targetNpcId)
      }
      damageJsonExtras = {
        base: totalBase,
        diceRoll: totalDice,
        diceDesc: rolls > 1 ? `${rolls}x ${diceDesc}` : diceDesc,
        phyBonus: 0,
        totalWP,
        finalWP,
        finalRP,
        mitigated,
        bursts: rolls > 1 ? rolls : undefined,
      }
    }

    await insertRollLog({
      campaign_id: campaignId,
      user_id: myUserId,
      character_name: member?.name ?? null,
      label,
      die1, die2,
      amod: check.amod, smod: check.smod, cmod: check.cmod, total,
      outcome,
      damage_json: {
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        checkKind: check.kind,
        skillLabel,
        crewId: check.crewId,
        crewKind: member?.kind ?? null,
        fuelDelta,
        fuelBefore: vehicle.fuel_current,
        fuelAfter: newFuel,
        weaponName: weapon?.name ?? null,
        weaponDamage: weaponDef?.damage ?? null,
        weaponRpPercent: weaponDef?.rpPercent ?? null,
        targetNpcId: check.targetNpcId ?? null,
        targetName,
        ...damageJsonExtras,
      },
    })
    // Combined vehicle update: fuel delta from the brew (if any) PLUS
    // brewing-supplies decrement (Q4-d 4a: every brew attempt consumes
    // 1 supply, success or fail). Batched so a single updateVehicle
    // call covers both - the realtime broadcast lands once and the
    // UI flips clean.
    const needsFuelUpdate = newFuel !== vehicle.fuel_current
    const needsSupplyDecrement = check.kind === 'brew' && effectiveBrewingMax(vehicle) > 0 && canBrew(vehicle)
    if (needsFuelUpdate || needsSupplyDecrement) {
      let next: typeof vehicle = vehicle
      if (needsFuelUpdate) next = { ...next, fuel_current: newFuel }
      if (needsSupplyDecrement) {
        const consumed = consumeBrewingSupplies(next)
        if (consumed.vehicle) next = consumed.vehicle
      }
      await updateVehicle(next)
    }

    // Consume an action on the active initiative entry. Only attacks cost
    // an action - driving and brew checks are passive vehicle operations
    // outside the combat-action economy. (BUG-3 from 2026-05-04 playtest:
    // Enya fired Minnie's M60 mounted weapon and her actions_remaining
    // never decremented because the table page's consumeAction() lives
    // inside the table component and is unreachable from this popout.)
    //
    // Done after the roll_log insert so the player sees the attack land
    // even if the decrement fails (e.g. RLS on initiative_order). If
    // newRemaining hits 0, broadcast turn_advance_requested on the
    // table's initiative channel - the table page listens and runs
    // its full nextTurn() flow, which is too stateful to extract.
    if (check.kind === 'attack') {
      const dec = await decrementInitiativeAction(supabase, {
        campaignId,
        userId: myUserId,
        actionLabel: undefined, // the roll_log entry above already covers this action's narrative
      })
      if (dec.ok && dec.reachedZero) {
        try {
          const ch = supabase.channel(`initiative_${campaignId}`)
          await ch.subscribe()
          await ch.send({ type: 'broadcast', event: 'turn_advance_requested', payload: { entryId: dec.entry?.id } })
          await supabase.removeChannel(ch)
        } catch { /* swallow - the GM can advance manually */ }
      }
    }

    setCheck({ ...check, rolling: false, result: { die1, die2, total, outcome } })
  }

  const lbl: React.CSSProperties = { fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em' }
  const bigVal: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }

  // Render a single crew dropdown option with the Close-range gate
  // applied. Out-of-range options get a "⛔ Too far" suffix and the
  // disabled attribute, so the player can see WHY they can't pick
  // someone instead of the option just vanishing. Currently-onboard
  // characters are always selectable (already in the vehicle; reassigns
  // between seats don't care about distance - handled by
  // isOutOfRangeForVehicle's currently-aboard short-circuit).
  function renderCrewOption(c: CrewMember, statsSuffix: string) {
    const outOfRange = isOutOfRangeForVehicle(c.id)
    return (
      <option key={c.id} value={c.id} disabled={outOfRange}>
        {c.name}{statsSuffix}{outOfRange ? ' - Too far' : ''}
      </option>
    )
  }

  // Apply-seat-change button. Single action that commits the next
  // sensible move for the slot. Label is contextual:
  //   - staged with a new occupant       → "🪑 Board"        (commit)
  //   - staged empty                     → "🚶 Disembark"   (commit)
  //   - nothing staged + slot occupied   → "🚶 Disembark"   (instant)
  //   - nothing staged + slot empty      → "🪑 No Change"   (disabled)
  //
  // The "instant disembark" path skips the stage-then-commit dance:
  // since clicking it always means "get them off the bus" when the
  // dropdown is unchanged, we set pendingSlot[slot] = '' and run
  // confirmPending in one tick. That feeds the same dismount-to-
  // adjacent-cell pipeline as a normally-staged disembark.
  function renderMoveHere(slot: SlotKey, accent: string) {
    const pending = pendingSlot[slot]
    const hasPending = pending !== undefined
    const submitting = submittingSlot.has(slot)
    const savedId = getSavedSlotValue(slot)
    const clearing = hasPending && !pending
    const boarding = hasPending && !!pending
    // "Instant disembark" - no pending stage, but the seat already
    // has someone in it. Treat the button as a one-click eject.
    const instantDisembark = !hasPending && !!savedId
    const noOp = !hasPending && !savedId
    const label = submitting ? '...'
      : clearing || instantDisembark ? '🚶 Disembark'
      : boarding ? '🪑 Board'
      : '🪑 No Change'
    const title = submitting ? 'Working...'
      : clearing ? 'Click to remove them from this seat and place their token next to the bus'
      : boarding ? 'Click to seat them - their token vanishes into the vehicle'
      : instantDisembark ? 'Click to drop the current occupant off next to the bus'
      : 'Change the dropdown to stage a board, or pick someone in a seat to disembark'
    return (
      <button
        onClick={async () => {
          if (hasPending) {
            await confirmPending(slot)
            return
          }
          if (instantDisembark) {
            // One-click eject - bypass the pendingSlot stage and pass
            // the empty value directly. Same dismount-to-adjacent
            // code path as a normally-staged disembark.
            await confirmPending(slot, '')
          }
        }}
        disabled={noOp || submitting || !canEdit}
        title={title}
        style={{
          padding: '6px 10px',
          background: noOp ? '#242424' : '#1a2e10',
          border: `1px solid ${noOp ? '#3a3a3a' : accent}`,
          borderRadius: '3px',
          color: noOp ? '#5a5550' : accent,
          fontSize: '13px',
          fontFamily: 'Carlito, sans-serif',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          cursor: noOp || submitting ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ background: '#0f0f0f', color: '#f5f2ee', minHeight: '100vh', fontFamily: 'Carlito, sans-serif', padding: '16px' }}>

      {/* Header - Vehicle Inspection Record style */}
      <div style={{ borderBottom: '2px solid #c0392b', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Vehicle Inspection Record</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{vehicle.name}</div>
          <span style={{ fontSize: '14px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{vehicle.type}</span>
          <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>Rarity: {vehicle.rarity}</span>
        </div>
        {vehicle.three_words && <div style={{ fontSize: '14px', color: '#d4cfc9', fontStyle: 'italic', marginTop: '4px' }}>"{vehicle.three_words}"</div>}
      </div>

      {/* Crew & Checks - Driver + Navigator side by side; Brewer
          below (only if has_still). Each row: dropdown -> MOVE HERE
          -> check button. Confirm chip drops below the row when a
          pending change exists. Navigator now lives here (promoted
          up from the old Passenger Seats section) and gets its own
          NAVIGATE button next to MOVE HERE. */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Crew &amp; Checks</div>
        {/* Top row: Driver | Navigator (always 2 cols, regardless of has_still) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: vehicle.has_still ? '12px' : 0 }}>
          {/* Driver */}
          <div>
            <div style={lbl}>Driver</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
              <select value={pendingSlot['driver'] ?? (vehicle.driver_character_id ?? '')}
                onChange={e => stagePending('driver', e.target.value)}
                disabled={!canEdit}
                style={{ flex: 1, minWidth: 0, padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                <option value="">- Select driver -</option>
                {crew.filter(c => c.kind === 'pc').length > 0 && (
                  <optgroup label="Player Characters">
                    {crew.filter(c => c.kind === 'pc').map(c => renderCrewOption(c, ` (DEX +${c.dex} · Driving +${c.drivingLevel})`))}
                  </optgroup>
                )}
                {crew.filter(c => c.kind === 'npc').length > 0 && (
                  <optgroup label="NPCs">
                    {crew.filter(c => c.kind === 'npc').map(c => renderCrewOption(c, ` (DEX +${c.dex} · Driving +${c.drivingLevel})`))}
                  </optgroup>
                )}
              </select>
              {renderMoveHere('driver', '#7fc458')}
              <button onClick={() => openCheck('driving')}
                disabled={!vehicle.driver_character_id}
                style={{ padding: '6px 14px', background: vehicle.driver_character_id ? '#1a3a5c' : '#242424', border: `1px solid ${vehicle.driver_character_id ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: vehicle.driver_character_id ? '#7ab3d4' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: vehicle.driver_character_id ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
                🚗 Driving Check
              </button>
            </div>
          </div>

          {/* Navigator (promoted from Passenger Seats - has its own
              NAVIGATE check button with a swappable skill picker). */}
          <div>
            <div style={lbl}>Navigator</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
              <select value={pendingSlot['navigator'] ?? (vehicle.navigator_character_id ?? '')}
                onChange={e => stagePending('navigator', e.target.value)}
                disabled={!canEdit}
                style={{ flex: 1, minWidth: 0, padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                <option value="">- Empty -</option>
                {crew.filter(c => c.kind === 'pc').length > 0 && (
                  <optgroup label="Player Characters">
                    {crew.filter(c => c.kind === 'pc').map(c => renderCrewOption(c, ` (ACU +${c.attributes['ACU'] ?? 0} · Nav +${c.skillByName['Navigation'] ?? 0})`))}
                  </optgroup>
                )}
                {crew.filter(c => c.kind === 'npc').length > 0 && (
                  <optgroup label="NPCs">
                    {crew.filter(c => c.kind === 'npc').map(c => renderCrewOption(c, ''))}
                  </optgroup>
                )}
              </select>
              {renderMoveHere('navigator', '#7fc458')}
              <button onClick={() => openCheck('navigate')}
                disabled={!vehicle.navigator_character_id}
                title="Default Navigation (ACU) - swap to any skill in the modal if a player has made the case"
                style={{ padding: '6px 14px', background: vehicle.navigator_character_id ? '#241a3a' : '#242424', border: `1px solid ${vehicle.navigator_character_id ? '#a78bfa' : '#3a3a3a'}`, borderRadius: '3px', color: vehicle.navigator_character_id ? '#a78bfa' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: vehicle.navigator_character_id ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
                🧭 Navigate
              </button>
            </div>
          </div>
        </div>

        {/* Brewer - full row below Driver/Navigator, only if has_still */}
        {vehicle.has_still && (
          <div>
            <div style={lbl}>Brewer</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
              <select value={pendingSlot['brewer'] ?? (vehicle.brewer_character_id ?? '')}
                onChange={e => stagePending('brewer', e.target.value)}
                disabled={!canEdit}
                style={{ flex: 1, minWidth: 0, padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                <option value="">- Select brewer -</option>
                {crew.filter(c => c.kind === 'pc').length > 0 && (
                  <optgroup label="Player Characters">
                    {crew.filter(c => c.kind === 'pc').map(c => renderCrewOption(c, ` (M* ${signed(c.mechanicLevel)} · Tink ${signed(c.tinkererLevel)})`))}
                  </optgroup>
                )}
                {crew.filter(c => c.kind === 'npc').length > 0 && (
                  <optgroup label="NPCs">
                    {crew.filter(c => c.kind === 'npc').map(c => renderCrewOption(c, ` (M* ${signed(c.mechanicLevel)} · Tink ${signed(c.tinkererLevel)})`))}
                  </optgroup>
                )}
              </select>
              {renderMoveHere('brewer', '#7fc458')}
              <button onClick={() => openCheck('brew')}
                disabled={!vehicle.brewer_character_id}
                style={{ padding: '6px 14px', background: vehicle.brewer_character_id ? '#3a2516' : '#242424', border: `1px solid ${vehicle.brewer_character_id ? '#b87333' : '#3a3a3a'}`, borderRadius: '3px', color: vehicle.brewer_character_id ? '#b87333' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: vehicle.brewer_character_id ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
                ⚗️ Brew Check
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Passenger Seats - 6 numbered slots, 2-col grid. Navigator
          lives in Crew & Checks now (promoted up). When the vehicle
          token moves, everyone here moves with it (TacticalMap drag
          path + popout MOVE button path both call
          syncVehiclePassengers). */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Passenger Seats</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const seat = (vehicle.passenger_seats ?? [])[i] ?? null
            const slotKey: SlotKey = `passenger:${i}`
            return (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ ...lbl, marginBottom: 0, flexShrink: 0, width: '64px' }}>Seat {i + 1}</span>
                  <select value={pendingSlot[slotKey] ?? (seat?.character_id ?? '')}
                    onChange={e => stagePending(slotKey, e.target.value)}
                    disabled={!canEdit}
                    style={{ flex: 1, minWidth: 0, padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                    <option value="">- Empty -</option>
                    {crew.filter(c => c.kind === 'pc').length > 0 && (
                      <optgroup label="Player Characters">
                        {crew.filter(c => c.kind === 'pc').map(c => renderCrewOption(c, ''))}
                      </optgroup>
                    )}
                    {crew.filter(c => c.kind === 'npc').length > 0 && (
                      <optgroup label="NPCs">
                        {crew.filter(c => c.kind === 'npc').map(c => renderCrewOption(c, ''))}
                      </optgroup>
                    )}
                  </select>
                  {renderMoveHere(slotKey, '#7fc458')}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: '13px', color: '#5a5550', fontStyle: 'italic', marginTop: '6px' }}>
          When this vehicle's token moves on the tactical map, everyone seated here moves with it.
        </div>
      </div>

      {(vehicle.mounted_weapons?.length ?? 0) > 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Mounted Weapons</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {vehicle.mounted_weapons!.map((w, i) => {
              const def = getWeaponByName(w.name)
              return (
                <div key={i} style={{ background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>{w.name}</span>
                    {def && (
                      <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        {def.range} · {def.damage} · {def.rpPercent}% RP
                      </span>
                    )}
                  </div>
                  {w.notes && <div style={{ fontSize: '13px', color: '#5a5550', fontStyle: 'italic', marginBottom: '6px' }}>{w.notes}</div>}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ ...lbl, marginBottom: 0, flexShrink: 0 }}>Shooter</span>
                    <select value={pendingSlot[`shooter:${i}` as SlotKey] ?? (w.shooter_character_id ?? '')}
                      onChange={e => stagePending(`shooter:${i}` as SlotKey, e.target.value)}
                      disabled={!canEdit}
                      style={{ flex: 1, padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                      <option value="">- Select shooter -</option>
                      {crew.filter(c => c.kind === 'pc').length > 0 && (
                        <optgroup label="Player Characters">
                          {crew.filter(c => c.kind === 'pc').map(c => renderCrewOption(c, ` (DEX +${c.dex} · RC +${c.rangedCombatLevel})`))}
                        </optgroup>
                      )}
                      {crew.filter(c => c.kind === 'npc').length > 0 && (
                        <optgroup label="NPCs">
                          {crew.filter(c => c.kind === 'npc').map(c => renderCrewOption(c, ` (DEX +${c.dex} · RC +${c.rangedCombatLevel})`))}
                        </optgroup>
                      )}
                    </select>
                    {renderMoveHere(`shooter:${i}` as SlotKey, '#7fc458')}
                    <button onClick={() => openCheck('attack', i)}
                      disabled={!w.shooter_character_id}
                      style={{ padding: '6px 14px', background: w.shooter_character_id ? '#2a1210' : '#242424', border: `1px solid ${w.shooter_character_id ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', color: w.shooter_character_id ? '#f5a89a' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: w.shooter_character_id ? 'pointer' : 'not-allowed' }}>
                      🎯 Attack
                    </button>
                    {/* Cross-window arc toggle. Broadcasts to the
                        tactical map's tactical_${campaignId} channel
                        - it listens for firing_arc_toggle and flips
                        the cone overlay for every token whose name
                        matches this vehicle. Disabled when the
                        weapon has no arc data set (older seeds). */}
                    {typeof w.mount_angle === 'number' && typeof w.arc_degrees === 'number' && (
                      <button onClick={() => {
                          if (!campaignId) return
                          const ch = supabase.channel(`tactical_${campaignId}`)
                          ch.subscribe(async (status: string) => {
                            if (status !== 'SUBSCRIBED') return
                            await ch.send({
                              type: 'broadcast',
                              event: 'firing_arc_toggle',
                              payload: { vehicleName: vehicle.name, weaponIdx: i },
                            })
                            // Tear down right after - this popout
                            // doesn't otherwise listen on this channel.
                            await supabase.removeChannel(ch)
                          })
                        }}
                        title="Toggle the firing-arc cone on the tactical map"
                        style={{ padding: '6px 14px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        🎯 Show Arc
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Left column */}
        <div>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '16px' }}>
            {[
              { label: 'Size', value: vehicle.size },
              { label: 'Speed', value: vehicle.speed },
              { label: 'Pass', value: vehicle.passengers },
              { label: 'Enc', value: vehicle.encumbrance },
              { label: 'Range', value: vehicle.range },
            ].map(s => (
              <div key={s.label} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
                <div style={lbl}>{s.label}</div>
                <div style={bigVal}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Vehicle image */}
          {vehicle.image_url && (
            <div style={{ marginBottom: '16px' }}>
              <img src={vehicle.image_url} alt={vehicle.name} style={{ width: '100%', borderRadius: '4px', border: '1px solid #2e2e2e' }} />
            </div>
          )}

          {/* WP */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={lbl}>Wound Points</span>
              <span style={{ fontSize: '18px', color: wpColor, fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>{vehicle.wp_current} / {vehicle.wp_max}</span>
              {canEdit && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button onClick={() => updateVehicle({ ...vehicle, wp_current: Math.max(0, vehicle.wp_current - 1) })} style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>-1</button>
                  <button onClick={() => updateVehicle({ ...vehicle, wp_current: Math.min(vehicle.wp_max, vehicle.wp_current + 1) })} style={{ padding: '2px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>+1</button>
                </div>
              )}
            </div>
            <div style={{ height: '10px', background: '#242424', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${wpPct * 100}%`, background: wpColor, borderRadius: '5px', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Stress */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={lbl}>Stress</span>
              <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: vehicle.stress >= 4 ? '#c0392b' : vehicle.stress >= 2 ? '#EF9F27' : '#7fc458' }}>{vehicle.stress} / 5</span>
              {canEdit && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button onClick={() => updateVehicle({ ...vehicle, stress: Math.max(0, vehicle.stress - 1) })} style={{ padding: '2px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>-</button>
                  <button onClick={() => updateVehicle({ ...vehicle, stress: Math.min(5, vehicle.stress + 1) })} style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>+</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{ flex: 1, height: '10px', borderRadius: '3px', background: i < vehicle.stress ? (i >= 4 ? '#c0392b' : i >= 2 ? '#EF9F27' : '#7fc458') : '#242424', border: '1px solid #3a3a3a' }} />
              ))}
            </div>
          </div>

          {/* Fuel - pips render at half-day granularity (fuel_max * 2
              pips, each = 0.5 days). Manual buttons step by ±0.5; the
              brew flow continues to grant +1 day per success. */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={lbl}>Fuel Reserves</span>
              <span style={{ fontSize: '18px', color: '#EF9F27', fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>
                {Number.isInteger(vehicle.fuel_current) ? vehicle.fuel_current : vehicle.fuel_current.toFixed(1)} / {vehicle.fuel_max} days
              </span>
              {canEdit && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button onClick={() => updateVehicle({ ...vehicle, fuel_current: Math.max(0, +(vehicle.fuel_current - 0.5).toFixed(1)) })} title="Subtract half a day"
                    style={{ padding: '2px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>-½</button>
                  <button onClick={() => updateVehicle({ ...vehicle, fuel_current: Math.min(vehicle.fuel_max, +(vehicle.fuel_current + 0.5).toFixed(1)) })} title="Add half a day"
                    style={{ padding: '2px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>+½</button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: vehicle.fuel_max * 2 }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: '14px', borderRadius: '3px', background: vehicle.fuel_current >= (i + 1) * 0.5 ? '#EF9F27' : '#242424', border: '1px solid #3a3a3a' }} />
              ))}
            </div>
          </div>

          {/* Fuel Storage Expansion (Q4-c, 2026-05-19). Only renders for
              vehicles that have fuel_storage_max > fuel_max_base (i.e.,
              feature opted-in via the seed or backfill). Install pulls
              a 55-Gallon Drum out of cargo and bumps fuel_max by 1;
              Remove returns the drum to cargo and decrements fuel_max
              (clamping fuel_current down if it'd exceed the new cap). */}
          {vehicle.fuel_storage_max != null
            && vehicle.fuel_storage_max > effectiveFuelMaxBase(vehicle) && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={lbl}>Fuel Storage</span>
                <span style={{ fontSize: '15px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
                  {installedDrumCount(vehicle)} / {(vehicle.fuel_storage_max ?? 0) - effectiveFuelMaxBase(vehicle)} drum{installedDrumCount(vehicle) === 1 ? '' : 's'} installed
                  &nbsp;·&nbsp;
                  <span style={{ color: '#5a5550' }}>{drumsInCargo(vehicle.cargo)} in cargo</span>
                </span>
                {canEdit && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => {
                        const r = removeFuelDrum(vehicle)
                        if (r.error || !r.vehicle) {
                          setFuelStorageError(r.error ?? 'Unknown error')
                          return
                        }
                        setFuelStorageError(null)
                        updateVehicle(r.vehicle)
                      }}
                      disabled={installedDrumCount(vehicle) === 0}
                      title={installedDrumCount(vehicle) === 0 ? 'No drums installed' : 'Uninstall one drum (returns to cargo)'}
                      style={{ padding: '2px 8px', background: installedDrumCount(vehicle) > 0 ? '#2a1210' : '#1a1a1a', border: `1px solid ${installedDrumCount(vehicle) > 0 ? '#c0392b' : '#2e2e2e'}`, borderRadius: '3px', color: installedDrumCount(vehicle) > 0 ? '#f5a89a' : '#3a3a3a', fontSize: '13px', cursor: installedDrumCount(vehicle) > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>− Uninstall</button>
                    <button
                      onClick={() => {
                        const r = installFuelDrum(vehicle)
                        if (r.error || !r.vehicle) {
                          setFuelStorageError(r.error ?? 'Unknown error')
                          return
                        }
                        setFuelStorageError(null)
                        updateVehicle(r.vehicle)
                      }}
                      disabled={remainingDrumCapacity(vehicle) === 0 || drumsInCargo(vehicle.cargo) === 0}
                      title={remainingDrumCapacity(vehicle) === 0 ? 'At cap' : drumsInCargo(vehicle.cargo) === 0 ? 'No 55-Gallon Drum in cargo' : 'Install one drum (+1 day of fuel storage)'}
                      style={{ padding: '2px 8px', background: (remainingDrumCapacity(vehicle) > 0 && drumsInCargo(vehicle.cargo) > 0) ? '#1a2e10' : '#1a1a1a', border: `1px solid ${(remainingDrumCapacity(vehicle) > 0 && drumsInCargo(vehicle.cargo) > 0) ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: (remainingDrumCapacity(vehicle) > 0 && drumsInCargo(vehicle.cargo) > 0) ? '#7fc458' : '#3a3a3a', fontSize: '13px', cursor: (remainingDrumCapacity(vehicle) > 0 && drumsInCargo(vehicle.cargo) > 0) ? 'pointer' : 'not-allowed', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>+ Install</button>
                  </div>
                )}
              </div>
              {fuelStorageError && (
                <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>{fuelStorageError}</div>
              )}
              <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                Base capacity {effectiveFuelMaxBase(vehicle)} days · cap {vehicle.fuel_storage_max} days. Each 55-Gallon Drum installed adds 1 day of fuel storage.
              </div>
            </div>
          )}

          {/* Brewing Supplies stockpile (Q4-d, 2026-05-19). Renders for
              vehicles where brewing_supplies_max > 0 (feature opt-in).
              Per canon: 1 day of gathering materials + 1 day of distilling
              produces 2 days of fuel. The stockpile lets the party gather
              ahead so they can brew on consecutive days. Brew check is
              blocked when current = 0 (per Q4-d spec - see rollCheck).
              [Gather] is a passive 1-day action, no dice (per Q4-d 2a):
              clicking just bumps current by 1 and logs a feed event. */}
          {effectiveBrewingMax(vehicle) > 0 && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={lbl}>Brewing Supplies</span>
                <span style={{ fontSize: '15px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
                  {currentBrewingSupplies(vehicle)} / {effectiveBrewingMax(vehicle)} days
                </span>
                {canEdit && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <button
                      onClick={async () => {
                        const r = gatherMaterials(vehicle)
                        if (r.error || !r.vehicle) {
                          setBrewingSuppliesError(r.error ?? 'Unknown error')
                          return
                        }
                        setBrewingSuppliesError(null)
                        await updateVehicle(r.vehicle)
                        // Feed broadcast (gather_materials event tag).
                        // Verbatim renderer in lib/roll-helpers.ts returns
                        // the label as-is. Best-effort: a failed insert
                        // doesn't undo the gather; supplies counter is
                        // the source of truth.
                        if (campaignId && myUserId) {
                          const newCur = r.vehicle.brewing_supplies_current ?? 1
                          await insertRollLog({
                            campaign_id: campaignId,
                            user_id: myUserId,
                            character_name: null,
                            label: `${vehicle.name} stockpile updated - gathered 1 day of brewing materials (now ${newCur}/${effectiveBrewingMax(vehicle)})`,
                            die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0,
                            outcome: 'gather_materials',
                          })
                        }
                      }}
                      disabled={!canGatherMaterials(vehicle)}
                      title={!canGatherMaterials(vehicle) ? 'Stockpile is full' : 'Spend 1 day gathering raw materials (+1 supply)'}
                      style={{ padding: '2px 8px', background: canGatherMaterials(vehicle) ? '#1a2e10' : '#1a1a1a', border: `1px solid ${canGatherMaterials(vehicle) ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: canGatherMaterials(vehicle) ? '#7fc458' : '#3a3a3a', fontSize: '13px', cursor: canGatherMaterials(vehicle) ? 'pointer' : 'not-allowed', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>+ Gather Materials</button>
                  </div>
                )}
              </div>
              {brewingSuppliesError && (
                <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>{brewingSuppliesError}</div>
              )}
              <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                Brew check consumes 1 day per attempt (success or fail). Brew is blocked when supplies hit 0.
              </div>
            </div>
          )}

          {/* Floorplan */}
          {(vehicle as any).floorplan_url && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginTop: '12px' }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Floorplan</div>
              <img src={(vehicle as any).floorplan_url} alt="Floorplan"
                onClick={() => setFloorplanEnlarged(true)}
                title="Click to enlarge"
                style={{ width: '100%', borderRadius: '3px', border: '1px solid #2e2e2e', cursor: 'zoom-in' }} />
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Cargo & Equipment */}
          {(() => {
            // Normalize cargo for read so legacy { name, qty, notes }
            // rows pick up enc=0 / rarity=Common defaults. Display only;
            // writes go through the new unified shape.
            const normalizedCargo: InventoryItem[] = (vehicle.cargo ?? []).map(normalizeInventoryItem)
            const cargoTotalEnc = normalizedCargo.reduce((s, i) => s + i.enc * i.qty, 0)
            const overloaded = cargoTotalEnc > vehicle.encumbrance
            return (
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>
              <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', flex: 1 }}>Cargo & Equipment</div>
              <div style={{ fontSize: '13px', color: overloaded ? '#c0392b' : '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', marginRight: '8px' }}
                title={overloaded ? `OVERLOADED - cargo ${cargoTotalEnc} exceeds vehicle capacity ${vehicle.encumbrance}` : 'Cargo enc total / vehicle capacity'}>
                {cargoTotalEnc} / {vehicle.encumbrance}{overloaded && <span style={{ marginLeft: '6px', color: '#c0392b', fontWeight: 700 }}>OVERLOADED</span>}
              </div>
              {canEdit && (
                <button onClick={() => setShowAddCargo(!showAddCargo)}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                  {showAddCargo ? 'Cancel' : '+ Add'}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
              {normalizedCargo.map((item, idx) => (
                <div key={`${item.name}-${idx}`} style={{ display: 'flex', alignItems: 'baseline', gap: '4px', padding: '3px 0', borderBottom: '1px solid #1a1a1a', fontSize: '15px' }}>
                  <span style={{ color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
                    {item.name}
                    {item.qty > 1 && <span style={{ color: '#7ab3d4' }}> ×{item.qty}</span>}
                  </span>
                  {item.enc > 0 && (
                    <span style={{ color: '#7ab3d4', fontSize: '13px' }} title={`${item.enc} enc per item`}>
                      [{item.enc * item.qty}]
                    </span>
                  )}
                  {item.notes && <span style={{ color: '#5a5550', fontSize: '14px' }}>{item.notes}</span>}
                  {canEdit && (
                    <button onClick={() => {
                      // Use the underlying raw cargo array for writes -
                      // splice the matching index, decrement qty if > 1,
                      // else drop.
                      const raw = vehicle.cargo ?? []
                      const newCargo = item.qty > 1
                        ? raw.map((c, i) => i === idx ? { ...normalizeInventoryItem(c), qty: normalizeInventoryItem(c).qty - 1 } : c)
                        : raw.filter((_, i) => i !== idx)
                      updateVehicle({ ...vehicle, cargo: newCargo as any })
                    }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3a3a3a', fontSize: '14px', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f5a89a')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>×</button>
                  )}
                </div>
              ))}
            </div>
            {showAddCargo && (
              <div style={{ marginTop: '8px', padding: '8px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', position: 'relative' }}>
                  <input value={addName} onChange={e => {
                    setAddName(e.target.value)
                    // Exact-match autofill kept as a backstop for users
                    // who prefer typing the full name + Enter. The new
                    // dropdown below also writes enc when clicked.
                    const match = findEquipmentByName(e.target.value)
                    if (match) setAddEnc(String(match.enc))
                  }} placeholder="Type to search catalog…"
                    autoFocus style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }} />
                  <input value={addQty} onChange={e => setAddQty(e.target.value)} type="number" min="1" placeholder="Qty"
                    style={{ width: '50px', padding: '5px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', textAlign: 'center' }} />
                  <input value={addEnc} onChange={e => setAddEnc(e.target.value)} type="number" min="0" placeholder="Enc"
                    title="Encumbrance per item - counts toward the vehicle's capacity"
                    style={{ width: '52px', padding: '5px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', textAlign: 'center' }} />
                </div>
                {/* Live catalog autocomplete - filters EQUIPMENT by
                    case-insensitive name OR notes substring as the user
                    types. Clicking a row fills name + enc + sensible
                    default notes so the GM doesn't have to know exact
                    spellings. Stays hidden until the user has typed at
                    least one character; renders nothing on no-match so
                    custom items can still be added by clicking Add Item
                    without picking from the list. */}
                {addName.trim().length > 0 && (() => {
                  const q = addName.trim().toLowerCase()
                  const matches = EQUIPMENT
                    .filter(eq => eq.name.toLowerCase().includes(q) || (eq.notes ?? '').toLowerCase().includes(q))
                    .slice(0, 8)
                  if (matches.length === 0) return null
                  // Don't show the dropdown when the typed text is an
                  // exact match - the autofill above already handled it
                  // and the dropdown becomes noise.
                  if (matches.length === 1 && matches[0].name.toLowerCase() === q) return null
                  return (
                    <div style={{ marginBottom: '6px', maxHeight: '180px', overflowY: 'auto', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px' }}>
                      {matches.map(eq => (
                        <div key={eq.name}
                          onClick={() => {
                            setAddName(eq.name)
                            setAddEnc(String(eq.enc))
                            // Pre-fill notes only if the user hasn't
                            // already typed something custom there. The
                            // catalog notes are usually a tier hint
                            // ("Common", "300 rounds standard") that the
                            // GM may want to keep or replace.
                            if (!addNotes.trim() && eq.notes) setAddNotes(eq.notes)
                          }}
                          style={{ padding: '5px 8px', cursor: 'pointer', borderBottom: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', gap: '8px' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1 }}>{eq.name}</span>
                          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>Enc {eq.enc}</span>
                          <span style={{ fontSize: '13px', color: rarityColor(eq.rarity), fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{eq.rarity}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Notes (e.g. 300 rounds each)"
                  style={{ width: '100%', padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', marginBottom: '6px' }} />
                <button onClick={() => {
                  if (!addName.trim() || !vehicle) return
                  const trimmedName = addName.trim()
                  const qty = Math.max(1, parseInt(addQty, 10) || 1)
                  const enc = Math.max(0, parseInt(addEnc, 10) || 0)
                  // Match the new shape - include enc/rarity/custom so
                  // future writes stay consistent. Catalog hit sets
                  // custom=false; otherwise treated as a custom item.
                  const catalogHit = findEquipmentByName(trimmedName)
                  const raw = vehicle.cargo ?? []
                  const existingIdx = raw.findIndex(c => normalizeInventoryItem(c).name === trimmedName)
                  const newItem: InventoryItem = {
                    name: trimmedName,
                    qty,
                    enc,
                    rarity: catalogHit?.rarity ?? 'Common',
                    notes: addNotes.trim() || (catalogHit?.notes ?? ''),
                    custom: !catalogHit,
                  }
                  const newCargo: InventoryItem[] = existingIdx >= 0
                    ? raw.map((c, i) => i === existingIdx
                        ? { ...normalizeInventoryItem(c), qty: normalizeInventoryItem(c).qty + qty }
                        : normalizeInventoryItem(c))
                    : [...raw.map(normalizeInventoryItem), newItem]
                  updateVehicle({ ...vehicle, cargo: newCargo })
                  setAddName(''); setAddQty('1'); setAddEnc('0'); setAddNotes(''); setShowAddCargo(false)
                }} disabled={!addName.trim()}
                  style={{ width: '100%', padding: '6px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: addName.trim() ? 'pointer' : 'not-allowed', opacity: addName.trim() ? 1 : 0.5 }}>
                  Add Item
                </button>
              </div>
            )}
          </div>
            )
          })()}

          {/* Operator Notes */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>
              <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', flex: 1 }}>Operator Notes</div>
              {canEdit && (
                <button onClick={() => { setEditingNotes(!editingNotes); setNotesValue(vehicle.notes) }}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                  {editingNotes ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div>
                <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={6}
                  style={{ width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
                <button onClick={() => { updateVehicle({ ...vehicle, notes: notesValue }); setEditingNotes(false) }}
                  style={{ marginTop: '6px', padding: '6px 16px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Save</button>
              </div>
            ) : (
              <div style={{ fontSize: '16px', color: '#cce0f5', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{vehicle.notes || 'No notes.'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Check modal - Driving or Brew. Inputs prefilled from the assigned
          crew member's stats; result writes a row to roll_log and (for
          brew Success / Wild Success) bumps fuel_current. */}
      {/* Vehicle check modal - migrated 2026-05-20 from a bespoke
          ModalBackdrop shell to the canonical <RollModal> shell used
          by Stabilize / Distract / Recruit / FI / Gut Instinct / Stress
          Check / etc. The four `check.kind` variants (driving / brew /
          navigate / attack) all flow through one <RollModal> with
          conditional pre-roll extras (target picker, skill picker,
          brew-skill toggle). AMOD/SMOD are now read-only chips for
          uniformity with the rest of the codebase - mid-roll tuning
          happens via the brew/navigate skill picker (auto-recomputes
          AMOD+SMOD) or by swapping the crew member. CMOD remains
          GM-tunable as in every other modal. */}
      {check && vehicle && (() => {
        const member = crew.find(c => c.id === check.crewId)
        const modalWeapon = check.kind === 'attack' && check.weaponIndex != null
          ? vehicle.mounted_weapons?.[check.weaponIndex]
          : undefined
        const modalWeaponDef = modalWeapon ? getWeaponByName(modalWeapon.name) : undefined
        const title = check.kind === 'driving'
          ? 'Driving Check'
          : check.kind === 'brew'
            ? 'Brew Check'
            : check.kind === 'navigate'
              ? 'Navigate Check'
              : `${modalWeapon?.name ?? 'Mounted Weapon'} Attack`
        const subtitle = `${member?.name ?? '-'} · ${vehicle.name}`
        const sharedResult: SharedRollResult | null = check.result ? {
          die1: check.result.die1,
          die2: check.result.die2,
          amod: check.amod,
          smod: check.smod,
          cmod: check.cmod,
          total: check.result.total,
          outcome: check.result.outcome,
          insightAwarded: check.result.outcome === 'High Insight' || check.result.outcome === 'Low Insight',
        } : null
        const arcBlocked = check.kind === 'attack'
          && !!check.targetNpcId
          && check.targets?.find(t => t.id === check.targetNpcId)?.inArc === false
        const noTarget = check.kind === 'attack' && !check.targetNpcId
        return (
          <RollModal
            open={true}
            onClose={() => setCheck(null)}
            title={title}
            subtitle={subtitle}
            rollFormula="2d6 + AMOD + SMOD + CMOD"
            amod={check.amod}
            smod={check.smod}
            cmod={check.cmod}
            setCmod={check.result ? undefined : (n => setCheck({ ...check, cmod: n }))}
            rolling={check.rolling}
            rollLabel={`🎲 Roll ${title}`}
            rollDisabled={check.rolling || arcBlocked || noTarget}
            warnings={check.result ? null : (
              <>
                {brewingSuppliesError && (
                  <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', padding: '6px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', textAlign: 'center', marginBottom: '6px' }}>
                    {brewingSuppliesError}
                  </div>
                )}
                {arcBlocked && (
                  <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', padding: '6px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', textAlign: 'center', marginBottom: '6px' }}>
                    ⛔ Outside this weapon&apos;s firing arc. Reposition the vehicle or pick a target in arc.
                  </div>
                )}
                {check.kind === 'attack' && !arcBlocked && check.targetNpcId && check.targets?.find(t => t.id === check.targetNpcId)?.outOfRange && (
                  <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', padding: '6px 10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', textAlign: 'center', marginBottom: '6px' }}>
                    ⚠ Beyond this weapon&apos;s primary range band. Roll allowed but the GM may apply a Range CMod.
                  </div>
                )}
              </>
            )}
            preRollExtras={check.result ? null : (
              <>
                {/* Target picker - NPCs currently on the active scene */}
                {check.kind === 'attack' && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={lbl}>Target</div>
                    {(check.targets?.length ?? 0) === 0 ? (
                      <div style={{ fontSize: '13px', color: '#f5a89a', fontStyle: 'italic', padding: '6px 0' }}>
                        No NPCs on the active scene to target. Place some on the tactical map first.
                      </div>
                    ) : (
                      <select value={check.targetNpcId ?? ''}
                        onChange={e => setCheck({ ...check, targetNpcId: e.target.value || undefined })}
                        style={{ width: '100%', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }}>
                        <option value="">-- Pick a target --</option>
                        {check.targets!.map(t => {
                          const blocked = t.inArc === false
                          const ofr = !!t.outOfRange
                          const tag = blocked ? '⛔ Out of arc' : ofr ? '⚠ Out of range' : ''
                          return (
                            <option key={t.id} value={t.id} disabled={blocked}>
                              {t.name}{tag ? ` - ${tag}` : ''}
                            </option>
                          )
                        })}
                      </select>
                    )}
                  </div>
                )}

                {/* Navigate skill picker - default Navigation (ACU),
                    swappable; AMod/SMod auto-recompute via
                    switchNavigateSkill. */}
                {check.kind === 'navigate' && (() => {
                  const navSkillDef = SKILLS.find(s => s.name === check.navigateSkill)
                  const navAttr = navSkillDef?.attribute ?? 'ACU'
                  return (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={lbl}>Skill</div>
                      <select value={check.navigateSkill ?? 'Navigation'}
                        onChange={e => switchNavigateSkill(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', marginTop: '4px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }}>
                        {SKILLS.map(s => {
                          const lvlHere = member?.skillByName[s.name] ?? 0
                          return (
                            <option key={s.name} value={s.name}>
                              {s.name} ({s.attribute} · Skill +{lvlHere})
                            </option>
                          )
                        })}
                      </select>
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontStyle: 'italic', marginTop: '4px', fontFamily: 'Carlito, sans-serif' }}>
                        Default is Navigation ({navAttr}). Switch if the player has made a case for a different skill.
                      </div>
                    </div>
                  )
                })()}

                {/* Brew skill toggle - Mechanic* (RSN) vs Tinkerer (DEX) */}
                {check.kind === 'brew' && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={lbl}>Skill</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      {(['mechanic', 'tinkerer'] as BrewSkill[]).map(s => {
                        const selected = check.brewSkill === s
                        const label = s === 'mechanic'
                          ? `Mechanic* (RSN ${signed(member?.rsn ?? 0)} · Skill ${signed(member?.mechanicLevel ?? 0)})`
                          : `Tinkerer (DEX ${signed(member?.dex ?? 0)} · Skill ${signed(member?.tinkererLevel ?? 0)})`
                        return (
                          <button key={s} onClick={() => switchBrewSkill(s)}
                            style={{ flex: 1, padding: '6px', background: selected ? '#1a2e10' : '#1a1a1a', border: `1px solid ${selected ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: selected ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
            onRoll={rollCheck}
            result={sharedResult}
            renderOutcome={(r) => (
              <>
                <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', textAlign: 'center' }}>
                  [{r.die1}+{r.die2}]
                  {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
                  {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
                  {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
                  <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: feedOutcomeColor(r.outcome), fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center' }}>
                  {r.outcome}
                </div>
                {/* Brew success: +1 day fuel badge */}
                {check.kind === 'brew' && (r.outcome === 'Success' || r.outcome === 'Wild Success' || r.outcome === 'High Insight') && (
                  <div style={{ padding: '8px 10px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center' }}>
                    ⛽ +1 day fuel produced
                  </div>
                )}
                {/* Attack hit: weapon damage stat reminder for the GM */}
                {check.kind === 'attack' && modalWeaponDef && (r.outcome === 'Success' || r.outcome === 'Wild Success' || r.outcome === 'High Insight') && (() => {
                  const targetName = check.targets?.find(t => t.id === check.targetNpcId)?.name
                  return (
                    <div style={{ padding: '8px 10px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center' }}>
                      🎯 Hit{targetName ? ` on ${targetName}` : ''} · damage {modalWeaponDef.damage} · {modalWeaponDef.rpPercent}% RP
                    </div>
                  )
                })()}
                {/* Attack miss: target-unhurt reminder */}
                {check.kind === 'attack' && (r.outcome === 'Failure' || r.outcome === 'Dire Failure' || r.outcome === 'Low Insight') && (() => {
                  const targetName = check.targets?.find(t => t.id === check.targetNpcId)?.name
                  return (
                    <div style={{ padding: '8px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center' }}>
                      ✗ Miss{targetName ? ` (${targetName} unhurt)` : ''}
                    </div>
                  )
                })()}
              </>
            )}
            postRollCloseLabel="Close"
            onPostRollClose={() => setCheck(null)}
          />
        )
      })()}

      {/* Floorplan lightbox - click image to enlarge, click backdrop
          to close. Mirrors the NpcCard portrait enlarge pattern. */}
      {floorplanEnlarged && (vehicle as any).floorplan_url && (
        <div onClick={() => setFloorplanEnlarged(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '2rem' }}>
          <img src={(vehicle as any).floorplan_url} alt="Floorplan"
            style={{ maxWidth: '95vw', maxHeight: '95vh', borderRadius: '4px', border: '2px solid #c0392b', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
