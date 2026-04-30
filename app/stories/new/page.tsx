'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter } from 'next/navigation'
import { logEvent } from '../../../lib/events'
import { SETTING_PINS } from '../../../lib/setting-pins'
import { SETTING_NPCS } from '../../../lib/setting-npcs'
import { SETTING_SCENES } from '../../../lib/setting-scenes'
import { SETTING_HANDOUTS } from '../../../lib/setting-handouts'
import { SETTING_VEHICLES } from '../../../lib/setting-vehicles'
import { STORY_SETTING_OPTIONS } from '../../../lib/settings'
import { listAvailableModules, cloneModuleIntoCampaign, type ModuleListing } from '../../../lib/modules'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function NewCampaignPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [setting, setSetting] = useState('')
  const [mapStyle, setMapStyle] = useState('topo')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [customCenter, setCustomCenter] = useState<{ lat: number; lng: number } | null>(null)
  // Phase 5 Sprint 1 — Module picker; see /campaigns/new for notes.
  const [modules, setModules] = useState<ModuleListing[]>([])
  const [pickedModuleVersionId, setPickedModuleVersionId] = useState<string>('')
  const [pickedModuleId, setPickedModuleId] = useState<string>('')
  const debounceRef = useRef<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    listAvailableModules(supabase).then(setModules).catch(() => setModules([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const { user } = await getCachedAuth()
    if (!user) { setError('Not logged in.'); setSaving(false); return }
    const invite_code = generateCode()
    const { data, error: err } = await supabase.from('campaigns').insert({
      name: name.trim(),
      description: description.trim(),
      // Module-subscribed stories store 'custom' in the setting slot;
      // the actual module link lives in module_subscriptions.
      setting: pickedModuleVersionId ? 'custom' : (setting || 'custom'),
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

    // Phase 5 Sprint 1 — module clone takes precedence over the
    // setting-seed pipeline.
    if (pickedModuleVersionId) {
      try {
        await cloneModuleIntoCampaign(supabase, pickedModuleVersionId, data.id)
        logEvent('campaign_created', { id: data.id, name, module_version_id: pickedModuleVersionId })
        router.push(`/stories/${data.id}`)
        return
      } catch (cloneErr: any) {
        setError(`Story created but module clone failed: ${cloneErr?.message ?? cloneErr}\n\nYou can delete and recreate, or open it to see what partially seeded.`)
        setSaving(false)
        return
      }
    }

    // Collect seed errors and surface them in the UI instead of silently swallowing.
    const seedErrors: string[] = []

    // ── Seed Pins: DB first, fallback to TS ──
    let pinMap: Record<string, string> = {}
    const { data: dbPins } = await supabase.from('setting_seed_pins').select('*').eq('setting', setting).order('sort_order')
    const pinSource = (dbPins && dbPins.length > 0) ? dbPins : (SETTING_PINS[setting] ?? []).map((p, i) => ({ name: p.title, lat: p.lat, lng: p.lng, notes: p.notes ?? '', category: p.category ?? 'location', sort_order: i + 1 }))
    if (pinSource.length > 0) {
      const pinRows = pinSource.map((p: any, i: number) => ({
        campaign_id: data.id, name: p.name ?? p.title, lat: p.lat, lng: p.lng,
        notes: p.notes ?? '', category: p.category ?? 'location',
        revealed: false, sort_order: p.sort_order ?? i + 1,
      }))
      const { data: createdPins, error: pinErr } = await supabase.from('campaign_pins').insert(pinRows).select('id, name')
      if (pinErr) seedErrors.push(`pins: ${pinErr.message}`)
      createdPins?.forEach((p: any) => { pinMap[p.name] = p.id })
    }

    // ── Seed NPCs: DB first, fallback to TS ──
    const { data: dbNpcs } = await supabase.from('setting_seed_npcs').select('*').eq('setting', setting).order('sort_order')
    if (dbNpcs && dbNpcs.length > 0) {
      // DB seeds — already in the right format, just map to campaign_npcs
      const npcRows = dbNpcs.map((n: any, i: number) => ({
        campaign_id: data.id,
        campaign_pin_id: n.pin_title ? (pinMap[n.pin_title] ?? null) : null,
        name: n.name,
        reason: n.reason, acumen: n.acumen, physicality: n.physicality,
        influence: n.influence, dexterity: n.dexterity,
        skills: n.skills, equipment: n.equipment,
        notes: n.notes, motivation: n.motivation,
        portrait_url: n.portrait_url || null,
        npc_type: n.npc_type || null,
        wp_max: n.wp_max, rp_max: n.rp_max,
        wp_current: n.wp_max, rp_current: n.rp_max,
        status: 'active', sort_order: n.sort_order ?? i + 1,
      }))
      const { error: npcErr } = await supabase.from('campaign_npcs').insert(npcRows)
      if (npcErr) seedErrors.push(`npcs: ${npcErr.message}`)
    } else {
      // Fallback to TS seeds
      const settingNpcs = SETTING_NPCS[setting]
      if (settingNpcs && settingNpcs.length > 0) {
        const npcRows = settingNpcs.map((n, i) => {
          const notes = [n.role && `Role: ${n.role}`, n.description, n.how_to_meet && `How to meet: ${n.how_to_meet}`].filter(Boolean).join('\n\n')
          return {
            campaign_id: data.id,
            campaign_pin_id: n.pin_title ? (pinMap[n.pin_title] ?? null) : null,
            name: n.name, reason: n.reason, acumen: n.acumen, physicality: n.physicality,
            influence: n.influence, dexterity: n.dexterity,
            skills: { entries: n.skills.map(s => ({ name: s.name, level: s.level })), text: n.skills.map(s => `${s.name} ${s.level}`).join(', '), weapon: null },
            equipment: n.equipment, notes, motivation: n.motivation || null,
            wp_max: n.wp_max, rp_max: n.rp_max, wp_current: n.wp_max, rp_current: n.rp_max,
            status: 'active', sort_order: i + 1,
          }
        })
        const { error: npcErr } = await supabase.from('campaign_npcs').insert(npcRows)
        if (npcErr) seedErrors.push(`npcs: ${npcErr.message}`)
      }
    }

    // ── Seed Scenes: DB first, fallback to TS ──
    const { data: dbScenes } = await supabase.from('setting_seed_scenes').select('*').eq('setting', setting)
    const sceneSource = (dbScenes && dbScenes.length > 0) ? dbScenes : (SETTING_SCENES[setting] ?? [])
    if (sceneSource.length > 0) {
      const sceneRows = sceneSource.map((s: any) => ({
        campaign_id: data.id, name: s.name, grid_cols: s.grid_cols, grid_rows: s.grid_rows,
        is_active: false,
        background_url: s.background_url ?? null,
        cell_px: s.cell_px ?? 35,   // canonical default; never 70
        cell_feet: s.cell_feet ?? 3,
      }))
      const { error: sceneErr } = await supabase.from('tactical_scenes').insert(sceneRows)
      if (sceneErr) seedErrors.push(`scenes: ${sceneErr.message}`)
    }

    // ── Seed Vehicles ──
    // campaigns.vehicles is a jsonb array; we just write the seed list
    // straight onto the row. Without this, settings that ship with a
    // starting vehicle (e.g. Mongrels → Minnie) would render an empty
    // Vehicles panel and the popout would show nothing.
    const settingVehicles = SETTING_VEHICLES[setting]
    if (settingVehicles && settingVehicles.length > 0) {
      const { error: vehErr } = await supabase
        .from('campaigns')
        .update({ vehicles: settingVehicles })
        .eq('id', data.id)
      if (vehErr) seedErrors.push(`vehicles: ${vehErr.message}`)
    }

    // ── Seed Handouts: DB first, fallback to TS ──
    const { data: dbHandouts } = await supabase.from('setting_seed_handouts').select('*').eq('setting', setting)
    const handoutSource = (dbHandouts && dbHandouts.length > 0) ? dbHandouts : (SETTING_HANDOUTS[setting] ?? [])
    if (handoutSource.length > 0) {
      const handoutRows = handoutSource.map((h: any) => ({
        campaign_id: data.id, title: h.title, content: h.content,
        attachments: Array.isArray(h.attachments) ? h.attachments : [],
      }))
      const { error: handoutErr } = await supabase.from('campaign_notes').insert(handoutRows)
      if (handoutErr) seedErrors.push(`handouts: ${handoutErr.message}`)
    }
    logEvent('campaign_created', { id: data.id, name })
    if (seedErrors.length > 0) {
      // Don't redirect — keep the user here so they can see what failed.
      setError(`Story created but seeding had errors:\n${seedErrors.join('\n')}\n\nThis usually means a database migration hasn't been run. Check sql/ for pending scripts.`)
      setSaving(false)
      return
    }
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
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          New Story
        </div>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', borderLeft: '3px solid #c0392b' }}>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Story Name</label>
          <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Kansas City Survivors" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Description <span style={{ color: '#cce0f5', fontWeight: 400 }}>(optional)</span></label>
          <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of your story..." />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Setting</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {STORY_SETTING_OPTIONS.map(s => (
              <button key={s.value} onClick={() => { setSetting(s.value); setPickedModuleVersionId(''); setPickedModuleId('') }}
                style={{ flex: 1, padding: '8px', border: `1px solid ${!pickedModuleVersionId && setting === s.value ? '#c0392b' : '#3a3a3a'}`, background: !pickedModuleVersionId && setting === s.value ? '#2a1210' : '#242424', borderRadius: '3px', color: !pickedModuleVersionId && setting === s.value ? '#f5a89a' : '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Setting → Starting Location (renders BEFORE the module
            picker so a player choosing 'Custom' can pin the map without
            having to scroll past the module list). */}
        {setting === 'custom' && !pickedModuleVersionId && (
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
              <div style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', marginTop: '4px' }}>
                Map will center on {customCenter.lat.toFixed(4)}, {customCenter.lng.toFixed(4)}
              </div>
            )}
          </div>
        )}

        {/* Phase 5 Sprint 1 — Module picker. Mutually exclusive with the
            setting buttons. Sits below Starting Location so Custom-setting
            users land on the location field first. */}
        {modules.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <label style={lbl}>Or start from a Module</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {modules.map(m => {
                const picked = pickedModuleVersionId === m.latest_version_id
                return (
                  <button key={m.id} onClick={() => {
                    if (picked) {
                      setPickedModuleVersionId(''); setPickedModuleId('')
                    } else if (m.latest_version_id) {
                      setPickedModuleVersionId(m.latest_version_id)
                      setPickedModuleId(m.id)
                      setSetting('')
                    }
                  }}
                    style={{ padding: '8px 10px', border: `1px solid ${picked ? '#8b5cf6' : '#3a3a3a'}`, background: picked ? '#2a1a3e' : '#242424', borderRadius: '3px', color: picked ? '#c4a7f0' : '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                      📦 {m.name}
                      {m.latest_version && <span style={{ opacity: 0.7, marginLeft: '8px', fontSize: '13px' }}>v{m.latest_version.version}</span>}
                    </div>
                    {m.tagline && <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px', fontFamily: 'Barlow, sans-serif', textTransform: 'none' }}>{m.tagline}</div>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={lbl}>Default Map Style</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
            {[['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'], ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'], ['positron', 'Positron'], ['dark', 'Dark']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setMapStyle(val)}
                style={{ padding: '6px 4px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapStyle === val ? '#c0392b' : '#3a3a3a'}`, background: mapStyle === val ? '#2a1210' : '#242424', color: mapStyle === val ? '#f5a89a' : '#d4cfc9' }}>
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
            style={{ flex: 1, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}>
            {saving ? 'Creating...' : 'Create Story'}
          </button>
          <button onClick={() => router.back()}
            style={{ padding: '10px 20px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600,
  color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em',
  marginBottom: '6px', fontFamily: 'Carlito, sans-serif',
}
