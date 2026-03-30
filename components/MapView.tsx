'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

interface Pin {
  id: string
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: string
  status: string
  user_id: string
}

interface PinForm {
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: 'private' | 'rumor'
}

export default function MapView() {
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PinForm>({ lat: 0, lng: 0, title: '', notes: '', pin_type: 'private' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      // Load Leaflet dynamically
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      if (!mapRef.current || mapInstanceRef.current) return

      // Init map — centered on world view
      const map = L.map(mapRef.current, {
        center: [20, 0],
        zoom: 3,
        zoomControl: true,
      })

      // OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map

      // Click to add pin
      map.on('click', (e: any) => {
        setForm(prev => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng, title: '', notes: '' }))
        setShowForm(true)
      })

      // Load pins
      loadPins(L, map)
    }

    init()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  async function loadPins(L: any, map: any) {
    const { data } = await supabase
      .from('map_pins')
      .select('*')
      .order('created_at', { ascending: false })

    if (!data) return
    setPins(data)

    // Clear existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    data.forEach((pin: Pin) => {
      const color = pin.pin_type === 'rumor' ? '#EF9F27'
        : pin.pin_type === 'gm' ? '#c0392b'
        : '#7ab3d4'

      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      const marker = L.marker([pin.lat, pin.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:Barlow,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${pin.title}</div>
            ${pin.notes ? `<div style="font-size:12px;color:#555;margin-bottom:6px">${pin.notes}</div>` : ''}
            <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em">${pin.pin_type === 'rumor' ? 'Rumor' : pin.pin_type === 'gm' ? 'GM Content' : 'Private note'}</div>
          </div>
        `)

      markersRef.current.push(marker)
    })
  }

  async function handleSavePin() {
    if (!form.title.trim()) return
    setSaving(true)

    const { error } = await supabase.from('map_pins').insert({
      lat: form.lat,
      lng: form.lng,
      title: form.title,
      notes: form.notes,
      pin_type: form.pin_type,
      status: form.pin_type === 'rumor' ? 'pending' : 'active',
    })

    if (!error) {
      setShowForm(false)
      const L = (await import('leaflet')).default
      loadPins(L, mapInstanceRef.current)
    }
    setSaving(false)
  }

  async function handleDeletePin(id: string) {
    await supabase.from('map_pins').delete().eq('id', id)
    const L = (await import('leaflet')).default
    loadPins(L, mapInstanceRef.current)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* Header bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, background: '#0f0f0f', borderBottom: '1px solid #c0392b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          The Tapestry
        </div>
        <div style={{ fontSize: '11px', color: '#b0aaa4', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          World Map
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: '#b0aaa4' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7ab3d4', display: 'inline-block' }} />Private
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF9F27', display: 'inline-block' }} />Rumor
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c0392b', display: 'inline-block' }} />GM
          </span>
        </div>
        <a href="/dashboard" style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Dashboard
        </a>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', paddingTop: '44px' }} />

      {/* Hint */}
      <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(15,15,15,.85)', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '6px 14px', fontSize: '11px', color: '#b0aaa4', fontFamily: 'Barlow, sans-serif', pointerEvents: 'none' }}>
        Click anywhere on the map to place a pin
      </div>

      {/* Pin form */}
      {showForm && (
        <div style={{ position: 'absolute', top: '60px', right: '16px', zIndex: 1001, background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '1rem', width: '280px' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: 600, color: '#c0392b', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
            New Pin
          </div>
          <div style={{ fontSize: '10px', color: '#5a5550', marginBottom: '10px' }}>
            {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={lbl}>Title</label>
            <input style={inp} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Abandoned hospital" />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="What did you find here?" />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Type</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['private', 'rumor'] as const).map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, pin_type: t }))}
                  style={{ flex: 1, padding: '6px', border: `1px solid ${form.pin_type === t ? '#c0392b' : '#3a3a3a'}`, background: form.pin_type === t ? '#2a1210' : '#242424', color: form.pin_type === t ? '#f5a89a' : '#b0aaa4', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  {t === 'private' ? 'Private' : 'Submit Rumor'}
                </button>
              ))}
            </div>
            {form.pin_type === 'rumor' && (
              <div style={{ fontSize: '10px', color: '#b0aaa4', marginTop: '4px', lineHeight: 1.4 }}>
                Rumors are submitted for moderation before becoming visible to other players.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleSavePin} disabled={saving || !form.title.trim()}
              style={{ flex: 1, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', opacity: saving || !form.title.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving...' : 'Save Pin'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', cursor: 'pointer', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '10px', color: '#f5f2ee',
  letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: '4px',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 9px',
  background: '#242424', border: '1px solid #3a3a3a',
  borderRadius: '3px', color: '#f5f2ee',
  fontSize: '13px', fontFamily: 'Barlow, sans-serif',
  boxSizing: 'border-box',
}