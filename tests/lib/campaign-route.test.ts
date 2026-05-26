import { describe, it, expect } from 'vitest'
import { osrmCoordsParam, waypointLabel, parseLatLng } from '../../lib/campaign-route'

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

describe('parseLatLng', () => {
  it('parses a Google "copy coordinates" paste (comma + space)', () => {
    expect(parseLatLng('35.1987522, -111.6518220')).toEqual({ lat: 35.1987522, lng: -111.651822 })
  })
  it('accepts comma-only and space-only separators', () => {
    expect(parseLatLng('35.19,-111.65')).toEqual({ lat: 35.19, lng: -111.65 })
    expect(parseLatLng('35.19 -111.65')).toEqual({ lat: 35.19, lng: -111.65 })
  })
  it('trims surrounding whitespace', () => {
    expect(parseLatLng('  40.7128, -74.0060  ')).toEqual({ lat: 40.7128, lng: -74.006 })
  })
  it('rejects out-of-range values', () => {
    expect(parseLatLng('200, 50')).toBeNull()   // lat > 90
    expect(parseLatLng('40, 500')).toBeNull()   // lng > 180
  })
  it('returns null for place-name searches (so they hit the geocoder)', () => {
    expect(parseLatLng('Flagstaff, AZ 86004')).toBeNull()
    expect(parseLatLng('2000 Forest Service 128 Road')).toBeNull()
    expect(parseLatLng('')).toBeNull()
    expect(parseLatLng('35.19')).toBeNull() // single number, not a pair
  })
})
