'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase-browser'
import { getCachedAuth } from '../../../../lib/auth-cache'
import { useRouter, useParams } from 'next/navigation'
import { SETTINGS } from '../../../../lib/settings'
import StoryToolsNav from '../../../../components/StoryToolsNav'
// Snapshot management used to live embedded on this Edit page; pulled
// out into /stories/[id]/snapshots so save / restore / download / import
// each get the breathing room they deserve. The Snapshot button on
// the Story landing page links there.

const MAP_STYLES = [
  ['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'],
  ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'],
  ['positron', 'Positron'], ['dark', 'Dark'],
]

const lbl: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif' }
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
  const [isThriver, setIsThriver] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [inviteCode, setInviteCode] = useState<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/stories'); return }
      if (camp.gm_user_id !== user.id) { router.push('/stories'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if ((profile?.role as string)?.toLowerCase() === 'thriver') setIsThriver(true)
      setName(camp.name)
      setDescription(camp.description ?? '')
      setMapStyle(camp.map_style ?? 'street')
      setSetting(camp.setting ?? 'custom')
      setInviteCode(camp.invite_code ?? '')
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
      <StoryToolsNav campaignId={id} isGM={true} inviteCode={inviteCode} />
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
                style={{ padding: '6px 4px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapStyle === val ? '#c0392b' : '#3a3a3a'}`, background: mapStyle === val ? '#2a1210' : '#242424', color: mapStyle === val ? '#f5a89a' : '#d4cfc9' }}>
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
              <span style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'monospace' }}>
                {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
              </span>
              <button type="button" onClick={() => { setMapCenter(null); setLocationQuery('') }}
                style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer', textTransform: 'uppercase' }}>
                Clear
              </button>
            </div>
          )}
          {!mapCenter && (
            <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '4px' }}>No custom center — map uses default view</div>
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
          <a href={`/stories/${id}/table`} style={{ padding: '10px 24px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Launch
          </a>
          <Link href="/stories" style={{ padding: '10px 24px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Back
          </Link>
          {saved && (
            <span style={{ color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>✓ Saved</span>
          )}
        </div>

        {/* Sync to Seed — Thriver only, non-custom settings */}
        {isThriver && setting && setting !== 'custom' && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #2e2e2e' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#EF9F27', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>Seed Management</div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '10px', lineHeight: 1.5 }}>
              Update the seed data for <strong style={{ color: '#f5f2ee' }}>{SETTINGS[setting] ?? setting}</strong> using this campaign's NPCs, pins, scenes, and handouts. All future campaigns using this setting will start with this data.
            </div>
            <button onClick={async () => {
              if (!confirm(`This will overwrite all seed data for "${SETTINGS[setting] ?? setting}" with this campaign's current NPCs, pins, scenes, and handouts.\n\nAll future campaigns using this setting will inherit these changes.\n\nContinue?`)) return
              setSyncing(true)
              setSyncResult('')
              try {
                // Clear existing seeds for this setting
                await Promise.all([
                  supabase.from('setting_seed_npcs').delete().eq('setting', setting),
                  supabase.from('setting_seed_pins').delete().eq('setting', setting),
                  supabase.from('setting_seed_scenes').delete().eq('setting', setting),
                  supabase.from('setting_seed_handouts').delete().eq('setting', setting),
                ])

                // Fetch campaign data
                const [npcsRes, pinsRes, scenesRes, handoutsRes] = await Promise.all([
                  supabase.from('campaign_npcs').select('*').eq('campaign_id', id).order('sort_order'),
                  supabase.from('campaign_pins').select('*').eq('campaign_id', id).order('sort_order'),
                  supabase.from('tactical_scenes').select('*').eq('campaign_id', id),
                  supabase.from('campaign_notes').select('*').eq('campaign_id', id).order('created_at'),
                ])

                const counts = { npcs: 0, pins: 0, scenes: 0, handouts: 0 }

                // Sync NPCs — build pin_title from campaign_pin_id
                const pinIdToName: Record<string, string> = {}
                ;(pinsRes.data ?? []).forEach((p: any) => { pinIdToName[p.id] = p.name })
                const npcs = (npcsRes.data ?? []).map((n: any, i: number) => ({
                  setting,
                  name: n.name,
                  reason: n.reason, acumen: n.acumen, physicality: n.physicality,
                  influence: n.influence, dexterity: n.dexterity,
                  wp_max: n.wp_max, rp_max: n.rp_max,
                  skills: n.skills, equipment: n.equipment,
                  notes: n.notes, motivation: n.motivation,
                  portrait_url: n.portrait_url, npc_type: n.npc_type,
                  pin_title: n.campaign_pin_id ? (pinIdToName[n.campaign_pin_id] ?? null) : null,
                  sort_order: n.sort_order ?? i + 1,
                }))
                if (npcs.length > 0) {
                  const { error } = await supabase.from('setting_seed_npcs').insert(npcs)
                  if (error) throw new Error(`NPCs: ${error.message}`)
                  counts.npcs = npcs.length
                }

                // Sync Pins
                const pins = (pinsRes.data ?? []).map((p: any, i: number) => ({
                  setting, name: p.name, lat: p.lat, lng: p.lng,
                  notes: p.notes, category: p.category ?? 'location',
                  sort_order: p.sort_order ?? i + 1,
                }))
                if (pins.length > 0) {
                  const { error } = await supabase.from('setting_seed_pins').insert(pins)
                  if (error) throw new Error(`Pins: ${error.message}`)
                  counts.pins = pins.length
                }

                // Sync Scenes
                const scenes = (scenesRes.data ?? []).map((s: any) => ({
                  setting, name: s.name, grid_cols: s.grid_cols, grid_rows: s.grid_rows, notes: s.notes ?? '',
                }))
                if (scenes.length > 0) {
                  const { error } = await supabase.from('setting_seed_scenes').insert(scenes)
                  if (error) throw new Error(`Scenes: ${error.message}`)
                  counts.scenes = scenes.length
                }

                // Sync Handouts
                const handouts = (handoutsRes.data ?? []).map((h: any) => ({
                  setting, title: h.title, content: h.content ?? '',
                }))
                if (handouts.length > 0) {
                  const { error } = await supabase.from('setting_seed_handouts').insert(handouts)
                  if (error) throw new Error(`Handouts: ${error.message}`)
                  counts.handouts = handouts.length
                }

                setSyncResult(`✓ Synced: ${counts.npcs} NPCs, ${counts.pins} pins, ${counts.scenes} scenes, ${counts.handouts} handouts`)
              } catch (err: any) {
                setSyncResult(`Error: ${err?.message ?? 'Unknown error'}`)
              }
              setSyncing(false)
            }}
              disabled={syncing}
              style={{ padding: '10px 24px', background: '#EF9F27', border: '1px solid #EF9F27', borderRadius: '3px', color: '#1a1a1a', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: syncing ? 'wait' : 'pointer', fontWeight: 700, opacity: syncing ? 0.6 : 1 }}>
              {syncing ? 'Syncing...' : 'Update Seed Data'}
            </button>
            {syncResult && (
              <div style={{ marginTop: '8px', fontSize: '13px', color: syncResult.startsWith('✓') ? '#7fc458' : '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif' }}>
                {syncResult}
              </div>
            )}
          </div>
        )}

        {/* Snapshot & Restore moved to /stories/[id]/snapshots —
            link there from the Snapshot button on the Story page. */}
      </div>
    </div>
  )
}
