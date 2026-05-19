'use client'

// FirstImpressionModal — Phase 2 of the FI streamline.
//
// Replaces the two-modal sequence (special-check picker + RollModal)
// with a single self-contained modal that owns the entire FI flow:
// skill picker + NPC picker + CMod stepper + Roll button + inline dice
// render + outcome + vibe + Done. Parent passes eligible PCs/NPCs and
// the resolver callback; this component owns the picker state and the
// d6 throws.
//
// Phase 2 scope: pick + roll + result. Insight Die spend is NOT
// surfaced here yet — Phase 3 will fold that in alongside the cutover
// (and the same one-modal pattern for the other special checks).

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
  infMod: number
  bestSkillName: 'Manipulation' | 'Streetwise' | 'Psychology'
  bestSkillLevel: number
  manipLevel: number
  streetLevel: number
  psychLevel: number
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
  onClose: () => void
  // Called when the player clicks Roll. Parent owns the side-effectful
  // resolveFirstImpression call (supabase writes) and returns its
  // result so the modal can render the vibe + any warnings inline.
  onRoll: (args: {
    pc: FiPc
    npc: FiNpc
    skillChoice: 'best' | 'Manipulation' | 'Streetwise' | 'Psychology'
    amod: number
    smod: number
    cmod: number
    die1: number
    die2: number
    total: number
    outcome: string
  }) => Promise<FiResolveResult>
}

export default function FirstImpressionModal({
  isGm,
  eligiblePcs,
  eligibleNpcs,
  defaultPcId,
  onClose,
  onRoll,
}: FirstImpressionModalProps) {
  // Picker state.
  const [pcId, setPcId] = useState<string>(
    defaultPcId ?? (eligiblePcs.length === 1 ? eligiblePcs[0].characterId : ''),
  )
  const [npcId, setNpcId] = useState<string>('')
  const [skillChoice, setSkillChoice] = useState<'best' | 'Manipulation' | 'Streetwise' | 'Psychology'>('best')
  const [cmod, setCmod] = useState<number>(0)

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
    const die1 = rollD6()
    const die2 = rollD6()
    const total = die1 + die2 + amod + smod + cmod
    const outcome = getOutcome(total, die1, die2)
    try {
      const resolved = await onRoll({
        pc, npc, skillChoice, amod, smod, cmod, die1, die2, total, outcome,
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
      // Show the dice but flag the error. The vibe + cmodDelta come
      // from pure helpers so we can still render them.
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

            {/* Breakdown preview */}
            <div style={{
              padding: '8px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e',
              borderRadius: '3px', fontSize: '13px', color: '#cce0f5', marginBottom: '14px',
              fontFamily: 'Carlito, sans-serif',
            }}>
              Roll: 2d6 + AMod {signed(amod)} + SMod {signed(smod)}
              {cmod !== 0 ? ` + CMod ${signed(cmod)}` : ''}
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
