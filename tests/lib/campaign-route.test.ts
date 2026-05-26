import { describe, it, expect } from 'vitest'
import { osrmCoordsParam, waypointLabel } from '../../lib/campaign-route'

describe('osrmCoordsParam', () => {
  it('emits lon,lat pairs (NOT lat,lon) in click order, joined by ;', () => {
    expect(osrmCoordsParam([
      { lat: 40.7128, lng: -74.0060 }, // NYC
      { lat: 34.0522, lng: -118.2437 }, // LA
    ])).toBe('-74.006,40.7128;-118.2437,34.0522')
  })

  it('handles a single point and many points', () => {
    expect(osrmCoordsParam([{ lat: 1, lng: 2 }])).toBe('2,1')
    expect(osrmCoordsParam([
      { lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 },
    ])).toBe('2,1;4,3;6,5')
  })

  it('empty -> empty string', () => {
    expect(osrmCoordsParam([])).toBe('')
  })
})

describe('waypointLabel', () => {
  it('maps 0..25 to A..Z', () => {
    expect(waypointLabel(0)).toBe('A')
    expect(waypointLabel(1)).toBe('B')
    expect(waypointLabel(25)).toBe('Z')
  })
  it('falls back to a number past Z', () => {
    expect(waypointLabel(26)).toBe('27')
  })
})
