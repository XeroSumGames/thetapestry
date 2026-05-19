'use client'
// Rolls-feed pieces extracted from the table page during the B2 perf pass.
// Mirrors the shape of components/TableChat.tsx - the parent owns what
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
//   - Includes the same DamageResult type the table page declares - this
//     module deliberately avoids importing from the page to keep the
//     dependency direction one-way.
//
// Render block (the ~500 lines of variant-card JSX) stays in the table
// page for this PR - extracting it touches both the rolls-only tab AND
// the merged Both tab and is best done in a follow-up so the diff is
// reviewable. Hook + state extraction here gives the bulk of the parse-
// time win.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { compactRollSummary, outcomeColor, formatTime } from '../lib/roll-helpers'

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
  // (single jsonb field) - cards branch on these flags.
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
  // Stamped on every row that belongs to an active Coordinated
  // Effort chain (lead + participants share the same id). Used by
  // collapseCoordEffortChains to fold the chain into a single
  // bespoke feed banner, and by the Withdraw retcon handler in
  // the table page to query siblings.
  coord_chain_id?: string | null
}

export interface UseRollsFeedArgs {
  campaignId: string
}

export interface UseRollsFeedReturn {
  rolls: RollEntry[]
  refetch: () => Promise<void>
  /** Optimistic local clear - for end-of-session / start-of-session
   *  transitions where the parent just wiped the DB rows and wants the
   *  feed to look empty immediately rather than wait for the realtime
   *  echo. Pair with a refetch() to converge. */
  clear: () => void
  expandedRollIds: Set<string>
  toggleExpanded: (id: string) => void
  /** Attach to the parent's scroll container - the hook reads this ref
   *  to auto-scroll the feed to the bottom after a fresh load. */
  rollFeedRef: React.RefObject<HTMLDivElement | null>
  scrollToBottom: () => void
}

// Aggregate Coordinated Effort chain rows into a single banner row.
// Per Xero 2026-05-18: every chain of N participants should appear as
// ONE summary row in the feed ("Cree Hask successfully uses Tactics*
// to coordinate an effort with Marcus, Knox, and Enya"). Individual
// participant rolls move to the expanded view (^ pip).
//
// Lead row identification: every row in a chain carries the same
// `coord_chain_id`. The lead's label starts with "Coordinated Effort -
// <skill>". Participants' labels are normal skill checks. We enrich
// the lead row with `damage_json.coordChainParticipants` (an array of
// { name, outcome, total, die1, die2, amod, smod, cmod }) and drop
// the participant rows from the visible list. Chains with only a
// lead (no participants logged yet) pass through unchanged.
export function collapseCoordEffortChains(raw: RollEntry[]): RollEntry[] {
  // Group by coord_chain_id; pass-through rows without a chain id.
  const byChain = new Map<string, RollEntry[]>()
  const passthrough: RollEntry[] = []
  for (const r of raw) {
    const cid = (r as any).coord_chain_id as string | null
    if (cid) {
      const arr = byChain.get(cid) ?? []
      arr.push(r)
      byChain.set(cid, arr)
    } else {
      passthrough.push(r)
    }
  }
  if (byChain.size === 0) return raw
  // For each chain: extract lead, build participants, emit enriched
  // lead. Order preservation: keep the original index of the lead in
  // the result so the feed timeline doesn't reshuffle.
  const collapsed: Array<{ idx: number; row: RollEntry }> = []
  for (const r of passthrough) {
    const idx = raw.indexOf(r)
    collapsed.push({ idx, row: r })
  }
  for (const [, chainRows] of byChain) {
    const leadRow = chainRows.find(cr => typeof cr.label === 'string' && cr.label.startsWith('Coordinated Effort - '))
    if (!leadRow) {
      // Pathological chain with no lead row stamped - pass through
      // every row as-is rather than swallow them silently.
      for (const cr of chainRows) collapsed.push({ idx: raw.indexOf(cr), row: cr })
      continue
    }
    const participantRows = chainRows.filter(cr => cr !== leadRow)
    if (participantRows.length === 0) {
      // Lead-only chain (no participants rolled yet). Keep the lead
      // visible as a normal row so the GM can see the chain started.
      collapsed.push({ idx: raw.indexOf(leadRow), row: leadRow })
      continue
    }
    const skill = (leadRow.label.match(/^Coordinated Effort\s+-\s+(.+)$/) ?? [])[1]?.trim() ?? ''
    const participants = participantRows.map(pr => ({
      name: pr.character_name,
      outcome: pr.outcome,
      total: pr.total,
      die1: pr.die1, die2: pr.die2,
      amod: pr.amod, smod: pr.smod, cmod: pr.cmod,
    }))
    const enrichedLead: RollEntry = {
      ...leadRow,
      damage_json: {
        ...(leadRow.damage_json as any || {}),
        coordChainSkill: skill,
        coordChainParticipants: participants,
      } as any,
    }
    collapsed.push({ idx: raw.indexOf(leadRow), row: enrichedLead })
  }
  // Restore original order by index.
  collapsed.sort((a, b) => a.idx - b.idx)
  return collapsed.map(c => c.row)
}

export function useRollsFeed({ campaignId }: UseRollsFeedArgs): UseRollsFeedReturn {
  const supabase = createClient()
  const [rolls, setRolls] = useState<RollEntry[]>([])
  const [expandedRollIds, setExpandedRollIds] = useState<Set<string>>(new Set())
  const rollFeedRef = useRef<HTMLDivElement | null>(null)
  const channelRef = useRef<any>(null)
  // Sequence guard - realtime callbacks on roll_log can fire in tight
  // bursts (a multi-roll combat round, or chained turn_changed +
  // roll inserts). A slower earlier query can finish AFTER a faster
  // later one and clobber fresh state with stale data. Same defense
  // as loadEntries on the table page.
  const refetchSeqRef = useRef(0)

  const scrollToBottom = useCallback(() => {
    rollFeedRef.current?.scrollTo(0, rollFeedRef.current.scrollHeight)
  }, [])

  const refetch = useCallback(async () => {
    if (!campaignId) return
    const seq = ++refetchSeqRef.current
    const { data } = await supabase
      .from('roll_log')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(50)
    // Drop stale results - a newer refetch already won.
    if (seq !== refetchSeqRef.current) return
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

  // Re-pull on tab return-to-visible - Chrome can pause the websocket
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

  // Apply Coord Effort chain collapse before exposing. Memoized on
  // `rolls` reference so we don't re-walk the list on every render
  // unrelated to roll data (e.g., expandedRollIds toggle).
  const collapsedRolls = useMemo(() => collapseCoordEffortChains(rolls), [rolls])
  return { rolls: collapsedRolls, refetch, clear, expandedRollIds, toggleExpanded, rollFeedRef, scrollToBottom }
}

// ---------------------------------------------------------------------------
// <RollEntry> - single roll-feed card.
//
// Dispatches by `r.outcome` and renders the matching variant. The Logs-only
// tab on the table page maps every roll through this with `simple={false}`;
// the merged Both-tab maps with `simple={true}`, which:
//   - skips the four community-check variants (retention/fed/clothed/morale)
//     so they fall through to the default skill-roll render
//   - in the default branch: uses raw `r.label` (no character-name prefix
//     strip), drops the Insight-Die-spent banner, and renders the damage
//     box at 13px instead of 14px
// All other variants render identically in both modes.
// ---------------------------------------------------------------------------
export interface RollEntryProps {
  r: RollEntry
  expandedRollIds: Set<string>
  toggleExpanded: (id: string) => void
  /** Both-tab mode: community check variants (retention/fed/clothed/morale)
   *  fall through to the default-skill render. The default branch itself
   *  uses raw label, smaller damage font, and no Insight Die badges. */
  simple?: boolean
}

export function RollEntry({ r, expandedRollIds, toggleExpanded, simple }: RollEntryProps) {
  // combat_start
  if (r.outcome === 'combat_start' && (r.damage_json as any)?.combatants) {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1010', border: '1px solid #c0392b', borderRadius: '3px', borderLeft: '3px solid #c0392b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Combat Started</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
          Between {((r.damage_json as any).combatants as string[]).map((n, i, arr) => (
            <span key={i}>
              <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{n}</span>
              {i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' and ' : ''}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // drop
  if (r.outcome === 'drop') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a2010', border: '1px solid #EF9F27', borderRadius: '3px', borderLeft: '3px solid #EF9F27' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.label}</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>Acts alone with 1 action before initiative is rolled.</div>
      </div>
    )
  }

  // defer
  if (r.outcome === 'defer') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#0f1a2e', border: '1px solid #7ab3d4', borderRadius: '3px', borderLeft: '3px solid #7ab3d4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.label}</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
      </div>
    )
  }

  // sprint
  if (r.outcome === 'sprint') {
    const tr = (r.damage_json as any)?.trimmedRoll
    // `winded` persisted explicitly on new entries; fall back to
    // inferring from rollOutcome for older rows that predate the flag.
    const windedFlag = (r.damage_json as any)?.winded
    const isWinded = typeof windedFlag === 'boolean'
      ? windedFlag
      : (tr?.rollOutcome === 'Failure' || tr?.rollOutcome === 'Dire Failure')
    const isExpanded = expandedRollIds.has(r.id)
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a2010', border: '1px solid #EF9F27', borderRadius: '3px', borderLeft: '3px solid #EF9F27' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🏃 Sprint</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
            {tr && (
              <button onClick={() => toggleExpanded(r.id)}
                title={isExpanded ? 'Hide details' : 'View roll'}
                style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }}>
                {isExpanded ? '▾' : '▸'}
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>{r.label.replace(/^🏃\s*/, '')}</div>
        {tr && isExpanded && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #3a3a3a', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
            <div>
              [{Array.isArray(tr.diceRolled) && tr.diceRolled.length > 0 ? tr.diceRolled.join('+') : `${tr.die1}+${tr.die2}`}]
              {tr.amod !== 0 && <span style={{ color: tr.amod > 0 ? '#7fc458' : '#c0392b' }}> {tr.amod > 0 ? '+' : ''}{tr.amod} AMod</span>}
              {tr.smod !== 0 && <span style={{ color: tr.smod > 0 ? '#7fc458' : '#c0392b' }}> {tr.smod > 0 ? '+' : ''}{tr.smod} SMod</span>}
              {tr.cmod !== 0 && <span style={{ color: tr.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {tr.cmod > 0 ? '+' : ''}{tr.cmod} CMod</span>}
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {tr.total}</span>
              <span style={{ marginLeft: '8px', color: outcomeColor(tr.rollOutcome), fontWeight: 700 }}>{tr.rollOutcome}</span>
            </div>
            <div style={{ marginTop: '4px', color: isWinded ? '#f5a89a' : '#7fc458', fontWeight: 600 }}>
              {isWinded ? 'Loses 1 Combat Action next round.' : 'Full 2 actions next round.'}
            </div>
          </div>
        )}
      </div>
    )
  }

  // weapon_malfunction — Low Insight on a non-Unarmed weapon roll
  // degrades the weapon's condition + flips its jammed flag. Amber
  // outline matches the wound-infection-warning shape: both are
  // in-combat events the GM/player needs to act on later.
  if (r.outcome === 'weapon_malfunction') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1408', border: '1px solid #EF9F27', borderRadius: '3px', borderLeft: '3px solid #EF9F27' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚠️ Weapon Malfunction</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#f5d8a0', fontFamily: 'Carlito, sans-serif' }}>{r.label}</div>
      </div>
    )
  }

  // wound_infection_warning — first shot/stab/cut wound on a character
  // during combat. Single banner per character per combat (the emit
  // site dedupes via a ref + a roll_log cross-check). Orange outline
  // mirrors the death-banner shape but in amber to signal "remember
  // to roll Wound Infection after combat ends." See:
  //   app/rules/combat/infection — Wound Infection (post-combat) §
  if (r.outcome === 'wound_infection_warning') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1408', border: '1px solid #EF9F27', borderRadius: '3px', borderLeft: '3px solid #EF9F27' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🩸 Wound Infection Warning</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#f5d8a0', fontFamily: 'Carlito, sans-serif' }}>{r.label}</div>
      </div>
    )
  }

  // death (also matches the "Death is in the air" sentinel name)
  if (r.outcome === 'death' || r.character_name === 'Death is in the air') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a0a0a', border: '1px solid #5a1b1b', borderRadius: '3px', borderLeft: '3px solid #c0392b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.character_name}</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif' }}>{r.label}</div>
      </div>
    )
  }

  // incap (RP=0) - same shape as death but amber, less alarming.
  // Sentinel form is 'Lights Out' per the canonical template; the old
  // 'Lights out' spelling stays matched here for back-compat with
  // pre-2026-05-12 rows that landed before the rename.
  if (r.outcome === 'incap' || r.character_name === 'Lights Out' || r.character_name === 'Lights out') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1408', border: '1px solid #5a4218', borderRadius: '3px', borderLeft: '3px solid #EF9F27' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.character_name}</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#f5d8a0', fontFamily: 'Carlito, sans-serif' }}>{r.label}</div>
      </div>
    )
  }

  // revive - paired with incap; green palette to read as recovery.
  if (r.outcome === 'revive' || r.character_name === 'Coming around') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#0f1f08', border: '1px solid #2d5a1b', borderRadius: '3px', borderLeft: '3px solid #7fc458' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.character_name}</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#c4e8a8', fontFamily: 'Carlito, sans-serif' }}>{r.label}</div>
      </div>
    )
  }

  // combat_end
  if (r.outcome === 'combat_end' && (r.damage_json as any)?.combatants) {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', borderLeft: '3px solid #7ab3d4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Combat Ended</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        {((r.damage_json as any).combatants as string[]).length > 0 && (
          <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
            Between {((r.damage_json as any).combatants as string[]).map((n, i, arr) => (
              <span key={i}>
                <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{n}</span>
                {i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' and ' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  // initiative
  if (r.outcome === 'initiative' && (r.damage_json as any)?.initiative) {
    return (
      <div style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #EF9F27', borderRadius: '3px', borderLeft: '3px solid #EF9F27' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Initiative</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        {((r.damage_json as any).initiative as any[]).map((e: any, i: number) => {
          const init = (e.acu ?? 0) + (e.dex ?? 0)
          const nameColor = e.is_npc === false ? '#7ab3d4' : '#f5f2ee'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', padding: '3px 0', borderBottom: i < (r.damage_json as any).initiative.length - 1 ? '1px solid #2e2e2e' : 'none' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: nameColor, fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', minWidth: '90px' }}>{e.name}</span>
              <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                [{e.d1}+{e.d2}]
                {init !== 0 && <span style={{ color: '#7fc458' }}> {init > 0 ? '+' : ''}{init} Init</span>}
                {e.drop !== 0 && <span style={{ color: '#f5a89a' }}> {e.drop} Drop</span>}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Carlito, sans-serif' }}>{e.total}</span>
            </div>
          )
        })}
      </div>
    )
  }

  // Community-check variants only render in the rolls-only tab. In the
  // merged Both tab (`simple={true}`) they fall through to the default
  // skill-roll render below.
  if (!simple && r.outcome === 'retention_check') {
    const dj = (r.damage_json ?? {}) as any
    const rollOutcome = dj.rollOutcome ?? 'Success'
    const survived = !!dj.survived
    const color = survived ? '#7fc458' : '#c0392b'
    const leaderName = dj.leaderName || 'The leader'
    const communityName = dj.communityName || 'the Community'
    // Narrative body per Xero's log-trimming pass (2026-05-10).
    // Trim shows the OUTCOME in plain prose; dice math lives behind
    // the ▸ expander.
    const narrative = survived
      ? `${leaderName} rallied the survivors and the Community still exists`
      : `With the members fragmenting in different directions, ${communityName} has dissolved.`
    const isExpanded = expandedRollIds.has(r.id)
    return (
      <div style={{ marginBottom: '8px', padding: '10px', background: survived ? '#0f1a2e' : '#1a0a0a', border: `1px solid ${color}`, borderRadius: '3px', borderLeft: `3px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🙏 Week {dj.weekNumber} · {dj.communityName} · Retention</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
            <button onClick={() => toggleExpanded(r.id)}
              title={isExpanded ? 'Hide details' : 'View dice'}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }}>
              {isExpanded ? '▾' : '▸'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: '15px', color: survived ? '#c4e8a8' : '#f5a89a', fontFamily: 'Carlito, sans-serif', fontWeight: 600, lineHeight: 1.5 }}>{narrative}</div>
        {isExpanded && (
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #2e2e2e', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
            {dj.leaderName && (
              <div style={{ marginBottom: '4px', color: '#cce0f5' }}>
                Rolled by <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{dj.leaderName}</span>
                {dj.leaderKind && <span style={{ color: '#5a5550' }}> ({dj.leaderKind === 'pc' ? 'PC' : 'NPC'})</span>}
                {dj.skillUsed && <span> - <span style={{ color: '#7ab3d4' }}>{dj.skillUsed}</span></span>}
              </div>
            )}
            <div>
              [{r.die1}+{r.die2}]
              {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
              {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
              <span style={{ color: r.cmod < 0 ? '#f5a89a' : '#cce0f5' }}> {r.cmod >= 0 ? '+' : ''}{r.cmod} Mood</span>
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              <span style={{ marginLeft: '8px', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rollOutcome}</span>
            </div>
            {survived && typeof dj.consecutiveFailuresAfter === 'number' && (
              <div style={{ marginTop: '4px', color: '#7fc458' }}>
                Community retained - consecutive failures reset to <span style={{ fontWeight: 700 }}>{dj.consecutiveFailuresAfter}</span>.
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!simple && (r.outcome === 'fed_check' || r.outcome === 'clothed_check')) {
    const dj = (r.damage_json ?? {}) as any
    const rollOutcome = dj.rollOutcome ?? 'Success'
    const emoji = r.outcome === 'fed_check' ? '🌾' : '🔧'
    // 'fed_check' stays as the DB key; display name was renamed to
    // "Gather Check" per Xero's log-trimming pass (2026-05-10).
    const title = r.outcome === 'fed_check' ? 'Gather Check' : 'Clothed Check'
    const color = outcomeColor(rollOutcome)
    const isHit = rollOutcome === 'Success' || rollOutcome === 'Wild Success' || rollOutcome === 'High Insight'
    // Narrative bodies - trim shows what HAPPENED; the dice math +
    // Next-Morale CMod live behind the ▸ expander.
    const successBody = r.outcome === 'fed_check'
      ? 'The residents were successful and will eat this week.'
      : 'The residents were successful and have scrounged up what they need.'
    const failBody = r.outcome === 'fed_check'
      ? 'The residents were unsuccessful and will go hungry this week.'
      : 'The residents were unsuccessful and will go without this week.'
    const body = isHit ? successBody : failBody
    const isExpanded = expandedRollIds.has(r.id)
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#111', border: `1px solid ${color}33`, borderRadius: '3px', borderLeft: `3px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{emoji} Week {dj.weekNumber} · {dj.communityName} · {title}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
            <button onClick={() => toggleExpanded(r.id)}
              title={isExpanded ? 'Hide details' : 'View dice'}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }}>
              {isExpanded ? '▾' : '▸'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>{body}</div>
        {isExpanded && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #2e2e2e', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
            {dj.leaderName && (
              <div style={{ marginBottom: '4px', color: '#cce0f5' }}>
                Rolled by <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{dj.leaderName}</span>
                {dj.leaderKind && <span style={{ color: '#5a5550' }}> ({dj.leaderKind === 'pc' ? 'PC' : 'NPC'})</span>}
                {dj.skillUsed && <span> - <span style={{ color: '#7ab3d4' }}>{dj.skillUsed}</span></span>}
              </div>
            )}
            <div>
              [{r.die1}+{r.die2}]
              {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
              {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
              {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              <span style={{ marginLeft: '8px', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rollOutcome}</span>
            </div>
            <div style={{ marginTop: '4px', color: '#cce0f5' }}>
              → Next Morale CMod <span style={{ color: dj.cmodForNextMorale > 0 ? '#7fc458' : dj.cmodForNextMorale < 0 ? '#f5a89a' : '#cce0f5', fontWeight: 700 }}>{dj.cmodForNextMorale > 0 ? '+' : ''}{dj.cmodForNextMorale ?? 0}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!simple && r.outcome === 'morale_check') {
    const dj = (r.damage_json ?? {}) as any
    const rollOutcome = dj.rollOutcome ?? 'Success'
    const slots = dj.slots ?? {}
    const willDissolve = !!dj.willDissolve
    const color = willDissolve ? '#c0392b' : outcomeColor(rollOutcome)
    const fmt = (n: number) => n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'
    const cmodClr = (n: number) => n > 0 ? '#7fc458' : n < 0 ? '#f5a89a' : '#cce0f5'
    const isHit = rollOutcome === 'Success' || rollOutcome === 'Wild Success' || rollOutcome === 'High Insight'
    const leaderName = dj.leaderName || 'The leader'
    const communityName = dj.communityName || 'the Community'
    // Narrative body per Xero's log-trimming pass (2026-05-10).
    // Trim shows the OUTCOME in plain prose; dice + slot breakdown
    // live behind the ▸ expander.
    let narrative: string
    if (willDissolve) {
      narrative = `After 3 consecutive failures of confidence in ${leaderName}, ${communityName} has dissolved. All ${dj.membersBefore ?? '?'} members scattered.`
    } else if (isHit) {
      narrative = `${leaderName} inspired ${communityName} and morale was maintained. The Mood around the Campfire is good.`
    } else {
      narrative = `${leaderName} fails to inspire ${communityName}. Morale has dropped and people are leaving. The Mood around the Campfire is not good.`
    }
    const isExpanded = expandedRollIds.has(r.id)
    return (
      <div style={{ marginBottom: '8px', padding: '10px', background: willDissolve ? '#1a0a0a' : '#111', border: `1px solid ${color}`, borderRadius: '3px', borderLeft: `3px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>📊 Week {dj.weekNumber} · {dj.communityName} · Morale</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
            <button onClick={() => toggleExpanded(r.id)}
              title={isExpanded ? 'Hide details' : 'View dice + slots'}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }}>
              {isExpanded ? '▾' : '▸'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>{narrative}</div>
        {isExpanded && (
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #2e2e2e', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
            {dj.leaderName && (
              <div style={{ marginBottom: '4px', color: '#cce0f5' }}>
                Rolled by <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{dj.leaderName}</span>
                {dj.leaderKind && <span style={{ color: '#5a5550' }}> ({dj.leaderKind === 'pc' ? 'PC' : 'NPC'})</span>}
                {dj.skillUsed && <span> - <span style={{ color: '#7ab3d4' }}>{dj.skillUsed}</span></span>}
              </div>
            )}
            <div style={{ marginBottom: '4px' }}>
              [{r.die1}+{r.die2}]
              {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
              {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
              {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              <span style={{ marginLeft: '8px', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rollOutcome}</span>
            </div>
            {slots && Object.keys(slots).length > 0 && (
              <div style={{ color: '#cce0f5', lineHeight: 1.6, marginBottom: '4px' }}>
                <span style={{ color: '#5a5550' }}>Slots:</span>
                {[['Mood', slots.mood], ['Fed', slots.fed], ['Clothed', slots.clothed], ['Hands', slots.enoughHands], ['Voice', slots.clearVoice], ['Watch', slots.safety]].map(([n, v]: any, i) => (
                  <span key={i}> · {n} <span style={{ color: cmodClr(v ?? 0), fontWeight: 700 }}>{fmt(v ?? 0)}</span></span>
                ))}
                {slots.additional !== 0 && slots.additional != null && (
                  <span> · Additional <span style={{ color: cmodClr(slots.additional), fontWeight: 700 }}>{fmt(slots.additional)}</span></span>
                )}
              </div>
            )}
            {!willDissolve && dj.departureCount > 0 && (
              <div style={{ color: '#EF9F27' }}>
                {dj.departureCount} left: <span style={{ color: '#d4cfc9' }}>{(dj.departureNames ?? []).join(', ')}</span>
                <span style={{ color: '#cce0f5' }}> · {dj.membersAfter}/{dj.membersBefore} remaining · {dj.consecutiveFailuresAfter}/3 failures</span>
              </div>
            )}
            {!willDissolve && (
              <div style={{ color: '#7fc458', marginTop: '4px' }}>
                {isHit && 'Morale holds. '}Next Morale CMod: <span style={{ fontWeight: 700 }}>{fmt(dj.cmodForNext ?? 0)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // group_check - bespoke multi-participant banner. Keyed off the label
  // prefix (the row's outcome stays as the standard ladder so the row's
  // border still picks up the right outcome color via the default-branch
  // fall-through path... actually no, we render our own here). The
  // participant list comes from damage_json.groupCheckParticipants which
  // executeRoll folds in from groupCheckPayloadRef just before save.
  if (r.label.startsWith('Group Check - ') && (r.damage_json as any)?.groupCheckParticipants) {
    const dj = r.damage_json as any
    const participants: string[] = dj.groupCheckParticipants
    const skill: string = dj.groupCheckSkill
    const outcomeColorVal = outcomeColor(r.outcome)
    const hit = r.outcome === 'Wild Success' || r.outcome === 'High Insight' || r.outcome === 'Success'
    // Canon rule per Xero 2026-05-11: "Moment of Insight" only on HI/LI;
    // Wild Success says "wildly successful"; Dire Failure says "failed
    // miserably". Earlier version lumped HI into Wildly Successful and
    // used "failed miserably" for LI (now reserved for DF).
    const adverb =
      r.outcome === 'Wild Success' ? 'were Wildly Successful at'
      : r.outcome === 'High Insight' ? 'were Successful at'
      : r.outcome === 'Success' ? 'were Successful at'
      : r.outcome === 'Dire Failure' ? 'failed miserably at'
      : r.outcome === 'Low Insight' ? 'were Unsuccessful at'
      : 'were Unsuccessful at'
    const skillTail = skill
    // Group-flavored Insight Die tags: HI and LI both apply to the
    // whole party here, not just the leader.
    const groupOutcomeTag =
      r.outcome === 'High Insight' ? ' and collectively have a Moment of Insight as to why it went so well'
      : r.outcome === 'Low Insight' ? ' but collectively have a Moment of Insight as to why it went so badly'
      : ''
    // "A, B, C, and D" with Oxford serial comma when 3+; "A and B"
    // for two; just "A" for solo.
    const formatNames = (names: string[]) => {
      if (names.length <= 1) return names[0] ?? ''
      if (names.length === 2) return `${names[0]} and ${names[1]}`
      return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
    }
    const isExpanded = expandedRollIds.has(r.id)
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1a1a', border: `1px solid ${outcomeColorVal}33`, borderRadius: '3px', borderLeft: `3px solid ${outcomeColorVal}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: outcomeColorVal, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Group Check</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
            <button onClick={() => toggleExpanded(r.id)}
              title={isExpanded ? 'Hide details' : 'View dice'}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }}>
              {isExpanded ? '▾' : '▸'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
          {formatNames(participants)} {adverb} {skillTail}{groupOutcomeTag}
          {/* Badge gates on outcome AND insight_awarded - canon rule: Insight Die
              only on HI/LI, regardless of what insight_awarded says on old rows. */}
          {r.insight_awarded && (r.outcome === 'High Insight' || r.outcome === 'Low Insight') && <span style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Carlito, sans-serif', marginLeft: '6px' }}>+1 Insight Die</span>}
        </div>
        {isExpanded && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #3a3a3a', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
            <div>
              [{r.die1}+{r.die2}]
              {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
              {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
              {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              <span style={{ marginLeft: '8px', color: outcomeColorVal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{r.outcome}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Coordinated Effort - bespoke Tier A banner. Sibling to Group Check
  // above. Triggered by collapseCoordEffortChains in useRollsFeed
  // having enriched the lead row with damage_json.coordChainParticipants.
  // Narrative format locked 2026-05-18 per Xero:
  //   "<lead> {success-adverb} uses <skill> to coordinate an effort
  //    with <participants>"
  // Expanded view shows per-participant dice math.
  if ((r.damage_json as any)?.coordChainParticipants && r.label.startsWith('Coordinated Effort - ')) {
    const dj = r.damage_json as any
    const skill: string = dj.coordChainSkill ?? ''
    const participants: Array<{ name: string; outcome: string; total: number; die1: number; die2: number; amod: number; smod: number; cmod: number }> = dj.coordChainParticipants
    const outcomeColorVal = outcomeColor(r.outcome)
    const formatNames = (names: string[]) => {
      if (names.length <= 1) return names[0] ?? ''
      if (names.length === 2) return `${names[0]} and ${names[1]}`
      return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
    }
    const adverbClause: string = (() => {
      switch (r.outcome) {
        case 'Wild Success':  return `is wildly successful using ${skill}`
        case 'High Insight':  return `successfully uses ${skill}`
        case 'Success':       return `successfully uses ${skill}`
        case 'Failure':       return `unsuccessfully uses ${skill}`
        case 'Dire Failure':  return `disastrously fails using ${skill}`
        case 'Low Insight':   return `unsuccessfully uses ${skill}`
        default:              return `attempts ${skill}`
      }
    })()
    const insightTail =
      r.outcome === 'High Insight' ? ' and has a Moment of Insight as to why it went so well'
      : r.outcome === 'Low Insight' ? ' and has a Moment of Insight as to why it went so badly'
      : ''
    const participantNames = participants.map(p => p.name)
    const isExpanded = expandedRollIds.has(r.id)
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a1a1a', border: `1px solid ${outcomeColorVal}33`, borderRadius: '3px', borderLeft: `3px solid ${outcomeColorVal}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: outcomeColorVal, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Coordinated Effort</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
            <button onClick={() => toggleExpanded(r.id)}
              title={isExpanded ? 'Hide participants' : 'View participants'}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }}>
              {isExpanded ? '▾' : '▸'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
          {r.character_name} {adverbClause} to coordinate an effort with {formatNames(participantNames)}{insightTail}
          {r.insight_awarded && (r.outcome === 'High Insight' || r.outcome === 'Low Insight') && <span style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Carlito, sans-serif', marginLeft: '6px' }}>+1 Insight Die</span>}
        </div>
        {isExpanded && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #3a3a3a', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
            {/* Lead row dice */}
            <div style={{ marginBottom: '4px' }}>
              <span style={{ color: '#cce0f5', fontWeight: 600 }}>{r.character_name} (lead):</span>{' '}
              [{r.die1}+{r.die2}]
              {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
              {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
              {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              <span style={{ marginLeft: '8px', color: outcomeColorVal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{r.outcome}</span>
            </div>
            {/* Per-participant dice */}
            {participants.map((p, i) => {
              const pColor = outcomeColor(p.outcome)
              return (
                <div key={`${r.id}-p-${i}`} style={{ marginBottom: '2px' }}>
                  <span style={{ color: '#cce0f5', fontWeight: 600 }}>{p.name}:</span>{' '}
                  [{p.die1}+{p.die2}]
                  {p.amod !== 0 && <span style={{ color: p.amod > 0 ? '#7fc458' : '#c0392b' }}> {p.amod > 0 ? '+' : ''}{p.amod} AMod</span>}
                  {p.smod !== 0 && <span style={{ color: p.smod > 0 ? '#7fc458' : '#c0392b' }}> {p.smod > 0 ? '+' : ''}{p.smod} SMod</span>}
                  {p.cmod !== 0 && <span style={{ color: p.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {p.cmod > 0 ? '+' : ''}{p.cmod} CMod</span>}
                  <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {p.total}</span>
                  <span style={{ marginLeft: '8px', color: pColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{p.outcome}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Default: skill / attribute / attack roll.
  //
  // STRUCTURE (post-2026-05-13 unification):
  //   Always render the compact narrative as the top line. The raw r.label
  //   is NEVER displayed - it's input to compactRollSummary only. Old DB
  //   rows have verbose narratives + dice dumps + dev notes baked into the
  //   label field; rendering them would leak "Moment of Insight" text onto
  //   Wild Success / Dire Failure rows. Falling back to a stripped first
  //   line keeps unknown label types readable without that bleed.
  //
  //   When expanded, append a math panel below the narrative with the
  //   dice/mod breakdown + damage box. The expanded panel reads from the
  //   row's numeric fields (die1, die2, amod, ..., damage_json) - never
  //   parsed from the label string.
  //
  //   Insight Die badge gates on r.insight_awarded - set only on HI/LI
  //   outcomes by saveRollToLog, so WS / DF can never show the badge.
  const compactRaw = compactRollSummary(r)
  // Minimal safety fallback: if no compact branch matches (truly unknown
  // label type), show the first line of the label stripped of any "+1
  // Insight Die" / dev-note tails. Keeps the row readable without showing
  // the dice dump or dev notes that old labels baked in.
  let compact = compactRaw ?? r.label.split('\n')[0]
    .replace(/\s+Live feed adds.*$/, '')
    .replace(/\s+\+1 Insight Die\b.*$/, '')
    .trim()
  // BULLETPROOF GUARD (canon rule, locked 2026-05-13): "Moment of Insight"
  // text + "+1 Insight Die" badge ONLY appear on HI/LI outcomes. If r.outcome
  // is anything else, strip any leaked insight text from the narrative no
  // matter what produced it (old baked-in labels, missed compact branches,
  // bespoke phrasings that snuck through). Last line of defense - can't be
  // bypassed by any code path that wrote the wrong narrative.
  const isInsightOutcome = r.outcome === 'High Insight' || r.outcome === 'Low Insight'
  if (!isInsightOutcome) {
    compact = compact
      .replace(/\s+and has a Moment of Insight\b.*$/, '')
      .replace(/\s+but has a Moment of Insight\b.*$/, '')
      .replace(/\s+and collectively have a Moment of Insight\b.*$/, '')
      .replace(/\s+but collectively have a Moment of Insight\b.*$/, '')
      .replace(/\s+and collectively had a Moment of Insight\b.*$/, '')
      .replace(/\s+but collectively had a Moment of Insight\b.*$/, '')
      .replace(/\s+collectively had a Moment of Insight\b.*$/, '')
      .replace(/\s+had a Moment of Insight\b.*$/, '')
  }
  const isExpanded = expandedRollIds.has(r.id)
  const hasRealDice = r.die1 > 0 || r.die2 > 0
  // Show the ▸ pip whenever there's something meaningful to expand to:
  // dice math, insight-die spend banner, or a damage box. Pure system
  // rows (CDP, Encumbrance) with no dice and no extras don't get a pip.
  const hasInsightSpend = r.insight_used === '3d6' || r.insight_used === '+3cmod' || (!r.insight_used && r.die2 > 6)
  const hasDamageBox = r.damage_json && (r.damage_json as any).targetName && (r.damage_json as any).totalWP != null
  const showExpandPip = hasRealDice || hasInsightSpend || hasDamageBox
  return (
    <div style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: `3px solid ${outcomeColor(r.outcome)}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.character_name}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
          {showExpandPip && (
            <button onClick={() => toggleExpanded(r.id)}
              title={isExpanded ? 'Hide details' : 'View more'}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }}>
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
        {compact}
        {/* Badge gates on outcome AND insight_awarded - stale-true rows from
            old DB writes can't leak the badge onto WS/Success/DF outcomes. */}
        {r.insight_awarded && isInsightOutcome && <span style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Carlito, sans-serif', marginLeft: '6px' }}>+1 Insight Die</span>}
      </div>
      {isExpanded && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #3a3a3a' }}>
          {hasRealDice && (
            <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '3px' }}>
              {/* Three render branches for the dice slot:
                  - insight_used='3d6' AND damage_json.die3 stored: split die2 into
                    its raw components (die2 = d2+d3 by storage convention) and show
                    [d1+d2+d3 (insight die)]
                  - insight_used='3d6' fallback (old rows where die3 wasn't captured): [d1 + d2 (d2+d3)]
                  - normal:                                          [d1+d2] */}
              {r.insight_used === '3d6' && (r.damage_json as any)?.die3 != null
                ? <>[{r.die1}+{r.die2 - (r.damage_json as any).die3}+{(r.damage_json as any).die3} <span style={{ color: '#7fc458', fontSize: '13px' }}>(insight die)</span>]</>
                : !simple && r.die2 > 6
                  ? <>[{r.die1} + {r.die2} <span style={{ fontSize: '13px', color: '#7fc458' }}>(d2+d3)</span>]</>
                  : <>[{r.die1}+{r.die2}]</>}
              {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
              {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
              {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod{r.insight_used === '+3cmod' && <span style={{ color: '#7fc458', fontSize: '13px' }}> (insight die)</span>}</span>}
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              <span style={{ marginLeft: '8px', fontWeight: 700, color: outcomeColor(r.outcome), letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.outcome}</span>
            </div>
          )}
          {hasInsightSpend && (
            <div style={{ fontSize: '13px', color: '#7fc458', marginBottom: '4px', fontFamily: 'Carlito, sans-serif' }}>
              {r.insight_used === '+3cmod'
                ? 'Insight Die spent - +3 CMod'
                : 'Insight Die spent to pre-roll 3d6 and keep all 3'}
            </div>
          )}
          {hasDamageBox && (
            <div style={{ marginTop: '6px', padding: '6px 8px', background: '#1a1010', border: '1px solid #c0392b', borderRadius: '3px', fontSize: simple ? '13px' : '14px', fontFamily: 'Carlito, sans-serif', color: '#d4cfc9' }}>
              <span style={{ color: '#f5a89a', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', fontSize: '13px' }}>Damage → {(r.damage_json as any).targetName}</span>
              <div style={{ marginTop: '2px' }}>
                {(r.damage_json as any).base > 0 && <span>{(r.damage_json as any).base}</span>}
                {(r.damage_json as any).diceDesc && <span>{(r.damage_json as any).base > 0 ? '+' : ''}{(r.damage_json as any).diceDesc} ({(r.damage_json as any).diceRoll})</span>}
                {(r.damage_json as any).phyBonus > 0 && <span> +{(r.damage_json as any).phyBonus} PHY</span>}
                <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {(r.damage_json as any).totalWP} raw</span>
                <span style={{ color: '#c0392b' }}> → {(r.damage_json as any).finalWP} WP</span>
                <span style={{ color: '#7ab3d4' }}> / {(r.damage_json as any).finalRP} RP</span>
                {(r.damage_json as any).mitigated > 0 && <span style={{ color: '#cce0f5' }}> ({(r.damage_json as any).mitigated} mitigated)</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
