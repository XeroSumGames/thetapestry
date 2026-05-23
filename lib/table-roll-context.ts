// Pure roll/blast math extracted from the table page's executeRoll
// (table re-arch Step 1). No React, no Supabase, no component state - just
// the deterministic combat arithmetic, so it can be unit-tested and reused
// without standing up the 13k-line table page. This is the safety net the
// useRollResolution extraction (Step 3c) rides on. The only import is the
// pure weapon lookup (lib -> lib, no upward dependency).

import { getWeaponByName } from './weapons'

/**
 * Chebyshev (king-move) distance in grid cells. A diagonal step counts as 1,
 * matching how the tactical map measures range and blast radius.
 */
export function cellDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

export interface BlastSplash {
  feet: number
  scale: number // 1.0 at Engaged, 0.5 at Close
  splashWP: number
  splashRP: number
  band: 'Engaged' | 'Close'
}

/**
 * Splash damage for a single token at (tx,ty) from a blast centered at
 * (cx,cy). Returns null when the token is outside blast radius (beyond Close,
 * i.e. > 30 ft).
 *
 * Per CRB p.71-72 + the 2026-04-27 playtest tuning: Engaged (<= 5 ft) takes
 * full blast, Close (<= 30 ft) takes half, anything past Close takes nothing
 * (grenades stop killing bystanders 50 ft away through walls). Splash victims
 * take the RAW blast WP/RP (no primary-target mitigation). WP floors at 1 for
 * anyone caught in radius; RP floors at 0.
 */
export function computeBlastSplash(
  tx: number,
  ty: number,
  cx: number,
  cy: number,
  cellFeet: number,
  blastRawWP: number,
  blastRawRP: number,
): BlastSplash | null {
  const feet = cellDistance(tx, ty, cx, cy) * cellFeet
  if (feet > 30) return null
  const scale = feet <= 5 ? 1.0 : 0.5
  return {
    feet,
    scale,
    splashWP: Math.max(1, Math.floor(blastRawWP * scale)),
    splashRP: Math.max(0, Math.floor(blastRawRP * scale)),
    band: feet <= 5 ? 'Engaged' : 'Close',
  }
}

/**
 * Rounds on the death countdown when a combatant drops to WP 0 (mortally
 * wounded). Canon: 4 + PHY mod, floored at 1 round so a heavily-negative PHY
 * never yields a 0-round (instant) countdown.
 */
export function mortalWoundCountdown(phyMod: number): number {
  return Math.max(1, 4 + phyMod)
}

// --- CMod itemization (3c) ---------------------------------------------------
// The roll modal used to collapse every CMod source into a single net number,
// so a player who Aimed (+2) but fired at long range (-4) just saw "-2 CMod"
// and could not tell their Aim had applied at all. Xero's ruling 2026-05-23:
// itemize CMod by source - Aim is always its OWN positive term and must never
// be silently netted away by target defense. Target defense gets its own term
// too (canon "double duty", app/rules/combat/damage: a defender's MDM/RDM both
// lowers the attacker's to-hit AND mitigates damage - this is the to-hit half).

export interface CmodTerm {
  label: string
  value: number
}

/**
 * Itemized CMod sources for a combat roll. Each is a signed contribution to
 * the attacker's to-hit total; pass the value the way it affects the roll
 * (Aim positive, Range/target-defense/sick negative). Omitted or zero fields
 * drop out of the breakdown. `manual` is the GM's hand-entered adjustment
 * (anything in the modal's CMod field beyond the auto-computed sources) so a
 * manual tweak still shows rather than vanishing.
 */
export interface CmodSources {
  weaponCondition?: number
  aim?: number
  coordinate?: number
  coordinatedEffort?: number
  sameTarget?: number
  targetDefense?: number
  targetDefenseLabel?: string
  range?: number
  sick?: number
  insight?: number
  manual?: number
}

/**
 * Turn the itemized CMod sources into a render-ready, source-labeled term list
 * plus the net total. Terms keep a fixed display order (weapon, aim,
 * coordinate, coordinated-effort, same-target, target-defense, range, sick,
 * insight, manual); zero-valued sources are dropped. `total` is the sum of the
 * kept terms, so the breakdown the player sees always reconciles to the number
 * that hit the roll.
 */
export function buildCmodBreakdown(s: CmodSources): { terms: CmodTerm[]; total: number } {
  // Label convention (Xero 2026-05-23 smoke): the headline Aim and the
  // target Defense Mod (MDM/RDM - "Mod" is already in the name) read clean;
  // every other situational source carries a "CMod" tag so the player can
  // tell it's a Combat Modifier contribution.
  const ordered: CmodTerm[] = [
    { label: 'Weapon CMod', value: s.weaponCondition ?? 0 },
    { label: 'Aim', value: s.aim ?? 0 },
    { label: 'Coordinate CMod', value: s.coordinate ?? 0 },
    { label: 'Coordinated Effort CMod', value: s.coordinatedEffort ?? 0 },
    { label: 'Same target CMod', value: s.sameTarget ?? 0 },
    { label: s.targetDefenseLabel || 'Target defense', value: s.targetDefense ?? 0 },
    { label: 'Range CMod', value: s.range ?? 0 },
    { label: 'Sick CMod', value: s.sick ?? 0 },
    { label: 'Insight CMod', value: s.insight ?? 0 },
    { label: 'CMod', value: s.manual ?? 0 },
  ]
  const terms = ordered.filter(t => t.value !== 0)
  const total = terms.reduce((acc, t) => acc + t.value, 0)
  return { terms, total }
}

// --- Attack CMod resolution (3c-B2) ------------------------------------------
// resolveTargetDefense + computeAttackCmod were closure functions on the table
// page; extracted here verbatim (behavior-preserving) so the prefill and the
// target-dropdown onChange share ONE source of truth and the math is unit-
// tested. Inputs are minimal structural shapes (only the fields actually read)
// so lib never imports the app-side TableEntry / InitiativeEntry types upward;
// the richer page types are structurally compatible.

export interface CmodRapid { PHY?: number | null; DEX?: number | null }
export interface CmodEntry {
  userId: string
  character: { id: string; name: string; data?: { rapid?: CmodRapid | null } | null }
}
export interface CmodNpc { name: string; physicality?: number | null; dexterity?: number | null }
export interface CmodToken { token_type: string; name: string }
export interface CmodInitEntry {
  character_name: string
  character_id?: string | null
  npc_id?: string | null
  is_active?: boolean
  aim_bonus?: number | null
  last_attack_target?: string | null
  coordinate_target?: string | null
  coordinate_bonus?: number | null
  defense_bonus?: number | null
}
export interface CoordEffortState { participantIds: string[]; totalParticipants: number; leadCmod: number }

export interface TargetLookupCtx {
  entries: readonly CmodEntry[]
  npcs: readonly CmodNpc[]
  tokens: readonly CmodToken[]
  initiative: readonly CmodInitEntry[]
}

export interface AttackCmodCtx extends TargetLookupCtx {
  userId: string | null
  // The pendingRoll label at call time (suppresses the coordinated-effort
  // bonus on Group Checks). NOTE: the prefill caller passes the PREVIOUS
  // pendingRoll's label (state lags the new roll within the same tick) - this
  // is preserved as-was; the useRollResolution rebuild (3c-B3) is where the
  // stale-closure read gets a real fix.
  pendingLabel: string
  coordEffort: CoordEffortState | null
}

/**
 * The target's defensive contribution to an attacker's to-hit roll. MDM = Melee
 * Defense Mod (PHY), RDM = Ranged Defense Mod (DEX) - canon names. Objects have
 * no defense (0). Adds the target's initiative defense_bonus (Defend / Take
 * Cover). Returns the POSITIVE defense magnitude + its label; the caller negates
 * it when folding into the attacker's CMod (defense lowers the to-hit).
 */
export function resolveTargetDefense(
  targetName: string,
  isMelee: boolean,
  ctx: TargetLookupCtx,
): { value: number; label: string } {
  const label = isMelee ? 'Target MDM' : 'Target RDM'
  const tEntry = ctx.entries.find(en => en.character.name === targetName)
  const tNpc = !tEntry ? ctx.npcs.find(n => n.name === targetName) : null
  const isObject = !tEntry && !tNpc && ctx.tokens.some(t => t.token_type === 'object' && t.name === targetName)
  if (isObject) return { value: 0, label }
  const rapid: CmodRapid = tEntry?.character.data?.rapid ?? (tNpc ? { PHY: tNpc.physicality ?? 0, DEX: tNpc.dexterity ?? 0 } : {})
  const initEntry = ctx.initiative.find(ie => ie.character_name === targetName)
  const defBonus = initEntry?.defense_bonus ?? 0
  const base = isMelee ? (rapid.PHY ?? 0) : (rapid.DEX ?? 0)
  return { value: base + defBonus, label }
}

/**
 * Auto-computed CMod for an attack roll - the single source of truth for both
 * the modal prefill and the target-dropdown onChange (they used to drift; the
 * old dropdown copy dropped Aim). Returns the itemized `sources` (fed to
 * buildCmodBreakdown) plus the `net` for the modal's CMod field. Range / sick /
 * insight are layered on later in executeRoll, not here.
 */
export function computeAttackCmod(
  targetName: string,
  weapon: { weaponName: string; conditionCmod?: number | null },
  ctx: AttackCmodCtx,
): { net: number; sources: CmodSources } {
  const activeEntry = ctx.initiative.find(e => e.is_active)
  const aim = activeEntry?.aim_bonus ?? 0
  const weaponCondition = weapon.conditionCmod ?? 0
  let coordinatedEffort = 0
  const cef = ctx.coordEffort
  if (cef && !ctx.pendingLabel.startsWith('Group Check - ')) {
    const myEntry = ctx.entries.find(e => e.userId === ctx.userId)
    const myCharId = myEntry?.character.id
    if (myCharId && cef.participantIds.includes(myCharId)) {
      coordinatedEffort = (cef.totalParticipants - 1) + cef.leadCmod
    }
  }
  const w = getWeaponByName(weapon.weaponName)
  const isMelee = w?.category === 'melee'
  const def = resolveTargetDefense(targetName, isMelee, ctx)
  const myInitEntry = ctx.initiative.find(ie =>
    (activeEntry?.character_id && ie.character_id === activeEntry.character_id) ||
    (activeEntry?.npc_id && ie.npc_id === activeEntry.npc_id) ||
    ie.character_name === activeEntry?.character_name
  )
  const coordinate = (myInitEntry?.coordinate_target === targetName) ? (myInitEntry?.coordinate_bonus ?? 0) : 0
  const sameTarget = (activeEntry?.last_attack_target === targetName) ? 1 : 0
  const sources: CmodSources = {
    weaponCondition, aim, coordinatedEffort, coordinate, sameTarget,
    targetDefense: -def.value, targetDefenseLabel: def.label,
  }
  const net = weaponCondition + aim + coordinatedEffort + coordinate + sameTarget - def.value
  return { net, sources }
}
