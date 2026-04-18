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

interface Props {
  tokenId: string
  name: string
  wpCurrent: number | null
  wpMax: number | null
  color: string
  portraitUrl: string | null
  isGM: boolean
  onClose: () => void
}

function wpBarColor(pct: number): string {
  if (pct > 0.66) return '#7fc458'
  if (pct > 0.33) return '#EF9F27'
  return '#c0392b'
}

export default function ObjectCard({ tokenId, name, wpCurrent, wpMax, color, portraitUrl, isGM, onClose }: Props) {
  const supabase = createClient()
  const [properties, setProperties] = useState<TokenProperty[]>([])
  const [contents, setContents] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)

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

      {/* Contents — GM only */}
      {isGM && !loading && contents.length > 0 && (
        <div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Contents (GM)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {contents.map((c, i) => (
              <div key={i} style={{ fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', color: '#f5f2ee' }}>
                {c.type === 'weapon' ? '🔫' : '🎒'} {c.name}{c.quantity > 1 ? ` ×${c.quantity}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && visibleProps.length === 0 && (!isGM || contents.length === 0) && wpM === 0 && (
        <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', fontStyle: 'italic' }}>No details.</div>
      )}
    </div>
  )
}
