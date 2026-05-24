// Outcome mechanics for the vehicle maintenance skill-checks (2026-05-24):
//   - Install a fuel drum  -> Mechanic* / Tinkerer check
//   - Gather brewing materials -> Scavenging check
// Pure: map an XSE outcome string onto the resulting vehicle + a player-facing
// message. Kept out of the LOC-ratcheted vehicle popout so the rules are
// unit-testable and the page's roll-resolution branch stays thin.

import { installFuelDrum, damageFuelDrum, type FuelStorageVehicle } from './fuel-storage'
import { gatherMaterials, type BrewingSuppliesVehicle } from './brewing-supplies'

const SUCCESS_TIERS = ['Wild Success', 'High Insight', 'Success']

// vehicle: non-null = persist this new vehicle; null = no DB change (a failure
// that changed nothing, or a guard error). message: always shown to the player.
export interface VehicleCheckResult<V> {
  vehicle: V | null
  message: string
}

// Install drum (Xero rulings 2026-05-24):
//   Success / Wild Success / High Insight -> installed (+1 day capacity)
//   Failure / Low Insight                 -> drum damaged, can't be fitted (lost from cargo)
//   Dire Failure                          -> drum lost AND one tank of fuel wasted
export function applyInstallOutcome<V extends FuelStorageVehicle>(v: V, outcome: string): VehicleCheckResult<V> {
  if (SUCCESS_TIERS.includes(outcome)) {
    const r = installFuelDrum(v)
    return r.vehicle
      ? { vehicle: r.vehicle, message: 'Drum installed - +1 day of fuel storage.' }
      : { vehicle: null, message: r.error ?? 'Install failed.' }
  }
  if (outcome === 'Dire Failure') {
    const r = damageFuelDrum(v, true)
    return r.vehicle
      ? { vehicle: r.vehicle, message: 'Dire Failure - the drum looked solid but came off when filled; it is lost and a tank of methanol is wasted.' }
      : { vehicle: null, message: r.error ?? 'No drum to fit.' }
  }
  // Failure / Low Insight
  const r = damageFuelDrum(v, false)
  return r.vehicle
    ? { vehicle: r.vehicle, message: 'Failure - the drum is damaged and cannot be fitted (lost).' }
    : { vehicle: null, message: r.error ?? 'No drum to fit.' }
}

// Gather brewing materials (Xero rulings 2026-05-24):
//   Wild Success            -> +2 days of materials ("more")
//   Success / High Insight  -> +1 day
//   Failure / Low Insight   -> nothing
//   Dire Failure            -> nothing; the scavenger lost something or got hurt (GM narrative)
export function applyGatherOutcome<V extends BrewingSuppliesVehicle>(v: V, outcome: string): VehicleCheckResult<V> {
  if (outcome === 'Failure' || outcome === 'Low Insight') {
    return { vehicle: null, message: 'Failure - nothing gathered this time.' }
  }
  if (outcome === 'Dire Failure') {
    return { vehicle: null, message: 'Dire Failure - nothing gathered; the scavenger lost something or hurt themselves (GM adjudicates).' }
  }
  const qty = outcome === 'Wild Success' ? 2 : 1
  let cur: V = v
  let gained = 0
  for (let i = 0; i < qty; i++) {
    const r = gatherMaterials(cur)
    if (r.vehicle) { cur = r.vehicle; gained++ } else break
  }
  if (gained === 0) return { vehicle: null, message: 'Stockpile already full - nothing added.' }
  return { vehicle: cur, message: `Gathered ${gained} day${gained === 1 ? '' : 's'} of brewing materials.` }
}
