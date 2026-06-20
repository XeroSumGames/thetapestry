'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase-browser'
import { loginPathForCurrent } from '../../../lib/login-redirect'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter, useParams } from 'next/navigation'
import { SETTINGS } from '../../../lib/settings'
import { SETTING_PREGENS, type PregenSeed } from '../../../lib/setting-npcs'
import { buildCharacterFromPregen } from '../../../lib/xse-schema'
import { loadApprovedPregens, loadOfficialPregens, loadOfficialPregensByCampaign } from '../../../lib/data/pregens'
import { createCharacterForUser } from '../../../lib/data/characters'
import { assignMemberCharacter, getCampaignModuleCover, uploadCampaignCover, removeCampaignCover } from '../../../lib/data/campaigns'
import { isThriver as roleIsThriver } from '../../../lib/auth/roles'
import { searchNominatimUSFirst } from '../../../lib/nominatim-search'
import StoryActionBar from '../../../components/StoryActionBar'
import { prepareUpload } from '../../../lib/safe-upload'
import { usePostgresSubscription } from '../../../lib/realtime/usePostgresSubscription'

// GM Tools section constants (lifted from the retired /edit page -
// the Edit form is now inlined on the hub itself).
const MAP_STYLES = [
  ['satellite', 'Satellite'], ['topo', 'Topo'], ['street', 'Street'],
  ['voyager', 'Voyager'], ['humanitarian', 'Humanitarian'],
  ['positron', 'Positron'], ['dark', 'Dark'],
]
const lbl: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Carlito, sans-serif' }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '15px', fontFamily: 'Carlito, sans-serif', outline: 'none', boxSizing: 'border-box' }

interface Campaign {
  id: string
  name: string
  description: string
  invite_code: string
  setting: string
  gm_user_id: string
  status: string
  created_at: string
  cover_image_url?: string | null
}

interface Member {
  id: string
  user_id: string
  character_id: string | null
  joined_at: string
  profiles: { username: string; role: string }
  characters: { id: string; name: string; portrait_url: string | null } | null
}

interface Character {
  id: string
  name: string
  portrait_url?: string | null
}

async function fetchMembersWithProfiles(supabase: any, campaignId: string): Promise<Member[]> {
  const { data: mems } = await supabase
    .from('campaign_members')
    .select(`id, user_id, character_id, joined_at, characters:character_id(id, name, portrait_url)`)
    .eq('campaign_id', campaignId)
    .order('joined_at', { ascending: true })
  if (!mems) return []
  const userIds = mems.map((m: any) => m.user_id)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, username, role')
    .in('id', userIds)
  const profileMap = Object.fromEntries((profileData ?? []).map((p: any) => [p.id, p]))
  return mems.map((m: any) => ({
    ...m,
    profiles: profileMap[m.user_id] ?? { username: 'Unknown', role: 'survivor' },
  }))
}

export default function CampaignPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [myCharacters, setMyCharacters] = useState<Character[]>([])
  const [selectedCharId, setSelectedCharId] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [assignedCharName, setAssignedCharName] = useState<string>('')
  const [assignedPortrait, setAssignedPortrait] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  // (cloning state removed - Clone button retired Apr 2026)
  const [showPregens, setShowPregens] = useState(false)
  const [creatingPregen, setCreatingPregen] = useState(false)
  const [libraryPregens, setLibraryPregens] = useState<Array<{ id: string; name: string; data: any; portrait_url: string | null }>>([])
  const [officialLibPregens, setOfficialLibPregens] = useState<Array<{ id: string; name: string; data: any; portrait_url: string | null; setting: string | null; campaign_id: string | null }>>([])
  const [creatingLibraryPregen, setCreatingLibraryPregen] = useState<string | null>(null)
  const [amKicked, setAmKicked] = useState(false)
  const [rejoining, setRejoining] = useState(false)
  const [isThriver, setIsThriver] = useState(false)
  // GM Tools (edit form) state - lifted from the retired /edit page.
  // These are GM-or-Thriver-only; non-GM members never see this surface.
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editMapStyle, setEditMapStyle] = useState('street')
  const [editMapCenter, setEditMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [editLocationQuery, setEditLocationQuery] = useState('')
  const [editLocationSuggestions, setEditLocationSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaved, setEditSaved] = useState(false)
  const [editSyncing, setEditSyncing] = useState(false)
  const [editSyncResult, setEditSyncResult] = useState('')
  const editDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gmToolsOpen, setGmToolsOpen] = useState(false)
  const [heroCoverUrl, setHeroCoverUrl] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  // Module publish + subscriber-update state moved to StoryActionBar
  // alongside the action buttons that consume it. Hub keeps only the
  // state it actually renders (members, kicked-rejoin, pregens).

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { router.push(loginPathForCurrent()); return }
      setUserId(user.id)

      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/stories'); return }
      setCampaign(camp)

      // Resolve hero cover: campaign's own upload wins; fall back to the
      // module subscription's cover if the campaign was created from a /rumors module.
      if (camp.cover_image_url) {
        setHeroCoverUrl(camp.cover_image_url)
      } else {
        const modCover = await getCampaignModuleCover(id)
        if (modCover) setHeroCoverUrl(modCover)
      }

      {
        // Load official pregens by campaign_id (new) + setting fallback (old) + community pregens
        const settingLower = camp.setting?.toLowerCase() ?? null
        const [{ data: libP }, { data: offByCampaign }, { data: offBySetting }] = await Promise.all([
          loadApprovedPregens(camp.setting ?? undefined),
          loadOfficialPregensByCampaign(id),
          camp.setting ? loadOfficialPregens() : Promise.resolve({ data: [] }),
        ])
        setLibraryPregens(libP ?? [])
        const byCampaign = (offByCampaign ?? []) as any[]
        const bySetting = ((offBySetting ?? []) as any[]).filter(
          (p: any) => !p.campaign_id && p.setting && p.setting.toLowerCase() === settingLower
        )
        // Deduplicate: campaign_id entries take precedence over setting entries
        const campaignIds = new Set(byCampaign.map((p: any) => p.id))
        setOfficialLibPregens([...byCampaign, ...bySetting.filter((p: any) => !campaignIds.has(p.id))])
      }

      // Seed GM Tools form state from the loaded campaign row. GM-or-
      // Thriver-only inputs below; non-GM members never see this
      // surface so the values are harmless to set unconditionally.
      setEditName(camp.name ?? '')
      setEditDescription(camp.description ?? '')
      setEditMapStyle(camp.map_style ?? 'street')
      if (camp.map_center_lat != null && camp.map_center_lng != null) {
        setEditMapCenter({ lat: camp.map_center_lat, lng: camp.map_center_lng })
      }

      // Thriver lookup - drives gmLike for godmode UI. Thrivers visiting
      // a campaign they don't GM still see the GM-side hub (no Rejoin /
      // Leave / My Survivor cards, full member-management controls).
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      setIsThriver(roleIsThriver(profile))

      const mems = await fetchMembersWithProfiles(supabase, id)
      setMembers(mems)

      const { data: chars } = await supabase
        .from('characters')
        .select('id, name, portrait_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setMyCharacters(chars ?? [])

      const myMembership = mems.find((m: any) => m.user_id === user.id) as any
      if (myMembership?.character_id) {
        setSelectedCharId(myMembership.character_id)
        // Use the direct characters query for portrait — the PostgREST join
        // omits large base64 portrait_url values silently.
        const assignedChar = (chars ?? []).find((c: any) => c.id === myMembership.character_id)
        setAssignedCharName(assignedChar?.name ?? (myMembership.characters as any)?.name ?? '')
        setAssignedPortrait(assignedChar?.portrait_url ?? (myMembership.characters as any)?.portrait_url ?? null)
      }

      // Module publish + subscriber-update state moved to
      // <StoryActionBar> - that component fetches its own module
      // context. Hub no longer needs the duplicate query.

      // Check if this player was kicked. A player who has switched characters
      // has MULTIPLE character_states rows, so .maybeSingle() would error on
      // >1 row -> null -> Rejoin button never shows and they're stuck kicked.
      // Read all their states; kicked if ANY is flagged (Rejoin clears all).
      if (camp.gm_user_id !== user.id) {
        const { data: myStates } = await supabase
          .from('character_states')
          .select('kicked')
          .eq('campaign_id', id)
          .eq('user_id', user.id)
        setAmKicked((myStates ?? []).some((s: any) => s.kicked))
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function handleAssignCharacter() {
    if (!selectedCharId || !userId) return
    setAssigning(true)
    const { error } = await supabase.from('campaign_members')
      .update({ character_id: selectedCharId })
      .eq('campaign_id', id)
      .eq('user_id', userId)
    if (!error) {
      const chosen = myCharacters.find(c => c.id === selectedCharId)
      setAssignedCharName(chosen?.name ?? '')
      setAssignedPortrait(chosen?.portrait_url ?? null)
      const mems = await fetchMembersWithProfiles(supabase, id)
      setMembers(mems)
    }
    setAssigning(false)
  }

  async function handleSelectPregen(seed: PregenSeed) {
    if (!userId || !campaign || creatingPregen) return
    setCreatingPregen(true)
    try {
      const char = buildCharacterFromPregen(seed)
      const { data: created, error: charErr } = await supabase
        .from('characters')
        .insert({ user_id: userId, name: char.name, data: char })
        .select('id, name, portrait_url')
        .single()
      if (charErr || !created) { console.error('[Pregen] character create error:', charErr?.message); return }
      // Auto-assign to campaign
      const { error: assignErr } = await supabase.from('campaign_members')
        .update({ character_id: created.id })
        .eq('campaign_id', id)
        .eq('user_id', userId)
      if (!assignErr) {
        setSelectedCharId(created.id)
        setAssignedCharName(created.name)
        setAssignedPortrait((created as any).portrait_url ?? null)
        setMyCharacters(prev => [created, ...prev])
        setShowPregens(false)
        const mems = await fetchMembersWithProfiles(supabase, id)
        setMembers(mems)
      }
    } finally {
      setCreatingPregen(false)
    }
  }

  async function handleSelectLibraryPregen(row: { id: string; name: string; data: any; portrait_url?: string | null }) {
    if (!userId || !campaign || creatingLibraryPregen) return
    setCreatingLibraryPregen(row.id)
    try {
      const { data: created, error: charErr } = await createCharacterForUser(userId, row.name, row.data, row.portrait_url)
      if (charErr || !created) { console.error('[LibraryPregen] character create error:', charErr?.message); return }
      const { error: assignErr } = await assignMemberCharacter(id, userId, created.id)
      if (!assignErr) {
        setSelectedCharId(created.id)
        setAssignedCharName(created.name)
        setAssignedPortrait((created as any).portrait_url ?? null)
        setMyCharacters(prev => [created, ...prev])
        setShowPregens(false)
        const mems = await fetchMembersWithProfiles(supabase, id)
        setMembers(mems)
      }
    } finally {
      setCreatingLibraryPregen(null)
    }
  }

  async function handleLeave() {
    if (!userId || !campaign) return
    if (campaign.gm_user_id === userId) return
    if (!confirm('Leave this story?')) return
    await supabase.from('campaign_members').delete().eq('campaign_id', id).eq('user_id', userId)
    router.push('/stories')
  }

  // GM-or-Thriver: cull a member from the campaign. Deletes their
  // campaign_members row + clears any character_states they own in
  // this campaign so a future re-join lands them clean. Confirms by
  // username so a misclick on the wrong row can't silently nuke
  // someone. Their character itself is preserved - only their seat
  // at this table is removed. Thriver godmode bypasses the GM check
  // (DB RLS already widened to admit them).
  async function handleRemoveMember(member: Member) {
    if (!userId || !campaign) return
    const isGm = campaign.gm_user_id === userId
    if (!isGm && !isThriver) return
    if (member.user_id === campaign.gm_user_id) return  // can't remove the GM
    const name = (member.profiles as any)?.username ?? 'this player'
    if (!confirm(`Remove ${name} from this campaign?\n\nTheir character is preserved but they lose their seat at the table.`)) return
    const [{ error: memErr }, { error: stateErr }] = await Promise.all([
      supabase.from('campaign_members').delete().eq('campaign_id', id).eq('user_id', member.user_id),
      supabase.from('character_states').delete().eq('campaign_id', id).eq('user_id', member.user_id),
    ])
    if (memErr || stateErr) {
      alert(`Remove failed: ${(memErr || stateErr)?.message ?? 'unknown error'}`)
      return
    }
    setMembers(prev => prev.filter(m => m.user_id !== member.user_id))
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    const check = prepareUpload('campaign-covers', file)
    if (!check.ok) { alert(check.reason); e.target.value = ''; return }
    setCoverUploading(true)
    const result = await uploadCampaignCover(id, file, check.contentType)
    if ('error' in result) {
      alert(`Upload failed: ${result.error}`)
    } else {
      setHeroCoverUrl(result.url)
    }
    setCoverUploading(false)
    e.target.value = ''
  }

  async function handleCoverRemove() {
    if (!id) return
    const { error } = await removeCampaignCover(id)
    if (error) { alert(`Remove failed: ${error}`); return }
    setHeroCoverUrl(null)
  }

  // GM Tools - Save form (Name / Description / Map Style / Map Center).
  // Lifted from the retired /edit page. GM-or-Thriver gated at the JSX
  // call-site; the function itself trusts the caller.
  async function handleEditSave() {
    if (!editName.trim()) { setEditError('Story name is required.'); return }
    setEditSaving(true)
    setEditError('')
    const { error } = await supabase.from('campaigns').update({
      name: editName.trim(),
      description: editDescription.trim() || null,
      map_style: editMapStyle,
      map_center_lat: editMapCenter?.lat ?? null,
      map_center_lng: editMapCenter?.lng ?? null,
    }).eq('id', id)
    if (error) { setEditError(error.message); setEditSaving(false); return }
    // Reflect the new name/description in the loaded campaign row so
    // the header re-renders without a reload.
    setCampaign(prev => prev ? { ...prev, name: editName.trim(), description: editDescription.trim() } : prev)
    setEditSaved(true)
    setEditSaving(false)
    setTimeout(() => setEditSaved(false), 2000)
  }

  // GM Tools - Sync to Seed (Thriver only, non-custom settings). Overwrites
  // setting_seed_* rows with this campaign's NPCs/pins/scenes/handouts so
  // future campaigns using the same setting inherit the curated state.
  async function handleEditSyncSeed() {
    if (!campaign || !campaign.setting || campaign.setting === 'custom') return
    if (!confirm(`This will overwrite all seed data for "${SETTINGS[campaign.setting] ?? campaign.setting}" with this campaign's current NPCs, pins, scenes, and handouts.\n\nAll future campaigns using this setting will inherit these changes.\n\nContinue?`)) return
    setEditSyncing(true)
    setEditSyncResult('')
    try {
      await Promise.all([
        supabase.from('setting_seed_npcs').delete().eq('setting', campaign.setting),
        supabase.from('setting_seed_pins').delete().eq('setting', campaign.setting),
        supabase.from('setting_seed_scenes').delete().eq('setting', campaign.setting),
        supabase.from('setting_seed_handouts').delete().eq('setting', campaign.setting),
      ])
      const [npcsRes, pinsRes, scenesRes, handoutsRes] = await Promise.all([
        supabase.from('campaign_npcs').select('*').eq('campaign_id', id).order('sort_order'),
        supabase.from('campaign_pins').select('*').eq('campaign_id', id).order('sort_order'),
        supabase.from('tactical_scenes').select('*').eq('campaign_id', id),
        supabase.from('campaign_notes').select('*').eq('campaign_id', id).order('created_at'),
      ])
      const counts = { npcs: 0, pins: 0, scenes: 0, handouts: 0 }
      const pinIdToName: Record<string, string> = {}
      ;(pinsRes.data ?? []).forEach((p: any) => { pinIdToName[p.id] = p.name })
      const npcs = (npcsRes.data ?? []).map((n: any, i: number) => ({
        setting: campaign.setting,
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
      const pins = (pinsRes.data ?? []).map((p: any, i: number) => ({
        setting: campaign.setting, name: p.name, lat: p.lat, lng: p.lng,
        notes: p.notes, category: p.category ?? 'location',
        sort_order: p.sort_order ?? i + 1,
      }))
      if (pins.length > 0) {
        const { error } = await supabase.from('setting_seed_pins').insert(pins)
        if (error) throw new Error(`Pins: ${error.message}`)
        counts.pins = pins.length
      }
      const scenes = (scenesRes.data ?? []).map((s: any) => ({
        setting: campaign.setting, name: s.name, grid_cols: s.grid_cols, grid_rows: s.grid_rows, notes: s.notes ?? '',
      }))
      if (scenes.length > 0) {
        const { error } = await supabase.from('setting_seed_scenes').insert(scenes)
        if (error) throw new Error(`Scenes: ${error.message}`)
        counts.scenes = scenes.length
      }
      const handouts = (handoutsRes.data ?? []).map((h: any) => ({
        setting: campaign.setting, title: h.title, content: h.content ?? '',
      }))
      if (handouts.length > 0) {
        const { error } = await supabase.from('setting_seed_handouts').insert(handouts)
        if (error) throw new Error(`Handouts: ${error.message}`)
        counts.handouts = handouts.length
      }
      setEditSyncResult(`✓ Synced: ${counts.npcs} NPCs, ${counts.pins} pins, ${counts.scenes} scenes, ${counts.handouts} handouts`)
    } catch (err: any) {
      setEditSyncResult(`Error: ${err?.message ?? 'Unknown error'}`)
    }
    setEditSyncing(false)
  }

  async function handleRejoin() {
    if (!userId || !campaign || rejoining) return
    setRejoining(true)
    const { error } = await supabase
      .from('character_states')
      .update({ kicked: false })
      .eq('campaign_id', id)
      .eq('user_id', userId)
    if (error) {
      console.error('[handleRejoin] failed:', error.message)
      alert('Could not rejoin - please try again or ask the GM.')
      setRejoining(false)
      return
    }
    setAmKicked(false)
    setRejoining(false)
    // Instantly launch the game - match the Launch button behavior
    // (new tab) so the player doesn't have to click Launch as a
    // second step right after rejoining. Last minute fix #3.
    window.open(`/stories/${id}/table`, '_blank', 'noopener,noreferrer')
  }

  // (handleClone removed - the in-app Clone button was retired in
  // favor of the Module marketplace flow. To duplicate a campaign,
  // publish it as a Module and subscribe to it from a fresh campaign,
  // OR use Snapshot → Download to export a portable JSON.)

  // GM Kit export / Delete / Archive Module handlers all moved into
  // <StoryActionBar> alongside the buttons that trigger them. Hub
  // keeps only `copyInviteLink` because the player branch and the
  // invite-link panel below still call it directly.

  function copyInviteLink() {
    if (!campaign) return
    const link = `${window.location.origin}/join/${campaign.invite_code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Keep cover in sync for players: subscribe to campaign UPDATE events so
  // a cover the GM uploads (or removes) is reflected without a page reload.
  // campaigns is in supabase_realtime publication, so no publication change needed.
  usePostgresSubscription(`campaign-cover-${id}`, {
    label: `campaigns:cover:${id}`,
    event: 'UPDATE',
    table: 'campaigns',
    filter: `id=eq.${id}`,
    handler: (payload: any) => {
      const url: string | null = payload.new?.cover_image_url ?? null
      setHeroCoverUrl(url)
    },
  })

  if (loading || !campaign) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Carlito, sans-serif', color: '#f5f2ee' }}>Loading...</div>
  )

  const isGM = campaign.gm_user_id === userId
  // gmLike = isGM || isThriver. Thrivers visiting a campaign they don't
  // GM see the GM-side hub (no Rejoin/Leave/My Survivor cards) and get
  // member-management controls via godmode RLS.
  const gmLike = isGM || isThriver
  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${campaign.invite_code}` : ''

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem 4rem', fontFamily: 'Carlito, sans-serif' }}>
      <div style={{ background: '#111', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1a1a1a' }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #1a1a1a' }}>
          <Link href="/stories" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.08em', textDecoration: 'none' }}>
            &larr; My stories
          </Link>
          <span style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif' }}>Campaign lobby</span>
        </div>

        {/* Kicked banner (player only) */}
        {!gmLike && amKicked && (
          <div style={{ margin: '16px 24px 0', padding: '12px 16px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '4px', fontSize: '13px', color: '#f5a89a', lineHeight: 1.5 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5a89a', marginBottom: '4px' }}>Removed from session</div>
            You were removed from this session by the GM. Click <b>Rejoin session</b> below to return to the game.
          </div>
        )}

        {/* Hero */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', borderBottom: '1px solid #1a1a1a' }}>
          {/* Cover - inherited from module subscription or GM-uploaded.
              For GMs the entire column is a <label> so clicking anywhere
              (image present or not) opens the file picker. */}
          {gmLike ? (
            <label className="cover-upload-label" style={{ background: '#0d0d0d', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', cursor: coverUploading ? 'default' : 'pointer' }}>
              <style>{`.cover-upload-label:hover .cover-change-hint { opacity: 1 !important; }`}</style>
              {heroCoverUrl && <img src={heroCoverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />}
              {/* Overlay - always rendered, visible on hover when image present */}
              <div className="cover-change-hint" style={{ position: 'absolute', inset: 0, background: heroCoverUrl ? 'rgba(0,0,0,0.55)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: heroCoverUrl ? 0 : 1, transition: 'opacity .18s' }}>
                <span style={{ fontSize: '13px', color: coverUploading ? '#EF9F27' : '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif' }}>
                  {coverUploading ? 'Uploading...' : heroCoverUrl ? 'Change cover' : 'No cover'}
                </span>
                {!coverUploading && <span style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textDecoration: 'underline' }}>click to upload</span>}
              </div>
              <input type="file" accept="image/*" hidden onChange={handleCoverUpload} disabled={coverUploading} />
              {heroCoverUrl && !coverUploading && (
                <button
                  onClick={e => { e.preventDefault(); handleCoverRemove() }}
                  title="Remove cover image"
                  style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', background: 'rgba(0,0,0,0.7)', border: '1px solid #555', borderRadius: '3px', color: '#ccc', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, lineHeight: 1, padding: 0 }}>
                  x
                </button>
              )}
            </label>
          ) : (
            <div style={{ background: '#0d0d0d', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              {heroCoverUrl
                ? <img src={heroCoverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                : <span style={{ fontSize: '13px', color: '#666', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif' }}>No cover</span>
              }
            </div>
          )}
          {/* Hero body */}
          <div style={{ padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' as const }}>
              <span style={{ fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase' as const, padding: '3px 8px', borderRadius: '3px', fontWeight: 700, background: '#1a2e10', color: '#7fc458', border: '1px solid #2d5a1b', fontFamily: 'Carlito, sans-serif' }}>
                {SETTINGS[campaign.setting] ?? campaign.setting ?? 'Custom'}
              </span>
              <span style={{ fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase' as const, padding: '3px 8px', borderRadius: '3px', fontWeight: 700, fontFamily: 'Carlito, sans-serif', ...(gmLike ? { background: '#2a1808', color: '#EF9F27', border: '1px solid #6b4310' } : { background: '#0f2035', color: '#7ab3d4', border: '1px solid #1a3a5c' }) }}>
                {isGM ? 'Game master' : isThriver ? 'Admin' : 'Player'}
              </span>
            </div>
            <div style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' as const, color: '#fff', marginBottom: '10px', lineHeight: 1.05, fontFamily: 'Carlito, sans-serif' }}>
              {campaign.name}
            </div>
            {campaign.description && (
              <p style={{ fontSize: '15px', color: '#cce0f5', lineHeight: 1.65, fontStyle: 'italic', marginBottom: '22px', maxWidth: '560px', fontFamily: 'Carlito, sans-serif' }}>
                {campaign.description}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <a href={`/stories/${id}/table`} target="_blank" rel="noopener noreferrer"
                style={{ padding: '13px 40px', background: '#c0392b', border: '2px solid #c0392b', borderRadius: '4px', color: '#fff', fontSize: '15px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
                &#9654; Launch
              </a>
              {!gmLike && amKicked && (
                <button onClick={handleRejoin} disabled={rejoining}
                  style={{ padding: '11px 22px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '4px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: rejoining ? 'not-allowed' : 'pointer', opacity: rejoining ? 0.6 : 1 }}>
                  {rejoining ? 'Rejoining...' : 'Rejoin session'}
                </button>
              )}
              {!gmLike && (
                <button onClick={handleLeave}
                  style={{ padding: '11px 22px', background: 'transparent', border: '1px solid #2e2e2e', borderRadius: '4px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Leave
                </button>
              )}
              {gmLike && (
                <button onClick={() => setGmToolsOpen(o => !o)}
                  style={{ padding: '11px 22px', background: 'transparent', border: '1px solid #2e2e2e', borderRadius: '4px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  GM tools {gmToolsOpen ? '▲' : '▼'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body - two-column */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px' }}>

          {/* LEFT: Player view */}
          {!gmLike && (
            <div style={{ padding: '22px 24px', borderRight: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', fontWeight: 700, marginBottom: '12px', fontFamily: 'Carlito, sans-serif' }}>My survivor</div>
              <div style={{ background: '#171717', border: '1px solid #252525', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
                {assignedCharName && (
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, flexShrink: 0, background: '#2a1210', border: '2px solid #c0392b', color: '#f5a89a', overflow: 'hidden', position: 'relative' }}>
                      {assignedPortrait
                        ? <img src={assignedPortrait} alt={assignedCharName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', position: 'absolute', inset: 0 }} />
                        : assignedCharName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '3px', letterSpacing: '.02em', fontFamily: 'Carlito, sans-serif' }}>{assignedCharName}</div>
                      <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>Currently assigned</div>
                    </div>
                  </div>
                )}
                {!assignedCharName && (
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '12px', fontFamily: 'Carlito, sans-serif' }}>No survivor assigned. Pick one below or create a new one.</div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
                    <option value="">- Select a survivor -</option>
                    {myCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button onClick={handleAssignCharacter} disabled={assigning || !selectedCharId}
                    style={{ padding: '8px 16px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: assigning || !selectedCharId ? 'not-allowed' : 'pointer', opacity: assigning || !selectedCharId ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    {assigning ? 'Saving...' : 'Assign'}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Carlito, sans-serif' }}>Create new survivor</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '16px' }}>
                <a href={`/characters/new?return=${id}`} style={{ padding: '10px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.4, background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', textDecoration: 'none', display: 'block' }}>
                  Backstory<br />generation
                </a>
                <a href={`/characters/quick?return=${id}`} style={{ padding: '10px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.4, background: '#171717', border: '1px solid #2e2e2e', color: '#7a7068', textDecoration: 'none', display: 'block' }}>
                  Quick<br />character
                </a>
                <a href={`/characters/random?return=${id}`} style={{ padding: '10px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.4, background: '#171717', border: '1px solid #2e2e2e', color: '#7a7068', textDecoration: 'none', display: 'block' }}>
                  Random<br />character
                </a>
              </div>

              {(() => {
                const settingSeeds = campaign.setting ? SETTING_PREGENS[campaign.setting] ?? [] : []
                const seedNames = new Set(settingSeeds.map((p: any) => p.name))
                // Names of pregens already claimed by another player in this campaign.
                const claimedNames = new Set(
                  members.filter(m => m.character_id && m.user_id !== userId).map(m => m.characters?.name).filter(Boolean)
                )
                // Official library pregens not already covered by a hardcoded seed.
                // Do NOT re-filter by p.setting here — officialLibPregens is already
                // scoped to this campaign (via join table) or this setting (via bySetting).
                // The p.setting guard was excluding campaign-linked pregens with no setting set.
                const extraOfficial = officialLibPregens.filter(p =>
                  !seedNames.has(p.name)
                )
                const hasAny = settingSeeds.length > 0 || extraOfficial.length > 0 || libraryPregens.length > 0
                if (!hasAny) return null
                return (
                  <>
                    <div style={{ fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Carlito, sans-serif' }}>Pre-generated for this story</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {settingSeeds.map((p: any) => {
                        const libMatch = officialLibPregens.find(lp => lp.name === p.name)
                        const claimed = claimedNames.has(p.name)
                        return libMatch ? (
                          <button key={p.name} onClick={() => !claimed && handleSelectLibraryPregen(libMatch)} disabled={!!creatingLibraryPregen || claimed}
                            style={{ background: claimed ? '#111' : '#171717', border: `1px solid ${claimed ? '#1e1e1e' : '#252525'}`, borderRadius: '6px', padding: '12px 6px', cursor: claimed ? 'not-allowed' : creatingLibraryPregen ? 'not-allowed' : 'pointer', textAlign: 'center', fontFamily: 'Carlito, sans-serif', opacity: claimed ? 0.45 : creatingLibraryPregen ? 0.6 : 1, position: 'relative' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #1a3a5c', margin: '0 auto 6px', background: '#0f2035' }}>
                              {libMatch.portrait_url
                                ? <img src={libMatch.portrait_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: claimed ? 'grayscale(1)' : 'none' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7ab3d4', fontSize: '13px', fontWeight: 700 }}>{p.name.charAt(0)}</div>}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: claimed ? '#4a4a4a' : '#f5f2ee' }}>{p.name}</div>
                            <div style={{ fontSize: '13px', color: claimed ? '#3a3a3a' : '#7ab3d4', marginTop: '1px' }}>{claimed ? 'Taken' : p.profession}</div>
                          </button>
                        ) : (
                          <button key={p.name} onClick={() => !claimed && handleSelectPregen(p)} disabled={creatingPregen || claimed}
                            style={{ background: claimed ? '#111' : '#171717', border: `1px solid ${claimed ? '#1e1e1e' : '#252525'}`, borderRadius: '6px', padding: '12px 6px', cursor: claimed ? 'not-allowed' : creatingPregen ? 'not-allowed' : 'pointer', textAlign: 'center', fontFamily: 'Carlito, sans-serif', opacity: claimed ? 0.45 : creatingPregen ? 0.6 : 1 }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0f2035', border: '1px solid #1a3a5c', color: '#7ab3d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, margin: '0 auto 6px' }}>
                              {p.name.charAt(0)}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: claimed ? '#4a4a4a' : '#f5f2ee' }}>{p.name}</div>
                            <div style={{ fontSize: '13px', color: claimed ? '#3a3a3a' : '#7ab3d4', marginTop: '1px' }}>{claimed ? 'Taken' : p.profession}</div>
                          </button>
                        )
                      })}
                      {extraOfficial.map(p => {
                        const claimed = claimedNames.has(p.name)
                        return (
                          <button key={p.id} onClick={() => !claimed && handleSelectLibraryPregen(p)} disabled={!!creatingLibraryPregen || claimed}
                            style={{ background: claimed ? '#111' : '#171717', border: `1px solid ${claimed ? '#1e1e1e' : '#252525'}`, borderRadius: '6px', padding: '12px 6px', cursor: claimed ? 'not-allowed' : creatingLibraryPregen ? 'not-allowed' : 'pointer', textAlign: 'center', fontFamily: 'Carlito, sans-serif', opacity: claimed ? 0.45 : creatingLibraryPregen ? 0.6 : 1 }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #1a3a5c', margin: '0 auto 6px', background: '#0f2035' }}>
                              {p.portrait_url
                                ? <img src={p.portrait_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: claimed ? 'grayscale(1)' : 'none' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7ab3d4', fontSize: '13px', fontWeight: 700 }}>{p.name.charAt(0)}</div>}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: claimed ? '#4a4a4a' : '#f5f2ee' }}>{p.name}</div>
                            <div style={{ fontSize: '13px', color: claimed ? '#3a3a3a' : '#7ab3d4', marginTop: '1px' }}>{claimed ? 'Taken' : p.data?.profession}</div>
                          </button>
                        )
                      })}
                      {libraryPregens.slice(0, 3).map((p: any) => {
                        const claimed = claimedNames.has(p.name)
                        return (
                          <button key={p.id} onClick={() => !claimed && handleSelectLibraryPregen(p)} disabled={!!creatingLibraryPregen || claimed}
                            style={{ background: claimed ? '#111' : '#171717', border: `1px solid ${claimed ? '#1e1e1e' : '#2d5a1b'}`, borderRadius: '6px', padding: '12px 6px', cursor: claimed ? 'not-allowed' : creatingLibraryPregen ? 'not-allowed' : 'pointer', textAlign: 'center', fontFamily: 'Carlito, sans-serif', opacity: claimed ? 0.45 : creatingLibraryPregen ? 0.6 : 1 }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', border: `1px solid ${claimed ? '#1e1e1e' : '#2d5a1b'}`, margin: '0 auto 6px', background: '#1a2e10' }}>
                              {p.portrait_url
                                ? <img src={p.portrait_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: claimed ? 'grayscale(1)' : 'none' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7fc458', fontSize: '13px', fontWeight: 700 }}>{p.name.charAt(0)}</div>}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: claimed ? '#4a4a4a' : '#f5f2ee' }}>{p.name}</div>
                            <div style={{ fontSize: '13px', color: claimed ? '#3a3a3a' : '#7ab3d4', marginTop: '1px' }}>{claimed ? 'Taken' : p.data?.profession}</div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
              <div style={{ marginTop: '12px' }}>
                <a href={`/pregens?return=${id}`} style={{ display: 'inline-block', padding: '8px 16px', background: 'transparent', border: '1px solid #2e2e2e', borderRadius: '3px', color: '#7ab3d4', textDecoration: 'none', fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>
                  Or pick from a different pre-generated character &rarr;
                </a>
              </div>
            </div>
          )}

          {/* LEFT: GM view - Story settings form */}
          {gmLike && (
            <div style={{ padding: '22px 24px', borderRight: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', fontWeight: 700, marginBottom: '12px', fontFamily: 'Carlito, sans-serif' }}>Story settings</div>
              <div style={{ marginBottom: '18px' }}>
                <label style={lbl}>Story name</label>
                <input style={inp} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name your story..." />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={lbl}>Hook <span style={{ color: '#cce0f5', fontWeight: 400 }}>(optional)</span></label>
                <textarea style={{ ...inp, minHeight: '72px', resize: 'vertical' as const }} value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="A brief description of your story..." />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={lbl}>Default map style</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {MAP_STYLES.map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setEditMapStyle(val)}
                      style={{ padding: '6px 4px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${editMapStyle === val ? '#c0392b' : '#2e2e2e'}`, background: editMapStyle === val ? '#2a1210' : '#1e1e1e', color: editMapStyle === val ? '#f5a89a' : '#7a7068' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '18px', position: 'relative' }}>
                <label style={lbl}>Map center <span style={{ color: '#cce0f5', fontWeight: 400 }}>(optional)</span></label>
                <div style={{ position: 'relative' }}>
                  <input value={editLocationQuery} onChange={e => {
                    setEditLocationQuery(e.target.value)
                    if (editDebounceRef.current) clearTimeout(editDebounceRef.current)
                    if (e.target.value.length >= 3) {
                      editDebounceRef.current = setTimeout(async () => {
                        try {
                          const data = await searchNominatimUSFirst(e.target.value)
                          setEditLocationSuggestions(data)
                        } catch { setEditLocationSuggestions([]) }
                      }, 300)
                    } else { setEditLocationSuggestions([]) }
                  }} placeholder="Search for a location..." style={inp} />
                  {editLocationSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                      {editLocationSuggestions.map((s, i) => (
                        <div key={i} onClick={() => {
                          setEditMapCenter({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
                          setEditLocationQuery(s.display_name.split(',').slice(0, 2).join(','))
                          setEditLocationSuggestions([])
                        }}
                          style={{ padding: '8px 10px', fontSize: '13px', color: '#f5f2ee', cursor: 'pointer', borderBottom: '1px solid #2e2e2e' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {s.display_name.length > 80 ? s.display_name.slice(0, 80) + '...' : s.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {editMapCenter && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'monospace' }}>
                      {editMapCenter.lat.toFixed(4)}, {editMapCenter.lng.toFixed(4)}
                    </span>
                    <button type="button" onClick={() => { setEditMapCenter(null); setEditLocationQuery('') }}
                      style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', textTransform: 'uppercase' }}>
                      Clear
                    </button>
                  </div>
                )}
                {!editMapCenter && (
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px', fontFamily: 'Carlito, sans-serif' }}>No custom center - map uses default view</div>
                )}
              </div>
              {/* Pregen roster for GM reference */}
              {(() => {
                const settingSeeds = campaign.setting ? SETTING_PREGENS[campaign.setting] ?? [] : []
                const seedNames = new Set(settingSeeds.map((p: any) => p.name))
                const claimedNames = new Set(
                  members.filter(m => m.character_id).map(m => m.characters?.name).filter(Boolean)
                )
                const extraOfficial = officialLibPregens.filter(p => !seedNames.has(p.name))
                const allPregens = [
                  ...settingSeeds.map((p: any) => {
                    const libMatch = officialLibPregens.find(lp => lp.name === p.name)
                    return { name: p.name, profession: p.profession, portrait_url: libMatch?.portrait_url ?? null }
                  }),
                  ...extraOfficial.map(p => ({ name: p.name, profession: p.data?.profession ?? '', portrait_url: p.portrait_url })),
                  ...libraryPregens.slice(0, 3).map((p: any) => ({ name: p.name, profession: p.data?.profession ?? '', portrait_url: p.portrait_url })),
                ]
                if (allPregens.length === 0) return null
                return (
                  <div style={{ marginBottom: '18px' }}>
                    <label style={lbl}>Pre-generated characters</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
                      {allPregens.map(p => {
                        const claimed = claimedNames.has(p.name)
                        return (
                          <div key={p.name} style={{ background: claimed ? '#111' : '#171717', border: `1px solid ${claimed ? '#1e1e1e' : '#252525'}`, borderRadius: '6px', padding: '10px 6px', textAlign: 'center', fontFamily: 'Carlito, sans-serif', opacity: claimed ? 0.45 : 1 }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #1a3a5c', margin: '0 auto 5px', background: '#0f2035' }}>
                              {p.portrait_url
                                ? <img src={p.portrait_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: claimed ? 'grayscale(1)' : 'none' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7ab3d4', fontSize: '13px', fontWeight: 700 }}>{p.name.charAt(0)}</div>}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: claimed ? '#4a4a4a' : '#f5f2ee', lineHeight: 1.2 }}>{p.name}</div>
                            <div style={{ fontSize: '13px', color: claimed ? '#3a3a3a' : '#7ab3d4', marginTop: '2px' }}>{claimed ? 'Taken' : p.profession}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {editError && (
                <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', marginBottom: '12px' }}>
                  {editError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={handleEditSave} disabled={editSaving || !editName.trim()}
                  style={{ padding: '10px 26px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: editSaving || !editName.trim() ? 'not-allowed' : 'pointer', opacity: editSaving || !editName.trim() ? 0.6 : 1 }}>
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
                {editSaved && <span style={{ color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>✓ Saved</span>}
              </div>
            </div>
          )}

          {/* RIGHT: Party + Invite (both views) */}
          <div style={{ padding: '20px', background: '#0d0d0d' }}>
            <div style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', fontWeight: 700, marginBottom: '12px', fontFamily: 'Carlito, sans-serif' }}>Party ({members.length})</div>
            {members.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '1rem', fontFamily: 'Carlito, sans-serif' }}>No players yet. Share the invite link below.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {members.map(m => {
                  const isThisGM = m.user_id === campaign.gm_user_id
                  const uname = (m.profiles as any)?.username ?? 'Unknown'
                  return (
                    <div key={m.id} style={{ background: '#171717', border: '1px solid #222', borderRadius: '5px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      {/* LEFT: avatar + action buttons stacked */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, background: isThisGM ? '#2a1210' : '#0f2035', border: isThisGM ? '2px solid #c0392b' : '1px solid #1a3a5c', color: isThisGM ? '#f5a89a' : '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>
                          {uname.charAt(0).toUpperCase()}
                        </div>
                        {((m.user_id && m.user_id !== userId) || (gmLike && !isThisGM)) && (
                          <>
                            {m.user_id && m.user_id !== userId && (
                              <a href={`/messages?dm=${m.user_id}`} style={{ padding: '3px 7px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                💬 Msg
                              </a>
                            )}
                            {gmLike && !isThisGM && (
                              <button onClick={() => handleRemoveMember(m)} style={{ padding: '3px 7px', background: 'transparent', border: '1px solid #3a1a18', borderRadius: '3px', color: '#7a3028', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Remove
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {/* RIGHT: text info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uname}</span>
                          {isThisGM && <span style={{ fontSize: '13px', background: '#c0392b', color: '#fff', padding: '1px 5px', borderRadius: '2px', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', flexShrink: 0 }}>GM</span>}
                        </div>
                        {(m.characters as any)?.name ? (
                          <div style={{ fontSize: '13px', color: '#f5f2ee', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Carlito, sans-serif' }}>{(m.characters as any).name}</div>
                        ) : isThisGM ? (
                          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '1px', fontFamily: 'Carlito, sans-serif' }}>Running the table</div>
                        ) : (
                          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '1px', fontFamily: 'Carlito, sans-serif' }}>No character assigned</div>
                        )}
                        <div style={{ fontSize: '13px', color: '#555', marginTop: '2px', fontFamily: 'Carlito, sans-serif' }}>{formatDate(m.joined_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Invite */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', fontWeight: 700, marginBottom: '8px', fontFamily: 'Carlito, sans-serif' }}>Invite</div>
              <div style={{ fontSize: '13px', color: '#7ab3d4', marginBottom: '8px', wordBreak: 'break-all', fontFamily: 'Carlito, sans-serif' }}>{inviteLink}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Carlito, sans-serif' }}>Code</span>
                <span style={{ color: '#c0392b', fontWeight: 700, letterSpacing: '.14em', fontFamily: 'Carlito, sans-serif', fontSize: '14px' }}>{campaign.invite_code}</span>
                <button onClick={copyInviteLink} style={{ marginLeft: 'auto', padding: '5px 10px', background: copied ? '#1a2e10' : 'transparent', border: `1px solid ${copied ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: copied ? '#7fc458' : '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* GM Tools (collapsible) - GM or Thriver only */}
        {gmLike && (
          <div style={{ borderTop: '1px solid #1a1a1a' }}>
            <div onClick={() => setGmToolsOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', cursor: 'pointer', background: '#0d0d0d' }}>
              <span style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#EF9F27', fontWeight: 700, fontFamily: 'Carlito, sans-serif' }}>&#9881; GM tools</span>
              <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>{gmToolsOpen ? '▲ collapse' : '▼ expand'}</span>
            </div>
            {gmToolsOpen && (
              <div style={{ padding: '20px 28px 24px', borderTop: '1px solid #1a1a1a' }}>
                {/* StoryActionBar in compact mode: hides title header + Launch
                    (both already shown in the hero above). Shows GM Notes,
                    Snapshot, Publish, Archive, Module update, Delete, GM Kit. */}
                <StoryActionBar campaignId={id} compact />
                {isThriver && campaign.setting && campaign.setting !== 'custom' && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #2e2e2e' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#EF9F27', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>Seed Management</div>
                    <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '10px', lineHeight: 1.5, fontFamily: 'Carlito, sans-serif' }}>
                      Update the seed data for <strong style={{ color: '#f5f2ee' }}>{SETTINGS[campaign.setting] ?? campaign.setting}</strong> using this campaign's NPCs, pins, scenes, and handouts. All future campaigns using this setting will start with this data.
                    </div>
                    <button onClick={handleEditSyncSeed} disabled={editSyncing}
                      style={{ padding: '10px 24px', background: '#EF9F27', border: '1px solid #EF9F27', borderRadius: '3px', color: '#1a1a1a', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: editSyncing ? 'wait' : 'pointer', fontWeight: 700, opacity: editSyncing ? 0.6 : 1 }}>
                      {editSyncing ? 'Syncing...' : 'Update Seed Data'}
                    </button>
                    {editSyncResult && (
                      <div style={{ marginTop: '8px', fontSize: '13px', color: editSyncResult.startsWith('✓') ? '#7fc458' : '#f5a89a', fontFamily: 'Carlito, sans-serif' }}>
                        {editSyncResult}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid #151515', background: '#0d0d0d' }}>
          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
            {(() => {
              const myMem = members.find(m => m.user_id === userId)
              return myMem ? `Joined ${formatDate(myMem.joined_at)}` : `Created ${formatDate(campaign.created_at)}`
            })()}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex' }}>
            <span style={{ padding: '6px 16px', fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif' }}>War stories</span>
            <span style={{ padding: '6px 16px', fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', borderLeft: '1px solid #1a1a1a' }}>Sessions</span>
            <Link href="/community" style={{ padding: '6px 16px', fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', borderLeft: '1px solid #1a1a1a', textDecoration: 'none' }}>Community</Link>
          </div>
        </div>

      </div>
    </div>
  )
}
