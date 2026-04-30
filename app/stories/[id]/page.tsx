'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter, useParams } from 'next/navigation'
import { SETTINGS } from '../../../lib/settings'
import { SETTING_PREGENS, type PregenSeed } from '../../../lib/setting-npcs'
import { buildCharacterFromPregen } from '../../../lib/xse-schema'
import StoryActionBar from '../../../components/StoryActionBar'

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
  // (cloning state removed — Clone button retired Apr 2026)
  const [showPregens, setShowPregens] = useState(false)
  const [creatingPregen, setCreatingPregen] = useState(false)
  const [amKicked, setAmKicked] = useState(false)
  const [rejoining, setRejoining] = useState(false)
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
      // <StoryActionBar> — that component fetches its own module
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
    // Instantly launch the game — match the Launch button behavior
    // (new tab) so the player doesn't have to click Launch as a
    // second step right after rejoining. Last minute fix #3.
    window.open(`/stories/${id}/table`, '_blank', 'noopener,noreferrer')
  }

  // (handleClone removed — the in-app Clone button was retired in
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
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>Loading...</div>
  )

  const isGM = campaign.gm_user_id === userId
  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/join/${campaign.invite_code}` : ''

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '3px', fontFamily: 'Carlito, sans-serif' }}>
          {SETTINGS[campaign.setting] ?? campaign.setting} &mdash; {isGM ? 'Game Master' : 'Player'}
        </div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          {campaign.name}
        </div>
        {campaign.description && (
          <p style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '6px', lineHeight: 1.6 }}>{campaign.description}</p>
        )}
      </div>

      {/* Canonical action bar — same 7 buttons everywhere they need
          to live (hub + sub-pages). Self-contained: loads campaign +
          module state internally and owns its own Publish/Delete
          modals. Per the 2026-04-29 directive making this bar look
          identical across every campaign sub-page. */}
      {isGM && <StoryActionBar campaignId={id} />}

      {/* Action buttons — Player */}
      {!isGM && (
        <>
          {amKicked && (
            <div style={{ background: '#2a1210', border: '1px solid #c0392b', borderRadius: '4px', padding: '12px 14px', marginBottom: '12px', color: '#f5a89a', fontSize: '13px', lineHeight: 1.5 }}>
              <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5a89a', marginBottom: '4px' }}>Removed from Session</div>
              You were removed from this session by the GM. You will not rejoin automatically — click <b>Rejoin Session</b> below when you are ready to return.
            </div>
          )}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
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
        <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Invite Link</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, fontSize: '13px', color: '#7ab3d4', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', padding: '8px 10px', fontFamily: 'Barlow, sans-serif', wordBreak: 'break-all' }}>
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

      {/* My Survivor — player only */}
      {!isGM && (
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
                style={{ flex: 1, padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif' }}>
                <option value="">— Select a survivor —</option>
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
          {/* Shortcut row — three character-creation paths so a new player
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
          {/* Pregen selection — only for settings with pregens */}
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

      {/* Members list — both views */}
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
        <Link href="/stories" style={{ padding: '9px 22px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Back
        </Link>
      </div>

      {/* ModulePublishModal lives inside <StoryActionBar> now —
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
