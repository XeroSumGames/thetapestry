'use client'
import { useState, useRef } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { logEvent } from '../../../lib/events'
import { SETTING_PINS } from '../../../lib/setting-pins'
import { SETTING_NPCS } from '../../../lib/setting-npcs'
import { SETTING_OPTIONS } from '../../../lib/settings'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function NewCampaignPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [setting, setSetting] = useState('')
  const [mapStyle, setMapStyle] = useState('street')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [customCenter, setCustomCenter] = useState<{ lat: number; lng: number } | null>(null)
  const debounceRef = useRef<any>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in.'); setSaving(false); return }
    const invite_code = generateCode()
    const { data, error: err } = await supabase.from('campaigns').insert({
      name: name.trim(),
      description: description.trim(),
      setting: setting || 'custom',
      map_style: mapStyle,
      map_center_lat: customCenter?.lat ?? null,
      map_center_lng: customCenter?.lng ?? null,
      gm_user_id: user.id,
      invite_code,
      status: 'active',
    }).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    // GM auto-joins as member
    await supabase.from('campaign_members').insert({
      campaign_id: data.id,
      user_id: user.id,
    })
    // Seed setting pins into campaign_pins (not world map)
    const settingPins = SETTING_PINS[setting]
    let pinMap: Record<string, string> = {}
    if (settingPins && settingPins.length > 0) {
      const pinRows = settingPins.map(p => ({
        campaign_id: data.id, name: p.title, lat: p.lat, lng: p.lng,
        notes: p.notes ?? '', category: p.category ?? 'location',
        revealed: false,
      }))
      const { data: createdPins, error: pinErr } = await supabase.from('campaign_pins').insert(pinRows).select('id, name')
      if (pinErr) { console.error('[CampaignCreate] pin seed error:', pinErr.message) }
      createdPins?.forEach(p => { pinMap[p.name] = p.id })
    }
    // Seed setting NPCs into campaign_npcs
    const settingNpcs = SETTING_NPCS[setting]
    if (settingNpcs && settingNpcs.length > 0) {
      const npcRows = settingNpcs.map(n => ({
        campaign_id: data.id,
        name: n.name,
        rapid_range: n.rapid_range,
        wp: n.wp, rp: n.rp, dmm: n.dmm, dmr: n.dmr,
        init: n.init, per: n.per, enc: n.enc, pt: n.pt,
        skills: n.skills,
        equipment: n.equipment,
        role: n.role,
        description: n.description,
        how_to_meet: n.how_to_meet,
        motivation: n.motivation,
        revealed: false,
      }))
      const { error: npcErr } = await supabase.from('campaign_npcs').insert(npcRows)
      if (npcErr) { console.error('[CampaignCreate] npc seed error:', npcErr.message) }
    }
    logEvent('campaign_created', { id: data.id, name })
    router.push(`/stories/${data.id}`)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          New Story
        </div>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', borderLeft: '3px solid #c0392b' }}>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Story Name</label>
          <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Kansas City Survivors" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Setting</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {SETTING_OPTIONS.map(s => (
              <button key={s.value} onClick={() => setSetting(s.value)}
                style={{ flex: 1, padding: '8px', border: `1px solid ${setting === s.value ? '#c0392b' : '#3a3a3a'}`, background: setting === s.value ? '#2a1210' : '#242424', borderRadius: '3px', color: setting === s.value ? '#f5a89a' : '#d4cfc9', cursor: 'pointer', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {setting === 'custom' && (
          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <label style={lbl}>Starting Location</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
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
                }} placeholder="Search for a location..." style={inp} />
                {locationSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                    {locationSuggestions.map((s, i) => (
                      <div key={i} onClick={() => {
                        setCustomCenter({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
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
            </div>
            {customCenter && (
              <div style={{ fontSize: '11px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px' }}>
                Map will center on {customCenter.lat.toFixed(4)}, {customCenter.lng.toFixed(4)}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Description <span style={{ color: '#cce0f5', fontWeight: 400 }}>(optional)</span></label>
          <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of your story..." />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={lbl}>Default Map Style</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
            {[['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'], ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'], ['positron', 'Positron'], ['dark', 'Dark']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setMapStyle(val)}
                style={{ padding: '6px 4px', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapStyle === val ? '#c0392b' : '#3a3a3a'}`, background: mapStyle === val ? '#2a1210' : '#242424', color: mapStyle === val ? '#f5a89a' : '#d4cfc9' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleCreate} disabled={saving || !name.trim()}
            style={{ flex: 1, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}>
            {saving ? 'Creating...' : 'Create Story'}
          </button>
          <button onClick={() => router.back()}
            style={{ padding: '10px 20px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em',
  marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif',
}
