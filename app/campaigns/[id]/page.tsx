'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'

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

const SETTINGS: Record<string, string> = {
  custom: 'New Setting',
  district0: 'District Zero',
  mongrels: 'Minnie & The Magnificent Mongrels',
  chased: 'Chased',
  empty: 'Empty',
  therock: 'The Rock',
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: camp } = await supabase.from('campaigns').select('*').eq('id', id).single()
      if (!camp) { router.push('/campaigns'); return }
      setCampaign(camp)

      const { data: mems } = await supabase
  .from('campaign_members')
  .select(`
    id, user_id, character_id, joined_at,
    profiles:user_id(username, role),
    characters:character_id(id, name)
  `)
  .eq('campaign_id', id)
  .order('joined_at', { ascending: true })
      setMembers((mems ?? []) as any)

      const { data: chars } = await supabase
        .from('characters')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setMyCharacters(chars ?? [])

      const myMembership = (mems ?? []).find((m: any) => m.user_id === user.id) as any
      if (myMembership?.character_id) {
        setSelectedCharId(myMembership.character_id)
        setAssignedCharName((myMembership.characters as any)?.name ?? '')
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
      const { data: mems } = await supabase
  .from('campaign_members')
  .select(`
    id, user_id, character_id, joined_at,
    profiles:user_id(username, role),
    characters:character_id(id, name)
  `)
  .eq('campaign_id', id)
  .order('joined_at', { ascending: true })
      setMembers((mems ?? []) as any)
    }
    setAssigning(false)
  }

  async function handleLeave() {
    if (!userId || !campaign) return
    if (campaign.gm_user_id === userId) return
    await supabase.from('campaign_members').delete().eq('campaign_id', id).eq('user_id', userId)
    router.push('/campaigns')
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
      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '3px', fontFamily: 'Barlow Condensed, sans-serif' }}>
          {SETTINGS[campaign.setting] ?? campaign.setting} &mdash; {isGM ? 'Game Master' : 'Player'}
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          {campaign.name}
        </div>
        {campaign.description && (
          <p style={{ fontSize: '13px', color: '#b0aaa4', marginTop: '6px', lineHeight: 1.6 }}>{campaign.description}</p>
        )}
      </div>

      {/* GM VIEW */}
      {isGM && (
        <>
          {/* Invite link */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Invite Link</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, fontSize: '13px', color: '#7ab3d4', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px', padding: '8px 10px', fontFamily: 'Barlow, sans-serif', wordBreak: 'break-all' }}>
                {inviteLink}
              </div>
              <button onClick={copyInviteLink}
                style={{ flexShrink: 0, padding: '8px 16px', background: copied ? '#1a2e10' : '#242424', border: `1px solid ${copied ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: copied ? '#7fc458' : '#b0aaa4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#5a5550', marginTop: '6px' }}>
              Code: <span style={{ color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em', fontWeight: 700 }}>{campaign.invite_code}</span>
            </div>
          </div>

          {/* Members */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Members ({members.length})
            </div>
            {members.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#5a5550', textAlign: 'center', padding: '1rem' }}>No players yet. Share the invite link above.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {members.map(m => {
                  const isThisGM = m.user_id === campaign.gm_user_id
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#242424', borderRadius: '3px', border: '1px solid #2e2e2e' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee' }}>{(m.profiles as any)?.username ?? 'Unknown'}</span>
                        {isThisGM && <span style={{ marginLeft: '6px', fontSize: '9px', background: '#c0392b', color: '#fff', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em' }}>GM</span>}
                        {(m.characters as any)?.name && (
                          <div style={{ fontSize: '11px', color: '#b0aaa4', marginTop: '2px' }}>Playing: {(m.characters as any).name}</div>
                        )}
                        {!(m.characters as any)?.name && !isThisGM && (
                          <div style={{ fontSize: '11px', color: '#5a5550', marginTop: '2px' }}>No character assigned</div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#5a5550' }}>Joined {formatDate(m.joined_at)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* PLAYER VIEW */}
      {!isGM && (
        <>
          {/* My character assignment */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              My Survivor
            </div>
            {assignedCharName && (
              <div style={{ fontSize: '13px', color: '#7fc458', marginBottom: '8px' }}>
                Currently playing: <strong>{assignedCharName}</strong>
              </div>
            )}
            {myCharacters.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#5a5550' }}>
                You have no characters. <a href="/characters/new" style={{ color: '#7ab3d4', textDecoration: 'none' }}>Create one first.</a>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={selectedCharId}
                  onChange={e => setSelectedCharId(e.target.value)}
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
          </div>

          {/* Members */}
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#b0aaa4', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Members ({members.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {members.map(m => {
                const isThisGM = m.user_id === campaign.gm_user_id
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#242424', borderRadius: '3px', border: '1px solid #2e2e2e' }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee' }}>{(m.profiles as any)?.username ?? 'Unknown'}</span>
                      {isThisGM && <span style={{ marginLeft: '6px', fontSize: '9px', background: '#c0392b', color: '#fff', padding: '1px 5px', borderRadius: '2px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em' }}>GM</span>}
                      {(m.characters as any)?.name && (
                        <div style={{ fontSize: '11px', color: '#b0aaa4', marginTop: '2px' }}>Playing: {(m.characters as any).name}</div>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#5a5550' }}>Joined {formatDate(m.joined_at)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <a href="/campaigns" style={{ padding: '9px 22px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Back
        </a>
        {!isGM && (
          <button onClick={handleLeave}
            style={{ padding: '9px 22px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Leave Campaign
          </button>
        )}
      </div>

    </div>
  )
}
