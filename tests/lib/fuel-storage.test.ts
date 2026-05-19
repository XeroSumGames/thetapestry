import { describe, it, expect } from 'vitest'
import {
  FUEL_DRUM_NAME,
  effectiveFuelMaxBase, effectiveFuelStorageMax,
  installedDrumCount, remainingDrumCapacity, drumsInCargo,
  installFuelDrum, removeFuelDrum,
} from '../../lib/fuel-storage'

type TestVehicle = {
  fuel_max: number
  fuel_current: number
  fuel_max_base?: number
  fuel_storage_max?: number
  cargo: any[]
}

const drum = (qty = 1) => ({ name: FUEL_DRUM_NAME, qty, enc: 2, rarity: 'Common', custom: false, notes: '' })

const baseMinnie = (): TestVehicle => ({
  fuel_max: 4,
  fuel_current: 4,
  fuel_max_base: 4,
  fuel_storage_max: 6,
  cargo: [],
})

describe('fuel-storage helpers', () => {
  describe('effective accessors', () => {
    it('effectiveFuelMaxBase returns fuel_max_base when set', () => {
      expect(effectiveFuelMaxBase(baseMinnie())).toBe(4)
    })
    it('effectiveFuelMaxBase falls back to fuel_max when fuel_max_base is missing', () => {
      // Legacy vehicle without the base column - we treat current
      // capacity as the base (no drums installed = base = max).
      expect(effectiveFuelMaxBase({ fuel_max: 4, fuel_current: 4, cargo: [] })).toBe(4)
    })
    it('effectiveFuelStorageMax falls back to fuel_max when missing', () => {
      expect(effectiveFuelStorageMax({ fuel_max: 4, fuel_current: 4, cargo: [] })).toBe(4)
    })
    it('installedDrumCount = fuel_max - base, floored at 0', () => {
      const v = { ...baseMinnie(), fuel_max: 6 }
      expect(installedDrumCount(v)).toBe(2)
    })
    it('installedDrumCount = 0 when fuel_max is below the base (defensive)', () => {
      const v = { ...baseMinnie(), fuel_max: 3 }
      expect(installedDrumCount(v)).toBe(0)
    })
    it('remainingDrumCapacity = cap - current, floored at 0', () => {
      expect(remainingDrumCapacity(baseMinnie())).toBe(2)
      expect(remainingDrumCapacity({ ...baseMinnie(), fuel_max: 6 })).toBe(0)
    })
    it('drumsInCargo finds the qty by exact name', () => {
      expect(drumsInCargo([])).toBe(0)
      expect(drumsInCargo([{ name: 'Apple', qty: 3, enc: 0, rarity: 'Common', custom: false, notes: '' }])).toBe(0)
      expect(drumsInCargo([drum(5)])).toBe(5)
    })
  })

  describe('installFuelDrum', () => {
    it('errors when the vehicle has no fuel_storage_max field', () => {
      const v: TestVehicle = { fuel_max: 4, fuel_current: 4, cargo: [drum(1)] }
      const r = installFuelDrum(v)
      expect(r.error).toMatch(/does not support/i)
      expect(r.vehicle).toBeNull()
    })

    it('errors when fuel_storage_max equals fuel_max_base (no headroom)', () => {
      const v: TestVehicle = { fuel_max: 4, fuel_current: 4, fuel_max_base: 4, fuel_storage_max: 4, cargo: [drum(1)] }
      const r = installFuelDrum(v)
      expect(r.error).toMatch(/does not support/i)
    })

    it('errors when already at the cap', () => {
      const v = { ...baseMinnie(), fuel_max: 6, cargo: [drum(1)] }
      const r = installFuelDrum(v)
      expect(r.error).toMatch(/cap/i)
    })

    it('errors when no drum is in cargo', () => {
      const v = baseMinnie()
      const r = installFuelDrum(v)
      expect(r.error).toMatch(/no 55-gallon drum/i)
    })

    it('decrements drum qty and bumps fuel_max on success', () => {
      const v = { ...baseMinnie(), cargo: [drum(3)] }
      const r = installFuelDrum(v)
      expect(r.error).toBeNull()
      expect(r.vehicle!.fuel_max).toBe(5)
      expect(r.vehicle!.cargo[0].qty).toBe(2)
    })

    it('drops the cargo row when the last drum is consumed', () => {
      const v = { ...baseMinnie(), cargo: [drum(1), { name: 'Apple', qty: 3, enc: 0, rarity: 'Common', custom: false, notes: '' }] }
      const r = installFuelDrum(v)
      expect(r.vehicle!.cargo).toHaveLength(1)
      expect(r.vehicle!.cargo[0].name).toBe('Apple')
    })

    it('does not mutate the input vehicle', () => {
      const v = { ...baseMinnie(), cargo: [drum(2)] }
      const before = JSON.stringify(v)
      installFuelDrum(v)
      expect(JSON.stringify(v)).toBe(before)
    })
  })

  describe('removeFuelDrum', () => {
    it('errors when no drums are installed', () => {
      const r = removeFuelDrum(baseMinnie())
      expect(r.error).toMatch(/no drums installed/i)
    })

    it('decrements fuel_max and increments cargo drum row', () => {
      const v = { ...baseMinnie(), fuel_max: 6, cargo: [drum(1)] }
      const r = removeFuelDrum(v)
      expect(r.error).toBeNull()
      expect(r.vehicle!.fuel_max).toBe(5)
      expect(r.vehicle!.cargo[0].qty).toBe(2)
    })

    it('appends a new drum row when cargo has none', () => {
      const v: TestVehicle = { ...baseMinnie(), fuel_max: 6, cargo: [] as any[] }
      const r = removeFuelDrum(v)
      expect(r.vehicle!.cargo).toHaveLength(1)
      expect(r.vehicle!.cargo[0].name).toBe(FUEL_DRUM_NAME)
      expect(r.vehicle!.cargo[0].qty).toBe(1)
    })

    it('clamps fuel_current down to the new fuel_max when needed', () => {
      // Full tank at expanded cap. Uninstall should clamp.
      const v = { ...baseMinnie(), fuel_max: 6, fuel_current: 6 }
      const r = removeFuelDrum(v)
      expect(r.vehicle!.fuel_max).toBe(5)
      expect(r.vehicle!.fuel_current).toBe(5)
    })

    it('leaves fuel_current alone when it already fits the new cap', () => {
      const v = { ...baseMinnie(), fuel_max: 6, fuel_current: 3 }
      const r = removeFuelDrum(v)
      expect(r.vehicle!.fuel_current).toBe(3)
    })

    it('does not mutate the input vehicle', () => {
      const v = { ...baseMinnie(), fuel_max: 6, cargo: [drum(1)] }
      const before = JSON.stringify(v)
      removeFuelDrum(v)
      expect(JSON.stringify(v)).toBe(before)
    })
  })

  describe('install/remove round trip', () => {
    it('install then remove returns to the starting state (modulo cargo ordering)', () => {
      const start = { ...baseMinnie(), cargo: [drum(2)] }
      const afterInstall = installFuelDrum(start).vehicle!
      expect(afterInstall.fuel_max).toBe(5)
      const afterRemove = removeFuelDrum(afterInstall).vehicle!
      expect(afterRemove.fuel_max).toBe(4)
      expect(drumsInCargo(afterRemove.cargo)).toBe(2)
    })
  })
})
