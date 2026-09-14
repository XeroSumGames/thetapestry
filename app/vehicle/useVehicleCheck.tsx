'use client'
// Vehicle skill-check state machine, extracted from app/vehicle/page.tsx
// (2026-05-24) so the LOC-ratcheted popout can stay under its ceiling and
// the combat-adjacent roll path lives in one testable place. Owns the
// `check` state plus openCheck / switchBrewSkill / switchNavigateSkill /
// rollCheck and the shared <RollModal> mount. Behaviour is identical to
// the pre-extraction inline version; the page now just calls openCheck()
// from its buttons and renders the returned `modal`.

import { useState, useRef, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Vehicle } from '../../components/VehicleCard'
import { insertRollLog } from '../../lib/data/roll-log'
import {
  activeSceneWithCellFeet, sceneTokensForTargeting, npcNamesByIds,
  getNpcCombatState, updateNpcPools,
} from '../../lib/data/vehicle'
import { broadcastOnce } from '../../lib/realtime/broadcastOnce'
import { classifyRoll } from '../../lib/community-logic'
import { getWeaponByName } from '../../lib/weapons'
import { rollDamage, calculateDamage } from '../../lib/damage'
import { decrementInitiativeAction } from '../../lib/initiative-actions'
import RollModal, { type RollResult as SharedRollResult } from '../../components/RollModal'
import { outcomeColor as feedOutcomeColor } from '../../lib/roll-helpers'
import { SKILLS } from '../../lib/xse-schema'
import { canBrew, consumeBrewingSupplies, effectiveBrewingMax } from '../../lib/brewing-supplies'
import { applyInstallOutcome, applyGatherOutcome } from '../../lib/vehicle-checks'

// Eligible driver / brewer - a campaign PC or campaign NPC. Stats are
// pulled at load time so the Driving / Brew check modal can prefill
// AMOD + SMOD without a second round trip.
export interface CrewMember {
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

export type CheckKind = 'driving' | 'brew' | 'attack' | 'navigate' | 'install' | 'gather'
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
  // message: install/gather only - the precise effect text from
  // applyInstallOutcome/applyGatherOutcome, shown as a badge in the modal.
  result: { die1: number; die2: number; total: number; outcome: string; message?: string } | null
}

// Render a signed integer for display: '+2' / '-3' / '0'. Used in the
// crew dropdown + brew skill picker labels so negative skill levels
// don't render as "+-3" (hardcoded '+' prefix collided with the
// numeric sign). Post-2026-05-18 playtest: that ugly "+-3" was misread
// as "+3" and reported as "brew showed Mechanic* +3 when the player
// didn't have it."
export function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${n}`
  return '0'
}

const lbl: CSSProperties = { fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em' }

interface UseVehicleCheckParams {
  vehicle: Vehicle | null
  crew: CrewMember[]
  campaignId: string | null
  myUserId: string | null
  supabase: SupabaseClient
  updateVehicle: (updated: Vehicle) => Promise<void>
  brewingSuppliesError: string | null
  setBrewingSuppliesError: (s: string | null) => void
}

export function useVehicleCheck({
  vehicle,
  crew,
  campaignId,
  myUserId,
  supabase,
  updateVehicle,
  brewingSuppliesError,
  setBrewingSuppliesError,
}: UseVehicleCheckParams) {
  const [check, setCheck] = useState<CheckState | null>(null)
  // Synchronous in-flight guard for rollCheck (same pattern as
  // consumeActionInFlightRef in the table page) - setCheck({rolling:true})
  // is an async React state update, so two very fast clicks on Roll
  // before the disabled prop's next render could both pass the
  // !check.rolling check and both roll/apply damage (per the 2026-08-01
  // audit). A plain ref is checked+set synchronously, closing that window.
  const rollingRef = useRef(false)

  async function openCheck(kind: CheckKind, weaponIdx?: number) {
    if (!vehicle) return
    // Install / gather maintenance checks have NO assigned vehicle slot -
    // anyone in the crew can run them. Default the roller to the first
    // crew member; the modal's roller dropdown lets the GM pick someone
    // else (recomputes AMod/SMod via switchRoller).
    if (kind === 'install' || kind === 'gather') {
      if (crew.length === 0) { alert('Add a crew member to run this check.'); return }
      const member = crew[0]
      if (kind === 'install') {
        // Mechanic* (RSN) vs Tinkerer (DEX) - auto-pick the higher (ties
        // -> Mechanic*), GM can flip in the modal. Mirrors brew.
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
        // gather - Scavenging (ACU).
        const skillDef = SKILLS.find(s => s.name === 'Scavenging')
        const attr = skillDef?.attribute ?? 'ACU'
        setCheck({
          kind, crewId: member.id,
          amod: member.attributes[attr] ?? 0,
          smod: member.skillByName['Scavenging'] ?? 0,
          cmod: 0,
          brewSkill: 'mechanic',
          rolling: false, result: null,
        })
      }
      return
    }
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
        const { data: activeScene } = await activeSceneWithCellFeet(campaignId)
        if (activeScene?.id) {
          // One fetch for every visible token on the scene - cheaper
          // than two filtered fetches and gives us the shooter row
          // (matched by name) + all NPC targets (matched by npc_id).
          const { data: tokenRows } = await sceneTokensForTargeting(activeScene.id)
          const allTokens = (tokenRows ?? []) as any[]
          const shooterTok = allTokens.find(t => t.token_type === 'object' && t.name === vehicle.name) ?? null
          const cellFt = activeScene.cell_feet ?? 3
          const npcTokens = allTokens.filter(t => t.npc_id != null)
          const npcIds = Array.from(new Set(npcTokens.map(t => t.npc_id))).filter(Boolean)
          let nameMap: Record<string, string> = {}
          if (npcIds.length > 0) {
            const { data: npcRows } = await npcNamesByIds(npcIds as string[])
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

  // Switch Mechanic* / Tinkerer within the modal - also rewires AMOD/SMOD
  // to the chosen attribute/skill so the GM doesn't have to re-enter them.
  // Used by both the brew check and the install check (same dual-skill).
  function switchBrewSkill(next: BrewSkill) {
    if (!check || (check.kind !== 'brew' && check.kind !== 'install')) return
    const member = crew.find(c => c.id === check.crewId)
    if (!member) return
    setCheck({
      ...check,
      brewSkill: next,
      amod: next === 'tinkerer' ? member.dex : member.rsn,
      smod: next === 'tinkerer' ? member.tinkererLevel : member.mechanicLevel,
    })
  }

  // Switch the roller for an install / gather check (these have no fixed
  // crew slot - any crew member can do them). Recomputes AMOD/SMOD for the
  // new person: install re-picks Mechanic*/Tinkerer (higher wins), gather
  // reads their Scavenging.
  function switchRoller(nextCrewId: string) {
    if (!check || (check.kind !== 'install' && check.kind !== 'gather')) return
    const member = crew.find(c => c.id === nextCrewId)
    if (!member) return
    if (check.kind === 'install') {
      const useTinkerer = member.tinkererLevel > member.mechanicLevel
      setCheck({
        ...check,
        crewId: nextCrewId,
        brewSkill: useTinkerer ? 'tinkerer' : 'mechanic',
        amod: useTinkerer ? member.dex : member.rsn,
        smod: useTinkerer ? member.tinkererLevel : member.mechanicLevel,
      })
    } else {
      const skillDef = SKILLS.find(s => s.name === 'Scavenging')
      const attr = skillDef?.attribute ?? 'ACU'
      setCheck({
        ...check,
        crewId: nextCrewId,
        amod: member.attributes[attr] ?? 0,
        smod: member.skillByName['Scavenging'] ?? 0,
      })
    }
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
    // Synchronous re-entry guard - setCheck({rolling:true}) below is an
    // async React state update, so two very fast clicks on Roll before
    // the button's disabled prop reflects it could both pass this
    // function's initial checks and both roll + apply damage/effects
    // (per the 2026-08-01 audit). Checked+set here, before any async
    // work, closes that window; cleared in the finally below.
    if (rollingRef.current) return
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
    rollingRef.current = true
    try {
    setBrewingSuppliesError(null)
    setCheck({ ...check, rolling: true })
    const die1 = Math.floor(Math.random() * 6) + 1
    const die2 = Math.floor(Math.random() * 6) + 1
    const total = die1 + die2 + check.amod + check.smod + check.cmod
    const outcome = classifyRoll(total, die1, die2)
    const member = crew.find(c => c.id === check.crewId)

    // Maintenance checks (install fuel drum / gather brewing materials).
    // Own resolution path: apply the locked outcome mechanics from
    // lib/vehicle-checks, log a roll, persist the vehicle. No fuel-brew /
    // attack-damage / initiative logic applies to these.
    if (check.kind === 'install' || check.kind === 'gather') {
      const res = check.kind === 'install'
        ? applyInstallOutcome(vehicle, outcome)
        : applyGatherOutcome(vehicle, outcome)
      const skillName = check.kind === 'install'
        ? (check.brewSkill === 'tinkerer' ? 'Tinkerer' : 'Mechanic*')
        : 'Scavenging'
      const verb = check.kind === 'install' ? 'Install' : 'Gather'
      const label = `${member?.name ?? '-'} - ${verb} - ${vehicle.name} (${skillName})`
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
          skillLabel: skillName,
          crewId: check.crewId,
          crewKind: member?.kind ?? null,
          effectMessage: res.message,
        },
      })
      if (res.vehicle) await updateVehicle(res.vehicle)
      setCheck({ ...check, rolling: false, result: { die1, die2, total, outcome, message: res.message } })
      return
    }

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
      const { data: tgtNpc } = await getNpcCombatState(check.targetNpcId)
      const targetDex = (tgtNpc as any)?.dexterity ?? 0
      const { finalWP, finalRP, mitigated } = calculateDamage(totalWP, weaponDef.rpPercent, targetDex)
      // Apply the damage. Clamp at 0 - going negative would let a
      // future heal "uncritically" push the NPC back into combat at
      // weird WP. Don't write wp_max/rp_max; this only mutates
      // current pools.
      if (tgtNpc) {
        const newWp = Math.max(0, ((tgtNpc as any).wp_current ?? 0) - finalWP)
        const newRp = Math.max(0, ((tgtNpc as any).rp_current ?? 0) - finalRP)
        await updateNpcPools(check.targetNpcId, newWp, newRp)
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
      if (dec.ok && dec.reachedZero && campaignId) {
        try {
          await broadcastOnce(`initiative_${campaignId}`, 'turn_advance_requested', { entryId: dec.entry?.id })
        } catch { /* swallow - the GM can advance manually */ }
      }
    }

    setCheck({ ...check, rolling: false, result: { die1, die2, total, outcome } })
    } finally {
      rollingRef.current = false
    }
  }

  // ── The shared <RollModal> mount ──
  // Migrated 2026-05-20 from a bespoke ModalBackdrop shell to the
  // canonical <RollModal> shell used by Stabilize / Distract / Recruit /
  // FI / Gut Instinct / Stress Check / etc. The four `check.kind`
  // variants (driving / brew / navigate / attack) all flow through one
  // <RollModal> with conditional pre-roll extras (target picker, skill
  // picker, brew-skill toggle). AMOD/SMOD are now read-only chips for
  // uniformity with the rest of the codebase - mid-roll tuning happens
  // via the brew/navigate skill picker (auto-recomputes AMOD+SMOD) or by
  // swapping the crew member. CMOD remains GM-tunable as in every other
  // modal.
  const modal = check && vehicle ? (() => {
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
          : check.kind === 'install'
            ? 'Install Fuel Drum'
            : check.kind === 'gather'
              ? 'Gather Materials'
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
        eyebrow="Vehicle"
        accent="#d4883a"
        dimBackdrop={false}
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

            {/* Roller picker - install / gather have no fixed seat, so the
                GM picks who does it from the whole crew. AMod/SMod recompute
                via switchRoller (install re-picks Mechanic or Tinkerer;
                gather reads Scavenging). */}
            {(check.kind === 'install' || check.kind === 'gather') && (
              <div style={{ marginBottom: '12px' }}>
                <div style={lbl}>Who&apos;s doing it</div>
                <select value={check.crewId}
                  onChange={e => switchRoller(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', marginTop: '4px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }}>
                  {crew.map(c => {
                    const suffix = check.kind === 'install'
                      ? ` (M* ${signed(c.mechanicLevel)} / Tink ${signed(c.tinkererLevel)})`
                      : ` (Scavenging ${signed(c.skillByName['Scavenging'] ?? 0)})`
                    return <option key={c.id} value={c.id}>{c.name}{suffix}</option>
                  })}
                </select>
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

            {/* Mechanic* (RSN) vs Tinkerer (DEX) toggle - brew + install */}
            {(check.kind === 'brew' || check.kind === 'install') && (
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
                        style={{ flex: 1, padding: '6px', background: selected ? '#1a2e10' : '#1a1a1a', border: `1px solid ${selected ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: selected ? '#7fc458' : '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
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
            <div style={{ fontSize: '14px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', textAlign: 'center' }}>
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
            {/* Install / gather: the precise effect text from
                applyInstallOutcome/applyGatherOutcome. Bordered by the
                outcome color so success/cost reads at a glance. */}
            {(check.kind === 'install' || check.kind === 'gather') && check.result?.message && (
              <div style={{ padding: '8px 10px', background: '#161616', border: `1px solid ${feedOutcomeColor(r.outcome)}`, borderRadius: '3px', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem', textAlign: 'center' }}>
                {check.result.message}
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
  })() : null

  return { openCheck, modal }
}
