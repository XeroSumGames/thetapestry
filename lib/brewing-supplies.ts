// Brewing supplies stockpile helpers (Q4-d, 2026-05-19).
//
// Vehicles with a still (Minnie, future others) gain a small stockpile of
// "brewing materials" — days of gathered raw material ready to distill.
// Per canon (Minnie's seed notes): "1 day of gathering materials and 1
// day of distilling to produce 2 days of fuel." Pre-fix the gather and
// distill steps were lock-step; the stockpile lets the party gather
// ahead so they can brew on consecutive days.
//
// Two per-vehicle columns govern the bounds:
//   brewing_supplies_current - days of materials on hand
//   brewing_supplies_max     - cap on the stockpile (Minnie = 2)
//
// Both optional; absence disables the feature.
//
// These helpers are PURE. The vehicle popout calls them, then persists
// the result via updateVehicle (RPC + realtime broadcast).

export interface BrewingSuppliesVehicle {
  brewing_supplies_current?: number
  brewing_supplies_max?: number
}

export interface BrewingSuppliesResult<V extends BrewingSuppliesVehicle> {
  vehicle: V | null
  error: string | null
}

/** Cap, falling back to current when missing so the gather button
 *  disables (no room to gather into). */
export function effectiveBrewingMax(v: BrewingSuppliesVehicle): number {
  return v.brewing_supplies_max ?? 0
}

/** Current supplies, default 0. */
export function currentBrewingSupplies(v: BrewingSuppliesVehicle): number {
  return v.brewing_supplies_current ?? 0
}

/** Whether the brew check can fire — needs at least 1 day of supplies on
 *  hand. UI guards on this; rollCheck() also re-validates so a stale
 *  client can't force-roll without supplies. */
export function canBrew(v: BrewingSuppliesVehicle): boolean {
  return currentBrewingSupplies(v) >= 1
}

/** Whether the gather button can fire — feature must be enabled AND there
 *  must be room left below the cap. */
export function canGatherMaterials(v: BrewingSuppliesVehicle): boolean {
  const max = effectiveBrewingMax(v)
  return max > 0 && currentBrewingSupplies(v) < max
}

/** Gather 1 day of materials. Errors when feature disabled or already at
 *  the cap. */
export function gatherMaterials<V extends BrewingSuppliesVehicle>(v: V): BrewingSuppliesResult<V> {
  const max = effectiveBrewingMax(v)
  if (max <= 0) {
    return { vehicle: null, error: 'This vehicle has no brewing-materials stockpile.' }
  }
  const cur = currentBrewingSupplies(v)
  if (cur >= max) {
    return { vehicle: null, error: `Already at the cap (${max} days of materials).` }
  }
  return {
    vehicle: { ...v, brewing_supplies_current: cur + 1 },
    error: null,
  }
}

/** Consume 1 day of materials (called when a Brew check fires). Errors
 *  when nothing on hand — the UI is supposed to block first, but this
 *  is the defensive last-line guard. Decrement is unconditional on
 *  outcome (Q4-d spec: every brew attempt consumes 1, success or fail).
 *  Materialist semantics: you used the materials, success or not. */
export function consumeBrewingSupplies<V extends BrewingSuppliesVehicle>(v: V): BrewingSuppliesResult<V> {
  const cur = currentBrewingSupplies(v)
  if (cur < 1) {
    return { vehicle: null, error: 'No brewing materials available.' }
  }
  return {
    vehicle: { ...v, brewing_supplies_current: cur - 1 },
    error: null,
  }
}
