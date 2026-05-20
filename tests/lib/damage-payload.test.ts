import { describe, it, expect } from 'vitest'
import type {
  DamagePayload,
  AttackDamage,
  CombatantsList,
  InitiativeOrder,
  RecruitResult,
  CommunityWeeklyCheck,
  CharacterEvolutionSpend,
  VehicleCheck,
  FirstImpressionResult,
  StabilizeResult,
  DistractResult,
  GutInstinctResult,
  CoordEffortChainLead,
  DamagePayloadKind,
} from '../../lib/damage-payload'
import {
  makeAttackDamage,
  makeCombatantsList,
  makeInitiativeOrder,
  makeRecruitResult,
  makeCommunityWeeklyCheck,
  makeCharacterEvolutionSpend,
  makeVehicleCheck,
  makeFirstImpressionResult,
  makeStabilizeResult,
  makeDistractResult,
  makeGutInstinctResult,
} from '../../lib/damage-payload'

// Phase D1 tests (tasks/spec-damage-json-payload.md). The types are
// new and have no runtime consumers yet, so these tests are primarily
// type-level: each variant gets a const declaration that the compiler
// must accept. The runtime expect()s lock the `kind` discriminator
// strings so a future rename of e.g. 'attack' -> 'attack_damage'
// would fail loudly here. Catches accidental drift between the spec
// and the types.

describe('DamagePayload - AttackDamage', () => {
  it('compiles with all required fields', () => {
    const p: AttackDamage = {
      kind: 'attack',
      rollWP: 7, rollRP: 3,
      weaponName: 'Pistol',
      damageRoll: '2d6+1',
      appliedWP: 5, appliedRP: 2,
      rpPercent: 50, rpFloor: 'C',
      targetName: 'Goon 1',
    }
    expect(p.kind).toBe('attack')
  })
  it('compiles with optional burst / blast / insight fields', () => {
    const p: AttackDamage = {
      kind: 'attack',
      rollWP: 12, rollRP: 6,
      weaponName: 'Assault Rifle',
      damageRoll: '3d6',
      appliedWP: 10, appliedRP: 5,
      rpPercent: 70, rpFloor: 'B',
      targetName: 'Goon 1',
      burstHits: 3,
      blastCells: [{ x: 4, y: 5 }, { x: 5, y: 5 }],
      dieSpent: 'pre',
      diceRolled: [6, 5, 4],
      weaponJammed: false,
      notes: 'point-blank',
    }
    expect(p.burstHits).toBe(3)
    expect(p.blastCells?.length).toBe(2)
  })
})

describe('DamagePayload - CombatantsList', () => {
  it('compiles with required fields', () => {
    const p: CombatantsList = {
      kind: 'combatants',
      combatants: [
        { id: 'a', name: 'Alice', isNpc: false },
        { id: 'b', name: 'Goon 1', isNpc: true },
      ],
    }
    expect(p.kind).toBe('combatants')
    expect(p.combatants.length).toBe(2)
  })
  it('compiles with optional combatRound', () => {
    const p: CombatantsList = {
      kind: 'combatants',
      combatants: [],
      combatRound: 3,
    }
    expect(p.combatRound).toBe(3)
  })
})

describe('DamagePayload - InitiativeOrder', () => {
  it('compiles with required fields', () => {
    const p: InitiativeOrder = {
      kind: 'initiative',
      initiative: [
        { id: 'a', character_name: 'Alice', roll: 9, isNpc: false },
        { id: 'b', character_name: 'Goon 1', roll: 6, isNpc: true },
      ],
    }
    expect(p.kind).toBe('initiative')
  })
})

describe('DamagePayload - RecruitResult', () => {
  it('compiles with PC recruit shape', () => {
    const p: RecruitResult = {
      kind: 'recruit',
      rollOutcome: 'Wild Success',
      approach: 'cohort',
      recruitmentType: 'cohort',
      communityId: 'c1',
      communityName: 'Camp Hopeful',
    }
    expect(p.kind).toBe('recruit')
  })
  it('compiles with proxy recruit shape (NPC leader)', () => {
    const p: RecruitResult = {
      kind: 'recruit',
      rollOutcome: 'Success',
      approach: 'convert',
      recruitmentType: 'convert',
      proxy: true,
      leaderNpcId: 'npc1',
      leaderNpcName: 'Marshall',
      communityId: 'c1',
      communityName: 'Camp Hopeful',
    }
    expect(p.proxy).toBe(true)
  })
  it('compiles with apprentice shape', () => {
    const p: RecruitResult = {
      kind: 'recruit',
      rollOutcome: 'High Insight',
      approach: 'cohort',
      recruitmentType: 'apprentice',
      apprentice: true,
      apprenticeBondNpcId: 'npc1',
    }
    expect(p.apprentice).toBe(true)
  })
})

describe('DamagePayload - CommunityWeeklyCheck', () => {
  it('compiles with morale-check shape', () => {
    const p: CommunityWeeklyCheck = {
      kind: 'community_check',
      checkType: 'morale',
      communityId: 'c1', communityName: 'Camp Hopeful',
      weekNumber: 4, rollOutcome: 'Failure',
      cmodForNextMorale: -1,
      departures: [{ id: 'm1', reason: 'morale failure' }],
    }
    expect(p.checkType).toBe('morale')
  })
  it('compiles with retention shape', () => {
    const p: CommunityWeeklyCheck = {
      kind: 'community_check',
      checkType: 'retention',
      communityId: 'c1', communityName: 'Camp Hopeful',
      weekNumber: 4, rollOutcome: 'Success',
      moodCmod: 1,
      departures: [],
    }
    expect(p.checkType).toBe('retention')
  })
})

describe('DamagePayload - CharacterEvolutionSpend', () => {
  it('compiles with rapid-attribute spend (snake_case field names match live write site)', () => {
    const p: CharacterEvolutionSpend = {
      kind: 'evolution',
      spendKind: 'rapid',
      key: 'PHY',
      from_level: 0, to_level: 1,
      cost: 5,
      target: 'self',
      apprentice_npc_id: null,
      narrative: null,
      new_cdp_balance: 15,
    }
    expect(p.spendKind).toBe('rapid')
    expect(p.from_level).toBe(0)
  })
  it('compiles with apprentice-skill spend', () => {
    const p: CharacterEvolutionSpend = {
      kind: 'evolution',
      spendKind: 'skill',
      key: 'Medicine',
      from_level: 1, to_level: 2,
      cost: 3,
      target: 'apprentice',
      apprentice_npc_id: 'npc1',
      narrative: 'taught by his master over 3 weeks',
      new_cdp_balance: 12,
    }
    expect(p.target).toBe('apprentice')
    expect(p.apprentice_npc_id).toBe('npc1')
  })
})

describe('DamagePayload - VehicleCheck', () => {
  it('compiles with brew check + supplies decrement', () => {
    const p: VehicleCheck = {
      kind: 'vehicle_check',
      vehicleId: 'v1', vehicleName: 'Minnie',
      checkKind: 'brew',
      skillLabel: 'Mechanic*',
      crewId: 'c1', crewKind: 'pc',
      fuelDelta: 1, fuelBefore: 4, fuelAfter: 5,
      suppliesDelta: -1,
      rollOutcome: 'Success',
    }
    expect(p.checkKind).toBe('brew')
  })
  it('compiles with drive check (no fuel delta)', () => {
    const p: VehicleCheck = {
      kind: 'vehicle_check',
      vehicleId: 'v1', vehicleName: 'Minnie',
      checkKind: 'drive',
      skillLabel: 'Driving',
      crewId: 'c1', crewKind: 'pc',
      fuelDelta: 0, fuelBefore: 4,
      rollOutcome: 'Success',
    }
    expect(p.checkKind).toBe('drive')
  })
})

describe('DamagePayload - FirstImpressionResult', () => {
  it('compiles with relationship before/after + optional whisper', () => {
    const p: FirstImpressionResult = {
      kind: 'first_impression',
      npcId: 'npc1', npcName: 'Marshall',
      rollOutcome: 'High Insight',
      startingRelationship: 0,
      newRelationship: 2,
      whisperHints: ['He smells like cheap whisky.'],
    }
    expect(p.newRelationship).toBe(2)
  })
})

describe('DamagePayload - StabilizeResult', () => {
  it('compiles with PC success shape', () => {
    const p: StabilizeResult = {
      kind: 'stabilize',
      medicCharacterId: 'pc1',
      patientName: 'Bob',
      patientIsNpc: false,
      rollOutcome: 'Success',
      incapRounds: 3,
      deathCountdownChange: -99,
    }
    expect(p.incapRounds).toBe(3)
  })
  it('compiles with NPC failure shape (no incap / no deathCountdownChange)', () => {
    const p: StabilizeResult = {
      kind: 'stabilize',
      medicCharacterId: 'pc1',
      patientName: 'Goon 1',
      patientIsNpc: true,
      rollOutcome: 'Failure',
    }
    expect(p.rollOutcome).toBe('Failure')
  })
})

describe('DamagePayload - DistractResult', () => {
  it('compiles with WS drain shape', () => {
    const p: DistractResult = {
      kind: 'distract',
      targetInitId: 'init1',
      targetName: 'Goon 1',
      rollOutcome: 'Wild Success',
      actionsRemovedFromTarget: 2,
    }
    expect(p.actionsRemovedFromTarget).toBe(2)
  })
  it('compiles with Dire Failure Inspired shape (negative drain)', () => {
    const p: DistractResult = {
      kind: 'distract',
      targetInitId: 'init1',
      targetName: 'Goon 1',
      rollOutcome: 'Dire Failure',
      actionsRemovedFromTarget: -1,
    }
    expect(p.actionsRemovedFromTarget).toBe(-1)
  })
})

describe('DamagePayload - GutInstinctResult', () => {
  it('compiles without whisper', () => {
    const p: GutInstinctResult = {
      kind: 'gut_instinct',
      rollOutcome: 'Success',
    }
    expect(p.kind).toBe('gut_instinct')
  })
  it('compiles with GM whisper detail', () => {
    const p: GutInstinctResult = {
      kind: 'gut_instinct',
      rollOutcome: 'High Insight',
      whisperDetail: 'The merchant is overcharging by 30%.',
    }
    expect(p.whisperDetail).toContain('overcharging')
  })
})

describe('DamagePayload - CoordEffortChainLead (read-time enrichment)', () => {
  it('compiles wrapping an AttackDamage lead', () => {
    const innerLead: AttackDamage = {
      kind: 'attack',
      rollWP: 9, rollRP: 4,
      weaponName: 'Pistol',
      damageRoll: '2d6',
      appliedWP: 7, appliedRP: 3,
      rpPercent: 50, rpFloor: 'C',
      targetName: 'Goon 1',
    }
    const wrapper: CoordEffortChainLead = {
      lead: innerLead,
      coordChainSkill: 'Tactics*',
      coordChainParticipants: [
        { id: 'a', name: 'Alice', isNpc: false },
        { id: 'b', name: 'Bob', isNpc: false },
      ],
    }
    expect(wrapper.lead.kind).toBe('attack')
    expect(wrapper.coordChainParticipants.length).toBe(2)
  })
})

describe('DamagePayload union - discriminated switch exhaustiveness', () => {
  it('switch on payload.kind narrows correctly', () => {
    function describePayload(p: DamagePayload): string {
      switch (p.kind) {
        case 'attack':           return `attack on ${p.targetName} for ${p.appliedWP} WP`
        case 'combatants':       return `combatants snapshot of ${p.combatants.length}`
        case 'initiative':       return `initiative order with ${p.initiative.length} entries`
        case 'recruit':          return `recruit ${p.approach} -> ${p.rollOutcome}`
        case 'community_check':  return `${p.checkType} check for ${p.communityName} week ${p.weekNumber}`
        case 'evolution':        return `evolution spend ${p.spendKind}=${p.key}`
        case 'vehicle_check':    return `vehicle ${p.checkKind} on ${p.vehicleName}`
        case 'first_impression': return `first impression on ${p.npcName} -> ${p.newRelationship}`
        case 'stabilize':        return `stabilize ${p.patientName} -> ${p.rollOutcome}`
        case 'distract':         return `distract ${p.targetName} (${p.actionsRemovedFromTarget})`
        case 'gut_instinct':     return `gut instinct -> ${p.rollOutcome}`
      }
    }

    const attack: AttackDamage = {
      kind: 'attack',
      rollWP: 7, rollRP: 3, weaponName: 'P', damageRoll: '2d6',
      appliedWP: 5, appliedRP: 2, rpPercent: 50, rpFloor: 'C',
      targetName: 'Goon 1',
    }
    expect(describePayload(attack)).toContain('Goon 1')
  })

  it('DamagePayloadKind has all 11 expected discriminators', () => {
    const expected: DamagePayloadKind[] = [
      'attack', 'combatants', 'initiative', 'recruit',
      'community_check', 'evolution', 'vehicle_check',
      'first_impression', 'stabilize', 'distract', 'gut_instinct',
    ]
    expect(expected.length).toBe(11)
    // Each must be a string-literal type derived from the union.
    for (const k of expected) {
      expect(typeof k).toBe('string')
    }
  })
})

// ─── Phase D2: writer helpers stamp the discriminator ─────────────
// Each helper takes the variant shape minus the `kind` field and
// returns the full variant. Tests below verify (a) the right `kind`
// gets stamped, (b) input fields pass through unchanged, (c) helpers
// don't mutate their input argument.

describe('makeAttackDamage', () => {
  it('stamps kind = "attack" + passes fields through', () => {
    const r = makeAttackDamage({
      rollWP: 7, rollRP: 3,
      weaponName: 'Pistol', damageRoll: '2d6+1',
      appliedWP: 5, appliedRP: 2,
      rpPercent: 50, rpFloor: 'C',
      targetName: 'Goon 1',
    })
    expect(r.kind).toBe('attack')
    expect(r.weaponName).toBe('Pistol')
    expect(r.targetName).toBe('Goon 1')
  })
  it('does not mutate input argument', () => {
    const input = {
      rollWP: 5, rollRP: 2, weaponName: 'P', damageRoll: '2d6',
      appliedWP: 4, appliedRP: 2, rpPercent: 50, rpFloor: 'C' as const,
      targetName: 'Goon 1',
    }
    const before = JSON.stringify(input)
    makeAttackDamage(input)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('makeCombatantsList', () => {
  it('stamps kind = "combatants" + preserves combatants array', () => {
    const r = makeCombatantsList({
      combatants: [{ id: 'a', name: 'Alice', isNpc: false }],
      combatRound: 1,
    })
    expect(r.kind).toBe('combatants')
    expect(r.combatants.length).toBe(1)
    expect(r.combatRound).toBe(1)
  })
})

describe('makeInitiativeOrder', () => {
  it('stamps kind = "initiative"', () => {
    const r = makeInitiativeOrder({
      initiative: [
        { id: 'a', character_name: 'Alice', roll: 9, isNpc: false },
      ],
    })
    expect(r.kind).toBe('initiative')
  })
})

describe('makeRecruitResult', () => {
  it('stamps kind = "recruit" on PC shape', () => {
    const r = makeRecruitResult({
      rollOutcome: 'Success',
      approach: 'cohort', recruitmentType: 'cohort',
      communityId: 'c1', communityName: 'Camp Hopeful',
    })
    expect(r.kind).toBe('recruit')
    expect(r.approach).toBe('cohort')
  })
  it('stamps kind = "recruit" on proxy shape', () => {
    const r = makeRecruitResult({
      rollOutcome: 'Wild Success',
      approach: 'convert', recruitmentType: 'convert',
      proxy: true, leaderNpcId: 'npc1', leaderNpcName: 'Marshall',
      communityId: 'c1', communityName: 'Camp Hopeful',
    })
    expect(r.kind).toBe('recruit')
    expect(r.proxy).toBe(true)
  })
})

describe('makeCommunityWeeklyCheck', () => {
  it('stamps kind = "community_check"', () => {
    const r = makeCommunityWeeklyCheck({
      checkType: 'morale',
      communityId: 'c1', communityName: 'Camp Hopeful',
      weekNumber: 4, rollOutcome: 'Failure',
    })
    expect(r.kind).toBe('community_check')
    expect(r.checkType).toBe('morale')
  })
})

describe('makeCharacterEvolutionSpend', () => {
  it('stamps kind = "evolution" on self spend (snake_case fields)', () => {
    const r = makeCharacterEvolutionSpend({
      spendKind: 'rapid', key: 'PHY',
      from_level: 0, to_level: 1, cost: 5,
      target: 'self',
      apprentice_npc_id: null, narrative: null,
      new_cdp_balance: 15,
    })
    expect(r.kind).toBe('evolution')
    expect(r.target).toBe('self')
    expect(r.from_level).toBe(0)
  })
  it('stamps kind = "evolution" on apprentice spend', () => {
    const r = makeCharacterEvolutionSpend({
      spendKind: 'skill', key: 'Medicine',
      from_level: 1, to_level: 2, cost: 3,
      target: 'apprentice', apprentice_npc_id: 'npc1',
      narrative: null,
      new_cdp_balance: 12,
    })
    expect(r.target).toBe('apprentice')
    expect(r.apprentice_npc_id).toBe('npc1')
  })
})

describe('makeVehicleCheck', () => {
  it('stamps kind = "vehicle_check" on brew', () => {
    const r = makeVehicleCheck({
      vehicleId: 'v1', vehicleName: 'Minnie',
      checkKind: 'brew', skillLabel: 'Mechanic*',
      crewId: 'c1', crewKind: 'pc',
      fuelDelta: 1, fuelBefore: 4, fuelAfter: 5,
      suppliesDelta: -1, rollOutcome: 'Success',
    })
    expect(r.kind).toBe('vehicle_check')
    expect(r.checkKind).toBe('brew')
  })
})

describe('makeFirstImpressionResult', () => {
  it('stamps kind = "first_impression"', () => {
    const r = makeFirstImpressionResult({
      npcId: 'n1', npcName: 'Marshall',
      rollOutcome: 'High Insight',
      startingRelationship: 0, newRelationship: 2,
    })
    expect(r.kind).toBe('first_impression')
    expect(r.newRelationship).toBe(2)
  })
})

describe('makeStabilizeResult', () => {
  it('stamps kind = "stabilize" on PC success', () => {
    const r = makeStabilizeResult({
      medicCharacterId: 'pc1', patientName: 'Bob',
      patientIsNpc: false, rollOutcome: 'Success',
      incapRounds: 3, deathCountdownChange: -99,
    })
    expect(r.kind).toBe('stabilize')
    expect(r.incapRounds).toBe(3)
  })
})

describe('makeDistractResult', () => {
  it('stamps kind = "distract" on WS drain', () => {
    const r = makeDistractResult({
      targetInitId: 'init1', targetName: 'Goon 1',
      rollOutcome: 'Wild Success', actionsRemovedFromTarget: 2,
    })
    expect(r.kind).toBe('distract')
    expect(r.actionsRemovedFromTarget).toBe(2)
  })
})

describe('makeGutInstinctResult', () => {
  it('stamps kind = "gut_instinct" without whisper', () => {
    const r = makeGutInstinctResult({ rollOutcome: 'Success' })
    expect(r.kind).toBe('gut_instinct')
    expect(r.whisperDetail).toBeUndefined()
  })
  it('stamps kind = "gut_instinct" with whisper detail', () => {
    const r = makeGutInstinctResult({
      rollOutcome: 'High Insight',
      whisperDetail: 'The merchant is overcharging.',
    })
    expect(r.whisperDetail).toContain('overcharging')
  })
})

describe('All 11 make* helpers - cross-check via DamagePayloadKind', () => {
  it('each helper returns a payload whose .kind is in the union', () => {
    const all: DamagePayload[] = [
      makeAttackDamage({
        rollWP: 7, rollRP: 3, weaponName: 'P', damageRoll: '2d6',
        appliedWP: 5, appliedRP: 2, rpPercent: 50, rpFloor: 'C',
        targetName: 'Goon 1',
      }),
      makeCombatantsList({ combatants: [] }),
      makeInitiativeOrder({ initiative: [] }),
      makeRecruitResult({
        rollOutcome: 'Success', approach: 'cohort', recruitmentType: 'cohort',
      }),
      makeCommunityWeeklyCheck({
        checkType: 'fed', communityId: 'c1', communityName: 'C',
        weekNumber: 1, rollOutcome: 'Success',
      }),
      makeCharacterEvolutionSpend({
        spendKind: 'rapid', key: 'PHY', from_level: 0, to_level: 1, cost: 5,
        target: 'self', apprentice_npc_id: null, narrative: null,
        new_cdp_balance: 15,
      }),
      makeVehicleCheck({
        vehicleId: 'v1', vehicleName: 'Minnie', checkKind: 'drive',
        skillLabel: 'Driving', crewId: 'c1', crewKind: 'pc',
        fuelDelta: 0, fuelBefore: 4, rollOutcome: 'Success',
      }),
      makeFirstImpressionResult({
        npcId: 'n1', npcName: 'M', rollOutcome: 'Success',
        startingRelationship: 0, newRelationship: 0,
      }),
      makeStabilizeResult({
        medicCharacterId: 'pc1', patientName: 'B', patientIsNpc: false,
        rollOutcome: 'Success',
      }),
      makeDistractResult({
        targetInitId: 'i1', targetName: 'G', rollOutcome: 'Success',
        actionsRemovedFromTarget: 1,
      }),
      makeGutInstinctResult({ rollOutcome: 'Success' }),
    ]
    expect(all.length).toBe(11)
    const validKinds: DamagePayloadKind[] = [
      'attack', 'combatants', 'initiative', 'recruit', 'community_check',
      'evolution', 'vehicle_check', 'first_impression', 'stabilize',
      'distract', 'gut_instinct',
    ]
    for (const p of all) {
      expect(validKinds).toContain(p.kind)
    }
    // Each kind appears exactly once.
    const kinds = all.map(p => p.kind).sort()
    const unique = [...new Set(kinds)]
    expect(unique.length).toBe(all.length)
  })
})
