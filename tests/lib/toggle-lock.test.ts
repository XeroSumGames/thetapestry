import { describe, it, expect, beforeEach } from 'vitest'
import { claimToggleLock, _resetToggleLocks } from '../../lib/toggle-lock'

describe('claimToggleLock', () => {
  beforeEach(() => _resetToggleLocks())

  it('grants the first claim and blocks re-claims within the window', () => {
    expect(claimToggleLock('a', 800, 1000)).toBe(true)
    expect(claimToggleLock('a', 800, 1200)).toBe(false) // 200ms later, still locked
    expect(claimToggleLock('a', 800, 1799)).toBe(false) // just before expiry
  })

  it('grants again once the window has passed', () => {
    expect(claimToggleLock('a', 800, 1000)).toBe(true)
    expect(claimToggleLock('a', 800, 1800)).toBe(true) // exactly at expiry -> claimable
  })

  it('locks keys independently', () => {
    expect(claimToggleLock('a', 800, 1000)).toBe(true)
    expect(claimToggleLock('b', 800, 1000)).toBe(true) // different key, not blocked
    expect(claimToggleLock('a', 800, 1000)).toBe(false)
  })
})
