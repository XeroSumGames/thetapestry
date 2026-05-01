'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter, useSearchParams } from 'next/navigation'
import { logEvent } from '../../../lib/events'
import { SETTING_PINS } from '../../../lib/setting-pins'
import { SETTING_NPCS } from '../../../lib/setting-npcs'
import { SETTING_SCENES } from '../../../lib/setting-scenes'
import { SETTING_HANDOUTS } from '../../../lib/setting-handouts'
import { SETTING_VEHICLES } from '../../../lib/setting-vehicles'
import { STORY_SETTING_OPTIONS, STORY_SETTING_VALUES } from '../../../lib/settings'
import { listAvailableModules, cloneModuleIntoCampaign, type ModuleListing } from '../../../lib/modules'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

interface PublishedCommunity {
  id: string                   // world_communities.id
  name: string
  description: string | null
  lat: number
  lng: number
  faction_label: string | null
  size_band: string
  community_status: string
  source_campaign_id: string
}

export default function NewCampaignPage() {
  // Phase 4C — accept ?setting=<slug> from the setting hub's "Run a
  // Campaign in [Setting]" CTA. Pre-seeds the setting picker so the
  // user lands on Custom Setting / DZ / Kings Crossroads already
  // selected. Unknown slugs fall back to '' (no preselection) rather
  // than erroring; STORY_SETTING_VALUES is the canonical list.
  const searchParams = useSearchParams()
  const settingFromQuery = searchParams?.get('setting') ?? ''
  const initialSetting = (STORY_SETTING_VALUES as readonly string[]).includes(settingFromQuery) ? settingFromQuery : ''

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [setting, setSetting] = useState(initialSetting)
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
  // Phase E #C — published-community picker. Lets a new GM start
  // their campaign adjacent to a community that already exists in
  // the persistent world. Mutually exclusive with setting + module
  // pickers. On create, seeds a Homestead pin at the community's
  // coords and fires an encounter handshake to the source GM.
  const [publishedCommunities, setPublishedCommunities] = useState<PublishedCommunity[]>([])
  const [pickedCommunityId, setPickedCommunityId] = useState<string>('')
  const debounceRef = useRef<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    listAvailableModules(supabase).then(setModules).catch(() => setModules([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load every approved world_communities row with valid coords.
  // The picker filters out the user's OWN communities (no point
  // starting a campaign near yourself) — done client-side after
  // resolving GM ids via campaigns.gm_user_id.
  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      const { data: wc } = await supabase
        .from('world_communities')
        .select('id, name, homestead_lat, homestead_lng, faction_label, size_band, community_status, source_campaign_id, description')
        .eq('moderation_status', 'approved')
        .not('homestead_lat', 'is', null)
        .not('homestead_lng', 'is', null)
        .order('name')
      const rows = (wc ?? []) as any[]
      if (rows.length === 0) { setPublishedCommunities([]); return }
      // Resolve source GM ids in one batch so we can hide self-owned
      // communities. RLS on campaigns may hide rows from the viewer;
      // we treat hidden = not mine = keep.
      const campIds = [...new Set(rows.map(r => r.source_campaign_id))]
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id, gm_user_id')
        .in('id', campIds)
      const gmByCampaign = new Map<string, string>()
      for (const c of (camps ?? []) as any[]) gmByCampaign.set(c.id, c.gm_user_id)
      const filtered: PublishedCommunity[] = rows
        .filter(r => !user || gmByCampaign.get(r.source_campaign_id) !== user.id)
        .map(r => ({
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          lat: r.homestead_lat,
          lng: r.homestead_lng,
          faction_label: r.faction_label ?? null,
          size_band: r.size_band ?? 'Group',
          community_status: r.community_status ?? 'Holding',
          source_campaign_id: r.source_campaign_id,
        }))
      setPublishedCommunities(filtered)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const { user } = await getCachedAuth()
    if (!user) { setError('Not logged in.'); setSaving(false); return }
    const invite_code = generateCode()
    // Resolve the picked community's coords so we can drop the new
    // campaign's map center + Homestead pin on top of them. Picked
    // before the campaign INSERT so a missing community fails fast.
    const pickedCommunity = pickedCommunityId
      ? publishedCommunities.find(c => c.id === pickedCommunityId) ?? null
      : null
    const seedCenterLat = pickedCommunity ? pickedCommunity.lat : customCenter?.lat ?? null
    const seedCenterLng = pickedCommunity ? pickedCommunity.lng : customCenter?.lng ?? null
    const { data, error: err } = await supabase.from('campaigns').insert({
      name: name.trim(),
      description: description.trim(),
      // Module-subscribed and community-anchored stories both store
      // 'custom' in the setting slot — neither uses the SETTING_PINS
      // pipeline.
      setting: (pickedModuleVersionId || pickedCommunity) ? 'custom' : (setting || 'custom'),
      map_style: mapStyle,
      map_center_lat: seedCenterLat,
      map_center_lng: seedCenterLng,
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

    // Phase E #C — community-anchored start. Skip the SETTING_PINS
    // pipeline; instead spawn a single Homestead pin at the picked
    // community's coords and fire an encounter handshake to its
    // source GM (the trigger on community_encounters handles the
    // notification fan-out). We deliberately don't auto-create a
    // local community for the new campaign — that's a decision for
    // the new GM to make once they're in their story.
    if (pickedCommunity) {
      const homesteadInsert = await supabase
        .from('campaign_pins')
        .insert({
          campaign_id: data.id,
          name: `Near ${pickedCommunity.name}`,
          lat: pickedCommunity.lat,
          lng: pickedCommunity.lng,
          notes: `Starting area for this campaign — adjacent to the published community "${pickedCommunity.name}". Reach out to that community's GM via the encounter notification they just received.`,
          category: 'community',
          revealed: false,
          sort_order: 1,
        })
      if (homesteadInsert.error) {
        setError(`Story created but Homestead pin failed: ${homesteadInsert.error.message}`)
        setSaving(false)
        return
      }
      // Encounter handshake. Trigger fires the notification to the
      // source GM. Insert failure is non-fatal — the new GM can
      // re-fire the handshake from the world map later.
      await supabase.from('community_encounters').insert({
        world_community_id: pickedCommunity.id,
        encountering_campaign_id: data.id,
        encountering_user_id: user.id,
        narrative: `New campaign "${name.trim()}" is starting near "${pickedCommunity.name}".`,
      })
      logEvent('campaign_created', { id: data.id, name, anchored_to_world_community_id: pickedCommunity.id })
      router.push(`/stories/${data.id}`)
      return
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
              <button key={s.value} onClick={() => { setSetting(s.value); setPickedModuleVersionId(''); setPickedModuleId(''); setPickedCommunityId('') }}
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
                      setPickedCommunityId('')
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

        {/* Phase E #C — anchor a new campaign next to a community
            already living on the Tapestry. Picking one stamps the
            campaign's map center on that community's coords, drops a
            single Homestead pin nearby, and fires an encounter handshake
            to the source GM. Mutually exclusive with the setting and
            module pickers. Hidden when there are no published
            communities to choose from (or only the user's own). */}
        {publishedCommunities.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <label style={lbl}>Or start near an existing community</label>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', lineHeight: 1.4 }}>
              Pick a published community already on the Tapestry. Your new story&apos;s map centers on their Homestead, and the source GM gets a handshake notification so the two tables can connect.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {publishedCommunities.map(c => {
                const picked = pickedCommunityId === c.id
                const statusColor = c.community_status === 'Thriving' ? '#7fc458'
                  : c.community_status === 'Holding' ? '#cce0f5'
                  : c.community_status === 'Struggling' ? '#EF9F27'
                  : c.community_status === 'Dying' ? '#f5a89a'
                  : '#5a5550'
                return (
                  <button key={c.id} onClick={() => {
                    if (picked) {
                      setPickedCommunityId('')
                    } else {
                      setPickedCommunityId(c.id)
                      setSetting('')
                      setPickedModuleVersionId('')
                      setPickedModuleId('')
                    }
                  }}
                    style={{ padding: '8px 10px', border: `1px solid ${picked ? '#7ab3d4' : '#3a3a3a'}`, background: picked ? '#0f1a2e' : '#242424', borderRadius: '3px', color: picked ? '#cce0f5' : '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>🌐 {c.name}</span>
                      <span style={{ fontSize: '13px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.size_band}</span>
                      <span style={{ fontSize: '13px', color: statusColor, textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.community_status}</span>
                      {c.faction_label && <span style={{ fontSize: '13px', color: '#EF9F27', textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.faction_label}</span>}
                    </div>
                    {c.description && <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px', fontFamily: 'Barlow, sans-serif', textTransform: 'none', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</div>}
                    <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '2px' }}>
                      {c.lat.toFixed(3)}, {c.lng.toFixed(3)}
                    </div>
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
