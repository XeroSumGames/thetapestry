// Regression net for the 2026-07-09 Feature Manifest data-loss fix.
// The page whole-blob upserts on every tick, so the load path must (1) never
// report a FAILED query as "no saved state" and (2) prune ids the current
// manifest no longer knows, so orphaned cells can't inflate the counts.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const maybeSingle = vi.fn()

vi.mock('../../lib/data/db', () => ({
  db: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
      }),
    }),
  }),
}))

import { loadFeatureChecklist, pruneChecklistToKnownIds } from '../../lib/data/feature-checklist'

describe('loadFeatureChecklist', () => {
  beforeEach(() => maybeSingle.mockReset())

  it('returns null (NOT {}) when the query errors, so a tick cannot wipe the blob', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'network down' } })
    expect(await loadFeatureChecklist('u1')).toBeNull()
  })

  it('returns {} for a genuinely missing row (no error)', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await loadFeatureChecklist('u1')).toEqual({})
  })

  it('returns the saved state for a valid blob', async () => {
    const state = { 'nav-sidebar': { d: true }, 'fog': { f: true } }
    maybeSingle.mockResolvedValue({ data: { state }, error: null })
    expect(await loadFeatureChecklist('u1')).toEqual(state)
  })

  it.each([
    ['array', ['not', 'a', 'blob']],
    ['string', 'oops'],
    ['number', 7],
    ['null', null],
  ])('returns {} for a malformed blob (%s)', async (_kind, state) => {
    maybeSingle.mockResolvedValue({ data: { state }, error: null })
    expect(await loadFeatureChecklist('u1')).toEqual({})
  })
})

describe('pruneChecklistToKnownIds', () => {
  const known = new Set(['nav-sidebar', 'fog'])

  it('keeps known ids and drops orphans from older manifest layouts', () => {
    const saved = {
      'nav-sidebar': { d: true },
      'fog': { d: true, f: true },
      'roll-feed': { d: true }, // dropped in the 1e2842d9 restructure
      'forums': { f: true },    // dropped in the 1e2842d9 restructure
    }
    expect(pruneChecklistToKnownIds(saved, known)).toEqual({
      'nav-sidebar': { d: true },
      'fog': { d: true, f: true },
    })
  })

  it('is a no-op when every id is known', () => {
    const saved = { 'nav-sidebar': { d: true } }
    expect(pruneChecklistToKnownIds(saved, known)).toEqual(saved)
  })

  it('handles an empty blob', () => {
    expect(pruneChecklistToKnownIds({}, known)).toEqual({})
  })
})
