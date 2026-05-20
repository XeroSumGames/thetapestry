'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter, useParams } from 'next/navigation'
import { SETTINGS } from '../../../lib/settings'
import { SETTING_PREGENS, type PregenSeed } from '../../../lib/setting-npcs'
import { buildCharacterFromPregen } from '../../../lib/xse-schema'
import { isThriver as roleIsThriver } from '../../../lib/auth/roles'
import { searchNominatimUSFirst } from '../../../lib/nominatim-search'
import StoryActionBar from '../../../components/StoryActionBar'

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
}

interface Member {
  id: string
  user_id: string
  character_id: string | null
  joined_at: string
  profiles: { username: string; role: string }
  characters: { id: string; name: string } | null
}

interface Character {
  id: string
  name: string
}

async function fetchMembersWithProfiles(supabase: any, campaignId: string): Promise<Member[]> {
  const { data: mems } = await supabase
    .from('campaign_members')
    .select(`id, user_id, character_id, joined_at, characters:character_id(id, name)`)
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
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  // (cloning state removed - Clone button retired Apr 2026)
  const [showPregens, setShowPregens] = useState(false)
  const [creatingPregen, setCreatingPregen] = useState(false)
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
  // Module publish + subscriber-update state moved to StoryActionBar
  // alongside the action buttons that consume it. Hub keeps only the
  // state it actually renders (members, kicked-rejoin, pregens).

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/stories'); return }
      setCampaign(camp)

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
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setMyCharacters(chars ?? [])

      const myMembership = mems.find((m: any) => m.user_id === user.id) as any
      if (myMembership?.character_id) {
        setSelectedCharId(myMembership.character_id)
        setAssignedCharName((myMembership.characters as any)?.name ?? '')
      }

      // Module publish + subscriber-update state moved to
      // <StoryActionBar> - that component fetches its own module
      // context. Hub no longer needs the duplicate query.

      // Check if this player was kicked from the current session
      if (camp.gm_user_id !== user.id) {
        const { data: myState } = await supabase
          .from('character_states')
          .select('kicked')
          .eq('campaign_id', id)
          .eq('user_id', user.id)
          .maybeSingle()
        setAmKicked(!!myState?.kicked)
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
        .select('id, name')
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
        setMyCharacters(prev => [created, ...prev])
        setShowPregens(false)
        const mems = await fetchMembersWithProfiles(supabase, id)
        setMembers(mems)
      }
    } finally {
      setCreatingPregen(false)
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
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Carlito, sans-serif' }}>

      {/* Kicked banner above the action bar so the explanation reads
          before the Rejoin button. The banner-then-buttons order also
          keeps the action row visually unbroken. Player-only. */}
      {!gmLike && amKicked && (
        <div style={{ background: '#2a1210', border: '1px solid #c0392b', borderRadius: '4px', padding: '12px 14px', marginBottom: '12px', color: '#f5a89a', fontSize: '13px', lineHeight: 1.5 }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5a89a', marginBottom: '4px' }}>Removed from Session</div>
          You were removed from this session by the GM. Click <b>Rejoin Session</b> below to return to the game.
        </div>
      )}

      {/* Canonical campaign-page header - setting label, role chip,
          campaign name, description, red separator, and the action
          bar (full 7 buttons for GM, slim Launch/Share for player +
          inline Rejoin/Leave via extraButtons so all player actions
          sit on a single row). */}
      <StoryActionBar campaignId={id} extraButtons={!gmLike ? (
        <>
          {amKicked && (
            <button onClick={handleRejoin} disabled={rejoining} style={{ ...btn('#1a2e10', '#7fc458', '#2d5a1b'), opacity: rejoining ? 0.6 : 1 } as any}>
              {rejoining ? 'Rejoining…' : 'Rejoin Session'}
            </button>
          )}
          <button onClick={handleLeave} style={btn('#7a1f16', '#f5a89a', '#7a1f16') as any}>
            Leave
          </button>
        </>
      ) : undefined} />

      {/* Invite link - both views */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Invite Link</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, fontSize: '13px', color: '#7ab3d4', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', padding: '8px 10px', fontFamily: 'Carlito, sans-serif', wordBreak: 'break-all' }}>
            {inviteLink}
          </div>
          <button onClick={copyInviteLink}
            style={{ flexShrink: 0, padding: '8px 16px', background: copied ? '#1a2e10' : '#242424', border: `1px solid ${copied ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: copied ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px' }}>
          Code: <span style={{ color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.1em', fontWeight: 700 }}>{campaign.invite_code}</span>
        </div>
      </div>

      {/* My Survivor - player only (Thriver godmode also hides this) */}
      {!gmLike && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Carlito, sans-serif' }}>
            My Survivor
          </div>
          {assignedCharName && (
            <div style={{ fontSize: '13px', color: '#7fc458', marginBottom: '8px' }}>
              Currently playing: <strong>{assignedCharName}</strong>
            </div>
          )}
          {myCharacters.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#cce0f5' }}>
              You have no characters yet. Pick a creation method below.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif' }}>
                <option value="">- Select a survivor -</option>
                {myCharacters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={handleAssignCharacter} disabled={assigning || !selectedCharId}
                style={{ padding: '8px 16px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: assigning || !selectedCharId ? 'not-allowed' : 'pointer', opacity: assigning || !selectedCharId ? 0.6 : 1 }}>
                {assigning ? 'Saving...' : 'Assign'}
              </button>
            </div>
          )}
          {/* Shortcut row - three character-creation paths so a new player
              doesn't have to find the sidebar to make their first survivor.
              Each link carries ?return=<story-id> so the creation pages can
              bounce the new player right back here when they're done. */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <a href={`/characters/new?return=${id}`}
              style={{ flex: 1, minHeight: '44px', padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap' }}>
              Backstory Generation
            </a>
            <a href={`/characters/quick?return=${id}`}
              style={{ flex: 1, minHeight: '44px', padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap' }}>
              Quick Character
            </a>
            <a href={`/characters/random?return=${id}`}
              style={{ flex: 1, minHeight: '44px', padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap' }}>
              Random Character
            </a>
          </div>
          {/* Pregen selection - only for settings with pregens */}
          {campaign.setting && SETTING_PREGENS[campaign.setting] && (
            <div style={{ marginTop: '10px' }}>
              <button onClick={() => setShowPregens(!showPregens)}
                style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {showPregens ? 'Hide Pre-Generated Characters' : 'Or Choose a Pre-Generated Character'}
              </button>
              {showPregens && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {SETTING_PREGENS[campaign.setting]!.map(p => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee' }}>{p.name}</div>
                        <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>{p.profession} &middot; {p.three_words}</div>
                      </div>
                      <button onClick={() => handleSelectPregen(p)} disabled={creatingPregen}
                        style={{ padding: '6px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: creatingPregen ? 'not-allowed' : 'pointer', opacity: creatingPregen ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                        {creatingPregen ? 'Creating...' : 'Select'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members list - both views */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Carlito, sans-serif' }}>
          Members ({members.length})
        </div>
        {members.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '1rem' }}>No players yet. Share the invite link above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {members.map(m => {
              const isThisGM = m.user_id === campaign.gm_user_id
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#242424', borderRadius: '3px', border: '1px solid #2e2e2e' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee' }}>{(m.profiles as any)?.username ?? 'Unknown'}</span>
                    {isThisGM && <span style={{ marginLeft: '6px', fontSize: '13px', background: '#c0392b', color: '#fff', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em' }}>GM</span>}
                    {(m.characters as any)?.name && (
                      <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '2px' }}>Playing: {(m.characters as any).name}</div>
                    )}
                    {!(m.characters as any)?.name && !isThisGM && (
                      <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>No character assigned</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {m.user_id && m.user_id !== userId && (
                      <a href={`/messages?dm=${m.user_id}`} title="Send message"
                        style={{ padding: '3px 8px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', lineHeight: 1.4 }}>
                        💬 Message
                      </a>
                    )}
                    {/* GM-or-Thriver Remove. Hidden for the GM's own
                        row to prevent self-removal - a campaign needs
                        a GM. Thrivers can remove members on any
                        campaign via godmode. */}
                    {gmLike && !isThisGM && (
                      <button onClick={() => handleRemoveMember(m)} title={`Remove ${(m.profiles as any)?.username ?? 'player'} from the campaign`}
                        style={{ padding: '3px 8px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#c0392b', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', lineHeight: 1.4 }}>
                        Remove
                      </button>
                    )}
                    <div style={{ fontSize: '13px', color: '#cce0f5' }}>Joined {formatDate(m.joined_at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* GM Tools - Edit form, lifted from the retired /edit page (2026-05-15).
          GM-or-Thriver only. Story Name / Description / Default Map Style /
          Map Center Location, with Save Changes. Seed Management sub-section
          is Thriver-only and only visible on non-custom settings. */}
      {gmLike && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#EF9F27', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Carlito, sans-serif' }}>
            GM Tools
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={lbl}>Story Name</label>
            <input style={inp} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name your story..." />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={lbl}>Description <span style={{ color: '#5a5550', fontWeight: 400 }}>(optional)</span></label>
            <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="A brief description of your story..." />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={lbl}>Default Map Style</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
              {MAP_STYLES.map(([val, label]) => (
                <button key={val} type="button" onClick={() => setEditMapStyle(val)}
                  style={{ padding: '6px 4px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${editMapStyle === val ? '#c0392b' : '#3a3a3a'}`, background: editMapStyle === val ? '#2a1210' : '#242424', color: editMapStyle === val ? '#f5a89a' : '#d4cfc9' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={lbl}>Map Center Location</label>
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
              }} placeholder="Search for a new center location..." style={inp} />
              {editLocationSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '0 0 3px 3px', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                  {editLocationSuggestions.map((s, i) => (
                    <div key={i} onClick={() => {
                      setEditMapCenter({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
                      setEditLocationQuery(s.display_name.split(',').slice(0, 2).join(','))
                      setEditLocationSuggestions([])
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
              <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '4px' }}>No custom center - map uses default view</div>
            )}
          </div>

          {editError && (
            <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', marginBottom: '12px' }}>
              {editError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={handleEditSave} disabled={editSaving || !editName.trim()}
              style={{ padding: '10px 24px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: editSaving || !editName.trim() ? 'not-allowed' : 'pointer', opacity: editSaving || !editName.trim() ? 0.6 : 1 }}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
            {editSaved && (
              <span style={{ color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>✓ Saved</span>
            )}
          </div>

          {/* Sync to Seed - Thriver only, non-custom settings. Overwrites
              setting_seed_* tables with this campaign's curated content. */}
          {isThriver && campaign.setting && campaign.setting !== 'custom' && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #2e2e2e' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#EF9F27', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>Seed Management</div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '10px', lineHeight: 1.5 }}>
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

      {/* Back button */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Link href="/stories" style={{ padding: '9px 22px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Back
        </Link>
      </div>

      {/* ModulePublishModal lives inside <StoryActionBar> now -
          opening from the Publish button there. */}

    </div>
  )
}

function btn(bg: string, color: string, border: string): React.CSSProperties {
  return {
    // Padding tightened from 8px/18px → 6px/14px so all seven hub
    // actions (Launch / Edit / Share / GM Kit / Snapshot / Publish /
    // Delete) fit on one line at standard viewport widths without
    // Delete dropping to a second row.
    padding: '6px 14px', background: bg, border: `1px solid ${border}`,
    borderRadius: '3px', color, fontSize: '13px',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
    // inline-flex + center keeps icon glyphs (📦) baseline-aligned with the
    // text label. whiteSpace + lineHeight stop multi-word labels (GM Kit,
    // Publish Module) from wrapping to two lines and breaking row height.
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    whiteSpace: 'nowrap', lineHeight: 1,
  }
}
