import { describe, it, expect } from 'vitest'
import { distractActionDelta, distractNarrative } from '../../lib/distract-helpers'

describe('distractActionDelta', () => {
  it('returns -2 on Wild Success and High Insight (target loses BOTH actions)', () => {
    expect(distractActionDelta('Wild Success')).toBe(-2)
    expect(distractActionDelta('High Insight')).toBe(-2)
  })

  it('returns -1 on Success (target loses 1 action)', () => {
    expect(distractActionDelta('Success')).toBe(-1)
  })

  it('returns +1 on Dire Failure (target gains 1 action, "Inspired")', () => {
    expect(distractActionDelta('Dire Failure')).toBe(+1)
  })

  it('returns 0 on Failure and Low Insight (no effect)', () => {
    expect(distractActionDelta('Failure')).toBe(0)
    expect(distractActionDelta('Low Insight')).toBe(0)
  })

  it('returns 0 on unrecognized outcome strings (defensive)', () => {
    expect(distractActionDelta('')).toBe(0)
    expect(distractActionDelta('Grappled!')).toBe(0)
    expect(distractActionDelta('combat_start')).toBe(0)
  })
})

describe('distractNarrative', () => {
  it('renders the BOTH-actions narrative for delta=-2 applied', () => {
    expect(distractNarrative('Goon 1', -2, true)).toBe('Goon 1 loses BOTH actions this turn.')
  })

  it('renders the 1-action narrative for delta=-1 applied', () => {
    expect(distractNarrative('Goon 1', -1, true)).toBe('Goon 1 loses 1 action.')
  })

  it('renders the Inspired narrative for delta=+1 applied (Dire Failure)', () => {
    expect(distractNarrative('Goon 1', +1, true))
      .toBe('Goon 1 shrugs it off and gains an action - Inspired!')
  })

  it('renders the shrugged-off narrative when applied is false (Failure / LI)', () => {
    expect(distractNarrative('Goon 1', 0, false)).toBe('Goon 1 shrugged off the distraction.')
    // delta value is ignored when applied=false (consistent fallback)
    expect(distractNarrative('Goon 1', -1, false)).toBe('Goon 1 shrugged off the distraction.')
  })

  it('falls back to shrugged-off when applied=true but delta=0 (defensive)', () => {
    expect(distractNarrative('Goon 1', 0, true)).toBe('Goon 1 shrugged off the distraction.')
  })

  it('preserves the target name verbatim', () => {
    expect(distractNarrative("O'Malley", -1, true)).toContain("O'Malley loses 1 action.")
    expect(distractNarrative('GOON 1', -2, true)).toContain('GOON 1 loses BOTH actions')
  })
})
