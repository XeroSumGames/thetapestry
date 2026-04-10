'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase-browser'

interface CampaignPin {
  id: string
  campaign_id: string
  name: string
  lat: number
  lng: number
  notes: string | null
  category: string
  revealed: boolean
  created_at: string
  sort_order: number | null
}

interface Props {
  campaignId: string
  isGM: boolean
  onPinFocus?: (pin: { id: string; lat: number; lng: number }) => void
}

export default function CampaignPins({ campaignId, isGM, onPinFocus }: Props) {
  const supabase = createClient()
  const [pins, setPins] = useState<CampaignPin[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')

  async function loadPins() {
    const { data } = await supabase
      .from('campaign_pins')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    setPins(data ?? [])
    setLoading(false)
  }

  // Drag and drop reorder
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  async function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const fromIdx = pins.findIndex(p => p.id === dragId)
    const toIdx = pins.findIndex(p => p.id === targetId)
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); setDragOverId(null); return }
    const next = [...pins]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    // Renumber 1..N and update DB
    const renumbered = next.map((p, i) => ({ ...p, sort_order: i + 1 }))
    setPins(renumbered)
    setDragId(null)
    setDragOverId(null)
    await Promise.all(renumbered.map(p =>
      supabase.from('campaign_pins').update({ sort_order: p.sort_order }).eq('id', p.id)
    ))
  }

  useEffect(() => { loadPins() }, [campaignId])

  async function toggleReveal(pin: CampaignPin) {
    await supabase.from('campaign_pins').update({ revealed: !pin.revealed }).eq('id', pin.id)
    setPins(prev => prev.map(p => p.id === pin.id ? { ...p, revealed: !p.revealed } : p))
  }

  async function revealAll() {
    await supabase.from('campaign_pins').update({ revealed: true }).eq('campaign_id', campaignId)
    setPins(prev => prev.map(p => ({ ...p, revealed: true })))
  }

  async function hideAll() {
    await supabase.from('campaign_pins').update({ revealed: false }).eq('campaign_id', campaignId)
    setPins(prev => prev.map(p => ({ ...p, revealed: false })))
  }

  function startEdit(pin: CampaignPin) {
    setEditingId(pin.id)
    setEditName(pin.name)
    setEditNotes(pin.notes ?? '')
  }

  async function saveEdit() {
    if (!editingId) return
    await supabase.from('campaign_pins').update({ name: editName.trim(), notes: editNotes.trim() || null }).eq('id', editingId)
    setPins(prev => prev.map(p => p.id === editingId ? { ...p, name: editName.trim(), notes: editNotes.trim() || null } : p))
    setEditingId(null)
  }

  async function deletePin(id: string) {
    if (!confirm('Delete this pin?')) return
    await supabase.from('campaign_pins').delete().eq('id', id)
    setPins(prev => prev.filter(p => p.id !== id))
  }

  async function promoteToWorld(pin: CampaignPin) {
    if (!confirm(`Add "${pin.name}" to the world map? This will be visible to everyone.`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('map_pins').insert({
      user_id: user.id, lat: pin.lat, lng: pin.lng,
      title: pin.name, notes: pin.notes ?? '', pin_type: 'gm',
      status: 'approved', category: pin.category,
    })
  }

  const allRevealed = pins.length > 0 && pins.every(p => p.revealed)

  if (loading) return <div style={{ padding: '1rem', color: '#cce0f5', fontSize: '13px' }}>Loading pins...</div>

  return (
    <>
      {/* Header buttons */}
      {isGM && pins.length > 0 && (
        <div style={{ padding: '8px 10px', display: 'flex', gap: '4px' }}>
          <button onClick={allRevealed ? hideAll : revealAll}
            style={{ padding: '2px 8px', background: allRevealed ? '#2a1210' : '#1a2e10', border: `1px solid ${allRevealed ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allRevealed ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {allRevealed ? 'Hide All' : 'Reveal All'}
          </button>
        </div>
      )}

      {/* Pin list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        {pins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
            No campaign pins
          </div>
        ) : (
          pins.map(pin => (
            <div
              key={pin.id}
              onDragOver={e => { if (dragId) { e.preventDefault(); setDragOverId(pin.id) } }}
              onDragLeave={() => { if (dragOverId === pin.id) setDragOverId(null) }}
              onDrop={() => handleDrop(pin.id)}
              style={{ padding: '6px 8px', background: dragOverId === pin.id ? '#242424' : '#1a1a1a', border: `1px solid ${dragOverId === pin.id ? '#7fc458' : pin.revealed ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', opacity: dragId === pin.id ? 0.4 : 1 }}
            >
              {editingId === pin.id ? (
                /* Edit mode */
                <div>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', marginBottom: '4px' }} />
                  <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes..." rows={2}
                    style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', resize: 'vertical', marginBottom: '4px' }} />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: '3px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '3px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isGM && (
                    <div
                      draggable
                      onDragStart={() => setDragId(pin.id)}
                      onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                      title="Drag to reorder"
                      style={{ cursor: 'grab', color: '#3a3a3a', fontSize: '14px', lineHeight: 1, userSelect: 'none', padding: '0 2px' }}
                    >⠿</div>
                  )}
                  <div
                    style={{ flex: 1, minWidth: 0, cursor: onPinFocus ? 'pointer' : 'default' }}
                    onClick={() => onPinFocus?.({ id: pin.id, lat: pin.lat, lng: pin.lng })}
                    title={onPinFocus ? 'Show on map' : undefined}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.name}</div>
                    {pin.notes && <div style={{ fontSize: '13px', color: '#cce0f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end', flexShrink: 0 }}>
                    {isGM && (
                      <>
                        <button onClick={() => toggleReveal(pin)}
                          style={{ fontSize: '13px', padding: '0 5px', borderRadius: '2px', background: pin.revealed ? '#2a1210' : '#1a2e10', border: `1px solid ${pin.revealed ? '#c0392b' : '#2d5a1b'}`, color: pin.revealed ? '#f5a89a' : '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                          {pin.revealed ? 'Hide' : 'Show'}
                        </button>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button onClick={() => startEdit(pin)} style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => promoteToWorld(pin)} style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }} title="Add to world map">🌍</button>
                          <button onClick={() => deletePin(pin.id)} style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #7a1f16', borderRadius: '2px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>×</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}
