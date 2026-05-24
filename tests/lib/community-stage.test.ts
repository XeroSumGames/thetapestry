import { describe, it, expect } from 'vitest'
import {
  isGroupStage,
  communityDisplayName,
  combinedMemberCount,
  shouldPromoteToCommunity,
  COMMUNITY_THRESHOLD,
} from '../../lib/community-stage'

describe('isGroupStage', () => {
  it('is true only for the literal "group" stage', () => {
    expect(isGroupStage('group')).toBe(true)
  })

  it('is false for a community', () => {
    expect(isGroupStage('community')).toBe(false)
  })

  it('treats missing / null / unknown stage as not-a-group (community default)', () => {
    expect(isGroupStage(null)).toBe(false)
    expect(isGroupStage(undefined)).toBe(false)
    expect(isGroupStage('')).toBe(false)
    expect(isGroupStage('Group')).toBe(false) // case-sensitive; DB stores lowercase
  })
})

describe('communityDisplayName', () => {
  it('returns the stored name when present', () => {
    expect(communityDisplayName('The Ashfall Collective', 'Mara')).toBe('The Ashfall Collective')
  })

  it('falls back to "<Leader>\'s Group" when name is null/empty', () => {
    expect(communityDisplayName(null, 'Mara')).toBe("Mara's Group")
    expect(communityDisplayName('', 'Mara')).toBe("Mara's Group")
    expect(communityDisplayName('   ', 'Mara')).toBe("Mara's Group")
  })

  it('falls back to "Unnamed\'s Group" when both name and leader are missing', () => {
    expect(communityDisplayName(null, null)).toBe("Unnamed's Group")
    expect(communityDisplayName(undefined, undefined)).toBe("Unnamed's Group")
    expect(communityDisplayName('', '   ')).toBe("Unnamed's Group")
  })

  it('trims a padded stored name', () => {
    expect(communityDisplayName('  Riverside  ', 'Mara')).toBe('Riverside')
  })
})

describe('combinedMemberCount', () => {
  it('sums party PCs and group NPC members', () => {
    expect(combinedMemberCount(4, 9)).toBe(13)
    expect(combinedMemberCount(1, 0)).toBe(1)
    expect(combinedMemberCount(0, 0)).toBe(0)
  })

  it('clamps negative inputs to 0', () => {
    expect(combinedMemberCount(-3, 5)).toBe(5)
    expect(combinedMemberCount(5, -3)).toBe(5)
    expect(combinedMemberCount(-1, -1)).toBe(0)
  })
})

describe('shouldPromoteToCommunity', () => {
  it('promotes a group at exactly the threshold (13)', () => {
    expect(shouldPromoteToCommunity('group', COMMUNITY_THRESHOLD)).toBe(true)
  })

  it('does NOT promote a group at 12 (just below)', () => {
    expect(shouldPromoteToCommunity('group', 12)).toBe(false)
  })

  it('promotes a group above the threshold', () => {
    expect(shouldPromoteToCommunity('group', 20)).toBe(true)
  })

  it('never promotes a row that is already a community', () => {
    expect(shouldPromoteToCommunity('community', 13)).toBe(false)
    expect(shouldPromoteToCommunity('community', 50)).toBe(false)
  })

  it('does not promote on a missing / unknown stage', () => {
    expect(shouldPromoteToCommunity(null, 13)).toBe(false)
    expect(shouldPromoteToCommunity(undefined, 99)).toBe(false)
  })
})
