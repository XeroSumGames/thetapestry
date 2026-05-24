import { describe, it, expect } from 'vitest'
import { applyInstallOutcome, applyGatherOutcome } from '../../lib/vehicle-checks'
import { damageFuelDrum, FUEL_DRUM_NAME, drumsInCargo } from '../../lib/fuel-storage'

function minnie(over: Partial<any> = {}) {
  return {
    fuel_max: 4,
    fuel_current: 3,
    fuel_max_base: 4,
    fuel_storage_max: 6,
    cargo: [{ name: FUEL_DRUM_NAME, qty: 2, enc: 2, rarity: 'Common', custom: false }],
    ...over,
  } as any
}

describe('applyInstallOutcome', () => {
  for (const o of ['Success', 'Wild Success', 'High Insight']) {
    it(`${o} installs the drum (+1 capacity, drum leaves cargo)`, () => {
      const r = applyInstallOutcome(minnie(), o)
      expect(r.vehicle).not.toBeNull()
      expect(r.vehicle!.fuel_max).toBe(5)
      expect(drumsInCargo(r.vehicle!.cargo)).toBe(1)
      expect(r.message).toMatch(/installed/i)
    })
  }

  for (const o of ['Failure', 'Low Insight']) {
    it(`${o} damages the drum: consumed, no install, fuel unchanged`, () => {
      const r = applyInstallOutcome(minnie(), o)
      expect(r.vehicle).not.toBeNull()
      expect(r.vehicle!.fuel_max).toBe(4)        // NOT installed
      expect(r.vehicle!.fuel_current).toBe(3)    // no fuel lost
      expect(drumsInCargo(r.vehicle!.cargo)).toBe(1) // drum consumed
      expect(r.message).toMatch(/damaged|cannot be fitted/i)
    })
  }

  it('Dire Failure: drum lost AND one tank of fuel wasted (not zeroed)', () => {
    const r = applyInstallOutcome(minnie({ fuel_current: 3 }), 'Dire Failure')
    expect(r.vehicle!.fuel_max).toBe(4)        // not installed
    expect(r.vehicle!.fuel_current).toBe(2)    // exactly one tank lost
    expect(drumsInCargo(r.vehicle!.cargo)).toBe(1)
    expect(r.message).toMatch(/wasted/i)
  })

  it('Dire Failure floors fuel at 0', () => {
    const r = applyInstallOutcome(minnie({ fuel_current: 0 }), 'Dire Failure')
    expect(r.vehicle!.fuel_current).toBe(0)
  })

  it('no drum in cargo -> no change, error message', () => {
    const r = applyInstallOutcome(minnie({ cargo: [] }), 'Failure')
    expect(r.vehicle).toBeNull()
    expect(r.message).toMatch(/no.*drum/i)
  })
})

function brewVehicle(cur: number, max = 2) {
  return { brewing_supplies_current: cur, brewing_supplies_max: max } as any
}

describe('applyGatherOutcome', () => {
  it('Success / High Insight gather +1', () => {
    for (const o of ['Success', 'High Insight']) {
      const r = applyGatherOutcome(brewVehicle(0, 5), o)
      expect(r.vehicle!.brewing_supplies_current).toBe(1)
    }
  })

  it('Wild Success gathers +2', () => {
    const r = applyGatherOutcome(brewVehicle(0, 5), 'Wild Success')
    expect(r.vehicle!.brewing_supplies_current).toBe(2)
    expect(r.message).toMatch(/2 days/i)
  })

  it('Wild Success is still capped (+1 when only 1 slot left)', () => {
    const r = applyGatherOutcome(brewVehicle(1, 2), 'Wild Success')
    expect(r.vehicle!.brewing_supplies_current).toBe(2)
    expect(r.message).toMatch(/1 day/i)
  })

  for (const o of ['Failure', 'Low Insight']) {
    it(`${o} gathers nothing (no change)`, () => {
      const r = applyGatherOutcome(brewVehicle(0, 5), o)
      expect(r.vehicle).toBeNull()
      expect(r.message).toMatch(/nothing/i)
    })
  }

  it('Dire Failure: nothing + GM-narrative loss/harm', () => {
    const r = applyGatherOutcome(brewVehicle(0, 5), 'Dire Failure')
    expect(r.vehicle).toBeNull()
    expect(r.message).toMatch(/lost something or hurt/i)
  })

  it('full stockpile -> nothing added even on Success', () => {
    const r = applyGatherOutcome(brewVehicle(2, 2), 'Success')
    expect(r.vehicle).toBeNull()
    expect(r.message).toMatch(/full/i)
  })
})

describe('damageFuelDrum primitive', () => {
  it('consumes a drum, no fuel loss when wasteOneTank=false', () => {
    const r = damageFuelDrum(minnie(), false)
    expect(drumsInCargo(r.vehicle!.cargo)).toBe(1)
    expect(r.vehicle!.fuel_current).toBe(3)
  })
  it('wasteOneTank=true burns one tank', () => {
    const r = damageFuelDrum(minnie({ fuel_current: 2 }), true)
    expect(r.vehicle!.fuel_current).toBe(1)
  })
})
