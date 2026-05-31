import { describe, it, expect } from 'vitest'
import { travelPushCost, TRAVEL_SOFT_CAP_HOURS } from '../../lib/travel'

describe('travelPushCost - 1 RP per hour past 8h soft cap', () => {
  it('exports the 8h soft cap as a named constant', () => {
    expect(TRAVEL_SOFT_CAP_HOURS).toBe(8)
  })

  it('0 hours = no cost', () => {
    expect(travelPushCost(0)).toEqual({ rp: 0, pushHours: 0 })
  })

  it('1 hour = no cost (within cap)', () => {
    expect(travelPushCost(1)).toEqual({ rp: 0, pushHours: 0 })
  })

  it('8 hours exactly = no cost (cap inclusive)', () => {
    expect(travelPushCost(8)).toEqual({ rp: 0, pushHours: 0 })
  })

  it('9 hours = 1 RP, 1 push hour', () => {
    expect(travelPushCost(9)).toEqual({ rp: 1, pushHours: 1 })
  })

  it('12 hours = 4 RP, 4 push hours', () => {
    expect(travelPushCost(12)).toEqual({ rp: 4, pushHours: 4 })
  })

  it('16 hours = 8 RP, 8 push hours', () => {
    expect(travelPushCost(16)).toEqual({ rp: 8, pushHours: 8 })
  })

  it('handles negative inputs (0 cost)', () => {
    expect(travelPushCost(-5)).toEqual({ rp: 0, pushHours: 0 })
  })

  it('handles NaN / Infinity gracefully (0 cost)', () => {
    expect(travelPushCost(NaN)).toEqual({ rp: 0, pushHours: 0 })
    expect(travelPushCost(Infinity)).toEqual({ rp: 0, pushHours: 0 })
  })

  it('floors fractional hours', () => {
    expect(travelPushCost(8.9)).toEqual({ rp: 0, pushHours: 0 })
    expect(travelPushCost(9.7)).toEqual({ rp: 1, pushHours: 1 })
    expect(travelPushCost(10.5)).toEqual({ rp: 2, pushHours: 2 })
  })
})
