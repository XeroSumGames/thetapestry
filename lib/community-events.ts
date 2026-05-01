// lib/community-events.ts
// Helpers for the Phase 4D per-community Campfire feed. One inserter per
// event type so the four hook points (Morale finalize / Schism / Migration
// / Dissolution) and the manual GM composer all share a single shape.
//
// Insert failures are non-blocking by design — these auto-posts are a
// nice-to-have feed, not a critical path. If the insert fails (RLS, schema
// drift, transient outage), the upstream action still succeeds. We log a
// warning but don't surface it to the user.

import type { SupabaseClient } from '@supabase/supabase-js'

export type CommunityEventType = 'morale_outcome' | 'dissolution' | 'schism' | 'migration' | 'manual'

export interface MoraleOutcomePayload {
  week: number
  outcome: string  // 'success' | 'wild_success' | 'failure' | 'dire_failure' | 'high_insight' | 'low_insight'
  fed_outcome: string
  clothed_outcome: string
  /** Number of NPCs who left this week. Zero on success tiers. */
  departures_count: number
  /** Short human-readable summary of the modifier slots — e.g. "Mood +1, Hands -1, Safety -1". */
  modifiers_summary?: string
  /** Final morale roll total for the card subtitle. */
  total: number
  /** The leader's name (or community name if leaderless) — drives the byline. */
  leader_name: string
}

export interface DissolutionPayload {
  week: number
  consecutive_failures: number
  members_lost: number
}

export interface SchismPayload {
  new_community_id: string
  new_community_name: string
  members_left: number
}

export interface MigrationPayload {
  target_community_id: string
  target_community_name: string
  members_moved: number
  narrative?: string | null
}

export interface ManualPayload {
  body: string
}

interface InsertOpts {
  supabase: SupabaseClient
  communityId: string
  authorUserId: string
}

/** Generic logger that fire-and-forgets the insert; never throws upstream. */
async function safeInsert(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.from('community_events').insert(row)
    if (error) console.warn('[community-events] insert failed:', error.message)
  } catch (e: any) {
    console.warn('[community-events] insert threw:', e?.message ?? String(e))
  }
}

export async function logMoraleOutcome(
  opts: InsertOpts & { payload: MoraleOutcomePayload },
): Promise<void> {
  await safeInsert(opts.supabase, {
    community_id: opts.communityId,
    event_type: 'morale_outcome',
    payload: opts.payload,
    author_user_id: opts.authorUserId,
  })
}

export async function logDissolution(
  opts: InsertOpts & { payload: DissolutionPayload },
): Promise<void> {
  await safeInsert(opts.supabase, {
    community_id: opts.communityId,
    event_type: 'dissolution',
    payload: opts.payload,
    author_user_id: opts.authorUserId,
  })
}

export async function logSchism(
  opts: InsertOpts & { payload: SchismPayload },
): Promise<void> {
  await safeInsert(opts.supabase, {
    community_id: opts.communityId,
    event_type: 'schism',
    payload: opts.payload,
    author_user_id: opts.authorUserId,
  })
}

export async function logMigration(
  opts: InsertOpts & { payload: MigrationPayload },
): Promise<void> {
  await safeInsert(opts.supabase, {
    community_id: opts.communityId,
    event_type: 'migration',
    payload: opts.payload,
    author_user_id: opts.authorUserId,
  })
}

export async function logManualPost(
  opts: InsertOpts & { payload: ManualPayload },
): Promise<void> {
  await safeInsert(opts.supabase, {
    community_id: opts.communityId,
    event_type: 'manual',
    payload: opts.payload,
    author_user_id: opts.authorUserId,
  })
}

// ── Renderer helpers (used by the feed UI on the community page) ─────

export interface CommunityEventRow {
  id: string
  community_id: string
  event_type: CommunityEventType
  payload: Record<string, unknown>
  author_user_id: string | null
  created_at: string
}

/** Per-event icon for chip + card rendering. */
export function eventIcon(type: CommunityEventType): string {
  switch (type) {
    case 'morale_outcome': return '📊'
    case 'dissolution':    return '☠️'
    case 'schism':         return '⚡'
    case 'migration':      return '🚶'
    case 'manual':         return '📝'
  }
}

/** Per-event accent color matching the rest of the project palette. */
export function eventAccent(type: CommunityEventType): string {
  switch (type) {
    case 'morale_outcome': return '#7ab3d4'
    case 'dissolution':    return '#c0392b'
    case 'schism':         return '#EF9F27'
    case 'migration':      return '#7fc458'
    case 'manual':         return '#cce0f5'
  }
}

/** One-line summary for chip-row rendering on the /communities Following card. */
export function eventSummaryLine(row: CommunityEventRow): string {
  const p = row.payload as any
  switch (row.event_type) {
    case 'morale_outcome': {
      const wk = p?.week ?? '?'
      const outcome = (p?.outcome ?? '').replace(/_/g, ' ')
      const dep = p?.departures_count ?? 0
      return `Week ${wk} · ${outcome}${dep > 0 ? ` · ${dep} left` : ''}`
    }
    case 'dissolution': {
      const wk = p?.week ?? '?'
      const lost = p?.members_lost ?? 0
      return `Dissolved week ${wk}${lost > 0 ? ` · ${lost} scattered` : ''}`
    }
    case 'schism': {
      const name = p?.new_community_name ?? '(new community)'
      const n = p?.members_left ?? 0
      return `Schism — ${n} left to form ${name}`
    }
    case 'migration': {
      const target = p?.target_community_name ?? '(target)'
      const n = p?.members_moved ?? 0
      return `${n} migrated → ${target}`
    }
    case 'manual': {
      const body = (p?.body ?? '').toString()
      return body.length > 80 ? body.slice(0, 77) + '…' : body
    }
  }
}

/** Format the timestamp the same way the existing community surfaces do. */
export function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
