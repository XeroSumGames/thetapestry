'use client'
import { useState } from 'react'
import { EQUIPMENT, EquipmentItem } from '../lib/xse-schema'
import { ALL_WEAPONS, getWeaponByName } from '../lib/weapons'
import { computeEncumbrance, BASE_ENC_LIMIT } from '../lib/encumbrance'

// Combined inventory catalog — SRD equipment + all weapons.
// Weapons are normalized into the EquipmentItem shape (name/enc/rarity/notes)
// so they can be held in inventory alongside gear. Equipping a held weapon
// (swapping it to Primary/Secondary) is done separately via the character sheet.
const CATEGORY_LABEL: Record<string, string> = {
  melee: 'Melee weapon',
  ranged: 'Ranged weapon',
  explosive: 'Explosive',
  heavy: 'Heavy weapon',
}
const WEAPON_CATALOG: EquipmentItem[] = ALL_WEAPONS.map(w => ({
  name: w.name,
  rarity: w.rarity as any,
  enc: w.enc,
  notes: `${CATEGORY_LABEL[w.category] ?? 'Weapon'} · ${w.range} · ${w.damage}${w.rpPercent !== 50 ? ` (${w.rpPercent}% RP)` : ''}`,
}))
const COMBINED_CATALOG: EquipmentItem[] = [...EQUIPMENT, ...WEAPON_CATALOG].sort((a, b) => a.name.localeCompare(b.name))
const WEAPON_NAMES = new Set(ALL_WEAPONS.map(w => w.name))

export interface InventoryItem {
  name: string
  enc: number
  rarity: string
  notes: string
  qty: number
  custom: boolean
}
// Re-export the shared shape from lib/inventory for non-component
// callers. The interface above remains for back-compat with existing
// imports of `InventoryItem` from this file.
export type { InventoryItem as SharedInventoryItem } from '../lib/inventory'

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
  onGiveTo?: (item: InventoryItem, targetCharId: string, qty: number) => void
  // Optional NPC recipients (community quartermasters, merchants, etc.).
  // Routed to onGiveToNpc to keep the PC + NPC write paths separate at
  // the parent — different tables (characters vs. campaign_npcs) and
  // different broadcast events.
  otherNpcs?: { id: string; name: string }[]
  onGiveToNpc?: (item: InventoryItem, targetNpcId: string, qty: number) => void
  // Optional community recipients (shared stockpile deposits). Each
  // entry is a community the giver belongs to; clicking deposits the
  // item into community_stockpile_items.
  otherCommunities?: { id: string; name: string }[]
  onGiveToCommunity?: (item: InventoryItem, targetCommunityId: string, qty: number) => void
}

const RARITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Common: { color: '#d4cfc9', bg: '#242424', border: '#3a3a3a' },
  Uncommon: { color: '#7fc458', bg: '#1a2e10', border: '#2d5a1b' },
  Rare: { color: '#EF9F27', bg: '#2a2010', border: '#5a4a1b' },
}

export default function InventoryPanel({ inventory, weaponPrimaryName, weaponSecondaryName, phyMod, canEdit, onUpdate, onClose, otherCharacters, onGiveTo, otherNpcs, onGiveToNpc, otherCommunities, onGiveToCommunity }: Props) {
  const [search, setSearch] = useState('')
  const [showCatalog, setShowCatalog] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customEnc, setCustomEnc] = useState('0')
  const [customNotes, setCustomNotes] = useState('')
  const [givingItem, setGivingItem] = useState<InventoryItem | null>(null)
  const [giveQty, setGiveQty] = useState(1)

  const { weaponEnc, invEnc, currentEnc, encLimit, backpackBonus, overloaded } =
    computeEncumbrance(inventory, weaponPrimaryName, weaponSecondaryName, phyMod)

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
    const item = inventory[idx]
    setGivingItem(item)
    // Single-use explosives (Grenade, Molotov, Shiv-Grenade, Flash-Bang,
    // RPG round) default to qty 1 — each one is a discrete consumable
    // and "give the whole pile" is rarely what the player wants. For
    // every other stackable item, default = full stack (give-all-of-X
    // is the common case). User can override either way via the +/-
    // buttons or the [All] shortcut.
    const weapon = getWeaponByName(item.name)
    const isSingleUse = weapon?.category === 'explosive'
    setGiveQty(isSingleUse ? 1 : item.qty)
  }

  function confirmGive(target: { id: string; kind: 'pc' | 'npc' | 'community' }) {
    if (!givingItem) return
    if (target.kind === 'pc' && !onGiveTo) return
    if (target.kind === 'npc' && !onGiveToNpc) return
    if (target.kind === 'community' && !onGiveToCommunity) return
    const qty = Math.max(1, Math.min(giveQty, givingItem.qty))
    if (target.kind === 'pc') onGiveTo!(givingItem, target.id, qty)
    else if (target.kind === 'npc') onGiveToNpc!(givingItem, target.id, qty)
    else onGiveToCommunity!(givingItem, target.id, qty)
    // Decrement sender by exactly the chosen qty (drop the row if all gone).
    const idx = inventory.findIndex(i => i === givingItem || (i.name === givingItem.name && i.custom === givingItem.custom))
    if (idx >= 0) {
      const remaining = inventory[idx].qty - qty
      if (remaining <= 0) {
        onUpdate(inventory.filter((_, j) => j !== idx))
      } else {
        onUpdate(inventory.map((i, j) => j === idx ? { ...i, qty: remaining } : i))
      }
    }
    setGivingItem(null)
  }

  const filteredCatalog = COMBINED_CATALOG.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.notes.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '460px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>Inventory</div>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>Equipment</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Encumbrance</div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', color: overloaded ? '#c0392b' : '#7fc458' }}>
              {currentEnc}/{encLimit}
              {overloaded && <span style={{ fontSize: '13px', marginLeft: '6px', color: '#c0392b' }}>OVERLOADED</span>}
            </div>
            {backpackBonus > 0 && <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>+{backpackBonus} from backpack</div>}
          </div>
        </div>

        {/* Enc breakdown */}
        <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', display: 'flex', gap: '12px' }}>
          <span>Weapons: {weaponEnc}</span>
          <span>Gear: {invEnc}</span>
          <span>Limit: {BASE_ENC_LIMIT} + PHY({phyMod}){backpackBonus > 0 ? ` + Pack(${backpackBonus})` : ''} = {encLimit}</span>
        </div>

        {/* Item list */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
          {inventory.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
              No items
            </div>
          ) : (
            inventory.map((item, idx) => {
              const rc = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.Common
              return (
                <div key={`${item.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '3px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{item.name}</span>
                      {item.qty > 1 && <span style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>×{item.qty}</span>}
                      {item.custom && <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>custom</span>}
                    </div>
                    {item.notes && <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.3 }}>{item.notes}</div>}
                  </div>
                  <span style={{ fontSize: '13px', color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: '2px', padding: '0 4px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', flexShrink: 0 }}>{item.rarity}</span>
                  <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', flexShrink: 0, minWidth: '24px', textAlign: 'center' }}>{item.enc > 0 ? `${item.enc}` : '—'}</span>
                  {canEdit && onGiveTo && otherCharacters && otherCharacters.length > 0 && (
                    <button onClick={() => giveItem(idx)} style={{ fontSize: '13px', padding: '0 4px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Give</button>
                  )}
                  {canEdit && (
                    <button onClick={() => removeItem(idx)} style={{ fontSize: '13px', padding: '0 3px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', lineHeight: 1.2 }}>×</button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Give modal */}
        {givingItem && (
          <div style={{ padding: '8px', background: '#111', border: '1px solid #2e2e5a', borderRadius: '3px', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', marginBottom: '6px' }}>Give {givingItem.name}</div>
            {givingItem.qty > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>Qty:</span>
                <button onClick={() => setGiveQty(q => Math.max(1, q - 1))}
                  style={{ width: '22px', height: '22px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', lineHeight: 1 }}>−</button>
                <input type="number" min={1} max={givingItem.qty} value={giveQty}
                  onChange={e => setGiveQty(Math.max(1, Math.min(givingItem.qty, parseInt(e.target.value) || 1)))}
                  style={{ width: '50px', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
                <button onClick={() => setGiveQty(q => Math.min(givingItem.qty, q + 1))}
                  style={{ width: '22px', height: '22px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', lineHeight: 1 }}>+</button>
                <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>of {givingItem.qty}</span>
                <button onClick={() => setGiveQty(givingItem.qty)}
                  style={{ marginLeft: 'auto', padding: '2px 6px', background: 'transparent', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>All</button>
              </div>
            )}
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', marginBottom: '4px' }}>To:</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {/* PC recipients — blue trim */}
              {(otherCharacters ?? []).map(ch => (
                <button key={`pc:${ch.id}`} onClick={() => confirmGive({ id: ch.id, kind: 'pc' })}
                  title="Give to player character"
                  style={{ padding: '4px 8px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  👤 {ch.name}
                </button>
              ))}
              {/* NPC recipients — orange trim, distinct from PCs */}
              {onGiveToNpc && (otherNpcs ?? []).map(n => (
                <button key={`npc:${n.id}`} onClick={() => confirmGive({ id: n.id, kind: 'npc' })}
                  title="Give to non-player character"
                  style={{ padding: '4px 8px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  🎭 {n.name}
                </button>
              ))}
              {/* Community stockpile recipients — purple trim. Lists
                  every community the giver is a member of. */}
              {onGiveToCommunity && (otherCommunities ?? []).map(c => (
                <button key={`community:${c.id}`} onClick={() => confirmGive({ id: c.id, kind: 'community' })}
                  title="Deposit to community stockpile"
                  style={{ padding: '4px 8px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px', color: '#d48bd4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  🏘 {c.name}
                </button>
              ))}
              <button onClick={() => setGivingItem(null)}
                style={{ padding: '4px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {canEdit && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            <button onClick={() => { setShowCatalog(!showCatalog); setShowCustom(false) }}
              style={{ flex: 1, padding: '6px', background: showCatalog ? '#1a2e10' : '#242424', border: `1px solid ${showCatalog ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: showCatalog ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer' }}>
              + From Catalog
            </button>
            <button onClick={() => { setShowCustom(!showCustom); setShowCatalog(false) }}
              style={{ flex: 1, padding: '6px', background: showCustom ? '#2a2010' : '#242424', border: `1px solid ${showCustom ? '#5a4a1b' : '#3a3a3a'}`, borderRadius: '3px', color: showCustom ? '#EF9F27' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer' }}>
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
                const isWeapon = WEAPON_NAMES.has(item.name)
                return (
                  <div key={item.name} onClick={() => addItem(item)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', cursor: 'pointer', borderRadius: '2px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ flex: 1, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
                      {item.name}
                      {item.notes && <span style={{ fontSize: '13px', color: '#5a5550', marginLeft: '6px' }}>— {item.notes}</span>}
                    </span>
                    {isWeapon && <span style={{ fontSize: '13px', color: '#f5a89a', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', padding: '0 3px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>WPN</span>}
                    <span style={{ fontSize: '13px', color: rc.color, fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{item.rarity}</span>
                    <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', minWidth: '20px', textAlign: 'right' }}>{item.enc > 0 ? item.enc : '—'}</span>
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
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>ENC</div>
                <input value={customEnc} onChange={e => setCustomEnc(e.target.value)} type="number" min="0" max="5" step="0.5"
                  style={{ width: '100%', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>Notes</div>
                <input value={customNotes} onChange={e => setCustomNotes(e.target.value)} placeholder="Effect or description"
                  style={{ width: '100%', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>
            <button onClick={addCustomItem} disabled={!customName.trim()}
              style={{ width: '100%', padding: '5px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: customName.trim() ? 'pointer' : 'not-allowed', opacity: customName.trim() ? 1 : 0.5 }}>
              Add Custom Item
            </button>
          </div>
        )}

        <button onClick={onClose}
          style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}
