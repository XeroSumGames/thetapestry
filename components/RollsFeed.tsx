'use client'
// Rolls-feed pieces extracted from the table page during the B2 perf pass.
// Mirrors the shape of components/TableChat.tsx — the parent owns what
// it needs to interleave (the merged "Both" tab) and the hook owns the
// state, the realtime channel, and the scroll-to-bottom logic.
//
// Design notes:
//   - `refetch` is the imperative escape hatch the parent uses from its
//     ~20 callsites (combat events, sprint resolution, dealDamage,
//     drag-drop loot, modal submits, etc.). Mirrors useChatPanel.refetch.
//   - `rollFeedRef` is exposed because the scroll container is laid out
//     in the parent's left-feed pane (the same scroller is shared with
//     the chat list and the merged feed); the hook just needs the ref
//     to scroll-to-bottom on a fresh refetch.
//   - The realtime channel lives entirely inside the hook: subscribe on
//     campaignId mount, removeChannel on cleanup. The parent never
//     touches the rolls channel directly.
//   - Includes the same DamageResult type the table page declares — this
//     module deliberately avoids importing from the page to keep the
//     dependency direction one-way.
//
// Render block (the ~500 lines of variant-card JSX) stays in the table
// page for this PR — extracting it touches both the rolls-only tab AND
// the merged Both tab and is best done in a follow-up so the diff is
// reviewable. Hook + state extraction here gives the bulk of the parse-
// time win.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

export interface DamageResult {
  rollWP: number
  appliedWP: number
  rollRP: number
  appliedRP: number
  rpPercent: number
  rpFloor: 'A' | 'B' | 'C' | 'F'
  weaponName: string
  damageRoll: string
  rollLabel?: string
  rolls?: { die1: number; die2: number; cmod?: number; rollOutcome?: string }[]
  rollLog?: string
  notes?: string
  damageBreakdown?: string
  // Recruitment outcome carries structured metadata in the same column
  // (single jsonb field) — cards branch on these flags.
  recruit?: {
    approach?: string
    community?: string
    apprentice?: boolean
  }
  // Community weekly checks (Fed / Clothed / Morale / Retention) carry
  // their slot breakdown + departures here.
  fed_check?: any
  clothed_check?: any
  morale_check?: any
  retention_check?: any
  combatants?: any[]
  combatRound?: number
  // catch-all for variants we haven't pulled out yet
  [k: string]: any
}

export interface RollEntry {
  id: string
  character_name: string
  label: string
  target_name: string | null
  die1: number
  die2: number
  amod: number
  smod: number
  cmod: number
  total: number
  outcome: string
  insight_awarded: boolean
  insight_used: '3d6' | '+3cmod' | null
  created_at: string
  damage_json: DamageResult | null
}

export interface UseRollsFeedArgs {
  campaignId: string
}

export interface UseRollsFeedReturn {
  rolls: RollEntry[]
  refetch: () => Promise<void>
  /** Optimistic local clear — for end-of-session / start-of-session
   *  transitions where the parent just wiped the DB rows and wants the
   *  feed to look empty immediately rather than wait for the realtime
   *  echo. Pair with a refetch() to converge. */
  clear: () => void
  expandedRollIds: Set<string>
  toggleExpanded: (id: string) => void
  /** Attach to the parent's scroll container — the hook reads this ref
   *  to auto-scroll the feed to the bottom after a fresh load. */
  rollFeedRef: React.RefObject<HTMLDivElement | null>
  scrollToBottom: () => void
}

export function useRollsFeed({ campaignId }: UseRollsFeedArgs): UseRollsFeedReturn {
  const supabase = createClient()
  const [rolls, setRolls] = useState<RollEntry[]>([])
  const [expandedRollIds, setExpandedRollIds] = useState<Set<string>>(new Set())
  const rollFeedRef = useRef<HTMLDivElement | null>(null)
  const channelRef = useRef<any>(null)

  const scrollToBottom = useCallback(() => {
    rollFeedRef.current?.scrollTo(0, rollFeedRef.current.scrollHeight)
  }, [])

  const refetch = useCallback(async () => {
    if (!campaignId) return
    const { data } = await supabase
      .from('roll_log')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(50)
    setRolls(((data ?? []) as RollEntry[]).reverse())
    setTimeout(() => scrollToBottom(), 50)
  }, [campaignId, supabase, scrollToBottom])

  const clear = useCallback(() => setRolls([]), [])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedRollIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (!campaignId) return
    refetch()
    channelRef.current = supabase.channel(`rolls_${campaignId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'roll_log',
        filter: `campaign_id=eq.${campaignId}`,
      }, () => { refetch() })
      .subscribe()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [campaignId, refetch, supabase])

  // Re-pull on tab return-to-visible — Chrome can pause the websocket
  // on backgrounded tabs, dropping postgres_changes events. Mirrors the
  // handler on useChatPanel and the table page (the GrumpyBattersby fix).
  useEffect(() => {
    if (!campaignId) return
    function handleVisibility() {
      if (!document.hidden) refetch()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [campaignId, refetch])

  return { rolls, refetch, clear, expandedRollIds, toggleExpanded, rollFeedRef, scrollToBottom }
}
