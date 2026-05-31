// Vehicle-as-cover RDM bonus per CRB Ch. 08 p. 140 (Puffer pickup #2,
// 2026-05-31). A character whose token sits ON a vehicle's footprint (in
// the truck bed, on the roof, etc.) gains a Ranged Defense Mod bonus
// scaled by the vehicle's size:
//
//   Size 1-2: no bonus (too small to provide meaningful cover)
//   Size 3:   +1 RDM
//   Size 4:   +2 RDM
//   Size 5:   +3 RDM
//   Size 6:   +4 RDM
//
// MVP (this commit): footprint-only. The "behind it relative to the
// attacker" case (line crosses the vehicle) is deferred - it needs an
// LOS trace, and the spec calls out the exact "behind" semantics as
// canon-consultation territory. Foot-print covers the dominant case
// (PC dug in inside the truck) and ships clean today.
//
// MDM (melee defense) is NOT affected - cover is a ranged concept.

export interface VehicleCoverToken {
  /** Cell column the token's top-left footprint corner sits on. */
  grid_x: number
  /** Cell row the token's top-left footprint corner sits on. */
  grid_y: number
  /** Footprint width in cells (object tokens). Treated as 1 if null/undefined. */
  grid_w?: number | null
  /** Footprint height in cells (object tokens). Treated as 1 if null/undefined. */
  grid_h?: number | null
}

export interface VehicleCoverObjectToken extends VehicleCoverToken {
  /** Vehicle name matches campaigns.vehicles[].name. */
  name: string
  /** Object footprint - only these are candidates for cover. */
  token_type: string
}

export interface VehicleSizeRef {
  /** Vehicle name matches the object token's name. */
  name: string
  /** Canon size 1-6 (CRB). 3+ confers cover; smaller doesn't. */
  size: number
}

export interface VehicleCoverResult {
  /** RDM bonus added to the defender's defense (positive integer 1-4). */
  bonus: number
  /** Name of the vehicle providing cover (for breakdown display). */
  vehicleName: string
  /** Size of the vehicle providing cover (for breakdown display). */
  size: number
}

/**
 * Compute the vehicle-cover RDM bonus for a defender against a ranged attack.
 *
 * @param target The defender's token (any token type - PC, NPC, or even another object).
 * @param objectTokens All object tokens on the scene. Vehicles among them are matched by name.
 * @param vehicles Vehicle definitions (from campaigns.vehicles). Provides size by name lookup.
 * @returns Best (highest-bonus) cover among all covering vehicles, or null if none cover.
 */
export function vehicleCoverRdm(
  target: VehicleCoverToken,
  objectTokens: ReadonlyArray<VehicleCoverObjectToken>,
  vehicles: ReadonlyArray<VehicleSizeRef>,
): VehicleCoverResult | null {
  const byName = new Map(vehicles.map(v => [v.name, v.size]))
  let best: VehicleCoverResult | null = null
  for (const obj of objectTokens) {
    if (obj.token_type !== 'object') continue
    const size = byName.get(obj.name)
    if (size == null || size < 3) continue
    if (!targetOnFootprint(target, obj)) continue
    const bonus = Math.min(4, size - 2)
    if (!best || bonus > best.bonus) {
      best = { bonus, vehicleName: obj.name, size }
    }
  }
  return best
}

/**
 * Target token's footprint intersects the vehicle's footprint. Both rectangles
 * use the top-left-anchor convention; missing grid_w/grid_h defaults to 1×1.
 */
function targetOnFootprint(target: VehicleCoverToken, vehicle: VehicleCoverToken): boolean {
  const tw = Math.max(1, target.grid_w ?? 1)
  const th = Math.max(1, target.grid_h ?? 1)
  const vw = Math.max(1, vehicle.grid_w ?? 1)
  const vh = Math.max(1, vehicle.grid_h ?? 1)
  // AABB overlap test on cell-integer rectangles.
  return (
    target.grid_x < vehicle.grid_x + vw &&
    target.grid_x + tw > vehicle.grid_x &&
    target.grid_y < vehicle.grid_y + vh &&
    target.grid_y + th > vehicle.grid_y
  )
}
