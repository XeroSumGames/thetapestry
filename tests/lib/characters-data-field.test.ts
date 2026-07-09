// Regression net for the 2026-07-09 CRITICAL: updateCharacterDataField must
// NOT whole-blob-write when the read fails, or a transient read error turns a
// single stat tick into full character-sheet destruction (name/RAPID/skills/
// inventory replaced by just the patch).
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock chain: db().from('characters').select('data').eq('id', x).single()
// and     db().from('characters').update({...}).eq('id', x)
const single = vi.fn()
const updateEq = vi.fn(() => ({ data: null, error: null }))
const update = vi.fn(() => ({ eq: updateEq }))

vi.mock('../../lib/data/db', () => ({
  db: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single }) }),
      update,
    }),
  }),
}))

import { updateCharacterDataField } from '../../lib/data/characters'

describe('updateCharacterDataField', () => {
  beforeEach(() => { single.mockReset(); update.mockClear(); updateEq.mockClear() })

  it('does NOT write when the read errors (guards against blob destruction)', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const res = await updateCharacterDataField('c1', { wpCurrent: 9 })
    expect(update).not.toHaveBeenCalled()
    expect((res as any).error).toBeTruthy()
  })

  it('does NOT write when the row is missing (single returned null, no error)', async () => {
    single.mockResolvedValue({ data: null, error: null })
    const res = await updateCharacterDataField('c1', { wpCurrent: 9 })
    expect(update).not.toHaveBeenCalled()
    expect((res as any).error).toBeTruthy()
  })

  it('merges the patch over the existing blob on a successful read', async () => {
    single.mockResolvedValue({ data: { data: { name: 'Ada', rapid: { PHY: 2 }, wpCurrent: 10 } }, error: null })
    await updateCharacterDataField('c1', { wpCurrent: 9 })
    expect(update).toHaveBeenCalledTimes(1)
    // The write must preserve name/rapid and only change wpCurrent.
    expect(update).toHaveBeenCalledWith({ data: { name: 'Ada', rapid: { PHY: 2 }, wpCurrent: 9 } })
  })

  it('treats a non-object existing blob as empty base (no crash)', async () => {
    single.mockResolvedValue({ data: { data: null }, error: null })
    await updateCharacterDataField('c1', { wpCurrent: 9 })
    expect(update).toHaveBeenCalledWith({ data: { wpCurrent: 9 } })
  })
})
