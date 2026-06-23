import { describe, it, expect } from 'vitest'
import { routeLootedItem } from '../../lib/loot'

describe('routeLootedItem', () => {
  it('routes a catalog weapon into inventory[] with enc/rarity from the catalog', () => {
    const out = routeLootedItem({}, { type: 'weapon', name: 'Fire Axe', quantity: 1 })
    expect(out.equipment).toBeUndefined()
    expect(out.inventory).toHaveLength(1)
    const row = out.inventory![0]
    expect(row.name).toBe('Fire Axe')
    expect(row.qty).toBe(1)
    expect(row.custom).toBe(false)
    expect(row.enc).toBeGreaterThanOrEqual(0)
    expect(typeof row.rarity).toBe('string')
  })

  it('stacks qty when the same catalog weapon already exists in inventory', () => {
    const data = { inventory: [{ name: 'Fire Axe', enc: 1, rarity: 'Common', notes: '', qty: 1, custom: false }] }
    const out = routeLootedItem(data, { type: 'weapon', name: 'Fire Axe', quantity: 2 })
    expect(out.inventory).toHaveLength(1)
    expect(out.inventory![0].qty).toBe(3)
  })

  it('adds a fresh row for an unknown (custom) weapon name with custom=true', () => {
    const out = routeLootedItem({}, { type: 'weapon', name: 'Homemade Zip Gun', quantity: 1 })
    expect(out.inventory).toHaveLength(1)
    expect(out.inventory![0].custom).toBe(true)
    expect(out.inventory![0].enc).toBe(0)
    expect(out.inventory![0].rarity).toBe('Common')
  })

  it('routes non-weapon gear into the legacy equipment[] string list', () => {
    const out = routeLootedItem({ equipment: ['Backpack'] }, { type: 'equipment', name: 'Compass', quantity: 1 })
    expect(out.inventory).toBeUndefined()
    expect(out.equipment).toEqual(['Backpack', 'Compass'])
  })

  it('appends one equipment entry per quantity', () => {
    const out = routeLootedItem({}, { type: 'equipment', name: 'Rations', quantity: 3 })
    expect(out.equipment).toEqual(['Rations', 'Rations', 'Rations'])
  })

  it('does not mutate the source inventory array', () => {
    const inv = [{ name: 'Fire Axe', enc: 1, rarity: 'Common', notes: '', qty: 1, custom: false }]
    const data = { inventory: inv }
    routeLootedItem(data, { type: 'weapon', name: 'Fire Axe', quantity: 1 })
    expect(inv[0].qty).toBe(1)
  })

  it('treats a missing/zero quantity as 1', () => {
    const out = routeLootedItem({}, { type: 'weapon', name: 'Fire Axe', quantity: 0 })
    expect(out.inventory![0].qty).toBe(1)
  })
})
