'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import { SETTINGS } from '../../../lib/settings'
import { SETTING_PREGENS, type PregenSeed } from '../../../lib/setting-npcs'
import { buildCharacterFromPregen } from '../../../lib/xse-schema'
import { exportGmKit } from '../../../lib/gm-kit'
import { getModuleForCampaign, archiveModule, type ModuleForCampaign } from '../../../lib/modules'
import ModulePublishModal from '../../../components/ModulePublishModal'

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
  const [cloning, setCloning] = useState(false)
  const [showPregens, setShowPregens] = useState(false)
  const [creatingPregen, setCreatingPregen] = useState(false)
  const [amKicked, setAmKicked] = useState(false)
  const [rejoining, setRejoining] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Phase 5 Sprint 2 — Module publish state. `existingModule` is
  // non-null when this campaign already has a published module; in
  // that case the Publish button flips to "Publish New Version".
  const [publishOpen, setPublishOpen] = useState(false)
  const [existingModule, setExistingModule] = useState<ModuleForCampaign | null>(null)
  // Phase 5 Sprint 3 — subscriber-side update awareness. Holds the
  // first active subscription for this campaign whose current
  // cloned version is behind the module's latest_version_id. Null
  // when up-to-date or not subscribed to anything. Populated in the
  // same load pass below.
  const [moduleUpdate, setModuleUpdate] = useState<{
    moduleId: string
    moduleName: string
    currentVersion: string
    latestVersion: string
  } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/stories'); return }
      setCampaign(camp)

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

      // Phase 5 Sprint 2 — only the GM cares about the publish state.
      if (camp.gm_user_id === user.id) {
        const mod = await getModuleForCampaign(supabase, id)
        setExistingModule(mod)

        // Phase 5 Sprint 3 — is there an active subscription whose
        // cloned version is behind the source module's latest? If
        // so, surface a "📦 Update available" button in the GM
        // action row. Tapping it routes to the versions page.
        const { data: subs } = await supabase
          .from('module_subscriptions')
          .select('module_id, current_version_id, module:modules(name, latest_version_id)')
          .eq('campaign_id', id)
          .eq('status', 'active')
        for (const sub of (subs ?? []) as any[]) {
          const modRow = Array.isArray(sub.module) ? sub.module[0] : sub.module
          const latestId = modRow?.latest_version_id
          if (latestId && latestId !== sub.current_version_id) {
            // Load both version strings so the button can tell
            // the user which bump they'd be applying.
            const { data: vs } = await supabase
              .from('module_versions')
              .select('id, version')
              .in('id', [sub.current_version_id, latestId].filter(Boolean))
            const vMap = new Map<string, string>((vs ?? []).map((v: any) => [v.id, v.version]))
            setModuleUpdate({
              moduleId: sub.module_id,
              moduleName: modRow?.name ?? 'Module',
              currentVersion: vMap.get(sub.current_version_id) ?? '?',
              latestVersion: vMap.get(latestId) ?? '?',
            })
            break  // only surface the first outdated module; a
            // campaign that's subscribed to multiples can still get
            // the bell notifications for each.
          }
        }
      }

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
      alert('Could not rejoin — please try again or ask the GM.')
      setRejoining(false)
      return
    }
    setAmKicked(false)
    setRejoining(false)
  }

  async function handleClone() {
    if (!campaign || !userId) return
    setCloning(true)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const { data, error } = await supabase.from('campaigns').insert({
      name: `Copy of ${campaign.name}`,
      description: campaign.description,
      setting: campaign.setting,
      gm_user_id: userId,
      invite_code: code,
      status: 'active',
    }).select().single()
    if (!error && data) {
      await supabase.from('campaign_members').insert({ campaign_id: data.id, user_id: userId })
      router.push(`/stories/${data.id}`)
    }
    setCloning(false)
  }

  async function handleExportKit() {
    if (!campaign || exporting) return
    setExporting(true)
    const result = await exportGmKit(supabase, id)
    setExporting(false)
    if (!result.ok) alert(`GM Kit export failed: ${result.error ?? 'unknown error'}`)
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this story? This cannot be undone.')) return
    await supabase.from('campaigns').delete().eq('id', id)
    router.push('/stories')
  }

  async function handleArchiveModule() {
    if (!existingModule) return
    const isListed = existingModule.visibility === 'listed'
    const msg = isListed
      ? `Archive "${existingModule.name}"? It will be hidden from the marketplace and no one new can subscribe. All subscriber campaigns keep their content. This cannot be undone from this page.`
      : `Archive "${existingModule.name}"? It will no longer appear when others create campaigns. All subscriber content is untouched.`
    if (!confirm(msg)) return

    try {
      // Check subscriber count first to decide if hard-delete is an option.
      const { count } = await supabase
        .from('module_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('module_id', existingModule.id)
        .eq('status', 'active')
      const subCount = count ?? 0

      let hardDelete = false
      if (subCount === 0 && !isListed) {
        hardDelete = confirm('No one has subscribed yet. Permanently delete the module entirely, or just archive it?\n\nOK = Delete permanently\nCancel = Archive (keeps version history)')
      }

      await archiveModule(supabase, existingModule.id, hardDelete)
      setExistingModule(null)
      alert(hardDelete ? '📦 Module deleted.' : '📦 Module archived. Subscribers have been notified.')
    } catch (e: any) {
      alert(`Archive failed: ${e?.message ?? 'unknown error'}`)
    }
  }

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
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>Loading...</div>
  )

  const isGM = campaign.gm_user_id === userId
  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${campaign.invite_code}` : ''

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '3px', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {SETTINGS[campaign.setting] ?? campaign.setting} &mdash; {isGM ? 'Game Master' : 'Player'}
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          {campaign.name}
        </div>
        {campaign.description && (
          <p style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '6px', lineHeight: 1.6 }}>{campaign.description}</p>
        )}
      </div>

      {/* Action buttons — GM */}
      {isGM && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem' }}>
          <a href={`/stories/${id}/table`} target="_blank" rel="noreferrer" style={btn('#c0392b', '#fff', '#c0392b')}>Launch</a>
          <a href={`/stories/${id}/edit`} style={btn('#242424', '#f5f2ee', '#3a3a3a')}>Edit</a>
          <button onClick={handleClone} disabled={cloning} style={{ ...btn('#242424', '#d4cfc9', '#3a3a3a'), opacity: cloning ? 0.6 : 1 } as any}>
            {cloning ? 'Cloning...' : 'Clone'}
          </button>
          <button onClick={copyInviteLink} style={btn('#1a3a5c', '#7ab3d4', '#7ab3d4') as any}>
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button onClick={handleExportKit} disabled={exporting} style={{ ...btn('#1a2e10', '#7fc458', '#2d5a1b'), opacity: exporting ? 0.6 : 1 } as any}
            title="Download every pin, NPC, scene, token, handout (with images) as a portable .zip">
            {exporting ? 'Packaging…' : 'GM Kit'}
          </button>
          {(!existingModule || !existingModule.archived_at) && (
            <button onClick={() => setPublishOpen(true)}
              style={btn('#2a1a3e', '#c4a7f0', '#5a2e5a') as any}
              title={existingModule
                ? `Publish a new version of "${existingModule.name}" (current v${existingModule.latest_version?.version ?? '1.0.0'})`
                : 'Publish this campaign as a reusable module other GMs can subscribe to'}>
              📦 {existingModule ? `Module v${existingModule.latest_version?.version ?? '1.0.0'}` : 'Publish Module'}
            </button>
          )}
          {existingModule?.archived_at && (
            <span style={{ padding: '8px 12px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              📦 Archived
            </span>
          )}
          {existingModule && !existingModule.archived_at && (
            <button onClick={handleArchiveModule}
              style={btn('#1a1a1a', '#5a5550', '#3a3a3a') as any}
              title="Archive this module — removes it from the marketplace, notifies subscribers">
              Archive Module
            </button>
          )}
          {moduleUpdate && (
            <a href={`/stories/${id}/modules/${moduleUpdate.moduleId}/versions`}
              style={{ ...btn('#2a1a3e', '#c4a7f0', '#8b5cf6'), textDecoration: 'none', fontWeight: 700 } as any}
              title={`"${moduleUpdate.moduleName}" has a newer version. You're on v${moduleUpdate.currentVersion}; latest is v${moduleUpdate.latestVersion}. Click to see what changed.`}>
              📦 v{moduleUpdate.latestVersion} ↑
            </a>
          )}
          <button onClick={handleDelete} style={btn('#7a1f16', '#f5a89a', '#7a1f16') as any}>
            Delete
          </button>
        </div>
      )}

      {/* Action buttons — Player */}
      {!isGM && (
        <>
          {amKicked && (
            <div style={{ background: '#2a1210', border: '1px solid #c0392b', borderRadius: '4px', padding: '12px 14px', marginBottom: '12px', color: '#f5a89a', fontSize: '13px', lineHeight: 1.5 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5a89a', marginBottom: '4px' }}>Removed from Session</div>
              You were removed from this session by the GM. You will not rejoin automatically — click <b>Rejoin Session</b> below when you are ready to return.
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem' }}>
            {amKicked ? (
              <button onClick={handleRejoin} disabled={rejoining} style={{ ...btn('#1a2e10', '#7fc458', '#2d5a1b'), opacity: rejoining ? 0.6 : 1 } as any}>
                {rejoining ? 'Rejoining…' : 'Rejoin Session'}
              </button>
            ) : (
              <a href={`/stories/${id}/table`} target="_blank" rel="noreferrer" style={btn('#c0392b', '#fff', '#c0392b')}>Launch</a>
            )}
            <button onClick={copyInviteLink} style={btn('#1a3a5c', '#7ab3d4', '#7ab3d4') as any}>
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button onClick={handleLeave} style={btn('#7a1f16', '#f5a89a', '#7a1f16') as any}>
              Leave
            </button>
          </div>
        </>
      )}

      {/* Invite link — both views */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Invite Link</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, fontSize: '13px', color: '#7ab3d4', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', padding: '8px 10px', fontFamily: 'Barlow, sans-serif', wordBreak: 'break-all' }}>
            {inviteLink}
          </div>
          <button onClick={copyInviteLink}
            style={{ flexShrink: 0, padding: '8px 16px', background: copied ? '#1a2e10' : '#242424', border: `1px solid ${copied ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: copied ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px' }}>
          Code: <span style={{ color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em', fontWeight: 700 }}>{campaign.invite_code}</span>
        </div>
      </div>

      {/* My Survivor — player only */}
      {!isGM && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
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
                style={{ flex: 1, padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif' }}>
                <option value="">— Select a survivor —</option>
                {myCharacters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={handleAssignCharacter} disabled={assigning || !selectedCharId}
                style={{ padding: '8px 16px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: assigning || !selectedCharId ? 'not-allowed' : 'pointer', opacity: assigning || !selectedCharId ? 0.6 : 1 }}>
                {assigning ? 'Saving...' : 'Assign'}
              </button>
            </div>
          )}
          {/* Shortcut row — three character-creation paths so a new player
              doesn't have to find the sidebar to make their first survivor.
              Each link carries ?return=<story-id> so the creation pages can
              bounce the new player right back here when they're done. */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <a href={`/characters/new?return=${id}`}
              style={{ flex: 1, minHeight: '44px', padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap' }}>
              Backstory Generation
            </a>
            <a href={`/characters/quick?return=${id}`}
              style={{ flex: 1, minHeight: '44px', padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap' }}>
              Quick Character
            </a>
            <a href={`/characters/random?return=${id}`}
              style={{ flex: 1, minHeight: '44px', padding: '8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap' }}>
              Random Character
            </a>
          </div>
          {/* Pregen selection — only for settings with pregens */}
          {campaign.setting && SETTING_PREGENS[campaign.setting] && (
            <div style={{ marginTop: '10px' }}>
              <button onClick={() => setShowPregens(!showPregens)}
                style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
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
                        style={{ padding: '6px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: creatingPregen ? 'not-allowed' : 'pointer', opacity: creatingPregen ? 0.6 : 1, whiteSpace: 'nowrap' }}>
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

      {/* Members list — both views */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
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
                    {isThisGM && <span style={{ marginLeft: '6px', fontSize: '13px', background: '#c0392b', color: '#fff', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em' }}>GM</span>}
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
                        style={{ padding: '3px 8px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', lineHeight: 1.4 }}>
                        💬 Message
                      </a>
                    )}
                    <div style={{ fontSize: '13px', color: '#cce0f5' }}>Joined {formatDate(m.joined_at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Back button */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <a href="/stories" style={{ padding: '9px 22px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Back
        </a>
      </div>

      {/* Phase 5 Sprint 2 — Module publish wizard. Opened from the
          📦 button in the GM action row. After a successful publish,
          refresh the existing-module state so the button re-labels
          with the new version number. */}
      {isGM && publishOpen && campaign && (
        <ModulePublishModal
          supabase={supabase}
          campaignId={id}
          campaignName={campaign.name}
          campaignDescription={campaign.description}
          existingModule={existingModule}
          onClose={() => setPublishOpen(false)}
          onPublished={async ({ version }) => {
            setPublishOpen(false)
            const refreshed = await getModuleForCampaign(supabase, id)
            setExistingModule(refreshed)
            alert(`📦 Published v${version}. Other GMs can now pick this module when creating a campaign.`)
          }}
        />
      )}

    </div>
  )
}

function btn(bg: string, color: string, border: string): React.CSSProperties {
  return {
    padding: '8px 18px', background: bg, border: `1px solid ${border}`,
    borderRadius: '3px', color, fontSize: '13px',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
    display: 'inline-block',
  }
}
