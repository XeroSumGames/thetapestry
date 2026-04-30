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

import { useState } from 'react'
import { PARADIGMS, type Paradigm, type AttributeName } from '../lib/xse-schema'

const ATTR_ORDER: AttributeName[] = ['RSN', 'ACU', 'PHY', 'INF', 'DEX']

interface Props {
  value: string | null            // currently-selected Paradigm name, or null
  onChange: (paradigm: Paradigm) => void
}

export default function ParadigmPicker({ value, onChange }: Props) {
  // Which card is currently expanded inline to show the full skill list.
  // Independent of `value` (selection) so the user can browse details
  // without committing.
  const [expandedName, setExpandedName] = useState<string | null>(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
      {PARADIGMS.map(p => {
        const isSelected = value === p.name
        const isExpanded = expandedName === p.name
        // Top two skills by level — the "headline" skills players read
        // first to figure out what kind of Paradigm this is.
        const sorted = [...p.skills].sort((a, b) => b.level - a.level)
        const topTwo = sorted.slice(0, 2)
        const restCount = sorted.length - topTwo.length
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

            {/* Top-2 skills — the "what kind of character is this" headline */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
              {topTwo.map(s => (
                <span key={s.skillName} style={{
                  padding: '2px 6px', background: '#1a2e10', border: '1px solid #2d5a1b',
                  borderRadius: '2px', fontSize: '13px', color: '#7fc458',
                  fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', fontWeight: 600,
                }}>
                  {s.skillName} {s.level}
                </span>
              ))}
            </div>

            {/* Expand toggle + full skill list */}
            <button onClick={() => setExpandedName(isExpanded ? null : p.name)}
              style={{
                marginTop: '6px',
                background: 'none', border: 'none',
                color: '#5a5550', fontSize: '13px',
                fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em',
                cursor: 'pointer', padding: 0,
              }}>
              {isExpanded ? '▴ Hide skills' : `▾ +${restCount} more skills`}
            </button>
            {isExpanded && (
              <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {sorted.map(s => (
                  <div key={s.skillName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                    <span>{s.skillName}</span>
                    <span style={{ color: s.level >= 2 ? '#7fc458' : '#7ab3d4', fontWeight: s.level >= 2 ? 600 : 400 }}>
                      {s.level}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
