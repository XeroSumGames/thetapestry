import { describe, it, expect } from 'vitest'
import { MINNIE_DAMAGE_TABLE, damageRowForRoll, resolveVehicleDamageTable, buildVehicleDamageLog } from '../../lib/vehicle-damage'

describe('MINNIE_DAMAGE_TABLE', () => {
  it('covers every 2d6 result 2-12 exactly once (no dup 8 / missing 9)', () => {
    const rolls = MINNIE_DAMAGE_TABLE.rows.map(r => r.roll).sort((a, b) => a - b)
    expect(rolls).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('maps 9 to Still - minor damage (the corrected row)', () => {
    expect(damageRowForRoll(MINNIE_DAMAGE_TABLE, 9)?.system).toBe('Still - minor damage')
  })

  it('maps the catastrophic + cosmetic ends correctly', () => {
    expect(damageRowForRoll(MINNIE_DAMAGE_TABLE, 2)?.system).toBe('Still - catastrophic')
    expect(damageRowForRoll(MINNIE_DAMAGE_TABLE, 8)?.system).toBe('Windows and doors')
    expect(damageRowForRoll(MINNIE_DAMAGE_TABLE, 10)?.system).toBe('Body damage only')
    expect(damageRowForRoll(MINNIE_DAMAGE_TABLE, 12)?.system).toBe("Sniper's nest - disabled")
  })

  it('has no em-dashes / en-dashes in any text (no-dash rule)', () => {
    const blob = JSON.stringify(MINNIE_DAMAGE_TABLE)
    // Detect via char codes (8212 em-dash, 8211 en-dash) so this test file
    // itself contains no literal forbidden glyph - it would trip its own gate.
    const hasDash = [...blob].some(c => c.charCodeAt(0) === 8212 || c.charCodeAt(0) === 8211)
    expect(hasDash).toBe(false)
  })

  it('every row has effect + repair text', () => {
    for (const r of MINNIE_DAMAGE_TABLE.rows) {
      expect(r.effect.length).toBeGreaterThan(0)
      expect(r.repair.length).toBeGreaterThan(0)
    }
  })
})

describe('damageRowForRoll', () => {
  it('returns undefined for out-of-range sums', () => {
    expect(damageRowForRoll(MINNIE_DAMAGE_TABLE, 1)).toBeUndefined()
    expect(damageRowForRoll(MINNIE_DAMAGE_TABLE, 13)).toBeUndefined()
  })
})

describe('resolveVehicleDamageTable', () => {
  it('matches Minnie by name, case-insensitively', () => {
    expect(resolveVehicleDamageTable({ name: 'Minnie' })).toBe(MINNIE_DAMAGE_TABLE)
    expect(resolveVehicleDamageTable({ name: '  minnie ' })).toBe(MINNIE_DAMAGE_TABLE)
  })

  it('returns null for other vehicles / missing name', () => {
    expect(resolveVehicleDamageTable({ name: 'The Rust Bucket' })).toBeNull()
    expect(resolveVehicleDamageTable({ name: '' })).toBeNull()
    expect(resolveVehicleDamageTable(null)).toBeNull()
    expect(resolveVehicleDamageTable(undefined)).toBeNull()
  })
})

describe('buildVehicleDamageLog', () => {
  const vehicle = { id: 'v1', name: 'Minnie', wp_current: 50 }
  const base = { campaignId: 'c1', userId: 'u1' }

  it('subtracts WP and builds a single damage log row', () => {
    const out = buildVehicleDamageLog({ vehicle, amount: 7, ...base })
    expect(out?.newWp).toBe(43)
    expect(out?.row.outcome).toBe('vehicle_damage')
    expect(out?.row.label).toBe('Minnie took 7 damage')
    expect(out?.row.total).toBe(7)
    expect((out?.row.damage_json as any).amount).toBe(7)
    expect((out?.row.damage_json as any).checkKind).toBe('damage')
  })

  it('clamps WP at zero (no negative WP)', () => {
    expect(buildVehicleDamageLog({ vehicle, amount: 999, ...base })?.newWp).toBe(0)
  })

  it('coerces numeric strings from the input field', () => {
    expect(buildVehicleDamageLog({ vehicle, amount: '5', ...base })?.newWp).toBe(45)
  })

  it('returns null for non-positive / non-numeric amounts', () => {
    expect(buildVehicleDamageLog({ vehicle, amount: 0, ...base })).toBeNull()
    expect(buildVehicleDamageLog({ vehicle, amount: -3, ...base })).toBeNull()
    expect(buildVehicleDamageLog({ vehicle, amount: '', ...base })).toBeNull()
    expect(buildVehicleDamageLog({ vehicle, amount: 'abc', ...base })).toBeNull()
  })
})
