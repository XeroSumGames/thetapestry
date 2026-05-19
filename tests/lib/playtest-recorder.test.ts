import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('playtest-recorder per-campaign persisted flag', () => {
  beforeEach(() => {
    vi.resetModules()
    const store = new Map<string, string>()
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => { store.clear() },
      key: () => null,
      length: 0,
    })
  })

  it('readCampaignEnabled returns false when key absent', async () => {
    const mod = await import('../../lib/playtest-recorder')
    expect(mod.readCampaignEnabled('camp-a')).toBe(false)
  })

  it('writeCampaignEnabled(true) flips readCampaignEnabled to true', async () => {
    const mod = await import('../../lib/playtest-recorder')
    mod.writeCampaignEnabled('camp-a', true)
    expect(mod.readCampaignEnabled('camp-a')).toBe(true)
  })

  it('writeCampaignEnabled(false) clears the key', async () => {
    const mod = await import('../../lib/playtest-recorder')
    mod.writeCampaignEnabled('camp-a', true)
    expect(mod.readCampaignEnabled('camp-a')).toBe(true)
    mod.writeCampaignEnabled('camp-a', false)
    expect(mod.readCampaignEnabled('camp-a')).toBe(false)
  })

  it('isolates campaigns from each other', async () => {
    const mod = await import('../../lib/playtest-recorder')
    mod.writeCampaignEnabled('camp-a', true)
    expect(mod.readCampaignEnabled('camp-a')).toBe(true)
    expect(mod.readCampaignEnabled('camp-b')).toBe(false)
  })

  it('readCampaignEnabled tolerates a thrown localStorage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('quota / disabled') },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    })
    const mod = await import('../../lib/playtest-recorder')
    expect(mod.readCampaignEnabled('camp-a')).toBe(false)
  })

  it('flushAllNow no-ops when recorder is not enabled', async () => {
    const mod = await import('../../lib/playtest-recorder')
    // No window.__tapestryRecorder set -> getRecorder() returns null.
    // flushAllNow should silently no-op, not throw.
    expect(() => mod.flushAllNow()).not.toThrow()
  })
})
