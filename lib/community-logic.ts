// Phase C Community mechanics — pure helpers shared between the Morale
// modal and any log-rendering that needs to interpret the stored rows.
// Source of truth: tasks/rules-extract-communities.md (SRD §08 + CRB).

export type CommunityRole = 'gatherer' | 'maintainer' | 'safety' | 'unassigned' | 'assigned'
export type CommunityRecruitmentType = 'cohort' | 'conscript' | 'convert' | 'apprentice' | 'founder' | 'member'

export interface CommunityMemberLite {
  id: string
  npc_id: string | null
  character_id: string | null
  role: CommunityRole
  recruitment_type: CommunityRecruitmentType
  apprentice_of_character_id: string | null
}

export interface CommunityLite {
  leader_npc_id: string | null
  leader_user_id: string | null
}

// "2d6" outcome — matches the table page's getOutcome so the morale
// modal shares the same SRD-canonical interpretation (Low Insight 1+1,
// High Insight 6+6, thresholds 4 / 9 / 14).
export function classifyRoll(total: number, die1: number, die2: number): string {
  if (die1 === 1 && die2 === 1) return 'Low Insight'
  if (die1 === 6 && die2 === 6) return 'High Insight'
  if (total <= 3) return 'Dire Failure'
  if (total <= 8) return 'Failure'
  if (total <= 13) return 'Success'
  return 'Wild Success'
}

// Morale + Fed + Clothed all use the same outcome → next-Morale-CMod map
// per SRD §08 (Fed Wild Success narrative intent = +1 per extract note).
export function outcomeToMoraleCmod(outcome: string): number {
  switch (outcome) {
    case 'High Insight': return 2
    case 'Wild Success': return 1
    case 'Success': return 0
    case 'Failure': return -1
    case 'Dire Failure': return -2
    case 'Low Insight': return -3
    default: return 0
  }
}

// Percentage of community that LEAVES on a Morale check failure tier.
// Success tiers stay at 0 — no departures.
export function outcomeToDeparturePct(outcome: string): number {
  switch (outcome) {
    case 'Failure': return 0.25
    case 'Dire Failure': return 0.50
    case 'Low Insight': return 0.75
    default: return 0
  }
}

// Is this Morale outcome a failure? (Drives consecutive_failures tick +
// the dissolution check at 3.)
export function isMoraleFailure(outcome: string): boolean {
  return outcome === 'Failure' || outcome === 'Dire Failure' || outcome === 'Low Insight'
}

// "Enough Hands" CMod — mechanical, per SRD §08 (pages 23–24).
// Page 23: "Communities without enough members acting as Gatherers,
// Maintainers, or Safety suffer a −1 CMod for each group that is short,
// up to a maximum CMod of −3."
// Page 24 (Safety section): "If there are enough people in each
// category, there is a +1 E H CMod on the M C."
// Combined: +1 when all three minimums met, else −1 per shortage
// (capped at −3). Labor pool = NPCs with role ≠ 'assigned' (Assigned
// NPCs are off on PC-directed tasks and don't pull role duty; PCs are
// players and not part of assigned labor).
export function computeEnoughHandsCmod(members: CommunityMemberLite[]): number {
  const laborPool = members.filter(m => !!m.npc_id && m.role !== 'assigned')
  const n = laborPool.length
  if (n === 0) return -3
  const gatherers = laborPool.filter(m => m.role === 'gatherer').length
  const maintainers = laborPool.filter(m => m.role === 'maintainer').length
  const safety = laborPool.filter(m => m.role === 'safety').length
  const gatherMin = Math.ceil(n * 0.33)
  const maintainMin = Math.ceil(n * 0.20)
  const safetyMin = Math.max(1, Math.ceil(n * 0.05))
  let cmod = 0
  if (gatherers < gatherMin) cmod -= 1
  if (maintainers < maintainMin) cmod -= 1
  if (safety < safetyMin) cmod -= 1
  // All three categories at or above minimum → +1 per page 24.
  if (cmod === 0) return 1
  return Math.max(-3, cmod)
}

// "A Clear Voice" — 0 with an acknowledged leader, −1 leaderless.
export function computeClearVoiceCmod(community: CommunityLite): number {
  if (community.leader_user_id || community.leader_npc_id) return 0
  return -1
}

// "Someone To Watch Over Me" — +1 if Safety ≥ 10% of labor pool,
// −1 if < 5%, else 0.
export function computeSafetyCmod(members: CommunityMemberLite[]): number {
  const laborPool = members.filter(m => !!m.npc_id && m.role !== 'assigned')
  const n = laborPool.length
  if (n === 0) return -1
  const safety = laborPool.filter(m => m.role === 'safety').length
  const pct = safety / n
  if (pct >= 0.10) return 1
  if (pct < 0.05) return -1
  return 0
}

// Fisher-Yates in place; exported for determinism when callers want
// to seed randomness separately.
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Weighted departure picker for Morale failure consequences. Per spec
// §10: random within priority buckets, weighted Unassigned → Cohort →
// Convert → Conscript, Apprentices last. PCs are never auto-removed
// (players control their characters); only NPC members enter the pool.
// Returns the member ids chosen to leave, length clamped to `count`.
export function pickDeparturesWeighted(
  members: CommunityMemberLite[],
  count: number,
): string[] {
  if (count <= 0) return []
  const pool = members.filter(m => !!m.npc_id)
  if (pool.length === 0) return []
  // Lower priority number = leaves first. Apprentices + founders stay longest.
  const priority = (m: CommunityMemberLite): number => {
    if (m.recruitment_type === 'apprentice') return 5
    if (m.recruitment_type === 'founder') return 4
    if (m.recruitment_type === 'conscript') return 3
    if (m.recruitment_type === 'convert') return 2
    if (m.recruitment_type === 'cohort') return 1
    if (m.role === 'unassigned') return 0
    return 2
  }
  const buckets = new Map<number, CommunityMemberLite[]>()
  for (const m of pool) {
    const p = priority(m)
    if (!buckets.has(p)) buckets.set(p, [])
    buckets.get(p)!.push(m)
  }
  const out: string[] = []
  for (const p of [...buckets.keys()].sort((a, b) => a - b)) {
    const bucket = shuffleInPlace([...buckets.get(p)!])
    for (const m of bucket) {
      if (out.length >= count) return out
      out.push(m.id)
    }
  }
  return out
}

// Human-readable suffix for labels, e.g. "+2" / "0" / "−3".
// Uses the typographic minus (U+2212) to match the rest of the app's
// CMod rendering in the log feed.
export function formatCmod(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return '0'
}
