// Stage helpers for the Group -> Community lifecycle. A collection of PCs +
// recruited NPCs is a lightweight 'group' (roster + recruit only) until it
// reaches 13+ combined members, when it is promoted to a 'community' with
// the full morale / publish / role-coverage surface. Canon:
// tasks/tapestry-rules-canon.md:746. Pure + framework-free so the gating
// logic is unit-testable away from the JSX.

// Canon (tasks/tapestry-rules-canon.md:746): a Group becomes a Community at
// a combined total of 13+ PCs and NPCs.
export const COMMUNITY_THRESHOLD = 13

export function isGroupStage(stage: string | null | undefined): boolean {
  return stage === 'group'
}

// Combined size of a collection per canon = the party (active campaign PCs)
// plus the group's recruited NPC members. The recruit flow does NOT enroll
// the roller PC as a member, so PCs are counted from the campaign roster, not
// from community_members - hence the two separate inputs. Negatives clamp to 0.
export function combinedMemberCount(
  activePcCount: number,
  activeNpcMemberCount: number,
): number {
  return Math.max(0, activePcCount) + Math.max(0, activeNpcMemberCount)
}

// True when a group has reached the canon threshold and should be promoted to
// a Community. Already-promoted communities (or non-group stages) never qualify.
export function shouldPromoteToCommunity(
  stage: string | null | undefined,
  combined: number,
): boolean {
  return isGroupStage(stage) && combined >= COMMUNITY_THRESHOLD
}

// Display name for a community row. Groups carry an auto-name today, but
// fall back to "<Leader>'s Group" if a name is ever missing so the UI
// never renders an empty / "null" label.
export function communityDisplayName(
  name: string | null | undefined,
  leaderName: string | null | undefined,
): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  const leader = leaderName?.trim() || 'Unnamed'
  return `${leader}'s Group`
}
