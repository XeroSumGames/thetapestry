'use client'
// Shared roll modal shell — the canonical Attack Roll shape extracted
// for reuse. Drives the four outlier modals (Stress Check, Breaking
// Point, Lasting Wound, Recruit) that previously had their own
// bespoke layouts. The universal `pendingRoll` modal in
// app/stories/[id]/table/page.tsx already implements this shape
// directly; this component is for the non-tabletop surfaces and the
// Recruit modal that didn't share that path.
//
// Two distinct phases:
//   - PRE-ROLL: title + roll formula breakdown + CMod input + Insight
//     Dice pre-roll buttons (3d6 / +3 CMod) + warnings + Roll button.
//   - POST-ROLL: dice display + outcome banner (or custom renderOutcome
//     slot for table-lookup outcomes like Breaking Point) + optional
//     damage block + post-roll Insight Die reroll buttons + Close.
//
// Insight Dice integration is optional via `userInsightDice` —
// when > 0, the pre-roll buttons render. Reroll handlers are
// individually optional so callers can opt out (e.g. Lasting Wound
// is permanent, no rerolls).

import React from 'react'

export interface RollResult {
  die1: number
  die2: number
  /** Set when 3d6 pre-roll spent. die1 = first die; die2 = best of d2+d3 packed. */
  die3?: number
  amod: number
  smod: number
  cmod: number
  total: number
  /** Free-form text — 'Success', 'Failure', 'High Insight', or table label. */
  outcome: string
  insightAwarded?: boolean
  insightUsed?: 'pre' | 'die1' | 'die2' | 'both' | null
  /** Optional damage breakdown for damage rolls. */
  damage?: { label: string; value: number; color?: string }[]
  /** Optional list of dice rolled (for 3d6 display). */
  diceRolled?: number[]
}

type PreRollChoice = 'none' | '3d6' | '+3cmod'

export interface RollModalProps {
  open: boolean
  onClose: () => void

  // ── Header ────────────────────────────────────────────────────
  title: string
  /** e.g. "2d6 + RSN + ACU + CMod" or "Roll Recruitment". */
  rollFormula: string
  /** Subtitle line — typically the character or target context. */
  subtitle?: string

  // ── Modifiers ─────────────────────────────────────────────────
  amod: number
  /** Skill modifier. Pass 0 if not skill-based. */
  smod: number
  cmod: number
  /** Set when CMod input is editable (most rolls). Pass undefined for
   *  read-only (e.g. system-driven rolls without manual override). */
  setCmod?: (n: number) => void
  /** Optional itemized CMod stack — list of `{ label, value }` rows
   *  rendered above the CMod input as a breakdown of how it was
   *  computed. Empty/absent = hidden. */
  cmodBreakdown?: { label: string; value: number }[]

  // ── Insight Dice (optional) ───────────────────────────────────
  userInsightDice?: number
  preRollInsight?: PreRollChoice
  setPreRollInsight?: (v: PreRollChoice) => void

  // ── Optional warnings rendered above Roll button ──────────────
  warnings?: React.ReactNode
  /** Optional content rendered between subtitle and the modifier
   *  breakdown — used for context like target dropdown, weapon damage
   *  preview, etc. */
  preRollExtras?: React.ReactNode

  // ── Roll trigger ──────────────────────────────────────────────
  onRoll: () => void | Promise<void>
  rolling?: boolean
  /** Override the Roll button label (default: "Roll"). */
  rollLabel?: string
  /** Disable the Roll button (e.g. invalid target). */
  rollDisabled?: boolean

  // ── Post-roll ─────────────────────────────────────────────────
  result: RollResult | null
  /** Custom outcome renderer for table-lookup-driven outcomes
   *  (Breaking Point / Lasting Wound). When provided, replaces the
   *  standard outcome banner. */
  renderOutcome?: (result: RollResult) => React.ReactNode

  // ── Post-roll Insight Die rerolls (each optional) ─────────────
  onRerollDie1?: () => void | Promise<void>
  onRerollDie2?: () => void | Promise<void>
  onRerollBoth?: () => void | Promise<void>
  rerollPending?: boolean

  /** Post-roll close / advance label. Default: "Close". */
  postRollCloseLabel?: string
  onPostRollClose?: () => void
}

const OUTCOME_COLOR: Record<string, string> = {
  'Wild Success': '#7fc458',
  'High Insight': '#7fc458',
  'Success': '#7fc458',
  'Failure': '#f5a89a',
  'Dire Failure': '#c0392b',
  'Low Insight': '#c0392b',
}

function outcomeColor(o: string): string {
  return OUTCOME_COLOR[o] ?? '#cce0f5'
}

export default function RollModal(props: RollModalProps) {
  const {
    open, onClose, title, rollFormula, subtitle,
    amod, smod, cmod, setCmod, cmodBreakdown,
    userInsightDice, preRollInsight, setPreRollInsight,
    warnings, preRollExtras,
    onRoll, rolling, rollLabel, rollDisabled,
    result, renderOutcome,
    onRerollDie1, onRerollDie2, onRerollBoth, rerollPending,
    postRollCloseLabel, onPostRollClose,
  } = props

  if (!open) return null

  const insightAvail = (userInsightDice ?? 0) > 0
  const insightSpentPre = result?.insightUsed === 'pre' || preRollInsight === '3d6' || preRollInsight === '+3cmod'
  const canRerollDie1 = !!onRerollDie1 && !insightSpentPre && (result?.insightUsed !== 'die1' && result?.insightUsed !== 'both')
  const canRerollDie2 = !!onRerollDie2 && !insightSpentPre && (result?.insightUsed !== 'die2' && result?.insightUsed !== 'both')
  const canRerollBoth = !!onRerollBoth && !insightSpentPre && !result?.insightUsed && insightAvail

  return (
    <div onClick={result ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'Barlow, sans-serif' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', maxWidth: '460px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {result ? title : (rolling ? 'Rolling…' : title)}
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', color: '#5a5550', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        {subtitle && (
          <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '12px' }}>{subtitle}</div>
        )}

        {/* Pre-roll extras (target dropdown, weapon preview, etc.) */}
        {!result && preRollExtras}

        {/* Roll formula breakdown */}
        {!result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', padding: '10px 12px', background: '#0f0f0f', borderRadius: '3px', border: '1px solid #2e2e2e' }}>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {rollFormula}
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
              <span>AMod <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{amod >= 0 ? `+${amod}` : amod}</span></span>
              {smod !== 0 && <span>SMod <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{smod >= 0 ? `+${smod}` : smod}</span></span>}
              <span>CMod <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{cmod >= 0 ? `+${cmod}` : cmod}</span></span>
            </div>
          </div>
        )}

        {/* Optional itemized CMod breakdown */}
        {!result && cmodBreakdown && cmodBreakdown.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '10px', padding: '6px 10px', background: '#0f0f0f', borderRadius: '3px', border: '1px solid #2e2e2e' }}>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
              CMod Stack
            </div>
            {cmodBreakdown.map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#d4cfc9' }}>
                <span>{row.label}</span>
                <span style={{ color: row.value >= 0 ? '#7fc458' : '#f5a89a', fontWeight: 700 }}>{row.value >= 0 ? `+${row.value}` : row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* CMod input */}
        {!result && setCmod && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Conditional Modifier
            </label>
            <input type="number" value={cmod}
              onChange={e => setCmod(parseInt(e.target.value || '0', 10))}
              style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
          </div>
        )}

        {/* Insight Dice pre-roll buttons */}
        {!result && insightAvail && setPreRollInsight && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
              🎲 Insight Dice ({userInsightDice} available)
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['none', '3d6', '+3cmod'] as PreRollChoice[]).map(c => {
                const active = preRollInsight === c
                const accent = c === 'none' ? '#cce0f5' : '#EF9F27'
                const label = c === 'none' ? 'No spend' : c === '3d6' ? 'Roll 3d6' : '+3 CMod'
                return (
                  <button key={c} onClick={() => setPreRollInsight(c)}
                    style={{ padding: '6px 12px', background: active ? '#2a2010' : 'transparent', border: `1px solid ${active ? accent : '#3a3a3a'}`, borderRadius: '3px', color: active ? accent : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: active ? 700 : 500 }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Warnings */}
        {!result && warnings && (
          <div style={{ marginBottom: '10px' }}>{warnings}</div>
        )}

        {/* Roll button */}
        {!result && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => onRoll()} disabled={rolling || rollDisabled}
              style={{ flex: 1, padding: '10px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, cursor: (rolling || rollDisabled) ? 'not-allowed' : 'pointer', opacity: (rolling || rollDisabled) ? 0.5 : 1 }}>
              {rolling ? '…' : (rollLabel ?? (preRollInsight === '3d6' ? 'Roll 3d6' : 'Roll'))}
            </button>
            <button onClick={onClose} disabled={rolling}
              style={{ padding: '10px 16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {/* Post-roll display */}
        {result && (
          <>
            {/* Dice display */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '10px' }}>
              {(result.diceRolled ?? [result.die1, result.die2]).map((d, i) => (
                <div key={i} style={{ width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '6px', fontFamily: 'Carlito, sans-serif', fontSize: '24px', fontWeight: 700, color: '#f5f2ee' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Outcome — custom renderer or default banner */}
            {renderOutcome ? renderOutcome(result) : (
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em' }}>
                  {result.die1} + {result.die2} {result.amod !== 0 ? ` + ${result.amod} (AMod)` : ''}{result.smod !== 0 ? ` + ${result.smod} (SMod)` : ''}{result.cmod !== 0 ? ` ${result.cmod >= 0 ? '+' : ''}${result.cmod} (CMod)` : ''} = <span style={{ color: '#f5f2ee', fontWeight: 700, fontSize: '16px' }}>{result.total}</span>
                </div>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: outcomeColor(result.outcome), marginTop: '6px' }}>
                  {result.outcome}
                </div>
                {result.insightAwarded && (
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                    🎲 Insight Die awarded
                  </div>
                )}
              </div>
            )}

            {/* Damage block */}
            {result.damage && result.damage.length > 0 && (
              <div style={{ marginBottom: '12px', padding: '8px 10px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                {result.damage.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                    <span>{d.label}</span>
                    <span style={{ color: d.color ?? '#f5f2ee', fontWeight: 700 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Post-roll Insight Die rerolls */}
            {(canRerollDie1 || canRerollDie2 || canRerollBoth) && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  🎲 Spend Insight Die to reroll
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {canRerollDie1 && (
                    <button onClick={() => onRerollDie1?.()} disabled={rerollPending}
                      style={{ padding: '6px 12px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: rerollPending ? 'wait' : 'pointer', opacity: rerollPending ? 0.5 : 1 }}>
                      Reroll Die 1
                    </button>
                  )}
                  {canRerollDie2 && (
                    <button onClick={() => onRerollDie2?.()} disabled={rerollPending}
                      style={{ padding: '6px 12px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: rerollPending ? 'wait' : 'pointer', opacity: rerollPending ? 0.5 : 1 }}>
                      Reroll Die 2
                    </button>
                  )}
                  {canRerollBoth && (
                    <button onClick={() => onRerollBoth?.()} disabled={rerollPending}
                      style={{ padding: '6px 12px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: rerollPending ? 'wait' : 'pointer', opacity: rerollPending ? 0.5 : 1 }}>
                      Reroll Both
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Close */}
            <button onClick={() => (onPostRollClose ?? onClose)()}
              style={{ width: '100%', padding: '10px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer' }}>
              {postRollCloseLabel ?? 'Close'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
