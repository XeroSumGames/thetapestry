import { describe, it, expect } from 'vitest'
import { isGroupStage, communityDisplayName } from '../../lib/community-stage'

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
