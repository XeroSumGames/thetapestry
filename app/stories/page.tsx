'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { SETTINGS } from '../../lib/settings'

interface Campaign {
  id: string
  name: string
  description: string
  invite_code: string
  setting: string
  gm_user_id: string
  status: string
  created_at: string
  // Bumped to now() any time anyone opens this campaign's table page.
  // Drives both the "Last Run" label and the sort order on My Stories.
  last_accessed_at?: string | null
}

export default function CampaignsPage() {
  const [gmCampaigns, setGmCampaigns] = useState<Campaign[]>([])
  const [playerCampaigns, setPlayerCampaigns] = useState<Campaign[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [gmNames, setGmNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  // campaign_id → ISO string of latest activity. Used both for sort and
  // for the "Last Run" display label on each card.
  const [lastActivity, setLastActivity] = useState<Map<string, string>>(new Map())
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Pull both lists. Order coming back doesn't matter — we re-sort by
      // last-played below.
      const { data: gmRaw } = await supabase
        .from('campaigns')
        .select('*')
        .eq('gm_user_id', user.id)

      const { data: memberships } = await supabase
        .from('campaign_members')
        .select('campaign_id')
        .eq('user_id', user.id)
      const memberIds = (memberships ?? []).map((m: any) => m.campaign_id)

      let playerRaw: Campaign[] = []
      if (memberIds.length > 0) {
        const { data: player } = await supabase
          .from('campaigns')
          .select('*')
          .in('id', memberIds)
          .neq('gm_user_id', user.id)
        playerRaw = (player ?? []) as Campaign[]
        const gmIds = [...new Set(playerRaw.map((c: any) => c.gm_user_id))]
        if (gmIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', gmIds)
          if (profiles) setGmNames(Object.fromEntries(profiles.map((p: any) => [p.id, p.username])))
        }
      }

      // Build a campaign_id → most-recent-activity map. We layer two
      // signals — the campaign's last_accessed_at (bumped on every
      // table-page open) and the most recent session.started_at —
      // taking whichever is later. Either signal beats created_at
      // when present, so a campaign you've prepped + opened sorts
      // above one you only created.
      const allIds = [...((gmRaw ?? []) as Campaign[]).map(c => c.id), ...playerRaw.map(c => c.id)]
      const lastPlayed = new Map<string, string>()
      if (allIds.length > 0) {
        const { data: sess } = await supabase
          .from('sessions')
          .select('campaign_id, started_at')
          .in('campaign_id', allIds)
        for (const row of (sess ?? []) as { campaign_id: string; started_at: string | null }[]) {
          if (!row.started_at) continue
          const prev = lastPlayed.get(row.campaign_id)
          if (!prev || row.started_at > prev) lastPlayed.set(row.campaign_id, row.started_at)
        }
      }
      // Merge campaign.last_accessed_at into the same map (taking the
      // later of the two). Cheap because we already have every campaign
      // in memory.
      for (const c of [...((gmRaw ?? []) as Campaign[]), ...playerRaw]) {
        if (c.last_accessed_at) {
          const prev = lastPlayed.get(c.id)
          if (!prev || c.last_accessed_at > prev) lastPlayed.set(c.id, c.last_accessed_at)
        }
      }
      setLastActivity(lastPlayed)

      // Sort: most-recently-touched first; never-touched campaigns fall
      // back to created_at DESC (so a brand-new campaign still appears
      // near the top instead of getting buried at the bottom).
      const sortByActivity = (list: Campaign[]) => [...list].sort((a, b) => {
        const aKey = lastPlayed.get(a.id) ?? a.created_at
        const bKey = lastPlayed.get(b.id) ?? b.created_at
        return bKey.localeCompare(aKey)
      })

      setGmCampaigns(sortByActivity(gmRaw ?? []))
      setPlayerCampaigns(sortByActivity(playerRaw))
      setLoading(false)
    }
    load()
  }, [])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>Loading...</div>
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          My Stories
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/stories/new" style={{ padding: '7px 18px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          New Story
        </Link>
        <Link href="/campaigns/new" style={{ padding: '7px 18px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          New Campaign
        </Link>
      </div>

      {gmCampaigns.length === 0 && playerCampaigns.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#d4cfc9', marginBottom: '1rem' }}>No stories yet.</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <Link href="/stories/new" style={{ padding: '9px 22px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Create a Story
            </Link>
            <Link href="/stories/join" style={{ padding: '9px 22px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Join a Story
            </Link>
          </div>
        </div>
      )}

      {gmCampaigns.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Running as GM
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gmCampaigns.map(c => (
              <div key={c.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', borderLeft: '3px solid #c0392b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee' }}>{c.name}</div>
                    <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '2px' }}>
                      {SETTINGS[c.setting] ?? c.setting} &middot; Created {formatDate(c.created_at)}
                      {lastActivity.get(c.id) && <> &middot; <span style={{ color: '#7fc458' }}>Last Run: {formatDate(lastActivity.get(c.id)!)}</span></>}
                    </div>
                    {c.description && <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '6px', lineHeight: 1.5 }}>{c.description}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'Barlow Condensed, sans-serif' }}>Invite Code</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em' }}>{c.invite_code}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <a href={`/stories/${c.id}/table`} target="_blank" rel="noreferrer" style={{ padding: '5px 14px', background: '#7a1f16', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Launch</a>
                  <a href={`/stories/${c.id}`} target="_blank" rel="noreferrer" style={{ padding: '5px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Enter</a>
                  <a href={`/stories/${c.id}/edit`} style={{ padding: '5px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Edit</a>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${c.invite_code}`); alert('Invite link copied to clipboard!') }} style={{ padding: '5px 14px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Share</button>
                  <button onClick={async () => { if (!confirm('Delete this story?')) return; await supabase.from('campaigns').delete().eq('id', c.id); setGmCampaigns(prev => prev.filter(x => x.id !== c.id)) }} style={{ padding: '5px 14px', background: 'none', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {playerCampaigns.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Playing In
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {playerCampaigns.map(c => (
              <div key={c.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem', borderLeft: '3px solid #7ab3d4' }}>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee' }}>{c.name}</div>
                  <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '2px' }}>
                    {SETTINGS[c.setting] ?? c.setting}{gmNames[c.gm_user_id] ? <> &middot; <span style={{ color: '#c0392b' }}>GM: {gmNames[c.gm_user_id]}</span></> : ''} &middot; Joined {formatDate(c.created_at)}
                    {lastActivity.get(c.id) && <> &middot; <span style={{ color: '#7fc458' }}>Last Run: {formatDate(lastActivity.get(c.id)!)}</span></>}
                  </div>
                  {c.description && <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '6px', lineHeight: 1.5 }}>{c.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <a href={`/stories/${c.id}/table`} target="_blank" rel="noreferrer" style={{ padding: '5px 14px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Launch</a>
                  <a href={`/stories/${c.id}`} target="_blank" rel="noreferrer" style={{ padding: '5px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Enter</a>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${c.invite_code}`); alert('Invite link copied to clipboard!') }} style={{ padding: '5px 14px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Share</button>
                  <button onClick={async () => { if (!confirm(`Leave ${c.name}?`)) return; await supabase.from('campaign_members').delete().eq('campaign_id', c.id).eq('user_id', userId!); setPlayerCampaigns(prev => prev.filter(x => x.id !== c.id)) }} style={{ padding: '5px 14px', background: 'none', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Leave</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #2e2e2e', display: 'flex', gap: '8px' }}>
        <Link href="/stories/join" style={{ padding: '9px 22px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Join a Story
        </Link>
      </div>

    </div>
  )
}
