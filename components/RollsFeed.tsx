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

// ---------------------------------------------------------------------------
// <RollEntry> — single roll-feed card.
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
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Combat Started</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.5 }}>
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
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.label}</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>Acts alone with 1 action before initiative is rolled.</div>
      </div>
    )
  }

  // defer
  if (r.outcome === 'defer') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#0f1a2e', border: '1px solid #7ab3d4', borderRadius: '3px', borderLeft: '3px solid #7ab3d4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.label}</span>
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
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🏃 Sprint</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
            {tr && (
              <button onClick={() => toggleExpanded(r.id)}
                title={isExpanded ? 'Hide details' : 'View roll'}
                style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                {isExpanded ? '▾' : '▸'}
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.label.replace(/^🏃\s*/, '')}</div>
        {tr && isExpanded && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #3a3a3a', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
            <div>
              [{Array.isArray(tr.diceRolled) && tr.diceRolled.length > 0 ? tr.diceRolled.join('+') : `${tr.die1}+${tr.die2}`}]
              {tr.amod !== 0 && <span style={{ color: tr.amod > 0 ? '#7fc458' : '#c0392b' }}> {tr.amod > 0 ? '+' : ''}{tr.amod} AMod</span>}
              {tr.smod !== 0 && <span style={{ color: tr.smod > 0 ? '#7fc458' : '#c0392b' }}> {tr.smod > 0 ? '+' : ''}{tr.smod} SMod</span>}
              {tr.cmod !== 0 && <span style={{ color: tr.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {tr.cmod > 0 ? '+' : ''}{tr.cmod} CMod</span>}
              <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {tr.total}</span>
              <span style={{ marginLeft: '8px', color: outcomeColor(tr.rollOutcome), fontWeight: 700 }}>{tr.rollOutcome}</span>
            </div>
            <div style={{ marginTop: '4px', color: isWinded ? '#f5a89a' : '#7fc458', fontWeight: 600 }}>
              {isWinded ? 'Winded — loses 1 Combat Action next round.' : 'Not winded — full 2 actions next round.'}
            </div>
          </div>
        )}
      </div>
    )
  }

  // death (also matches the "Death is in the air" sentinel name)
  if (r.outcome === 'death' || r.character_name === 'Death is in the air') {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#1a0a0a', border: '1px solid #5a1b1b', borderRadius: '3px', borderLeft: '3px solid #c0392b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.character_name}</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '15px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.label}</div>
      </div>
    )
  }

  // combat_end
  if (r.outcome === 'combat_end' && (r.damage_json as any)?.combatants) {
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', borderLeft: '3px solid #7ab3d4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Combat Ended</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        {((r.damage_json as any).combatants as string[]).length > 0 && (
          <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.5 }}>
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
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>⚔️ Initiative</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        {((r.damage_json as any).initiative as any[]).map((e: any, i: number) => {
          const init = (e.acu ?? 0) + (e.dex ?? 0)
          const nameColor = e.is_npc === false ? '#7ab3d4' : '#f5f2ee'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', padding: '3px 0', borderBottom: i < (r.damage_json as any).initiative.length - 1 ? '1px solid #2e2e2e' : 'none' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: nameColor, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', minWidth: '80px' }}>{e.name}</span>
              <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
                [{e.d1}+{e.d2}]
                {init !== 0 && <span style={{ color: '#7fc458' }}> {init > 0 ? '+' : ''}{init} Init</span>}
                {e.drop !== 0 && <span style={{ color: '#f5a89a' }}> {e.drop} Drop</span>}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif' }}>{e.total}</span>
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
    return (
      <div style={{ marginBottom: '8px', padding: '10px', background: survived ? '#0f1a2e' : '#1a0a0a', border: `1px solid ${color}`, borderRadius: '3px', borderLeft: `3px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🙏 Week {dj.weekNumber} · {dj.communityName} · Retention</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        {dj.leaderName && (
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
            Rolled by <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{dj.leaderName}</span>
            {dj.leaderKind && <span style={{ color: '#5a5550' }}> ({dj.leaderKind === 'pc' ? 'PC' : 'NPC'})</span>}
            {dj.skillUsed && <span> — <span style={{ color: '#7ab3d4' }}>{dj.skillUsed}</span></span>}
          </div>
        )}
        <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
          [{r.die1}+{r.die2}]
          {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
          {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
          <span style={{ color: r.cmod < 0 ? '#f5a89a' : '#cce0f5' }}> {r.cmod >= 0 ? '+' : ''}{r.cmod} Mood</span>
          <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
          <span style={{ marginLeft: '8px', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rollOutcome}</span>
        </div>
        <div style={{ fontSize: '13px', color: survived ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600 }}>
          {survived
            ? `✓ ${dj.leaderName ?? 'The leader'} rallied the survivors. Community retained — consecutive failures reset to 2.`
            : `✗ The fragments scatter. Community dissolved.`}
        </div>
      </div>
    )
  }

  if (!simple && (r.outcome === 'fed_check' || r.outcome === 'clothed_check')) {
    const dj = (r.damage_json ?? {}) as any
    const rollOutcome = dj.rollOutcome ?? 'Success'
    const emoji = r.outcome === 'fed_check' ? '🌾' : '🔧'
    const title = r.outcome === 'fed_check' ? 'Fed Check' : 'Clothed Check'
    const color = outcomeColor(rollOutcome)
    return (
      <div style={{ marginBottom: '8px', padding: '8px 10px', background: '#111', border: `1px solid ${color}33`, borderRadius: '3px', borderLeft: `3px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{emoji} Week {dj.weekNumber} · {dj.communityName} · {title}</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
          [{r.die1}+{r.die2}]
          {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
          {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
          {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
          <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
          <span style={{ marginLeft: '8px', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rollOutcome}</span>
        </div>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '2px' }}>
          → Next Morale CMod <span style={{ color: dj.cmodForNextMorale > 0 ? '#7fc458' : dj.cmodForNextMorale < 0 ? '#f5a89a' : '#cce0f5', fontWeight: 700 }}>{dj.cmodForNextMorale > 0 ? '+' : ''}{dj.cmodForNextMorale ?? 0}</span>
        </div>
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
    return (
      <div style={{ marginBottom: '8px', padding: '10px', background: willDissolve ? '#1a0a0a' : '#111', border: `1px solid ${color}`, borderRadius: '3px', borderLeft: `3px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>📊 Week {dj.weekNumber} · {dj.communityName} · Morale</span>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
        </div>
        {dj.leaderName && (
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
            Rolled by <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{dj.leaderName}</span>
            {dj.leaderKind && <span style={{ color: '#5a5550' }}> ({dj.leaderKind === 'pc' ? 'PC' : 'NPC'})</span>}
            {dj.skillUsed && <span> — <span style={{ color: '#7ab3d4' }}>{dj.skillUsed}</span></span>}
          </div>
        )}
        <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
          [{r.die1}+{r.die2}]
          {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
          {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
          {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
          <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
          <span style={{ marginLeft: '8px', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{rollOutcome}</span>
        </div>
        {slots && Object.keys(slots).length > 0 && (
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.6, marginBottom: '4px' }}>
            <span style={{ color: '#5a5550' }}>Slots:</span>
            {[['Mood', slots.mood], ['Fed', slots.fed], ['Clothed', slots.clothed], ['Hands', slots.enoughHands], ['Voice', slots.clearVoice], ['Watch', slots.safety]].map(([n, v]: any, i) => (
              <span key={i}> · {n} <span style={{ color: cmodClr(v ?? 0), fontWeight: 700 }}>{fmt(v ?? 0)}</span></span>
            ))}
            {slots.additional !== 0 && slots.additional != null && (
              <span> · Additional <span style={{ color: cmodClr(slots.additional), fontWeight: 700 }}>{fmt(slots.additional)}</span></span>
            )}
          </div>
        )}
        {willDissolve ? (
          <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600 }}>
            ⚠ Community dissolved — 3 consecutive failures. All {dj.membersBefore ?? '?'} members scattered.
          </div>
        ) : dj.departureCount > 0 ? (
          <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif' }}>
            {dj.departureCount} left: <span style={{ color: '#d4cfc9' }}>{(dj.departureNames ?? []).join(', ')}</span>
            <span style={{ color: '#cce0f5' }}> · {dj.membersAfter}/{dj.membersBefore} remaining · {dj.consecutiveFailuresAfter}/3 failures</span>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Morale holds. Next Morale CMod: <span style={{ fontWeight: 700 }}>{fmt(dj.cmodForNext ?? 0)}</span>
          </div>
        )}
      </div>
    )
  }

  // Default: skill / attribute / attack roll. Branches on `simple`:
  // - simple=false (rolls-only tab): Insight Die spent banner, label
  //   stripped of "<character> — " prefix, 14px damage box.
  // - simple=true (Both tab): raw label, no Insight Die banner, 13px
  //   damage box. Compact-with-expand-toggle is identical in both.
  const compact = compactRollSummary(r)
  const isExpanded = expandedRollIds.has(r.id)
  const useCompact = compact && !isExpanded
  return (
    <div style={{ marginBottom: '8px', padding: '8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', borderLeft: `3px solid ${outcomeColor(r.outcome)}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{r.character_name}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(r.created_at)}</span>
          {compact && (
            <button onClick={() => toggleExpanded(r.id)}
              title={isExpanded ? 'Hide details' : 'View more'}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
              {isExpanded ? '▾' : '▸'}
            </button>
          )}
        </div>
      </div>
      {useCompact ? (
        <div style={{ fontSize: '15px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {compact}
          {r.insight_awarded && <span style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginLeft: '6px' }}>+1 Insight Die</span>}
        </div>
      ) : (
        <>
          <div style={{ fontSize: '15px', color: '#d4cfc9', marginBottom: '4px' }}>
            {simple
              ? r.label
              : (r.label.startsWith(r.character_name + ' — ') ? r.label.slice(r.character_name.length + 3) : r.label)}
            {r.target_name && <span style={{ color: '#EF9F27' }}> → {r.target_name}</span>}
          </div>
          {/* Insight Die pre-spend callout — explicit when
              insight_used is recorded (post-2026-04-28
              schema bump), falls back to the die2 > 6
              heuristic for pre-bump rows so old 3d6 spends
              still get surfaced. +3 CMod spends from before
              the bump can't be detected and stay silent.
              The Both tab's merged feed drops this banner —
              less per-row vertical noise in the interleaved view. */}
          {!simple && (r.insight_used === '3d6' || (!r.insight_used && r.die2 > 6)) && (
            <div style={{ fontSize: '13px', color: '#7fc458', marginBottom: '3px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
              <span style={{ background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 6px', borderRadius: '2px', textTransform: 'uppercase' }}>🎲 Insight Die spent — pre-rolled 3d6 (kept all three)</span>
            </div>
          )}
          {!simple && r.insight_used === '+3cmod' && (
            <div style={{ fontSize: '13px', color: '#7fc458', marginBottom: '3px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
              <span style={{ background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 6px', borderRadius: '2px', textTransform: 'uppercase' }}>🎲 Insight Die spent — +3 CMod</span>
            </div>
          )}
          {/* Hide the dice/mod breakdown for no-roll action rows (Ready
              Weapon, Switch, Reload, Defend, Take Cover, Reposition,
              Move, etc.). Those write outcome='action' with die1=die2=0,
              so showing "[0+0] = 0  action" is just visual noise. */}
          {r.outcome !== 'action' && (
            <>
              <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>
                {!simple && r.die2 > 6
                  ? <>[{r.die1} + {r.die2} <span style={{ fontSize: '13px', color: '#7fc458' }}>(d2+d3)</span>]</>
                  : <>[{r.die1}+{r.die2}]</>}
                {r.amod !== 0 && <span style={{ color: r.amod > 0 ? '#7fc458' : '#c0392b' }}> {r.amod > 0 ? '+' : ''}{r.amod} AMod</span>}
                {r.smod !== 0 && <span style={{ color: r.smod > 0 ? '#7fc458' : '#c0392b' }}> {r.smod > 0 ? '+' : ''}{r.smod} SMod</span>}
                {r.cmod !== 0 && <span style={{ color: r.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {r.cmod > 0 ? '+' : ''}{r.cmod} CMod</span>}
                <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {r.total}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: outcomeColor(r.outcome), fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.outcome}</span>
                {r.insight_awarded && <span style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>+1 Insight Die</span>}
              </div>
            </>
          )}
          {r.damage_json && (
            <div style={{ marginTop: '6px', padding: '6px 8px', background: '#1a1010', border: '1px solid #c0392b', borderRadius: '3px', fontSize: simple ? '13px' : '14px', fontFamily: 'Barlow Condensed, sans-serif', color: '#d4cfc9' }}>
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
        </>
      )}
    </div>
  )
}
