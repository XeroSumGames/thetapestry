'use client'
// ParadigmPicker — reusable Paradigm card grid + expand-to-detail.
//
// Two surfaces consume this:
//   1. The Apprentice creation wizard (recruit a Moment-of-High-Insight
//      NPC, run them through the wizard, pick the Paradigm baseline).
//   2. (Future) /paradigms sidebar page, where players browse, pick,
//      then customize before getting a final character sheet.
//
// Single source of presentation truth so the two surfaces don't drift.
//
// Pure presentation — no DB writes, no auth, no campaign context. The
// caller hands in `value` (the currently-selected Paradigm name, if
// any) and receives a callback when the user clicks a Pick button.
// The component renders the canonical PARADIGMS array from xse-schema.

import { PARADIGMS, type Paradigm, type AttributeName } from '../lib/xse-schema'

const ATTR_ORDER: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']

interface Props {
  value: string | null            // currently-selected Paradigm name, or null
  onChange: (paradigm: Paradigm) => void
}

export default function ParadigmPicker({ value, onChange }: Props) {
  // Cards always show every skill — no expand/collapse, no "headline
  // top-2" treatment. Players want to read the full loadout when
  // picking, and the toggling cost more than it bought.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', alignItems: 'start' }}>
      {PARADIGMS.map(p => {
        const isSelected = value === p.name
        const sorted = [...p.skills].sort((a, b) => b.level - a.level)
        return (
          <div key={p.name}
            style={{
              padding: '10px 12px',
              background: isSelected ? '#1a2e10' : '#1a1a1a',
              border: `1px solid ${isSelected ? '#7fc458' : '#3a3a3a'}`,
              borderRadius: '4px',
              transition: 'background-color .12s ease, border-color .12s ease',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '15px', fontWeight: 700, color: '#f5f2ee',
                  fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase',
                }}>{p.name}</div>
                <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>{p.profession}</div>
              </div>
              <button onClick={() => onChange(p)}
                style={{
                  padding: '4px 10px',
                  background: isSelected ? '#7fc458' : '#1a3a5c',
                  border: `1px solid ${isSelected ? '#7fc458' : '#7ab3d4'}`,
                  borderRadius: '3px',
                  color: isSelected ? '#0f0f0f' : '#7ab3d4',
                  fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                  letterSpacing: '.06em', textTransform: 'uppercase',
                  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1,
                }}>
                {isSelected ? '✓ Picked' : 'Pick'}
              </button>
            </div>

            {/* RAPID summary — every Paradigm shows the same 5-attribute strip */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {ATTR_ORDER.map(k => {
                const v = p.rapid[k]
                if (v === 0) return null  // hide zeros to keep the strip compact
                return (
                  <span key={k} style={{
                    padding: '2px 6px', background: '#242424', border: '1px solid #3a3a3a',
                    borderRadius: '2px', fontSize: '13px', color: '#7ab3d4',
                    fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em',
                  }}>
                    {k} {v >= 0 ? '+' : ''}{v}
                  </span>
                )
              })}
            </div>

            {/* Full skill list, sorted by level descending. Lv 2+ skills
                read in green/bold so the headline skills still pop
                without forcing a separate top-N row. */}
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {sorted.map(s => (
                <div key={s.skillName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                  <span style={{ color: s.level >= 2 ? '#f5f2ee' : '#d4cfc9', fontWeight: s.level >= 2 ? 600 : 400 }}>{s.skillName}</span>
                  <span style={{ color: s.level >= 2 ? '#7fc458' : '#7ab3d4', fontWeight: s.level >= 2 ? 700 : 400 }}>
                    {s.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
