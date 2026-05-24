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

// Delete-vs-dissolve rule (Y11-c), mirroring the modules archive-vs-delete tree:
// a collection with NO active members can be hard-deleted (nothing live to
// lose); one WITH active members must be soft-dissolved instead (members leave,
// history kept), never hard-wiped. Drives handleDeleteCommunity.
export function canHardDeleteCommunity(activeMemberCount: number): boolean {
  return activeMemberCount <= 0
}

// Confirm-dialog copy for the delete-vs-dissolve action. Empty -> permanent
// delete (warns if it still carries dissolved history); populated -> the action
// downgrades to a Dissolve. Pure so the wording is unit-testable.
export function communityRemovalPrompt(label: string, activeMemberCount: number, isDissolved: boolean): string {
  if (canHardDeleteCommunity(activeMemberCount)) {
    const histNote = isDissolved ? ' Its dissolved history and surviving-NPC pool are removed too.' : ''
    return `Permanently delete "${label}"? It has no active members.${histNote} This cannot be undone.`
  }
  const n = activeMemberCount
  return `"${label}" has ${n} active member${n === 1 ? '' : 's'}, so it can't be hard-deleted. It will be DISSOLVED instead: members leave (history is kept) and surviving NPCs can be offered to nearby communities. Continue?`
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
