// Pure roll/blast math extracted from the table page's executeRoll
// (table re-arch Step 1). No React, no Supabase, no component state - just
// the deterministic combat arithmetic, so it can be unit-tested and reused
// without standing up the 13k-line table page. This is the safety net the
// useRollResolution extraction (Step 3c) rides on.

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
  const ordered: CmodTerm[] = [
    { label: 'Weapon', value: s.weaponCondition ?? 0 },
    { label: 'Aim', value: s.aim ?? 0 },
    { label: 'Coordinate', value: s.coordinate ?? 0 },
    { label: 'Coordinated Effort', value: s.coordinatedEffort ?? 0 },
    { label: 'Same target', value: s.sameTarget ?? 0 },
    { label: s.targetDefenseLabel || 'Target defense', value: s.targetDefense ?? 0 },
    { label: 'Range', value: s.range ?? 0 },
    { label: 'Sick', value: s.sick ?? 0 },
    { label: 'Insight', value: s.insight ?? 0 },
    { label: 'CMod', value: s.manual ?? 0 },
  ]
  const terms = ordered.filter(t => t.value !== 0)
  const total = terms.reduce((acc, t) => acc + t.value, 0)
  return { terms, total }
}
