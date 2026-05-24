import { describe, it, expect } from 'vitest'
import { stampSessionId } from '../../lib/data/roll-log'

const SID = '11111111-1111-1111-1111-111111111111'

describe('stampSessionId', () => {
  it('injects session_id into a single row when a session is active', () => {
    expect(stampSessionId({ label: 'x' }, SID)).toEqual({ label: 'x', session_id: SID })
  })

  it('injects into every row of an array', () => {
    const out = stampSessionId([{ label: 'a' }, { label: 'b' }], SID)
    expect(out).toEqual([{ label: 'a', session_id: SID }, { label: 'b', session_id: SID }])
  })

  it('passes rows through untouched when there is no active session', () => {
    expect(stampSessionId({ label: 'x' }, null)).toEqual({ label: 'x' })
    expect(stampSessionId([{ label: 'a' }], null)).toEqual([{ label: 'a' }])
  })

  it('does NOT override an explicit session_id on the row', () => {
    const explicit = '22222222-2222-2222-2222-222222222222'
    expect(stampSessionId({ label: 'x', session_id: explicit }, SID)).toEqual({ label: 'x', session_id: explicit })
  })

  it('respects an explicit null session_id (does not overwrite)', () => {
    expect(stampSessionId({ label: 'x', session_id: null }, SID)).toEqual({ label: 'x', session_id: null })
  })
})
