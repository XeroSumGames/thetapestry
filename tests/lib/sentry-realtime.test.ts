import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @sentry/nextjs before importing the module under test. The wrap
// helpers call Sentry.captureException; the mock records the calls so we
// can assert tagging.
const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: any[]) => captureException(...args),
}))

// Import AFTER the mock so the helpers pick up the mocked Sentry.
const { wrapBroadcast, wrapDbChange } = await import('../../lib/sentry-realtime')

beforeEach(() => {
  captureException.mockClear()
})

describe('wrapBroadcast', () => {
  it('passes through return value when the inner fn does not throw', async () => {
    const inner = vi.fn().mockResolvedValue(undefined)
    const wrapped = wrapBroadcast('test_event', inner)
    await wrapped({ payload: { ok: true } })
    expect(inner).toHaveBeenCalledOnce()
    expect(inner).toHaveBeenCalledWith({ payload: { ok: true } })
    expect(captureException).not.toHaveBeenCalled()
  })

  it('swallows a synchronous throw and reports to Sentry', async () => {
    const err = new Error('boom-sync')
    const inner = vi.fn(() => { throw err })
    const wrapped = wrapBroadcast('test_event', inner)
    await expect(wrapped({ payload: {} })).resolves.toBeUndefined()
    expect(captureException).toHaveBeenCalledOnce()
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { realtime_kind: 'broadcast', realtime_event: 'test_event' },
      extra: { msg: { payload: {} } },
    })
  })

  it('swallows an async throw (rejected promise) and reports to Sentry', async () => {
    const err = new Error('boom-async')
    const inner = vi.fn(async () => { throw err })
    const wrapped = wrapBroadcast('npc_damaged', inner)
    await expect(wrapped({ payload: { npcId: 'abc' } })).resolves.toBeUndefined()
    expect(captureException).toHaveBeenCalledWith(err, expect.objectContaining({
      tags: { realtime_kind: 'broadcast', realtime_event: 'npc_damaged' },
    }))
  })

  it('does not propagate even when Sentry.captureException itself throws', async () => {
    captureException.mockImplementationOnce(() => { throw new Error('sentry-down') })
    const inner = vi.fn(() => { throw new Error('boom') })
    const wrapped = wrapBroadcast('test_event', inner)
    // The whole point: a broken Sentry must not crash the realtime dispatch.
    await expect(wrapped({ payload: {} })).resolves.toBeUndefined()
  })
})

describe('wrapDbChange', () => {
  it('reports with kind=pg in the Sentry tags', async () => {
    const err = new Error('boom-pg')
    const inner = vi.fn(() => { throw err })
    const wrapped = wrapDbChange('campaigns:UPDATE', inner)
    await wrapped({ new: { id: 'abc' } })
    expect(captureException).toHaveBeenCalledWith(err, expect.objectContaining({
      tags: { realtime_kind: 'pg', realtime_event: 'campaigns:UPDATE' },
    }))
  })
})
