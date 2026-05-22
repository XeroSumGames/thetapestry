'use client'
// LootModal - GM-Tools "Loot Distribution" dialog. Extracted from page.tsx
// verbatim (table re-arch Step 2). Presentational + self-contained submit
// handler; loot item/recipient state stays in page.tsx and is threaded as
// props (migrates into useGmTools later). Behavior unchanged: build an item
// list, pick recipient PCs, merge items into each PC's inventory, log a
// roll_log row, broadcast inventory_transfer, then onGiven() (reload + feed).

import { OUTCOME } from '../../../../../lib/roll-outcomes'

interface LootItem { name: string; qty: number; notes: string }

interface LootModalProps {
  open: boolean
  onClose: () => void
  entries: any[]
  lootItems: LootItem[]
  setLootItems: React.Dispatch<React.SetStateAction<LootItem[]>>
  lootRecipients: Set<string>
  setLootRecipients: React.Dispatch<React.SetStateAction<Set<string>>>
  supabase: any
  campaignId: string
  userId: string | null
  channelRef: { current: any }
  onGiven: () => void | Promise<unknown>
}

export function LootModal({
  open, onClose, entries, lootItems, setLootItems, lootRecipients, setLootRecipients,
  supabase, campaignId, userId, channelRef, onGiven,
}: LootModalProps) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '13px', color: '#EF9F27', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Loot Distribution</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px' }}>Give Items to Players</div>

        {/* Item list */}
        <div style={{ marginBottom: '8px', maxHeight: '150px', overflowY: 'auto' }}>
          {lootItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 6px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '2px', fontSize: '13px' }}>
              <span style={{ flex: 1, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
                {item.name}{item.qty > 1 && <span style={{ color: '#7ab3d4' }}> ×{item.qty}</span>}
                {item.notes && <span style={{ color: '#5a5550', fontSize: '13px' }}> - {item.notes}</span>}
              </span>
              <button onClick={() => setLootItems(prev => prev.filter((_, i) => i !== idx))}
                style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
            </div>
          ))}
        </div>

        {/* Add item */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
          <input id="loot-item-name" placeholder="Item name" style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }} />
          <input id="loot-item-qty" type="number" min="1" defaultValue="1" placeholder="Qty" style={{ width: '45px', padding: '5px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', textAlign: 'center' }} />
          <button onClick={() => {
            const nameEl = document.getElementById('loot-item-name') as HTMLInputElement
            const qtyEl = document.getElementById('loot-item-qty') as HTMLInputElement
            if (!nameEl?.value.trim()) return
            setLootItems(prev => [...prev, { name: nameEl.value.trim(), qty: parseInt(qtyEl?.value, 10) || 1, notes: '' }])
            nameEl.value = ''
            qtyEl.value = '1'
            nameEl.focus()
          }}
            style={{ padding: '5px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>+</button>
        </div>

        {/* Recipients */}
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Give to</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
          {entries.map(e => (
            <label key={e.character.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: lootRecipients.has(e.character.id) ? '#1a2e10' : '#111', border: `1px solid ${lootRecipients.has(e.character.id) ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', cursor: 'pointer', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
              <input type="checkbox" checked={lootRecipients.has(e.character.id)} onChange={() => {
                setLootRecipients(prev => { const n = new Set(prev); n.has(e.character.id) ? n.delete(e.character.id) : n.add(e.character.id); return n })
              }} style={{ accentColor: '#7fc458' }} />
              {e.character.name}
            </label>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
          <button onClick={async () => {
            if (lootItems.length === 0 || lootRecipients.size === 0) return
            // Give each item to each selected character
            for (const charId of lootRecipients) {
              const entry = entries.find(e => e.character.id === charId)
              if (!entry) continue
              const charData = entry.character.data ?? {}
              const inv: any[] = charData.inventory ?? []
              let newInv = [...inv]
              for (const item of lootItems) {
                const existing = newInv.find(i => i.name === item.name)
                if (existing) {
                  newInv = newInv.map(i => i === existing ? { ...i, qty: i.qty + item.qty } : i)
                } else {
                  newInv.push({ name: item.name, enc: 0, rarity: 'Common', notes: item.notes, qty: item.qty, custom: true })
                }
              }
              await supabase.from('characters').update({ data: { ...charData, inventory: newInv } }).eq('id', charId)
            }
            // Log to feed
            const names = entries.filter(e => lootRecipients.has(e.character.id)).map(e => e.character.name).join(', ')
            const itemList = lootItems.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')
            await supabase.from('roll_log').insert({
              campaign_id: campaignId, user_id: userId, character_name: 'System',
              label: `🎒 Loot: ${itemList} → ${names}`,
              die1: 0, die2: 0, amod: 0, smod: 0, cmod: 0, total: 0, outcome: OUTCOME.loot,
            })
            channelRef.current?.send({ type: 'broadcast', event: 'inventory_transfer', payload: {} })
            await onGiven()
            onClose()
          }} disabled={lootItems.length === 0 || lootRecipients.size === 0}
            style={{ flex: 2, padding: '10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: lootItems.length === 0 || lootRecipients.size === 0 ? 'not-allowed' : 'pointer', opacity: lootItems.length === 0 || lootRecipients.size === 0 ? 0.5 : 1 }}>
            Give {lootItems.length} item{lootItems.length !== 1 ? 's' : ''} to {lootRecipients.size} player{lootRecipients.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
