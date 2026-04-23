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
  tactical_scene_id: string | null
}

interface TacticalScene {
  id: string
  name: string
}

interface Props {
  campaignId: string
  isGM: boolean
  isThriver?: boolean
  onPinFocus?: (pin: { id: string; lat: number; lng: number }) => void
  onOpenScene?: (sceneId: string) => void
}

export default function CampaignPins({ campaignId, isGM, isThriver = false, onPinFocus, onOpenScene }: Props) {
  // "Can manage" = campaign GM OR app-level Thriver. Thrivers get
  // parity on pin edit/delete so they can relocate stray pins across
  // any campaign they don't GM (e.g. the "dis ho" cleanup scenario).
  const canManage = isGM || isThriver
  const supabase = createClient()
  const [pins, setPins] = useState<CampaignPin[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pinImages, setPinImages] = useState<Record<string, string[]>>({})
  const [scenes, setScenes] = useState<TacticalScene[]>([])
  const [editSceneId, setEditSceneId] = useState<string | null>(null)
  const [editSortOrder, setEditSortOrder] = useState('')

  async function loadPins() {
    let query = supabase
      .from('campaign_pins')
      .select('*')
      .eq('campaign_id', campaignId)
    // Players only see revealed pins
    if (!isGM) query = query.eq('revealed', true)
    const { data } = await query
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

  useEffect(() => { loadPins(); loadScenes() }, [campaignId])

  async function loadScenes() {
    const { data } = await supabase.from('tactical_scenes').select('id, name').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    setScenes(data ?? [])
  }

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
    setEditLat(String(pin.lat))
    setEditLng(String(pin.lng))
    setEditSceneId(pin.tactical_scene_id ?? null)
    setEditSortOrder(pin.sort_order != null ? String(pin.sort_order) : '')
  }

  async function saveEdit() {
    if (!editingId) return
    const lat = parseFloat(editLat)
    const lng = parseFloat(editLng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) { alert('Latitude and longitude must be numbers'); return }
    const sortVal = editSortOrder.trim() ? parseInt(editSortOrder, 10) : null
    const update = {
      name: editName.trim(),
      notes: editNotes.trim() || null,
      lat, lng,
      tactical_scene_id: editSceneId || null,
      sort_order: sortVal != null && !Number.isNaN(sortVal) ? sortVal : null,
    }
    await supabase.from('campaign_pins').update(update).eq('id', editingId)
    setPins(prev => {
      const next = prev.map(p => p.id === editingId ? { ...p, ...update } : p)
      // Re-sort by sort_order so moving a pin updates its position immediately
      return [...next].sort((a, b) => {
        const ao = a.sort_order ?? 999999
        const bo = b.sort_order ?? 999999
        return ao - bo
      })
    })
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

  async function loadPinImages(pinId: string) {
    if (pinImages[pinId]) return // already loaded
    const { data: files } = await supabase.storage.from('pin-attachments').list(`${campaignId}/${pinId}`)
    if (files && files.length > 0) {
      const urls = files
        .filter((f: any) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name))
        .map((f: any) => {
          const { data: urlData } = supabase.storage.from('pin-attachments').getPublicUrl(`${campaignId}/${pinId}/${f.name}`)
          return urlData.publicUrl
        })
      setPinImages(prev => ({ ...prev, [pinId]: urls }))
    } else {
      setPinImages(prev => ({ ...prev, [pinId]: [] }))
    }
  }

  function toggleExpand(pinId: string) {
    if (expandedId === pinId) {
      setExpandedId(null)
    } else {
      setExpandedId(pinId)
      loadPinImages(pinId)
    }
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
      <div style={{ overflowY: 'auto', padding: '4px' }}>
        {pins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '8px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>
            {isGM ? 'No campaign pins' : 'No pins revealed yet'}
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
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Latitude</div>
                      <input value={editLat} onChange={e => setEditLat(e.target.value)} placeholder="Lat"
                        style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Longitude</div>
                      <input value={editLng} onChange={e => setEditLng(e.target.value)} placeholder="Lng"
                        style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  {/* Address search — lookup via Nominatim, click a
                      result to fill lat/lng. Helpful when relocating
                      a pin that was dropped in the wrong spot. */}
                  <AddressSearchRow
                    onPick={(lat, lng) => { setEditLat(lat.toFixed(6)); setEditLng(lng.toFixed(6)) }}
                  />
                  {/* Tactical Map link */}
                  {isGM && scenes.length > 0 && (
                    <div style={{ marginBottom: '4px' }}>
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Tactical Map</div>
                      <select value={editSceneId ?? ''} onChange={e => setEditSceneId(e.target.value || null)}
                        style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                        <option value="">— None —</option>
                        {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  {/* Sort order — explicit number that decides list position */}
                  <div style={{ marginBottom: '4px', width: '90px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Order</div>
                    <input value={editSortOrder} onChange={e => setEditSortOrder(e.target.value)} type="number" min="1" placeholder="#"
                      style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', textAlign: 'center' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: '3px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '3px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div
                    draggable
                    onDragStart={() => setDragId(pin.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                    title="Drag to reorder"
                    style={{ cursor: 'grab', color: '#3a3a3a', fontSize: '14px', lineHeight: 1, userSelect: 'none', padding: '0 2px' }}
                  >⠿</div>
                  <div
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    onClick={() => { toggleExpand(pin.id); onPinFocus?.({ id: pin.id, lat: pin.lat, lng: pin.lng }) }}
                    onDoubleClick={() => { if (pin.tactical_scene_id && onOpenScene) onOpenScene(pin.tactical_scene_id) }}
                    title={pin.tactical_scene_id ? 'Double-click to open tactical map' : 'Show on map'}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {pin.name}
                      {pin.tactical_scene_id && <span title="Has tactical map" style={{ fontSize: '13px', color: '#7ab3d4' }}>🗺️</span>}
                    </div>
                    {pin.notes && <div style={{ fontSize: '13px', color: '#cce0f5', overflow: expandedId === pin.id ? 'visible' : 'hidden', textOverflow: expandedId === pin.id ? 'unset' : 'ellipsis', whiteSpace: expandedId === pin.id ? 'normal' : 'nowrap' }}>{pin.notes}</div>}
                    {expandedId === pin.id && pinImages[pin.id] && pinImages[pin.id].length > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {pinImages[pin.id].map((url, i) => (
                          <img key={i} src={url} alt="" loading="lazy"
                            onClick={e => { e.stopPropagation(); window.open(url, '_blank') }}
                            style={{ width: '100%', borderRadius: '3px', border: '1px solid #3a3a3a', cursor: 'zoom-in' }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end', flexShrink: 0 }}>
                    {canManage && (
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

// ── Address search helper ─────────────────────────────────────
// Small self-contained widget: type an address, hit Search (or Enter),
// pick from up to 5 Nominatim results, the parent gets {lat, lng}
// via onPick. Used inside the pin edit form so Thrivers (or GMs) can
// relocate a pin by address instead of hand-typing coords.
function AddressSearchRow({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([])
  async function runSearch() {
    const query = q.trim()
    if (!query) return
    setSearching(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.warn('[address-search] failed:', err?.message ?? err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Address search</div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
          placeholder="Street, city, landmark..."
          style={{ flex: 1, padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
        <button onClick={runSearch} disabled={searching || !q.trim()}
          style={{ padding: '0 10px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: searching || !q.trim() ? 'not-allowed' : 'pointer', opacity: searching || !q.trim() ? 0.5 : 1 }}>
          {searching ? '…' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <div style={{ marginTop: '4px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', maxHeight: '140px', overflowY: 'auto' }}>
          {results.map((r, i) => (
            <button key={i}
              onClick={() => { onPick(parseFloat(r.lat), parseFloat(r.lon)); setResults([]); setQ('') }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', background: 'transparent', border: 'none', borderBottom: i < results.length - 1 ? '1px solid #2e2e2e' : 'none', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow, sans-serif', cursor: 'pointer', lineHeight: 1.3 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
