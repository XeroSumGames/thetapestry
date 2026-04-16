'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import { SETTINGS } from '../../../../lib/settings'

const MAP_STYLES = [
  ['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'],
  ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'],
  ['positron', 'Positron'], ['dark', 'Dark'],
]

const lbl: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif' }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Barlow, sans-serif', outline: 'none', boxSizing: 'border-box' }

export default function EditCampaignPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mapStyle, setMapStyle] = useState('street')
  const [setting, setSetting] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/stories'); return }
      if (camp.gm_user_id !== user.id) { router.push('/stories'); return }
      setName(camp.name)
      setDescription(camp.description ?? '')
      setMapStyle(camp.map_style ?? 'street')
      setSetting(camp.setting ?? 'custom')
      if (camp.map_center_lat != null && camp.map_center_lng != null) {
        setMapCenter({ lat: camp.map_center_lat, lng: camp.map_center_lng })
      }
      setLoading(false)
    }
    load()
  }, [id, supabase, router])

  async function handleSave() {
    if (!name.trim()) { setError('Story name is required.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('campaigns').update({
      name: name.trim(),
      description: description.trim() || null,
      map_style: mapStyle,
      map_center_lat: mapCenter?.lat ?? null,
      map_center_lng: mapCenter?.lng ?? null,
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
  )

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
      <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '2rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px', borderBottom: '1px solid #c0392b', paddingBottom: '10px' }}>
        Edit Story
      </h1>
      <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1.5rem' }}>
        {SETTINGS[setting] ?? setting}
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={lbl}>Story Name</label>
          <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Name your story..." />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={lbl}>Description <span style={{ color: '#5a5550', fontWeight: 400 }}>(optional)</span></label>
          <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of your story..." />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={lbl}>Default Map Style</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {MAP_STYLES.map(([val, label]) => (
              <button key={val} type="button" onClick={() => setMapStyle(val)}
                style={{ padding: '6px 4px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapStyle === val ? '#c0392b' : '#3a3a3a'}`, background: mapStyle === val ? '#2a1210' : '#242424', color: mapStyle === val ? '#f5a89a' : '#d4cfc9' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <label style={lbl}>Map Center Location</label>
          <div style={{ position: 'relative' }}>
            <input value={locationQuery} onChange={e => {
              setLocationQuery(e.target.value)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              if (e.target.value.length >= 3) {
                debounceRef.current = setTimeout(async () => {
                  try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(e.target.value)}&limit=5`)
                    const data = await res.json()
                    setLocationSuggestions(data)
                  } catch { setLocationSuggestions([]) }
                }, 300)
              } else { setLocationSuggestions([]) }
            }} placeholder="Search for a new center location..." style={inp} />
            {locationSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                {locationSuggestions.map((s, i) => (
                  <div key={i} onClick={() => {
                    setMapCenter({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
                    setLocationQuery(s.display_name.split(',').slice(0, 2).join(','))
                    setLocationSuggestions([])
                  }}
                    style={{ padding: '8px 10px', fontSize: '13px', color: '#d4cfc9', cursor: 'pointer', borderBottom: '1px solid #2e2e2e' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {s.display_name.length > 80 ? s.display_name.slice(0, 80) + '...' : s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {mapCenter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '12px', color: '#7fc458', fontFamily: 'monospace' }}>
                {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
              </span>
              <button type="button" onClick={() => { setMapCenter(null); setLocationQuery('') }}
                style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer', textTransform: 'uppercase' }}>
                Clear
              </button>
            </div>
          )}
          {!mapCenter && (
            <div style={{ fontSize: '11px', color: '#5a5550', marginTop: '4px' }}>No custom center — map uses default view</div>
          )}
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            style={{ padding: '10px 24px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <a href="/stories" style={{ padding: '10px 24px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Back
          </a>
          {saved && (
            <span style={{ color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>✓ Saved</span>
          )}
        </div>
      </div>
    </div>
  )
}
