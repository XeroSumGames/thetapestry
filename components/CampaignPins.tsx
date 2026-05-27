'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { logEvent } from '../lib/events'
import { PIN_CATEGORIES, getCategoryEmoji, getCategoryLabel, getCategoryFilter } from '../lib/pin-categories'
import { openPopout } from '../lib/popout'
import { searchNominatimUSFirst } from '../lib/nominatim-search'
import { LABEL_STYLE_TIGHT } from '../lib/style-helpers'
import { useHiddenPins } from '../lib/use-hidden-pins'

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
  // When set (currently 'comic'), the pin gets a 📖 Read button that
  // opens /reader-popout. The pin's image attachments become the
  // reader's pages, sorted natural-numerically.
  reader_mode: string | null
  // GM-shared folder name. NULL or '' = Uncategorized. Mirrors the
  // campaign_npcs.folder pattern - added 2026-05-15 via
  // sql/pin-folder-column-2026-05-15.sql.
  folder: string | null
}

interface TacticalScene {
  id: string
  name: string
}

interface Props {
  campaignId: string
  isGM: boolean
  isThriver?: boolean
  // When true, the per-pin "🌍 add to world map" button flips to a
  // "🗺️ add to tactical map" button and calls onPlaceOnTacticalMap
  // instead - promoting to the world map isn't useful when the GM is
  // staring at a tactical canvas.
  showTacticalMap?: boolean
  onPinFocus?: (pin: { id: string; lat: number; lng: number }) => void
  onOpenScene?: (sceneId: string) => void
  onPlaceOnTacticalMap?: (pin: CampaignPin) => Promise<void>
  // In tactical mode, the X button removes the pin's markers from
  // the active scene only; the campaign_pin row survives. Falls back
  // to deletePin (which destroys the campaign_pin row entirely) when
  // showTacticalMap is false.
  onRemoveFromTacticalMap?: (pin: CampaignPin) => Promise<void>
  // Fired on every pin mutation (reveal/hide/edit/delete/reorder) so the parent
  // can refresh the sibling CampaignMap, which can't hear this client's own
  // broadcast. See CampaignMap's pinRefreshKey prop.
  onPinsChanged?: () => void
}

export default function CampaignPins({ campaignId, isGM, isThriver = false, showTacticalMap = false, onPinFocus, onOpenScene, onPlaceOnTacticalMap, onRemoveFromTacticalMap, onPinsChanged }: Props) {
  // "Can manage" = campaign GM OR app-level Thriver. Thrivers get
  // parity on pin edit/delete so they can relocate stray pins across
  // any campaign they don't GM (e.g. the "dis ho" cleanup scenario).
  const canManage = isGM || isThriver
  // Per-user local "hide on my map" set (players). Doesn't touch the GM's reveal.
  const { isHidden: isPinHiddenLocally, toggle: toggleLocalHide } = useHiddenPins(campaignId)
  const supabase = createClient()
  const [pins, setPins] = useState<CampaignPin[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')
  const [editCategory, setEditCategory] = useState<string>('location')
  const [editReaderMode, setEditReaderMode] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pinImages, setPinImages] = useState<Record<string, string[]>>({})
  const [scenes, setScenes] = useState<TacticalScene[]>([])
  const [editSceneId, setEditSceneId] = useState<string | null>(null)
  const [editSortOrder, setEditSortOrder] = useState('')
  const [editFolder, setEditFolder] = useState('')
  // Pin filter - matches against pin name (case-insensitive substring).
  // Empty string = show all. Persists only for the session.
  const [pinFilter, setPinFilter] = useState('')
  // ── GM-shared folder state (mirrors NpcRoster) ────────────────────
  // Folder name lives directly on each pin row via the `folder` column.
  // NULL or empty = "Uncategorized." The expanded/collapsed and folder-
  // order state is per-viewer in localStorage so a player's open
  // sections don't leak across users.
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem(`pin_folders_${campaignId}`); if (saved) return new Set(JSON.parse(saved)) } catch {}
    }
    return new Set<string>()
  })
  const [folderOrder, setFolderOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem(`pin_folder_order_${campaignId}`); if (saved) return JSON.parse(saved) } catch {}
    }
    return []
  })

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
    const previous = pins
    const next = [...pins]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    // Renumber 1..N and update DB
    const renumbered = next.map((p, i) => ({ ...p, sort_order: i + 1 }))
    setPins(renumbered)
    setDragId(null)
    setDragOverId(null)
    const results = await Promise.all(renumbered.map(p =>
      supabase.from('campaign_pins').update({ sort_order: p.sort_order }).eq('id', p.id)
    ))
    // Surface any persistence failures rather than letting the UI lie.
    // If even one row failed, snap the visible order back to the DB's
    // last-known state so the user knows their drag didn't stick.
    const errors = results.map(r => (r as any).error).filter(Boolean)
    if (errors.length > 0) {
      console.error('[CampaignPins.handleDrop] update errors:', errors)
      alert(`Couldn't save the new order: ${errors[0].message}`)
      setPins(previous)
      return
    }
    broadcastPinsChanged()
  }

  // Realtime sync - pins channel. Every CampaignPins instance for the
  // same campaign (GM screen + each player's screen) subscribes to
  // `campaign_pins_<campaignId>`. Mutations (reveal toggle, folder
  // bulk reveal/hide, edit save, delete, reorder) broadcast a
  // `pins_changed` event; everyone refetches. Broadcast > postgres_
  // changes because the latter is flaky on RLS'd tables (see lessons
  // memo entry 2026-04-11 about npc_relationships).
  const pinsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  function broadcastPinsChanged() {
    pinsChannelRef.current?.send({ type: 'broadcast', event: 'pins_changed', payload: {} })
    onPinsChanged?.()  // same-client signal to the parent -> refresh CampaignMap
  }
  useEffect(() => {
    loadPins(); loadScenes()
    const ch = supabase.channel(`campaign_pins_${campaignId}`)
    ch.on('broadcast', { event: 'pins_changed' }, () => { void loadPins() })
    // Catch-up reloads. The pins_changed broadcast is fire-and-forget with
    // no delivery guarantee, so a client that was disconnected, subscribed
    // late, or dropped the packet never reloads and shows a stale pin set
    // until a manual refresh (playtest: "shared a pin, didn't show without a
    // refresh"). Reloading on the SUBSCRIBED (re)connect and on tab-return-
    // to-visible makes convergence stop depending on catching one ephemeral
    // broadcast. Mirrors the RollsFeed / TableChat catch-up pattern.
    ch.subscribe((status: string) => { if (status === 'SUBSCRIBED') void loadPins() })
    pinsChannelRef.current = ch
    function handleVisibility() { if (!document.hidden) void loadPins() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(ch)
      pinsChannelRef.current = null
    }
  }, [campaignId])

  // ── Folder helpers - mirror NpcRoster ──────────────────────────────
  function toggleFolder(folderName: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(folderName) ? next.delete(folderName) : next.add(folderName)
      if (typeof window !== 'undefined') localStorage.setItem(`pin_folders_${campaignId}`, JSON.stringify([...next]))
      return next
    })
  }

  // Bulk reveal / hide every pin in a folder. GM/Thriver only - the
  // button is hidden for players. Single UPDATE…IN keeps the round-
  // trip count at one regardless of folder size. Reload happens
  // optimistically locally; if the write fails the alert surfaces it.
  async function setFolderRevealed(folderName: string, revealed: boolean) {
    const target = folderName === 'Uncategorized' ? null : folderName
    const inFolder = pins.filter(p => (p.folder ?? 'Uncategorized') === folderName)
    if (inFolder.length === 0) return
    const previous = pins
    setPins(prev => prev.map(p => {
      if ((p.folder ?? 'Uncategorized') !== folderName) return p
      return { ...p, revealed }
    }))
    let query = supabase.from('campaign_pins')
      .update({ revealed })
      .eq('campaign_id', campaignId)
    query = target == null
      ? query.is('folder', null as any)
      : query.eq('folder', target)
    const { error } = await query.select()
    if (error) {
      alert(`Folder ${revealed ? 'reveal' : 'hide'} failed: ${error.message}`)
      setPins(previous)
      return
    }
    broadcastPinsChanged()
    if (revealed) {
      const hiddenIds = inFolder.filter(p => !p.revealed).map(p => p.id)
      if (hiddenIds.length > 0) {
        void logEvent('pin_revealed', { campaign_id: campaignId, bulk: true, count: hiddenIds.length, folder: folderName })
      }
    }
  }

  async function loadScenes() {
    const { data } = await supabase.from('tactical_scenes').select('id, name').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    setScenes(data ?? [])
  }

  async function toggleReveal(pin: CampaignPin) {
    await supabase.from('campaign_pins').update({ revealed: !pin.revealed }).eq('id', pin.id)
    setPins(prev => prev.map(p => p.id === pin.id ? { ...p, revealed: !p.revealed } : p))
    broadcastPinsChanged()
    if (!pin.revealed) {
      // Only log on the reveal-direction; un-reveal isn't worth tracking.
      void logEvent('pin_revealed', { pin_id: pin.id, campaign_id: campaignId, bulk: false })
    }
  }

  async function revealAll() {
    const hidden = pins.filter(p => !p.revealed)
    await supabase.from('campaign_pins').update({ revealed: true }).eq('campaign_id', campaignId)
    setPins(prev => prev.map(p => ({ ...p, revealed: true })))
    broadcastPinsChanged()
    if (hidden.length > 0) {
      void logEvent('pin_revealed', { campaign_id: campaignId, bulk: true, count: hidden.length })
    }
  }

  async function hideAll() {
    await supabase.from('campaign_pins').update({ revealed: false }).eq('campaign_id', campaignId)
    setPins(prev => prev.map(p => ({ ...p, revealed: false })))
    broadcastPinsChanged()
  }

  function startEdit(pin: CampaignPin) {
    setEditingId(pin.id)
    setEditName(pin.name)
    setEditNotes(pin.notes ?? '')
    setEditLat(String(pin.lat))
    setEditLng(String(pin.lng))
    setEditCategory(pin.category || 'location')
    setEditReaderMode(pin.reader_mode ?? null)
    setEditSceneId(pin.tactical_scene_id ?? null)
    setEditSortOrder(pin.sort_order != null ? String(pin.sort_order) : '')
    setEditFolder(pin.folder ?? '')
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
      category: editCategory,
      reader_mode: editReaderMode,
      tactical_scene_id: editSceneId || null,
      sort_order: sortVal != null && !Number.isNaN(sortVal) ? sortVal : null,
      folder: editFolder.trim() || null,
    }
    // Capture .select() so we can verify the DB returned the new state.
    // Pre-fix bug: this UPDATE was fire-and-forget - when PostgREST's
    // schema cache hadn't picked up sort_order yet, the column was
    // silently dropped from the payload and the row stayed unchanged,
    // but the optimistic setPins below made the UI lie. After a refresh
    // the row reverted to its DB value. Fail loudly on errors AND skip
    // the optimistic update when the write didn't return the new row.
    const { data: updatedRow, error } = await supabase
      .from('campaign_pins')
      .update(update)
      .eq('id', editingId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('[CampaignPins.saveEdit] update failed:', error)
      alert(`Couldn't save pin: ${error.message}`)
      return
    }
    if (!updatedRow) {
      console.error('[CampaignPins.saveEdit] update returned no row - RLS likely blocked the UPDATE for this user.')
      alert("Save didn't go through - your account may not have permission to edit this pin.")
      return
    }
    setPins(prev => {
      // Trust the row the DB returned (it ran through any triggers /
      // defaults), not the optimistic `update` payload.
      const next = prev.map(p => p.id === editingId ? { ...p, ...(updatedRow as any) } : p)
      // Re-sort by sort_order so moving a pin updates its position immediately
      return [...next].sort((a, b) => {
        const ao = a.sort_order ?? 999999
        const bo = b.sort_order ?? 999999
        return ao - bo
      })
    })
    setEditingId(null)
    broadcastPinsChanged()
  }

  async function deletePin(id: string) {
    if (!confirm('Delete this pin?')) return
    await supabase.from('campaign_pins').delete().eq('id', id)
    setPins(prev => prev.filter(p => p.id !== id))
    broadcastPinsChanged()
  }

  async function promoteToWorld(pin: CampaignPin) {
    if (!confirm(`Add "${pin.name}" to the world map? This will be visible to everyone.`)) return
    const { user } = await getCachedAuth()
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
      {/* Header - Reveal/Hide All (GM only) + search box (everyone).
          The search input lives next to the toggle so players who
          can't manage reveal state still get a way to filter long
          pin lists. Filter matches case-insensitive substring against
          pin name only - notes get noisy fast and the name is what
          shows in the row. */}
      {pins.length > 0 && (
        <div style={{ padding: '8px 10px', display: 'flex', gap: '4px', alignItems: 'center' }}>
          {isGM && (
            <button onClick={allRevealed ? hideAll : revealAll}
              style={{ padding: '2px 8px', background: allRevealed ? '#2a1210' : '#1a2e10', border: `1px solid ${allRevealed ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allRevealed ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
              {allRevealed ? 'Hide All' : 'Reveal All'}
            </button>
          )}
          <input
            type="search"
            value={pinFilter}
            onChange={e => setPinFilter(e.target.value)}
            placeholder="Search pins…"
            style={{ flex: 1, minWidth: 0, padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {/* Pin list - grouped into GM-shared folders. Mirrors the
          NpcRoster pattern: each pin row carries a `folder` text
          column; NULL/empty bucket under "Uncategorized." Order is
          per-viewer in localStorage (`pin_folder_order_<campaignId>`)
          so a player rearranging their view doesn't move folders
          on the GM's screen. */}
      <div style={{ overflowY: 'auto', padding: '4px' }}>
        {(() => {
          if (pins.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '8px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                {isGM ? 'No campaign pins' : 'No pins revealed yet'}
              </div>
            )
          }
          // Apply the search filter before grouping. Empty filter = pass
          // everything through. Case-insensitive substring on pin name.
          const filterQ = pinFilter.trim().toLowerCase()
          const filteredPins = filterQ === ''
            ? pins
            : pins.filter(p => (p.name ?? '').toLowerCase().includes(filterQ))
          if (filteredPins.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '8px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
                No pins match &quot;{pinFilter}&quot;
              </div>
            )
          }
          // Group pins by folder. NULL / empty / whitespace-only =
          // Uncategorized. Sort within each folder is already settled
          // upstream by loadPins (sort_order then created_at).
          const folderMap: Record<string, CampaignPin[]> = {}
          for (const p of filteredPins) {
            const raw = (p.folder ?? '').trim()
            const key = raw === '' ? 'Uncategorized' : raw
            if (!folderMap[key]) folderMap[key] = []
            folderMap[key].push(p)
          }
          const allFolderNames = Object.keys(folderMap)
          // Order: saved order first, then any folders that appeared
          // since (new GM creation, rename, etc.). Uncategorized
          // always pinned LAST regardless of order.
          const ordered = [
            ...folderOrder.filter(f => allFolderNames.includes(f)),
            ...allFolderNames.filter(f => !folderOrder.includes(f)),
          ]
          const finalOrder = ordered.filter(f => f !== 'Uncategorized')
          if (ordered.includes('Uncategorized')) finalOrder.push('Uncategorized')
          // Sync localStorage if the folder list shifted (don't store
          // 'Uncategorized' - it's an implicit last bucket).
          const persistable = finalOrder.filter(f => f !== 'Uncategorized')
          if (persistable.length !== folderOrder.length || persistable.some((f, i) => f !== folderOrder[i])) {
            setFolderOrder(persistable)
            if (typeof window !== 'undefined') localStorage.setItem(`pin_folder_order_${campaignId}`, JSON.stringify(persistable))
          }
          return finalOrder.map(folderName => {
            const folderPins = folderMap[folderName]
            if (!folderPins || folderPins.length === 0) return null
            const isOpen = expandedFolders.has(folderName)
            const allFolderRevealed = folderPins.every(p => p.revealed)
            return (
              <div key={folderName} style={{ marginBottom: '2px' }}>
                <div onClick={() => toggleFolder(folderName)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', cursor: 'pointer', borderRadius: '3px', borderBottom: '1px solid #2e2e2e', userSelect: 'none', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: '13px', color: '#5a5550', width: '12px', textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</span>
                  <span style={{ flex: 1, fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{folderName}</span>
                  {canManage && (
                    // Folder reveal as a green/red radio dot, matching the
                    // per-pin reveal radios below. Green = all pins in the
                    // folder are revealed to players; red = not (click reveals
                    // all; click again hides all). stopPropagation so it
                    // doesn't also collapse/expand the folder.
                    <button onClick={e => { e.stopPropagation(); void setFolderRevealed(folderName, !allFolderRevealed) }}
                      title={allFolderRevealed
                        ? `All ${folderPins.length} pin${folderPins.length === 1 ? '' : 's'} in ${folderName} visible to players - click to hide all`
                        : `Click to reveal all ${folderPins.length} pin${folderPins.length === 1 ? '' : 's'} in ${folderName} to players`}
                      aria-label={allFolderRevealed ? `Hide all pins in ${folderName} from players` : `Reveal all pins in ${folderName} to players`}
                      style={{ width: '15px', height: '15px', borderRadius: '50%', padding: 0, flexShrink: 0, cursor: 'pointer', background: allFolderRevealed ? '#7fc458' : '#c0392b', border: `1px solid ${allFolderRevealed ? '#2d5a1b' : '#7a1f16'}`, boxShadow: allFolderRevealed ? '0 0 4px rgba(127,196,88,.6)' : 'none' }} />
                  )}
                  <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>{folderPins.length}</span>
                </div>
                {isOpen && folderPins.map(pin => (
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
                    style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', marginBottom: '4px' }} />
                  <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes..." rows={2}
                    style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', resize: 'vertical', marginBottom: '4px' }} />
                  {/* Category picker - same icon set the world map uses
                      (lib/pin-categories.ts). Click an icon to set the
                      category; the selected one outlines red. */}
                  <div style={{ marginBottom: '4px' }}>
                    <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>
                      Category - {getCategoryLabel(editCategory)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px' }}>
                      {PIN_CATEGORIES.map(c => {
                        const picked = c.value === editCategory
                        const filter = getCategoryFilter(c.value)
                        return (
                          <button key={c.value} type="button" onClick={() => setEditCategory(c.value)}
                            title={c.label}
                            style={{
                              padding: '4px 0',
                              background: picked ? '#2a1210' : '#242424',
                              border: `1px solid ${picked ? '#c0392b' : '#3a3a3a'}`,
                              borderRadius: '3px',
                              fontSize: '17px',
                              cursor: 'pointer',
                              lineHeight: 1,
                              transition: 'background 120ms',
                            }}>
                            {filter
                              ? <span style={{ filter, display: 'inline-block', lineHeight: 1 }}>{c.emoji}</span>
                              : c.emoji}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Reader mode - when set, the pin gets a 📖 Read
                      button that opens the comic-reader popout
                      backed by this pin's image attachments. */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', padding: '4px 6px', background: editReaderMode === 'comic' ? '#0f1a2e' : 'transparent', border: `1px solid ${editReaderMode === 'comic' ? '#1a3a5c' : '#2e2e2e'}`, borderRadius: '3px', cursor: 'pointer' }}>
                    <input type="checkbox"
                      checked={editReaderMode === 'comic'}
                      onChange={e => setEditReaderMode(e.target.checked ? 'comic' : null)} />
                    <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em' }}>
                      📖 Comic reader - pages = sorted image attachments
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>Latitude</div>
                      <input value={editLat} onChange={e => setEditLat(e.target.value)} placeholder="Lat"
                        style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>Longitude</div>
                      <input value={editLng} onChange={e => setEditLng(e.target.value)} placeholder="Lng"
                        style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  {/* Address search - lookup via Nominatim, click a
                      result to fill lat/lng. Helpful when relocating
                      a pin that was dropped in the wrong spot. */}
                  <AddressSearchRow
                    onPick={(lat, lng) => { setEditLat(lat.toFixed(6)); setEditLng(lng.toFixed(6)) }}
                  />
                  {/* Tactical Map link */}
                  {isGM && scenes.length > 0 && (
                    <div style={{ marginBottom: '4px' }}>
                      <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>Tactical Map</div>
                      <select value={editSceneId ?? ''} onChange={e => setEditSceneId(e.target.value || null)}
                        style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                        <option value="">- None -</option>
                        {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  {/* Folder - free-form text. Datalist offers any
                      existing folder name in this campaign for quick
                      auto-complete. Empty = Uncategorized. */}
                  <div style={{ marginBottom: '4px' }}>
                    <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>Folder</div>
                    <input value={editFolder} onChange={e => setEditFolder(e.target.value)}
                      list="pin-folder-suggestions"
                      placeholder="(Uncategorized)"
                      style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
                    <datalist id="pin-folder-suggestions">
                      {Array.from(new Set(pins.map(p => p.folder).filter((f): f is string => !!f && f.trim().length > 0))).sort().map(f => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </div>
                  {/* Sort order - explicit number that decides list position */}
                  <div style={{ marginBottom: '4px', width: '90px' }}>
                    <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>Order</div>
                    <input value={editSortOrder} onChange={e => setEditSortOrder(e.target.value)} type="number" min="1" placeholder="#"
                      style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', textAlign: 'center' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: '3px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '3px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
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
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span title={getCategoryLabel(pin.category)} style={{ fontSize: '15px', lineHeight: 1, flexShrink: 0, ...(() => { const f = getCategoryFilter(pin.category); return f ? { filter: f, display: 'inline-block' } : {} })() }}>{getCategoryEmoji(pin.category)}</span>
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
                    {!canManage && (() => {
                      // Player radio: GREEN = on my map, RED = hidden on MY map
                      // (local declutter only; never touches the GM's reveal).
                      const shown = !isPinHiddenLocally(pin.id)
                      return (
                        <button onClick={() => toggleLocalHide(pin.id)}
                          title={shown ? 'Showing on your map - click to hide it from your map' : 'Hidden on your map - click to show it'}
                          aria-label={shown ? 'Hide pin on my map' : 'Show pin on my map'}
                          style={{ width: '15px', height: '15px', borderRadius: '50%', padding: 0, flexShrink: 0, cursor: 'pointer', background: shown ? '#7fc458' : '#c0392b', border: `1px solid ${shown ? '#2d5a1b' : '#7a1f16'}`, boxShadow: shown ? '0 0 4px rgba(127,196,88,.6)' : 'none' }} />
                      )
                    })()}
                    {canManage && (
                      <>
                        {/* Visibility radio: GREEN = shown to players, RED = hidden. Click toggles. */}
                        <button onClick={() => toggleReveal(pin)}
                          title={pin.revealed ? 'Visible to players - click to hide' : 'Hidden from players - click to reveal'}
                          aria-label={pin.revealed ? 'Hide pin from players' : 'Reveal pin to players'}
                          style={{ width: '15px', height: '15px', borderRadius: '50%', padding: 0, flexShrink: 0, cursor: 'pointer', background: pin.revealed ? '#7fc458' : '#c0392b', border: `1px solid ${pin.revealed ? '#2d5a1b' : '#7a1f16'}`, boxShadow: pin.revealed ? '0 0 4px rgba(127,196,88,.6)' : 'none' }} />
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {pin.reader_mode === 'comic' && (
                            <button
                              onClick={() => openPopout(`/reader-popout?pin=${pin.id}`, `reader-${pin.id}`, { w: 980, h: 1100 })}
                              title="Open comic reader"
                              style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>📖</button>
                          )}
                          <button onClick={() => startEdit(pin)} style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>Edit</button>
                          {showTacticalMap && onPlaceOnTacticalMap ? (
                            <button onClick={() => onPlaceOnTacticalMap(pin)} style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }} title="Add to tactical map">🗺️</button>
                          ) : (
                            <button onClick={() => promoteToWorld(pin)} style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }} title="Add to world map">🌍</button>
                          )}
                          {showTacticalMap && onRemoveFromTacticalMap ? (
                            <button onClick={() => onRemoveFromTacticalMap(pin)}
                              title="Remove pin marker from tactical map (campaign pin survives)"
                              style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #7a1f16', borderRadius: '2px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>×</button>
                          ) : (
                            <button onClick={() => deletePin(pin.id)}
                              title="Delete pin"
                              style={{ fontSize: '13px', padding: '0 4px', background: 'none', border: '1px solid #7a1f16', borderRadius: '2px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>×</button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
                ))}
              </div>
            )
          })
        })()}
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
      const data = await searchNominatimUSFirst(query)
      setResults(data)
    } catch (err: any) {
      console.error('[address-search] failed:', err?.message ?? err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>Address search</div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
          placeholder="Street, city, landmark..."
          style={{ flex: 1, padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
        <button onClick={runSearch} disabled={searching || !q.trim()}
          style={{ padding: '0 10px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: searching || !q.trim() ? 'not-allowed' : 'pointer', opacity: searching || !q.trim() ? 0.5 : 1 }}>
          {searching ? '…' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <div style={{ marginTop: '4px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', maxHeight: '140px', overflowY: 'auto' }}>
          {results.map((r, i) => (
            <button key={i}
              onClick={() => { onPick(parseFloat(r.lat), parseFloat(r.lon)); setResults([]); setQ('') }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', background: 'transparent', border: 'none', borderBottom: i < results.length - 1 ? '1px solid #2e2e2e' : 'none', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', lineHeight: 1.3 }}
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
