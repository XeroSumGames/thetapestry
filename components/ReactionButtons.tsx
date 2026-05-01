'use client'
// Phase 4E — shared reaction up/down buttons used by Forums (B), War
// Stories, and LFG. Each surface persists to its own table (different
// FK column name); the table + column are passed in as props.
//
// State model: one vote per (target, user). Clicking the same direction
// again retracts. UPSERT-on-flip via DELETE-then-INSERT inside a single
// async handler keeps the UNIQUE(target, user) invariant clean.
//
// For the load step, the parent passes initial counts + the user's own
// vote so the button is paint-ready on first render. Local state tracks
// the optimistic flip; failure rolls back.

import { useState } from 'react'
import { createClient } from '../lib/supabase-browser'

type Kind = 'up' | 'down'

interface Props {
  table: 'forum_thread_reactions' | 'war_story_reactions' | 'lfg_post_reactions'
  fkColumn: 'thread_id' | 'war_story_id' | 'post_id'
  targetId: string
  userId: string | null
  /** Initial counts pulled from the parent's loader. */
  initialUp: number
  initialDown: number
  /** Initial own vote state — null = no vote, 'up' / 'down' otherwise. */
  initialOwn: Kind | null
  /** Optional compact mode for dense card layouts. */
  compact?: boolean
}

export default function ReactionButtons({
  table, fkColumn, targetId, userId,
  initialUp, initialDown, initialOwn, compact,
}: Props) {
  const supabase = createClient()
  const [up, setUp] = useState<number>(initialUp)
  const [down, setDown] = useState<number>(initialDown)
  const [own, setOwn] = useState<Kind | null>(initialOwn)
  const [pending, setPending] = useState(false)

  async function vote(direction: Kind) {
    if (!userId || pending) return
    setPending(true)
    const previous = own
    // Optimistic local flip.
    if (own === direction) {
      // Retract — same direction clicked again.
      setOwn(null)
      if (direction === 'up') setUp(n => Math.max(0, n - 1))
      else setDown(n => Math.max(0, n - 1))
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(fkColumn, targetId)
        .eq('user_id', userId)
      if (error) {
        // Rollback.
        setOwn(direction)
        if (direction === 'up') setUp(n => n + 1)
        else setDown(n => n + 1)
      }
    } else {
      // Either fresh vote or flip from opposite.
      const wasOpposite = own && own !== direction
      setOwn(direction)
      if (direction === 'up') {
        setUp(n => n + 1)
        if (wasOpposite) setDown(n => Math.max(0, n - 1))
      } else {
        setDown(n => n + 1)
        if (wasOpposite) setUp(n => Math.max(0, n - 1))
      }
      // UNIQUE(target, user) lets a single upsert handle both fresh +
      // flip cases — the conflict target lifts the existing row's kind.
      const { error } = await supabase
        .from(table)
        .upsert(
          { [fkColumn]: targetId, user_id: userId, kind: direction } as any,
          { onConflict: `${fkColumn},user_id` }
        )
      if (error) {
        // Rollback to the previous state.
        setOwn(previous)
        // Recompute counts from the rollback delta. Simpler than trying
        // to thread per-step diffs — we just undo everything we added.
        if (direction === 'up') setUp(n => Math.max(0, n - 1))
        else setDown(n => Math.max(0, n - 1))
        if (wasOpposite) {
          if (direction === 'up') setDown(n => n + 1)
          else setUp(n => n + 1)
        }
      }
    }
    setPending(false)
  }

  const score = up - down
  const upActive = own === 'up'
  const downActive = own === 'down'
  const padX = compact ? '5px' : '8px'
  const fs = '13px'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <button onClick={() => vote('up')} disabled={pending || !userId}
        title={userId ? (upActive ? 'Remove upvote' : 'Upvote') : 'Sign in to vote'}
        style={{ padding: `3px ${padX}`, background: upActive ? '#1a2010' : 'transparent', border: `1px solid ${upActive ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: upActive ? '#7fc458' : '#cce0f5', fontSize: fs, fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: pending ? 'wait' : (userId ? 'pointer' : 'not-allowed'), opacity: pending ? 0.6 : (userId ? 1 : 0.5) }}>
        ▲ {up}
      </button>
      <span style={{ fontSize: fs, color: score > 0 ? '#7fc458' : score < 0 ? '#f5a89a' : '#9aa5b0', fontFamily: 'Carlito, sans-serif', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>
        {score > 0 ? `+${score}` : score}
      </span>
      <button onClick={() => vote('down')} disabled={pending || !userId}
        title={userId ? (downActive ? 'Remove downvote' : 'Downvote') : 'Sign in to vote'}
        style={{ padding: `3px ${padX}`, background: downActive ? '#2a1010' : 'transparent', border: `1px solid ${downActive ? '#7a1f16' : '#3a3a3a'}`, borderRadius: '3px', color: downActive ? '#f5a89a' : '#cce0f5', fontSize: fs, fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: pending ? 'wait' : (userId ? 'pointer' : 'not-allowed'), opacity: pending ? 0.6 : (userId ? 1 : 0.5) }}>
        ▼ {down}
      </button>
    </div>
  )
}

// Helper for batched reaction-row hydration. Returns counts + own-vote
// keyed by target id so card rendering can pick its slice in O(1).
export interface ReactionAggregate {
  up: number
  down: number
  own: Kind | null
}

export function aggregateReactions(
  rows: { [k: string]: any }[],
  fkColumn: string,
  myUserId: string | null,
): Record<string, ReactionAggregate> {
  const out: Record<string, ReactionAggregate> = {}
  for (const r of rows) {
    const t = r[fkColumn] as string
    if (!out[t]) out[t] = { up: 0, down: 0, own: null }
    if (r.kind === 'up') out[t].up++
    else if (r.kind === 'down') out[t].down++
    if (r.user_id === myUserId) out[t].own = r.kind as Kind
  }
  return out
}
