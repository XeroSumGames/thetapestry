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
