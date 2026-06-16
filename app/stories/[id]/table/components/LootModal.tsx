'use client'
// LootModal - GM-Tools "Loot Distribution" dialog. Extracted from page.tsx
// verbatim (table re-arch Step 2). Presentational + self-contained submit
// handler; loot item/recipient state stays in page.tsx and is threaded as
// props (migrates into useGmTools later). Behavior unchanged: build an item
// list, pick recipient PCs, merge items into each PC's inventory, log a
// roll_log row, broadcast inventory_transfer, then onGiven() (reload + feed).

import { useState, useRef, useEffect } from 'react'
import { OUTCOME } from '../../../../../lib/roll-outcomes'
import { insertRollLog } from '../../../../../lib/data/roll-log'
import { EQUIPMENT, ARMOR, MELEE_WEAPONS, RANGED_WEAPONS, RATIONS } from '../../../../../lib/xse-schema'

interface LootItem { name: string; qty: number; notes: string }

interface CatalogItem { name: string; enc?: number; rarity?: string }

const LOOT_CATALOG: CatalogItem[] = [
  ...(MELEE_WEAPONS as any[]).map(w => ({ name: w.name, enc: w.enc ?? 1, rarity: w.rarity ?? 'Common' })),
  ...(RANGED_WEAPONS as any[]).map(w => ({ name: w.name, enc: w.enc ?? 1, rarity: w.rarity ?? 'Common' })),
  ...(EQUIPMENT as any[]).map(e => ({ name: e.name, enc: e.enc ?? 0, rarity: e.rarity ?? 'Common' })),
  ...(ARMOR as any[]).map(a => ({ name: a.name, enc: a.enc ?? 1, rarity: a.rarity ?? 'Common' })),
  ...(RATIONS as any[]).map(r => ({ name: r.name, enc: 0, rarity: r.rarity ?? 'Common' })),
]

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
  campaignItems?: string[]
}

export function LootModal({
  open, onClose, entries, lootItems, setLootItems, lootRecipients, setLootRecipients,
  supabase, campaignId, userId, channelRef, onGiven, campaignItems,
}: LootModalProps) {
  const [itemName, setItemName] = useState('')
  const [itemQty, setItemQty] = useState(1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const suggestions = (() => {
    const q = itemName.trim().toLowerCase()
    if (!q) return []
    const catalogMatches = LOOT_CATALOG.filter(c => c.name.toLowerCase().includes(q))
    catalogMatches.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
      return aStarts - bStarts || a.name.localeCompare(b.name)
    })
    const catalogNames = new Set(LOOT_CATALOG.map(c => c.name.toLowerCase()))
    const extraMatches: CatalogItem[] = (campaignItems ?? [])
      .filter(n => n.toLowerCase().includes(q) && !catalogNames.has(n.toLowerCase()))
      .filter((n, i, arr) => arr.findIndex(x => x.toLowerCase() === n.toLowerCase()) === i)
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1
        const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1
        return aStarts - bStarts || a.localeCompare(b)
      })
      .map(n => ({ name: n, rarity: 'Custom' }))
    return [...catalogMatches, ...extraMatches].slice(0, 10)
  })()

  function addItem(name: string, qty: number) {
    const trimmed = name.trim()
    if (!trimmed) return
    const catalog = LOOT_CATALOG.find(c => c.name.toLowerCase() === trimmed.toLowerCase())
    setLootItems(prev => [...prev, {
      name: catalog?.name ?? trimmed,
      qty,
      notes: '',
    }])
    setItemName('')
    setItemQty(1)
    setShowSuggestions(false)
    nameInputRef.current?.focus()
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        nameInputRef.current && !nameInputRef.current.contains(e.target as Node) &&
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)
      ) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
                {item.name}{item.qty > 1 && <span style={{ color: '#7ab3d4' }}> x{item.qty}</span>}
                {item.notes && <span style={{ color: '#5a5550', fontSize: '13px' }}> - {item.notes}</span>}
              </span>
              <button onClick={() => setLootItems(prev => prev.filter((_, i) => i !== idx))}
                style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>x</button>
            </div>
          ))}
        </div>

        {/* Add item - autocomplete */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              ref={nameInputRef}
              value={itemName}
              onChange={e => { setItemName(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(itemName, itemQty) }}
              placeholder="Search equipment..."
              style={{ flex: 1, padding: '5px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none' }}
            />
            <input
              type="number" min="1" value={itemQty}
              onChange={e => setItemQty(parseInt(e.target.value, 10) || 1)}
              style={{ width: '45px', padding: '5px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', textAlign: 'center', outline: 'none' }}
            />
            <button onClick={() => addItem(itemName, itemQty)}
              style={{ padding: '5px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>+</button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div ref={suggestionsRef} style={{ position: 'absolute', top: '100%', left: 0, right: '56px', background: '#1e1e1e', border: '1px solid #3a3a3a', borderRadius: '3px', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
              {suggestions.map(s => (
                <div key={s.name}
                  onMouseDown={e => { e.preventDefault(); addItem(s.name, itemQty) }}
                  style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', color: '#f5f2ee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span>{s.name}</span>
                  <span style={{ fontSize: '13px', color: '#5a5550' }}>{s.rarity}</span>
                </div>
              ))}
            </div>
          )}
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
            const validItems = lootItems.filter(i => typeof i.name === 'string' && i.name.trim().length > 0)
            if (validItems.length === 0) return
            for (const charId of lootRecipients) {
              const entry = entries.find(e => e.character.id === charId)
              if (!entry) continue
              const charData = entry.character.data ?? {}
              const inv: any[] = charData.inventory ?? []
              let newInv = [...inv]
              for (const item of validItems) {
                const catalog = LOOT_CATALOG.find(c => c.name.toLowerCase() === item.name.toLowerCase())
                const existing = newInv.find(i => i.name === item.name)
                if (existing) {
                  newInv = newInv.map(i => i === existing ? { ...i, qty: i.qty + item.qty } : i)
                } else {
                  newInv.push({
                    name: catalog?.name ?? item.name,
                    enc: catalog?.enc ?? 0,
                    rarity: catalog?.rarity ?? 'Common',
                    notes: item.notes,
                    qty: item.qty,
                    ...(catalog ? {} : { custom: true }),
                  })
                }
              }
              await supabase.from('characters').update({ data: { ...charData, inventory: newInv } }).eq('id', charId)
            }
            const names = entries.filter(e => lootRecipients.has(e.character.id)).map(e => e.character.name).join(', ')
            const itemList = validItems.map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join(', ')
            await insertRollLog({
              campaign_id: campaignId, user_id: userId, character_name: 'System',
              label: `Loot: ${names} received ${itemList}`,
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
