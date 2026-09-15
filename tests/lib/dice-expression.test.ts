import { describe, it, expect } from 'vitest'
import {
  matchRollCommand,
  parseDiceExpression,
  formatDiceExpr,
  rollParsedDice,
  rollDiceExpression,
  MAX_DICE,
  MAX_SIDES,
  DICE_PANEL_SIDES,
} from '../../lib/dice-expression'

/** Deterministic rng: replays the given 0..1 values, then repeats the last. */
function seq(...vals: number[]) {
  let i = 0
  return () => vals[Math.min(i++, vals.length - 1)]
}

describe('matchRollCommand', () => {
  it('matches /r and /roll, any case', () => {
    expect(matchRollCommand('/r 1d6')).toBe('1d6')
    expect(matchRollCommand('/roll 2d8+1')).toBe('2d8+1')
    expect(matchRollCommand('/R 1d20')).toBe('1d20')
  })
  it('is not a roll command without an expression', () => {
    expect(matchRollCommand('/r')).toBeNull()
    expect(matchRollCommand('/r ')).toBeNull()
  })
  it('leaves ordinary chat and other slash commands alone', () => {
    expect(matchRollCommand('rolling a d20 now')).toBeNull()
    expect(matchRollCommand('/w Percy hi')).toBeNull()
    // Guard against a greedy /r matching /roll-alikes that are not rolls.
    expect(matchRollCommand('/rest 8')).toBeNull()
  })
})

describe('parseDiceExpression', () => {
  it('parses a bare NdM', () => {
    expect(parseDiceExpression('1d6')).toEqual({ count: 1, sides: 6, modifier: 0 })
  })
  it('sums every trailing modifier', () => {
    expect(parseDiceExpression('3d20+3+2-1')).toEqual({ count: 3, sides: 20, modifier: 4 })
  })
  it('handles a lone negative modifier', () => {
    expect(parseDiceExpression('1d100-2')).toEqual({ count: 1, sides: 100, modifier: -2 })
  })
  it('ignores whitespace anywhere', () => {
    expect(parseDiceExpression(' 2 d 10 + 1 ')).toEqual({ count: 2, sides: 10, modifier: 1 })
  })
  it('clamps dice count and sides to the safety guards', () => {
    expect(parseDiceExpression('9999d99999')).toEqual({ count: MAX_DICE, sides: MAX_SIDES, modifier: 0 })
  })
  it('keeps the legacy sides floor of 2, so 1d1 is 1d2', () => {
    // Deliberate: changing this would silently alter results for anyone
    // already typing it. Locked by test so a future "fix" is a conscious one.
    expect(parseDiceExpression('1d1')?.sides).toBe(2)
  })
  it('clamps a zero count up to 1 rather than rolling nothing', () => {
    expect(parseDiceExpression('0d6')?.count).toBe(1)
  })
  it('returns null on malformed input instead of throwing', () => {
    for (const bad of ['', 'd6', '1d', 'abc', '1d6+', '1d6++2', '1x6', '1d6 extra']) {
      expect(parseDiceExpression(bad)).toBeNull()
    }
  })
})

describe('formatDiceExpr', () => {
  it('omits a zero modifier', () => {
    expect(formatDiceExpr({ count: 1, sides: 6, modifier: 0 })).toBe('1d6')
  })
  it('signs the modifier both ways', () => {
    expect(formatDiceExpr({ count: 3, sides: 20, modifier: 4 })).toBe('3d20+4')
    expect(formatDiceExpr({ count: 1, sides: 8, modifier: -2 })).toBe('1d8-2')
  })
})

describe('rollParsedDice', () => {
  it('rolls one value per die, each within 1..sides', () => {
    const out = rollParsedDice({ count: 3, sides: 6, modifier: 0 }, seq(0, 0.5, 0.999))
    expect(out.rolls).toEqual([1, 4, 6])
    expect(out.sum).toBe(11)
    expect(out.total).toBe(11)
  })
  it('adds the modifier to the total but not to the individual dice', () => {
    const out = rollParsedDice({ count: 2, sides: 6, modifier: 5 }, seq(0.5))
    expect(out.rolls).toEqual([4, 4])
    expect(out.sum).toBe(8)
    expect(out.total).toBe(13)
  })
  it('never rolls below 1 or above sides at the rng extremes', () => {
    expect(rollParsedDice({ count: 1, sides: 20, modifier: 0 }, seq(0)).rolls).toEqual([1])
    expect(rollParsedDice({ count: 1, sides: 20, modifier: 0 }, seq(0.9999999)).rolls).toEqual([20])
  })
  it('formats the chat line exactly as the original /r did', () => {
    // This string is what lands in chat_messages. Locked so the visual panel
    // and the typed command stay byte-identical in the feed.
    expect(rollParsedDice({ count: 2, sides: 6, modifier: 0 }, seq(0.5)).text)
      .toBe('🎲 2d6 → [4+4] = 8')
    expect(rollParsedDice({ count: 1, sides: 20, modifier: 3 }, seq(0.5)).text)
      .toBe('🎲 1d20+3 → [11] +3 = 14')
    expect(rollParsedDice({ count: 1, sides: 20, modifier: -2 }, seq(0.5)).text)
      .toBe('🎲 1d20-2 → [11] -2 = 9')
  })
})

describe('rollDiceExpression', () => {
  it('parses and rolls in one step', () => {
    expect(rollDiceExpression('2d6', seq(0.5))?.total).toBe(8)
  })
  it('returns null on a malformed expression', () => {
    expect(rollDiceExpression('nonsense')).toBeNull()
  })
})

describe('DICE_PANEL_SIDES', () => {
  it('covers d3 through d20 per the spec', () => {
    expect([...DICE_PANEL_SIDES]).toEqual([3, 4, 6, 8, 10, 12, 20])
  })
  it('every panel die is a valid expression the shared parser accepts', () => {
    for (const sides of DICE_PANEL_SIDES) {
      expect(parseDiceExpression(`1d${sides}`)).toEqual({ count: 1, sides, modifier: 0 })
    }
  })
})
