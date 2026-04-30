// Initiative Bar — extracted from app/stories/[id]/table/page.tsx during the
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

import { memo, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────
// Mirror the InitiativeEntry / TableEntry shapes from the table page.
// Imported as local interfaces so the component file is self-contained
// without a circular dep through page.tsx.

// Permissive shapes — bar reads a subset of the parent's full
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
  // Callbacks — parent owns DB writes / broadcasts. Entry params are
  // typed as `any` because TypeScript function parameter types are
  // contravariant — the parent's full InitiativeEntry shape (with
  // winded / last_attack_target / inspired_this_round / etc.) isn't
  // assignable to the child's narrower local type, even though the
  // narrow type is a structural subset. Using `any` on the param
  // sidesteps the contravariance check; the child still types its
  // OWN map iterations against the local InitiativeEntry interface.
  onNextTurn: () => void | Promise<void>
  onDefer: (entryId: string) => void | Promise<void>
  onRemove: (entry: any) => void | Promise<void>
  onAddPCToCombat: (entry: any) => void | Promise<void>
  onAddNPC: (name: string) => void | Promise<void>
  onGrantAction: (entry: any) => void | Promise<void>
  onSkipTurn: (entry: any) => void | Promise<void>
}

function InitiativeBarImpl({
  initiativeOrder,
  entries,
  campaignNpcs,
  userId,
  isGM,
  onNextTurn,
  onDefer,
  onRemove,
  onAddPCToCombat,
  onAddNPC,
  onGrantAction,
  onSkipTurn,
}: InitiativeBarProps) {
  // Toolbar UI state — fully owned by the bar.
  const [showAddPC, setShowAddPC] = useState(false)
  const [showAddNPC, setShowAddNPC] = useState(false)
  const [npcName, setNpcName] = useState('')

  function compactName(name: string): string {
    const parts = name.trim().split(/\s+/)
    if (parts.length < 2) return name
    return `${parts[0]} ${parts[parts.length - 1][0]}.`
  }

  // Active-combatant detection for the sticky pill (top-left of bar).
  // Click to advance — fastest escape hatch from a "stuck on a dead
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

  // PCs not currently in initiative — used by the "+ PC" picker.
  const inInitCharIds = new Set(initiativeOrder.filter(e => e.character_id).map(e => e.character_id))
  const addablePCs = entries.filter(e => !inInitCharIds.has(e.character.id))

  // The component renders just the inner flex row. The parent wraps it
  // in the outer overflowX-auto + borderBottom + padding container so
  // that the parent can also fit the action-buttons row inside the
  // same shared chrome.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'max-content' }}>
        {/* Sticky left pane — "⚔️ Initiative" label + active pill */}
        <div style={{ position: 'sticky', left: 0, zIndex: 10, background: '#0d0d0d', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '8px', borderRight: '1px solid #2e2e2e', marginRight: '4px', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>
            ⚔️ Initiative
          </div>
          {active && (
            <div
              onClick={isGM ? () => onNextTurn() : undefined}
              title={
                isGM
                  ? (pillStuck ? `${active.character_name} can't act — click to advance past them` : `Click to advance past ${active.character_name}`)
                  : `Current turn: ${active.character_name}`
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
              → {compactName(active.character_name)}{pillStuck ? ' ⚠' : ''}
            </div>
          )}
        </div>

        {alive.map((entry, idx) => {
          // Green = active, Red = already acted, Yellow = waiting
          const hasActed = !entry.is_active && entry.actions_remaining != null && entry.actions_remaining <= 0
          const borderColor = entry.is_active ? '#7fc458' : hasActed ? '#c0392b' : '#EF9F27'
          const bgColor = entry.is_active ? '#1a2e10' : hasActed ? '#1a1010' : '#1a1a1a'

          // Status icon resolution — same logic for PC/NPC variants.
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

          // NPC type chip color
          const typeColors: Record<string, { fg: string; bg: string; border: string }> = {
            bystander:  { fg: '#7fc458', bg: '#1a2e10', border: '#2d5a1b' },
            antagonist: { fg: '#d48bd4', bg: '#2a102a', border: '#8b2e8b' },
            foe:        { fg: '#f5a89a', bg: '#2a1210', border: '#c0392b' },
          }
          const typeColor = entry.npc_type && typeColors[entry.npc_type]
            ? typeColors[entry.npc_type]
            : { fg: '#EF9F27', bg: '#2a2010', border: '#5a4a1b' }

          return (
            <div key={entry.id} style={{
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
              <span title={entry.character_name} style={{ fontSize: '13px', fontWeight: entry.is_active ? 700 : 400, color: entry.is_active ? '#f5f2ee' : '#d4cfc9', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                {compactName(entry.character_name)}
              </span>
              {entry.is_npc && entry.npc_type && (
                <span style={{ fontSize: '13px', color: typeColor.fg, background: typeColor.bg, border: `1px solid ${typeColor.border}`, padding: '0 4px', borderRadius: '2px', fontFamily: 'Carlito, sans-serif' }}>{entry.npc_type}</span>
              )}
              {entry.is_npc && !entry.npc_type && (
                <span style={{ fontSize: '13px', color: '#EF9F27', background: '#2a2010', border: '1px solid #EF9F27', padding: '0 4px', borderRadius: '2px', fontFamily: 'Carlito, sans-serif' }}>NPC</span>
              )}
              <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', fontWeight: 700 }}>{entry.roll}</span>
              <span style={{ fontSize: '13px', letterSpacing: '2px' }}>
                {Array.from({ length: 2 }).map((_, i) => {
                  const remaining = entry.actions_remaining ?? 0
                  const hasActions = i < remaining
                  return <span key={i} style={{ color: hasActions ? '#7fc458' : '#3a3a3a' }}>●</span>
                })}
              </span>
              {/* Aim/social bonus badge — hidden for NPCs from non-GM viewers */}
              {(entry.aim_bonus ?? 0) !== 0 && (isGM || !entry.is_npc) && (
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: entry.aim_bonus > 0 ? '#7fc458' : '#c0392b' }}>
                  {entry.aim_bonus > 0 ? '+' : ''}{entry.aim_bonus}
                </span>
              )}
              {statusIcons}
              {/* Defer — GM can defer anyone, players can defer their own */}
              {(isGM || entry.user_id === userId) && idx < initiativeOrder.length - 1 && (
                <button onClick={() => onDefer(entry.id)}
                  style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }} title="Defer">↓</button>
              )}
              {/* Grant +1 action — GM only, capped at 2 */}
              {isGM && (entry.actions_remaining ?? 0) < 2 && (
                <button onClick={() => onGrantAction(entry)}
                  style={{ background: 'none', border: 'none', color: '#7fc458', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }} title="Grant +1 action">+</button>
              )}
              {/* Skip ⊘ — GM only, zeroes actions for the round */}
              {isGM && (entry.actions_remaining ?? 0) > 0 && (
                <button onClick={() => onSkipTurn(entry)}
                  style={{ background: 'none', border: 'none', color: '#EF9F27', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'Carlito, sans-serif' }} title="Skip this round (burn remaining actions)">⊘</button>
              )}
              {/* × — GM removes; player ends own active turn */}
              {(isGM || (entry.user_id === userId && entry.is_active)) && (
                <button onClick={() => onRemove(entry)}
                  title={isGM ? 'Remove from combat' : 'End turn'}
                  style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '13px', padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
              )}
            </div>
          )
        })}

        {/* GM toolbar — Add PC / Add NPC / Next */}
        {isGM && (
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0, position: 'relative' }}>
            {addablePCs.length > 0 && (
              !showAddPC ? (
                <button onClick={() => setShowAddPC(true)}
                  style={{ padding: '4px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                  title="Add a player to initiative mid-combat">
                  + PC
                </button>
              ) : (
                <div style={{ position: 'absolute', top: '32px', left: 0, zIndex: 100, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '6px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>
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
              )
            )}
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
                    if (e.key === 'Enter') {
                      const name = npcName.trim()
                      if (!name) return
                      onAddNPC(name)
                      setNpcName('')
                      setShowAddNPC(false)
                    }
                    if (e.key === 'Escape') { setShowAddNPC(false); setNpcName('') }
                  }}
                  placeholder="NPC name..."
                  style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '120px' }}
                />
                <button onClick={() => {
                  const name = npcName.trim()
                  if (!name) return
                  onAddNPC(name)
                  setNpcName('')
                  setShowAddNPC(false)
                }}
                  style={{ padding: '4px 8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>Add</button>
                <button onClick={() => { setShowAddNPC(false); setNpcName('') }}
                  style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>✕</button>
              </div>
            )}
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
