import { describe, it, expect } from 'vitest'
import { buildSessionLogDigest } from '../../lib/session-log'

describe('buildSessionLogDigest', () => {
  it('returns empty string for no rows', () => {
    expect(buildSessionLogDigest([])).toBe('')
    expect(buildSessionLogDigest(null as any)).toBe('')
  })

  it('formats a dice roll with total + readable outcome', () => {
    const out = buildSessionLogDigest([
      { created_at: '2026-05-24T18:05:00.000Z', character_name: 'Mara', label: 'ACU Check', die1: 3, die2: 5, total: 10, outcome: 'wild_success' },
    ])
    expect(out).toBe('[18:05] Mara: ACU Check = 10 (wild success)')
  })

  it('omits the roll suffix for action / banner lines (zero dice)', () => {
    const out = buildSessionLogDigest([
      { created_at: '2026-05-24T18:00:00.000Z', character_name: 'System', label: 'Combat Started', die1: 0, die2: 0, total: 0, outcome: 'action' },
    ])
    expect(out).toBe('[18:00] System: Combat Started')
  })

  it('falls back to System when character_name is missing', () => {
    expect(buildSessionLogDigest([{ created_at: '2026-05-24T18:00:00.000Z', label: 'x', die1: 0, die2: 0 }]))
      .toBe('[18:00] System: x')
  })

  it('joins multiple rows with newlines in order', () => {
    const out = buildSessionLogDigest([
      { created_at: '2026-05-24T18:00:00.000Z', character_name: 'A', label: 'first', die1: 1, die2: 1, total: 4, outcome: 'success' },
      { created_at: '2026-05-24T18:01:00.000Z', character_name: 'B', label: 'second', die1: 0, die2: 0 },
    ])
    expect(out.split('\n')).toEqual([
      '[18:00] A: first = 4 (success)',
      '[18:01] B: second',
    ])
  })

  it('handles a missing/invalid timestamp (no time prefix)', () => {
    expect(buildSessionLogDigest([{ character_name: 'A', label: 'no time', die1: 0, die2: 0 }]))
      .toBe('A: no time')
  })
})
