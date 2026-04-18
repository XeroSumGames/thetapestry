'use client'
import { useState } from 'react'
import { EQUIPMENT, EquipmentItem } from '../lib/xse-schema'
import { getWeaponByName } from '../lib/weapons'

export interface InventoryItem {
  name: string
  enc: number
  rarity: string
  notes: string
  qty: number
  custom: boolean
}

interface Props {
  inventory: InventoryItem[]
  weaponPrimaryName: string
  weaponSecondaryName: string
  phyMod: number
  canEdit: boolean
  onUpdate: (inventory: InventoryItem[]) => void
  onClose: () => void
  // Loot/trade
  otherCharacters?: { id: string; name: string }[]
  onGiveTo?: (item: InventoryItem, targetCharId: string) => void
}

const RARITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Common: { color: '#d4cfc9', bg: '#242424', border: '#3a3a3a' },
  Uncommon: { color: '#7fc458', bg: '#1a2e10', border: '#2d5a1b' },
  Rare: { color: '#EF9F27', bg: '#2a2010', border: '#5a4a1b' },
}

export default function InventoryPanel({ inventory, weaponPrimaryName, weaponSecondaryName, phyMod, canEdit, onUpdate, onClose, otherCharacters, onGiveTo }: Props) {
  const [search, setSearch] = useState('')
  const [showCatalog, setShowCatalog] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customEnc, setCustomEnc] = useState('0')
  const [customNotes, setCustomNotes] = useState('')
  const [givingItem, setGivingItem] = useState<InventoryItem | null>(null)

  // Encumbrance calculation
  const wp = getWeaponByName(weaponPrimaryName)
  const ws = getWeaponByName(weaponSecondaryName)
  const weaponEnc = (wp?.enc ?? 0) + (ws?.enc ?? 0)
  const invEnc = inventory.reduce((sum, item) => sum + (item.enc ?? 0) * (item.qty ?? 1), 0)
  const hasBackpack = inventory.some(i => i.name === 'Backpack' || i.name === 'Military Backpack')
  const backpackBonus = hasBackpack ? 2 : 0
  const encLimit = 6 + phyMod + backpackBonus
  const currentEnc = weaponEnc + invEnc
  const overloaded = currentEnc > encLimit

  function addItem(item: EquipmentItem) {
    const existing = inventory.find(i => i.name === item.name && !i.custom)
    if (existing) {
      onUpdate(inventory.map(i => i === existing ? { ...i, qty: i.qty + 1 } : i))
    } else {
      onUpdate([...inventory, { name: item.name, enc: item.enc, rarity: item.rarity, notes: item.notes, qty: 1, custom: false }])
    }
    setShowCatalog(false)
    setSearch('')
  }

  function addCustomItem() {
    if (!customName.trim()) return
    const enc = Math.max(0, parseFloat(customEnc) || 0)
    onUpdate([...inventory, { name: customName.trim(), enc, rarity: 'Common', notes: customNotes.trim(), qty: 1, custom: true }])
    setCustomName('')
    setCustomEnc('0')
    setCustomNotes('')
    setShowCustom(false)
  }

  function removeItem(idx: number) {
    const item = inventory[idx]
    if (item.qty > 1) {
      onUpdate(inventory.map((i, j) => j === idx ? { ...i, qty: i.qty - 1 } : i))
    } else {
      onUpdate(inventory.filter((_, j) => j !== idx))
    }
  }

  function giveItem(idx: number) {
    setGivingItem(inventory[idx])
  }

  function confirmGive(targetCharId: string) {
    if (!givingItem || !onGiveTo) return
    onGiveTo(givingItem, targetCharId)
    // Remove one from our inventory
    const idx = inventory.findIndex(i => i.name === givingItem.name)
    if (idx >= 0) removeItem(idx)
    setGivingItem(null)
  }

  const filteredCatalog = EQUIPMENT.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.notes.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '460px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>Inventory</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>Equipment</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Encumbrance</div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', color: overloaded ? '#c0392b' : '#7fc458' }}>
              {currentEnc}/{encLimit}
              {overloaded && <span style={{ fontSize: '11px', marginLeft: '6px', color: '#c0392b' }}>OVERLOADED</span>}
            </div>
            {backpackBonus > 0 && <div style={{ fontSize: '10px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>+{backpackBonus} from backpack</div>}
          </div>
        </div>

        {/* Enc breakdown */}
        <div style={{ fontSize: '11px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', display: 'flex', gap: '12px' }}>
          <span>Weapons: {weaponEnc}</span>
          <span>Gear: {invEnc}</span>
          <span>Limit: 6 + PHY({phyMod}){backpackBonus > 0 ? ` + Pack(${backpackBonus})` : ''} = {encLimit}</span>
        </div>

        {/* Item list */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
          {inventory.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
              No items
            </div>
          ) : (
            inventory.map((item, idx) => {
              const rc = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.Common
              return (
                <div key={`${item.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '3px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{item.name}</span>
                      {item.qty > 1 && <span style={{ fontSize: '11px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif' }}>×{item.qty}</span>}
                      {item.custom && <span style={{ fontSize: '9px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>custom</span>}
                    </div>
                    {item.notes && <div style={{ fontSize: '11px', color: '#cce0f5', lineHeight: 1.3 }}>{item.notes}</div>}
                  </div>
                  <span style={{ fontSize: '11px', color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: '2px', padding: '0 4px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', flexShrink: 0 }}>{item.rarity}</span>
                  <span style={{ fontSize: '11px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', flexShrink: 0, minWidth: '24px', textAlign: 'center' }}>{item.enc > 0 ? `${item.enc}` : '—'}</span>
                  {canEdit && onGiveTo && otherCharacters && otherCharacters.length > 0 && (
                    <button onClick={() => giveItem(idx)} style={{ fontSize: '10px', padding: '0 4px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Give</button>
                  )}
                  {canEdit && (
                    <button onClick={() => removeItem(idx)} style={{ fontSize: '11px', padding: '0 3px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer', lineHeight: 1.2 }}>×</button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Give modal */}
        {givingItem && (
          <div style={{ padding: '8px', background: '#111', border: '1px solid #2e2e5a', borderRadius: '3px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', marginBottom: '4px' }}>Give {givingItem.name} to:</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {(otherCharacters ?? []).map(ch => (
                <button key={ch.id} onClick={() => confirmGive(ch.id)}
                  style={{ padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {ch.name}
                </button>
              ))}
              <button onClick={() => setGivingItem(null)}
                style={{ padding: '4px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {canEdit && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            <button onClick={() => { setShowCatalog(!showCatalog); setShowCustom(false) }}
              style={{ flex: 1, padding: '6px', background: showCatalog ? '#1a2e10' : '#242424', border: `1px solid ${showCatalog ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: showCatalog ? '#7fc458' : '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer' }}>
              + From Catalog
            </button>
            <button onClick={() => { setShowCustom(!showCustom); setShowCatalog(false) }}
              style={{ flex: 1, padding: '6px', background: showCustom ? '#2a2010' : '#242424', border: `1px solid ${showCustom ? '#5a4a1b' : '#3a3a3a'}`, borderRadius: '3px', color: showCustom ? '#EF9F27' : '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer' }}>
              + Custom Item
            </button>
          </div>
        )}

        {/* Catalog picker */}
        {showCatalog && (
          <div style={{ marginBottom: '8px', maxHeight: '200px', display: 'flex', flexDirection: 'column' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equipment..."
              autoFocus
              style={{ width: '100%', padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', boxSizing: 'border-box', marginBottom: '4px' }} />
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredCatalog.map(item => {
                const rc = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.Common
                return (
                  <div key={item.name} onClick={() => addItem(item)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', cursor: 'pointer', borderRadius: '2px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ flex: 1, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif' }}>{item.name}</span>
                    <span style={{ fontSize: '10px', color: rc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{item.rarity}</span>
                    <span style={{ fontSize: '11px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', minWidth: '20px', textAlign: 'right' }}>{item.enc > 0 ? item.enc : '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Custom item form */}
        {showCustom && (
          <div style={{ marginBottom: '8px', padding: '8px', background: '#111', border: '1px solid #5a4a1b', borderRadius: '3px' }}>
            <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Item name"
              autoFocus
              style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', boxSizing: 'border-box', marginBottom: '4px' }} />
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <div style={{ width: '60px' }}>
                <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>ENC</div>
                <input value={customEnc} onChange={e => setCustomEnc(e.target.value)} type="number" min="0" max="5" step="0.5"
                  style={{ width: '100%', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>Notes</div>
                <input value={customNotes} onChange={e => setCustomNotes(e.target.value)} placeholder="Effect or description"
                  style={{ width: '100%', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={addCustomItem} disabled={!customName.trim()}
              style={{ width: '100%', padding: '5px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: customName.trim() ? 'pointer' : 'not-allowed', opacity: customName.trim() ? 1 : 0.5 }}>
              Add Custom Item
            </button>
          </div>
        )}

        <button onClick={onClose}
          style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}
