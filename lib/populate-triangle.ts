// Pure helper for the GM Tools → Populate flow. Given a target NPC
// count, returns how many of each tier to generate using the
// "triangle" ratio Xero specified on 2026-04-30:
//
//   Per 10 NPCs: 1 Antagonist + 2 Foes + 3 Goons + 4 Bystanders.
//
// For counts under 10, no Antagonist is included — work up from
// Bystanders → Goons → Foes. So a small group of 5 is 4 Bystanders
// + 1 Goon; only sizable groups (10+) include an Antagonist.
//
// Algorithm:
//   1. Full packs of 10 each contribute 4B + 3G + 2F + 1A.
//   2. Leftover (count % 10) fills tiers in order Bystanders →
//      Goons → Foes, each tier capped at its single-pack ceiling
//      (4 / 3 / 2). The leftover never exceeds 9, so we never
//      reach the Antagonist tier on leftover distribution.
//
// Verified examples:
//   N=1  → { B:1, G:0, F:0, A:0 }
//   N=5  → { B:4, G:1, F:0, A:0 }
//   N=9  → { B:4, G:3, F:2, A:0 }
//   N=10 → { B:4, G:3, F:2, A:1 }
//   N=15 → { B:8, G:4, F:2, A:1 }
//   N=20 → { B:8, G:6, F:4, A:2 }

export interface TriangleBreakdown {
  bystanders: number
  goons: number
  foes: number
  antagonists: number
}

export function triangleBreakdown(count: number): TriangleBreakdown {
  if (count <= 0) return { bystanders: 0, goons: 0, foes: 0, antagonists: 0 }
  const packs = Math.floor(count / 10)
  const leftover = count % 10
  let bystanders = packs * 4
  let goons = packs * 3
  let foes = packs * 2
  const antagonists = packs * 1
  // Fill leftover bottom-up.
  if (leftover <= 4) {
    bystanders += leftover
  } else if (leftover <= 7) {
    bystanders += 4
    goons += leftover - 4
  } else {
    // leftover 8 or 9
    bystanders += 4
    goons += 3
    foes += leftover - 7
  }
  return { bystanders, goons, foes, antagonists }
}
