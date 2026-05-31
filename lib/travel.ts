// Overland travel - canon §06 Combat (CRB Ch. 08 p. 142).
//
// Standard cycle: 8h travel + 8h rest + 8h sleep = 24h (no RP drain).
// Pushing past 8h of travel in one stretch costs 1 RP per additional hour.
// If a character drops to 0 RP they become Incapacitated (handled by the
// caller via the standard incap path; this helper just reports the drain).

export interface TravelCost {
  /** RP to subtract from every traveller's current RP. 0 if hours <= 8. */
  rp: number
  /** Number of hours past the 8h soft cap. Useful for the feed-row label. */
  pushHours: number
}

/** Hours of travel per day before RP starts draining. */
export const TRAVEL_SOFT_CAP_HOURS = 8

/**
 * RP cost of pushing past the 8h soft cap. Floors negative / NaN inputs at 0.
 * @param hoursTravelled Total contiguous hours of travel in the push.
 */
export function travelPushCost(hoursTravelled: number): TravelCost {
  if (!Number.isFinite(hoursTravelled) || hoursTravelled <= TRAVEL_SOFT_CAP_HOURS) {
    return { rp: 0, pushHours: 0 }
  }
  const pushHours = Math.floor(hoursTravelled) - TRAVEL_SOFT_CAP_HOURS
  return { rp: pushHours, pushHours }
}
