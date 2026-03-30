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
  const markersRef = useRef<Record<string, any>>({})
  const [pins, setPins] = useState<Pin[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'mine' | 'public'>('mine')
  const [form, setForm] = useState<PinForm>({ lat: 0, lng: 0, title: '', notes: '', pin_type: 'private' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, { center: [20, 0], zoom: 3, zoomControl: true })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map

      map.on('click', (e: any) => {
        setForm({ lat: e.latlng.lat, lng: e.latlng.lng, title: '', notes: '', pin_type: 'private' })
        setShowForm(true)
      })

      loadPins(L, map)
    }

    init()
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    }
  }, [])

  async function loadPins(L?: any, map?: any) {
    const leaflet = L ?? (await import('leaflet')).default
    const mapInst = map ?? mapInstanceRef.current
    if (!mapInst) return

    const { data } = await supabase.from('map_pins').select('*').order('created_at', { ascending: false })
    if (!data) return
    setPins(data)

    Object.values(markersRef.current).forEach((m: any) => m.remove())
    markersRef.current = {}

    data.forEach((pin: Pin) => {
      const color = pin.pin_type === 'rumor' ? '#EF9F27' : pin.pin_type === 'gm' ? '#c0392b' : '#7ab3d4'
      const icon = leaflet.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        className: '', iconSize: [14, 14], iconAnchor: [7, 7],
      })
      const marker = leaflet.marker([pin.lat, pin.lng], { icon })
        .addTo(mapInst)
        .bindPopup(`
          <div style="font-family:Barlow,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${pin.title}</div>
            ${pin.notes ? `<div style="font-size:12px;color:#555;margin-bottom:6px">${pin.notes}</div>` : ''}
            <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em">${pin.pin_type === 'rumor' ? 'Rumor' : pin.pin_type === 'gm' ? 'GM Content' : 'Private note'}</div>
          </div>
        `)
      markersRef.current[pin.id] = marker
    })
  }

  function flyToPin(pin: Pin) {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.flyTo([pin.lat, pin.lng], 14, { duration: 1.2 })
    setTimeout(() => markersRef.current[pin.id]?.openPopup(), 1300)
  }

  async function handleSavePin() {
    if (!form.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('map_pins').insert({
      lat: form.lat, lng: form.lng, title: form.title, notes: form.notes,
      pin_type: form.pin_type, status: form.pin_type === 'rumor' ? 'pending' : 'active',
    })
    if (!error) { setShowForm(false); loadPins() }
    setSaving(false)
  }

  async function handleDeletePin(id: string) {
    setDeletingId(id)
    await supabase.from('map_pins').delete().eq('id', id)
    await loadPins()
    setDeletingId(null)
  }

  const myPins = pins.filter(p => p.user_id === userId)
  const publicPins = pins.filter(p => p.status === 'approved')

  const displayedPins = sidebarTab === 'mine' ? myPins : publicPins

  function pinTypeLabel(p: Pin) {
    if (p.pin_type === 'rumor' && p.status === 'pending') return 'Rumor — pending'
    if (p.pin_type === 'rumor' && p.status === 'approved') return 'Rumor — approved'
    if (p.pin_type === 'gm') return 'GM content'
    return 'Private'
  }

  function pinColor(p: Pin) {
    return p.pin_type === 'rumor' ? '#EF9F27' : p.pin_type === 'gm' ? '#c0392b' : '#7ab3d4'
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, zIndex: 1000, background: '#0f0f0f', borderBottom: '1px solid #c0392b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          The Tapestry
        </div>
        <div style={{ fontSize: '11px', color: '#b0aaa4', letterSpacing: '.08em', textTransform: 'uppercase' }}>World Map</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: '#b0aaa4', alignItems: 'center' }}>
          {[['#7ab3d4', 'Private'], ['#EF9F27', 'Rumor'], ['#c0392b', 'GM']].map(([color, label]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />{label}
            </span>
          ))}
        </div>
        <button onClick={() => setSidebarOpen(p => !p)}
          style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {sidebarOpen ? 'Hide Pins' : 'Show Pins'}
        </button>
        <a href="/dashboard" style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Dashboard
        </a>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Map */}
        <div ref={mapRef} style={{ flex: 1, height: '100%' }} />

        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{ width: '300px', flexShrink: 0, background: '#1a1a1a', borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', zIndex: 500 }}>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e' }}>
              {([['mine', 'My Pins'], ['public', 'Public']] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setSidebarTab(tab)}
                  style={{ flex: 1, padding: '10px', background: sidebarTab === tab ? '#242424' : 'transparent', border: 'none', borderBottom: `2px solid ${sidebarTab === tab ? '#c0392b' : 'transparent'}`, color: sidebarTab === tab ? '#f5f2ee' : '#b0aaa4', cursor: 'pointer', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {label} {tab === 'mine' ? `(${myPins.length})` : `(${publicPins.length})`}
                </button>
              ))}
            </div>

            {/* Pin list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {displayedPins.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', fontSize: '12px', color: '#5a5550' }}>
                  {sidebarTab === 'mine' ? 'Click anywhere on the map to place your first pin.' : 'No approved public pins yet.'}
                </div>
              )}
              {displayedPins.map(p => (
                <div key={p.id}
                  onClick={() => flyToPin(p)}
                  style={{ padding: '10px 12px', marginBottom: '4px', background: '#242424', border: '1px solid #2e2e2e', borderLeft: `3px solid ${pinColor(p)}`, borderRadius: '3px', cursor: 'pointer', transition: 'border-color .1s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      {p.notes && <div style={{ fontSize: '11px', color: '#b0aaa4', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.notes}</div>}
                      <div style={{ fontSize: '9px', color: '#5a5550', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{pinTypeLabel(p)}</div>
                    </div>
                    {p.user_id === userId && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeletePin(p.id) }}
                        disabled={deletingId === p.id}
                        style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#5a5550', cursor: 'pointer', fontSize: '14px', padding: '0 2px', flexShrink: 0, opacity: deletingId === p.id ? 0.4 : 1 }}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* Hint */}
        <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(15,15,15,.85)', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '6px 14px', fontSize: '11px', color: '#b0aaa4', fontFamily: 'Barlow, sans-serif', pointerEvents: 'none' }}>
          Click anywhere on the map to place a pin
        </div>

        {/* Pin form */}
        {showForm && (
          <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1001, background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '1rem', width: '280px' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: 600, color: '#c0392b', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>New Pin</div>
            <div style={{ fontSize: '10px', color: '#5a5550', marginBottom: '10px' }}>{form.lat.toFixed(4)}, {form.lng.toFixed(4)}</div>

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