'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { ALL_WEAPONS } from '../lib/weapons'
import { EQUIPMENT } from '../lib/xse-schema'
import ObjectImageCropper from './ObjectImageCropper'

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
  grid_x: number
  grid_y: number
  is_visible: boolean
  wp_max: number | null
  wp_current: number | null
  color: string
  properties: TokenProperty[]
  contents: ContentItem[]
}

interface Props {
  campaignId: string
  isGM: boolean
  onPlaceOnMap?: (name: string, portraitUrl: string | null, wpMax: number | null) => void
  onRemoveFromMap?: (name: string) => void
  onLoot?: (objectName: string, item: ContentItem, characterId: string, characterName: string) => void
  onDuplicate?: (source: ObjectToken) => void | Promise<void>
  tokenRefreshKey?: number
  entries?: { character: { id: string; name: string; data: any }; userId: string }[]
}

export default function CampaignObjects({ campaignId, isGM, onPlaceOnMap, onRemoveFromMap, onLoot, onDuplicate, tokenRefreshKey, entries }: Props) {
  const supabase = createClient()
  const [objects, setObjects] = useState<ObjectToken[]>([])
  const [library, setLibrary] = useState<{ id: string; name: string; image_url: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addIcon, setAddIcon] = useState('crate')
  const [addWP, setAddWP] = useState('')
  const [addCustomUrl, setAddCustomUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingObj, setEditingObj] = useState<ObjectToken | null>(null)
  const [editName, setEditName] = useState('')
  const [editWP, setEditWP] = useState('')
  const [editProps, setEditProps] = useState<TokenProperty[]>([])
  const [editContents, setEditContents] = useState<ContentItem[]>([])
  const [contentPickerValue, setContentPickerValue] = useState('')
  const [contentQty, setContentQty] = useState(1)
  const [lootingObj, setLootingObj] = useState<ObjectToken | null>(null)
  const [lootCharId, setLootCharId] = useState('')
  // Crop modal — selected file waits here until user confirms crop, then uploads.
  // `target` distinguishes between the Add-object flow and the Edit-object flow
  // so we know where to apply the resulting URL.
  const [cropFile, setCropFile] = useState<{ file: File; target: 'add' | 'edit' } | null>(null)
  const [dragObjId, setDragObjId] = useState<string | null>(null)
  const [dragOverObjId, setDragOverObjId] = useState<string | null>(null)

  function handleObjDrop(targetId: string) {
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
  }

  useEffect(() => { loadObjects(); loadLibrary() }, [campaignId, tokenRefreshKey])

  async function loadObjects() {
    const { data: scenes } = await supabase.from('tactical_scenes').select('id').eq('campaign_id', campaignId).eq('is_active', true).limit(1)
    if (!scenes || scenes.length === 0) { setObjects([]); return }
    const { data } = await supabase.from('scene_tokens').select('*').eq('scene_id', scenes[0].id).eq('token_type', 'object')
    setObjects((data ?? []) as ObjectToken[])
  }

  async function loadLibrary() {
    const { data } = await supabase
      .from('object_token_library')
      .select('id, name, image_url')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
    setLibrary(data ?? [])
  }

  // Save an uploaded image into the campaign's library so it can be reused
  async function saveToLibrary(imageUrl: string, name: string) {
    const { data: { user } } = await supabase.auth.getUser()
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
    const icon = OBJECT_ICONS.find(i => i.value === addIcon)
    const portraitUrl = addCustomUrl || null
    const wpMax = addWP ? parseInt(addWP, 10) : null
    onPlaceOnMap?.(addName.trim(), portraitUrl, isNaN(wpMax as number) ? null : wpMax)
    setAddName('')
    setAddIcon('crate')
    setAddWP('')
    setAddCustomUrl(null)
    setShowAdd(false)
    setSaving(false)
  }

  // Generic uploader — takes a Blob (cropper outputs JPEG) and returns the public URL.
  async function uploadBlob(blob: Blob, ext = 'jpg'): Promise<string | null> {
    const path = `${campaignId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('object-tokens').upload(path, blob, { contentType: blob.type || 'image/jpeg' })
    if (error) { console.warn('[CampaignObjects] upload error:', error.message); return null }
    const { data: urlData } = supabase.storage.from('object-tokens').getPublicUrl(path)
    return urlData.publicUrl
  }

  // Cropper confirmed — upload the cropped blob and route to the right target.
  async function handleCropConfirm(blob: Blob) {
    if (!cropFile) return
    setUploading(true)
    const url = await uploadBlob(blob)
    if (url) {
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
      }
    }
    setUploading(false)
    setCropFile(null)
  }

  function getIconEmoji(obj: ObjectToken): string {
    if (obj.portrait_url) return ''
    // Try to match by color (we store the icon value in color for emoji objects)
    const icon = OBJECT_ICONS.find(i => obj.color === i.value)
    return icon?.emoji ?? '📦'
  }

  const chipBtn: React.CSSProperties = {
    padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a',
    borderRadius: '3px', color: '#d4cfc9', fontSize: '11px',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em',
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

          <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Icon</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '3px', marginBottom: '6px' }}>
            {OBJECT_ICONS.map(icon => (
              <button key={icon.value} onClick={() => { setAddIcon(icon.value); setAddCustomUrl(null) }}
                style={{ padding: '4px', border: `1px solid ${addIcon === icon.value && !addCustomUrl ? '#c0392b' : '#3a3a3a'}`, background: addIcon === icon.value && !addCustomUrl ? '#2a1210' : '#242424', borderRadius: '3px', cursor: 'pointer', textAlign: 'center', fontSize: '16px' }}
                title={icon.label}>
                {icon.emoji}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', padding: '6px', background: addCustomUrl ? '#1a2e10' : '#242424', border: `1px dashed ${addCustomUrl ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: addCustomUrl ? '#7fc458' : '#5a5550', fontSize: '11px', textAlign: 'center', cursor: 'pointer', marginBottom: '6px' }}>
            {uploading ? 'Uploading...' : addCustomUrl ? '✓ Custom image uploaded' : 'Or upload custom image'}
            <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile({ file: f, target: 'add' }); e.target.value = '' }} />
          </label>

          {/* Library picker — always visible so GM knows it exists */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '10px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Or pick from library ({library.length})</div>
            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', minHeight: '40px', maxHeight: '72px', overflowY: 'auto', padding: '2px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              {library.length === 0 ? (
                <div style={{ width: '100%', padding: '10px 6px', textAlign: 'center', color: '#5a5550', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontStyle: 'italic' }}>Empty — upload an image and it'll show here</div>
              ) : library.map(lib => (
                <button key={lib.id} title={lib.name}
                  onClick={() => setAddCustomUrl(lib.image_url)}
                  style={{ width: '36px', height: '36px', background: `url(${lib.image_url}) center/cover`, border: addCustomUrl === lib.image_url ? '2px solid #c0392b' : '1px solid #3a3a3a', borderRadius: '2px', cursor: 'pointer', padding: 0 }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>WP (optional)</div>
              <input value={addWP} onChange={e => setAddWP(e.target.value)} placeholder="e.g. 10"
                style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
          </div>

          <button onClick={handleAdd} disabled={!addName.trim() || saving}
            style={{ ...chipBtn, width: '100%', background: '#c0392b', border: '1px solid #c0392b', color: '#fff' }}>
            {saving ? 'Adding...' : 'Add to Scene'}
          </button>
        </div>
      )}

      {objects.length === 0 && !showAdd && (
        <div style={{ color: '#3a3a3a', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', padding: '1rem' }}>
          No objects in this scene
        </div>
      )}

      {objects.map(obj => {
        const destroyed = obj.wp_max != null && obj.wp_current != null && obj.wp_current <= 0
        return (
          <div key={obj.id}
            onDragOver={e => { if (dragObjId) { e.preventDefault(); setDragOverObjId(obj.id) } }}
            onDragLeave={() => { if (dragOverObjId === obj.id) setDragOverObjId(null) }}
            onDrop={() => handleObjDrop(obj.id)}
            style={{ padding: '4px 6px', marginBottom: '3px', background: dragOverObjId === obj.id ? '#242424' : '#1a1a1a', border: `1px solid ${dragOverObjId === obj.id ? '#7fc458' : '#2e2e2e'}`, borderRadius: '3px', opacity: destroyed ? 0.4 : dragObjId === obj.id ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isGM && (
              <div draggable onDragStart={() => setDragObjId(obj.id)} onDragEnd={() => { setDragObjId(null); setDragOverObjId(null) }}
                title="Drag to reorder" style={{ cursor: 'grab', color: '#3a3a3a', fontSize: '14px', lineHeight: 1, userSelect: 'none', flexShrink: 0 }}>⠿</div>
            )}
            {obj.portrait_url ? (
              <img src={obj.portrait_url} alt="" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '3px' }} />
            ) : (
              <span style={{ fontSize: '16px' }}>{getIconEmoji(obj)}</span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj.name}</div>
              {obj.wp_max != null && (
                <div style={{ fontSize: '10px', color: destroyed ? '#c0392b' : '#7fc458', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {destroyed ? 'DESTROYED' : `WP ${obj.wp_current}/${obj.wp_max}`}
                </div>
              )}
              {/* Properties — auto-reveal when destroyed */}
              {Array.isArray(obj.properties) && obj.properties.filter(p => isGM || p.revealed || destroyed).map((p, i) => (
                <div key={i} style={{ fontSize: '10px', color: (p.revealed || destroyed) ? '#cce0f5' : '#5a5550', fontFamily: 'Barlow, sans-serif' }}>
                  <span style={{ color: '#EF9F27' }}>{p.key}:</span> {p.value}{!p.revealed && !destroyed && isGM ? ' 🔒' : ''}
                </div>
              ))}
              {/* Contents — show when destroyed, with loot buttons */}
              {Array.isArray(obj.contents) && obj.contents.length > 0 && (destroyed || isGM) && (
                <div style={{ marginTop: '2px' }}>
                  {obj.contents.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#f5f2ee' }}>
                      <span>{item.type === 'weapon' ? '🔫' : '🎒'} {item.name} ×{item.quantity}</span>
                      {destroyed && entries && entries.length > 0 && (
                        <button onClick={e => { e.stopPropagation(); setLootingObj(obj); setLootCharId('') }}
                          style={{ background: 'none', border: '1px solid #2d5a1b', borderRadius: '2px', color: '#7fc458', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', padding: '0 4px', cursor: 'pointer' }}>
                          Loot
                        </button>
                      )}
                      {!destroyed && isGM && <span style={{ color: '#5a5550' }}>🔒</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {isGM && (
              <div style={{ display: 'flex', gap: '3px' }}>
                <button onClick={async () => {
                  const newVis = !obj.is_visible
                  await supabase.from('scene_tokens').update({ is_visible: newVis }).eq('id', obj.id)
                  setObjects(prev => prev.map(o => o.id === obj.id ? { ...o, is_visible: newVis } : o))
                }}
                  style={{ padding: '2px 6px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: obj.is_visible ? '#7fc458' : '#5a5550', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {obj.is_visible ? 'Show' : 'Hide'}
                </button>
                <button onClick={() => { setEditingObj(obj); setEditName(obj.name); setEditWP(obj.wp_max != null ? String(obj.wp_max) : ''); setEditProps(Array.isArray(obj.properties) ? obj.properties : []); setEditContents(Array.isArray(obj.contents) ? obj.contents : []) }}
                  style={{ padding: '2px 6px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Edit
                </button>
                {onDuplicate && (
                  <button onClick={async () => { await onDuplicate(obj); loadObjects() }}
                    title="Duplicate this object (copies properties, contents, WP, lock state)"
                    style={{ padding: '2px 6px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7ab3d4', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Dup
                  </button>
                )}
                <button onClick={() => onRemoveFromMap?.(obj.name)}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
            )}
          </div>
        )
      })}

      {/* Loot modal */}
      {lootingObj && entries && (
        <div onClick={() => setLootingObj(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', width: '280px' }}>
            <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>🎒 Loot from {lootingObj.name}</div>
            <div style={{ marginBottom: '8px' }}>
              {lootingObj.contents.map((item, i) => (
                <div key={i} style={{ fontSize: '12px', color: '#f5f2ee', marginBottom: '2px' }}>
                  {item.type === 'weapon' ? '🔫' : '🎒'} {item.name} ×{item.quantity}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Give to</div>
            <select value={lootCharId} onChange={e => setLootCharId(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none', marginBottom: '10px' }}>
              <option value="">Select character...</option>
              {entries.map(e => <option key={e.character.id} value={e.character.id}>{e.character.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={!lootCharId} onClick={async () => {
                if (!lootCharId) return
                const charEntry = entries.find(e => e.character.id === lootCharId)
                if (!charEntry) return
                // Add items to character equipment
                const currentEquip: string[] = charEntry.character.data?.equipment ?? []
                const newItems: string[] = []
                for (const item of lootingObj.contents) {
                  for (let q = 0; q < item.quantity; q++) newItems.push(item.name)
                }
                const updatedEquip = [...currentEquip, ...newItems]
                await supabase.from('characters').update({ data: { ...charEntry.character.data, equipment: updatedEquip } }).eq('id', lootCharId)
                // Clear contents from the object
                await supabase.from('scene_tokens').update({ contents: [] }).eq('id', lootingObj.id)
                setObjects(prev => prev.map(o => o.id === lootingObj.id ? { ...o, contents: [] } : o))
                // Callback for log entry
                for (const item of lootingObj.contents) {
                  onLoot?.(lootingObj.name, item, lootCharId, charEntry.character.name)
                }
                setLootingObj(null)
              }}
                style={{ ...chipBtn, flex: 1, background: lootCharId ? '#1a2e10' : '#242424', border: `1px solid ${lootCharId ? '#2d5a1b' : '#3a3a3a'}`, color: lootCharId ? '#7fc458' : '#5a5550' }}>
                Loot All
              </button>
              <button onClick={() => setLootingObj(null)} style={{ ...chipBtn, flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingObj && (
        <div onClick={() => setEditingObj(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', width: '280px' }}>
            <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px' }}>Edit Object</div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Name</div>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>WP (leave empty for indestructible)</div>
              <input value={editWP} onChange={e => setEditWP(e.target.value)} placeholder="e.g. 10"
                style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Image</div>
              <label style={{ display: 'block', padding: '6px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '12px', textAlign: 'center', cursor: 'pointer', marginBottom: '4px' }}>
                {uploading ? 'Uploading...' : 'Upload new image'}
                <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile({ file: f, target: 'edit' }); e.target.value = '' }} />
              </label>
              {/* Library picker — always visible so GM knows it exists */}
              <div>
                <div style={{ fontSize: '10px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Or pick from library ({library.length})</div>
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', minHeight: '40px', maxHeight: '80px', overflowY: 'auto', padding: '2px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                  {library.length === 0 ? (
                    <div style={{ width: '100%', padding: '10px 6px', textAlign: 'center', color: '#5a5550', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontStyle: 'italic' }}>Empty — upload an image and it'll show here</div>
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
            {/* Properties */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>Properties</div>
                <button onClick={() => setEditProps(prev => [...prev, { key: '', value: '', revealed: false }])}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', padding: '1px 6px', cursor: 'pointer' }}>+ Add</button>
              </div>
              {editProps.map((prop, i) => (
                <div key={i} style={{ display: 'flex', gap: '3px', marginBottom: '3px', alignItems: 'center' }}>
                  <input value={prop.key} onChange={e => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, key: e.target.value } : p))}
                    placeholder="Key"
                    style={{ width: '70px', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                  <input value={prop.value} onChange={e => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, value: e.target.value } : p))}
                    placeholder="Value"
                    style={{ flex: 1, padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                  <button onClick={() => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, revealed: !p.revealed } : p))}
                    title={prop.revealed ? 'Visible to players' : 'Hidden from players'}
                    style={{ background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '0 2px', color: prop.revealed ? '#7fc458' : '#5a5550' }}>
                    {prop.revealed ? '👁' : '👁‍🗨'}
                  </button>
                  <button onClick={() => setEditProps(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
                </div>
              ))}
              {editProps.length === 0 && <div style={{ fontSize: '12px', color: '#5a5550', fontStyle: 'italic' }}>No properties set</div>}
            </div>

            {/* Contents — lootable items */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>Contents (Lootable)</div>
              </div>
              {editContents.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '3px', marginBottom: '3px', alignItems: 'center' }}>
                  <span style={{ flex: 1, fontSize: '12px', color: '#f5f2ee' }}>{item.type === 'weapon' ? '🔫' : '🎒'} {item.name}</span>
                  <span style={{ fontSize: '12px', color: '#cce0f5' }}>×{item.quantity}</span>
                  <button onClick={() => setEditContents(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <select value={contentPickerValue} onChange={e => setContentPickerValue(e.target.value)}
                  style={{ flex: 1, padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                  <option value="">Add item...</option>
                  <optgroup label="Weapons">
                    {ALL_WEAPONS.map(w => <option key={w.name} value={`weapon:${w.name}`}>{w.name}</option>)}
                  </optgroup>
                  <optgroup label="Equipment">
                    {EQUIPMENT.map(e => <option key={e.name} value={`equipment:${e.name}`}>{e.name}</option>)}
                  </optgroup>
                </select>
                <input type="number" min={1} max={99} value={contentQty} onChange={e => setContentQty(parseInt(e.target.value) || 1)}
                  style={{ width: '32px', padding: '3px 2px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '12px', textAlign: 'center' }} />
                <button onClick={() => {
                  if (!contentPickerValue) return
                  const [type, ...nameParts] = contentPickerValue.split(':')
                  const name = nameParts.join(':')
                  setEditContents(prev => [...prev, { type: type as 'weapon' | 'equipment', name, quantity: contentQty }])
                  setContentPickerValue('')
                  setContentQty(1)
                }}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', fontSize: '12px', padding: '2px 6px', cursor: 'pointer' }}>+</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={async () => {
                const wpVal = editWP ? parseInt(editWP, 10) : null
                const cleanProps = editProps.filter(p => p.key.trim())
                await supabase.from('scene_tokens').update({
                  name: editName.trim() || editingObj.name,
                  wp_max: isNaN(wpVal as number) ? null : wpVal,
                  wp_current: isNaN(wpVal as number) ? null : wpVal,
                  properties: cleanProps,
                  contents: editContents,
                }).eq('id', editingObj.id)
                setObjects(prev => prev.map(o => o.id === editingObj.id ? { ...o, name: editName.trim() || o.name, wp_max: wpVal, wp_current: wpVal, properties: cleanProps, contents: editContents } : o))
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
          onCancel={() => setCropFile(null)}
          onCrop={blob => handleCropConfirm(blob)}
        />
      )}
    </div>
  )
}

export { OBJECT_ICONS }
