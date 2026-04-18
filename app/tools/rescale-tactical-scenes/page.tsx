'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'

// One-time migration: tactical scenes were previously sized using
// container.clientWidth (viewer-dependent). New system uses image.naturalWidth
// (viewer-independent). For each existing scene with a background image, we
// approximate the GM's intended display width as OLD_REFERENCE_W × imgScale_old
// and convert it to imgScale_new = displayed / naturalWidth.
const OLD_REFERENCE_W = 1400

interface Row {
  id: string
  name: string
  campaign_id: string
  background_url: string
  img_scale: number
  natural_w: number | null
  natural_h: number | null
  new_scale: number | null
  status: 'loading' | 'ready' | 'done' | 'error' | 'noimage'
  error?: string
}

export default function RescaleTacticalScenesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole(profile?.role ?? null)
      if (profile?.role !== 'thriver') { setLoading(false); return }
      const { data } = await supabase
        .from('tactical_scenes')
        .select('id, name, campaign_id, background_url, img_scale')
        .not('background_url', 'is', null)
        .order('campaign_id')
      const initial: Row[] = (data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name ?? '(unnamed)',
        campaign_id: s.campaign_id,
        background_url: s.background_url,
        img_scale: s.img_scale ?? 1,
        natural_w: null,
        natural_h: null,
        new_scale: null,
        status: 'loading',
      }))
      setRows(initial)
      setLoading(false)
      // Probe each image's natural dimensions in parallel
      initial.forEach(r => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const newScale = img.naturalWidth > 0
            ? (OLD_REFERENCE_W * r.img_scale) / img.naturalWidth
            : null
          setRows(prev => prev.map(x => x.id === r.id ? { ...x, natural_w: img.naturalWidth, natural_h: img.naturalHeight, new_scale: newScale, status: 'ready' } : x))
        }
        img.onerror = () => {
          setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: 'error', error: 'Image failed to load' } : x))
        }
        img.src = r.background_url
      })
    }
    load()
  }, [])

  async function rescaleOne(row: Row) {
    if (row.new_scale == null) return
    const { error } = await supabase.from('tactical_scenes').update({ img_scale: row.new_scale }).eq('id', row.id)
    setRows(prev => prev.map(x => x.id === row.id
      ? (error ? { ...x, status: 'error', error: error.message } : { ...x, img_scale: row.new_scale!, status: 'done' })
      : x))
  }

  async function rescaleAll() {
    setBusy(true)
    for (const r of rows) {
      if (r.status === 'ready' && r.new_scale != null) {
        await rescaleOne(r)
      }
    }
    setBusy(false)
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading…</div>
  if (role !== 'thriver') return <div style={{ padding: '2rem', color: '#c0392b' }}>Thriver only.</div>

  const readyCount = rows.filter(r => r.status === 'ready').length
  const doneCount = rows.filter(r => r.status === 'done').length

  return (
    <div style={{ fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '0.25rem' }}>Rescale Tactical Scenes</h1>
      <p style={{ color: '#cce0f5', fontSize: '14px', marginBottom: '1rem' }}>
        One-time migration: convert legacy <code>img_scale</code> values (container-based) to the new natural-dimensions baseline.
        Assumes old GM viewport ≈ {OLD_REFERENCE_W}px. You can still fine-tune afterwards via Fit to Screen / Lock Map on each scene.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <button onClick={rescaleAll} disabled={busy || readyCount === 0}
          style={{ padding: '8px 16px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: busy ? 'wait' : 'pointer', opacity: busy || readyCount === 0 ? 0.5 : 1 }}>
          {busy ? 'Rescaling…' : `Rescale All (${readyCount})`}
        </button>
        <div style={{ padding: '8px 12px', color: '#7fc458', fontSize: '13px' }}>
          Done: {doneCount} / {rows.length}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #c0392b', color: '#cce0f5', textAlign: 'left' }}>
            <th style={{ padding: '6px 8px' }}>Scene</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Natural W</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Old imgScale</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>New imgScale</th>
            <th style={{ padding: '6px 8px' }}>Status</th>
            <th style={{ padding: '6px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #2e2e2e' }}>
              <td style={{ padding: '6px 8px' }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: '11px', color: '#5a5550' }}>{r.campaign_id.slice(0, 8)}…</div>
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{r.natural_w ?? '—'}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{r.img_scale.toFixed(3)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#7fc458' }}>{r.new_scale != null ? r.new_scale.toFixed(3) : '—'}</td>
              <td style={{ padding: '6px 8px', color: r.status === 'done' ? '#7fc458' : r.status === 'error' ? '#c0392b' : r.status === 'ready' ? '#EF9F27' : '#5a5550' }}>
                {r.status}{r.error ? ` — ${r.error}` : ''}
              </td>
              <td style={{ padding: '6px 8px' }}>
                {r.status === 'ready' && (
                  <button onClick={() => rescaleOne(r)}
                    style={{ padding: '3px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Rescale
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#5a5550' }}>No scenes with background images found.</div>
      )}
    </div>
  )
}
