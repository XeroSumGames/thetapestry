'use client'
// QuickAddModal — the "Set the Table" / "Putting Down Roots" modal,
// extracted so multiple surfaces can use it. Originally lived inline
// in app/stories/[id]/table/page.tsx; now the shared home.
//
// Two modes:
//   - mode='campaign' — writes pins to `campaign_pins` (scoped to a
//     campaign). Community panel available (hideCommunity=false).
//   - mode='world'    — writes pins to `map_pins` (world map). No
//     community concept; hideCommunity is always true in this mode.
//
// The caller chooses the mode, supplies ids / role / seed coords, and
// gets onPinSaved / onCommunitySaved callbacks when either commits.
// The modal closes only on the caller's onClose — allowing multi-
// submit within one session.

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

export interface QuickAddModalProps {
  mode: 'campaign' | 'world'
  onClose: () => void
  // Seed coords; ignored if not provided.
  initialLat?: number | string
  initialLng?: number | string
  // Campaign mode — required when mode='campaign'.
  campaignId?: string
  // Controls the Community panel visibility (campaign mode only).
  // Default false = show both panels; true = pin only.
  hideCommunity?: boolean
  // World mode — used to set pin_type + status on map_pins.
  userRole?: 'survivor' | 'thriver' | null
  userId?: string | null
  // Fire-and-forget post-save hooks so the caller can refresh their
  // own views (pin list, community list, etc.).
  onPinSaved?: () => void
  onCommunitySaved?: () => void
}

const CAMPAIGN_CATEGORIES: { value: string; label: string; emoji: string }[] = [
  // Homestead sits at the top — communities tag their Base of Operations
  // with this category, and the Homestead pin dropdown on the Start-a-
  // Community panel shows homestead-tagged pins first.
  { value: 'homestead',  label: 'Homestead',  emoji: '🏡' },
  { value: 'location',   label: 'Location',   emoji: '📍' },
  { value: 'residence',  label: 'Residence',  emoji: '🏠' },
  { value: 'business',   label: 'Business',   emoji: '🏪' },
  { value: 'church',     label: 'Church',     emoji: '⛪' },
  { value: 'government', label: 'Government', emoji: '🏛️' },
  { value: 'airport',    label: 'Transport',  emoji: '✈️' },
  { value: 'hospital',   label: 'Hospital',   emoji: '🏥' },
  { value: 'military',   label: 'Military',   emoji: '⚔️' },
  { value: 'person',     label: 'Person',     emoji: '👤' },
  { value: 'danger',     label: 'Danger',     emoji: '☠️' },
  { value: 'resource',   label: 'Resource',   emoji: '🎒' },
  { value: 'medical',    label: 'Medical',    emoji: '🩸' },
  { value: 'group',      label: 'Group',      emoji: '👥' },
  { value: 'animals',    label: 'Animals',    emoji: '🐾' },
  { value: 'community',  label: 'Community',  emoji: '🏘️' },
  { value: 'settlement', label: 'Settlement', emoji: '🏚️' },
]
// World map supports the same categories plus rumor + distemper timeline.
const WORLD_CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: 'rumor',       label: 'Rumor',             emoji: '❓' },
  ...CAMPAIGN_CATEGORIES,
  { value: 'world_event', label: 'Distemper Timeline', emoji: '🌍' },
]

export default function QuickAddModal({
  mode, onClose, initialLat, initialLng,
  campaignId, hideCommunity: hideCommunityProp = false,
  userRole, userId,
  onPinSaved, onCommunitySaved,
}: QuickAddModalProps) {
  const supabase = createClient()
  const hideCommunity = mode === 'world' ? true : hideCommunityProp

  // ── Pin form state ───────────────────────────────────────────────
  const [pinLat, setPinLat] = useState<string>(initialLat != null ? String(initialLat) : '')
  const [pinLng, setPinLng] = useState<string>(initialLng != null ? String(initialLng) : '')
  const [pinName, setPinName] = useState('')
  const [pinNotes, setPinNotes] = useState('')
  const [pinCategory, setPinCategory] = useState(mode === 'world' ? 'location' : 'location')
  const [pinAttachments, setPinAttachments] = useState<File[]>([])
  const [pinSaving, setPinSaving] = useState(false)
  const [pinDone, setPinDone] = useState(false)
  // World mode only — controls whether the pin goes to the Thriver
  // queue (public rumor) or stays as a private personal note. Default
  // off so players aren't spamming the queue with private bookmarks.
  // Thrivers can also uncheck to keep a pin private to themselves.
  const [worldShare, setWorldShare] = useState(false)

  // Address search — geocodes a human-typed place name via Nominatim
  // and fills in Lat/Lng when the player picks a result. No auto-
  // submit; the player still hits Save Pin themselves.
  const [addrQuery, setAddrQuery] = useState('')
  const [addrResults, setAddrResults] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [addrSearching, setAddrSearching] = useState(false)
  async function handleAddressSearch() {
    const q = addrQuery.trim()
    if (!q) return
    setAddrSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setAddrResults(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('[quick-add] address search failed:', err)
      setAddrResults([])
    }
    setAddrSearching(false)
  }
  function pickAddressResult(r: { lat: string; lon: string; display_name: string }) {
    setPinLat(parseFloat(r.lat).toFixed(6))
    setPinLng(parseFloat(r.lon).toFixed(6))
    setAddrResults([])
    setAddrQuery(r.display_name)
  }

  // ── Community form state (campaign mode only) ────────────────────
  const [commName, setCommName] = useState('')
  const [commDesc, setCommDesc] = useState('')
  const [commHomestead, setCommHomestead] = useState('')
  const [commPublic, setCommPublic] = useState(false)
  const [commAttachments, setCommAttachments] = useState<File[]>([])
  const [commSaving, setCommSaving] = useState(false)
  const [commDone, setCommDone] = useState(false)
  const [pinList, setPinList] = useState<{ id: string; name: string; category: string | null }[]>([])
  // Existing communities + member counts → drives the "Join or Start
  // a Community" toggle. When ≥1 exists, the community panel flips
  // from Start-only to Join-or-Start; Join becomes the default mode.
  const [existingCommunities, setExistingCommunities] = useState<{ id: string; name: string; memberCount: number }[]>([])
  const [myPcId, setMyPcId] = useState<string | null>(null)
  const [commMode, setCommMode] = useState<'join' | 'start'>('start')
  const [commJoinId, setCommJoinId] = useState('')
  const [commJoining, setCommJoining] = useState(false)
  const [commJoinDone, setCommJoinDone] = useState(false)
  const [commJoinError, setCommJoinError] = useState<string | null>(null)

  // Load the pin list for the Homestead dropdown on the Community
  // panel whenever the modal opens (campaign mode, community visible).
  // Also pulled after each Pin save so a just-dropped Homestead-tagged
  // pin is immediately selectable. Simultaneously loads existing
  // communities + this user's PC id for the Join flow.
  useEffect(() => {
    if (mode !== 'campaign' || !campaignId || hideCommunity) return
    supabase.from('campaign_pins').select('id, name, category').eq('campaign_id', campaignId).order('name', { ascending: true })
      .then(({ data }: { data: { id: string; name: string; category: string | null }[] | null }) => setPinList(data ?? []))
    // Existing communities + member counts (parallel queries).
    ;(async () => {
      const [{ data: comms }, { data: mems }] = await Promise.all([
        supabase.from('communities').select('id, name').eq('campaign_id', campaignId).order('created_at', { ascending: true }),
        supabase.from('community_members').select('community_id, communities!inner(campaign_id)').is('left_at', null).eq('communities.campaign_id', campaignId),
      ])
      const byComm: Record<string, number> = {}
      for (const m of (mems ?? []) as any[]) byComm[m.community_id] = (byComm[m.community_id] ?? 0) + 1
      const list = ((comms ?? []) as { id: string; name: string }[]).map(c => ({ id: c.id, name: c.name, memberCount: byComm[c.id] ?? 0 }))
      setExistingCommunities(list)
      // Default to Join mode when there's at least one community; the
      // player is more likely joining an existing effort than splitting
      // off a new one on open.
      if (list.length > 0) setCommMode('join')
      else setCommMode('start')
    })()
    // Current user's PC in this campaign (for Join).
    if (userId) {
      supabase.from('campaign_members').select('character_id').eq('campaign_id', campaignId).eq('user_id', userId).not('character_id', 'is', null).maybeSingle()
        .then(({ data }: { data: { character_id: string } | null }) => setMyPcId(data?.character_id ?? null))
    }
  }, [mode, campaignId, hideCommunity, userId])

  // Re-seed lat/lng when caller passes new initial values (e.g. a
  // second dblclick on the map without closing first).
  useEffect(() => {
    if (initialLat != null) setPinLat(String(initialLat))
    if (initialLng != null) setPinLng(String(initialLng))
  }, [initialLat, initialLng])

  const categories = mode === 'world' ? WORLD_CATEGORIES : CAMPAIGN_CATEGORIES

  async function handlePinSave() {
    if (!pinName.trim()) return
    const lat = parseFloat(pinLat)
    const lng = parseFloat(pinLng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) { alert('Lat/Lng must be valid numbers'); return }
    setPinSaving(true)
    let newPinId: string | null = null

    if (mode === 'campaign') {
      if (!campaignId) { setPinSaving(false); alert('Missing campaign context'); return }
      const { data: maxRow } = await supabase.from('campaign_pins').select('sort_order').eq('campaign_id', campaignId).order('sort_order', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
      const nextSort = ((maxRow as any)?.sort_order ?? 0) + 1
      const { data, error } = await supabase.from('campaign_pins').insert({
        campaign_id: campaignId,
        name: pinName.trim(),
        lat, lng,
        notes: pinNotes.trim() || null,
        category: pinCategory,
        revealed: false,
        sort_order: nextSort,
      }).select('id').single()
      if (error || !data) {
        setPinSaving(false)
        alert(`Pin save failed: ${error?.message ?? 'unknown'}`)
        return
      }
      newPinId = data.id
    } else {
      // World mode — map_pins. Share flag decides whether this goes
      // public (Thriver queue for Survivors, auto-approved for
      // Thrivers) or stays as a private personal note.
      if (!userId) { setPinSaving(false); alert('Sign in to drop a pin'); return }
      const isThriver = userRole === 'thriver'
      const pinType = !worldShare ? 'private' : (isThriver ? 'gm' : 'rumor')
      const pinStatus = !worldShare ? 'active' : (isThriver ? 'approved' : 'pending')
      const { data, error } = await supabase.from('map_pins').insert({
        user_id: userId,
        lat, lng,
        title: pinName.trim(),
        notes: pinNotes.trim() || null,
        category: pinCategory,
        categories: [pinCategory],
        pin_type: pinType,
        status: pinStatus,
      }).select('id').single()
      if (error || !data) {
        setPinSaving(false)
        alert(`Pin save failed: ${error?.message ?? 'unknown'}`)
        return
      }
      newPinId = data.id
    }

    // Upload attachments. Path structure:
    //   campaign: pin-attachments/<campaign>/<pin>/<name>
    //   world:    pin-attachments/world/<pin>/<name>
    if (pinAttachments.length > 0 && newPinId) {
      const scope = mode === 'campaign' ? campaignId : 'world'
      for (const file of pinAttachments) {
        const path = `${scope}/${newPinId}/${file.name}`
        const { error: upErr } = await supabase.storage.from('pin-attachments').upload(path, file)
        if (upErr) console.warn('[quick-add] attachment upload failed:', file.name, upErr.message)
      }
    }
    setPinSaving(false)
    setPinDone(true)
    setPinName('')
    setPinNotes('')
    setPinAttachments([])
    setWorldShare(false)
    // Refresh the pin list so the Homestead dropdown sees it.
    if (mode === 'campaign' && campaignId) {
      const { data: pins } = await supabase.from('campaign_pins').select('id, name, category').eq('campaign_id', campaignId).order('name', { ascending: true })
      setPinList((pins ?? []) as { id: string; name: string; category: string | null }[])
    }
    onPinSaved?.()
  }

  // Join an existing community. Inserts a community_members row with
  // this user's PC as a Cohort (standard "I'm in" recruitment type).
  // Requires a PC in the campaign; if the user doesn't have one we
  // surface an inline hint instead of silently failing.
  async function handleCommJoin() {
    if (!commJoinId || !myPcId || mode !== 'campaign' || !campaignId) return
    setCommJoining(true)
    setCommJoinError(null)
    const { error } = await supabase.from('community_members').insert({
      community_id: commJoinId,
      character_id: myPcId,
      role: 'unassigned',
      recruitment_type: 'cohort',
      joined_at: new Date().toISOString(),
    })
    setCommJoining(false)
    if (error) {
      setCommJoinError(error.message)
      return
    }
    setCommJoinDone(true)
    // Bump the member count locally so the dropdown shows the new
    // count on a re-open without a full refresh.
    setExistingCommunities(prev => prev.map(c => c.id === commJoinId ? { ...c, memberCount: c.memberCount + 1 } : c))
    setCommJoinId('')
    onCommunitySaved?.()
  }

  async function handleCommSave() {
    if (!commName.trim() || mode !== 'campaign' || !campaignId) return
    setCommSaving(true)
    const { data, error } = await supabase.from('communities').insert({
      campaign_id: campaignId,
      name: commName.trim(),
      description: commDesc.trim() || null,
      homestead_pin_id: commHomestead || null,
      status: 'forming',
      world_visibility: commPublic ? 'published' : 'private',
    }).select('id').single()
    if (error || !data) {
      setCommSaving(false)
      alert(`Community save failed: ${error?.message ?? 'unknown'}`)
      return
    }
    if (commAttachments.length > 0) {
      for (const file of commAttachments) {
        const path = `${campaignId}/community-${data.id}/${file.name}`
        const { error: upErr } = await supabase.storage.from('pin-attachments').upload(path, file)
        if (upErr) console.warn('[quick-add] community attachment upload failed:', file.name, upErr.message)
      }
    }
    setCommSaving(false)
    setCommDone(true)
    setCommName('')
    setCommDesc('')
    setCommHomestead('')
    setCommPublic(false)
    setCommAttachments([])
    onCommunitySaved?.()
  }

  const title = hideCommunity
    ? (mode === 'world' ? 'Drop a Pin' : 'Set the Table')
    : 'Putting Down Roots'
  const subtitle = hideCommunity
    ? (mode === 'world'
        ? 'Title, notes, category, attachments — all go with the pin on the world map.'
        : 'Drop a pin at the location you just double-clicked. Title, notes, and attachments all go with the pin.')
    : 'Drop a pin on the map, start a community, or both. Each saves independently and can include attachments.'

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '100%', maxWidth: hideCommunity ? '440px' : '760px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Quick Add</div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1.25rem', fontFamily: 'Barlow, sans-serif' }}>{subtitle}</div>

        <div style={{ display: 'grid', gridTemplateColumns: hideCommunity ? '1fr' : '1fr 1fr', gap: '16px' }}>
          {/* ── Drop a Pin ───────────────────────────────────── */}
          <div style={{ padding: '14px', background: '#0f1a2e', border: '1px solid #2e2e5a', borderRadius: '4px' }}>
            <div style={{ fontSize: '13px', color: '#7ab3d4', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px' }}>📍 Drop a Pin</div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Title</div>
              <input value={pinName} onChange={e => setPinName(e.target.value)} placeholder="e.g. Abandoned hospital"
                style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Lat</div>
                <input value={pinLat} onChange={e => setPinLat(e.target.value)} placeholder="40.4406"
                  style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Lng</div>
                <input value={pinLng} onChange={e => setPinLng(e.target.value)} placeholder="-79.9959"
                  style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Address search — geocodes via Nominatim, fills Lat/Lng
                when the player picks a result. Sits between the
                Lat/Lng row and Category per user spec. */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Address Search (optional)</div>
              <form onSubmit={e => { e.preventDefault(); handleAddressSearch() }}
                style={{ display: 'flex', gap: '6px' }}>
                <input value={addrQuery} onChange={e => setAddrQuery(e.target.value)}
                  placeholder="e.g. Broken Arrow, OK"
                  style={{ flex: 1, padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
                <button type="submit" disabled={!addrQuery.trim() || addrSearching}
                  style={{ padding: '7px 14px', background: addrQuery.trim() ? '#1a1a2e' : '#111', border: `1px solid ${addrQuery.trim() ? '#2e2e5a' : '#2e2e2e'}`, borderRadius: '3px', color: addrQuery.trim() ? '#7ab3d4' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: addrQuery.trim() && !addrSearching ? 'pointer' : 'not-allowed' }}>
                  {addrSearching ? '…' : 'Go'}
                </button>
              </form>
              {addrResults.length > 0 && (
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '180px', overflowY: 'auto', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                  {addrResults.map((r, i) => (
                    <button key={i} type="button" onClick={() => pickAddressResult(r)}
                      style={{ textAlign: 'left', padding: '6px 8px', background: 'transparent', border: 'none', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow, sans-serif', cursor: 'pointer', lineHeight: 1.3 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a1a2e')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Category</div>
              <select value={pinCategory} onChange={e => setPinCategory(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                {categories.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Notes (optional)</div>
              <textarea value={pinNotes} onChange={e => setPinNotes(e.target.value)} rows={2}
                style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Attachments (optional)</div>
              <label style={{ display: 'block', padding: '10px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: pinAttachments.length > 0 ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', cursor: 'pointer' }}>
                {pinAttachments.length > 0 ? `${pinAttachments.length} file${pinAttachments.length > 1 ? 's' : ''} selected` : 'Click to attach files'}
                <input type="file" multiple onChange={e => { if (e.target.files) setPinAttachments(Array.from(e.target.files)) }} style={{ display: 'none' }} />
              </label>
              {pinAttachments.length > 0 && (
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>
                  {pinAttachments.map((f, i) => <div key={i}>{f.name}</div>)}
                </div>
              )}
            </div>

            {/* World-mode share toggle — off = private note only I can
                see; on = public rumor (submitted to Thriver queue for
                Survivors, auto-approved for Thrivers). */}
            {mode === 'world' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', padding: '8px 10px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', cursor: 'pointer' }}>
                <input type="checkbox" checked={worldShare} onChange={e => setWorldShare(e.target.checked)} style={{ marginTop: '2px' }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Make this pin public
                  </span>
                  <span style={{ display: 'block', marginTop: '2px', fontSize: '12px', color: '#5a5550', fontFamily: 'Barlow, sans-serif', lineHeight: 1.3 }}>
                    {userRole === 'thriver'
                      ? 'Auto-approved for Thrivers. Visible to all players as a Rumor.'
                      : 'Goes to the Thriver queue. If approved, becomes a Rumor visible to all players.'}
                    {!worldShare && ' Otherwise kept private — only you can see it.'}
                  </span>
                </span>
              </label>
            )}

            <button onClick={handlePinSave} disabled={pinSaving || !pinName.trim()}
              style={{ width: '100%', padding: '9px', background: pinName.trim() ? '#1a1a2e' : '#111', border: `1px solid ${pinName.trim() ? '#2e2e5a' : '#2e2e2e'}`, borderRadius: '3px', color: pinName.trim() ? '#7ab3d4' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: pinName.trim() && !pinSaving ? 'pointer' : 'not-allowed' }}>
              {pinSaving ? 'Saving…' : '📍 Save Pin'}
            </button>
            {pinDone && (
              <div style={{ marginTop: '8px', padding: '6px 10px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', letterSpacing: '.04em' }}>
                ✓ Pin saved. Add another or close.
              </div>
            )}
          </div>

          {/* ── Start a Community — campaign mode only, not hidden ── */}
          {!hideCommunity && (
            <div style={{ padding: '14px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '4px' }}>
              <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px' }}>
                🏘️ {existingCommunities.length > 0 ? 'Join or Start a Community' : 'Start a Community'}
              </div>

              {/* Mode toggle — only shown when at least one community
                  exists in the campaign. Join is the default (more
                  common action for a player arriving at a table with
                  an existing group); Start New is the escape hatch. */}
              {existingCommunities.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  <button type="button" onClick={() => setCommMode('join')}
                    style={{ flex: 1, padding: '7px', background: commMode === 'join' ? '#2d5a1b' : '#111', border: `1px solid ${commMode === 'join' ? '#7fc458' : '#2e2e2e'}`, borderRadius: '3px', color: commMode === 'join' ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                    🤝 Join Existing
                  </button>
                  <button type="button" onClick={() => setCommMode('start')}
                    style={{ flex: 1, padding: '7px', background: commMode === 'start' ? '#2d5a1b' : '#111', border: `1px solid ${commMode === 'start' ? '#7fc458' : '#2e2e2e'}`, borderRadius: '3px', color: commMode === 'start' ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                    🏡 Start New
                  </button>
                </div>
              )}

              {/* ── Join Existing branch ──────────────────────────── */}
              {commMode === 'join' && existingCommunities.length > 0 && (
                <>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Community</div>
                    <select value={commJoinId} onChange={e => setCommJoinId(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                      <option value="">— pick a community —</option>
                      {existingCommunities.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.memberCount} member{c.memberCount === 1 ? '' : 's'})</option>
                      ))}
                    </select>
                  </div>

                  {!myPcId && userId && (
                    <div style={{ marginBottom: '10px', padding: '8px 10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', fontSize: '12px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', lineHeight: 1.4 }}>
                      You need a PC assigned to this campaign before you can join a community. Ask the GM to invite you with a character.
                    </div>
                  )}

                  <button type="button" onClick={handleCommJoin} disabled={!commJoinId || !myPcId || commJoining}
                    style={{ width: '100%', padding: '9px', background: commJoinId && myPcId ? '#1a2e10' : '#111', border: `1px solid ${commJoinId && myPcId ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: commJoinId && myPcId ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: commJoinId && myPcId && !commJoining ? 'pointer' : 'not-allowed' }}>
                    {commJoining ? 'Joining…' : '🤝 Join Community'}
                  </button>
                  {commJoinDone && (
                    <div style={{ marginTop: '8px', padding: '6px 10px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', letterSpacing: '.04em' }}>
                      ✓ Joined.
                    </div>
                  )}
                  {commJoinError && (
                    <div style={{ marginTop: '8px', padding: '6px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '12px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                      {commJoinError}
                    </div>
                  )}
                </>
              )}

              {/* ── Start New branch — the original flow ──────────── */}
              {commMode === 'start' && (
              <>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Name</div>
                <input value={commName} onChange={e => setCommName(e.target.value)} placeholder="e.g. The Greenhouse"
                  style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Description (optional)</div>
                <textarea value={commDesc} onChange={e => setCommDesc(e.target.value)} rows={2}
                  style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Homestead pin (optional)</div>
                <select value={commHomestead} onChange={e => setCommHomestead(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none' }}>
                  <option value="">— none —</option>
                  {(() => {
                    // Homestead-tagged pins float to the top with a 🏡
                    // marker; other pins follow. Keeps the right pin
                    // easy to find when a community has a purpose-
                    // built Base of Operations marked as Homestead.
                    const homesteadPins = pinList.filter(p => p.category === 'homestead')
                    const otherPins = pinList.filter(p => p.category !== 'homestead')
                    return (
                      <>
                        {homesteadPins.length > 0 && (
                          <optgroup label="Homestead pins">
                            {homesteadPins.map(p => <option key={p.id} value={p.id}>🏡 {p.name}</option>)}
                          </optgroup>
                        )}
                        {otherPins.length > 0 && (
                          <optgroup label={homesteadPins.length > 0 ? 'Other pins' : 'Pins'}>
                            {otherPins.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </optgroup>
                        )}
                      </>
                    )
                  })()}
                </select>
                {pinList.length === 0 && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#5a5550', fontFamily: 'Barlow, sans-serif' }}>Drop a pin on the left first to tie a homestead to it. Tag it as <strong style={{ color: '#7ab3d4' }}>🏡 Homestead</strong> for easy selection.</div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                <input type="checkbox" checked={commPublic} onChange={e => setCommPublic(e.target.checked)} />
                Make public (LFG — coming soon)
              </label>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Attachments (optional)</div>
                <label style={{ display: 'block', padding: '10px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: commAttachments.length > 0 ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', cursor: 'pointer' }}>
                  {commAttachments.length > 0 ? `${commAttachments.length} file${commAttachments.length > 1 ? 's' : ''} selected` : 'Click to attach files'}
                  <input type="file" multiple onChange={e => { if (e.target.files) setCommAttachments(Array.from(e.target.files)) }} style={{ display: 'none' }} />
                </label>
                {commAttachments.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>
                    {commAttachments.map((f, i) => <div key={i}>{f.name}</div>)}
                  </div>
                )}
              </div>

              <button onClick={handleCommSave} disabled={commSaving || !commName.trim()}
                style={{ width: '100%', padding: '9px', background: commName.trim() ? '#1a2e10' : '#111', border: `1px solid ${commName.trim() ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: commName.trim() ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: commName.trim() && !commSaving ? 'pointer' : 'not-allowed' }}>
                {commSaving ? 'Saving…' : '🏘️ Create Community'}
              </button>
              {commDone && (
                <div style={{ marginTop: '8px', padding: '6px 10px', background: '#0f1a0f', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', letterSpacing: '.04em' }}>
                  ✓ Community created.
                </div>
              )}
              </>
              )}
            </div>
          )}
        </div>

        <button onClick={onClose}
          style={{ marginTop: '1.25rem', width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Done
        </button>
      </div>
    </div>
  )
}
