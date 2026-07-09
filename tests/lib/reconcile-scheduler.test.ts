// Regression net for lib/realtime/reconcileScheduler.ts - the guard that
// keeps usePostgresSubscription's three reconcile triggers (SUBSCRIBED +
// visibilitychange + poll) from stacking refetches or letting a slow stale
// refetch resolve after a newer one.
import { describe, it, expect, vi } from 'vitest'
import { createReconcileScheduler } from '../../lib/realtime/reconcileScheduler'

/** A run fn whose completion the test controls. */
function deferredRun() {
  const resolvers: (() => void)[] = []
  const run = vi.fn(() => new Promise<void>(res => { resolvers.push(res) }))
  return { run, finish: () => resolvers.shift()?.(), pending: () => resolvers.length }
}

/** Flush microtasks so .then/.finally chains settle. */
const tick = () => new Promise<void>(res => setTimeout(res, 0))

describe('createReconcileScheduler', () => {
  it('runs the first request immediately', async () => {
    const { run } = deferredRun()
    const s = createReconcileScheduler(run)
    s.request()
    await tick()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('drops an idle request inside the min gap (burst coalescing)', async () => {
    let t = 0
    const { run, finish } = deferredRun()
    const s = createReconcileScheduler(run, { minGapMs: 5000, now: () => t })
    s.request()
    await tick() // let the run start before finishing it
    finish(); await tick()
    t = 3000
    s.request() // within gap, idle - dropped
    await tick()
    expect(run).toHaveBeenCalledTimes(1)
    t = 6000
    s.request() // past gap - runs
    await tick()
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('never overlaps runs - a request during flight waits for completion', async () => {
    const { run, finish } = deferredRun()
    const s = createReconcileScheduler(run)
    s.request()
    await tick()
    s.request() // in flight - must NOT start a second concurrent run
    await tick()
    expect(run).toHaveBeenCalledTimes(1)
    finish(); await tick()
    expect(run).toHaveBeenCalledTimes(2) // trailing run started after the first settled
  })

  it('coalesces many in-flight requests into ONE trailing run', async () => {
    const { run, finish } = deferredRun()
    const s = createReconcileScheduler(run)
    s.request()
    await tick()
    s.request(); s.request(); s.request()
    finish(); await tick()
    expect(run).toHaveBeenCalledTimes(2)
    finish(); await tick()
    expect(run).toHaveBeenCalledTimes(2) // nothing further queued
  })

  it('dispose cancels future and trailing runs', async () => {
    const { run, finish } = deferredRun()
    const s = createReconcileScheduler(run)
    s.request()
    await tick()
    s.request() // queue a trailing run
    s.dispose()
    finish(); await tick()
    expect(run).toHaveBeenCalledTimes(1) // trailing run cancelled
    s.request()
    await tick()
    expect(run).toHaveBeenCalledTimes(1) // post-dispose request ignored
  })

  it('a rejected run does not wedge the scheduler', async () => {
    let t = 0
    const run = vi.fn(() => Promise.reject(new Error('refetch failed')))
    const s = createReconcileScheduler(run, { minGapMs: 5000, now: () => t })
    s.request()
    await tick()
    expect(run).toHaveBeenCalledTimes(1)
    t = 6000
    s.request()
    await tick()
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('a synchronous (non-promise) run fn works', async () => {
    let t = 0
    const run = vi.fn()
    const s = createReconcileScheduler(run, { minGapMs: 5000, now: () => t })
    s.request()
    await tick()
    t = 6000
    s.request()
    await tick()
    expect(run).toHaveBeenCalledTimes(2)
  })
})
