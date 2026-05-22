import { describe, it, expect } from 'vitest'
import { shouldFollowSharedTactical, shouldRenderTactical } from '../../lib/tactical-view'

// Invariant (Xero 2026-05-22): sharing drives what PLAYERS see, not the GM's
// own pane. The GM can preview the campaign map while players see the shared
// tactical scene. Players follow; the GM toggles freely.
describe('shouldFollowSharedTactical', () => {
  it('players follow the shared view', () => {
    expect(shouldFollowSharedTactical(false)).toBe(true)
  })
  it('the GM (gmLike) never auto-follows', () => {
    expect(shouldFollowSharedTactical(true)).toBe(false)
  })
})

describe('shouldRenderTactical', () => {
  const base = { combatActive: false, showTacticalMap: false, tacticalShared: false, gmLike: false }

  it('THE FIX: GM is NOT pinned to tactical by the shared flag alone', () => {
    // GM toggled their view to campaign (showTacticalMap:false) while sharing.
    expect(shouldRenderTactical({ ...base, gmLike: true, tacticalShared: true })).toBe(false)
  })

  it('player IS pinned to tactical when the GM shares', () => {
    expect(shouldRenderTactical({ ...base, gmLike: false, tacticalShared: true })).toBe(true)
  })

  it('combat forces tactical for everyone (GM and player)', () => {
    expect(shouldRenderTactical({ ...base, combatActive: true, gmLike: true })).toBe(true)
    expect(shouldRenderTactical({ ...base, combatActive: true, gmLike: false })).toBe(true)
  })

  it("the client's own toggle still shows tactical regardless of role", () => {
    expect(shouldRenderTactical({ ...base, showTacticalMap: true, gmLike: true })).toBe(true)
    expect(shouldRenderTactical({ ...base, showTacticalMap: true, gmLike: false })).toBe(true)
  })

  it('GM viewing tactical while sharing stays tactical (showTacticalMap drives it)', () => {
    expect(shouldRenderTactical({ ...base, gmLike: true, showTacticalMap: true, tacticalShared: true })).toBe(true)
  })

  it('nobody sharing, nobody in combat, toggle off = campaign for all', () => {
    expect(shouldRenderTactical({ ...base, gmLike: true })).toBe(false)
    expect(shouldRenderTactical({ ...base, gmLike: false })).toBe(false)
  })
})
