'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { logFirstEvent } from '../lib/events'
import { PIN_CATEGORIES, getCategoryEmoji as sharedGetCategoryEmoji } from '../lib/pin-categories'
import QuickAddModal from './QuickAddModal'
import { searchNominatimUSFirst } from '../lib/nominatim-search'
import { LABEL_STYLE, LABEL_STYLE_LG, LABEL_STYLE_TIGHT, ModalBackdrop, Z_INDEX } from '../lib/style-helpers'

type PinTier = 'landmark' | 'location' | 'event' | 'personal'

function getPinTier(pin: { category?: string; pin_type?: string }): PinTier {
  const cat = pin.category ?? ''
  const type = pin.pin_type ?? ''
  if (cat === 'settlement' || cat === 'government') return 'landmark'
  if (cat === 'world_event') return 'event'
  if (type === 'rumor' || type === 'private') return 'personal'
  return 'location'
}

function getTierStyles(tier: PinTier) {
  switch (tier) {
    case 'landmark': return { mapSize: 28, fontSize: '26px', shadow: 'drop-shadow(0 0 4px rgba(192,57,43,.5))', sidebarWeight: 700, sidebarSize: '15px' }
    case 'event': return { mapSize: 26, fontSize: '24px', shadow: 'drop-shadow(0 0 3px rgba(239,159,39,.4))', sidebarWeight: 700, sidebarSize: '14px' }
    case 'location': return { mapSize: 24, fontSize: '20px', shadow: 'drop-shadow(0 1px 3px rgba(0,0,0,.6))', sidebarWeight: 600, sidebarSize: '14px' }
    case 'personal': return { mapSize: 20, fontSize: '16px', shadow: 'drop-shadow(0 1px 2px rgba(0,0,0,.4))', sidebarWeight: 400, sidebarSize: '13px' }
  }
}

function getNearSetting(lat: number, lng: number): string | null {
  if (Math.abs(lat - 36.052) < 0.05 && Math.abs(lng - (-95.790)) < 0.05) return 'District Zero'
  if (Math.abs(lat - 38.710) < 0.05 && Math.abs(lng - (-75.510)) < 0.05) return 'Chased'
  if (lat >= 33 && lat <= 46 && lng >= -113 && lng <= -111) return 'Mongrels'
  return null
}

const REGION_BOUNDS: Record<string, { label: string; latMin: number; latMax: number; lngMin: number; lngMax: number; lat: number; lng: number; zoom: number }> = {
  district_zero: { label: 'District Zero', latMin: 36.04, latMax: 36.07, lngMin: -95.81, lngMax: -95.77, lat: 36.052, lng: -95.790, zoom: 15 },
  chased:        { label: 'Chased',        latMin: 38.65, latMax: 38.78, lngMin: -75.75, lngMax: -75.30, lat: 38.710, lng: -75.510, zoom: 12 },
  mongrels:      { label: 'Mongrels',      latMin: 33.0,  latMax: 46.0,  lngMin: -113.5, lngMax: -110.5, lat: 38.0,   lng: -112.0,  zoom: 5  },
}
const REGION_KEYS = Object.keys(REGION_BOUNDS)

function pinInRegion(p: { lat: number; lng: number }, key: string): boolean {
  const r = REGION_BOUNDS[key]
  if (!r) return false
  return p.lat >= r.latMin && p.lat <= r.latMax && p.lng >= r.lngMin && p.lng <= r.lngMax
}

// Local alias keeps existing callers working — implementation lives in
// lib/pin-categories.ts so CampaignPins picks up the same source.
function getCategoryEmoji(category: string): string {
  return sharedGetCategoryEmoji(category)
}

interface Pin {
  id: string
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: string
  status: string
  user_id: string
  category: string
  categories?: string[]
  created_at?: string
  sort_order?: number
  event_date?: string | null
  address?: string | null
  // Parent/child structure — null for top-level pins, references
  // another map_pins.id for sub-rumors (e.g. "the basement" hanging
  // off "the abandoned warehouse"). FK is ON DELETE SET NULL so a
  // deleted parent orphans its children rather than cascading.
  parent_pin_id?: string | null
}

interface PinForm {
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: 'private' | 'rumor'
  categories: string[]
}

interface MapViewProps {
  embedded?: boolean
  showSidebar?: boolean
  showHeader?: boolean
}

export default function MapView({ embedded = false, showHeader = true, showSidebar: showSidebarProp = false }: MapViewProps) {
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const clusterGroupRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const channelRef = useRef<any>(null)
  const [pins, setPins] = useState<Pin[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'survivor' | 'thriver'>('survivor')
  const [showForm, setShowForm] = useState(false)
  // Quick Add modal — shared with /table. Replaces the old inline
  // "Add a Pin" panel. The legacy showForm / form / handleSavePin
  // code path remains only because startEdit() historically used
  // setShowForm(false) to dismiss it; harmless now.
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddLat, setQuickAddLat] = useState<number | null>(null)
  const [quickAddLng, setQuickAddLng] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(!embedded || showSidebarProp)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']))
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set())
  const [sortMode, setSortMode] = useState<'newest' | 'name'>('newest')
  const [pinSearch, setPinSearch] = useState('')
  const [expandedPinId, setExpandedPinId] = useState<string | null>(null)
  const [usernames, setUsernames] = useState<Record<string, string>>({})
  // Author-role lookup for the CANON badge. Built from the same profiles
  // fetch that populates usernames; lives in state so the folder-list
  // render below can decide whether to show the inline CANON tag.
  const [thriverUserIds, setThriverUserIds] = useState<Set<string>>(new Set())
  const [pinAttachments, setPinAttachments] = useState<Record<string, { name: string; url: string }[]>>({})
  const [pinsVisible, setPinsVisible] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'public' | 'mine' | 'campaign' | 'whispers'>('public')
  const [campaignPins, setCampaignPins] = useState<{ id: string; name: string; notes: string | null; lat: number; lng: number; category: string; campaign_name: string }[]>([])
  // Whispers — public message wall. Distinct from the in-table /whisper
  // chat command (private DM). Anyone signed-in posts; Thrivers can
  // hard-delete. Schema in sql/whispers.sql; RLS enforces both.
  const [whispers, setWhispers] = useState<{ id: string; author_user_id: string; content: string; created_at: string; author_username?: string }[]>([])
  const [whisperDraft, setWhisperDraft] = useState('')
  const [postingWhisper, setPostingWhisper] = useState(false)
  const [deletingWhisperId, setDeletingWhisperId] = useState<string | null>(null)
  // Phase E Sprint 3 polish — synthetic "🌐 Published Communities"
  // sidebar folder. Populated during loadPins so the sidebar can
  // list approved world_communities alongside the normal pin folder
  // tree, with the same eye-toggle hide mechanism (via the
  // 'world_community' key in hiddenFolders).
  const [worldCommunities, setWorldCommunities] = useState<{
    id: string
    name: string
    lat: number
    lng: number
    size_band: string
    community_status: string
    faction_label: string | null
    source_campaign_id: string
    campaign_name: string
  }[]>([])

  // Phase E Sprint 4a — GM-to-GM Contact Handshake. The encountering
  // GM picks one of their campaigns + types a one-line narrative;
  // submit inserts a community_encounters row whose Postgres trigger
  // fires a notification to the source community's GM.
  const [myGmCampaigns, setMyGmCampaigns] = useState<{ id: string; name: string }[]>([])
  const [encounterTarget, setEncounterTarget] = useState<{ worldCommunityId: string; name: string; sourceCampaignId: string } | null>(null)
  const [encounterCampaignId, setEncounterCampaignId] = useState<string>('')
  const [encounterNarrative, setEncounterNarrative] = useState<string>('')
  const [encounterSubmitting, setEncounterSubmitting] = useState<boolean>(false)

  // Phase E Sprint 5 — Community subscription. Set of world_community
  // ids the current user follows. Loaded on mount; mutated inline by
  // the Follow / Following toggle in the world-community popup. Used
  // to seed the button label at popup-creation time + check current
  // state when toggling.
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set())
  const subscribedIdsRef = useRef<Set<string>>(new Set())
  subscribedIdsRef.current = subscribedIds

  // Phase E Sprint 4b — Trade / Alliance / Feud links between
  // published communities. The user picks one of THEIR approved
  // world_communities + link type + narrative; submit inserts a
  // world_community_links row whose trigger fires a notification
  // to the OTHER community's GM. Active links render as colored
  // polylines on the world map.
  const [myPublishedCommunities, setMyPublishedCommunities] = useState<{
    id: string; name: string
  }[]>([])
  const [linkTarget, setLinkTarget] = useState<{ worldCommunityId: string; name: string } | null>(null)
  const [linkFromId, setLinkFromId] = useState<string>('')
  const [linkType, setLinkType] = useState<'trade' | 'alliance' | 'feud'>('trade')
  const [linkNarrative, setLinkNarrative] = useState<string>('')
  const [linkSubmitting, setLinkSubmitting] = useState<boolean>(false)
  const polylinesRef = useRef<any[]>([])
  const [form, setForm] = useState<PinForm>({ lat: 0, lng: 0, title: '', notes: '', pin_type: 'private', categories: ['location'] })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingPin, setEditingPin] = useState<Pin | null>(null)
  const [editForm, setEditForm] = useState({ title: '', notes: '', categories: ['location'] as string[], event_date: '', sort_order: '', lat: '', lng: '', address: '', cmod_active: false, cmod_impact: '', cmod_radius_km: '', cmod_label: '', parent_pin_id: '' })
  // Address autocomplete (Nominatim) state for the Edit Pin modal.
  // Mirrors the world-map address-search bar at the top — type 3+ chars
  // and we offer matching geocodes; click one to fill lat/lng/address.
  const [editAddressSuggestions, setEditAddressSuggestions] = useState<any[]>([])
  const editAddressDebounceRef = useRef<any>(null)
  const [editAttachments, setEditAttachments] = useState<File[]>([])
  const [editExistingFiles, setEditExistingFiles] = useState<{ name: string; url: string }[]>([])
  const [editUploading, setEditUploading] = useState(false)
  const [hiddenFolders, setHiddenFolders] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem('tapestry_hidden_folders'); if (saved) return new Set(JSON.parse(saved)) } catch {}
    }
    return new Set<string>()
  })

  // Phase E Sprint 4a — delegated click listener for the encounter
  // button inside Leaflet popups. Popup HTML is a string and can't
  // bind React handlers; we mark the button with a data attribute
  // and intercept the click here. Pre-flights: must be signed in
  // AND must GM at least one campaign that's NOT the source campaign
  // (you can't "encounter" your own community).
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (!t) return
      // Encounter button (Sprint 4a).
      const encBtn = t.closest('[data-tapestry-encounter="1"]') as HTMLElement | null
      if (encBtn) {
        e.preventDefault()
        e.stopPropagation()
        const worldCommunityId = encBtn.getAttribute('data-world-community-id') ?? ''
        const sourceCampaignId = encBtn.getAttribute('data-source-campaign-id') ?? ''
        const name = encBtn.getAttribute('data-name') ?? ''
        if (!worldCommunityId || !sourceCampaignId) return
        const eligible = myGmCampaigns.filter(c => c.id !== sourceCampaignId)
        if (eligible.length === 0) {
          alert('To flag an encounter you need to GM a campaign other than the one this community came from. Either create a campaign, or this community is one of your own.')
          return
        }
        setEncounterTarget({ worldCommunityId, name, sourceCampaignId })
        setEncounterCampaignId(eligible[0].id)
        setEncounterNarrative('')
        return
      }
      // Follow button (Sprint 5). Toggle insert/delete on the
      // community_subscriptions table; update the button's label +
      // styling inline so the popup reflects the new state without
      // a refetch. Buttons on other open popups stay stale until
      // their popup is reopened — acceptable since following is a
      // single-target action. Outer handler is sync; the actual DB
      // toggle runs in an async IIFE so we don't fight TS about
      // top-level await inside a non-async listener.
      const followBtn = t.closest('[data-tapestry-follow="1"]') as HTMLElement | null
      if (followBtn) {
        e.preventDefault()
        e.stopPropagation()
        const wcid = followBtn.getAttribute('data-world-community-id') ?? ''
        const userId = userIdRef.current
        if (!wcid || !userId) return
        const wasFollowing = subscribedIdsRef.current.has(wcid)
        ;(async () => {
          if (wasFollowing) {
            const { error } = await supabase.from('community_subscriptions')
              .delete().eq('user_id', userId).eq('world_community_id', wcid)
            if (error) { alert(`Unfollow failed: ${error.message}`); return }
            setSubscribedIds(prev => { const n = new Set(prev); n.delete(wcid); return n })
          } else {
            const { error } = await supabase.from('community_subscriptions')
              .insert({ user_id: userId, world_community_id: wcid })
            if (error) { alert(`Follow failed: ${error.message}`); return }
            setSubscribedIds(prev => new Set(prev).add(wcid))
          }
          // Inline label + style swap so the popup reflects new state
          // immediately. The next loadOverlay run picks up the
          // canonical state from subscribedIdsRef.
          const nowFollowing = !wasFollowing
          followBtn.textContent = nowFollowing ? '★ Following' : '☆ Follow'
          followBtn.style.background = nowFollowing ? '#1a2e10' : 'transparent'
          followBtn.style.borderColor = nowFollowing ? '#2d5a1b' : '#2e2e2e'
          followBtn.style.color = nowFollowing ? '#7fc458' : '#cce0f5'
        })()
        return
      }
      // Link-propose button (Sprint 4b).
      const linkBtn = t.closest('[data-tapestry-link="1"]') as HTMLElement | null
      if (linkBtn) {
        e.preventDefault()
        e.stopPropagation()
        const worldCommunityId = linkBtn.getAttribute('data-world-community-id') ?? ''
        const name = linkBtn.getAttribute('data-name') ?? ''
        if (!worldCommunityId) return
        // Must own at least one published+approved community OTHER
        // than the target — links connect two distinct communities.
        const eligible = myPublishedCommunities.filter(wc => wc.id !== worldCommunityId)
        if (eligible.length === 0) {
          alert('To propose a link you need an approved published community of your own that isn\'t the target. Publish one and wait for Thriver approval first.')
          return
        }
        setLinkTarget({ worldCommunityId, name })
        setLinkFromId(eligible[0].id)
        setLinkType('trade')
        setLinkNarrative('')
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [myGmCampaigns, myPublishedCommunities])

  async function submitLink() {
    if (!linkTarget || linkSubmitting) return
    if (!linkFromId) { alert('Pick which of your published communities is proposing the link.'); return }
    if (linkFromId === linkTarget.worldCommunityId) { alert('A community cannot link to itself.'); return }
    setLinkSubmitting(true)
    const { user } = await getCachedAuth()
    // Sort the endpoint pair so the unique constraint can match
    // proposal-from-A → B and proposal-from-B → A as the same logical
    // link if you ever need to dedupe later. (Today the constraint
    // keys on community_a + community_b + link_type + status, so
    // ordering matters; sorting keeps it predictable.)
    const [a, b] = [linkFromId, linkTarget.worldCommunityId].sort()
    const { error } = await supabase.from('world_community_links').insert({
      community_a_id: a,
      community_b_id: b,
      link_type: linkType,
      proposed_by_user_id: user?.id ?? null,
      proposed_from_community_id: linkFromId,
      narrative: linkNarrative.trim() || null,
    })
    setLinkSubmitting(false)
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        alert('You already have a pending proposal for this link type with this community. Wait for the other GM to respond.')
      } else {
        alert(`Link proposal failed: ${error.message}`)
      }
      return
    }
    setLinkTarget(null)
    setLinkFromId('')
    setLinkType('trade')
    setLinkNarrative('')
    alert('Link proposal sent. The other community\'s GM will see it in their notifications.')
  }

  async function submitEncounter() {
    if (!encounterTarget || encounterSubmitting) return
    if (!encounterCampaignId) { alert('Pick which of your campaigns is encountering this community.'); return }
    setEncounterSubmitting(true)
    const { user } = await getCachedAuth()
    const trimmedNarrative = encounterNarrative.trim()
    const { error } = await supabase.from('community_encounters').insert({
      world_community_id: encounterTarget.worldCommunityId,
      encountering_campaign_id: encounterCampaignId,
      encountering_user_id: user?.id ?? null,
      narrative: trimmedNarrative || null,
    })
    // UNIQUE(world_community_id, encountering_campaign_id, status='pending')
    // blocks a second row while the first is still pending. Rather
    // than rejecting the user (who may have more context to share),
    // append their new narrative to the existing pending encounter
    // as a follow-up note. The source GM's response UI surfaces the
    // concatenated narrative so they still see everything when they
    // accept/decline.
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        const { data: existing } = await supabase
          .from('community_encounters')
          .select('id, narrative')
          .eq('world_community_id', encounterTarget.worldCommunityId)
          .eq('encountering_campaign_id', encounterCampaignId)
          .eq('status', 'pending')
          .maybeSingle()
        if (existing) {
          const appended = [
            (existing as any).narrative?.trim(),
            trimmedNarrative ? `— Follow-up: ${trimmedNarrative}` : '— Follow-up (no additional notes)',
          ].filter(Boolean).join('\n\n')
          const { error: updErr } = await supabase
            .from('community_encounters')
            .update({ narrative: appended })
            .eq('id', (existing as any).id)
          setEncounterSubmitting(false)
          if (updErr) { alert(`Follow-up failed: ${updErr.message}`); return }
          setEncounterTarget(null)
          setEncounterCampaignId('')
          setEncounterNarrative('')
          alert('Added your follow-up to the existing pending encounter. The source GM will see the full thread when they respond.')
          return
        }
      }
      setEncounterSubmitting(false)
      alert(`Encounter failed: ${error.message}`)
      return
    }
    setEncounterSubmitting(false)
    setEncounterTarget(null)
    setEncounterCampaignId('')
    setEncounterNarrative('')
    alert('Encounter sent. The source community\'s GM will see it in their notifications.')
  }

  // Listen for copy-position event from Sidebar
  useEffect(() => {
    function handleCopyPosition() {
      const map = mapInstanceRef.current
      if (!map) { alert('Map not loaded yet'); return }
      const c = map.getCenter()
      const z = map.getZoom()
      const text = `center: [${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}], zoom: ${z}`
      navigator.clipboard.writeText(text)
      alert(`Copied: ${text}`)
    }
    window.addEventListener('tapestry-copy-map-position', handleCopyPosition)
    return () => window.removeEventListener('tapestry-copy-map-position', handleCopyPosition)
  }, [])

  const hiddenFoldersRef = useRef(hiddenFolders)
  hiddenFoldersRef.current = hiddenFolders

  // Re-render map markers when folder visibility or auth state changes
  useEffect(() => { if (mapInstanceRef.current) loadPins() }, [hiddenFolders, userId])
  // Load campaign pins when tab switches to campaign
  useEffect(() => { if (sidebarTab === 'campaign' && userId) loadCampaignPins() }, [sidebarTab, userId])

  // Load whispers when the tab is selected; subscribe to realtime so a
  // new post from another user shows up without a refresh. Cleanup
  // unsubscribes on tab switch / unmount.
  useEffect(() => {
    if (sidebarTab !== 'whispers' || !userId) return
    let cancelled = false
    async function loadWhispers() {
      const { data } = await supabase
        .from('whispers')
        .select('id, author_user_id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (cancelled || !data) return
      // Resolve author usernames for any ids not already cached.
      const missingIds = [...new Set(data.map((w: any) => w.author_user_id).filter((id: string) => !usernames[id]))]
      let nameMap = { ...usernames }
      if (missingIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, username').in('id', missingIds)
        for (const p of (profs ?? []) as any[]) nameMap[p.id] = p.username
        setUsernames(nameMap)
      }
      setWhispers(data.map((w: any) => ({ ...w, author_username: nameMap[w.author_user_id] })))
    }
    loadWhispers()
    const ch = supabase.channel(`whispers_feed`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'whispers' },
      () => { void loadWhispers() },
    ).subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [sidebarTab, userId])

  async function postWhisper() {
    if (!userId || postingWhisper) return
    const content = whisperDraft.trim()
    if (!content) return
    setPostingWhisper(true)
    const { error } = await supabase.from('whispers').insert({
      author_user_id: userId,
      content,
    })
    if (error) {
      alert(`Whisper failed: ${error.message}`)
    } else {
      setWhisperDraft('')
      // Realtime sub picks up the row; no manual refresh needed.
    }
    setPostingWhisper(false)
  }

  async function deleteWhisper(id: string) {
    if (deletingWhisperId) return
    setDeletingWhisperId(id)
    const { error } = await supabase.from('whispers').delete().eq('id', id)
    if (error) {
      alert(`Delete failed: ${error.message}`)
    } else {
      // Realtime sub will refresh; do an optimistic prune for snappiness.
      setWhispers(prev => prev.filter(w => w.id !== id))
    }
    setDeletingWhisperId(null)
  }
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try { const saved = localStorage.getItem('tapestry_folder_state'); if (saved) return new Set(JSON.parse(saved)) } catch {}
    }
    return new Set<string>()
  })
  const [mapLayer, setMapLayer] = useState<string>('street')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const debounceRef = useRef<any>(null)
  const [searching, setSearching] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { user } = await getCachedAuth()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile) setUserRole((profile.role as string).toLowerCase() as 'survivor' | 'thriver')
        // Phase E Sprint 4a — preload the campaigns this user GMs
        // so the encounter modal's campaign picker is ready when
        // they click an encounter button on a published community.
        const { data: gmCamps } = await supabase
          .from('campaigns').select('id, name').eq('gm_user_id', user.id).order('name')
        if (gmCamps) setMyGmCampaigns(gmCamps as { id: string; name: string }[])
        // Phase E Sprint 4b — preload the user's approved
        // world_communities so the link-propose modal can list
        // them as eligible "from" endpoints. Filter to approved
        // because pending/rejected communities aren't on the map.
        if (gmCamps && gmCamps.length > 0) {
          const { data: myWc } = await supabase
            .from('world_communities')
            .select('id, name')
            .eq('moderation_status', 'approved')
            .in('source_campaign_id', gmCamps.map((c: any) => c.id))
            .order('name')
          if (myWc) setMyPublishedCommunities(myWc as { id: string; name: string }[])
        }
        // Phase E Sprint 5 — preload the user's community
        // subscriptions so the world-community popup's Follow button
        // seeds in the right state on first paint.
        const { data: subs } = await supabase
          .from('community_subscriptions')
          .select('world_community_id')
          .eq('user_id', user.id)
        if (subs) setSubscribedIds(new Set((subs as any[]).map(r => r.world_community_id)))
      }

      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, { center: [35.2456, 9.8438], zoom: 3, zoomControl: true, minZoom: 2 })

      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map

      map.on('click', (e: any) => {
        if (!user) return // Ghost mode — read only
        setQuickAddLat(e.latlng.lat)
        setQuickAddLng(e.latlng.lng)
        setShowQuickAdd(true)
        setEditingPin(null)
      })

      await loadPins(L, map)

      // Listen for fly-to events from dashboard search
      const flyToHandler = (e: Event) => {
        const { lat, lon } = (e as CustomEvent).detail
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lon], 13, { duration: 1.2 })
        }
      }
      window.addEventListener('tapestry-fly-to', flyToHandler)

      // URL-param flyTo — lets other pages deep-link into /map at
      // specific coords (e.g. /moderate "View on map" button).
      // Format: /map?flyTo=<lat>,<lng>[&zoom=<z>]. Runs once at
      // init, after the map instance is ready.
      try {
        const qs = new URLSearchParams(window.location.search)
        const flyTo = qs.get('flyTo')
        if (flyTo) {
          const [rawLat, rawLng] = flyTo.split(',')
          const lat = parseFloat(rawLat)
          const lng = parseFloat(rawLng)
          const zoom = parseInt(qs.get('zoom') ?? '15', 10)
          if (Number.isFinite(lat) && Number.isFinite(lng) && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], Number.isFinite(zoom) ? zoom : 15, { duration: 1.2 })
          }
        }
      } catch {}

      channelRef.current = supabase
        .channel('map_pins_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'map_pins' }, () => {
          loadPins()
        })
        .subscribe()
    }

    init()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    }
  }, [])

  async function loadCampaignPins() {
    if (!userId) return
    // Get campaigns the user is a member of
    const { data: memberships } = await supabase.from('campaign_members').select('campaign_id, campaigns(name)').eq('user_id', userId)
    if (!memberships || memberships.length === 0) { setCampaignPins([]); return }
    const campaignIds = memberships.map((m: any) => m.campaign_id)
    const campaignNames = Object.fromEntries(memberships.map((m: any) => [m.campaign_id, (m.campaigns as any)?.name ?? 'Unknown']))
    // Get revealed pins from those campaigns
    const { data: pins } = await supabase.from('campaign_pins').select('*').in('campaign_id', campaignIds).eq('revealed', true)
    setCampaignPins((pins ?? []).map((p: any) => ({ ...p, campaign_name: campaignNames[p.campaign_id] ?? 'Unknown' })))
  }

  const userIdRef = useRef(userId)
  userIdRef.current = userId

  async function loadPins(L?: any, map?: any) {
    const leaflet = L ?? (await import('leaflet')).default
    const mapInst = map ?? mapInstanceRef.current
    if (!mapInst) return
    await import('leaflet.markercluster')
    await import('leaflet.markercluster/dist/MarkerCluster.css')
    await import('leaflet.markercluster/dist/MarkerCluster.Default.css')

    const { data } = await supabase.from('map_pins').select('*').order('created_at', { ascending: false })
    if (!data) return
    setPins(data)

    // Resolve usernames + author roles. Author role drives the CANON
    // badge: pins authored by a Thriver are authoritative Tapestry-team
    // content (e.g. "The Mousetrap"). Surfaced as a 🛡️ overlay on the
    // marker icon and as an inline 'CANON' tag next to the pin title in
    // the expanded folder-list row. (Tried a popup pill — too heavy.)
    const uids = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))]
    const thriverIds = new Set<string>()
    if (uids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, username, role').in('id', uids)
      if (profiles) {
        setUsernames(Object.fromEntries(profiles.map((p: any) => [p.id, p.username])))
        for (const p of profiles as any[]) {
          if (typeof p.role === 'string' && p.role.toLowerCase() === 'thriver') thriverIds.add(p.id)
        }
      }
    }
    setThriverUserIds(thriverIds)

    // Remove old cluster group
    if (clusterGroupRef.current) { mapInst.removeLayer(clusterGroupRef.current) }
    markersRef.current = {}
    // Phase E Sprint 4b — clear old link polylines too. They live
    // directly on the map (not in the cluster group) since lines
    // don't cluster meaningfully.
    if (polylinesRef.current.length > 0) {
      for (const pl of polylinesRef.current) { try { mapInst.removeLayer(pl) } catch {} }
      polylinesRef.current = []
    }

    const clusterGroup = (leaflet as any).markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount()
        const size = count < 10 ? 32 : count < 50 ? 40 : 48
        return leaflet.divIcon({
          html: `<div style="width:${size}px;height:${size}px;background:#1a1a1a;border:2px solid #c0392b;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#f5f2ee;font-family:'Carlito',sans-serif;font-size:${size < 40 ? 13 : 15}px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.5);">${count}</div>`,
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        })
      },
    })

    const currentHidden = hiddenFoldersRef.current
    const currentUserId = userIdRef.current
    const visibleData = currentUserId
      ? data.filter((p: Pin) => {
          const cats: string[] = Array.isArray((p as any).categories) && (p as any).categories.length > 0
            ? (p as any).categories : [p.category ?? 'location']
          return cats.some(c => !currentHidden.has(c))
        })
      : data.filter((p: Pin) => p.category === 'world_event' || p.category === 'settlement')
    visibleData.forEach((pin: Pin) => {
      const emoji = pin.pin_type === 'rumor' ? '❓' : getCategoryEmoji(pin.category ?? 'location')
      const tier = getPinTier(pin)
      const ts = getTierStyles(tier)
      const isCanon = !!pin.user_id && thriverIds.has(pin.user_id)
      // Canon overlay sits at the top-right corner of the marker. Gold
      // background, dark border so it stays visible on any map tile.
      // Tooltip explains the meaning to first-time visitors.
      const canonOverlay = isCanon
        ? `<div title="Canon — published by The Tapestry team" style="position:absolute;top:-3px;right:-3px;width:13px;height:13px;background:#EF9F27;border:1.5px solid #1a1a1a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.6);">🛡️</div>`
        : ''
      const icon = leaflet.divIcon({
        html: `<div style="position:relative;font-size:16px;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(26,26,26,0.85);border:2px solid #c0392b;box-shadow:0 0 6px rgba(192,57,43,0.5);" title="${pin.title}${isCanon ? ' (Canon)' : ''}">${emoji}${canonOverlay}</div>`,
        className: '', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -33],
      })
      const nearSetting = getNearSetting(pin.lat, pin.lng)
      const nearbyCount = data.filter((p: Pin) => p.id !== pin.id && Math.abs(p.lat - pin.lat) < 0.1 && Math.abs(p.lng - pin.lng) < 0.1).length
      // CANON badge on the popup looked too heavy; the marker overlay
      // alone carries the visual signal here. The inline CANON tag in
      // the folder-list row (further below in the JSX) covers the case
      // where users are scanning the pin browser instead of clicking a
      // marker.
      const marker = leaflet.marker([pin.lat, pin.lng], { icon })
        .bindPopup(`
          <div style="font-family:Barlow,sans-serif;min-width:220px;max-width:300px">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">${emoji} ${pin.title}</div>
            ${pin.notes ? `<div style="font-size:13px;color:#555;margin-bottom:6px;line-height:1.4">${pin.notes}</div>` : ''}
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em;padding:1px 4px;background:#f0f0f0;border-radius:2px">${pin.category ?? 'location'}</span>
              <span style="font-size:10px;color:#999;text-transform:uppercase">${pin.pin_type === 'rumor' ? 'Rumor' : pin.pin_type === 'gm' ? 'GM' : 'Private'}</span>
            </div>
            ${nearSetting ? `<div style="font-size:10px;color:#c0392b;font-weight:700;margin-top:2px">Near ${nearSetting}</div>` : ''}
            ${nearbyCount > 0 ? `<div style="font-size:10px;color:#7ab3d4;margin-top:2px">${nearbyCount} nearby pin${nearbyCount !== 1 ? 's' : ''}</div>` : ''}
            ${(pin as any).view_count ? `<div style="font-size:10px;color:#aaa;margin-top:2px">👁 ${(pin as any).view_count} views</div>` : ''}
          </div>
        `)
      marker.on('popupopen', () => {
        supabase.from('map_pins').update({ view_count: ((pin as any).view_count ?? 0) + 1 }).eq('id', pin.id)
      })
      clusterGroup.addLayer(marker)
      markersRef.current[pin.id] = marker
    })

    // Phase E Sprint 3 — overlay approved world_communities as
    // size-banded markers in the SAME cluster group so they mingle
    // with regular pins at distance but fan out on zoom. Only fetch
    // approved rows with coords (homestead_lat/lng); the RLS policy
    // on world_communities already lets anyone read approved rows.
    // Hidden by the 'world_community' folder toggle alongside other
    // pin categories.
    // Always fetch approved world_communities so the sidebar folder
    // count stays accurate even when the layer is toggled off on the
    // map itself. Markers only render when 'world_community' isn't in
    // hiddenFolders.
    const { data: wc } = await supabase
      .from('world_communities')
      .select('id, name, description, homestead_lat, homestead_lng, size_band, faction_label, community_status, source_campaign_id, last_public_update_at, subscriber_count')
      .eq('moderation_status', 'approved')
      .not('homestead_lat', 'is', null)
      .not('homestead_lng', 'is', null)
    const rows = (wc ?? []) as any[]
    // Batch-fetch source campaign names for attribution on the
    // popup. Falls back to "Unknown campaign" if RLS hides the
    // campaign row from the viewer.
    let campaignNames: Record<string, string> = {}
    if (rows.length > 0) {
      const campIds = [...new Set(rows.map(r => r.source_campaign_id))]
      const { data: camps } = await supabase.from('campaigns').select('id, name').in('id', campIds)
      for (const c of (camps ?? []) as any[]) campaignNames[c.id] = c.name
    }
    // Snapshot for the sidebar folder. Names/coords don't change
    // per-viewer so the sidebar mirrors exactly what the map shows.
    setWorldCommunities(rows.map(r => ({
      id: r.id, name: r.name, lat: r.homestead_lat, lng: r.homestead_lng,
      size_band: r.size_band, community_status: r.community_status,
      faction_label: r.faction_label,
      source_campaign_id: r.source_campaign_id,
      campaign_name: campaignNames[r.source_campaign_id] ?? 'Unknown campaign',
    })))
    if (!currentHidden.has('world_community')) {
      for (const row of rows) {
        // Size band → pixel size on the map. New taxonomy:
        // Group < 13, Small 13-50, Medium 51-150, Large 151-500,
        // Huge 501-1000, Nation State 1000+.
        const sizeBand = row.size_band || 'Group'
        const sizePx = sizeBand === 'Nation State' ? 40
          : sizeBand === 'Huge' ? 36
          : sizeBand === 'Large' ? 32
          : sizeBand === 'Medium' ? 28
          : sizeBand === 'Small' ? 24
          : 20
        // Community status → dot color. Narrative palette tied to
        // the Morale outcome colors from the Weekly Check modal.
        const status = row.community_status || 'Holding'
        const dotColor = status === 'Thriving' ? '#7fc458'
          : status === 'Holding' ? '#cce0f5'
          : status === 'Struggling' ? '#EF9F27'
          : status === 'Dying' ? '#f5a89a'
          : status === 'Dissolved' ? '#5a5550'
          : '#cce0f5'
        // Distinct visual language from pins: solid colored circle
        // with a thin dark outline + subtle glow. No emoji — the
        // shape itself reads as "settled place".
        const icon = leaflet.divIcon({
          html: `<div style="width:${sizePx}px;height:${sizePx}px;background:${dotColor};border:2px solid #1a1a1a;border-radius:50%;box-shadow:0 0 8px rgba(212,139,212,0.6);display:flex;align-items:center;justify-content:center;color:#1a1a1a;font-family:'Carlito',sans-serif;font-size:${Math.max(11, sizePx / 2.5)}px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;" title="${(row.name || '').replace(/"/g, '&quot;')} — ${sizeBand}"></div>`,
          className: '',
          iconSize: [sizePx, sizePx],
          iconAnchor: [sizePx / 2, sizePx / 2],
          popupAnchor: [0, -sizePx / 2 - 4],
        })
        const campName = campaignNames[row.source_campaign_id] ?? 'Unknown campaign'
        const escapedName = (row.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const escapedDesc = (row.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const escapedFaction = (row.faction_label || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const escapedCamp = (campName || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        // Phase E Sprint 4a — encounter button. Visible to GMs only,
        // and only on communities NOT from one of their own campaigns
        // (no point encountering yourself). Button onclick dispatches
        // a window CustomEvent that a React listener picks up to open
        // the encounter modal — Leaflet popups are HTML strings so
        // we can't bind React handlers directly.
        const isMyOwnCommunity = currentUserId
          ? campaignNames[row.source_campaign_id] !== undefined && (() => {
              // We don't have the GM ID per campaign here cheaply,
              // so we treat "appears in myGmCampaigns" as the gate.
              // Stale across navigations; refresh on reload.
              return false  // recomputed below using a ref-friendly check
            })()
          : false
        // Check directly whether the source campaign is one I GM:
        const sourceIsMine = !!currentUserId && rows && (() => {
          // No DB call here — we look at the snapshot of myGmCampaigns
          // already loaded in init(). Use the closure ref.
          return false
        })()
        // Defer the check to render time — embed both pieces of data
        // and let the JS in the popup call back through the window
        // event with the source campaign id; the React listener does
        // the membership check before opening the modal. Cleaner than
        // try-to-be-clever-here.
        const popupHtml = `
          <div style="font-family:Barlow,sans-serif;min-width:240px;max-width:320px">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px;color:#1a1a1a">🌐 ${escapedName}</div>
            ${row.description ? `<div style="font-size:13px;color:#555;margin-bottom:6px;line-height:1.4">${escapedDesc}</div>` : ''}
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
              <span style="font-size:10px;background:#1a1a2e;color:#7ab3d4;padding:2px 6px;border-radius:2px;text-transform:uppercase;letter-spacing:.06em">${sizeBand}</span>
              <span style="font-size:10px;background:#1a2010;color:#7fc458;padding:2px 6px;border-radius:2px;text-transform:uppercase;letter-spacing:.06em">${status}</span>
              ${row.faction_label ? `<span style="font-size:10px;background:#2a2010;color:#EF9F27;padding:2px 6px;border-radius:2px;text-transform:uppercase;letter-spacing:.06em">${escapedFaction}</span>` : ''}
              <span style="font-size:10px;background:#2a1a3e;color:#c4a7f0;padding:2px 6px;border-radius:2px;text-transform:uppercase;letter-spacing:.06em" title="Followers — players tracking this community on the Tapestry">★ ${row.subscriber_count ?? 0}</span>
            </div>
            <div style="font-size:11px;color:#888;margin-bottom:8px">From <strong>${escapedCamp}</strong></div>
            ${row.last_public_update_at ? `<div style="font-size:10px;color:#aaa;margin-bottom:8px">Updated ${new Date(row.last_public_update_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>` : ''}
            ${currentUserId ? `
              <button data-tapestry-encounter="1" data-world-community-id="${row.id}" data-source-campaign-id="${row.source_campaign_id}" data-name="${escapedName.replace(/"/g, '&quot;')}" style="width:100%;padding:6px 10px;background:#2a102a;border:1px solid #5a2e5a;border-radius:3px;color:#d48bd4;font-size:13px;font-family:'Carlito',sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;font-weight:600;margin-bottom:4px">🤝 My PCs encountered this</button>
              <button data-tapestry-link="1" data-world-community-id="${row.id}" data-name="${escapedName.replace(/"/g, '&quot;')}" style="width:100%;padding:6px 10px;background:transparent;border:1px solid #5a2e5a;border-radius:3px;color:#d48bd4;font-size:13px;font-family:'Carlito',sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;margin-bottom:4px">🔗 Propose link</button>
              ${(() => {
                const followed = subscribedIdsRef.current.has(row.id)
                const bg = followed ? '#1a2e10' : 'transparent'
                const bd = followed ? '#2d5a1b' : '#2e2e2e'
                const fg = followed ? '#7fc458' : '#cce0f5'
                const lbl = followed ? '★ Following' : '☆ Follow'
                return `<button data-tapestry-follow="1" data-world-community-id="${row.id}" style="width:100%;padding:6px 10px;background:${bg};border:1px solid ${bd};border-radius:3px;color:${fg};font-size:13px;font-family:'Carlito',sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer">${lbl}</button>`
              })()}
            ` : ''}
          </div>
        `
        const marker = leaflet.marker([row.homestead_lat, row.homestead_lng], { icon }).bindPopup(popupHtml)
        clusterGroup.addLayer(marker)
        // Distinct id namespace so future "focus this community"
        // calls can find the marker without colliding with map_pins.
        markersRef.current[`world_community:${row.id}`] = marker
      }
    }

    clusterGroup.addTo(mapInst)
    clusterGroupRef.current = clusterGroup

    // Phase E Sprint 4b — Trade / Alliance / Feud polylines.
    // Active links between two approved communities render as
    // colored lines connecting their Homestead coords. Hidden when
    // the world_community folder is toggled off (same gate as the
    // markers, so the layer toggles as a cohesive overlay).
    if (!currentHidden.has('world_community') && rows.length > 0) {
      // Build a lookup of community id → coords so we can resolve
      // the polyline endpoints without re-fetching world_communities.
      const coordsById = new Map<string, [number, number]>()
      for (const r of rows) coordsById.set(r.id, [r.homestead_lat, r.homestead_lng])
      const { data: links } = await supabase
        .from('world_community_links')
        .select('id, community_a_id, community_b_id, link_type, narrative')
        .eq('status', 'active')
      for (const link of ((links ?? []) as any[])) {
        const aPos = coordsById.get(link.community_a_id)
        const bPos = coordsById.get(link.community_b_id)
        if (!aPos || !bPos) continue  // one endpoint is unlocated or unapproved
        const color = link.link_type === 'trade' ? '#7fc458'
          : link.link_type === 'alliance' ? '#7ab3d4'
          : link.link_type === 'feud' ? '#c0392b'
          : '#cce0f5'
        const dashArray = link.link_type === 'feud' ? '6,6' : undefined
        const polyline = (leaflet as any).polyline([aPos, bPos], {
          color,
          weight: 2.5,
          opacity: 0.7,
          dashArray,
        })
        const escapedNarr = (link.narrative || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        polyline.bindTooltip(
          `<div style="font-family:Barlow,sans-serif"><strong style="text-transform:uppercase;color:${color}">${link.link_type}</strong>${link.narrative ? `<br/><span style="font-size:13px">${escapedNarr}</span>` : ''}</div>`,
          { sticky: true }
        )
        polyline.addTo(mapInst)
        polylinesRef.current.push(polyline)
      }
    }

    setTimeout(() => mapInst.invalidateSize(), 100)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim() || !mapInstanceRef.current) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`, {
        headers: { 'Accept-Language': 'en' }
      })
      const results = await res.json()
      if (results.length > 0) {
        const { lat, lon } = results[0]
        mapInstanceRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 13, { duration: 1.2 })
      }
    } catch (e) {
      console.error('Search failed:', e)
    }
    setSearching(false)
  }

  async function switchLayer(layer: string) {
    const L = (await import('leaflet')).default
    const map = mapInstanceRef.current
    if (!map) return
    if (tileLayerRef.current) tileLayerRef.current.remove()
    const tiles: Record<string, { url: string, attribution: string }> = {
      street: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
      satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; <a href="https://www.esri.com">Esri</a>' },
      dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>' },
      positron: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>' },
      voyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>' },
      topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>' },
      humanitarian: { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://hot.openstreetmap.org">HOT</a>' },
    }
    const t = tiles[layer] ?? tiles.street
    tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 }).addTo(map)
    setMapLayer(layer)
  }

  function flyToPin(pin: Pin) {
    if (!mapInstanceRef.current) return
    const zoom = (pin.category === 'world_event' || pin.category === 'settlement') ? 8 : 14
    mapInstanceRef.current.flyTo([pin.lat, pin.lng], zoom, { duration: 1.2 })
    setTimeout(() => markersRef.current[pin.id]?.openPopup(), 1300)
  }

  async function handleSavePin() {
    if (!form.title.trim()) return
    if (!userId) { alert('Not logged in'); return }
    setSaving(true)
    const isThriver = userRole === 'thriver'
    const { error, data } = await supabase.from('map_pins').insert({
      user_id: userId, lat: form.lat, lng: form.lng,
      title: form.title, notes: form.notes,
      pin_type: isThriver ? 'gm' : 'rumor',
      status: isThriver ? 'approved' : 'pending',
      category: form.categories[0] ?? 'location',
      categories: form.categories,
    }).select().single()
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    logFirstEvent('first_pin_placed', { pin_id: data.id, title: form.title })

    if (attachments.length > 0 && data) {
      setUploading(true)
      for (const file of attachments) {
        const path = `${userId}/${data.id}/${file.name}`
        await supabase.storage.from('pin-attachments').upload(path, file)
      }
      setUploading(false)
    }

    setAttachments([])
    setShowForm(false)
    setSaving(false)
    await loadPins()
  }

  async function handleDeletePin(id: string) {
  setDeletingId(id)
  await supabase.from('map_pins').delete().eq('id', id)
  setDeletingId(null)
  await loadPins()
}

  async function handleTogglePublic(pin: Pin) {
    const newStatus = pin.status === 'approved' ? 'active' : 'approved'
    await supabase.from('map_pins').update({ status: newStatus }).eq('id', pin.id)
    await loadPins()
  }

  async function startEdit(pin: Pin) {
  setEditingPin(pin)
  const cats = Array.isArray(pin.categories) && pin.categories.length > 0 ? pin.categories : [pin.category ?? 'location']
  setEditForm({
    title: pin.title, notes: pin.notes, categories: cats,
    event_date: (pin as any).event_date ?? '',
    sort_order: pin.sort_order != null ? String(pin.sort_order) : '',
    lat: pin.lat != null ? String(pin.lat) : '',
    lng: pin.lng != null ? String(pin.lng) : '',
    address: (pin as any).address ?? '',
    cmod_active: (pin as any).cmod_active ?? false,
    cmod_impact: (pin as any).cmod_impact != null ? String((pin as any).cmod_impact) : '',
    cmod_radius_km: (pin as any).cmod_radius_km != null ? String((pin as any).cmod_radius_km) : '',
    cmod_label: (pin as any).cmod_label ?? '',
    parent_pin_id: (pin as any).parent_pin_id ?? '',
  })
  setEditAttachments([])
  setShowForm(false)
  // Load existing attachments
  const { data: files } = await supabase.storage.from('pin-attachments').list(`${pin.user_id}/${pin.id}`)
  if (files && files.length > 0) {
    setEditExistingFiles(files.map((f: any) => {
      const { data: urlData } = supabase.storage.from('pin-attachments').getPublicUrl(`${pin.user_id}/${pin.id}/${f.name}`)
      return { name: f.name, url: urlData.publicUrl }
    }))
  } else {
    setEditExistingFiles([])
  }
}

  async function handleSaveEdit() {
  if (!editingPin || !editForm.title.trim()) return
  setEditUploading(true)
  const sortVal = editForm.sort_order.trim() ? parseInt(editForm.sort_order, 10) : null
  const latVal = editForm.lat.trim() ? parseFloat(editForm.lat) : NaN
  const lngVal = editForm.lng.trim() ? parseFloat(editForm.lng) : NaN
  const updatePayload: Record<string, unknown> = { title: editForm.title, notes: editForm.notes, category: editForm.categories[0] ?? 'location', categories: editForm.categories, event_date: editForm.event_date.trim() || null, sort_order: Number.isNaN(sortVal) ? null : sortVal, address: editForm.address.trim() || null, parent_pin_id: editForm.parent_pin_id || null }
  if (!Number.isNaN(latVal)) updatePayload.lat = latVal
  if (!Number.isNaN(lngVal)) updatePayload.lng = lngVal
  // World-event CMod propagation fields. Only round-tripped when
  // the pin actually carries the world_event category — for any
  // other category these stay untouched in the DB.
  if (editForm.categories.includes('world_event')) {
    const impactRaw = editForm.cmod_impact.trim()
    const radiusRaw = editForm.cmod_radius_km.trim()
    updatePayload.cmod_active = !!editForm.cmod_active
    updatePayload.cmod_impact = impactRaw === '' ? null : (parseInt(impactRaw, 10) || 0)
    updatePayload.cmod_radius_km = radiusRaw === '' ? null : Math.max(1, parseInt(radiusRaw, 10) || 0)
    updatePayload.cmod_label = editForm.cmod_label.trim() || null
  }
  const { error } = await supabase.from('map_pins').update(updatePayload).eq('id', editingPin.id)
  if (error) { alert('Error: ' + error.message); setEditUploading(false); return }
  // Upload new attachments
  for (const file of editAttachments) {
    await supabase.storage.from('pin-attachments').upload(`${editingPin.user_id}/${editingPin.id}/${file.name}`, file, { upsert: true })
  }
  setEditUploading(false)
  setEditingPin(null)
  setEditAttachments([])
  setEditExistingFiles([])
  await loadPins()
}

  // Filter chips
  const FILTER_CHIPS_ROW1 = ['mine', 'all', 'public'] as const
  const FILTER_CHIPS_ROW2 = ['canon', 'rumors', 'timeline'] as const
  const FILTER_CHIPS = [...FILTER_CHIPS_ROW1, ...FILTER_CHIPS_ROW2] as const
  const allFiltersActive = FILTER_CHIPS.filter(f => f !== 'all').every(f => activeFilters.has(f))

  function toggleFilter(chip: string) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (chip === 'all') {
        // Toggle all on
        FILTER_CHIPS.forEach(f => next.add(f))
        return next
      }
      if (next.has(chip)) next.delete(chip); else next.add(chip)
      // Sync 'all' state
      if (FILTER_CHIPS.filter(f => f !== 'all').every(f => next.has(f))) next.add('all')
      else next.delete('all')
      // Persist for authenticated users
      if (userId) localStorage.setItem('tapestry_pin_filters', JSON.stringify([...next]))
      return next
    })
  }

  function matchesFilter(p: Pin): boolean {
    // Ghosts see world_event + settlement pins only
    if (!userId) return p.category === 'world_event' || p.category === 'settlement'
    // Logged-in users see everything (folders handle grouping)
    return true
  }

  function chipCount(chip: string): number {
    if (chip === 'all') return pins.length
    return pins.filter(p => {
      if (chip === 'public') return p.status === 'approved'
      if (chip === 'mine') return p.user_id === userId
      if (chip === 'canon') return p.category === 'world_event' || p.category === 'settlement' || p.pin_type === 'gm'
      if (chip === 'rumors') return p.pin_type === 'rumor'
      if (chip === 'timeline') return p.category === 'world_event'
      return false
    }).length
  }

  function regionCount(key: string): number {
    return pins.filter(p => pinInRegion(p, key)).length
  }

  function toggleRegion(key: string) {
    setActiveRegions(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        const r = REGION_BOUNDS[key]
        if (r) mapInstanceRef.current?.flyTo([r.lat, r.lng], r.zoom, { duration: 1.2 })
      }
      if (userId) localStorage.setItem('tapestry_pin_regions', JSON.stringify([...next]))
      return next
    })
  }

  const timelineOnly = activeFilters.has('timeline') && activeFilters.size === 1

  const filteredPins = pins.filter(matchesFilter).filter(p => {
    // Tab filter
    if (sidebarTab === 'mine' && p.user_id !== userId) return false
    if (sidebarTab === 'public' && p.status !== 'approved') return false
    if (!pinSearch.trim()) return true
    const q = pinSearch.trim().toLowerCase()
    return (p.title?.toLowerCase().includes(q)) || (p.notes?.toLowerCase().includes(q)) || (p.category?.toLowerCase().includes(q))
  })
  const displayedPins = [...filteredPins].sort((a, b) => {
    if (timelineOnly) return (a.sort_order ?? 999) - (b.sort_order ?? 999)
    if (sortMode === 'name') return (a.title ?? '').localeCompare(b.title ?? '')
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  })

  function pinTypeLabel(p: Pin) {
    if (p.pin_type === 'gm' && p.status === 'approved') return 'GM -” public'
    if (p.pin_type === 'gm') return 'GM -” pending'
    if (p.pin_type === 'rumor' && p.status === 'approved') return 'Rumor -” public'
    if (p.pin_type === 'rumor' && p.status === 'pending') return 'Submitted -” awaiting review'
    if (p.pin_type === 'rumor' && p.status === 'rejected') return 'Rejected'
    return 'Private'
  }

  function pinColor(p: Pin) {
    return p.pin_type === 'rumor' ? '#EF9F27' : p.pin_type === 'gm' ? '#c0392b' : '#7ab3d4'
  }

  // Toggle map pin markers visibility
  useEffect(() => {
    const map = mapInstanceRef.current
    const cluster = clusterGroupRef.current
    if (!map || !cluster) return
    if (pinsVisible) { if (!map.hasLayer(cluster)) map.addLayer(cluster) }
    else { if (map.hasLayer(cluster)) map.removeLayer(cluster) }
  }, [pinsVisible])

  // Load persisted filters for authenticated users, Timeline default for Ghosts
  useEffect(() => {
    if (!userId) {
      setActiveFilters(new Set(['timeline']))
      setActiveRegions(new Set())
    } else {
      const saved = localStorage.getItem('tapestry_pin_filters')
      if (saved) { try { setActiveFilters(new Set(JSON.parse(saved))) } catch {} }
      else setActiveFilters(new Set(['all', 'public', 'mine', 'canon', 'rumors', 'timeline']))
      const savedRegions = localStorage.getItem('tapestry_pin_regions')
      if (savedRegions) { try { setActiveRegions(new Set(JSON.parse(savedRegions))) } catch {} }
    }
  }, [userId])

  const lbl: React.CSSProperties = { display: 'block', fontSize: '13px', color: '#f5f2ee', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: '4px' }
  const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* Phase E Sprint 4b — Propose Link modal. Opens when the user
          clicks "🔗 Propose link" on a world community popup. Pick
          which of YOUR approved communities is the proposing endpoint
          + link type (trade/alliance/feud) + optional narrative. The
          INSERT trigger fires a notification to the OTHER community's
          GM. Active links draw as colored polylines on the map. */}
      {linkTarget && (() => {
        const eligible = myPublishedCommunities.filter(wc => wc.id !== linkTarget.worldCommunityId)
        return (
          <ModalBackdrop onClose={() => !linkSubmitting && setLinkTarget(null)} zIndex={Z_INDEX.modalNested} opacity={0.75} padding="20px">
            <div
              style={{ background: '#1a1a1a', border: '1px solid #5a2e5a', borderRadius: '4px', width: '520px', maxWidth: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#d48bd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  🔗 Propose Link — {linkTarget.name}
                </div>
                <button onClick={() => !linkSubmitting && setLinkTarget(null)}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                  Both GMs must agree before this link goes live on the world map. The other community's GM will get a notification with your one-line context — they accept or decline.
                </div>
                <div>
                  <div style={{ ...LABEL_STYLE_LG, marginBottom: '4px' }}>From your community</div>
                  <select value={linkFromId} onChange={e => setLinkFromId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                    {eligible.map(wc => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ ...LABEL_STYLE_LG, marginBottom: '4px' }}>Link type</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {([
                      { v: 'trade' as const, label: '💱 Trade', color: '#7fc458', desc: 'Goods + supplies flow' },
                      { v: 'alliance' as const, label: '🤝 Alliance', color: '#7ab3d4', desc: 'Mutual defense + aid' },
                      { v: 'feud' as const, label: '⚔️ Feud', color: '#c0392b', desc: 'Standing hostility' },
                    ]).map(opt => (
                      <button key={opt.v} onClick={() => setLinkType(opt.v)}
                        style={{ flex: 1, padding: '10px 8px', background: linkType === opt.v ? `${opt.color}22` : '#242424', border: `1px solid ${linkType === opt.v ? opt.color : '#3a3a3a'}`, borderRadius: '3px', color: linkType === opt.v ? opt.color : '#cce0f5', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: linkType === opt.v ? 700 : 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span>{opt.label}</span>
                        <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow, sans-serif', textTransform: 'none', letterSpacing: 0 }}>{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ ...LABEL_STYLE_LG, marginBottom: '4px' }}>Narrative (optional)</div>
                  <textarea value={linkNarrative}
                    placeholder="e.g. Weekly trade caravans run between us — clean water for medicine."
                    onChange={e => setLinkNarrative(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setLinkTarget(null)} disabled={linkSubmitting}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: linkSubmitting ? 'not-allowed' : 'pointer', opacity: linkSubmitting ? 0.4 : 1 }}>Cancel</button>
                <button onClick={submitLink} disabled={linkSubmitting || !linkFromId}
                  style={{ padding: '8px 18px', background: '#2a102a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: (linkSubmitting || !linkFromId) ? 'not-allowed' : 'pointer', opacity: (linkSubmitting || !linkFromId) ? 0.4 : 1, fontWeight: 600 }}>
                  {linkSubmitting ? 'Sending…' : '🔗 Send Proposal'}
                </button>
              </div>
            </div>
          </ModalBackdrop>
        )
      })()}

      {/* Phase E Sprint 4a — Encounter modal. Opens when the user
          clicks the "🤝 My PCs encountered this" button on a world
          community popup. Pick which of your campaigns is the
          encountering side, type a one-line narrative, submit. The
          INSERT trigger fires a notification to the source community's
          GM. Eligible campaigns are filtered to exclude the source
          (no self-encounters). */}
      {encounterTarget && (() => {
        const eligible = myGmCampaigns.filter(c => c.id !== encounterTarget.sourceCampaignId)
        return (
          <ModalBackdrop onClose={() => !encounterSubmitting && setEncounterTarget(null)} zIndex={Z_INDEX.modalNested} opacity={0.75} padding="20px">
            <div
              style={{ background: '#1a1a1a', border: '1px solid #5a2e5a', borderRadius: '4px', width: '520px', maxWidth: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#d48bd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  🤝 Encounter — {encounterTarget.name}
                </div>
                <button onClick={() => !encounterSubmitting && setEncounterTarget(null)}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
                  Flag that your PCs ran into <span style={{ color: '#f5f2ee', fontWeight: 700 }}>{encounterTarget.name}</span> in your campaign. The source GM gets a notification with your one-line narrative; they can accept (canon on both tables) or decline (didn't fit theirs).
                </div>
                <div>
                  <div style={{ ...LABEL_STYLE_LG, marginBottom: '4px' }}>Encountering campaign</div>
                  <select value={encounterCampaignId} onChange={e => setEncounterCampaignId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', appearance: 'none' }}>
                    {eligible.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ ...LABEL_STYLE_LG, marginBottom: '4px' }}>What happened (optional)</div>
                  <textarea value={encounterNarrative}
                    placeholder="e.g. We traded medical supplies for ammunition while sheltering from a Distemper surge."
                    onChange={e => setEncounterNarrative(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '14px 18px', borderTop: '1px solid #2e2e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setEncounterTarget(null)} disabled={encounterSubmitting}
                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: encounterSubmitting ? 'not-allowed' : 'pointer', opacity: encounterSubmitting ? 0.4 : 1 }}>Cancel</button>
                <button onClick={submitEncounter} disabled={encounterSubmitting || !encounterCampaignId}
                  style={{ padding: '8px 18px', background: '#2a102a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#d48bd4', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: (encounterSubmitting || !encounterCampaignId) ? 'not-allowed' : 'pointer', opacity: (encounterSubmitting || !encounterCampaignId) ? 0.4 : 1, fontWeight: 600 }}>
                  {encounterSubmitting ? 'Sending…' : '🤝 Send Encounter'}
                </button>
              </div>
            </div>
          </ModalBackdrop>
        )
      })()}

      {!embedded && showHeader && (
        <div style={{ flexShrink: 0, zIndex: 1000, background: '#0f0f0f', borderBottom: '1px solid #c0392b', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>The Tapestry</div>
          <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.08em', textTransform: 'uppercase' }}>World Map</div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setSidebarOpen(p => !p)} style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {sidebarOpen ? 'Hide Pins' : 'Show Pins'}
          </button>
          {userRole === 'thriver' && (
            <button onClick={() => {
              const map = mapInstanceRef.current
              if (!map) return
              const c = map.getCenter()
              const z = map.getZoom()
              const text = `center: [${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}], zoom: ${z}`
              navigator.clipboard.writeText(text)
              alert(`Copied: ${text}`)
            }} style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Copy Position
            </button>
          )}
          <Link href="/dashboard" style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Dashboard</Link>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        <div ref={mapRef} style={{ flex: 1, height: '100%', background: '#aad3df' }} />

        {(!embedded || showSidebarProp) && sidebarOpen && (
          <div style={{ width: '300px', flexShrink: 0, background: '#1a1a1a', borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', zIndex: 500 }}>
            {/* Search + regions header */}
            <div style={{ padding: '8px', borderBottom: '1px solid #2e2e2e' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <button onClick={() => setSidebarOpen(false)}
                  style={{ padding: '2px 6px', background: 'none', border: 'none', color: '#3a3a3a', fontSize: '14px', cursor: 'pointer', lineHeight: 1, marginRight: '4px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f5a89a')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>✕</button>
                <span style={{ ...LABEL_STYLE_TIGHT }}>Pins</span>
                <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>{displayedPins.length} total</span>
              </div>
              <input value={pinSearch} onChange={e => setPinSearch(e.target.value)} placeholder="Search pins..."
                style={{ width: '100%', padding: '5px 8px', marginBottom: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              {!userId && (
                <div onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tapestry-ghost-wall')) }}
                  style={{ marginBottom: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', cursor: 'pointer', fontStyle: 'italic' }}>
                  Sign up to add your own story to this world.
                </div>
              )}
            </div>
            {/* Tabs */}
            {userId && (
              <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e' }}>
                {(['public', 'mine', 'campaign', 'whispers'] as const).map(tab => (
                  <button key={tab} onClick={() => setSidebarTab(tab)}
                    style={{ flex: 1, padding: '6px', background: sidebarTab === tab ? '#242424' : 'transparent', border: 'none', borderBottom: sidebarTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: sidebarTab === tab ? '#f5f2ee' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    {tab === 'public' ? 'Public' : tab === 'mine' ? 'My Pins' : tab === 'campaign' ? 'Campaign' : 'Whispers'}
                  </button>
                ))}
              </div>
            )}
            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sidebarTab === 'whispers' ? (
                /* Whispers — public message wall. Compose at top, list
                    below, newest first. Thrivers see an X next to each
                    row to hard-delete. */
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <textarea
                      value={whisperDraft}
                      onChange={e => setWhisperDraft(e.target.value.slice(0, 500))}
                      placeholder="Whisper into the dark... (max 500 chars)"
                      rows={3}
                      style={{ width: '100%', padding: '6px 8px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>{whisperDraft.length}/500</span>
                      <button onClick={postWhisper} disabled={postingWhisper || !whisperDraft.trim()}
                        style={{ padding: '4px 12px', background: whisperDraft.trim() ? '#1a2e10' : '#242424', border: `1px solid ${whisperDraft.trim() ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: whisperDraft.trim() ? '#7fc458' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: postingWhisper ? 'wait' : whisperDraft.trim() ? 'pointer' : 'not-allowed' }}>
                        {postingWhisper ? '…' : 'Whisper'}
                      </button>
                    </div>
                  </div>
                  {whispers.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      No whispers yet
                    </div>
                  ) : (
                    whispers.map(w => (
                      <div key={w.id} style={{ padding: '8px 0', borderBottom: '1px solid #2e2e2e', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13px', color: w.author_user_id === userId ? '#7fc458' : '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                              {w.author_username ?? '?'}
                            </span>
                            <span title={new Date(w.created_at).toLocaleString()} style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
                              {(() => { const ms = Date.now() - new Date(w.created_at).getTime(); const m = Math.floor(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; const d = Math.floor(h / 24); return `${d}d` })()}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {w.content}
                          </div>
                        </div>
                        {userRole === 'thriver' && (
                          <button onClick={() => { if (confirm('Delete this whisper?')) deleteWhisper(w.id) }} disabled={deletingWhisperId === w.id}
                            title="Thriver: delete this whisper"
                            style={{ flexShrink: 0, width: 22, height: 22, padding: 0, background: 'transparent', border: '1px solid #3a3a3a', borderRadius: 3, color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: deletingWhisperId === w.id ? 'wait' : 'pointer', lineHeight: 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2a1210'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c0392b'; (e.currentTarget as HTMLButtonElement).style.color = '#f5a89a' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3a3a'; (e.currentTarget as HTMLButtonElement).style.color = '#cce0f5' }}>
                            ×
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : sidebarTab === 'campaign' ? (
                /* Campaign pins tab */
                campaignPins.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>No campaign pins shared with you.</div>
                ) : (
                  (() => {
                    const byCampaign: Record<string, typeof campaignPins> = {}
                    for (const p of campaignPins) {
                      if (!byCampaign[p.campaign_name]) byCampaign[p.campaign_name] = []
                      byCampaign[p.campaign_name].push(p)
                    }
                    return Object.entries(byCampaign).map(([name, cPins]) => (
                      <div key={name}>
                        <div style={{ padding: '6px 10px', borderBottom: '1px solid #2e2e2e', fontSize: '13px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>
                          {name}
                        </div>
                        {cPins.map(p => (
                          <div key={p.id} onClick={() => {
                            if (expandedPinId === p.id) setExpandedPinId(null)
                            else { setExpandedPinId(p.id); flyToPin({ lat: p.lat, lng: p.lng, category: p.category } as any) }
                          }}
                            style={{ padding: '4px 10px 4px 20px', cursor: 'pointer', borderLeft: `2px solid ${expandedPinId === p.id ? '#c0392b' : 'transparent'}`, background: expandedPinId === p.id ? '#1a1a1a' : 'transparent' }}
                            onMouseEnter={e => { if (expandedPinId !== p.id) e.currentTarget.style.background = '#1a1a1a' }}
                            onMouseLeave={e => { if (expandedPinId !== p.id) e.currentTarget.style.background = 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '14px' }}>{getCategoryEmoji(p.category)}</span>
                              <span style={{ fontSize: '13px', color: '#f5f2ee', overflow: expandedPinId === p.id ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: expandedPinId === p.id ? 'normal' : 'nowrap' }}>{p.name}</span>
                            </div>
                            {expandedPinId === p.id && p.notes && (
                              <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, marginTop: '4px', paddingLeft: '20px' }}>{p.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))
                  })()
                )
              ) : (
              /* Public / My Pins folder tree */
              (() => {
                // Group displayed pins by category — pins with multiple categories appear in multiple folders
                const folderMap: Record<string, Pin[]> = {}
                for (const p of displayedPins) {
                  const rawCats = p.categories
                  const cats: string[] = Array.isArray(rawCats) && rawCats.length > 0 ? rawCats.map(String) : [p.category ?? 'location']
                  for (const cat of cats) {
                    if (!folderMap[cat]) folderMap[cat] = []
                    folderMap[cat].push(p)
                  }
                }
                // Sort within each folder: timeline by sort_order, others by name
                for (const cat of Object.keys(folderMap)) {
                  if (cat === 'world_event') {
                    folderMap[cat].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
                  } else {
                    folderMap[cat].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
                  }
                  // Parent/child interleave — when a pin's parent_pin_id
                  // points to another pin in this same folder, render the
                  // child directly under its parent (and indent it in the
                  // row markup). Children whose parent isn't in this
                  // folder render at top-level alongside everyone else.
                  const arr = folderMap[cat]
                  const idsInFolder = new Set(arr.map(p => p.id))
                  const childrenByParent: Record<string, Pin[]> = {}
                  const topLevel: Pin[] = []
                  for (const p of arr) {
                    const parent = (p as any).parent_pin_id as string | null | undefined
                    if (parent && idsInFolder.has(parent)) {
                      if (!childrenByParent[parent]) childrenByParent[parent] = []
                      childrenByParent[parent].push(p)
                    } else {
                      topLevel.push(p)
                    }
                  }
                  const reordered: Pin[] = []
                  for (const p of topLevel) {
                    reordered.push(p)
                    const kids = childrenByParent[p.id]
                    if (kids) reordered.push(...kids)
                  }
                  folderMap[cat] = reordered
                }
                // Sort categories: Distemper Timeline first, then the rest in PIN_CATEGORIES order
                const sortedCats = PIN_CATEGORIES.filter(c => folderMap[c.value] && folderMap[c.value].length > 0)
                  .sort((a, b) => a.value === 'world_event' ? -1 : b.value === 'world_event' ? 1 : 0)
                // Phase E — synthetic "🌐 Published Communities" folder.
                // Sits above the normal PIN_CATEGORIES folders because
                // it's a distinct layer, not a pin category. Filtered
                // by pinSearch against name or campaign name.
                const searchLC = pinSearch.trim().toLowerCase()
                const wcFiltered = worldCommunities
                  .filter(wc => !searchLC
                    || wc.name.toLowerCase().includes(searchLC)
                    || wc.campaign_name.toLowerCase().includes(searchLC)
                    || (wc.faction_label ?? '').toLowerCase().includes(searchLC))
                  .sort((a, b) => a.name.localeCompare(b.name))
                const wcFolderHasContent = wcFiltered.length > 0
                if (sortedCats.length === 0 && !wcFolderHasContent) {
                  return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>{pinSearch.trim() ? 'No pins match your search.' : 'No pins to display.'}</div>
                }
                // If searching, auto-expand all folders with matches
                const isSearching = pinSearch.trim().length > 0
                const wcFolderOpen = isSearching || expandedFolders.has('world_community')
                const wcHidden = hiddenFolders.has('world_community')
                const wcFolderNode = wcFolderHasContent ? (
                  <div key="world_community_folder" style={{ opacity: wcHidden ? 0.4 : 1 }}>
                    <div onClick={() => {
                      setExpandedFolders(prev => {
                        const next = new Set(prev)
                        next.has('world_community') ? next.delete('world_community') : next.add('world_community')
                        if (typeof window !== 'undefined') localStorage.setItem('tapestry_folder_state', JSON.stringify([...next]))
                        return next
                      })
                    }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #2e2e2e', userSelect: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: '13px', color: '#5a5550', width: '12px', textAlign: 'center' }}>{wcFolderOpen ? '▼' : '▶'}</span>
                      <span style={{ fontSize: '14px' }}>🌐</span>
                      <span style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1, fontWeight: 600 }}>Player Communities</span>
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginRight: '4px' }}>{wcFiltered.length}</span>
                      <span onClick={e => {
                        e.stopPropagation()
                        setHiddenFolders(prev => {
                          const next = new Set(prev)
                          next.has('world_community') ? next.delete('world_community') : next.add('world_community')
                          if (typeof window !== 'undefined') localStorage.setItem('tapestry_hidden_folders', JSON.stringify([...next]))
                          return next
                        })
                      }}
                        title={wcHidden ? 'Show on map' : 'Hide from map'}
                        style={{ fontSize: '13px', cursor: 'pointer', color: wcHidden ? '#5a5550' : '#7fc458', lineHeight: 1 }}>
                        {wcHidden ? '👁‍🗨' : '👁'}
                      </span>
                    </div>
                    {wcFolderOpen && (
                      <div style={{ padding: '2px 0 4px' }}>
                        {wcFiltered.map(wc => {
                          // Status-tier dot color — mirrors the map
                          // marker palette so players recognize the
                          // community in both surfaces.
                          const color = wc.community_status === 'Thriving' ? '#7fc458'
                            : wc.community_status === 'Holding' ? '#cce0f5'
                            : wc.community_status === 'Struggling' ? '#EF9F27'
                            : wc.community_status === 'Dying' ? '#f5a89a'
                            : '#5a5550'
                          return (
                            <div key={wc.id}
                              onClick={() => {
                                const map = mapInstanceRef.current
                                if (!map) return
                                map.flyTo([wc.lat, wc.lng], 11, { duration: 1.2 })
                                const marker = markersRef.current[`world_community:${wc.id}`]
                                if (marker) setTimeout(() => marker.openPopup(), 1300)
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 6px 30px', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#1a1a2e')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              title={`${wc.name} · ${wc.size_band} · ${wc.community_status}${wc.faction_label ? ' · ' + wc.faction_label : ''} · From ${wc.campaign_name}`}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, border: '1px solid #1a1a1a', flexShrink: 0 }} />
                              <span style={{ color: '#f5f2ee', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wc.name}</span>
                              <span style={{ color: '#5a5550', fontSize: '13px', letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0 }}>{wc.size_band}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : null
                return (
                  <>
                    {wcFolderNode}
                    {sortedCats.map(cat => {
                  const folderPins = folderMap[cat.value] ?? []
                  const isOpen = isSearching || expandedFolders.has(cat.value)
                  const isHidden = hiddenFolders.has(cat.value)
                  return (
                    <div key={cat.value} style={{ opacity: isHidden ? 0.4 : 1 }}>
                      <div onClick={() => {
                        setExpandedFolders(prev => {
                          const next = new Set(prev)
                          next.has(cat.value) ? next.delete(cat.value) : next.add(cat.value)
                          if (typeof window !== 'undefined') localStorage.setItem('tapestry_folder_state', JSON.stringify([...next]))
                          return next
                        })
                      }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #2e2e2e', userSelect: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span style={{ fontSize: '13px', color: '#5a5550', width: '12px', textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</span>
                        <span style={{ fontSize: '14px' }}>{cat.emoji}</span>
                        <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1 }}>{cat.label}</span>
                        <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginRight: '4px' }}>{folderPins.length}</span>
                        <span onClick={e => {
                          e.stopPropagation()
                          setHiddenFolders(prev => {
                            const next = new Set(prev)
                            next.has(cat.value) ? next.delete(cat.value) : next.add(cat.value)
                            if (typeof window !== 'undefined') localStorage.setItem('tapestry_hidden_folders', JSON.stringify([...next]))
                            return next
                          })
                        }}
                          title={isHidden ? 'Show on map' : 'Hide from map'}
                          style={{ fontSize: '13px', cursor: 'pointer', color: isHidden ? '#5a5550' : '#7fc458', lineHeight: 1 }}>
                          {isHidden ? '👁‍🗨' : '👁'}
                        </span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '2px 0 4px' }}>
                          {(() => {
                            // Build a quick lookup so child rows can detect
                            // they're siblings of a parent in this folder
                            // and pick up the indent treatment.
                            const folderIds = new Set(folderPins.map(p => p.id))
                            return folderPins.map(p => {
                              const isExpanded = expandedPinId === p.id
                              const parentId = (p as any).parent_pin_id as string | null | undefined
                              const isChild = !!parentId && folderIds.has(parentId)
                              return (
                                <div key={p.id} onClick={() => {
                                  if (isExpanded) { setExpandedPinId(null) }
                                  else {
                                    setExpandedPinId(p.id); flyToPin(p)
                                    supabase.from('map_pins').update({ view_count: ((p as any).view_count ?? 0) + 1 }).eq('id', p.id)
                                    if (!pinAttachments[p.id]) {
                                      supabase.storage.from('pin-attachments').list(`${p.user_id}/${p.id}`).then(({ data: files }: any) => {
                                        if (files && files.length > 0) {
                                          const atts = files.map((f: any) => {
                                            const { data: urlData } = supabase.storage.from('pin-attachments').getPublicUrl(`${p.user_id}/${p.id}/${f.name}`)
                                            return { name: f.name, url: urlData.publicUrl }
                                          })
                                          setPinAttachments(prev => ({ ...prev, [p.id]: atts }))
                                        } else {
                                          setPinAttachments(prev => ({ ...prev, [p.id]: [] }))
                                        }
                                      })
                                    }
                                  }
                                }}
                                  style={{ padding: isChild ? '4px 10px 4px 50px' : '4px 10px 4px 34px', cursor: 'pointer', borderLeft: `2px solid ${isExpanded ? '#c0392b' : 'transparent'}`, background: isExpanded ? '#1a1a1a' : 'transparent' }}
                                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#1a1a1a' }}
                                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}>
                                  <div style={{ fontSize: '13px', color: '#f5f2ee', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                                    {isChild && <span style={{ color: '#5a5550', marginRight: '4px' }}>↳</span>}
                                    {p.title}
                                  {isExpanded && p.user_id && thriverUserIds.has(p.user_id) && (
                                    <span title="Canon — published by The Tapestry team" style={{ marginLeft: '6px', padding: '1px 6px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '2px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                      🛡️ Canon
                                    </span>
                                  )}
                                </div>
                                {isExpanded && (
                                  <div style={{ marginTop: '4px' }}>
                                    {p.notes && <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, marginBottom: '6px' }}>{p.notes}</div>}
                                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
                                      {p.category === 'world_event'
                                        ? (p.event_date ? <span style={{ color: '#EF9F27' }}>{p.event_date}</span> : '')
                                        : <>{usernames[p.user_id] ? `By ${usernames[p.user_id]}` : ''}</>
                                      }
                                    </div>
                                    {pinAttachments[p.id] && pinAttachments[p.id].length > 0 && (
                                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #2e2e2e' }}>
                                        {pinAttachments[p.id].map(att => {
                                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name)
                                          return isImage ? (
                                            <a key={att.name} href={att.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                              <img src={att.url} alt={att.name} style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '3px', marginBottom: '4px', border: '1px solid #2e2e2e', background: '#0a0a0a' }} />
                                            </a>
                                          ) : (
                                            <a key={att.name} href={att.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#7ab3d4', textDecoration: 'none', marginBottom: '3px' }}>
                                              📎 {att.name}
                                            </a>
                                          )
                                        })}
                                      </div>
                                    )}
                                    {(p.user_id === userId || userRole === 'thriver') && (
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                        {userRole === 'thriver' && (
                                          <button onClick={e => { e.stopPropagation(); handleTogglePublic(p) }}
                                            style={{ background: 'none', border: 'none', color: p.status === 'approved' ? '#7fc458' : '#cce0f5', cursor: 'pointer', fontSize: '13px', padding: '0', fontFamily: 'Carlito, sans-serif' }}>
                                            {p.status === 'approved' ? 'Public' : 'Private'}
                                          </button>
                                        )}
                                        <button onClick={e => { e.stopPropagation(); startEdit(p) }}
                                          style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '13px', padding: '0', fontFamily: 'Carlito, sans-serif' }}>Edit</button>
                                        <button onClick={e => { e.stopPropagation(); if (confirm('Delete this pin?')) handleDeletePin(p.id) }}
                                          style={{ background: 'none', border: 'none', color: '#f5a89a', cursor: 'pointer', fontSize: '13px', padding: '0' }}>×</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                </div>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
                  </>
                )
              })()
              )}
            </div>
          </div>
        )}

        {/* Pins toggle button is rendered inside the search bar row below */}
        {!embedded && showHeader && (
          <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(15,15,15,.85)', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '6px 14px', fontSize: '13px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif', pointerEvents: 'none' }}>
            Click anywhere on the map to place a pin
          </div>
        )}

          <div style={{ position: 'absolute', top: '6px', right: sidebarOpen ? '306px' : '6px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', transition: 'right .2s' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {(!embedded || showSidebarProp) && !sidebarOpen && (
                <button type="button" onClick={() => setSidebarOpen(true)}
                  style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Pins ☰
                </button>
              )}
              <div style={{ position: 'relative', flex: 1 }}>
                <input value={searchQuery} onChange={e => {
                  setSearchQuery(e.target.value)
                  if (debounceRef.current) clearTimeout(debounceRef.current)
                  if (e.target.value.length >= 3) {
                    debounceRef.current = setTimeout(async () => {
                      try {
                        const data = await searchNominatimUSFirst(e.target.value)
                        setSuggestions(data)
                      } catch { setSuggestions([]) }
                    }, 300)
                  } else { setSuggestions([]) }
                }} placeholder="Search address..." style={{ padding: '5px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '175px', outline: 'none' }} />
                {suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', maxHeight: '200px', overflowY: 'auto', zIndex: 1001 }}>
                    {suggestions.map((s, i) => (
                      <div key={i} onClick={() => {
                        const lat = parseFloat(s.lat)
                        const lon = parseFloat(s.lon)
                        mapInstanceRef.current?.flyTo([lat, lon], 14)
                        setSearchQuery(s.display_name.split(',')[0])
                        setSuggestions([])
                      }}
                        style={{ padding: '6px 10px', fontSize: '13px', color: '#d4cfc9', cursor: 'pointer', borderBottom: '1px solid #2e2e2e' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {s.display_name.length > 60 ? s.display_name.slice(0, 60) + '...' : s.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={searching} style={{ padding: '5px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: searching ? '#cce0f5' : '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: searching ? 'not-allowed' : 'pointer' }}>{searching ? '...' : 'Go'}</button>
            </form>
            {[['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'], ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'], ['positron', 'Positron'], ['dark', 'Dark']].map(([layer, label]) => (
              <button key={layer} onClick={() => switchLayer(layer)}
                style={{ padding: '3px 0', width: '100px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${mapLayer === layer ? '#c0392b' : '#3a3a3a'}`, background: mapLayer === layer ? '#2a1210' : 'rgba(15,15,15,.85)', color: mapLayer === layer ? '#f5a89a' : '#d4cfc9' }}>
                {label}
              </button>
            ))}
          </div>

        {/* Legacy {showForm && ...} Add-a-Pin inline panel replaced by <QuickAddModal> below. */}
        {showQuickAdd && (
          <QuickAddModal mode="world" onClose={() => setShowQuickAdd(false)} initialLat={quickAddLat ?? undefined} initialLng={quickAddLng ?? undefined} userId={userId} userRole={userRole} onPinSaved={() => loadPins()} />
        )}

        {editingPin && (
  <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1001, background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #7ab3d4', borderRadius: '4px', padding: '1rem', width: '300px', resize: 'both', overflow: 'auto', minWidth: '260px', maxWidth: '600px' }}>
    <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', fontWeight: 600, color: '#7ab3d4', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Edit Pin</div>
    <div style={{ marginBottom: '8px' }}>
      <label style={lbl}>Title</label>
      <input style={inp} value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
    </div>
    <div style={{ marginBottom: '8px' }}>
      <label style={lbl}>Notes</label>
      <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
    </div>
    <div style={{ marginBottom: '12px' }}>
      <label style={lbl}>Categories</label>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
        {editForm.categories.map(cat => {
          const catInfo = PIN_CATEGORIES.find(c => c.value === cat)
          return (
            <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#0f2035', border: '1px solid #7ab3d4', borderRadius: '3px', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {catInfo?.emoji ?? '📍'} {catInfo?.label ?? cat}
              {editForm.categories.length > 1 && (
                <button onClick={() => setEditForm(p => ({ ...p, categories: p.categories.filter(c => c !== cat) }))}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 1px', lineHeight: 1 }}>×</button>
              )}
            </span>
          )
        })}
      </div>
      <select value="" onChange={e => {
        if (e.target.value && !editForm.categories.includes(e.target.value)) {
          setEditForm(p => ({ ...p, categories: [...p.categories, e.target.value] }))
        }
        e.target.value = ''
      }}
        style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', appearance: 'none' }}>
        <option value="">+ Add category...</option>
        {PIN_CATEGORIES.filter(c => !editForm.categories.includes(c.value)).map(c => (
          <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
        ))}
      </select>
    </div>
    {/* Parent pin — optional. When set, this pin nests under the
        chosen pin in the browser (a "rumor about the basement"
        hangs off "the abandoned warehouse"). The picker excludes
        the editing pin itself + any pin that already has it as
        an ancestor, so accidental cycles are blocked. */}
    <div style={{ marginBottom: '12px' }}>
      <label style={lbl}>Parent Pin (optional)</label>
      <select style={inp} value={editForm.parent_pin_id}
        onChange={e => setEditForm(p => ({ ...p, parent_pin_id: e.target.value }))}>
        <option value="">— top-level (no parent) —</option>
        {pins
          .filter(p => p.id !== editingPin?.id && p.parent_pin_id !== editingPin?.id)
          .sort((a, b) => a.title.localeCompare(b.title))
          .map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
      </select>
    </div>
    {editForm.categories.includes('world_event') && (
      <>
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Event Date</label>
          <input style={inp} value={editForm.event_date} onChange={e => setEditForm(p => ({ ...p, event_date: e.target.value }))} placeholder="e.g. March 2024" />
        </div>
        <div style={{ width: '60px', flexShrink: 0 }}>
          <label style={lbl}>Order</label>
          <input style={{ ...inp, textAlign: 'center' }} type="number" min="1" value={editForm.sort_order} onChange={e => setEditForm(p => ({ ...p, sort_order: e.target.value }))} placeholder="#" />
        </div>
      </div>
      {/* CMod propagation block. While Active is on, the event auto-
          applies its CMod to every community Homestead within Radius
          km. Leave Impact blank for narrative-only events that need a
          timeline marker but no mechanical effect. */}
      <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
        <label style={{ ...lbl, color: '#7ab3d4', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <input type="checkbox" checked={!!editForm.cmod_active} onChange={e => setEditForm(p => ({ ...p, cmod_active: e.target.checked }))} />
          World Event — currently active
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: '0 0 90px' }}>
            <label style={lbl}>CMod Impact</label>
            <input style={{ ...inp, textAlign: 'center' }} type="number" value={editForm.cmod_impact} onChange={e => setEditForm(p => ({ ...p, cmod_impact: e.target.value }))} placeholder="e.g. -2" title="Signed integer applied to every community Morale Check inside the radius. Negative for plagues/famines/wars; positive for relief shipments. Leave blank for narrative-only." />
          </div>
          <div style={{ flex: '0 0 110px' }}>
            <label style={lbl}>Radius (km)</label>
            <input style={{ ...inp, textAlign: 'center' }} type="number" min="1" value={editForm.cmod_radius_km} onChange={e => setEditForm(p => ({ ...p, cmod_radius_km: e.target.value }))} placeholder="500" title="How far the effect reaches from this pin. Defaults to 500 km if blank." />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>CMod Label</label>
            <input style={inp} value={editForm.cmod_label} onChange={e => setEditForm(p => ({ ...p, cmod_label: e.target.value }))} placeholder="e.g. Plague — Midwest" title="Short label shown in the Morale modal. Falls back to the pin title if blank." />
          </div>
        </div>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.4 }}>
          When <strong>Active</strong> is on, this event automatically applies its CMod to every community whose Homestead falls inside the radius — no manual entry required in the Weekly Morale Check.
        </div>
      </div>
      </>
    )}
    <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
      <div style={{ flex: 1 }}>
        <label style={lbl}>Lat</label>
        <input style={inp} value={editForm.lat} onChange={e => setEditForm(p => ({ ...p, lat: e.target.value }))} placeholder="e.g. 39.7456" inputMode="decimal" />
      </div>
      <div style={{ flex: 1 }}>
        <label style={lbl}>Lng</label>
        <input style={inp} value={editForm.lng} onChange={e => setEditForm(p => ({ ...p, lng: e.target.value }))} placeholder="e.g. -75.5466" inputMode="decimal" />
      </div>
    </div>
    <div style={{ marginBottom: '12px', position: 'relative' }}>
      <label style={lbl}>Address</label>
      <input style={inp} value={editForm.address}
        placeholder="Street, City, State — start typing to search"
        onChange={e => {
          const v = e.target.value
          setEditForm(p => ({ ...p, address: v }))
          if (editAddressDebounceRef.current) clearTimeout(editAddressDebounceRef.current)
          if (v.trim().length >= 3) {
            editAddressDebounceRef.current = setTimeout(async () => {
              try {
                const data = await searchNominatimUSFirst(v)
                setEditAddressSuggestions(data)
              } catch { setEditAddressSuggestions([]) }
            }, 300)
          } else {
            setEditAddressSuggestions([])
          }
        }}
        onBlur={() => {
          // Delay clearing so the click event on a suggestion fires first.
          setTimeout(() => setEditAddressSuggestions([]), 200)
        }} />
      {editAddressSuggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', maxHeight: '200px', overflowY: 'auto', zIndex: 100, marginTop: '-1px' }}>
          {editAddressSuggestions.map((s, i) => (
            <div key={i} onClick={() => {
              const lat = parseFloat(s.lat)
              const lon = parseFloat(s.lon)
              setEditForm(p => ({ ...p, lat: String(lat), lng: String(lon), address: s.display_name }))
              setEditAddressSuggestions([])
            }}
              style={{ padding: '6px 10px', fontSize: '13px', color: '#cce0f5', cursor: 'pointer', borderBottom: i < editAddressSuggestions.length - 1 ? '1px solid #2e2e2e' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {s.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
    {userRole === 'thriver' && editingPin && (
      <div style={{ marginBottom: '12px' }}>
        <label style={lbl}>Pin Type</label>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[['gm', 'GM'], ['rumor', 'Rumor'], ['private', 'Private']].map(([val, label]) => (
            <button key={val} onClick={() => {
              supabase.from('map_pins').update({ pin_type: val }).eq('id', editingPin.id)
            }}
              style={{ flex: 1, padding: '4px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${editingPin.pin_type === val ? '#c0392b' : '#3a3a3a'}`, background: editingPin.pin_type === val ? '#2a1210' : '#242424', color: editingPin.pin_type === val ? '#f5a89a' : '#d4cfc9' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    )}
    {/* Existing attachments */}
    {editExistingFiles.length > 0 && (
      <div style={{ marginBottom: '10px' }}>
        <label style={lbl}>Attachments</label>
        {editExistingFiles.map(att => {
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name)
          return (
            <div key={att.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', padding: '4px 6px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
              {isImage && <img src={att.url} alt="" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '2px' }} />}
              <a href={att.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: '13px', color: '#7ab3d4', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</a>
              <button onClick={async () => {
                await supabase.storage.from('pin-attachments').remove([`${editingPin!.user_id}/${editingPin!.id}/${att.name}`])
                setEditExistingFiles(prev => prev.filter(a => a.name !== att.name))
              }} style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '14px', cursor: 'pointer', padding: '0 2px' }}>×</button>
            </div>
          )
        })}
      </div>
    )}
    {/* New file upload */}
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', padding: '8px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', cursor: 'pointer' }}>
        {editAttachments.length > 0 ? <span style={{ color: '#7fc458' }}>{editAttachments.length} file{editAttachments.length > 1 ? 's' : ''} to upload</span> : '+ Add files'}
        <input type="file" multiple hidden onChange={e => { if (e.target.files) setEditAttachments(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = '' }} />
      </label>
      {editAttachments.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
          <button onClick={() => setEditAttachments(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}>×</button>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: '6px' }}>
      <button onClick={handleSaveEdit} disabled={!editForm.title.trim() || editUploading}
        style={{ flex: 1, padding: '8px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', cursor: editUploading ? 'wait' : 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', opacity: editUploading ? 0.6 : 1 }}>
        {editUploading ? 'Saving...' : 'Save'}
      </button>
      <button onClick={() => { handleDeletePin(editingPin.id); setEditingPin(null) }}
        style={{ padding: '8px 12px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Delete
      </button>
      <button onClick={() => setEditingPin(null)}
        style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Cancel
      </button>
    </div>
  </div>
)}

      </div>
    </div>
  )
}


