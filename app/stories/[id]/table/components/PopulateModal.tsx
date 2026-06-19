'use client'
// PopulateModal - GM-Tools "Populate" bulk NPC generator. Extracted from
// page.tsx verbatim (table re-arch Step 2). Count/busy state threaded as
// props (migrates to useGmTools later); the triangle breakdown + NPC
// generation are pure lib calls imported directly. Behavior unchanged:
// pick a count, preview the antagonist/foe/goon/bystander breakdown, then
// insert the generated rows into campaign_npcs and switch to the NPCs tab
// via onGenerated().

import { useState, useEffect } from 'react'
import { triangleBreakdown } from '../../../../../lib/populate-triangle'
import { generateRandomNpc } from '../../../../../lib/npc-generator'
import { insertCampaignNpcs } from '../../../../../lib/data/campaign-npcs'
import { pickPortraitsForBatch } from '../../../../../lib/data/npc-roster'

interface PopulateModalProps {
  open: boolean
  onClose: () => void
  count: number
  setCount: React.Dispatch<React.SetStateAction<number>>
  busy: boolean
  setBusy: React.Dispatch<React.SetStateAction<boolean>>
  supabase: any
  campaignId: string
  onGenerated: () => void
}

function Stepper({ value, onChange, min = 0, disabled }: { value: number; onChange: (n: number) => void; min?: number; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min}
        style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', cursor: disabled || value <= min ? 'not-allowed' : 'pointer', opacity: disabled || value <= min ? 0.4 : 1, flexShrink: 0 }}>−</button>
      <span style={{ width: '24px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} disabled={disabled}
        style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>+</button>
    </div>
  )
}

export function PopulateModal({
  open, onClose, count, setCount, busy, setBusy, supabase, campaignId, onGenerated,
}: PopulateModalProps) {
  const [breakdown, setBreakdown] = useState(() => triangleBreakdown(count))

  // When the quick-preset stepper fires, reset all type counts.
  useEffect(() => {
    setBreakdown(triangleBreakdown(count))
  }, [count])

  if (!open) return null

  const total = breakdown.antagonists + breakdown.foes + breakdown.goons + breakdown.bystanders

  const TYPES = [
    { key: 'antagonists' as const, label: 'Antagonists', color: '#d48bd4' },
    { key: 'foes'         as const, label: 'Foes',        color: '#f5a89a' },
    { key: 'goons'        as const, label: 'Goons',       color: '#EF9F27' },
    { key: 'bystanders'  as const, label: 'Bystanders',  color: '#7fc458' },
  ]

  return (
    <div onClick={() => !busy && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1a1a1a', border: '1px solid #5a4a1b', borderRadius: '4px', padding: '1.5rem', width: '420px', maxWidth: '100%' }}>
        <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Populate</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '4px' }}>How many NPCs?</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '14px', lineHeight: 1.5 }}>
          Use the preset stepper for a balanced mix, or adjust each type individually below.
        </div>

        {/* Quick-preset count stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', minWidth: '60px' }}>Preset</span>
          <button onClick={() => setCount(Math.max(1, count - 1))} disabled={busy}
            style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', cursor: busy ? 'not-allowed' : 'pointer' }}>−</button>
          <input type="number" min={1} max={50} value={count}
            onChange={e => setCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
            disabled={busy}
            style={{ width: '60px', padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', fontWeight: 700 }} />
          <button onClick={() => setCount(Math.min(50, count + 1))} disabled={busy}
            style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', cursor: busy ? 'not-allowed' : 'pointer' }}>+</button>
          <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginLeft: 'auto' }}>max 50</span>
        </div>

        {/* Per-type breakdown with individual steppers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
          <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Breakdown</div>
          {TYPES.map(({ key, label, color }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ flex: 1, fontSize: '14px', color: breakdown[key] > 0 ? color : '#3a3a3a', fontFamily: 'Carlito, sans-serif', transition: 'color 0.15s' }}>{label}</span>
              <Stepper value={breakdown[key]} disabled={busy} onChange={n => setBreakdown(prev => ({ ...prev, [key]: n }))} />
            </div>
          ))}
          {total === 0 && (
            <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>Add at least one NPC to generate.</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} disabled={busy}
            style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: busy ? 'not-allowed' : 'pointer' }}>
            Cancel
          </button>
          <button onClick={async () => {
            if (total === 0) return
            setBusy(true)
            const tiers: string[] = []
            for (let i = 0; i < breakdown.antagonists; i++) tiers.push('antagonist')
            for (let i = 0; i < breakdown.foes; i++) tiers.push('foe')
            for (let i = 0; i < breakdown.goons; i++) tiers.push('goon')
            for (let i = 0; i < breakdown.bystanders; i++) tiers.push('bystander')
            const { data: maxRow } = await supabase
              .from('campaign_npcs')
              .select('sort_order')
              .eq('campaign_id', campaignId)
              .order('sort_order', { ascending: false, nullsFirst: false })
              .limit(1).maybeSingle()
            const startSort = ((maxRow as any)?.sort_order ?? 0) + 1
            const npcs = tiers.map(tier => generateRandomNpc(tier))
            const portraits = await pickPortraitsForBatch(campaignId, npcs.map(n => n.gender))
            const rows = npcs.map((npc, i) => ({
              campaign_id: campaignId,
              name: npc.name,
              npc_type: npc.npc_type,
              reason: npc.reason,
              acumen: npc.acumen,
              physicality: npc.physicality,
              influence: npc.influence,
              dexterity: npc.dexterity,
              wp_max: 10 + npc.physicality + npc.dexterity,
              wp_current: 10 + npc.physicality + npc.dexterity,
              rp_max: 6 + npc.physicality,
              rp_current: 6 + npc.physicality,
              status: 'active',
              skills: { entries: npc.skillEntries, weapon: npc.weapon ?? null },
              notes: `${npc.notes}\n\nMotivation: ${npc.motivation}\nComplication: ${npc.complication}\nWords: ${npc.words.join(', ')}`,
              portrait_url: portraits[i] ?? null,
              sort_order: startSort + i,
              folder: null,
              hidden_from_players: true,
            }))
            const { error: insErr } = await insertCampaignNpcs(rows)
            setBusy(false)
            if (insErr) {
              alert(`Populate failed: ${insErr.message}`)
              return
            }
            onClose()
            onGenerated()
          }} disabled={busy || total === 0}
            style={{ flex: 2, padding: '10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: busy || total === 0 ? 'not-allowed' : 'pointer', opacity: busy || total === 0 ? 0.6 : 1, fontWeight: 700 }}>
            {busy ? 'Generating…' : `Generate ${total} NPC${total !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
