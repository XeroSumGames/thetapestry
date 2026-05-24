import { describe, it, expect } from 'vitest'
import { isHostileTarget, targetOptionColor, closestHostileKey } from '../../lib/combat-targeting'

describe('isHostileTarget', () => {
  it('PC roller: NPC target is hostile, PC target is ally', () => {
    expect(isHostileTarget(true, false)).toBe(true)   // NPC target, PC roller
    expect(isHostileTarget(false, false)).toBe(false)  // PC target, PC roller
  })
  it('NPC roller: PC target is hostile, NPC target is ally', () => {
    expect(isHostileTarget(false, true)).toBe(true)   // PC target, NPC roller
    expect(isHostileTarget(true, true)).toBe(false)    // NPC target, NPC roller
  })
})

describe('targetOptionColor', () => {
  it('hostiles are red, allies are green (relative to roller)', () => {
    // PC roller attacking an enemy NPC -> red
    expect(targetOptionColor(true, false)).toBe('#c0392b')
    // PC roller looking at an ally PC -> green
    expect(targetOptionColor(false, false)).toBe('#7fc458')
    // NPC roller (GM) attacking the PC -> red
    expect(targetOptionColor(false, true)).toBe('#c0392b')
    // NPC roller looking at an ally NPC -> green
    expect(targetOptionColor(true, true)).toBe('#7fc458')
  })
})

describe('closestHostileKey', () => {
  const pcRoller = false

  it('picks the nearest hostile by distance', () => {
    const cands = [
      { key: 'farEnemy', isNpc: true, distFeet: 30 },
      { key: 'nearEnemy', isNpc: true, distFeet: 6 },
      { key: 'ally', isNpc: false, distFeet: 3 },
    ]
    expect(closestHostileKey(cands, pcRoller)).toBe('nearEnemy')
  })

  it('ignores allies even when they are closer', () => {
    const cands = [
      { key: 'closeAlly', isNpc: false, distFeet: 1 },
      { key: 'enemy', isNpc: true, distFeet: 12 },
    ]
    expect(closestHostileKey(cands, pcRoller)).toBe('enemy')
  })

  it('returns null when there are no hostiles', () => {
    const cands = [
      { key: 'allyA', isNpc: false, distFeet: 3 },
      { key: 'allyB', isNpc: false, distFeet: 9 },
    ]
    expect(closestHostileKey(cands, pcRoller)).toBeNull()
  })

  it('treats null distance as farthest', () => {
    const cands = [
      { key: 'noPos', isNpc: true, distFeet: null },
      { key: 'known', isNpc: true, distFeet: 40 },
    ]
    expect(closestHostileKey(cands, pcRoller)).toBe('known')
  })

  it('returns the only hostile even with null distance', () => {
    const cands = [
      { key: 'ally', isNpc: false, distFeet: 2 },
      { key: 'lone', isNpc: true, distFeet: null },
    ]
    expect(closestHostileKey(cands, pcRoller)).toBe('lone')
  })

  it('NPC roller: PCs are the hostiles', () => {
    const cands = [
      { key: 'pc1', isNpc: false, distFeet: 15 },
      { key: 'pc2', isNpc: false, distFeet: 5 },
      { key: 'npcAlly', isNpc: true, distFeet: 2 },
    ]
    expect(closestHostileKey(cands, true)).toBe('pc2')
  })
})
