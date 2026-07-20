import { describe, it, expect } from 'vitest'
import {
  cellDistance,
  computeBlastSplash,
  mortalWoundCountdown,
  buildCmodBreakdown,
  resolveTargetDefense,
  computeAttackCmod,
  type TargetLookupCtx,
  type AttackCmodCtx,
} from '../../lib/table-roll-context'

describe('cellDistance - Chebyshev grid distance', () => {
  it('is 0 for the same cell', () => {
    expect(cellDistance(3, 3, 3, 3)).toBe(0)
  })
  it('orthogonal distance is the axis delta', () => {
    expect(cellDistance(0, 0, 4, 0)).toBe(4)
    expect(cellDistance(0, 0, 0, 7)).toBe(7)
  })
  it('diagonal distance is the MAX of the two deltas (king move)', () => {
    expect(cellDistance(0, 0, 3, 3)).toBe(3)
    expect(cellDistance(0, 0, 5, 2)).toBe(5)
  })
  it('is symmetric and handles negative coords', () => {
    expect(cellDistance(5, 5, 1, 2)).toBe(cellDistance(1, 2, 5, 5))
    expect(cellDistance(-2, -2, 1, 1)).toBe(3)
  })
})

describe('computeBlastSplash - radius bands + scaled damage', () => {
  // cellFeet = 5 (the canonical map scale); rawWP 10 / rawRP 4.
  it('full damage at the center cell (Engaged)', () => {
    const s = computeBlastSplash(0, 0, 0, 0, 5, 10, 4)
    expect(s).not.toBeNull()
    expect(s!.band).toBe('Engaged')
    expect(s!.scale).toBe(1.0)
    expect(s!.splashWP).toBe(10)
    expect(s!.splashRP).toBe(4)
  })

  it('5 ft is still Engaged (full)', () => {
    const s = computeBlastSplash(1, 0, 0, 0, 5, 10, 4)
    expect(s!.feet).toBe(5)
    expect(s!.band).toBe('Engaged')
    expect(s!.splashWP).toBe(10)
  })

  it('past Engaged but within 30 ft is Close (half, floored)', () => {
    const s = computeBlastSplash(2, 0, 0, 0, 5, 10, 4) // 10 ft
    expect(s!.band).toBe('Close')
    expect(s!.scale).toBe(0.5)
    expect(s!.splashWP).toBe(5) // floor(10 * 0.5)
    expect(s!.splashRP).toBe(2) // floor(4 * 0.5)
  })

  it('30 ft is the Close boundary (still in radius)', () => {
    const s = computeBlastSplash(6, 0, 0, 0, 5, 10, 4) // 30 ft
    expect(s).not.toBeNull()
    expect(s!.band).toBe('Close')
  })

  it('beyond 30 ft is out of radius (null)', () => {
    expect(computeBlastSplash(7, 0, 0, 0, 5, 10, 4)).toBeNull() // 35 ft
  })

  it('diagonal distance uses Chebyshev (2,2 = 10 ft at scale 5)', () => {
    const s = computeBlastSplash(2, 2, 0, 0, 5, 10, 4)
    expect(s!.feet).toBe(10)
    expect(s!.band).toBe('Close')
  })

  it('WP floors at 1 for anyone caught in radius; RP floors at 0', () => {
    const s = computeBlastSplash(2, 0, 0, 0, 5, 1, 1) // close, raw 1/1
    expect(s!.splashWP).toBe(1) // max(1, floor(0.5))
    expect(s!.splashRP).toBe(0) // max(0, floor(0.5))
  })
})

describe('mortalWoundCountdown - 4 + PHY, floored at 1', () => {
  it('baseline PHY 0 = 4 rounds', () => {
    expect(mortalWoundCountdown(0)).toBe(4)
  })
  it('positive PHY raises the countdown', () => {
    expect(mortalWoundCountdown(2)).toBe(6)
  })
  it('negative PHY never drops below 1 round', () => {
    expect(mortalWoundCountdown(-3)).toBe(1)
    expect(mortalWoundCountdown(-5)).toBe(1)
  })
})

describe('buildCmodBreakdown - source-labeled CMod terms', () => {
  it('empty input yields no terms and a 0 total', () => {
    const b = buildCmodBreakdown({})
    expect(b.terms).toEqual([])
    expect(b.total).toBe(0)
  })

  it('drops zero-valued sources', () => {
    const b = buildCmodBreakdown({ aim: 0, range: 0, sameTarget: 0 })
    expect(b.terms).toEqual([])
    expect(b.total).toBe(0)
  })

  it('keeps each non-zero source as its own signed term', () => {
    const b = buildCmodBreakdown({ aim: 2, range: -4, sameTarget: 1 })
    expect(b.terms).toEqual([
      { label: 'Aim', value: 2 },
      { label: 'Same target CMod', value: 1 },
      { label: 'Range CMod', value: -4 },
    ])
    expect(b.total).toBe(-1)
  })

  it('Aim stays a positive term even when target defense pushes the net negative (Xero ruling)', () => {
    // The whole point: Aim must never be silently netted away by defense.
    const b = buildCmodBreakdown({ aim: 2, targetDefense: -4, targetDefenseLabel: 'Target RDM' })
    expect(b.terms).toContainEqual({ label: 'Aim', value: 2 })
    expect(b.terms).toContainEqual({ label: 'Target RDM', value: -4 })
    expect(b.total).toBe(-2)
  })

  it('uses the supplied target-defense label (MDM melee / RDM ranged), defaulting when absent', () => {
    expect(buildCmodBreakdown({ targetDefense: -2, targetDefenseLabel: 'Target MDM' }).terms)
      .toEqual([{ label: 'Target MDM', value: -2 }])
    expect(buildCmodBreakdown({ targetDefense: -2 }).terms)
      .toEqual([{ label: 'Target defense', value: -2 }])
  })

  it('preserves a fixed display order regardless of input key order', () => {
    const b = buildCmodBreakdown({ insight: 3, weaponCondition: -1, aim: 2 })
    expect(b.terms.map(t => t.label)).toEqual(['Weapon CMod', 'Aim', 'Insight CMod'])
  })

  it('total always equals the sum of kept terms', () => {
    const b = buildCmodBreakdown({
      weaponCondition: -1, aim: 2, coordinate: 2, coordinatedEffort: 1,
      sameTarget: 1, targetDefense: -2, range: -4, sick: -2, insight: 3, manual: 1,
    })
    expect(b.total).toBe(b.terms.reduce((s, t) => s + t.value, 0))
    expect(b.total).toBe(1)
  })

  it('keeps a manual GM adjustment as its own CMod term', () => {
    const b = buildCmodBreakdown({ aim: 2, manual: -1 })
    expect(b.terms).toContainEqual({ label: 'CMod', value: -1 })
    expect(b.total).toBe(1)
  })
  it('shows the Cover Fire CMod term when incoming (H4), drops it at zero', () => {
    const b = buildCmodBreakdown({ incomingCmod: -2, aim: 1 })
    expect(b.terms).toContainEqual({ label: 'Cover Fire CMod', value: -2 })
    expect(b.total).toBe(-1)
    expect(buildCmodBreakdown({ incomingCmod: 0 }).terms).not.toContainEqual(
      expect.objectContaining({ label: 'Cover Fire CMod' }),
    )
  })
})

describe('resolveTargetDefense - target MDM/RDM on the to-hit roll', () => {
  const pcCtx: TargetLookupCtx = {
    entries: [{ userId: 'u1', character: { id: 'c1', name: 'Vera', data: { rapid: { PHY: 3, DEX: 1 } } } }],
    npcs: [],
    tokens: [],
    initiative: [],
  }

  it('PC melee target uses PHY and labels Target MDM', () => {
    expect(resolveTargetDefense('Vera', true, pcCtx)).toEqual({ value: 3, label: 'Target MDM' })
  })
  it('PC ranged target uses DEX and labels Target RDM', () => {
    expect(resolveTargetDefense('Vera', false, pcCtx)).toEqual({ value: 1, label: 'Target RDM' })
  })
  it('NPC target falls back to the physicality/dexterity columns', () => {
    const ctx: TargetLookupCtx = { entries: [], npcs: [{ name: 'Goon', physicality: 2, dexterity: 4 }], tokens: [], initiative: [] }
    expect(resolveTargetDefense('Goon', true, ctx)).toEqual({ value: 2, label: 'Target MDM' })
    expect(resolveTargetDefense('Goon', false, ctx)).toEqual({ value: 4, label: 'Target RDM' })
  })
  it('object target has no defense (0)', () => {
    const ctx: TargetLookupCtx = { entries: [], npcs: [], tokens: [{ token_type: 'object', name: 'Barrel' }], initiative: [] }
    expect(resolveTargetDefense('Barrel', true, ctx)).toEqual({ value: 0, label: 'Target MDM' })
  })
  it('adds the initiative defense_bonus (Defend / Take Cover)', () => {
    const ctx: TargetLookupCtx = { ...pcCtx, initiative: [{ character_name: 'Vera', defense_bonus: 2 }] }
    expect(resolveTargetDefense('Vera', true, ctx).value).toBe(5) // 3 PHY + 2 bonus
  })
  it('a PC entry wins over a same-named NPC (entries are checked first)', () => {
    const ctx: TargetLookupCtx = {
      entries: [{ userId: 'u1', character: { id: 'c1', name: 'Echo', data: { rapid: { PHY: 5, DEX: 5 } } } }],
      npcs: [{ name: 'Echo', physicality: 0, dexterity: 0 }],
      tokens: [], initiative: [],
    }
    expect(resolveTargetDefense('Echo', true, ctx).value).toBe(5)
  })
  it('an unknown non-object target defaults to a 0 base', () => {
    expect(resolveTargetDefense('Nobody', true, { entries: [], npcs: [], tokens: [], initiative: [] }))
      .toEqual({ value: 0, label: 'Target MDM' })
  })
})

describe('computeAttackCmod - itemized auto CMod for the prefill + dropdown', () => {
  const baseCtx: AttackCmodCtx = {
    entries: [{ userId: 'u1', character: { id: 'c1', name: 'Attacker', data: { rapid: { PHY: 0, DEX: 0 } } } }],
    npcs: [{ name: 'Goon', physicality: 2, dexterity: 3 }],
    tokens: [],
    initiative: [{ character_name: 'Attacker', character_id: 'c1', is_active: true, aim_bonus: 0 }],
    userId: 'u1',
    pendingLabel: '',
    coordEffort: null,
  }
  const rifle = { weaponName: 'Assault Rifle', conditionCmod: 0 } // ranged
  const bat = { weaponName: 'Baseball Bat', conditionCmod: 0 }    // melee

  it('subtracts ranged target defense (RDM) from the net and itemizes it', () => {
    const { net, sources } = computeAttackCmod('Goon', rifle, baseCtx)
    expect(sources.targetDefense).toBe(-3) // -DEX
    expect(sources.targetDefenseLabel).toBe('Target RDM')
    expect(net).toBe(-3)
  })
  it('a melee weapon resolves defense against the target MDM (PHY)', () => {
    const { sources } = computeAttackCmod('Goon', bat, baseCtx)
    expect(sources.targetDefense).toBe(-2) // -PHY
    expect(sources.targetDefenseLabel).toBe('Target MDM')
  })
  it('Aim is carried as its own positive source and added to the net', () => {
    const ctx: AttackCmodCtx = { ...baseCtx, initiative: [{ character_name: 'Attacker', character_id: 'c1', is_active: true, aim_bonus: 2 }] }
    const { net, sources } = computeAttackCmod('Goon', rifle, ctx)
    expect(sources.aim).toBe(2)
    expect(net).toBe(-1) // +2 aim - 3 RDM
  })
  it('weapon condition CMod flows through', () => {
    const { net, sources } = computeAttackCmod('Goon', { weaponName: 'Assault Rifle', conditionCmod: -1 }, baseCtx)
    expect(sources.weaponCondition).toBe(-1)
    expect(net).toBe(-4) // -1 - 3
  })
  it('same-target bonus (+1) when the active combatant already hit this target', () => {
    const ctx: AttackCmodCtx = { ...baseCtx, initiative: [{ character_name: 'Attacker', character_id: 'c1', is_active: true, aim_bonus: 0, last_attack_target: 'Goon' }] }
    expect(computeAttackCmod('Goon', rifle, ctx).sources.sameTarget).toBe(1)
  })
  it('coordinate bonus applies when the active entry coordinated on this target', () => {
    const ctx: AttackCmodCtx = { ...baseCtx, initiative: [{ character_name: 'Attacker', character_id: 'c1', is_active: true, aim_bonus: 0, coordinate_target: 'Goon', coordinate_bonus: 3 }] }
    expect(computeAttackCmod('Goon', rifle, ctx).sources.coordinate).toBe(3)
  })
  it('coordinated-effort bonus applies for a chain participant', () => {
    const ctx: AttackCmodCtx = { ...baseCtx, coordEffort: { participantIds: ['c1'], totalParticipants: 3, leadCmod: 1 } }
    expect(computeAttackCmod('Goon', rifle, ctx).sources.coordinatedEffort).toBe(3) // (3-1) + 1
  })
  it('coordinated-effort is suppressed on a Group Check', () => {
    const ctx: AttackCmodCtx = {
      ...baseCtx,
      pendingLabel: 'Group Check - Athletics (led by X)',
      coordEffort: { participantIds: ['c1'], totalParticipants: 3, leadCmod: 1 },
    }
    expect(computeAttackCmod('Goon', rifle, ctx).sources.coordinatedEffort).toBe(0)
  })
  it('net always equals the sum of the itemized sources (reconciles to buildCmodBreakdown)', () => {
    const ctx: AttackCmodCtx = {
      ...baseCtx,
      initiative: [{ character_name: 'Attacker', character_id: 'c1', is_active: true, aim_bonus: 2, coordinate_target: 'Goon', coordinate_bonus: 1, last_attack_target: 'Goon' }],
    }
    const { net, sources } = computeAttackCmod('Goon', { weaponName: 'Assault Rifle', conditionCmod: -1 }, ctx)
    const sum = (sources.weaponCondition ?? 0) + (sources.aim ?? 0) + (sources.coordinatedEffort ?? 0)
      + (sources.coordinate ?? 0) + (sources.sameTarget ?? 0) + (sources.targetDefense ?? 0)
      + (sources.grappledTarget ?? 0) + (sources.incomingCmod ?? 0)
    expect(net).toBe(sum)
  })
  it('H4 Cover Fire: incoming_cmod on the attacker row applies -2 to their attack', () => {
    const ctx: AttackCmodCtx = {
      ...baseCtx,
      initiative: [{ character_name: 'Attacker', character_id: 'c1', is_active: true, aim_bonus: 0, incoming_cmod: -2 }],
    }
    const { net, sources } = computeAttackCmod('Goon', rifle, ctx)
    expect(sources.incomingCmod).toBe(-2)
    expect(net).toBe(-5) // -2 suppressed - 3 RDM
  })
  it('H4 Cover Fire stacks: two suppressors leave incoming_cmod at -4', () => {
    const ctx: AttackCmodCtx = {
      ...baseCtx,
      initiative: [{ character_name: 'Attacker', character_id: 'c1', is_active: true, aim_bonus: 0, incoming_cmod: -4 }],
    }
    expect(computeAttackCmod('Goon', rifle, ctx).sources.incomingCmod).toBe(-4)
  })
  it('incomingCmod is absent (not 0) when the attacker was not suppressed', () => {
    expect(computeAttackCmod('Goon', rifle, baseCtx).sources.incomingCmod).toBeUndefined()
  })
  it('grappled target adds +1 CMod (held target cannot dodge)', () => {
    const ctx: AttackCmodCtx = {
      ...baseCtx,
      initiative: [
        { character_name: 'Attacker', character_id: 'c1', is_active: true, aim_bonus: 0 },
        { character_name: 'Goon', is_active: false, grappled_by: 'Attacker' },
      ],
    }
    const { net, sources } = computeAttackCmod('Goon', { weaponName: 'Assault Rifle', conditionCmod: 0 }, ctx)
    expect(sources.grappledTarget).toBe(1)
    expect(net).toBe(-2) // +1 grappled - 3 RDM
  })
  it('grappledTarget is absent (not 0) when target is NOT grappled', () => {
    const { sources } = computeAttackCmod('Goon', { weaponName: 'Assault Rifle', conditionCmod: 0 }, baseCtx)
    expect(sources.grappledTarget).toBeUndefined()
  })
})
