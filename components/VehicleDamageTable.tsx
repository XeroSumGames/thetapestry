'use client'

import { useState } from 'react'
import { type VehicleDamageTable, damageRowForRoll } from '../lib/vehicle-damage'

// Collapsible per-vehicle damage table with a "Roll 2d6" button that highlights
// the affected-system row (Y/Minnie damage table, 2026-05-24). Pure UI - the
// table data + 2d6 mapping live in lib/vehicle-damage.ts. Client-side roll only
// (no feed/DB write); the GM reads the result + effect off the highlighted row.
export default function VehicleDamageTable({ table }: { table: VehicleDamageTable }) {
  const [open, setOpen] = useState(false)
  const [roll, setRoll] = useState<{ d1: number; d2: number; sum: number } | null>(null)

  function rollDamage() {
    const d1 = 1 + Math.floor(Math.random() * 6)
    const d2 = 1 + Math.floor(Math.random() * 6)
    setRoll({ d1, d2, sum: d1 + d2 })
    setOpen(true)
  }

  const hitRow = roll ? damageRowForRoll(table, roll.sum) : undefined
  const label: React.CSSProperties = { fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, fontFamily: 'Carlito, sans-serif' }

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px', marginBottom: '12px', fontFamily: 'Carlito, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', padding: 0, fontSize: '14px', fontFamily: 'Carlito, sans-serif' }}>
          <span style={label}>{open ? '▾' : '▸'} 🔧 Damage Table</span>
        </button>
        <button onClick={rollDamage}
          style={{ marginLeft: 'auto', padding: '4px 12px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>
          🎲 Roll 2d6
        </button>
      </div>

      {roll && hitRow && (
        <div style={{ marginTop: '8px', padding: '8px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px' }}>
          <div style={{ fontSize: '14px', color: '#f5a89a', fontWeight: 700 }}>
            🎲 {roll.d1} + {roll.d2} = {roll.sum} &rarr; {hitRow.system}
          </div>
          <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, marginTop: '3px' }}>{hitRow.effect}</div>
        </div>
      )}

      {open && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '13px', color: '#9aa5b0', lineHeight: 1.5, marginBottom: '6px' }}>{table.intro}</div>
          <div style={{ fontSize: '13px', color: '#EF9F27', lineHeight: 1.5, marginBottom: '10px' }}>{table.stats}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {table.rows.map(r => {
              const isHit = roll?.sum === r.roll
              return (
                <div key={r.roll}
                  style={{
                    display: 'grid', gridTemplateColumns: '28px 1fr', gap: '8px', padding: '8px 10px',
                    background: isHit ? '#2a1210' : '#141414',
                    border: `1px solid ${isHit ? '#c0392b' : '#2e2e2e'}`,
                    borderRadius: '3px',
                  }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: isHit ? '#f5a89a' : '#7ab3d4', textAlign: 'center' }}>{r.roll}</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: isHit ? '#f5a89a' : '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.03em' }}>{r.system}</div>
                    <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, marginTop: '2px' }}>{r.effect}</div>
                    <div style={{ fontSize: '13px', color: '#9aa5b0', lineHeight: 1.5, marginTop: '3px' }}>
                      <span style={{ color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.04em', fontSize: '13px' }}>Repair: </span>{r.repair}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ fontSize: '13px', color: '#9aa5b0', lineHeight: 1.5, marginTop: '10px' }}>
            <span style={{ color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>WP thresholds. </span>{table.thresholds}
          </div>
          <div style={{ fontSize: '13px', color: '#9aa5b0', lineHeight: 1.5, marginTop: '6px' }}>
            <span style={{ color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>GM notes. </span>{table.gmNotes}
          </div>
        </div>
      )}
    </div>
  )
}
