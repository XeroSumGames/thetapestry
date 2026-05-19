import { describe, it, expect } from 'vitest'
import {
  firstImpressionCmodDelta,
  firstImpressionVibe,
  firstImpressionProgressionMessage,
} from '../../lib/first-impression-resolver'

describe('firstImpressionCmodDelta', () => {
  it('maps the SRD ladder outcomes exactly', () => {
    expect(firstImpressionCmodDelta('High Insight')).toBe(2)
    expect(firstImpressionCmodDelta('Wild Success')).toBe(1)
    expect(firstImpressionCmodDelta('Success')).toBe(0)
    expect(firstImpressionCmodDelta('Failure')).toBe(-1)
    expect(firstImpressionCmodDelta('Dire Failure')).toBe(-2)
    expect(firstImpressionCmodDelta('Low Insight')).toBe(-3)
  })

  it('does NOT use the legacy shifted ladder', () => {
    // Pre-2026-05-10 code shifted every tier +1 (Success gave +1
    // instead of 0, Low Insight gave -2 instead of -3, etc).
    // Locking the corrected mapping against regression.
    expect(firstImpressionCmodDelta('Success')).not.toBe(1)
    expect(firstImpressionCmodDelta('Low Insight')).not.toBe(-2)
    expect(firstImpressionCmodDelta('Dire Failure')).not.toBe(-1)
  })

  it('returns 0 for unknown outcomes (defensive)', () => {
    expect(firstImpressionCmodDelta('')).toBe(0)
    expect(firstImpressionCmodDelta('UnknownOutcome')).toBe(0)
    expect(firstImpressionCmodDelta('Grappled!')).toBe(0)
  })
})

describe('firstImpressionVibe', () => {
  it('maps each canonical delta to its vibe label', () => {
    expect(firstImpressionVibe(2)).toBe('great first impression')
    expect(firstImpressionVibe(1)).toBe('good first impression')
    expect(firstImpressionVibe(0)).toBe('neutral first impression')
    expect(firstImpressionVibe(-1)).toBe('rough start')
    expect(firstImpressionVibe(-2)).toBe('bad blood')
    expect(firstImpressionVibe(-3)).toBe('catastrophic first impression')
  })

  it('treats >= +2 as great (defensive vs clamp jitter)', () => {
    expect(firstImpressionVibe(3)).toBe('great first impression')
    expect(firstImpressionVibe(99)).toBe('great first impression')
  })

  it('falls back to catastrophic for under -3 (defensive)', () => {
    expect(firstImpressionVibe(-4)).toBe('catastrophic first impression')
    expect(firstImpressionVibe(-99)).toBe('catastrophic first impression')
  })
})

describe('firstImpressionProgressionMessage', () => {
  it('formats with NPC name + signed CMod for positive', () => {
    expect(firstImpressionProgressionMessage('Jules', 2))
      .toBe('Met Jules - great first impression (CMod +2).')
    expect(firstImpressionProgressionMessage('Marlowe Finch', 1))
      .toBe('Met Marlowe Finch - good first impression (CMod +1).')
  })

  it('uses +0 (not -0) for the zero case', () => {
    expect(firstImpressionProgressionMessage('Frankie', 0))
      .toBe('Met Frankie - neutral first impression (CMod +0).')
  })

  it('preserves the minus sign for negatives (no extra "+")', () => {
    expect(firstImpressionProgressionMessage('Stranger', -1))
      .toBe('Met Stranger - rough start (CMod -1).')
    expect(firstImpressionProgressionMessage('Enemy', -3))
      .toBe('Met Enemy - catastrophic first impression (CMod -3).')
  })

  it('handles NPC names with spaces and punctuation', () => {
    expect(firstImpressionProgressionMessage("Frank \"Frankie\" Wallace", 0))
      .toBe('Met Frank "Frankie" Wallace - neutral first impression (CMod +0).')
  })
})
