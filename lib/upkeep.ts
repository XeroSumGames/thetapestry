// Upkeep Check state machine - canon §07 Equipment > Upkeep.
//
// A character rolls an Upkeep check (Mechanic*, Tinkerer, or the weapon's
// combat skill) against an item's current condition. The roll outcome
// transitions the condition state. Pure function so the resolution path
// can be unit-tested without dragging in supabase + character state I/O.
//
// Canon (locked):
//   Pristine -> Used -> Worn -> Damaged -> Broken (5 states, ordered).
//   Wild Success:  improve 1 level, capped at Used (Pristine unreachable via Upkeep)
//   High Insight:  improve 2 levels, also capped at Used
//   Success:       no change to condition (keeps it from degrading)
//   Failure:       degrade 1 level
//   Dire Failure:  break immediately (jump to Broken regardless of starting state)
//   Low Insight:   break immediately + 1 WP damage to the character
//
// CharacterCard already gates `Attack` on `condition === 'Broken'` so a
// broken weapon refuses to fire (CharacterCard.tsx:1014).

import type { ItemCondition } from './xse-schema'

export const UPKEEP_CONDITIONS: readonly ItemCondition[] = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']

// Upkeep check can never restore to Pristine - the floor is Used (idx 1).
// Source: app/rules/equipment/upkeep page; matches the inline math in
// useRollResolution.ts (Math.max(1, ...)).
const UPKEEP_FLOOR_IDX = 1
const BROKEN_IDX = UPKEEP_CONDITIONS.length - 1

export type UpkeepOutcome =
  | 'Wild Success'
  | 'High Insight'
  | 'Success'
  | 'Failure'
  | 'Dire Failure'
  | 'Low Insight'

export interface UpkeepResult {
  /** New condition after the transition. */
  next: ItemCondition
  /** WP damage inflicted on the character (Low Insight = 1, else 0). */
  breakWP: number
  /** Human-readable line for the result panel. */
  message: string
}

export function upkeepTransition(current: ItemCondition, outcome: UpkeepOutcome): UpkeepResult {
  const currentIdx = UPKEEP_CONDITIONS.indexOf(current)
  // Defensive: an unknown condition falls back to 'Used' so the resolver
  // never crashes on legacy data with a typo or missing field.
  const safeIdx = currentIdx >= 0 ? currentIdx : UPKEEP_FLOOR_IDX
  switch (outcome) {
    case 'Wild Success': {
      const next = UPKEEP_CONDITIONS[Math.max(UPKEEP_FLOOR_IDX, safeIdx - 1)]
      return { next, breakWP: 0, message: 'Condition improved by 1 level' }
    }
    case 'High Insight': {
      const next = UPKEEP_CONDITIONS[Math.max(UPKEEP_FLOOR_IDX, safeIdx - 2)]
      return { next, breakWP: 0, message: 'Condition improved by 2 levels' }
    }
    case 'Success':
      return { next: UPKEEP_CONDITIONS[safeIdx], breakWP: 0, message: 'No change to condition' }
    case 'Failure': {
      const next = UPKEEP_CONDITIONS[Math.min(BROKEN_IDX, safeIdx + 1)]
      return { next, breakWP: 0, message: 'Condition degraded by 1 level' }
    }
    case 'Dire Failure':
      return { next: UPKEEP_CONDITIONS[BROKEN_IDX], breakWP: 0, message: 'Item breaks immediately!' }
    case 'Low Insight':
      return { next: UPKEEP_CONDITIONS[BROKEN_IDX], breakWP: 1, message: 'Item breaks immediately! 1 WP damage.' }
  }
}
