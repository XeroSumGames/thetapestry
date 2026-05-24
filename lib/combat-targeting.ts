// Shared combat-targeting helpers for roll-modal target dropdowns.
//
// Goal (Xero 2026-05-24): every target dropdown colors options by faction
// RELATIVE TO THE ROLLER - allies green, hostiles red - and can default to the
// closest hostile. Before this, the ATTACK dropdown coloured by raw PC/NPC,
// which only looked right when an NPC was rolling; for a PC roller it painted
// the enemy NPCs green. These helpers make it roller-relative.
//
// Faction model (confirmed Xero 2026-05-24): two sides - PCs vs NPCs - matching
// the existing grenade friendly-fire logic. KNOWN GAP: recruited-ally NPCs (an
// NPC that belongs to the player party's group/community) should count as an
// ally, but the data model has no allegiance flag yet, so they are currently
// treated as hostile to a PC roller. `isHostileTarget` is the single seam to
// fix once that signal exists (e.g. a communities.alignment column).

const HOSTILE_COLOR = '#c0392b' // red
const ALLY_COLOR = '#7fc458'    // green

/** Is `target` on the opposite side from the roller? Side = PC vs NPC. */
export function isHostileTarget(targetIsNpc: boolean, rollerIsNpc: boolean): boolean {
  return targetIsNpc !== rollerIsNpc
}

/** Dropdown option colour for a PERSON target (PC or NPC), relative to the
 *  roller: hostile red, ally green. Objects use their own neutral palette and
 *  do not pass through here. */
export function targetOptionColor(targetIsNpc: boolean, rollerIsNpc: boolean): string {
  return isHostileTarget(targetIsNpc, rollerIsNpc) ? HOSTILE_COLOR : ALLY_COLOR
}

export interface TargetCandidate {
  /** Stable identifier used as the dropdown value (e.g. the combatant name). */
  key: string
  isNpc: boolean
  /** Distance to the roller in feet; null when it can't be computed (no map
   *  token / no positions). Null sorts LAST so a known-distance hostile wins. */
  distFeet: number | null
}

/** The closest HOSTILE candidate's key, or null when there are no hostiles.
 *  Used to default a target dropdown to the nearest enemy. Ties and null
 *  distances are handled deterministically (null = farthest). */
export function closestHostileKey(candidates: TargetCandidate[], rollerIsNpc: boolean): string | null {
  const hostiles = candidates.filter(c => isHostileTarget(c.isNpc, rollerIsNpc))
  if (hostiles.length === 0) return null
  let best = hostiles[0]
  for (const c of hostiles) {
    const cd = c.distFeet ?? Infinity
    const bd = best.distFeet ?? Infinity
    if (cd < bd) best = c
  }
  return best.key
}
