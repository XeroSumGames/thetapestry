// Environmental damage formulas - canon §06 Combat (CRB Ch. 07 pp. 116-117).
// Pure functions so the GM-button modals (CharacterCard) can compute the
// damage to apply without dragging in the supabase/character_states I/O.
//
// Three independent mechanics live here. Subsistence already auto-drains via
// the campaign-clock tick (lib/campaign-clock.ts:drainSubsistenceDamage); the
// helpers below are the "GM applies a one-shot" path for Falling + Drowning
// and a recovery helper for Subsistence.
//
// Canon:
//   Falling     - 3 WP + 3 RP per 10 ft fallen. Athletics Wild Success may
//                 mitigate (Fill in the Gaps - GM call, not auto).
//   Drowning    - hold breath = 6 + PHY AMod rounds. Past that, 3 WP + 3 RP
//                 per round + cumulative -1 CMod on resist checks.
//   Subsistence - 1 WP + 1 RP per day past day 2 without food/water.
//                 Recovery: +1 WP + +1 RP per day once food restored.

export interface EnvDamage {
  /** Wound Points to subtract. */
  wp: number
  /** Reaction Points to subtract. */
  rp: number
}

// ── Falling ──────────────────────────────────────────────────────────────

/**
 * WP + RP damage from a fall.
 * @param feetFallen The vertical distance, in feet. Floored to the nearest 10 ft
 *   per canon (fall less than 10 ft = 0 damage).
 */
export function fallingDamage(feetFallen: number): EnvDamage {
  if (!Number.isFinite(feetFallen) || feetFallen < 10) return { wp: 0, rp: 0 }
  const segments = Math.floor(feetFallen / 10)
  return { wp: 3 * segments, rp: 3 * segments }
}

// ── Drowning ─────────────────────────────────────────────────────────────

/** Rounds the character can hold their breath underwater. */
export function holdBreathRounds(phyAmod: number): number {
  return Math.max(0, 6 + phyAmod)
}

/**
 * WP + RP damage from drowning. Applies only AFTER the hold-breath window.
 * Damage is cumulative per round past the window: round (window + N) costs
 * 3 WP + 3 RP * N (canon: per-round, not per-round-elapsed).
 * @param phyAmod Defender's PHY AMod (sets the hold-breath window).
 * @param submergedRounds Total rounds the character has been underwater.
 */
export function drowningDamage(phyAmod: number, submergedRounds: number): EnvDamage {
  if (!Number.isFinite(submergedRounds) || submergedRounds < 0) return { wp: 0, rp: 0 }
  const window = holdBreathRounds(phyAmod)
  const past = Math.max(0, Math.floor(submergedRounds) - window)
  return { wp: 3 * past, rp: 3 * past }
}

/**
 * Cumulative CMod penalty on resist checks while drowning. -1 per round PAST
 * the hold-breath window. Returned as a NEGATIVE number (already signed).
 */
export function drowningResistCmod(phyAmod: number, submergedRounds: number): number {
  if (!Number.isFinite(submergedRounds) || submergedRounds < 0) return 0
  const window = holdBreathRounds(phyAmod)
  const penalty = Math.max(0, Math.floor(submergedRounds) - window)
  return penalty === 0 ? 0 : -penalty
}

// ── Subsistence recovery ─────────────────────────────────────────────────
//
// The clock-tick drainer handles the damage side. This helper handles the
// recovery side: per canon "Recovery 1 WP + 1 RP per day once food restored",
// the character regains 1/1 per fed-day from current toward max.

/**
 * Healing applied when a character has been fed for N days after a subsistence-
 * starved stretch. Caps each side at the per-stat max so over-recovery doesn't
 * push past the cap. Returns the amount TO ADD (positive numbers).
 */
export function subsistenceRecovery(
  fedDays: number,
  current: { wp: number; rp: number },
  max: { wp: number; rp: number },
): EnvDamage {
  const days = Math.max(0, Math.floor(fedDays))
  const wpHeal = Math.min(days, Math.max(0, max.wp - current.wp))
  const rpHeal = Math.min(days, Math.max(0, max.rp - current.rp))
  return { wp: wpHeal, rp: rpHeal }
}
