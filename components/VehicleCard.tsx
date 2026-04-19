'use client'
import { useState } from 'react'
import { createClient } from '../lib/supabase-browser'

export interface VehicleCargo {
  name: string
  qty: number
  notes: string
}

export interface Vehicle {
  id: string
  name: string
  type: string
  rarity: string
  size: number
  speed: number
  passengers: number
  encumbrance: number
  range: string
  wp_max: number
  wp_current: number
  stress: number
  fuel_max: number
  fuel_current: number
  three_words: string
  notes: string
  image_url: string | null
  cargo: VehicleCargo[]
}

interface Props {
  vehicle: Vehicle
  campaignId: string
  isGM: boolean
  onUpdate: (vehicle: Vehicle) => void
  onClose: () => void
}

export default function VehicleCard({ vehicle: v, campaignId, isGM, onUpdate, onClose }: Props) {
  const supabase = createClient()
  const [showAddCargo, setShowAddCargo] = useState(false)
  const [cargoName, setCargoName] = useState('')
  const [cargoQty, setCargoQty] = useState('1')
  const [cargoNotes, setCargoNotes] = useState('')
  const [editing, setEditing] = useState(false)
  const [editNotes, setEditNotes] = useState(v.notes)

  function update(patch: Partial<Vehicle>) {
    onUpdate({ ...v, ...patch })
  }

  function addCargo() {
    if (!cargoName.trim()) return
    const existing = v.cargo.find(c => c.name === cargoName.trim())
    if (existing) {
      update({ cargo: v.cargo.map(c => c === existing ? { ...c, qty: c.qty + (parseInt(cargoQty) || 1) } : c) })
    } else {
      update({ cargo: [...v.cargo, { name: cargoName.trim(), qty: parseInt(cargoQty) || 1, notes: cargoNotes.trim() }] })
    }
    setCargoName('')
    setCargoQty('1')
    setCargoNotes('')
    setShowAddCargo(false)
  }

  function removeCargo(idx: number) {
    const item = v.cargo[idx]
    if (item.qty > 1) {
      update({ cargo: v.cargo.map((c, i) => i === idx ? { ...c, qty: c.qty - 1 } : c) })
    } else {
      update({ cargo: v.cargo.filter((_, i) => i !== idx) })
    }
  }

  const wpPct = v.wp_max > 0 ? v.wp_current / v.wp_max : 1
  const wpColor = wpPct > 0.5 ? '#7fc458' : wpPct > 0.25 ? '#EF9F27' : '#c0392b'
  const fuelPct = v.fuel_max > 0 ? v.fuel_current / v.fuel_max : 0

  const lbl: React.CSSProperties = { fontSize: '10px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }
  const val: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #EF9F27', borderRadius: '4px', padding: '10px 12px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {v.image_url && (
          <img src={v.image_url} alt="" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3a3a3a' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>{v.name}</div>
          <div style={{ fontSize: '12px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{v.type} · {v.rarity}</div>
          {v.three_words && <div style={{ fontSize: '11px', color: '#d4cfc9', fontStyle: 'italic' }}>{v.three_words}</div>}
        </div>
        <button onClick={() => window.open(`/vehicle?c=${campaignId}&v=${v.id}`, `vehicle-${v.id}`, 'width=900,height=700,menubar=no,toolbar=no')} title="Pop out"
          style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7ab3d4', fontSize: '10px', cursor: 'pointer', padding: '1px 4px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>↗</button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5a5550', fontSize: '16px', cursor: 'pointer', padding: '0 4px' }}>✕</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {[
          { label: 'Size', value: v.size },
          { label: 'Speed', value: v.speed },
          { label: 'Pass', value: v.passengers },
          { label: 'Enc', value: v.encumbrance },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '3px 0', textAlign: 'center' }}>
            <div style={lbl}>{s.label}</div>
            <div style={val}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Range */}
      <div style={{ fontSize: '11px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>
        Range: <span style={{ color: '#7ab3d4', fontWeight: 700 }}>{v.range}</span>
      </div>

      {/* WP Bar */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={lbl}>Wound Points</span>
          <span style={{ fontSize: '12px', color: wpColor, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{v.wp_current}/{v.wp_max}</span>
          {isGM && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
              <button onClick={() => update({ wp_current: Math.max(0, v.wp_current - 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5a89a', fontSize: '11px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>-</button>
              <button onClick={() => update({ wp_current: Math.min(v.wp_max, v.wp_current + 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', fontSize: '11px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>+</button>
            </div>
          )}
        </div>
        <div style={{ height: '6px', background: '#242424', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${wpPct * 100}%`, background: wpColor, borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Stress */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={lbl}>Stress</span>
          <span style={{ fontSize: '12px', color: v.stress >= 4 ? '#c0392b' : v.stress >= 2 ? '#EF9F27' : '#7fc458', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{v.stress}/5</span>
          {isGM && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
              <button onClick={() => update({ stress: Math.max(0, v.stress - 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', fontSize: '11px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>-</button>
              <button onClick={() => update({ stress: Math.min(5, v.stress + 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5a89a', fontSize: '11px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>+</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ flex: 1, height: '6px', borderRadius: '2px', background: i < v.stress ? (i >= 4 ? '#c0392b' : i >= 2 ? '#EF9F27' : '#7fc458') : '#242424', border: '1px solid #3a3a3a' }} />
          ))}
        </div>
      </div>

      {/* Fuel Reserves */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={lbl}>Fuel Reserves</span>
          <span style={{ fontSize: '12px', color: '#EF9F27', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{v.fuel_current}/{v.fuel_max} days</span>
          {isGM && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
              <button onClick={() => update({ fuel_current: Math.max(0, v.fuel_current - 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5a89a', fontSize: '11px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>-</button>
              <button onClick={() => update({ fuel_current: Math.min(v.fuel_max, v.fuel_current + 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', fontSize: '11px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>+</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Array.from({ length: v.fuel_max }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: '8px', borderRadius: '2px', background: i < v.fuel_current ? '#EF9F27' : '#242424', border: '1px solid #3a3a3a' }} />
          ))}
        </div>
      </div>

      {/* Cargo */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={lbl}>Cargo & Equipment</span>
          <span style={{ fontSize: '10px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>{v.cargo.length} items</span>
          {isGM && (
            <button onClick={() => setShowAddCargo(!showAddCargo)} style={{ marginLeft: 'auto', fontSize: '10px', padding: '0 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer', lineHeight: 1.4 }}>+</button>
          )}
        </div>
        {v.cargo.map((item, idx) => (
          <div key={`${item.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 4px', fontSize: '11px', color: '#d4cfc9', borderBottom: '1px solid #1a1a1a' }}>
            <span style={{ flex: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
              {item.name}
              {item.qty > 1 && <span style={{ color: '#7ab3d4' }}> ×{item.qty}</span>}
              {item.notes && <span style={{ color: '#5a5550' }}> — {item.notes}</span>}
            </span>
            {isGM && (
              <button onClick={() => removeCargo(idx)} style={{ background: 'none', border: 'none', color: '#3a3a3a', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f5a89a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>×</button>
            )}
          </div>
        ))}
        {showAddCargo && (
          <div style={{ marginTop: '4px', padding: '6px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <input value={cargoName} onChange={e => setCargoName(e.target.value)} placeholder="Item name"
                autoFocus style={{ flex: 1, padding: '3px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif' }} />
              <input value={cargoQty} onChange={e => setCargoQty(e.target.value)} type="number" min="1" placeholder="Qty"
                style={{ width: '40px', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '12px', textAlign: 'center' }} />
            </div>
            <input value={cargoNotes} onChange={e => setCargoNotes(e.target.value)} placeholder="Notes (e.g. 300 rounds each)"
              style={{ width: '100%', padding: '3px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', marginBottom: '4px' }} />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={addCargo} style={{ flex: 1, padding: '4px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '2px', color: '#7fc458', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Add</button>
              <button onClick={() => setShowAddCargo(false)} style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Operator Notes */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={lbl}>Operator Notes</span>
          {isGM && <button onClick={() => { setEditing(!editing); setEditNotes(v.notes) }} style={{ marginLeft: 'auto', fontSize: '10px', padding: '0 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer', lineHeight: 1.4 }}>{editing ? 'Cancel' : 'Edit'}</button>}
        </div>
        {editing ? (
          <div>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={4}
              style={{ width: '100%', padding: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box' }} />
            <button onClick={() => { update({ notes: editNotes }); setEditing(false) }}
              style={{ marginTop: '4px', padding: '4px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '2px', color: '#7fc458', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Save</button>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#cce0f5', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{v.notes || 'No notes.'}</div>
        )}
      </div>
    </div>
  )
}
