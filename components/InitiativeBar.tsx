// Initiative Bar - extracted from app/stories/[id]/table/page.tsx during the
// C2 refactor pass. Renders the combat initiative tracker that's shown
// across the top of the table page when combat is active.
//
// Layout:
//   [⚔️ INITIATIVE] [→ Active pill] | [combatant cards…] [+ PC] [+ NPC] [Next →]
//
// Per-combatant card:
//   portrait? | compact-name | NPC type chip? | roll | action pips
//   | aim/social bonus? | status icons (💀/🩸/💤/⚡)
//   | Defer ↓ | Grant +1 | Skip ⊘ | Remove ×
//
// The toolbar's "+ PC / + NPC / npcName" UI state lives entirely INSIDE
// this component now; the parent passes onAddPCToCombat / onAddNPC
// callbacks. Parent owns all DB writes via the named callback props.
//
// Wrapped in React.memo so unchanged props don't re-render the bar
// when the parent re-renders for an unrelated reason.

import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ── Types ──────────────────────────────────────────────────────
// Mirror the InitiativeEntry / TableEntry shapes from the table page.
// Imported as local interfaces so the component file is self-contained
// without a circular dep through page.tsx.

// Permissive shapes - bar reads a subset of the parent's full
// InitiativeEntry / TableEntry / CampaignNpc types. The index signatures
// let extra parent fields (winded, last_attack_target, stateId, etc.)
// flow through without forcing the bar to type every column it ignores.
interface InitiativeEntry {
  id: string
  character_name: string
  character_id?: string | null
  user_id?: string | null
  npc_id?: string | null
  roll: number
  is_active: boolean
  is_npc: boolean
  npc_type?: string | null
  portrait_url?: string | null
  actions_remaining: number
  aim_bonus: number
  aim_active?: boolean
  defense_bonus: number
  has_cover: boolean
  [key: string]: any
}

interface LiveStateLike {
  wp_current: number
  rp_current: number
  stress?: number
  death_countdown?: number | null
  [key: string]: any
}

interface TableEntryLike {
  userId: string | null
  character: { id: string; name: string; [key: string]: any }
  liveState?: LiveStateLike
  [key: string]: any
}

interface CampaignNpcLike {
  id: string
  status?: string
  wp_current?: number | null
  wp_max?: number | null
  rp_current?: number | null
  rp_max?: number | null
  death_countdown?: number | null
  [key: string]: any
}

export interface InitiativeBarProps {
  initiativeOrder: InitiativeEntry[]
  entries: TableEntryLike[]
  campaignNpcs: CampaignNpcLike[]
  userId: string | null
  isGM: boolean
  // Callbacks - parent owns DB writes / broadcasts. Entry params are
  // typed as `any` because TypeScript function parameter types are
  // contravariant - the parent's full InitiativeEntry shape (with
  // winded / last_attack_target / inspired_this_round / etc.) isn't
  // assignable to the child's narrower local type, even though the
  // narrow type is a structural subset. Using `any` on the param
  // sidesteps the contravariance check; the child still types its
  // OWN map iterations against the local InitiativeEntry interface.
  onNextTurn: () => void | Promise<void>
  onDefer: (entryId: string) => void | Promise<void>
  onRemove: (entry: any) => void | Promise<void>
  onAddPCToCombat: (entry: any) => void | Promise<void>
  onAddNPC: (name: string, npcId?: string | null) => void | Promise<void>
  onGrantAction: (entry: any) => void | Promise<void>
  onSkipTurn: (entry: any) => void | Promise<void>
  /** Reveal a hidden NPC: sets hidden_from_players=false + token visible. GM only. */
  onRevealHidden?: (entry: any) => void | Promise<void>
  /** Current combat round number - appended to the "INITIATIVE"
   *  label as "INITIATIVE · ROUND N" so round + initiative read
   *  as one cohesive header instead of two stacked rows. */
  combatRound?: number
}

function InitiativeBarImpl({
  initiativeOrder,
  entries,
  campaignNpcs,
  userId,
  combatRound,
  isGM,
  onNextTurn,
  onDefer,
  onRemove,
  onAddPCToCombat,
  onAddNPC,
  onGrantAction,
  onSkipTurn,
  onRevealHidden,
}: InitiativeBarProps) {
  // Toolbar UI state - fully owned by the bar.
  const [showAddPC, setShowAddPC] = useState(false)
  const [showAddNPC, setShowAddNPC] = useState(false)
  const [npcName, setNpcName] = useState('')
  // Pin the + PC dropdown below the button. Rendered into a portal at
  // document.body so it escapes BOTH the bar's overflow-x:auto clip AND
  // any ancestor stacking contexts (transform / filter / contain on a
  // parent traps position:fixed inside, which was still happening even
  // after the position:fixed switch - this is the bulletproof escape).
  const addPCBtnRef = useRef<HTMLButtonElement | null>(null)
  const [addPCAnchor, setAddPCAnchor] = useState<{ top: number; left: number } | null>(null)
  function openAddPCMenu() {
    const r = addPCBtnRef.current?.getBoundingClientRect()
    if (r) setAddPCAnchor({ top: r.bottom + 4, left: r.left })
    setShowAddPC(true)
  }
  // Re-position the dropdown if the user scrolls or the window resizes
  // while it's open - keeps it pinned to the button instead of drifting.
  useEffect(() => {
    if (!showAddPC) return
    const reposition = () => {
      const r = addPCBtnRef.current?.getBoundingClientRect()
      if (r) setAddPCAnchor({ top: r.bottom + 4, left: r.left })
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [showAddPC])

  // Same portal-anchor machinery for the + NPC roster suggestions (the bar's
  // overflow-x:auto would clip an inline dropdown). Anchored to the +NPC
  // wrapper so it pins below the input.
  const addNPCBtnRef = useRef<HTMLDivElement | null>(null)
  const [addNPCAnchor, setAddNPCAnchor] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (!showAddNPC) { setAddNPCAnchor(null); return }
    const reposition = () => {
      const r = addNPCBtnRef.current?.getBoundingClientRect()
      if (r) setAddNPCAnchor({ top: r.bottom + 4, left: r.left })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [showAddNPC])
  // Enter / Add: link to a roster NPC if the typed text exactly matches one
  // (so npc_id + the ACU/DEX init mod are set), otherwise add it as an ad-hoc
  // free-text combatant (npc_id null, plain 2d6) - the explicit fallback.
  function commitNpcText() {
    const q = npcName.trim()
    if (!q) return
    const exact = campaignNpcs.find(n => ((n as any).name ?? '').toLowerCase() === q.toLowerCase())
    onAddNPC(exact ? ((exact as any).name as string) : q, exact ? exact.id : null)
    setNpcName('')
    setShowAddNPC(false)
  }

  function compactName(name: string): string {
    const parts = name.trim().split(/\s+/)
    if (parts.length < 2) return name
    return `${parts[0]} ${parts[parts.length - 1][0]}.`
  }

  // Active-combatant detection for the sticky pill (top-left of bar).
  // Click to advance - fastest escape hatch from a "stuck on a dead
  // combatant" state. Players see a non-clickable pill.
  const active = initiativeOrder.find(e => e.is_active) ?? null

  let pillStuck = false
  if (active) {
    if (active.is_npc && active.npc_id) {
      const npc = campaignNpcs.find(n => n.id === active.npc_id)
      if (npc) {
        const wp = npc.wp_current ?? npc.wp_max ?? 10
        const rp = npc.rp_current ?? npc.rp_max ?? 6
        pillStuck = wp === 0 || rp === 0 || npc.status === 'dead'
      }
    } else {
      const ce = entries.find(e =>
        active.character_id ? e.character.id === active.character_id : e.character.name === active.character_name
      )
      if (ce?.liveState) pillStuck = ce.liveState.wp_current === 0 || ce.liveState.rp_current === 0
    }
  }

  // True when the active entry is an NPC hidden from players.
  const activeIsHidden = !isGM && !!(active?.hidden_from_players)

  // Filter out ONLY truly-dead combatants (status='dead' or fully-elapsed
  // death countdown). Mortally-wounded and incapacitated stay visible
  // with their status icons. Skip-walk in nextTurn handles act-eligibility.
  const alive = initiativeOrder.filter(entry => {
    if (entry.is_npc && entry.npc_id) {
      const npc = campaignNpcs.find(n => n.id === entry.npc_id)
      if (npc) {
        if (npc.status === 'dead') return false
        const wp = npc.wp_current ?? npc.wp_max ?? 10
        if (wp === 0 && npc.death_countdown != null && npc.death_countdown <= 0) return false
      }
    } else {
      const ce = entries.find(e =>
        entry.character_id ? e.character.id === entry.character_id : e.character.name === entry.character_name
      )
      if (ce?.liveState) {
        const ls = ce.liveState
        if (ls.wp_current === 0 && ls.death_countdown != null && ls.death_countdown <= 0) return false
      }
    }
    return true
  })

  // Players only see non-hidden entries; GM sees all (with HIDDEN chip).
  const visibleAlive = isGM ? alive : alive.filter(e => !e.hidden_from_players)

  // PCs not currently in initiative - used by the "+ PC" picker.
  const inInitCharIds = new Set(initiativeOrder.filter(e => e.character_id).map(e => e.character_id))
  const addablePCs = entries.filter(e => !inInitCharIds.has(e.character.id))

  // The component renders just the inner flex row. The parent wraps it
  // in the outer overflowX-auto + borderBottom + padding container so
  // that the parent can also fit the action-buttons row inside the
  // same shared chrome.
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', rowGap: '6px' }}>
        {/* Sticky left pane - "⚔️ Initiative" label + active pill */}
        <div style={{ position: 'sticky', left: 0, zIndex: 10, background: '#0d0d0d', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '8px', borderRight: '1px solid #2e2e2e', marginRight: '4px', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>
            ⚔️ Initiative{combatRound ? ` · Round ${combatRound}` : ''}
          </div>
          {active && (
            <div
              onClick={isGM ? () => onNextTurn() : undefined}
              title={
                isGM
                  ? (pillStuck ? `${active.character_name} can't act - click to advance past them` : `Click to advance past ${active.character_name}`)
                  : activeIsHidden ? 'GM is taking a turn' : `Current turn: ${active.character_name}`
              }
              style={{
                fontSize: '13px',
                padding: '2px 8px',
                background: pillStuck ? '#2a1210' : '#1a2e10',
                border: `1px solid ${pillStuck ? '#c0392b' : '#7fc458'}`,
                borderRadius: '3px',
                color: pillStuck ? '#f5a89a' : '#7fc458',
                fontFamily: 'Carlito, sans-serif',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: isGM ? 'pointer' : 'default',
              }}>
              → {activeIsHidden ? 'Waiting...' : compactName(active.character_name)}{pillStuck ? ' ⚠' : ''}
            </div>
          )}
        </div>

        {/* "Waiting..." placeholder card on player view when the active entry is hidden */}
        {activeIsHidden && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#1a2e10', border: '1px solid #7fc458', borderRadius: '3px', flexShrink: 0, opacity: 0.7 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>Waiting...</span>
            <span style={{ fontSize: '13px', letterSpacing: '2px' }}>
              <span style={{ color: '#7fc458' }}>●</span><span style={{ color: '#7fc458' }}>●</span>
            </span>
          </div>
        )}
        {visibleAlive.map((entry, idx) => {
          // Green = active, Red = already acted, Yellow = waiting
          const hasActed = !entry.is_active && entry.actions_remaining != null && entry.actions_remaining <= 0
          const borderColor = entry.is_active ? '#7fc458' : hasActed ? '#c0392b' : '#EF9F27'
          const bgColor = entry.is_active ? '#1a2e10' : hasActed ? '#1a1010' : '#1a1a1a'

          // Status icon resolution - same logic for PC/NPC variants.
          // GM-only for NPC rows (playtest #20: don't expose NPC conditions).
          let statusIcons: React.ReactNode = null
          if (entry.is_npc && entry.npc_id) {
            if (isGM) {
              const npc = campaignNpcs.find(n => n.id === entry.npc_id)
              if (npc) {
                const npcWP = npc.wp_current ?? npc.wp_max ?? 10
                const npcRP = npc.rp_current ?? npc.rp_max ?? 6
                const isDead = npcWP === 0 && npc.death_countdown != null && npc.death_countdown <= 0
                const isMortal = npcWP === 0 && !isDead
                const isUnconscious = npcRP === 0 && npcWP > 0
                statusIcons = <>
                  {isDead && <span style={{ fontSize: '13px' }} title="Dead">💀</span>}
                  {isMortal && <span style={{ fontSize: '13px' }} title={`Death in ${npc.death_countdown ?? '?'} rounds`}>🩸</span>}
                  {isUnconscious && <span style={{ fontSize: '13px' }} title="Unconscious">💤</span>}
                </>
              }
            }
          } else {
            const charEntry = entries.find(e =>
              entry.character_id ? e.character.id === entry.character_id : e.character.name === entry.character_name
            )
            if (charEntry?.liveState) {
              const ls = charEntry.liveState
              const isDead = ls.wp_current === 0 && ls.death_countdown != null && ls.death_countdown <= 0
              const isMortal = ls.wp_current === 0 && !isDead
              const isUnconscious = ls.rp_current === 0 && ls.wp_current > 0
              const isStressed = (ls.stress ?? 0) >= 3
              statusIcons = <>
                {isDead && <span style={{ fontSize: '13px' }} title="Dead">💀</span>}
                {isMortal && <span style={{ fontSize: '13px' }} title={`Death in ${ls.death_countdown ?? '?'} rounds`}>🩸</span>}
                {isUnconscious && <span style={{ fontSize: '13px' }} title="Unconscious">💤</span>}
                {isStressed && !isDead && !isMortal && <span style={{ fontSize: '13px' }} title="Stressed">⚡</span>}
              </>
            }
          }

          return (
            // E2E hooks (combat-flow Phase B, 2026-05-31): per-row testid keyed
            // on initiative_order.id; the active row also carries
            // aria-current="true" so the spec can find it without computing the
            // rotation (it keeps its per-id testid for ordering assertions).
            <div key={entry.id}
              data-testid={`initiative-row-${entry.id}`}
              aria-current={entry.is_active ? 'true' : undefined}
              style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px',
              background: bgColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '3px',
              flexShrink: 0,
              position: 'relative',
            }}>
              {entry.is_npc && (
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {entry.portrait_url ? (
                    <img src={entry.portrait_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Carlito, sans-serif' }}>{entry.character_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                  )}
                </div>
              )}
              <span title={entry.character_name} style={{ fontSize: '13px', fontWeight: entry.is_active ? 700 : 400, color: entry.hidden_from_players ? '#9a8a6a' : (entry.is_active ? '#f5f2ee' : '#d4cfc9'), fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', opacity: entry.hidden_from_players ? 0.8 : 1 }}>
                {compactName(entry.character_name)}
              </span>
              {/* GM-only HIDDEN chip + Reveal button */}
              {isGM && entry.hidden_from_players && (
                <>
                  <span style={{ fontSize: '13px', padding: '0 4px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>HIDDEN</span>
                  {onRevealHidden && (
                    <button onClick={() => onRevealHidden(entry)}
                      style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }} title="Reveal to players">👁</button>
                  )}
                </>
              )}
              <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', fontWeight: 700 }}>{entry.roll}</span>
              <span style={{ fontSize: '13px', letterSpacing: '2px' }}>
                {Array.from({ length: 2 }).map((_, i) => {
                  const remaining = entry.actions_remaining ?? 0
                  const hasActions = i < remaining
                  return <span key={i} style={{ color: hasActions ? '#7fc458' : '#3a3a3a' }}>●</span>
                })}
              </span>
              {/* Aim/social bonus badge - hidden for NPCs from non-GM viewers */}
              {(entry.aim_bonus ?? 0) !== 0 && (isGM || !entry.is_npc) && (
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: entry.aim_bonus > 0 ? '#7fc458' : '#c0392b' }}>
                  {entry.aim_bonus > 0 ? '+' : ''}{entry.aim_bonus}
                </span>
              )}
              {statusIcons}
              {/* Defer - GM can defer anyone, players can defer their own */}
              {(isGM || entry.user_id === userId) && idx < visibleAlive.length - 1 && (
                <button onClick={() => onDefer(entry.id)}
                  style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }} title="Defer">↓</button>
              )}
              {/* Grant +1 action - GM only, capped at 2 */}
              {isGM && (entry.actions_remaining ?? 0) < 2 && (
                <button onClick={() => onGrantAction(entry)}
                  style={{ background: 'none', border: 'none', color: '#7fc458', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }} title="Grant +1 action">+</button>
              )}
              {/* Skip ⊘ - GM only, zeroes actions for the round */}
              {isGM && (entry.actions_remaining ?? 0) > 0 && (
                <button onClick={() => onSkipTurn(entry)}
                  style={{ background: 'none', border: 'none', color: '#EF9F27', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }} title="Skip this round (burn remaining actions)">⊘</button>
              )}
              {/* × - GM removes; player ends own active turn */}
              {(isGM || (entry.user_id === userId && entry.is_active)) && (
                <button onClick={() => onRemove(entry)}
                  title={isGM ? 'Remove from combat' : 'End turn'}
                  style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '13px', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
              )}
            </div>
          )
        })}

        {/* GM toolbar - Add PC / Add NPC / Next */}
        {isGM && (
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0, position: 'relative' }}>
            {addablePCs.length > 0 && (
              <>
                <button ref={addPCBtnRef} onClick={openAddPCMenu}
                  style={{ padding: '4px 10px', background: showAddPC ? '#0d1f08' : '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                  title="Add a player to initiative mid-combat">
                  + PC
                </button>
                {showAddPC && addPCAnchor && typeof document !== 'undefined' && createPortal(
                  <>
                    {/* Click-away catcher fills the viewport BENEATH the
                        dropdown so any click outside closes the menu. */}
                    <div onClick={() => setShowAddPC(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 99998 }} />
                    <div style={{ position: 'fixed', top: addPCAnchor.top, left: addPCAnchor.left, zIndex: 99999, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '6px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Add PC to Combat</div>
                      {addablePCs.map(e => (
                        <button key={e.character.id} onClick={() => { onAddPCToCombat(e); setShowAddPC(false) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '3px' }}>
                          {e.character.name}
                        </button>
                      ))}
                      <button onClick={() => setShowAddPC(false)}
                        style={{ display: 'block', width: '100%', padding: '3px 8px', background: 'none', border: '1px solid #2e2e2e', borderRadius: '2px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', marginTop: '2px' }}>
                        Cancel
                      </button>
                    </div>
                  </>,
                  document.body,
                )}
              </>
            )}
            <div ref={addNPCBtnRef} style={{ position: 'relative', display: 'flex' }}>
            {!showAddNPC ? (
              <button onClick={() => setShowAddNPC(true)}
                style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                + NPC
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  autoFocus
                  value={npcName}
                  onChange={e => setNpcName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitNpcText()
                    if (e.key === 'Escape') { setShowAddNPC(false); setNpcName('') }
                  }}
                  placeholder="Pick or name an NPC..."
                  style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', width: '140px' }}
                />
                <button onClick={commitNpcText}
                  style={{ padding: '4px 8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>Add</button>
                <button onClick={() => { setShowAddNPC(false); setNpcName('') }}
                  style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>✕</button>
              </div>
            )}
            {/* Roster suggestions in a portal (escapes the bar's overflow-x:auto
                clip). CLICK a match to link the combatant to its campaign_npcs
                record - that's what carries the ACU/DEX init modifier, WP/RP,
                status, and portrait. Typing filters; Add/Enter falls back to an
                ad-hoc free-text NPC when nothing matches exactly. */}
            {showAddNPC && addNPCAnchor && typeof document !== 'undefined' && createPortal(
              <div style={{ position: 'fixed', top: addNPCAnchor.top, left: addNPCAnchor.left, zIndex: 99999, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '6px', minWidth: '180px', maxHeight: '240px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>
                {(() => {
                  const q = npcName.trim().toLowerCase()
                  const matches = campaignNpcs
                    .filter(n => { const nm = ((n as any).name ?? '').toLowerCase(); return nm && (!q || nm.includes(q)) })
                    .slice(0, 12)
                  if (matches.length === 0) {
                    return (
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', padding: '4px 8px', lineHeight: 1.4 }}>
                        No roster match{npcName.trim() ? ` - Add creates "${npcName.trim()}" as a one-off` : ''}.
                      </div>
                    )
                  }
                  return matches.map(n => (
                    <button key={n.id} onClick={() => { onAddNPC((n as any).name, n.id); setNpcName(''); setShowAddNPC(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '2px' }}>
                      {(n as any).name}
                    </button>
                  ))
                })()}
              </div>,
              document.body,
            )}
            </div>
            <button onClick={() => onNextTurn()}
              style={{ padding: '4px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Next →
            </button>
          </div>
        )}
    </div>
  )
}

export const InitiativeBar = memo(InitiativeBarImpl)
export default InitiativeBar
