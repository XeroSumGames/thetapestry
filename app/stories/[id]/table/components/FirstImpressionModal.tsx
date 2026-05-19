'use client'

// FirstImpressionModal — single-modal First Impression flow.
//
// Replaces the legacy two-modal sequence (special-check picker +
// RollModal) with a self-contained modal that owns the entire FI
// cycle: skill picker + NPC picker + CMod stepper + Insight Die
// spend + Roll button + inline dice render + outcome + vibe + Done.
// Parent passes eligible PCs/NPCs and a single onRoll callback; this
// component owns picker state, d6 throws, Insight Die accounting,
// and result rendering.
//
// Shipped in three phases:
//   Phase 1 (2026-05-19) — pure helpers (cmodDelta / vibe / message)
//     extracted to lib/first-impression-resolver.ts.
//   Phase 2 (2026-05-19) — new modal + resolveFirstImpression side-
//     effectful function; replaced the picker modal.
//   Phase 3 (2026-05-19) — Insight Die pre-roll spend + HI/LI auto-
//     award accounting; deleted the legacy triggerFirstImpression +
//     executeRoll FI branch + firstImpressionTargetRef.
//
// ── TEMPLATE PATTERN ──────────────────────────────────────────────
// This is the blueprint for collapsing the other 4 special checks
// (Perception, Gut Instinct, Group Check, Heal) into single-modal
// flows. Each follows the same shape:
//   1. Pure resolver helpers in lib/<check>-resolver.ts:
//        outcomeFunction(outcome) -> mechanical delta
//        narrativeFunction(delta) -> player-facing vibe text
//        resolveFn(args) -> async; does roll_log + side-effects;
//          returns { delta, vibe, warnings }
//   2. Per-check modal component at
//      app/stories/[id]/table/components/<Check>Modal.tsx:
//        - props: eligible inputs + onClose + onRoll (returns
//          resolver result)
//        - state: picker state + Insight Die preSpend
//        - phases: 'pick' / 'rolling' / 'result'
//        - signed() helper for label rendering
//   3. Page-level wire-up: top-level mount gated on
//      showSpecialCheck === '<check>'; old branch deleted from the
//      shared special-check modal frame.
//   4. Tests: ladder + narrative + signed-zero + resolver success/
//      error paths via mocked supabase client.
// Each migration shrinks page.tsx and moves us toward the Phase 3
// decomposition end state from tasks/page-tsx-decomposition-plan.md.

import { useState, useMemo, useEffect } from 'react'
import { getOutcome, outcomeColor } from '../../../../../lib/roll-helpers'
import {
  firstImpressionCmodDelta,
  firstImpressionVibe,
} from '../../../../../lib/first-impression-resolver'

function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1
}

export interface FiPc {
  characterId: string
  characterName: string
  stateId: string         // character_states row id (needed for insight_dice writes)
  infMod: number
  bestSkillName: 'Manipulation' | 'Streetwise' | 'Psychology'
  bestSkillLevel: number
  manipLevel: number
  streetLevel: number
  psychLevel: number
  insightDice: number     // currently-available Insight Die count for pre-roll spend
}

export interface FiNpc {
  id: string
  name: string
}

export interface FiResolveResult {
  cmodDelta: number
  vibe: string
  warnings: string[]
}

export interface FirstImpressionModalProps {
  isGm: boolean
  eligiblePcs: FiPc[]
  eligibleNpcs: FiNpc[]
  // Auto-selected when there's an unambiguous PC (single visible PC,
  // or active combatant during GM-rolled combat).
  defaultPcId?: string
  // Pre-selected NPC when the modal is opened from the quick-fire FI
  // button on an NPC card (PlayerNpcCard / NpcCard). Player can still
  // change it inside the modal.
  defaultNpcId?: string
  onClose: () => void
  // Called when the player clicks Roll. Parent owns:
  //   - the side-effectful resolveFirstImpression call (roll_log + RPC
  //     + progression_log writes)
  //   - applying insightDieDelta to character_states.insight_dice
  //     (negative for pre-spend, positive for HI/LI auto-award; net
  //     is what the parent writes)
  //   - returning the resolver's cmodDelta/vibe/warnings so the modal
  //     can render the result inline
  onRoll: (args: {
    pc: FiPc
    npc: FiNpc
    skillChoice: 'best' | 'Manipulation' | 'Streetwise' | 'Psychology'
    amod: number
    smod: number
    cmod: number
    die1: number
    die2: number
    die3: number | null            // null on normal 2d6; raw d3 on a 3d6 Insight spend
    total: number
    outcome: string
    insightUsed: '3d6' | '+3cmod' | null
    insightDieDelta: number        // net change to character_states.insight_dice
  }) => Promise<FiResolveResult>
}

export default function FirstImpressionModal({
  isGm,
  eligiblePcs,
  eligibleNpcs,
  defaultPcId,
  defaultNpcId,
  onClose,
  onRoll,
}: FirstImpressionModalProps) {
  // Picker state.
  const [pcId, setPcId] = useState<string>(
    defaultPcId ?? (eligiblePcs.length === 1 ? eligiblePcs[0].characterId : ''),
  )
  const [npcId, setNpcId] = useState<string>(defaultNpcId ?? '')
  const [skillChoice, setSkillChoice] = useState<'best' | 'Manipulation' | 'Streetwise' | 'Psychology'>('best')
  const [cmod, setCmod] = useState<number>(0)
  // Pre-roll Insight Die spend. Two canonical variants (SRD v1.1.17 §05):
  //   '3d6'     - roll three dice, keep all three (storage packs d2+d3
  //               into die2 per saveRollToLog convention so the existing
  //               getOutcome math still works on die1+die2)
  //   '+3cmod'  - just add +3 to the CMod for this single roll
  // Either variant costs 1 Insight Die. Disabled when pc.insightDice === 0.
  const [preSpend, setPreSpend] = useState<'3d6' | '+3cmod' | null>(null)

  // Roll lifecycle.
  const [phase, setPhase] = useState<'pick' | 'rolling' | 'result'>('pick')
  const [result, setResult] = useState<{
    die1: number
    die2: number
    total: number
    outcome: string
    cmodDelta: number
    vibe: string
    warnings: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto-select PC if exactly one becomes eligible after mount (e.g.
  // GM toggles into single-PC view).
  useEffect(() => {
    if (!pcId && eligiblePcs.length === 1) setPcId(eligiblePcs[0].characterId)
  }, [eligiblePcs, pcId])

  const pc = useMemo(() => eligiblePcs.find(p => p.characterId === pcId) ?? null, [eligiblePcs, pcId])
  const npc = useMemo(() => eligibleNpcs.find(n => n.id === npcId) ?? null, [eligibleNpcs, npcId])
  const amod = pc?.infMod ?? 0
  const smod = useMemo(() => {
    if (!pc) return 0
    if (skillChoice === 'best') return pc.bestSkillLevel
    if (skillChoice === 'Manipulation') return pc.manipLevel
    if (skillChoice === 'Streetwise') return pc.streetLevel
    if (skillChoice === 'Psychology') return pc.psychLevel
    return 0
  }, [pc, skillChoice])

  const canRoll = !!pc && !!npc && phase === 'pick'

  function signed(n: number): string {
    if (n > 0) return `+${n}`
    if (n < 0) return `${n}`
    return '+0'
  }

  async function handleRoll() {
    if (!pc || !npc || phase !== 'pick') return
    setError(null)
    setPhase('rolling')
    // Roll lifecycle. Three modes depending on preSpend:
    //   null     - normal 2d6
    //   '3d6'    - roll 3 dice, pack d2+d3 into die2 storage so the
    //              existing 2d6 outcome math works unchanged. die3
    //              stored separately for the renderer.
    //   '+3cmod' - normal 2d6 + 3 added to the effective CMod.
    let die1 = rollD6()
    let die2 = rollD6()
    let die3: number | null = null
    let effectiveCmod = cmod
    let insightUsed: '3d6' | '+3cmod' | null = null
    if (preSpend === '3d6' && pc.insightDice > 0) {
      const d3 = rollD6()
      die3 = d3
      die2 = die2 + d3                // packed convention
      insightUsed = '3d6'
    } else if (preSpend === '+3cmod' && pc.insightDice > 0) {
      effectiveCmod = cmod + 3
      insightUsed = '+3cmod'
    }
    const total = die1 + die2 + amod + smod + effectiveCmod
    // Outcome computed from the raw d1 + d2 pair the renderer will
    // show. For 3d6, die2 already holds d2+d3 so the snake-eyes /
    // boxcars triggers depend on the raw d1 + (d2+d3) values — matches
    // the existing saveRollToLog convention.
    const outcome = getOutcome(total, die1, die2)
    // Insight Die accounting.
    //   pre-spend: -1 when preSpend was applied
    //   HI/LI auto-award: +1 on either Moment outcome (PC always gets
    //     it; this modal only runs for PC rollers).
    const preSpendCost = insightUsed != null ? -1 : 0
    const autoAward = (outcome === 'High Insight' || outcome === 'Low Insight') ? 1 : 0
    const insightDieDelta = preSpendCost + autoAward
    try {
      const resolved = await onRoll({
        pc, npc, skillChoice, amod, smod, cmod: effectiveCmod,
        die1, die2, die3, total, outcome,
        insightUsed, insightDieDelta,
      })
      setResult({
        die1, die2, total, outcome,
        cmodDelta: resolved.cmodDelta,
        vibe: resolved.vibe,
        warnings: resolved.warnings,
      })
      setPhase('result')
    } catch (e: any) {
      setError(e?.message ?? String(e))
      const cmodDelta = firstImpressionCmodDelta(outcome)
      const vibe = firstImpressionVibe(cmodDelta)
      setResult({ die1, die2, total, outcome, cmodDelta, vibe, warnings: [e?.message ?? String(e)] })
      setPhase('result')
    }
  }

  // ── Styles ────────────────────────────────────────────────────
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    zIndex: 10100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  }
  const modalStyle: React.CSSProperties = {
    background: '#0f0f0f', border: '1px solid #5a1f1f', borderRadius: '4px',
    padding: '20px 24px', width: '480px', maxWidth: '100%',
    fontFamily: 'Carlito, sans-serif', color: '#d4cfc9',
  }
  const titleStyle: React.CSSProperties = {
    fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em',
    textTransform: 'uppercase', marginBottom: '4px',
  }
  const headlineStyle: React.CSSProperties = {
    fontSize: '18px', fontWeight: 700, letterSpacing: '.06em',
    textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '4px',
  }
  const blurbStyle: React.CSSProperties = {
    fontSize: '13px', color: '#cce0f5', marginBottom: '14px', lineHeight: 1.5,
  }
  const sectionLabelStyle: React.CSSProperties = {
    fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.06em',
    marginBottom: '4px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif',
    appearance: 'none',
  }
  const buttonStyle: React.CSSProperties = {
    padding: '8px 14px', background: '#242424', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
  }
  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle, background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a',
    fontWeight: 700,
  }
  const stepperStyle: React.CSSProperties = {
    padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', cursor: 'pointer',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={titleStyle}>First Impression</div>
        <div style={headlineStyle}>{npc?.name ?? 'Pick a target NPC'}</div>
        <div style={blurbStyle}>
          Uses Influence + the social skill you pick. Result sets the Relationship CMod between
          the rolling PC and the target NPC, feeding future Recruitment / social checks. Stacks
          atomically (clamped to +/-3) across repeat encounters.
        </div>

        {phase === 'pick' && (
          <>
            {/* Skill picker — chip bar */}
            <div style={{ marginBottom: '12px' }}>
              <div style={sectionLabelStyle}>Skill</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(['best', 'Manipulation', 'Streetwise', 'Psychology'] as const).map(opt => {
                  const selected = skillChoice === opt
                  return (
                    <button key={opt} type="button" onClick={() => setSkillChoice(opt)}
                      style={{
                        flex: 1, minWidth: '110px', padding: '6px 10px',
                        background: selected ? '#2a1210' : '#242424',
                        border: `1px solid ${selected ? '#c0392b' : '#3a3a3a'}`,
                        borderRadius: '3px', color: selected ? '#f5a89a' : '#d4cfc9',
                        fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                        letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
                      }}>
                      {opt === 'best' ? `Best (${pc?.bestSkillName ?? 'Auto'})` : opt}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* PC selector — GM-only when multiple visible PCs */}
            {isGm && eligiblePcs.length > 1 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={sectionLabelStyle}>Rolling PC</div>
                <select value={pcId} onChange={e => setPcId(e.target.value)} style={inputStyle}>
                  <option value="">- pick a PC -</option>
                  {eligiblePcs.map(p => (
                    <option key={p.characterId} value={p.characterId}>{p.characterName} (INF {signed(p.infMod)})</option>
                  ))}
                </select>
              </div>
            )}

            {/* NPC picker */}
            <div style={{ marginBottom: '12px' }}>
              <div style={sectionLabelStyle}>Target NPC</div>
              {eligibleNpcs.length === 0 ? (
                <div style={{ padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px' }}>
                  No NPCs visible on the map or in your sidebar. A GM needs to place an NPC or reveal one first.
                </div>
              ) : (
                <select value={npcId} onChange={e => setNpcId(e.target.value)} style={inputStyle}>
                  <option value="">- pick an NPC -</option>
                  {eligibleNpcs.map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* CMod stepper — the new affordance from playtest mark 01:18:54 */}
            <div style={{ marginBottom: '14px' }}>
              <div style={sectionLabelStyle}>CMod</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button type="button" onClick={() => setCmod(c => c - 1)} style={stepperStyle}>−</button>
                <span style={{
                  fontSize: '18px', fontWeight: 700, fontFamily: 'Carlito, sans-serif',
                  color: cmod > 0 ? '#7fc458' : cmod < 0 ? '#c0392b' : '#cce0f5',
                  minWidth: '40px', textAlign: 'center',
                }}>{signed(cmod)}</span>
                <button type="button" onClick={() => setCmod(c => c + 1)} style={stepperStyle}>+</button>
                <button type="button" onClick={() => setCmod(0)}
                  style={{ ...buttonStyle, fontSize: '13px', marginLeft: '8px' }}>Reset</button>
              </div>
            </div>

            {/* Insight Die pre-roll spend (optional). Two canonical
                variants per SRD §05; player can pick one or neither.
                Buttons disabled when the rolling PC has 0 Insight Dice
                available. */}
            {pc && (
              <div style={{ marginBottom: '12px' }}>
                <div style={sectionLabelStyle}>
                  Insight Die <span style={{ color: '#5a5550', textTransform: 'none', letterSpacing: 0 }}>
                    ({pc.insightDice} available)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['3d6', '+3cmod'] as const).map(opt => {
                    const selected = preSpend === opt
                    const disabled = pc.insightDice === 0 && !selected
                    const label = opt === '3d6' ? 'Spend: 3d6 keep all' : 'Spend: +3 CMod'
                    return (
                      <button key={opt} type="button"
                        onClick={() => setPreSpend(prev => prev === opt ? null : opt)}
                        disabled={disabled}
                        style={{
                          flex: 1, padding: '6px 10px',
                          background: selected ? '#1a2e10' : '#242424',
                          border: `1px solid ${selected ? '#7fc458' : '#3a3a3a'}`,
                          borderRadius: '3px',
                          color: selected ? '#7fc458' : disabled ? '#3a3a3a' : '#d4cfc9',
                          fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                          letterSpacing: '.06em', textTransform: 'uppercase',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.4 : 1,
                        }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Breakdown preview */}
            <div style={{
              padding: '8px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e',
              borderRadius: '3px', fontSize: '13px', color: '#cce0f5', marginBottom: '14px',
              fontFamily: 'Carlito, sans-serif',
            }}>
              Roll: {preSpend === '3d6' ? '3d6 (keep all)' : '2d6'} + AMod {signed(amod)} + SMod {signed(smod)}
              {cmod !== 0 ? ` + CMod ${signed(cmod)}` : ''}
              {preSpend === '+3cmod' ? ` + 3 (Insight Die)` : ''}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={onClose} style={{ ...buttonStyle, flex: 1 }}>Cancel</button>
              <button type="button" onClick={handleRoll} disabled={!canRoll}
                style={{ ...primaryButtonStyle, flex: 2, opacity: canRoll ? 1 : 0.5, cursor: canRoll ? 'pointer' : 'not-allowed' }}>
                🎲 Roll First Impression
              </button>
            </div>
          </>
        )}

        {phase === 'rolling' && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#cce0f5', fontSize: '15px' }}>
            Rolling...
          </div>
        )}

        {phase === 'result' && result && (
          <>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '14px' }}>
              <DieBox value={result.die1} />
              <DieBox value={result.die2} />
            </div>
            <div style={{
              textAlign: 'center', fontFamily: 'Carlito, sans-serif',
              fontSize: '15px', color: '#cce0f5', marginBottom: '6px',
            }}>
              2d6 ({result.die1}+{result.die2}) {signed(amod)} AMod {signed(smod)} SMod{cmod !== 0 ? ` ${signed(cmod)} CMod` : ''} = <strong style={{ color: '#f5f2ee' }}>{result.total}</strong>
            </div>
            <div style={{
              textAlign: 'center', fontSize: '20px', fontWeight: 700, letterSpacing: '.08em',
              textTransform: 'uppercase', color: outcomeColor(result.outcome), marginBottom: '8px',
              fontFamily: 'Carlito, sans-serif',
            }}>
              {result.outcome}
            </div>
            <div style={{
              textAlign: 'center', fontSize: '14px', color: '#cce0f5',
              marginBottom: '14px', fontStyle: 'italic',
            }}>
              {pc?.characterName} made a {result.vibe} on {npc?.name} (CMod {signed(result.cmodDelta)}).
            </div>
            {result.warnings.length > 0 && (
              <div style={{
                padding: '8px 12px', background: '#2a1210', border: '1px solid #5a1f1f',
                borderRadius: '3px', fontSize: '13px', color: '#f5a89a', marginBottom: '12px',
              }}>
                Warnings: {result.warnings.join('; ')}
              </div>
            )}
            {error && (
              <div style={{
                padding: '8px 12px', background: '#2a1210', border: '1px solid #c0392b',
                borderRadius: '3px', fontSize: '13px', color: '#f5a89a', marginBottom: '12px',
              }}>
                Error: {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={onClose} style={{ ...primaryButtonStyle, flex: 1 }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DieBox({ value }: { value: number }) {
  return (
    <div style={{
      width: '52px', height: '52px', borderRadius: '4px',
      background: '#1a1a1a', border: '1px solid #5a1f1f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700,
      color: '#f5f2ee',
    }}>
      {value}
    </div>
  )
}
