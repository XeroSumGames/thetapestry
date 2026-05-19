// Fuel-storage drum install / uninstall helpers (Q4-c, 2026-05-19).
//
// Vehicles can be expanded beyond their stock fuel capacity by installing
// 55-Gallon Drums (an inventory item — see lib/xse-schema.ts EQUIPMENT).
// Each drum installed adds 1 day to the vehicle's fuel_max; uninstall
// returns the drum to vehicle cargo and reduces fuel_max by 1.
//
// Two per-vehicle columns govern the bounds:
//   fuel_max_base    - the un-expanded capacity (Minnie = 4). Acts as the
//                      floor on uninstall.
//   fuel_storage_max - absolute cap on fuel_max after install (Minnie = 6).
//
// Both are optional per-vehicle; absence disables the feature for that
// vehicle (smaller cars haven't had their numbers spec'd yet — rules pass
// post-campaign).
//
// These helpers are PURE. They take the current vehicle + cargo array and
// return new copies. The vehicle popout calls them, then persists the
// result via updateVehicle (which routes through the
// update_vehicle_in_campaign RPC + realtime broadcast).

import type { InventoryItem } from './inventory'

export const FUEL_DRUM_NAME = '55-Gallon Drum'

export interface FuelStorageVehicle {
  fuel_max: number
  fuel_current: number
  fuel_max_base?: number
  fuel_storage_max?: number
  cargo: InventoryItem[]
}

export interface FuelStorageResult<V extends FuelStorageVehicle> {
  vehicle: V | null
  error: string | null
}

/** Effective floor for uninstall - falls back to current fuel_max when
 *  fuel_max_base isn't set (i.e. legacy vehicle without the field, no
 *  drums currently installed). */
export function effectiveFuelMaxBase(v: FuelStorageVehicle): number {
  return v.fuel_max_base ?? v.fuel_max
}

/** Effective cap for install - falls back to current fuel_max when
 *  fuel_storage_max isn't set, which disables the install button. */
export function effectiveFuelStorageMax(v: FuelStorageVehicle): number {
  return v.fuel_storage_max ?? v.fuel_max
}

/** Count of drums currently installed = how far fuel_max sits above base. */
export function installedDrumCount(v: FuelStorageVehicle): number {
  return Math.max(0, v.fuel_max - effectiveFuelMaxBase(v))
}

/** How many more drums COULD be installed (cap - current installed). */
export function remainingDrumCapacity(v: FuelStorageVehicle): number {
  return Math.max(0, effectiveFuelStorageMax(v) - v.fuel_max)
}

/** How many drums are sitting in cargo, ready to install. */
export function drumsInCargo(cargo: InventoryItem[]): number {
  const row = cargo.find(c => c.name === FUEL_DRUM_NAME)
  return row?.qty ?? 0
}

/** Install one drum from cargo onto the vehicle. Returns a new vehicle
 *  with fuel_max +1 and cargo decremented by 1 drum. Error string when
 *  the install is blocked (no drum in cargo / at cap / feature disabled). */
export function installFuelDrum<V extends FuelStorageVehicle>(v: V): FuelStorageResult<V> {
  // Feature disabled when fuel_storage_max is missing OR doesn't exceed
  // the base capacity (no headroom to add drums into).
  const base = effectiveFuelMaxBase(v)
  if (v.fuel_storage_max == null || v.fuel_storage_max <= base) {
    return { vehicle: null, error: 'This vehicle does not support fuel storage expansion.' }
  }
  if (v.fuel_max >= v.fuel_storage_max) {
    return { vehicle: null, error: `Already at the cap (${v.fuel_storage_max} days).` }
  }
  const drumRow = v.cargo.find(c => c.name === FUEL_DRUM_NAME)
  if (!drumRow || drumRow.qty < 1) {
    return { vehicle: null, error: 'No 55-Gallon Drum in cargo to install.' }
  }
  // Decrement drum qty; if qty hits 0, drop the row entirely.
  const newCargo = drumRow.qty > 1
    ? v.cargo.map(c => c === drumRow ? { ...c, qty: c.qty - 1 } : c)
    : v.cargo.filter(c => c !== drumRow)
  return {
    vehicle: { ...v, fuel_max: v.fuel_max + 1, cargo: newCargo },
    error: null,
  }
}

/** Uninstall one drum from the vehicle. Returns a new vehicle with
 *  fuel_max -1 (floored at fuel_max_base) and cargo incremented by 1
 *  drum (new row appended if none present). fuel_current is clamped
 *  to the new fuel_max so the player never has more fuel than capacity.
 *  Error when nothing installed. */
export function removeFuelDrum<V extends FuelStorageVehicle>(v: V): FuelStorageResult<V> {
  const base = effectiveFuelMaxBase(v)
  if (v.fuel_max <= base) {
    return { vehicle: null, error: 'No drums installed to remove.' }
  }
  const newFuelMax = v.fuel_max - 1
  const newFuelCurrent = Math.min(v.fuel_current, newFuelMax)
  const drumRow = v.cargo.find(c => c.name === FUEL_DRUM_NAME)
  const newCargo: InventoryItem[] = drumRow
    ? v.cargo.map(c => c === drumRow ? { ...c, qty: c.qty + 1 } : c)
    : [...v.cargo, {
        name: FUEL_DRUM_NAME,
        qty: 1,
        enc: 2,
        rarity: 'Common',
        custom: false,
        notes: 'Install on a vehicle to add 1 day of fuel storage (uninstall to recover the drum). Cap is per-vehicle.',
      } as InventoryItem]
  return {
    vehicle: { ...v, fuel_max: newFuelMax, fuel_current: newFuelCurrent, cargo: newCargo },
    error: null,
  }
}
