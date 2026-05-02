'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { ALL_WEAPONS } from '../lib/weapons'
import { EQUIPMENT } from '../lib/xse-schema'
import ObjectImageCropper from './ObjectImageCropper'
import { LABEL_STYLE_TIGHT } from '../lib/style-helpers'

const OBJECT_ICONS = [
  { value: 'car', emoji: '🚗', label: 'Car' },
  { value: 'truck', emoji: '🚛', label: 'Truck' },
  { value: 'crate', emoji: '📦', label: 'Crate' },
  { value: 'barrel', emoji: '🛢️', label: 'Barrel' },
  { value: 'door', emoji: '🚪', label: 'Door' },
  { value: 'wall', emoji: '🧱', label: 'Wall' },
  { value: 'fire', emoji: '🔥', label: 'Fire' },
  { value: 'tree', emoji: '🌲', label: 'Tree' },
  { value: 'rock', emoji: '🪨', label: 'Rock' },
  { value: 'tent', emoji: '⛺', label: 'Tent' },
  { value: 'barricade', emoji: '🚧', label: 'Barricade' },
  { value: 'generator', emoji: '⚡', label: 'Generator' },
]

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

// All lootable items for the picker
const ALL_ITEMS = [
  ...ALL_WEAPONS.map(w => ({ type: 'weapon' as const, name: w.name, label: `🔫 ${w.name}` })),
  ...EQUIPMENT.map(e => ({ type: 'equipment' as const, name: e.name, label: `🎒 ${e.name}` })),
]

interface ObjectToken {
  id: string
  scene_id: string
  name: string
  portrait_url: string | null
  destroyed_portrait_url: string | null
  grid_x: number
  grid_y: number
  is_visible: boolean
  wp_max: number | null
  wp_current: number | null
  color: string
  properties: TokenProperty[]
  contents: ContentItem[]
  // PCs allowed to drag this object on the tactical map. Empty array
  // (the default) means GM-only.
  controlled_by_character_ids?: string[]
}

interface Props {
  campaignId: string
  isGM: boolean
  onPlaceOnMap?: (name: string, portraitUrl: string | null, wpMax: number | null) => void
  onRemoveFromMap?: (name: string) => void
  onLoot?: (objectName: string, item: ContentItem, characterId: string, characterName: string) => void
  onDuplicate?: (source: ObjectToken) => void | Promise<void>
  onTokenChanged?: () => void                                  // Notify parent to broadcast token_changed so other clients re-fetch
  tokenRefreshKey?: number
  entries?: { character: { id: string; name: string; data: any }; userId: string }[]
}

export default function CampaignObjects({ campaignId, isGM, onPlaceOnMap, onRemoveFromMap, onLoot, onDuplicate, onTokenChanged, tokenRefreshKey, entries }: Props) {
  const supabase = createClient()
  const [objects, setObjects] = useState<ObjectToken[]>([])
  const [library, setLibrary] = useState<{ id: string; name: string; image_url: string; metadata?: any }[]>([])
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [activeSceneCols, setActiveSceneGridCols] = useState<number>(20)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addIcon, setAddIcon] = useState('crate')
  const [addWP, setAddWP] = useState('3')
  const [addIndestructible, setAddIndestructible] = useState(false)
  const [addCustomUrl, setAddCustomUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingObj, setEditingObj] = useState<ObjectToken | null>(null)
  const [editName, setEditName] = useState('')
  const [editWP, setEditWP] = useState('')
  const [editIndestructible, setEditIndestructible] = useState(false)
  const [editProps, setEditProps] = useState<TokenProperty[]>([])
  const [editContents, setEditContents] = useState<ContentItem[]>([])
  const [editControllers, setEditControllers] = useState<string[]>([])
  // Campaign PCs available to be assigned as controllers — fetched once
  // when the modal opens. Shape: { id, name, ownerName? }.
  const [campaignPcs, setCampaignPcs] = useState<{ id: string; name: string; ownerName?: string }[]>([])
  const [contentPickerValue, setContentPickerValue] = useState('')
  const [contentQty, setContentQty] = useState(1)
  const [lootingObj, setLootingObj] = useState<ObjectToken | null>(null)
  const [lootCharId, setLootCharId] = useState('')
  // Per-item picker state for granular Give. Keyed by item index in
  // lootingObj.contents. Mirrors ObjectCard's pattern.
  const [lootItemPick, setLootItemPick] = useState<Record<number, string>>({})
  const [givingItemIdx, setGivingItemIdx] = useState<number | null>(null)
  // Crop modal — selected file waits here until user confirms crop, then uploads.
  // `target` distinguishes between the Add-object flow and the Edit-object flow
  // so we know where to apply the resulting URL.
  const [cropFile, setCropFile] = useState<{ file: File; target: 'add' | 'edit' | 'edit-destroyed' } | null>(null)
  // Surfaces upload failures inside the cropper modal so the GM can retry
  // without losing their crop selection.
  const [cropUploadError, setCropUploadError] = useState<string | null>(null)
  // Forces React to remount the file inputs after every upload so the
  // browser-side selection is guaranteed clean. Some browsers stick on
  // the previously-picked file even after `e.target.value = ''`, so the
  // user can't pick the same (or sometimes any) file again. Bumping this
  // counter changes the input's React key → fresh element each time.
  const [fileInputKey, setFileInputKey] = useState(0)
  const [dragObjId, setDragObjId] = useState<string | null>(null)
  const [dragOverObjId, setDragOverObjId] = useState<string | null>(null)

  async function handleObjDrop(targetId: string) {
    if (!dragObjId || dragObjId === targetId) { setDragObjId(null); setDragOverObjId(null); return }
    const fromIdx = objects.findIndex(o => o.id === dragObjId)
    const toIdx = objects.findIndex(o => o.id === targetId)
    if (fromIdx < 0 || toIdx < 0) { setDragObjId(null); setDragOverObjId(null); return }
    const next = [...objects]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setObjects(next)
    setDragObjId(null)
    setDragOverObjId(null)
    // Persist sort order to DB
    await Promise.all(next.map((o, i) =>
      supabase.from('scene_tokens').update({ sort_order: i + 1 }).eq('id', o.id)
    ))
  }

  useEffect(() => { loadObjects(); loadLibrary() }, [campaignId, tokenRefreshKey])

  async function loadObjects() {
    const { data: scenes } = await supabase.from('tactical_scenes').select('id, grid_cols').eq('campaign_id', campaignId).eq('is_active', true).limit(1)
    if (!scenes || scenes.length === 0) { setObjects([]); setActiveSceneId(null); return }
    setActiveSceneId(scenes[0].id)
    setActiveSceneGridCols((scenes[0] as any).grid_cols ?? 20)
    const { data } = await supabase.from('scene_tokens').select('*').eq('scene_id', scenes[0].id).eq('token_type', 'object').order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })
    setObjects((data ?? []) as ObjectToken[])
  }

  async function loadLibrary() {
    const { data } = await supabase
      .from('object_token_library')
      .select('id, name, image_url, metadata')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
    setLibrary(data ?? [])
  }

  // Save an uploaded image into the campaign's library so it can be reused
  async function saveToLibrary(imageUrl: string, name: string) {
    const { user } = await getCachedAuth()
    if (!user) return
    const { error } = await supabase.from('object_token_library').insert({
      campaign_id: campaignId,
      name: name || 'Untitled',
      image_url: imageUrl,
      uploaded_by: user.id,
    })
    if (error) console.warn('[CampaignObjects] saveToLibrary:', error.message)
    else loadLibrary()
  }

  async function handleAdd() {
    if (!addName.trim()) return
    setSaving(true)
    const portraitUrl = addCustomUrl || null
    let wpMax: number | null
    if (addIndestructible) {
      wpMax = null
    } else {
      const parsed = addWP ? parseInt(addWP, 10) : NaN
      wpMax = isNaN(parsed) ? 3 : parsed
    }

    if (activeSceneId) {
      // Scene is active — place directly.
      await supabase.from('scene_tokens').insert({
        scene_id: activeSceneId,
        name: addName.trim(),
        token_type: 'object',
        portrait_url: portraitUrl,
        color: addIcon,
        grid_x: 1, grid_y: 1,
        is_visible: true,
        wp_max: wpMax, wp_current: wpMax,
        properties: [], contents: [],
      })
      onTokenChanged?.()
      loadObjects()
    } else {
      // No scene — save as a library template with full metadata.
      const { user } = await getCachedAuth()
      if (user) {
        await supabase.from('object_token_library').insert({
          campaign_id: campaignId,
          name: addName.trim(),
          image_url: portraitUrl || `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><text x="32" y="46" text-anchor="middle" font-size="36">${OBJECT_ICONS.find(i => i.value === addIcon)?.emoji ?? '📦'}</text></svg>`)}`,
          uploaded_by: user.id,
          metadata: { icon: addIcon, wp_max: wpMax, indestructible: addIndestructible, properties: [], contents: [] },
        })
        loadLibrary()
      }
    }

    setAddName('')
    setAddIcon('crate')
    setAddWP('3')
    setAddIndestructible(false)
    setAddCustomUrl(null)
    setShowAdd(false)
    setSaving(false)
  }

  async function placeLibraryTemplate(lib: { id: string; name: string; image_url: string; metadata?: any }) {
    if (!activeSceneId || !lib.metadata) return
    const meta = lib.metadata
    const wpMax = meta.indestructible ? null : (meta.wp_max ?? 3)
    await supabase.from('scene_tokens').insert({
      scene_id: activeSceneId,
      name: lib.name,
      token_type: 'object',
      portrait_url: lib.image_url || null,
      color: meta.icon ?? 'crate',
      grid_x: 1, grid_y: 1,
      is_visible: true,
      wp_max: wpMax, wp_current: wpMax,
      properties: meta.properties ?? [],
      contents: meta.contents ?? [],
    })
    onTokenChanged?.()
    loadObjects()
  }

  // Generic uploader — takes a Blob (cropper outputs JPEG or PNG depending
  // on whether the input had transparency) and returns the public URL.
  // Throws on failure so callers can surface the message; a 30 s watchdog
  // guarantees we don't sit on a stalled connection forever.
  async function uploadBlob(blob: Blob, ext = 'jpg'): Promise<string> {
    const path = `${campaignId}/${crypto.randomUUID()}.${ext}`
    const contentType = blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg')
    console.log('[crop] uploading', { path, sizeKB: Math.round(blob.size / 1024), contentType })
    const uploadPromise = supabase.storage.from('object-tokens').upload(path, blob, { contentType })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Upload timed out after 30s. Check your connection and try again.')), 30000)
    )
    const { error } = await Promise.race([uploadPromise, timeoutPromise]) as { error: any }
    if (error) {
      console.warn('[CampaignObjects] upload error:', error.message)
      throw new Error(error.message || 'Upload failed.')
    }
    const { data: urlData } = supabase.storage.from('object-tokens').getPublicUrl(path)
    console.log('[crop] upload done', urlData.publicUrl)
    return urlData.publicUrl
  }

  // Cropper confirmed — upload the cropped blob and route to the right target.
  // mimeType comes from the cropper: 'image/png' if the input was PNG (so
  // transparent backgrounds round-trip correctly), 'image/jpeg' otherwise.
  async function handleCropConfirm(blob: Blob, mimeType: string = 'image/jpeg') {
    if (!cropFile) return
    setUploading(true)
    setCropUploadError(null)
    const ext = mimeType === 'image/png' ? 'png' : 'jpg'
    const t0 = performance.now()
    try {
      const url = await uploadBlob(blob, ext)
      const tUpload = performance.now()
      console.log(`[crop] upload phase took ${Math.round(tUpload - t0)}ms`)
      const defaultName = cropFile.file.name.replace(/\.[^.]+$/, '')
      if (cropFile.target === 'add') {
        setAddCustomUrl(url)
        const libName = (addName.trim() || defaultName).slice(0, 80)
        await saveToLibrary(url, libName)
      } else if (cropFile.target === 'edit' && editingObj) {
        await supabase.from('scene_tokens').update({ portrait_url: url }).eq('id', editingObj.id)
        setObjects(prev => prev.map(o => o.id === editingObj.id ? { ...o, portrait_url: url } : o))
        const libName = (editName.trim() || editingObj.name || defaultName).slice(0, 80)
        await saveToLibrary(url, libName)
      } else if (cropFile.target === 'edit-destroyed' && editingObj) {
        await supabase.from('scene_tokens').update({ destroyed_portrait_url: url }).eq('id', editingObj.id)
        setObjects(prev => prev.map(o => o.id === editingObj.id ? { ...o, destroyed_portrait_url: url } : o))
        // Save to library too so it's reusable on other objects (broken glass,
        // scorched crate, etc. tend to repeat across scenes).
        const libName = `${(editName.trim() || editingObj.name || defaultName).slice(0, 74)} (broken)`
        await saveToLibrary(url, libName)
      }
      console.log(`[crop] full upload+save took ${Math.round(performance.now() - t0)}ms`)
      setCropFile(null)
      setFileInputKey(k => k + 1)
    } catch (err: any) {
      console.error('[crop] upload failed', err)
      setCropUploadError(err?.message || 'Upload failed. Try again.')
      // Leave cropFile mounted so the user keeps their crop selection
    } finally {
      setUploading(false)
    }
  }

  function getIconEmoji(obj: ObjectToken): string {
    if (obj.portrait_url) return ''
    // Try to match by color (we store the icon value in color for emoji objects)
    const icon = OBJECT_ICONS.find(i => obj.color === i.value)
    return icon?.emoji ?? '📦'
  }

  const chipBtn: React.CSSProperties = {
    padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#d4cfc9', fontSize: '13px',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em',
    textTransform: 'uppercase', cursor: 'pointer',
  }

  return (
    <div style={{ padding: '4px' }}>
      {isGM && (
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ ...chipBtn, width: '100%', marginBottom: '6px', background: showAdd ? '#2a1210' : '#242424', border: `1px solid ${showAdd ? '#c0392b' : '#3a3a3a'}`, color: showAdd ? '#f5a89a' : '#d4cfc9' }}>
          {showAdd ? 'Cancel' : '+ Add Object'}
        </button>
      )}

      {showAdd && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '8px', marginBottom: '6px' }}>
          <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Object name..."
            style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', marginBottom: '6px' }} />

          <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '4px' }}>Icon</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '3px', marginBottom: '6px' }}>
            {OBJECT_ICONS.map(icon => (
              <button key={icon.value} onClick={() => { setAddIcon(icon.value); setAddCustomUrl(null) }}
                style={{ padding: '4px', border: `1px solid ${addIcon === icon.value && !addCustomUrl ? '#c0392b' : '#3a3a3a'}`, background: addIcon === icon.value && !addCustomUrl ? '#2a1210' : '#242424', borderRadius: '3px', cursor: 'pointer', textAlign: 'center', fontSize: '16px' }}
                title={icon.label}>
                {icon.emoji}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
            <label style={{ flex: 1, display: 'block', padding: '6px', background: addCustomUrl ? '#1a2e10' : '#242424', border: `1px dashed ${addCustomUrl ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: addCustomUrl ? '#7fc458' : '#5a5550', fontSize: '13px', textAlign: 'center', cursor: 'pointer' }}>
              {uploading ? 'Uploading...' : addCustomUrl ? '✓ Custom image — click to replace' : 'Or upload custom image'}
              <input key={`add-${fileInputKey}`} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile({ file: f, target: 'add' }); e.target.value = '' }} />
            </label>
            {addCustomUrl && !uploading && (
              <button onClick={() => setAddCustomUrl(null)} title="Clear uploaded image"
                style={{ padding: '6px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer' }}>×</button>
            )}
          </div>

          {/* Library picker — image items set portrait; template items (metadata) can be placed directly */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Or pick from library ({library.length})</div>
            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', minHeight: '40px', maxHeight: '96px', overflowY: 'auto', padding: '2px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              {library.length === 0 ? (
                <div style={{ width: '100%', padding: '10px 6px', textAlign: 'center', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', fontStyle: 'italic' }}>Empty — upload an image or save an object without a scene</div>
              ) : library.map(lib => (
                lib.metadata ? (
                  // Template item — shows name + WP chip; Place button when scene active
                  <div key={lib.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', padding: '3px 4px', background: '#1a1a1a', borderRadius: '2px', border: '1px solid #2e2e2e' }}>
                    <img src={lib.image_url} alt="" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lib.name}</span>
                    {lib.metadata.wp_max != null && (
                      <span style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif' }}>WP{lib.metadata.wp_max}</span>
                    )}
                    {lib.metadata.indestructible && (
                      <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif' }}>∞</span>
                    )}
                    {activeSceneId ? (
                      <button onClick={() => { placeLibraryTemplate(lib); setShowAdd(false) }}
                        style={{ padding: '1px 6px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '2px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', flexShrink: 0 }}>
                        ▶ Place
                      </button>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>staged</span>
                    )}
                  </div>
                ) : (
                  // Image-only item — sets portrait for the object being added
                  <button key={lib.id} title={lib.name}
                    onClick={() => setAddCustomUrl(lib.image_url)}
                    style={{ width: '36px', height: '36px', background: `url(${lib.image_url}) center/cover`, border: addCustomUrl === lib.image_url ? '2px solid #c0392b' : '1px solid #3a3a3a', borderRadius: '2px', cursor: 'pointer', padding: 0 }}
                  />
                )
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: addIndestructible ? '#5a5550' : '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>WP {addIndestructible ? '(disabled)' : '(default 3)'}</div>
              <input value={addIndestructible ? '' : addWP} onChange={e => setAddWP(e.target.value)} placeholder="e.g. 3" disabled={addIndestructible}
                style={{ width: '100%', padding: '4px 6px', background: addIndestructible ? '#1a1a1a' : '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: addIndestructible ? '#5a5550' : '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', cursor: 'pointer', fontSize: '13px', color: addIndestructible ? '#EF9F27' : '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
            <input type="checkbox" checked={addIndestructible} onChange={e => setAddIndestructible(e.target.checked)}
              style={{ cursor: 'pointer' }} />
            Indestructible (decorative only — not attackable)
          </label>

          <button onClick={handleAdd} disabled={!addName.trim() || saving}
            style={{ ...chipBtn, width: '100%', background: '#c0392b', border: '1px solid #c0392b', color: '#fff' }}>
            {saving ? 'Adding...' : activeSceneId ? 'Add to Scene' : 'Save to Library'}
          </button>
          {!activeSceneId && (
            <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textAlign: 'center', marginTop: '4px' }}>
              No active scene — object will be saved to your library for later.
            </div>
          )}
        </div>
      )}

      {objects.length === 0 && !showAdd && (
        <div style={{ color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', padding: '1rem' }}>
          {activeSceneId ? 'No objects in this scene' : 'No active scene — add objects to your library and place them when a scene is ready'}
        </div>
      )}

      {objects.map(obj => {
        const destroyed = obj.wp_max != null && obj.wp_current != null && obj.wp_current <= 0
        return (
          <div key={obj.id}
            onDragOver={e => { if (dragObjId) { e.preventDefault(); setDragOverObjId(obj.id) } }}
            onDragLeave={() => { if (dragOverObjId === obj.id) setDragOverObjId(null) }}
            onDrop={() => handleObjDrop(obj.id)}
            style={{ padding: '6px', marginBottom: '3px', background: dragOverObjId === obj.id ? '#242424' : '#1a1a1a', border: `1px solid ${dragOverObjId === obj.id ? '#7fc458' : '#2e2e2e'}`, borderRadius: '3px', opacity: destroyed ? 0.4 : dragObjId === obj.id ? 0.4 : 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Row 1 — identifier: handle, icon, name/WP, remove × */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isGM && (
                <div draggable onDragStart={() => setDragObjId(obj.id)} onDragEnd={() => { setDragObjId(null); setDragOverObjId(null) }}
                  title="Drag to reorder" style={{ cursor: 'grab', color: '#3a3a3a', fontSize: '14px', lineHeight: 1, userSelect: 'none', flexShrink: 0 }}>⠿</div>
              )}
              {obj.portrait_url ? (
                <img src={obj.portrait_url} alt="" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />
              ) : (
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{getIconEmoji(obj)}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj.name}</div>
                {obj.wp_max != null && (
                  <div style={{ fontSize: '13px', color: destroyed ? '#c0392b' : '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                    {destroyed ? 'DESTROYED' : `WP ${obj.wp_current}/${obj.wp_max}`}
                  </div>
                )}
                {/* Contents preview for GM on intact crates — chip per item with icon + short name.
                    Full item name + quantity shown on hover via title. */}
                {Array.isArray(obj.contents) && obj.contents.length > 0 && !destroyed && isGM && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '3px' }}>
                    {obj.contents.map((item, i) => (
                      <span key={i}
                        title={`${item.name} ×${item.quantity}${item.type === 'weapon' ? ' (weapon)' : ' (equipment)'}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '1px 5px', background: '#2a1d10', border: '1px solid #5a4a1b', borderRadius: '2px', fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.02em', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.type === 'weapon' ? '🔫' : '🎒'} {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {isGM && (
                <button onClick={() => onRemoveFromMap?.(obj.name)}
                  title="Remove from scene"
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '14px', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
              )}
            </div>
            {/* Revealed properties (and all properties for GM) — only rendered if any */}
            {Array.isArray(obj.properties) && obj.properties.filter(p => isGM || p.revealed || destroyed).length > 0 && (
              <div style={{ paddingLeft: '24px' }}>
                {obj.properties.filter(p => isGM || p.revealed || destroyed).map((p, i) => (
                  <div key={i} style={{ fontSize: '13px', color: (p.revealed || destroyed) ? '#cce0f5' : '#5a5550', fontFamily: 'Barlow, sans-serif', lineHeight: 1.3 }}>
                    <span style={{ color: '#EF9F27' }}>{p.key}:</span> {p.value}{!p.revealed && !destroyed && isGM ? ' 🔒' : ''}
                  </div>
                ))}
              </div>
            )}
            {/* Contents loot list — only when destroyed (players can take) */}
            {destroyed && Array.isArray(obj.contents) && obj.contents.length > 0 && (
              <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {obj.contents.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#f5f2ee' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.type === 'weapon' ? '🔫' : '🎒'} {item.name} ×{item.quantity}</span>
                    {entries && entries.length > 0 && (
                      <button onClick={e => { e.stopPropagation(); setLootingObj(obj); setLootCharId('') }}
                        style={{ background: 'none', border: '1px solid #2d5a1b', borderRadius: '2px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', padding: '0 6px', cursor: 'pointer', flexShrink: 0 }}>
                        Loot
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Row 2 — GM action buttons, even-width across the card */}
            {isGM && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={async () => {
                  const newVis = !obj.is_visible
                  await supabase.from('scene_tokens').update({ is_visible: newVis }).eq('id', obj.id)
                  setObjects(prev => prev.map(o => o.id === obj.id ? { ...o, is_visible: newVis } : o))
                  onTokenChanged?.()
                }}
                  style={{ flex: 1, padding: '3px 0', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: obj.is_visible ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {obj.is_visible ? 'Show' : 'Hide'}
                </button>
                <button onClick={async () => {
                  setEditingObj(obj); setEditName(obj.name); setEditWP(obj.wp_max != null ? String(obj.wp_max) : '3'); setEditIndestructible(obj.wp_max == null); setEditProps(Array.isArray(obj.properties) ? obj.properties : []); setEditContents(Array.isArray(obj.contents) ? obj.contents : []); setEditControllers(Array.isArray(obj.controlled_by_character_ids) ? obj.controlled_by_character_ids : [])
                  // Lazy-fetch campaign PCs the first time an edit modal
                  // opens. Two queries: campaign_members → characters,
                  // then profiles → username (the embedded
                  // profiles:user_id join is flaky because both tables
                  // reference auth.users but not each other directly).
                  if (campaignPcs.length === 0) {
                    const { data: memberRows } = await supabase
                      .from('campaign_members')
                      .select('user_id, characters:character_id(id, name)')
                      .eq('campaign_id', campaignId)
                      .not('character_id', 'is', null)
                    const rows = (memberRows ?? []) as any[]
                    const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)))
                    let nameByUser: Record<string, string> = {}
                    if (userIds.length > 0) {
                      const { data: profs } = await supabase
                        .from('profiles')
                        .select('id, username')
                        .in('id', userIds)
                      nameByUser = Object.fromEntries(((profs ?? []) as any[]).map(p => [p.id, p.username]))
                    }
                    const pcs: { id: string; name: string; ownerName?: string }[] = []
                    for (const r of rows) {
                      const c = r.characters as { id: string; name: string } | null
                      if (c) pcs.push({ id: c.id, name: c.name, ownerName: nameByUser[r.user_id] })
                    }
                    setCampaignPcs(pcs)
                  }
                }}
                  style={{ flex: 1, padding: '3px 0', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Edit
                </button>
                {onDuplicate && (
                  <button onClick={async () => { await onDuplicate(obj); loadObjects() }}
                    title="Duplicate this object (copies properties, contents, WP, lock state)"
                    style={{ flex: 1, padding: '3px 0', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Dup
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Loot modal */}
      {lootingObj && entries && (
        <div onClick={() => setLootingObj(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', width: '380px', maxWidth: '92vw' }}>
            <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>🎒 Loot from {lootingObj.name}</div>
            {lootingObj.contents.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow, sans-serif', marginBottom: '10px' }}>Nothing left inside.</div>
            ) : (
              <div style={{ marginBottom: '10px' }}>
                {lootingObj.contents.map((item, i) => {
                  const charId = lootItemPick[i] ?? ''
                  const busy = givingItemIdx === i
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', fontSize: '13px', fontFamily: 'Carlito, sans-serif', color: '#f5f2ee', borderBottom: '1px solid #2e2e2e' }}>
                      <span style={{ flex: 1 }}>
                        {item.type === 'weapon' ? '🔫' : '🎒'} {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                      <select
                        value={charId}
                        onChange={e => setLootItemPick(prev => ({ ...prev, [i]: e.target.value }))}
                        style={{ padding: '2px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none', maxWidth: '130px' }}>
                        <option value="">Give to...</option>
                        {entries.map(e => (
                          <option key={e.character.id} value={e.character.id}>{e.character.name}</option>
                        ))}
                      </select>
                      <button
                        disabled={!charId || busy}
                        onClick={async () => {
                          const charEntry = entries.find(e => e.character.id === charId)
                          if (!charEntry) return
                          setGivingItemIdx(i)
                          const currentEquip: string[] = charEntry.character.data?.equipment ?? []
                          const additions: string[] = []
                          for (let q = 0; q < item.quantity; q++) additions.push(item.name)
                          const updatedEquip = [...currentEquip, ...additions]
                          // Bail before mutating the object if the character
                          // write fails — otherwise the item would disappear
                          // (RLS denial / network hiccup, etc.).
                          const { error: charErr } = await supabase
                            .from('characters')
                            .update({ data: { ...charEntry.character.data, equipment: updatedEquip } })
                            .eq('id', charId)
                          if (charErr) {
                            alert(`Give failed: ${charErr.message}`)
                            setGivingItemIdx(null)
                            return
                          }
                          // Remove this item from the object's contents
                          const remaining = lootingObj.contents.filter((_, idx) => idx !== i)
                          const { error: tokenErr } = await supabase
                            .from('scene_tokens')
                            .update({ contents: remaining })
                            .eq('id', lootingObj.id)
                          if (tokenErr) {
                            alert(`Item went to character, but couldn't update the object: ${tokenErr.message}`)
                            setGivingItemIdx(null)
                            return
                          }
                          setObjects(prev => prev.map(o => o.id === lootingObj.id ? { ...o, contents: remaining } : o))
                          setLootingObj({ ...lootingObj, contents: remaining })
                          // Reindex per-item picks (later indices shift down by 1)
                          setLootItemPick(prev => {
                            const next: Record<number, string> = {}
                            for (const [k, v] of Object.entries(prev)) {
                              const idx = Number(k)
                              if (idx === i) continue
                              next[idx > i ? idx - 1 : idx] = v
                            }
                            return next
                          })
                          onLoot?.(lootingObj.name, item, charId, charEntry.character.name)
                          setGivingItemIdx(null)
                        }}
                        style={{ padding: '2px 8px', background: charId ? '#1a2e10' : '#242424', border: `1px solid ${charId ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: charId ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: charId && !busy ? 'pointer' : 'not-allowed' }}>
                        {busy ? '…' : 'Give'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Bulk path stays for "give everything to one PC" — useful
                when the GM doesn't need granularity. */}
            {lootingObj.contents.length > 0 && (
              <>
                <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '4px' }}>Or Loot All to</div>
                <select value={lootCharId} onChange={e => setLootCharId(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none', marginBottom: '10px' }}>
                  <option value="">Select character...</option>
                  {entries.map(e => <option key={e.character.id} value={e.character.id}>{e.character.name}</option>)}
                </select>
              </>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              {lootingObj.contents.length > 0 && (
                <button disabled={!lootCharId} onClick={async () => {
                  if (!lootCharId) return
                  const charEntry = entries.find(e => e.character.id === lootCharId)
                  if (!charEntry) return
                  const currentEquip: string[] = charEntry.character.data?.equipment ?? []
                  const newItems: string[] = []
                  for (const item of lootingObj.contents) {
                    for (let q = 0; q < item.quantity; q++) newItems.push(item.name)
                  }
                  const updatedEquip = [...currentEquip, ...newItems]
                  // Bail before clearing the object if the character write
                  // fails — otherwise the loot vanishes (RLS denial, network
                  // hiccup, etc. all silently dropped items pre-fix).
                  const { error: charErr } = await supabase
                    .from('characters')
                    .update({ data: { ...charEntry.character.data, equipment: updatedEquip } })
                    .eq('id', lootCharId)
                  if (charErr) {
                    alert(`Loot failed: ${charErr.message}`)
                    return
                  }
                  const { error: tokenErr } = await supabase
                    .from('scene_tokens')
                    .update({ contents: [] })
                    .eq('id', lootingObj.id)
                  if (tokenErr) {
                    // Items already on the character — surface so GM knows
                    // the object still shows contents and can clear manually.
                    alert(`Items transferred to character, but couldn't clear the object: ${tokenErr.message}`)
                    return
                  }
                  setObjects(prev => prev.map(o => o.id === lootingObj.id ? { ...o, contents: [] } : o))
                  for (const item of lootingObj.contents) {
                    onLoot?.(lootingObj.name, item, lootCharId, charEntry.character.name)
                  }
                  setLootingObj(null)
                  setLootItemPick({})
                }}
                  style={{ ...chipBtn, flex: 1, background: lootCharId ? '#1a2e10' : '#242424', border: `1px solid ${lootCharId ? '#2d5a1b' : '#3a3a3a'}`, color: lootCharId ? '#7fc458' : '#5a5550' }}>
                  Loot All
                </button>
              )}
              <button onClick={() => { setLootingObj(null); setLootItemPick({}) }} style={{ ...chipBtn, flex: 1 }}>{lootingObj.contents.length === 0 ? 'Done' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingObj && (
        <div onClick={() => setEditingObj(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', width: '280px' }}>
            <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '10px' }}>Edit Object</div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>Name</div>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '4px' }}>
              <div style={{ fontSize: '13px', color: editIndestructible ? '#5a5550' : '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>WP {editIndestructible ? '(disabled)' : ''}</div>
              <input value={editIndestructible ? '' : editWP} onChange={e => setEditWP(e.target.value)} placeholder="e.g. 3" disabled={editIndestructible}
                style={{ width: '100%', padding: '4px 6px', background: editIndestructible ? '#1a1a1a' : '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: editIndestructible ? '#5a5550' : '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', cursor: 'pointer', fontSize: '13px', color: editIndestructible ? '#EF9F27' : '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              <input type="checkbox" checked={editIndestructible} onChange={e => setEditIndestructible(e.target.checked)}
                style={{ cursor: 'pointer' }} />
              Indestructible (decorative only — not attackable)
            </label>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ ...LABEL_STYLE_TIGHT, marginBottom: '2px' }}>Image</div>
              <label style={{ display: 'block', padding: '6px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px', textAlign: 'center', cursor: 'pointer', marginBottom: '4px' }}>
                {uploading ? 'Uploading...' : 'Upload new image'}
                <input key={`edit-${fileInputKey}`} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile({ file: f, target: 'edit' }); e.target.value = '' }} />
              </label>
              {/* Library picker — always visible so GM knows it exists */}
              <div>
                <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Or pick from library ({library.length})</div>
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', minHeight: '40px', maxHeight: '80px', overflowY: 'auto', padding: '2px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                  {library.length === 0 ? (
                    <div style={{ width: '100%', padding: '10px 6px', textAlign: 'center', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', fontStyle: 'italic' }}>Empty — upload an image and it'll show here</div>
                  ) : library.map(lib => (
                    <button key={lib.id} title={lib.name}
                      onClick={async () => {
                        await supabase.from('scene_tokens').update({ portrait_url: lib.image_url }).eq('id', editingObj.id)
                        setObjects(prev => prev.map(o => o.id === editingObj.id ? { ...o, portrait_url: lib.image_url } : o))
                      }}
                      style={{ width: '36px', height: '36px', background: `url(${lib.image_url}) center/cover`, border: editingObj.portrait_url === lib.image_url ? '2px solid #c0392b' : '1px solid #3a3a3a', borderRadius: '2px', cursor: 'pointer', padding: 0 }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {/* Destroyed image — optional alt portrait shown when WP hits 0 */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <div style={{ ...LABEL_STYLE_TIGHT }}>Destroyed image (optional)</div>
                {editingObj.destroyed_portrait_url && (
                  <button onClick={async () => {
                    await supabase.from('scene_tokens').update({ destroyed_portrait_url: null }).eq('id', editingObj.id)
                    setObjects(prev => prev.map(o => o.id === editingObj.id ? { ...o, destroyed_portrait_url: null } : o))
                  }}
                    style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', padding: '1px 6px', cursor: 'pointer' }}>Clear</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                {editingObj.destroyed_portrait_url && (
                  <img src={editingObj.destroyed_portrait_url} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #3a3a3a', flexShrink: 0 }} />
                )}
                <label style={{ flex: 1, display: 'block', padding: '6px', background: editingObj.destroyed_portrait_url ? '#1a2e10' : '#242424', border: `1px dashed ${editingObj.destroyed_portrait_url ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: editingObj.destroyed_portrait_url ? '#7fc458' : '#5a5550', fontSize: '13px', textAlign: 'center', cursor: 'pointer' }}>
                  {uploading ? 'Uploading...' : editingObj.destroyed_portrait_url ? 'Replace destroyed image' : 'Upload destroyed image'}
                  <input key={`destroyed-${fileInputKey}`} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile({ file: f, target: 'edit-destroyed' }); e.target.value = '' }} />
                </label>
              </div>
              <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow, sans-serif', fontStyle: 'italic', marginTop: '3px' }}>Shown on the tactical map when WP hits 0. Leave blank to keep the fade + shatter overlay.</div>
            </div>
            {/* Properties */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ ...LABEL_STYLE_TIGHT }}>Properties</div>
                <button onClick={() => setEditProps(prev => [...prev, { key: '', value: '', revealed: false }])}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', padding: '1px 6px', cursor: 'pointer' }}>+ Add</button>
              </div>
              {editProps.map((prop, i) => (
                <div key={i} style={{ display: 'flex', gap: '3px', marginBottom: '3px', alignItems: 'center' }}>
                  <input value={prop.key} onChange={e => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, key: e.target.value } : p))}
                    placeholder="Key"
                    style={{ width: '70px', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                  <input value={prop.value} onChange={e => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, value: e.target.value } : p))}
                    placeholder="Value"
                    style={{ flex: 1, padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                  <button onClick={() => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, revealed: !p.revealed } : p))}
                    title={prop.revealed ? 'Visible to players' : 'Hidden from players'}
                    style={{ background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '0 2px', color: prop.revealed ? '#7fc458' : '#5a5550' }}>
                    {prop.revealed ? '👁' : '👁‍🗨'}
                  </button>
                  <button onClick={() => setEditProps(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
                </div>
              ))}
              {editProps.length === 0 && <div style={{ fontSize: '13px', color: '#5a5550', fontStyle: 'italic' }}>No properties set</div>}
            </div>

            {/* Contents — lootable items */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ ...LABEL_STYLE_TIGHT }}>Contents (Lootable)</div>
              </div>
              {editContents.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '3px', marginBottom: '3px', alignItems: 'center' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#f5f2ee' }}>{item.type === 'weapon' ? '🔫' : '🎒'} {item.name}</span>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>×{item.quantity}</span>
                  <button onClick={() => setEditContents(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <select value={contentPickerValue} onChange={e => setContentPickerValue(e.target.value)}
                  style={{ flex: 1, padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                  <option value="">Add item...</option>
                  <optgroup label="Weapons">
                    {ALL_WEAPONS.map(w => <option key={w.name} value={`weapon:${w.name}`}>{w.name}</option>)}
                  </optgroup>
                  <optgroup label="Equipment">
                    {EQUIPMENT.map(e => <option key={e.name} value={`equipment:${e.name}`}>{e.name}</option>)}
                  </optgroup>
                </select>
                <input type="number" min={1} max={99} value={contentQty} onChange={e => setContentQty(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '32px', padding: '3px 2px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', textAlign: 'center' }} />
                <button onClick={() => {
                  if (!contentPickerValue) return
                  const [type, ...nameParts] = contentPickerValue.split(':')
                  const name = nameParts.join(':')
                  setEditContents(prev => [...prev, { type: type as 'weapon' | 'equipment', name, quantity: contentQty }])
                  setContentPickerValue('')
                  setContentQty(1)
                }}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', fontSize: '13px', padding: '2px 6px', cursor: 'pointer' }}>+</button>
              </div>
            </div>

            {/* Controlled By — opt-in list of PCs allowed to drag this
                token on the tactical map. Empty = GM-only (the default).
                Useful for vehicle objects so the driver can move the
                token, or for any prop the GM wants a player to push
                around without GM intervention. */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ ...LABEL_STYLE_TIGHT }}>Controlled By</span>
                <span style={{ fontSize: '13px', color: '#5a5550' }}>{editControllers.length === 0 ? 'GM only' : `${editControllers.length} PC${editControllers.length === 1 ? '' : 's'}`}</span>
              </div>
              {campaignPcs.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#5a5550', fontStyle: 'italic' }}>No player characters in this campaign yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '140px', overflowY: 'auto', padding: '4px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                  {campaignPcs.map(pc => {
                    const checked = editControllers.includes(pc.id)
                    return (
                      <label key={pc.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 6px', cursor: 'pointer', borderRadius: '2px', background: checked ? '#1a2e10' : 'transparent', border: `1px solid ${checked ? '#2d5a1b' : 'transparent'}` }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setEditControllers(prev => checked ? prev.filter(id => id !== pc.id) : [...prev, pc.id])}
                          style={{ accentColor: '#7fc458', cursor: 'pointer' }} />
                        <span style={{ flex: 1, fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{pc.name}</span>
                        {pc.ownerName && <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>{pc.ownerName}</span>}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={async () => {
                let wpVal: number | null
                if (editIndestructible) {
                  wpVal = null
                } else {
                  const parsed = editWP ? parseInt(editWP, 10) : NaN
                  wpVal = isNaN(parsed) ? 3 : parsed
                }
                const cleanProps = editProps.filter(p => p.key.trim())
                await supabase.from('scene_tokens').update({
                  name: editName.trim() || editingObj.name,
                  wp_max: wpVal,
                  wp_current: wpVal,
                  properties: cleanProps,
                  contents: editContents,
                  controlled_by_character_ids: editControllers,
                }).eq('id', editingObj.id)
                setObjects(prev => prev.map(o => o.id === editingObj.id ? { ...o, name: editName.trim() || o.name, wp_max: wpVal, wp_current: wpVal, properties: cleanProps, contents: editContents, controlled_by_character_ids: editControllers } : o))
                setEditingObj(null)
              }}
                style={{ ...chipBtn, flex: 1, background: '#c0392b', border: '1px solid #c0392b', color: '#fff' }}>Save</button>
              <button onClick={() => setEditingObj(null)}
                style={{ ...chipBtn, flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Image crop modal — appears when a file is selected via Upload */}
      {cropFile && (
        <ObjectImageCropper
          file={cropFile.file}
          onCancel={() => { setCropFile(null); setCropUploadError(null) }}
          onCrop={(blob, _preview, mimeType) => handleCropConfirm(blob, mimeType)}
          uploadError={cropUploadError}
          onClearError={() => setCropUploadError(null)}
        />
      )}
    </div>
  )
}

export { OBJECT_ICONS }
