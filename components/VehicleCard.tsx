'use client'
import { openPopout } from '../lib/popout'
import { type InventoryItem, normalizeInventoryItem } from '../lib/inventory'

// VehicleCargo unified to InventoryItem so PCs / NPCs / Vehicles all
// share one shape. Older cargo rows in DB lacked .enc / .rarity / .custom;
// normalizeInventoryItem fills those defaults at read time.
export type VehicleCargo = InventoryItem

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
  floorplan_url?: string | null
  cargo: VehicleCargo[]
  // Currently-assigned driver (auto-rolls Driving check). Either a PC
  // character id or a campaign NPC id — see crewMemberKind below.
  driver_character_id?: string | null
  driver_kind?: 'pc' | 'npc' | null
  // Currently-assigned brewer (auto-rolls Mechanic*/Tinkerer brew check).
  // Only meaningful when has_still is true.
  brewer_character_id?: string | null
  brewer_kind?: 'pc' | 'npc' | null
  // Whether this vehicle has an integrated still that produces fuel via
  // a brew check. Minnie has one; almost no other vehicle does.
  has_still?: boolean
  // Weapons fitted to the vehicle (sniper nest, mounted MG, etc.).
  // Each entry pairs with a shooter so the Attack button on the popout
  // auto-pulls AMOD (DEX) + SMOD (Ranged Combat) from that PC/NPC.
  // Weapon stats (damage, range, RP%) are looked up by name from
  // lib/weapons.ts at attack time so seed data stays light.
  mounted_weapons?: {
    name: string
    notes?: string
    shooter_character_id?: string | null
    shooter_kind?: 'pc' | 'npc' | null
  }[]
}

interface Props {
  vehicle: Vehicle
  campaignId: string
  canEdit: boolean
  onUpdate: (vehicle: Vehicle) => void
  // Optional — when omitted, the close ✕ button hides. Used by surfaces
  // that render the card inline (no separate close affordance needed).
  onClose?: () => void
}

export default function VehicleCard({ vehicle: v, campaignId, canEdit, onUpdate, onClose }: Props) {
  // Slim summary card — the full data (cargo, operator notes, driver/
  // brewer dropdowns, Driving + Brew checks) lives on the popout. This
  // card stays light enough to sit in the right-side Assets panel
  // without dominating it.

  function update(patch: Partial<Vehicle>) {
    onUpdate({ ...v, ...patch })
  }

  const wpPct = v.wp_max > 0 ? v.wp_current / v.wp_max : 1
  const wpColor = wpPct > 0.5 ? '#7fc458' : wpPct > 0.25 ? '#EF9F27' : '#c0392b'
  const fuelPct = v.fuel_max > 0 ? v.fuel_current / v.fuel_max : 0

  // Cargo encumbrance — sum of (item.enc × qty) across cargo, normalized
  // so legacy rows without .enc treat as 0. Compared to v.encumbrance
  // (the vehicle's cap, derived from size × 20 per CRB §10).
  const cargoTotalEnc = (v.cargo ?? []).reduce((sum, raw) => {
    const item = normalizeInventoryItem(raw)
    return sum + item.enc * item.qty
  }, 0)
  const cargoOverloaded = cargoTotalEnc > v.encumbrance

  const lbl: React.CSSProperties = { fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }
  const val: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #EF9F27', borderRadius: '4px', padding: '10px 12px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {v.image_url && (
          <img src={v.image_url} alt="" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3a3a3a' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>{v.name}</div>
          <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{v.type} · {v.rarity}</div>
          {v.three_words && <div style={{ fontSize: '13px', color: '#d4cfc9', fontStyle: 'italic' }}>{v.three_words}</div>}
        </div>
        <button onClick={() => openPopout(`/vehicle?c=${campaignId}&v=${v.id}`, `vehicle-${v.id}`, { w: 900, h: 700 })} title="Pop out"
          style={{ background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>Popout</button>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5a5550', fontSize: '16px', cursor: 'pointer', padding: '0 4px' }}>✕</button>
        )}
      </div>

      {/* Stats row — Enc shows current cargo / cap so the player can
          see at a glance whether the vehicle is loaded down. Red value
          when over cap. */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {[
          { label: 'Size', value: v.size, color: undefined as string | undefined },
          { label: 'Speed', value: v.speed, color: undefined },
          { label: 'Pass', value: v.passengers, color: undefined },
          { label: 'Enc', value: `${cargoTotalEnc} / ${v.encumbrance}`, color: cargoOverloaded ? '#c0392b' : undefined },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '3px 0', textAlign: 'center' }}
            title={s.label === 'Enc' ? (cargoOverloaded ? `OVERLOADED — cargo (${cargoTotalEnc}) exceeds vehicle capacity (${v.encumbrance})` : `Cargo enc total / vehicle capacity`) : undefined}>
            <div style={lbl}>{s.label}</div>
            <div style={{ ...val, color: s.color ?? val.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Range */}
      <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>
        Range: <span style={{ color: '#7ab3d4', fontWeight: 700 }}>{v.range}</span>
      </div>

      {/* WP Bar */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={lbl}>Wound Points</span>
          <span style={{ fontSize: '13px', color: wpColor, fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>{v.wp_current}/{v.wp_max}</span>
          {canEdit && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
              <button onClick={() => update({ wp_current: Math.max(0, v.wp_current - 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>-</button>
              <button onClick={() => update({ wp_current: Math.min(v.wp_max, v.wp_current + 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>+</button>
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
          <span style={{ fontSize: '13px', color: v.stress >= 4 ? '#c0392b' : v.stress >= 2 ? '#EF9F27' : '#7fc458', fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>{v.stress}/5</span>
          {canEdit && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
              <button onClick={() => update({ stress: Math.max(0, v.stress - 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>-</button>
              <button onClick={() => update({ stress: Math.min(5, v.stress + 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>+</button>
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
          <span style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>{v.fuel_current}/{v.fuel_max} days</span>
          {canEdit && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
              <button onClick={() => update({ fuel_current: Math.max(0, v.fuel_current - 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>-</button>
              <button onClick={() => update({ fuel_current: Math.min(v.fuel_max, v.fuel_current + 1) })} style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', fontSize: '13px', cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>+</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Array.from({ length: v.fuel_max }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: '8px', borderRadius: '2px', background: i < v.fuel_current ? '#EF9F27' : '#242424', border: '1px solid #3a3a3a' }} />
          ))}
        </div>
      </div>

      {/* Cargo, operator notes, driver/brewer, and the Driving / Brew
          checks all live on the popout — keeps this card light. */}
    </div>
  )
}
