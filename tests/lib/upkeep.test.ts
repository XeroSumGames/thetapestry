import { describe, it, expect } from 'vitest'
import { upkeepTransition, UPKEEP_CONDITIONS } from '../../lib/upkeep'
import type { ItemCondition } from '../../lib/xse-schema'

describe('upkeepTransition - canon state machine', () => {
  describe('Wild Success: improve 1 level, capped at Used', () => {
    it('Used -> Used (floor; cannot reach Pristine via Upkeep)', () => {
      expect(upkeepTransition('Used', 'Wild Success').next).toBe('Used')
    })
    it('Worn -> Used', () => {
      expect(upkeepTransition('Worn', 'Wild Success').next).toBe('Used')
    })
    it('Damaged -> Worn', () => {
      expect(upkeepTransition('Damaged', 'Wild Success').next).toBe('Worn')
    })
    it('Broken -> Damaged', () => {
      expect(upkeepTransition('Broken', 'Wild Success').next).toBe('Damaged')
    })
    it('Pristine -> Used (defensive: never goes below floor)', () => {
      expect(upkeepTransition('Pristine', 'Wild Success').next).toBe('Used')
    })
  })

  describe('High Insight: improve 2 levels, capped at Used', () => {
    it('Used -> Used (floor)', () => {
      expect(upkeepTransition('Used', 'High Insight').next).toBe('Used')
    })
    it('Worn -> Used (1-level improve hits the floor)', () => {
      expect(upkeepTransition('Worn', 'High Insight').next).toBe('Used')
    })
    it('Damaged -> Used (2-level full improve)', () => {
      expect(upkeepTransition('Damaged', 'High Insight').next).toBe('Used')
    })
    it('Broken -> Worn (2-level full improve)', () => {
      expect(upkeepTransition('Broken', 'High Insight').next).toBe('Worn')
    })
  })

  describe('Success: no change', () => {
    for (const cond of UPKEEP_CONDITIONS) {
      it(`${cond} -> ${cond}`, () => {
        expect(upkeepTransition(cond, 'Success').next).toBe(cond)
      })
    }
  })

  describe('Failure: degrade 1 level, capped at Broken', () => {
    it('Pristine -> Used', () => {
      expect(upkeepTransition('Pristine', 'Failure').next).toBe('Used')
    })
    it('Used -> Worn', () => {
      expect(upkeepTransition('Used', 'Failure').next).toBe('Worn')
    })
    it('Worn -> Damaged', () => {
      expect(upkeepTransition('Worn', 'Failure').next).toBe('Damaged')
    })
    it('Damaged -> Broken', () => {
      expect(upkeepTransition('Damaged', 'Failure').next).toBe('Broken')
    })
    it('Broken -> Broken (cannot go past the ceiling)', () => {
      expect(upkeepTransition('Broken', 'Failure').next).toBe('Broken')
    })
  })

  describe('Dire Failure: jump straight to Broken', () => {
    for (const cond of UPKEEP_CONDITIONS) {
      it(`${cond} -> Broken`, () => {
        expect(upkeepTransition(cond, 'Dire Failure').next).toBe('Broken')
      })
    }
  })

  describe('Low Insight: jump to Broken + 1 WP damage', () => {
    it('Used -> Broken, 1 WP damage', () => {
      const r = upkeepTransition('Used', 'Low Insight')
      expect(r.next).toBe('Broken')
      expect(r.breakWP).toBe(1)
      expect(r.message).toContain('1 WP damage')
    })
    it('Pristine -> Broken, 1 WP damage', () => {
      expect(upkeepTransition('Pristine', 'Low Insight').next).toBe('Broken')
      expect(upkeepTransition('Pristine', 'Low Insight').breakWP).toBe(1)
    })
  })

  describe('breakWP is 0 for every non-Low-Insight outcome', () => {
    const noBreak = ['Wild Success', 'High Insight', 'Success', 'Failure', 'Dire Failure'] as const
    for (const outcome of noBreak) {
      it(`${outcome} leaves breakWP at 0`, () => {
        expect(upkeepTransition('Used', outcome).breakWP).toBe(0)
      })
    }
  })

  describe('defensive: unknown current condition treated as Used', () => {
    it('Wild Success from "unknown" still floors at Used', () => {
      expect(upkeepTransition('unknown' as ItemCondition, 'Wild Success').next).toBe('Used')
    })
    it('Failure from "unknown" degrades from Used baseline -> Worn', () => {
      expect(upkeepTransition('unknown' as ItemCondition, 'Failure').next).toBe('Worn')
    })
  })
})
