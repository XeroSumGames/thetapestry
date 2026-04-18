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
            </div>
            {isGM && (
              <div style={{ display: 'flex', gap: '3px' }}>
                <button onClick={() => onRemoveFromMap?.(obj.name)}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export { OBJECT_ICONS }
