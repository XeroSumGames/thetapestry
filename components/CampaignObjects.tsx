'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

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
  revealed: boolean // visible to players?
}

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
}

interface Props {
  campaignId: string
  isGM: boolean
  onPlaceOnMap?: (name: string, portraitUrl: string | null, wpMax: number | null) => void
  onRemoveFromMap?: (name: string) => void
  tokenRefreshKey?: number
}

export default function CampaignObjects({ campaignId, isGM, onPlaceOnMap, onRemoveFromMap, tokenRefreshKey }: Props) {
  const supabase = createClient()
  const [objects, setObjects] = useState<ObjectToken[]>([])
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

  useEffect(() => { loadObjects() }, [campaignId, tokenRefreshKey])

  async function loadObjects() {
    const { data: scenes } = await supabase.from('tactical_scenes').select('id').eq('campaign_id', campaignId).eq('is_active', true).limit(1)
    if (!scenes || scenes.length === 0) { setObjects([]); return }
    const { data } = await supabase.from('scene_tokens').select('*').eq('scene_id', scenes[0].id).eq('token_type', 'object')
    setObjects((data ?? []) as ObjectToken[])
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

  async function handleUpload(file: File) {
    setUploading(true)
    const path = `${campaignId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('object-tokens').upload(path, file, { contentType: file.type })
    if (!error) {
      const { data: urlData } = supabase.storage.from('object-tokens').getPublicUrl(path)
      setAddCustomUrl(urlData.publicUrl)
    }
    setUploading(false)
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
            <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]) }} />
          </label>

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
          <div key={obj.id} style={{ padding: '4px 6px', marginBottom: '3px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', opacity: destroyed ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              {Array.isArray(obj.properties) && obj.properties.filter(p => isGM || p.revealed).map((p, i) => (
                <div key={i} style={{ fontSize: '10px', color: p.revealed ? '#cce0f5' : '#5a5550', fontFamily: 'Barlow, sans-serif' }}>
                  <span style={{ color: '#EF9F27' }}>{p.key}:</span> {p.value}{!p.revealed && isGM ? ' 🔒' : ''}
                </div>
              ))}
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
                <button onClick={() => { setEditingObj(obj); setEditName(obj.name); setEditWP(obj.wp_max != null ? String(obj.wp_max) : ''); setEditProps(Array.isArray(obj.properties) ? obj.properties : []) }}
                  style={{ padding: '2px 6px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => onRemoveFromMap?.(obj.name)}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
            )}
          </div>
        )
      })}

      {/* Edit modal */}
      {editingObj && (
        <div onClick={() => setEditingObj(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', width: '280px' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px' }}>Edit Object</div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Name</div>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>WP (leave empty for indestructible)</div>
              <input value={editWP} onChange={e => setEditWP(e.target.value)} placeholder="e.g. 10"
                style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Image</div>
              <label style={{ display: 'block', padding: '6px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '11px', textAlign: 'center', cursor: 'pointer' }}>
                {uploading ? 'Uploading...' : 'Upload new image'}
                <input type="file" accept="image/*" hidden onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  const path = `${campaignId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`
                  const { error } = await supabase.storage.from('object-tokens').upload(path, file, { contentType: file.type })
                  if (!error) {
                    const { data: urlData } = supabase.storage.from('object-tokens').getPublicUrl(path)
                    await supabase.from('scene_tokens').update({ portrait_url: urlData.publicUrl }).eq('id', editingObj.id)
                    setObjects(prev => prev.map(o => o.id === editingObj.id ? { ...o, portrait_url: urlData.publicUrl } : o))
                  }
                  setUploading(false)
                }} />
              </label>
            </div>
            {/* Properties */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '10px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>Properties</div>
                <button onClick={() => setEditProps(prev => [...prev, { key: '', value: '', revealed: false }])}
                  style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#d4cfc9', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', padding: '1px 6px', cursor: 'pointer' }}>+ Add</button>
              </div>
              {editProps.map((prop, i) => (
                <div key={i} style={{ display: 'flex', gap: '3px', marginBottom: '3px', alignItems: 'center' }}>
                  <input value={prop.key} onChange={e => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, key: e.target.value } : p))}
                    placeholder="Key"
                    style={{ width: '70px', padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                  <input value={prop.value} onChange={e => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, value: e.target.value } : p))}
                    placeholder="Value"
                    style={{ flex: 1, padding: '3px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                  <button onClick={() => setEditProps(prev => prev.map((p, j) => j === i ? { ...p, revealed: !p.revealed } : p))}
                    title={prop.revealed ? 'Visible to players' : 'Hidden from players'}
                    style={{ background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', padding: '0 2px', color: prop.revealed ? '#7fc458' : '#5a5550' }}>
                    {prop.revealed ? '👁' : '👁‍🗨'}
                  </button>
                  <button onClick={() => setEditProps(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '12px', cursor: 'pointer', padding: '0 2px' }}>×</button>
                </div>
              ))}
              {editProps.length === 0 && <div style={{ fontSize: '10px', color: '#5a5550', fontStyle: 'italic' }}>No properties set</div>}
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
                }).eq('id', editingObj.id)
                setObjects(prev => prev.map(o => o.id === editingObj.id ? { ...o, name: editName.trim() || o.name, wp_max: wpVal, wp_current: wpVal, properties: cleanProps } : o))
                setEditingObj(null)
              }}
                style={{ ...chipBtn, flex: 1, background: '#c0392b', border: '1px solid #c0392b', color: '#fff' }}>Save</button>
              <button onClick={() => setEditingObj(null)}
                style={{ ...chipBtn, flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { OBJECT_ICONS }
