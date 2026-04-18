'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

interface TokenProperty {
  key: string
  value: string
  revealed: boolean
}

interface ContentItem {
  type: 'weapon' | 'equipment'
  name: string
  quantity: number
}

interface LootEntry {
  character: { id: string; name: string; data?: any }
}

interface Props {
  tokenId: string
  name: string
  wpCurrent: number | null
  wpMax: number | null
  color: string
  portraitUrl: string | null
  isGM: boolean
  entries?: LootEntry[]
  onLoot?: (objectName: string, item: ContentItem, characterId: string, characterName: string) => void | Promise<void>
  onClose: () => void
}

function wpBarColor(pct: number): string {
  if (pct > 0.66) return '#7fc458'
  if (pct > 0.33) return '#EF9F27'
  return '#c0392b'
}

export default function ObjectCard({ tokenId, name, wpCurrent, wpMax, color, portraitUrl, isGM, entries, onLoot, onClose }: Props) {
  const supabase = createClient()
  const [properties, setProperties] = useState<TokenProperty[]>([])
  const [contents, setContents] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  // Per-row "give to" character selection, keyed by item name+type to survive index shifts.
  const [givePick, setGivePick] = useState<Record<string, string>>({})
  const [giving, setGiving] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('scene_tokens').select('properties, contents').eq('id', tokenId).single()
      if (cancelled) return
      setProperties(Array.isArray(data?.properties) ? data!.properties : [])
      setContents(Array.isArray(data?.contents) ? data!.contents : [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [tokenId])

  const wpM = wpMax ?? 0
  const wpC = wpCurrent ?? wpM
  const pct = wpM > 0 ? Math.max(0, Math.min(1, wpC / wpM)) : 0

  const visibleProps = isGM ? properties : properties.filter(p => p.revealed)

  const itemKey = (c: ContentItem) => `${c.type}:${c.name}`

  async function giveOne(item: ContentItem) {
    if (!entries) return
    const charId = givePick[itemKey(item)]
    if (!charId) return
    const charEntry = entries.find(e => e.character.id === charId)
    if (!charEntry) return
    setGiving(itemKey(item))
    try {
      // Give 1 of this item to the PC's equipment list (string array in character.data.equipment)
      const currentEquip: string[] = charEntry.character.data?.equipment ?? []
      const updatedEquip = [...currentEquip, item.name]
      await supabase.from('characters').update({ data: { ...charEntry.character.data, equipment: updatedEquip } }).eq('id', charId)

      // Decrement (or remove) on the crate side
      const newContents = contents
        .map(c => (c.type === item.type && c.name === item.name)
          ? { ...c, quantity: c.quantity - 1 }
          : c)
        .filter(c => c.quantity > 0)
      await supabase.from('scene_tokens').update({ contents: newContents }).eq('id', tokenId)
      setContents(newContents)

      await onLoot?.(name, { ...item, quantity: 1 }, charId, charEntry.character.name)
    } finally {
      setGiving(null)
    }
  }

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${color || '#7ab3d4'}`, borderRadius: '4px', padding: '8px 10px', color: '#f5f2ee' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {portraitUrl ? (
          <img src={portraitUrl} alt={name} style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: `1px solid ${color || '#3a3a3a'}` }} />
        ) : (
          <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: color || '#3a3a3a', border: '1px solid #2e2e2e' }} />
        )}
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', flex: 1 }}>{name}</div>
        <button onClick={onClose}
          style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Close
        </button>
      </div>

      {/* WP bar */}
      {wpM > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '3px' }}>
            <span>Integrity</span>
            <span>{wpC} / {wpM}</span>
          </div>
          <div style={{ height: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct * 100}%`, background: wpBarColor(pct), transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {/* Properties */}
      {!loading && visibleProps.length > 0 && (
        <div style={{ marginBottom: isGM && contents.length > 0 ? '8px' : 0 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Properties</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {visibleProps.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                <span style={{ color: '#cce0f5', minWidth: '80px' }}>{p.key}:</span>
                <span style={{ color: '#f5f2ee' }}>{p.value}</span>
                {isGM && !p.revealed && (
                  <span style={{ color: '#888', fontSize: '11px', fontStyle: 'italic' }}>(hidden)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contents — GM only. Per-item Give-to-PC picker. */}
      {isGM && !loading && contents.length > 0 && (
        <div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Contents (GM)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {contents.map((c) => {
              const k = itemKey(c)
              const selectedChar = givePick[k] ?? ''
              const canGive = !!entries && entries.length > 0
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f2ee' }}>
                  <span style={{ flex: 1 }}>
                    {c.type === 'weapon' ? '🔫' : '🎒'} {c.name}{c.quantity > 1 ? ` ×${c.quantity}` : ''}
                  </span>
                  {canGive && (
                    <>
                      <select
                        value={selectedChar}
                        onChange={e => setGivePick(prev => ({ ...prev, [k]: e.target.value }))}
                        style={{ padding: '2px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none', maxWidth: '120px' }}
                      >
                        <option value="">Give to...</option>
                        {entries!.map(en => (
                          <option key={en.character.id} value={en.character.id}>{en.character.name}</option>
                        ))}
                      </select>
                      <button
                        disabled={!selectedChar || giving === k}
                        onClick={() => giveOne(c)}
                        style={{ padding: '2px 8px', background: selectedChar ? '#1a2e10' : '#242424', border: `1px solid ${selectedChar ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: selectedChar ? '#7fc458' : '#5a5550', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: selectedChar ? 'pointer' : 'not-allowed' }}
                      >
                        {giving === k ? '…' : 'Give'}
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && visibleProps.length === 0 && (!isGM || contents.length === 0) && wpM === 0 && (
        <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', fontStyle: 'italic' }}>No details.</div>
      )}
    </div>
  )
}
