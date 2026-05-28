import { describe, it, expect } from 'vitest'
import { cargoLoad } from '../../lib/inventory'

const GREEN = '#7fc458'
const AMBER = '#EF9F27'
const RED = '#c0392b'

describe('cargoLoad', () => {
  it('sums enc * qty across normalized cargo', () => {
    const load = cargoLoad([{ name: 'Drum', enc: 6, qty: 2 }, { name: 'Rope', enc: 1, qty: 3 }], 300)
    expect(load.totalEnc).toBe(15)
    expect(load.capacity).toBe(300)
    expect(load.items).toHaveLength(2)
  })

  it('normalizes legacy rows (missing enc defaults to 0)', () => {
    const load = cargoLoad([{ name: 'Mystery box', qty: 1 }], 100)
    expect(load.totalEnc).toBe(0)
  })

  it('colors green below 75%', () => {
    expect(cargoLoad([{ name: 'x', enc: 74, qty: 1 }], 100).color).toBe(GREEN)
  })

  it('colors amber from 75% to under 90%', () => {
    expect(cargoLoad([{ name: 'x', enc: 75, qty: 1 }], 100).color).toBe(AMBER)
    expect(cargoLoad([{ name: 'x', enc: 89, qty: 1 }], 100).color).toBe(AMBER)
  })

  it('colors red at 90% and above', () => {
    expect(cargoLoad([{ name: 'x', enc: 90, qty: 1 }], 100).color).toBe(RED)
    expect(cargoLoad([{ name: 'x', enc: 200, qty: 1 }], 100).color).toBe(RED)
  })

  it('flags overloaded only when total exceeds capacity', () => {
    expect(cargoLoad([{ name: 'x', enc: 100, qty: 1 }], 100).overloaded).toBe(false)
    expect(cargoLoad([{ name: 'x', enc: 101, qty: 1 }], 100).overloaded).toBe(true)
  })

  it('handles empty / null cargo and zero capacity without dividing by zero', () => {
    expect(cargoLoad(null, 100)).toMatchObject({ totalEnc: 0, pct: 0, color: GREEN })
    expect(cargoLoad([], 0)).toMatchObject({ totalEnc: 0, pct: 0, overloaded: false })
  })
})
