import { describe, it, expect } from 'vitest'
import { vehicleCoverRdm } from '../../lib/vehicle-cover'

describe('vehicleCoverRdm', () => {
  const truck = { name: 'Truck', token_type: 'object', grid_x: 5, grid_y: 5, grid_w: 4, grid_h: 2 }
  const car = { name: 'Car', token_type: 'object', grid_x: 10, grid_y: 10, grid_w: 2, grid_h: 1 }

  it('returns null when target is nowhere near any vehicle', () => {
    const target = { grid_x: 20, grid_y: 20 }
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 4 }])).toBeNull()
  })

  it('returns null for a vehicle smaller than size 3', () => {
    const target = { grid_x: 5, grid_y: 5 }
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 2 }])).toBeNull()
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 1 }])).toBeNull()
  })

  it('size 3 confers +1 RDM when target is on the footprint', () => {
    const target = { grid_x: 6, grid_y: 5 } // inside truck's [5..9) × [5..7)
    const result = vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 3 }])
    expect(result).toEqual({ bonus: 1, vehicleName: 'Truck', size: 3 })
  })

  it('size 4 -> +2, size 5 -> +3, size 6 -> +4', () => {
    const target = { grid_x: 6, grid_y: 5 }
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 4 }])?.bonus).toBe(2)
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 5 }])?.bonus).toBe(3)
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 6 }])?.bonus).toBe(4)
  })

  it('caps the bonus at +4 even for hypothetical size 7+', () => {
    const target = { grid_x: 6, grid_y: 5 }
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 7 }])?.bonus).toBe(4)
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 99 }])?.bonus).toBe(4)
  })

  it('picks the BEST cover when target sits in multiple overlapping vehicles', () => {
    const tiny = { name: 'Tiny', token_type: 'object', grid_x: 6, grid_y: 5, grid_w: 1, grid_h: 1 }
    const target = { grid_x: 6, grid_y: 5 }
    const result = vehicleCoverRdm(target, [tiny, truck], [
      { name: 'Tiny', size: 3 },
      { name: 'Truck', size: 6 },
    ])
    expect(result?.vehicleName).toBe('Truck')
    expect(result?.bonus).toBe(4)
  })

  it('ignores non-object tokens (PCs, NPCs) even if they share a vehicle name', () => {
    const npcNamedTruck = { name: 'Truck', token_type: 'pc', grid_x: 6, grid_y: 5 }
    const target = { grid_x: 6, grid_y: 5 }
    expect(vehicleCoverRdm(target, [npcNamedTruck], [{ name: 'Truck', size: 6 }])).toBeNull()
  })

  it('ignores object tokens that have no matching vehicle entry (e.g. crates, walls)', () => {
    const crate = { name: 'Crate', token_type: 'object', grid_x: 6, grid_y: 5, grid_w: 1, grid_h: 1 }
    const target = { grid_x: 6, grid_y: 5 }
    expect(vehicleCoverRdm(target, [crate], [{ name: 'Truck', size: 6 }])).toBeNull()
  })

  it('multi-cell TARGET footprint counts if any cell overlaps the vehicle', () => {
    const wideTarget = { grid_x: 4, grid_y: 5, grid_w: 2, grid_h: 1 } // [4..6) × [5..6); overlaps truck at x=5
    expect(vehicleCoverRdm(wideTarget, [truck], [{ name: 'Truck', size: 4 }])?.bonus).toBe(2)
  })

  it('target adjacent to but NOT on the footprint gets no cover (footprint-only MVP)', () => {
    const target = { grid_x: 4, grid_y: 5 } // truck is [5..9); x=4 is outside
    expect(vehicleCoverRdm(target, [truck], [{ name: 'Truck', size: 4 }])).toBeNull()
  })

  it('null/undefined grid_w/grid_h on vehicle defaults to 1×1', () => {
    const point = { name: 'Bike', token_type: 'object', grid_x: 7, grid_y: 7 }
    const target = { grid_x: 7, grid_y: 7 }
    // Size 3+ confers cover even on a 1×1 vehicle.
    expect(vehicleCoverRdm(target, [point], [{ name: 'Bike', size: 3 }])?.bonus).toBe(1)
  })

  it('empty inputs short-circuit cleanly', () => {
    expect(vehicleCoverRdm({ grid_x: 0, grid_y: 0 }, [], [])).toBeNull()
    expect(vehicleCoverRdm({ grid_x: 0, grid_y: 0 }, [car], [])).toBeNull()
    expect(vehicleCoverRdm({ grid_x: 0, grid_y: 0 }, [], [{ name: 'Truck', size: 4 }])).toBeNull()
  })
})
