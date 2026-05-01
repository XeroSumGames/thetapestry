'use client'
// Inventory #5 — Trade Negotiation modal. Single-roll opposed Barter
// check between the PC viewer and a target (NPC or community
// stockpile). Per CRB: "Barter is used as part of an Opposed Check
// where the character who wins convinces the other side to agree to
// their offer. Characters add +1 SMod for each level of Barter."
//
// Flow:
//   1. PC picks items they offer + items they want from the target.
//   2. Visual fairness chip — sum of rarity weights per side.
//   3. Roll Barter — PC's 2d6 + ACU AMod + Barter SMod vs. target's
//      Barter SMod (NPC's level on their skills row, or community
//      leader's level if Community target).
//   4. Outcome resolved via classifyRoll; on success the Apply Deal
//      button is enabled and a single click moves items both ways.
//
// Pure presentation + child of the table page that owns the actual
// state (inventories, ACU/Barter lookup, roll logging). The modal
// only renders + emits "what to do" via callbacks.

import { useEffect, useMemo, useState } from 'react'
import { type InventoryItem } from '../lib/inventory'
import { classifyRoll } from '../lib/community-logic'

const RARITY_WEIGHT: Record<string, number> = {
  Common: 1, Uncommon: 2, Rare: 4,
}
const RARITY_COLOR: Record<string, string> = {
  Common: '#cce0f5', Uncommon: '#7fc458', Rare: '#EF9F27',
}

export interface TradeTarget {
  kind: 'npc' | 'community'
  id: string
  name: string
  inventory: InventoryItem[]
  // Effective Barter SMod for the opposed check. NPC: their skill
  // level. Community: leader's Barter, or 0 if no leader.
  barterSmod: number
  // Optional flavor — shown as subtext under the name.
  subtext?: string
}

export interface TradeOutcome {
  pcDie1: number
  pcDie2: number
  pcTotal: number
  pcOutcome: string
  pcWon: boolean
  npcDie1: number
  npcDie2: number
  npcTotal: number
}

interface SelectedItem extends InventoryItem {
  // qty here = how many of the source row are being moved (clamped to source qty).
  selectedQty: number
}

interface Props {
  pcName: string
  pcInventory: InventoryItem[]
  pcAcuMod: number               // ACU AMod from PC's rapid
  pcBarterSmod: number           // PC's Barter level
  target: TradeTarget
  onClose: () => void
  // Apply the deal — parent handles the actual DB writes for both
  // sides. Modal closes after the callback resolves.
  onApply: (deal: {
    pcGives: SelectedItem[]
    pcGets: SelectedItem[]
    rollSummary: string
    outcome: TradeOutcome
  }) => Promise<void>
}

function rarityWeight(item: InventoryItem): number {
  return RARITY_WEIGHT[item.rarity] ?? 1
}

function totalWeight(items: SelectedItem[]): number {
  return items.reduce((s, i) => s + rarityWeight(i) * i.selectedQty, 0)
}

export default function TradeNegotiationModal({
  pcName, pcInventory, pcAcuMod, pcBarterSmod, target, onClose, onApply,
}: Props) {
  const [pcGivesIdx, setPcGivesIdx] = useState<Record<number, number>>({})  // sourceIdx → qty
  const [pcGetsIdx, setPcGetsIdx] = useState<Record<number, number>>({})
  const [rolling, setRolling] = useState(false)
  const [applying, setApplying] = useState(false)
  const [outcome, setOutcome] = useState<TradeOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ESC closes (unless mid-apply).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !applying) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, applying])

  const pcGives: SelectedItem[] = useMemo(() => {
    const out: SelectedItem[] = []
    for (const [idxStr, qty] of Object.entries(pcGivesIdx)) {
      const idx = Number(idxStr)
      const src = pcInventory[idx]
      if (!src || qty <= 0) continue
      out.push({ ...src, selectedQty: Math.min(qty, src.qty) })
    }
    return out
  }, [pcGivesIdx, pcInventory])

  const pcGets: SelectedItem[] = useMemo(() => {
    const out: SelectedItem[] = []
    for (const [idxStr, qty] of Object.entries(pcGetsIdx)) {
      const idx = Number(idxStr)
      const src = target.inventory[idx]
      if (!src || qty <= 0) continue
      out.push({ ...src, selectedQty: Math.min(qty, src.qty) })
    }
    return out
  }, [pcGetsIdx, target.inventory])

  const offeredWeight = totalWeight(pcGives)
  const requestedWeight = totalWeight(pcGets)
  const fairness = offeredWeight === 0 && requestedWeight === 0
    ? 'empty'
    : Math.abs(offeredWeight - requestedWeight) <= Math.max(1, Math.max(offeredWeight, requestedWeight) * 0.25)
      ? 'fair'
      : offeredWeight > requestedWeight ? 'pc-overpays' : 'pc-underpays'

  function rollOpposed() {
    if (rolling) return
    setRolling(true)
    setError(null)
    const pcD1 = Math.floor(Math.random() * 6) + 1
    const pcD2 = Math.floor(Math.random() * 6) + 1
    const pcTotal = pcD1 + pcD2 + pcAcuMod + pcBarterSmod
    const pcOutcome = classifyRoll(pcTotal, pcD1, pcD2)
    const npcD1 = Math.floor(Math.random() * 6) + 1
    const npcD2 = Math.floor(Math.random() * 6) + 1
    // NPC opposed roll: 2d6 + their Barter SMod. No ACU because we
    // don't have it cleanly per-NPC; the SMod alone is enough for a
    // first-pass opposed check.
    const npcTotal = npcD1 + npcD2 + target.barterSmod
    setOutcome({
      pcDie1: pcD1, pcDie2: pcD2, pcTotal, pcOutcome,
      npcDie1: npcD1, npcDie2: npcD2, npcTotal,
      pcWon: pcTotal > npcTotal,
    })
    setRolling(false)
  }

  function isAcceptable(o: TradeOutcome | null): boolean {
    if (!o) return false
    // Catastrophic PC outcomes can't be salvaged.
    if (o.pcOutcome === 'Dire Failure' || o.pcOutcome === 'Low Insight') return false
    // Tie: PC narrowly fails (NPC's offer stands), so the PC's deal
    // doesn't go through. GM can apply manually if they want.
    return o.pcWon
  }

  function outcomeBadge(o: TradeOutcome): { color: string; bg: string; border: string; label: string; sub: string } {
    if (o.pcOutcome === 'Low Insight') return { color: '#f5a89a', bg: '#2a1210', border: '#7a1f16', label: '✗ Insulted',     sub: 'Negotiation collapses; relationship damaged' }
    if (o.pcOutcome === 'Dire Failure') return { color: '#f5a89a', bg: '#2a1210', border: '#7a1f16', label: '✗ Refused',     sub: 'Counterparty walks away from the table' }
    if (!o.pcWon)                        return { color: '#EF9F27', bg: '#2a2010', border: '#5a4a1b', label: '⚖ Counter-offered', sub: 'GM may adjudicate alternate terms' }
    if (o.pcOutcome === 'High Insight')  return { color: '#d48bd4', bg: '#2a102a', border: '#5a2e5a', label: '✦ Generous Deal',   sub: 'NPC throws in extra at GM\'s discretion' }
    if (o.pcOutcome === 'Wild Success')  return { color: '#7fc458', bg: '#1a2e10', border: '#2d5a1b', label: '✓ Deal Struck',     sub: 'Terms accepted on PC\'s side' }
    return { color: '#7fc458', bg: '#1a2e10', border: '#2d5a1b', label: '✓ Deal Struck', sub: 'Terms agreed' }
  }

  async function handleApply() {
    if (!outcome || !isAcceptable(outcome) || applying) return
    setApplying(true)
    setError(null)
    try {
      const rollSummary = `${pcName} (${pcDie1ToStr(outcome)}) vs. ${target.name} (${npcDieToStr(outcome)}) — ${outcome.pcOutcome}`
      await onApply({ pcGives, pcGets, rollSummary, outcome })
    } catch (err: any) {
      setError(err?.message ?? 'Apply failed')
      setApplying(false)
      return
    }
  }

  function pcDie1ToStr(o: TradeOutcome) {
    return `${o.pcDie1}+${o.pcDie2}+mods → ${o.pcTotal}`
  }
  function npcDieToStr(o: TradeOutcome) {
    return `${o.npcDie1}+${o.npcDie2}+${target.barterSmod >= 0 ? '+' : ''}${target.barterSmod} → ${o.npcTotal}`
  }

  function renderPickerRow(item: InventoryItem, idx: number, side: 'give' | 'get') {
    const idxMap = side === 'give' ? pcGivesIdx : pcGetsIdx
    const setIdxMap = side === 'give' ? setPcGivesIdx : setPcGetsIdx
    const selected = idxMap[idx] ?? 0
    const max = item.qty
    const rarityCol = RARITY_COLOR[item.rarity] ?? '#cce0f5'

    function setQty(q: number) {
      const clamped = Math.max(0, Math.min(max, q))
      setIdxMap(prev => {
        const next = { ...prev }
        if (clamped <= 0) delete next[idx]
        else next[idx] = clamped
        return next
      })
    }

    return (
      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', background: selected > 0 ? '#1a2e10' : '#1a1a1a', border: `1px solid ${selected > 0 ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '2px' }}>
        <span style={{ flex: 1, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
          {item.name} <span style={{ color: '#5a5550' }}>×{item.qty}</span>
        </span>
        <span style={{ fontSize: '13px', color: rarityCol, fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: '60px', textAlign: 'right' }}>
          {item.rarity}
        </span>
        <button onClick={() => setQty(selected - 1)} disabled={selected <= 0}
          style={{ padding: '0 6px', background: selected > 0 ? '#1a1a1a' : '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '2px', color: selected > 0 ? '#f5a89a' : '#3a3a3a', cursor: selected > 0 ? 'pointer' : 'not-allowed', fontSize: '13px' }}>−</button>
        <span style={{ minWidth: '24px', textAlign: 'center', fontSize: '14px', color: '#f5f2ee', fontWeight: 700 }}>{selected}</span>
        <button onClick={() => setQty(selected + 1)} disabled={selected >= max}
          style={{ padding: '0 6px', background: selected < max ? '#1a2e10' : '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '2px', color: selected < max ? '#7fc458' : '#3a3a3a', cursor: selected < max ? 'pointer' : 'not-allowed', fontSize: '13px' }}>+</button>
      </div>
    )
  }

  const hasSelections = pcGives.length > 0 || pcGets.length > 0

  return (
    <div onClick={!applying ? onClose : undefined}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1a1a1a', border: '1px solid #5a4a1b', borderRadius: '4px', width: '880px', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>⚖ Barter Negotiation</div>
            <div style={{ fontSize: '17px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>
              {pcName} ↔ {target.name}
            </div>
            {target.subtext && (
              <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginTop: '2px' }}>{target.subtext}</div>
            )}
          </div>
          <button onClick={!applying ? onClose : undefined}
            style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: applying ? 'not-allowed' : 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* PC offers (left) */}
          <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden', borderRight: '1px solid #2e2e2e' }}>
            <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              You offer ({pcGives.length} item{pcGives.length === 1 ? '' : 's'} · {offeredWeight} value)
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {pcInventory.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#5a5550', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>Your inventory is empty.</div>
              ) : (
                pcInventory.map((it, i) => renderPickerRow(it, i, 'give'))
              )}
            </div>
          </div>

          {/* PC wants (right) */}
          <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              You want ({pcGets.length} item{pcGets.length === 1 ? '' : 's'} · {requestedWeight} value)
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {target.inventory.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#5a5550', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>{target.name}&apos;s inventory is empty.</div>
              ) : (
                target.inventory.map((it, i) => renderPickerRow(it, i, 'get'))
              )}
            </div>
          </div>
        </div>

        {/* Fairness gauge */}
        {hasSelections && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Fairness</span>
            <div style={{ flex: 1, fontSize: '13px', fontFamily: 'Carlito, sans-serif',
              color: fairness === 'fair' ? '#7fc458'
                : fairness === 'pc-overpays' ? '#EF9F27'
                : fairness === 'pc-underpays' ? '#7ab3d4'
                : '#5a5550' }}>
              {fairness === 'fair' && `Even-handed (${offeredWeight} ↔ ${requestedWeight})`}
              {fairness === 'pc-overpays' && `You're overpaying (${offeredWeight} → ${requestedWeight}) — easier roll`}
              {fairness === 'pc-underpays' && `You're underpaying (${offeredWeight} → ${requestedWeight}) — harder roll`}
              {fairness === 'empty' && `Pick something on each side to deal`}
            </div>
            <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }} title="Rarity weights: Common 1, Uncommon 2, Rare 4">
              Common 1 · Uncommon 2 · Rare 4
            </span>
          </div>
        )}

        {/* Roll outcome */}
        {outcome && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(() => {
              const b = outcomeBadge(outcome)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '4px 10px', background: b.bg, border: `1px solid ${b.border}`, borderRadius: '3px', color: b.color, fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                    {b.label}
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
                    {b.sub}
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
              <span>{pcName}: {pcDie1ToStr(outcome)} <span style={{ color: '#7ab3d4' }}>{outcome.pcOutcome}</span></span>
              <span>{target.name}: {npcDieToStr(outcome)}</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 16px', background: '#2a1210', border: '1px solid #7a1f16', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <button onClick={!applying ? onClose : undefined} disabled={applying}
            style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: applying ? 'not-allowed' : 'pointer', opacity: applying ? 0.4 : 1 }}>
            Cancel
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={rollOpposed} disabled={rolling || !hasSelections || applying}
              title={!hasSelections ? 'Select items on both sides first' : 'Roll the opposed Barter check'}
              style={{ padding: '8px 18px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, cursor: hasSelections && !rolling ? 'pointer' : 'not-allowed', opacity: hasSelections && !rolling ? 1 : 0.5 }}>
              {rolling ? 'Rolling…' : outcome ? '↻ Re-roll Barter' : '🎲 Roll Barter'}
            </button>
            <button onClick={handleApply} disabled={!isAcceptable(outcome) || applying}
              title={!outcome ? 'Roll first' : !isAcceptable(outcome) ? 'Negotiation failed — no deal to apply' : 'Apply the deal — items move both ways'}
              style={{ padding: '8px 18px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, cursor: isAcceptable(outcome) && !applying ? 'pointer' : 'not-allowed', opacity: isAcceptable(outcome) && !applying ? 1 : 0.5 }}>
              {applying ? 'Applying…' : '✓ Apply Deal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
