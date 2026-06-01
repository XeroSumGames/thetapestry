// Rest / heal-over-time recovery math (canon-driven, pure + testable).
//
// Rest is the no-check passive recovery mechanic. Canon precedence walked
// top-down in tasks/canon-extract-rest-2026-05-31.md. Four tracks:
//   - WP: 1 per day; 1 per 2 days if the character was mortally wounded
//     (/rules/combat/incapacitation #healing).
//   - RP: 1 per hour, capped at half-max (floor) while Sick
//     (/rules/combat/infection #sick-state).
//   - Stress: -1 "Cooling Off" pip per 8 uninterrupted + enjoyable hours,
//     GM-affirmed (/rules/combat/stress #cooling-off).
//   - Pending Medicine* heals fire on the clock advance the caller does
//     separately (advanceClock -> drainPendingHeals); not computed here.
//
// Lasting Wounds (Table 12) and Breaking Point penalties (Table 13) are
// permanent and are deliberately NOT touched.

export interface RestState {
  wp_current: number
  wp_max: number
  rp_current: number
  rp_max: number
  stress: number
  /** Non-null while the character is in the death countdown (mortal). */
  death_countdown?: number | null
  /** 'sickness' = Sick state (half-max RP cap); 'wound' / null otherwise. */
  infection_state?: string | null
  /**
   * Persistent flag (maintained by a BEFORE-UPDATE trigger on
   * character_states): true from the moment WP hits 0 until WP is fully
   * restored to wp_max. This is what keeps the slow 1-WP/2-day regen going
   * through stabilisation, instead of flipping back to fast the instant WP
   * rises above 0 (Gap C). Preferred over the live-state heuristic below.
   */
  recovering_from_mortal_wound?: boolean
}

export interface RestRecovery {
  totalHours: number
  wasMortal: boolean
  isSick: boolean
  /** Rate-based WP healed (1/day or 1/2-day), before the wp_max clamp. */
  wpHeal: number
  /** WP after clamping to wp_max. */
  newWP: number
  /** Effective RP gained after the sick cap (may be < hours). */
  rpGain: number
  /** RP after the sick cap. Never below the pre-rest value. */
  newRP: number
  /** Stress pips dropped (0 unless restful AND >= 8h). */
  stressDrop: number
  newStress: number
}

/**
 * Compute what a Rest of `hours` in-game hours recovers for `s`.
 * `restful` = GM affirmation that the window was uninterrupted, free from
 * threat, and spent doing something the character enjoys (the Cooling-Off
 * gate). Pure: no clamping side effects, no clock advance.
 */
export function computeRestRecovery(s: RestState, hours: number, restful: boolean): RestRecovery {
  const totalHours = Math.max(0, Math.floor(hours))
  const totalDays = totalHours / 24

  // Prefer the persistent recovering flag (set on WP=0, cleared at wp_max);
  // fall back to the live-state heuristic for rows written before the trigger
  // existed or when the flag isn't loaded.
  const wasMortal = s.recovering_from_mortal_wound === true || s.wp_current === 0 || s.death_countdown != null
  const wpHeal = wasMortal ? Math.floor(totalDays / 2) : Math.floor(totalDays)
  const newWP = Math.min(s.wp_max, s.wp_current + wpHeal)

  const isSick = s.infection_state === 'sickness'
  const rpCap = isSick ? Math.floor(s.rp_max / 2) : s.rp_max
  // Heal up to the cap, but never push a character BELOW where they already
  // sit (e.g. already over the half-max cap when they got sick - rest is
  // not the event that lowers them; the sickness onset is).
  const newRP = s.rp_current >= rpCap ? s.rp_current : Math.min(rpCap, s.rp_current + totalHours)
  const rpGain = newRP - s.rp_current

  const stressDrop = (restful && totalHours >= 8) ? Math.floor(totalHours / 8) : 0
  const newStress = Math.max(0, s.stress - stressDrop)

  return { totalHours, wasMortal, isSick, wpHeal, newWP, rpGain, newRP, stressDrop, newStress }
}
