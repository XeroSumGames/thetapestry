'use client'
// Shared roll modal shell - the canonical ATTACK ROLL shape.
//
// Visual chrome matches the inline Attack Roll modal in
// app/stories/[id]/table/page.tsx: 340px draggable panel, colored eyebrow
// + uppercase title, three-zone fixed length (top = title + base-roll line
// with an inline CMod box; variable middle strip; pinned insight + buttons),
// 52px dice tiles,
// outcome banner in the feed palette (lib/roll-helpers outcomeColor), green
// Insight reroll buttons. Drives the non-tabletop + dedicated check modals
// (Stress / Breaking Point / Lasting Wound / Recruit / Stabilize / Distract /
// Gut Instinct / Vehicle). The inline ATTACK modal still implements this
// shape directly; collapsing it onto this component is a deferred follow-up.
//
// Per-roll accent (decision 2026-05-21): `accent` colors the eyebrow + the
// primary Roll button. Structure is identical across every modal; only the
// accent and the body content vary - that is the per-roll idiosyncrasy.
//
// Backdrop is CONTEXTUAL (decision 2026-05-21): `dimBackdrop` true (default)
// renders a dimmed overlay for sheet-context modals; false renders a
// see-through draggable panel for map-context modals so the tactical map
// stays visible behind the roll.
//
// Two phases:
//   - PRE-ROLL: eyebrow + title + base-roll line (2d6 + mods + inline CMod box)
//     + variable middle (preRollExtras / warnings) + Insight buttons + Roll / Cancel.
//   - POST-ROLL: dice display + outcome banner (or custom renderOutcome) +
//     optional damage block + Insight reroll buttons + Close.

import React from 'react'
import { useDragPosition } from '../lib/use-drag-position'
import { outcomeColor } from '../lib/roll-helpers'

export interface RollResult {
  die1: number
  die2: number
  /** Set when 3d6 pre-roll spent. die1 = first die; die2 = best of d2+d3 packed. */
  die3?: number
  amod: number
  smod: number
  cmod: number
  total: number
  /** Free-form text - 'Success', 'Failure', 'High Insight', or table label. */
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
  /** Big uppercase heading - the specific instance (e.g. "Cree stabilizes Donnie"). */
  title: string
  /** Small colored eyebrow above the title - the roll TYPE (e.g. "Stabilize"). */
  eyebrow?: string
  /** Per-roll accent color (eyebrow + primary Roll button). Default neutral blue. */
  accent?: string
  /** e.g. "2d6 + RSN + ACU + CMod" or "Roll Recruitment". */
  rollFormula: string
  /** Optional context line below the title. */
  subtitle?: string
  /** true (default) = dimmed sheet overlay; false = see-through map panel. */
  dimBackdrop?: boolean

  // ── Modifiers ─────────────────────────────────────────────────
  amod: number
  /** Skill modifier. Pass 0 if not skill-based. */
  smod: number
  cmod: number
  /** Set when CMod input is editable (most rolls). Pass undefined for
   *  read-only (e.g. system-driven rolls without manual override). */
  setCmod?: (n: number) => void
  /** Optional itemized CMod stack - list of `{ label, value }` rows
   *  rendered above the CMod input as a breakdown of how it was
   *  computed. Empty/absent = hidden. */
  cmodBreakdown?: { label: string; value: number }[]

  // ── Insight Dice (optional) ───────────────────────────────────
  userInsightDice?: number
  preRollInsight?: PreRollChoice
  setPreRollInsight?: (v: PreRollChoice) => void

  // ── Optional warnings rendered above Roll button ──────────────
  warnings?: React.ReactNode
  /** Optional content rendered between title and the modifier line -
   *  used for context like target dropdown, weapon damage preview, etc. */
  preRollExtras?: React.ReactNode

  // ── Roll trigger ──────────────────────────────────────────────
  // Required for the standard pre-roll → roll flow. Optional when the
  // caller is using the shell as a result-only display (e.g. when an
  // upstream modal already handled the picker + roll-fire path).
  onRoll?: () => void | Promise<void>
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

  /** Post-roll close / advance label. Default: "Done". */
  postRollCloseLabel?: string
  onPostRollClose?: () => void
}

const DEFAULT_ACCENT = '#7ab3d4'

function modPart(n: number) {
  // AMod / SMod chip color: positive green, negative red (matches ATTACK).
  return { color: n > 0 ? '#7fc458' : '#c0392b' }
}

// Pick a readable text color for a filled accent button. ATTACK's red is dark
// (white text); the lighter per-roll accents (green / amber / blue) need dark
// text to stay legible. Luminance threshold, not a per-color lookup, so any
// future accent works.
function readableOn(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '#fff'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1a1a1a' : '#fff'
}

export default function RollModal(props: RollModalProps) {
  const {
    open, onClose, title, eyebrow, accent, rollFormula, subtitle, dimBackdrop = true,
    amod, smod, cmod, setCmod, cmodBreakdown,
    userInsightDice, preRollInsight, setPreRollInsight,
    warnings, preRollExtras,
    onRoll, rolling, rollLabel, rollDisabled,
    result, renderOutcome,
    onRerollDie1, onRerollDie2, onRerollBoth, rerollPending,
    postRollCloseLabel, onPostRollClose,
  } = props

  const { pos, onHandleMouseDown } = useDragPosition()

  if (!open) return null

  const ac = accent ?? DEFAULT_ACCENT
  const insightAvail = (userInsightDice ?? 0) > 0
  const insightSpentPre = result?.insightUsed === 'pre' || preRollInsight === '3d6' || preRollInsight === '+3cmod'
  const canRerollDie1 = !!onRerollDie1 && !insightSpentPre && (result?.insightUsed !== 'die1' && result?.insightUsed !== 'both')
  const canRerollDie2 = !!onRerollDie2 && !insightSpentPre && (result?.insightUsed !== 'die2' && result?.insightUsed !== 'both')
  const canRerollBoth = !!onRerollBoth && !insightSpentPre && !result?.insightUsed && insightAvail

  // Primary (Roll / Done) button uses the per-roll accent fill; secondary
  // (Cancel) stays neutral grey - matches the ATTACK modal exactly.
  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', background: ac, border: `1px solid ${ac}`, borderRadius: '3px',
    color: readableOn(ac), fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em',
    textTransform: 'uppercase', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  })
  const secondaryBtn: React.CSSProperties = {
    padding: '10px 16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', cursor: rolling ? 'not-allowed' : 'pointer',
  }
  // Post-roll Done / Close - neutral grey full-width (matches ATTACK; only the
  // pre-roll Roll button carries the accent).
  const closeBtn: React.CSSProperties = {
    width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em',
    textTransform: 'uppercase', cursor: 'pointer',
  }
  const rerollBtn: React.CSSProperties = {
    padding: '6px 12px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px',
    color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', cursor: rerollPending ? 'wait' : 'pointer', opacity: rerollPending ? 0.5 : 1,
  }

  return (
    <>
      {/* Contextual dim layer - sheet modals dim the screen; map modals
          render see-through so the tactical map stays visible. Clicking the
          dim layer cancels a pre-roll (matches the old ModalBackdrop). */}
      {dimBackdrop && (
        <div
          onClick={result ? undefined : onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10999 }}
        />
      )}

      {/* Draggable panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: pos?.x ?? '50%',
          top: pos?.y ?? '50%',
          transform: pos ? 'none' : 'translate(-50%, -50%)',
          zIndex: 11000,
          background: '#1a1a1a',
          border: '1px solid #3a3a3a',
          borderRadius: '4px',
          width: '340px',
          maxWidth: 'calc(100vw - 2rem)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          fontFamily: 'Carlito, sans-serif',
        }}
      >
        {/* Drag handle strip */}
        <div
          onMouseDown={onHandleMouseDown}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', cursor: 'grab', borderRadius: '4px 4px 0 0', background: '#242424', borderBottom: '1px solid #3a3a3a', userSelect: 'none' }}
        >
          <div style={{ width: '40px', height: '3px', borderRadius: '2px', background: '#5a5a5a' }} />
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Header */}
          {eyebrow && (
            <div style={{ fontSize: '13px', color: ac, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
              {eyebrow}
            </div>
          )}
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: subtitle ? '4px' : '1rem' }}>
            {result ? title : (rolling ? 'Rolling…' : title)}
          </div>
          {subtitle && (
            <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem' }}>{subtitle}</div>
          )}

          {!result && (
            <>
              {/* Base-roll line - 2d6 + AMod + SMod + compact inline CMod box,
                  all on one row (locked design 2026-05-24). The CMod box is
                  pushed right; the old full-width "Conditional Modifier" block
                  is gone. */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', fontSize: '15px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', alignItems: 'center' }}>
                <span>2d6</span>
                {amod !== 0 && <span style={modPart(amod)}>{amod > 0 ? '+' : ''}{amod} AMod</span>}
                {smod !== 0 && <span style={modPart(smod)}>{smod > 0 ? '+' : ''}{smod} SMod</span>}
                {setCmod && (
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase' }}>CMod</span>
                    <input type="number" value={cmod}
                      onChange={e => setCmod(parseInt(e.target.value || '0', 10))}
                      style={{ width: '54px', padding: '5px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                  </span>
                )}
              </div>

              {/* MIDDLE strip - variable per modal (CMod breakdown, caller
                  preRollExtras, warnings). Reserves a consistent height so a
                  blank middle (e.g. Stabilize) is the same length as a populated
                  one (e.g. Distract) - the three-zone fixed length. */}
              <div style={{ minHeight: '70px' }}>
                {cmodBreakdown && cmodBreakdown.length > 0 && (
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

                {/* Pre-roll extras (target dropdown, weapon preview, etc.) -
                    now BELOW the base-roll line per the locked order. */}
                {preRollExtras}

                {/* Warnings */}
                {warnings && (
                  <div style={{ marginBottom: '10px' }}>{warnings}</div>
                )}
              </div>

              {/* Insight Dice pre-roll - the canonical GREEN-BOX style, locked
                  to match the inline Attack modal (Xero 2026-06-01: Insight Dice
                  are ALWAYS the two green boxes with their descriptions, on every
                  roll where dice are available). Two toggle boxes (Roll 3d6 /
                  +3 CMod); clicking the active one deselects back to 'none'. */}
              {insightAvail && setPreRollInsight && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#7fc458', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    🎲 Spend Insight Die ({userInsightDice} available)
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setPreRollInsight(preRollInsight === '3d6' ? 'none' : '3d6')}
                      style={{ flex: 1, padding: '8px 4px', background: preRollInsight === '3d6' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${preRollInsight === '3d6' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Roll 3d6<br /><span style={{ fontSize: '13px', color: preRollInsight === '3d6' ? '#7fc458' : '#cce0f5' }}>Keep all 3</span>
                    </button>
                    <button onClick={() => setPreRollInsight(preRollInsight === '+3cmod' ? 'none' : '+3cmod')}
                      style={{ flex: 1, padding: '8px 4px', background: preRollInsight === '+3cmod' ? '#2d5a1b' : '#1a2e10', border: `1px solid ${preRollInsight === '+3cmod' ? '#7fc458' : '#2d5a1b'}`, borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      +3 CMod<br /><span style={{ fontSize: '13px', color: preRollInsight === '+3cmod' ? '#7fc458' : '#cce0f5' }}>Added to roll</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Roll button - only when the caller wired up onRoll. */}
              {onRoll && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={onClose} disabled={rolling} style={secondaryBtn}>
                    Cancel
                  </button>
                  <button onClick={() => onRoll()} disabled={rolling || rollDisabled} style={primaryBtn(!!(rolling || rollDisabled))}>
                    {rolling ? '…' : (rollLabel ?? (preRollInsight === '3d6' ? '🎲 Roll 3d6' : '🎲 Roll'))}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Post-roll display */}
          {result && (
            <>
              {/* Dice display */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '1rem 0' }}>
                {(result.diceRolled && result.diceRolled.length > 2 ? result.diceRolled : [result.die1, result.die2]).map((d, i) => (
                  <div key={i} style={{ width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#242424', border: '2px solid #3a3a3a', borderRadius: '6px', fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, color: '#f5f2ee' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Outcome - custom renderer or default banner */}
              {renderOutcome ? renderOutcome(result) : (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#d4cfc9' }}>
                    [{result.diceRolled && result.diceRolled.length > 2 ? result.diceRolled.join('+') : `${result.die1}+${result.die2}`}]
                    {result.amod !== 0 && <span style={modPart(result.amod)}> {result.amod > 0 ? '+' : ''}{result.amod}</span>}
                    {result.smod !== 0 && <span style={modPart(result.smod)}> {result.smod > 0 ? '+' : ''}{result.smod}</span>}
                    {result.cmod !== 0 && <span style={{ color: result.cmod > 0 ? '#7ab3d4' : '#EF9F27' }}> {result.cmod > 0 ? '+' : ''}{result.cmod}</span>}
                    <span style={{ color: '#f5f2ee', fontWeight: 700 }}> = {result.total}</span>
                  </div>
                  <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: outcomeColor(result.outcome), marginTop: '6px' }}>
                    {result.outcome}
                  </div>
                  {result.insightAwarded && (
                    <div style={{ fontSize: '13px', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', padding: '3px 8px', borderRadius: '2px', fontFamily: 'Carlito, sans-serif', display: 'inline-block', marginTop: '6px' }}>
                      +1 Insight Die
                    </div>
                  )}
                </div>
              )}

              {/* Damage block */}
              {result.damage && result.damage.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '8px 10px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
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
                  <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#7fc458', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'center' }}>
                    🎲 Spend Insight Die to reroll
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {canRerollDie1 && (
                      <button onClick={() => onRerollDie1?.()} disabled={rerollPending} style={rerollBtn}>
                        Re-roll Die 1
                      </button>
                    )}
                    {canRerollDie2 && (
                      <button onClick={() => onRerollDie2?.()} disabled={rerollPending} style={rerollBtn}>
                        Re-roll Die 2
                      </button>
                    )}
                    {canRerollBoth && (
                      <button onClick={() => onRerollBoth?.()} disabled={rerollPending} style={rerollBtn}>
                        Re-roll Both
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Close */}
              <button onClick={() => (onPostRollClose ?? onClose)()} style={closeBtn}>
                {postRollCloseLabel ?? 'Done'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
