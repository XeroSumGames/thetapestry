// Stage helpers for the Group -> Community lifecycle. A collection of PCs +
// recruited NPCs is a lightweight 'group' (roster + recruit only) until it
// reaches 13+ combined members, when it is promoted to a 'community' with
// the full morale / publish / role-coverage surface. Canon:
// tasks/tapestry-rules-canon.md:746. Pure + framework-free so the gating
// logic is unit-testable away from the JSX.

export function isGroupStage(stage: string | null | undefined): boolean {
  return stage === 'group'
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
