'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import Link from 'next/link'

// My Communities — top-level index. Lists every community the current user
// can see (via RLS — they're the GM of the campaign, or a member of it).
// Grouped by campaign. Clicking a card opens the detail page. "+ New
// Community" header button opens a modal to create one inside any campaign
// the user belongs to (as GM or member, since Phase B opened RLS writes to
// all members per sql/communities-rls-open-to-members.sql).

interface CommunityRow {
  id: string
  campaign_id: string
  name: string
  description: string | null
  status: 'forming' | 'active' | 'dissolved'
  member_count: number
  is_community: boolean
  campaign_name: string
  campaign_setting: string
  i_am_gm: boolean
}

interface CampaignOption {
  id: string
  name: string
  setting: string
  i_am_gm: boolean
}

interface PinOption {
  id: string
  name: string
}

export default function CommunitiesIndexPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CommunityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Create modal state. `campaigns` holds every campaign the user can
  // create a community inside (GM of OR member of). Pin list is pulled on
  // demand for the selected campaign only, so the dropdown doesn't bloat
  // for users in many campaigns.
  const [showCreate, setShowCreate] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [pins, setPins] = useState<PinOption[]>([])
  const [newCampaignId, setNewCampaignId] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newHomestead, setNewHomestead] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function loadCommunities() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const { data: coms } = await supabase
      .from('communities')
      .select('id, campaign_id, name, description, status')
      .order('created_at', { ascending: false })
    const list = (coms ?? []) as any[]
    if (list.length === 0) { setRows([]); setLoading(false); return }
    const [{ data: counts }, { data: camps }] = await Promise.all([
      supabase.from('community_members').select('community_id').is('left_at', null).in('community_id', list.map(c => c.id)),
      supabase.from('campaigns').select('id, name, setting, gm_user_id').in('id', list.map(c => c.campaign_id)),
    ])
    const countBy: Record<string, number> = {}
    for (const m of (counts ?? []) as any[]) countBy[m.community_id] = (countBy[m.community_id] ?? 0) + 1
    const campBy: Record<string, any> = {}
    for (const c of (camps ?? []) as any[]) campBy[c.id] = c
    const enriched: CommunityRow[] = list.map(c => {
      const campaign = campBy[c.campaign_id] ?? {}
      const mc = countBy[c.id] ?? 0
      return {
        ...c,
        member_count: mc,
        is_community: mc >= 13,
        campaign_name: campaign.name ?? '(unknown)',
        campaign_setting: campaign.setting ?? '',
        i_am_gm: campaign.gm_user_id === user.id,
      }
    })
    setRows(enriched)
    setLoading(false)
  }

  async function loadEligibleCampaigns(uid: string) {
    // Union of "I am the GM" + "I am a member". Dedupe by id.
    const [{ data: mine }, { data: joined }] = await Promise.all([
      supabase.from('campaigns').select('id, name, setting, gm_user_id').eq('gm_user_id', uid),
      supabase.from('campaign_members').select('campaigns(id, name, setting, gm_user_id)').eq('user_id', uid),
    ])
    const seen = new Set<string>()
    const list: CampaignOption[] = []
    for (const c of (mine ?? []) as any[]) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      list.push({ id: c.id, name: c.name, setting: c.setting ?? '', i_am_gm: true })
    }
    for (const m of (joined ?? []) as any[]) {
      const c = m.campaigns
      if (!c || seen.has(c.id)) continue
      seen.add(c.id)
      list.push({ id: c.id, name: c.name, setting: c.setting ?? '', i_am_gm: c.gm_user_id === uid })
    }
    setCampaigns(list)
  }

  async function loadPinsForCampaign(campaignId: string) {
    if (!campaignId) { setPins([]); return }
    const { data } = await supabase
      .from('campaign_pins')
      .select('id, name')
      .eq('campaign_id', campaignId)
      .order('name', { ascending: true })
    setPins((data ?? []) as PinOption[])
  }

  useEffect(() => { loadCommunities() }, [])

  async function handleOpenCreate() {
    setCreateError(null)
    setNewName('')
    setNewDesc('')
    setNewHomestead('')
    if (userId) await loadEligibleCampaigns(userId)
    setShowCreate(true)
  }

  async function handleCreate() {
    if (!newCampaignId || !newName.trim()) return
    setCreating(true)
    setCreateError(null)
    const { data, error } = await supabase
      .from('communities')
      .insert({
        campaign_id: newCampaignId,
        name: newName.trim(),
        description: newDesc.trim() || null,
        homestead_pin_id: newHomestead || null,
        status: 'forming',
      })
      .select('id')
      .single()
    setCreating(false)
    if (error) {
      setCreateError(error.message)
      return
    }
    setShowCreate(false)
    await loadCommunities()
    if (data?.id) {
      // Jump straight into the new community so the user can start
      // adding members without an extra click back through the index.
      window.location.href = `/communities/${data.id}`
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: '#cce0f5', fontSize: '14px' }}>Loading…</div>
  if (!userId) return <div style={{ padding: '2rem', color: '#cce0f5', fontSize: '14px' }}>Sign in to see your communities.</div>

  // Group by campaign
  const grouped = rows.reduce<Record<string, CommunityRow[]>>((acc, r) => {
    (acc[r.campaign_id] ||= []).push(r)
    return acc
  }, {})

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee',
    fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: '12px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '3px',
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#c0392b', margin: 0 }}>My Communities</h1>
        <button onClick={handleOpenCreate}
          style={{ padding: '6px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
          + New Community
        </button>
      </div>
      <p style={{ color: '#cce0f5', fontSize: '14px', marginBottom: '1.5rem' }}>
        Every group of survivors you&apos;re part of — yours and the ones you&apos;ve been recruited into.
        Reach 13 members and a Group becomes a Community, with weekly Morale Checks.
      </p>

      {rows.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#5a5550', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          You haven&apos;t founded or joined any communities yet.
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#cce0f5', textTransform: 'none', letterSpacing: 0 }}>
            Click <span style={{ color: '#c0392b' }}>+ New Community</span> above to found one inside any campaign you&apos;re a member of.
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([campaignId, list]) => {
        const first = list[0]
        return (
          <section key={campaignId} style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px', paddingBottom: '4px', borderBottom: '1px solid #2e2e2e' }}>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', color: '#EF9F27', letterSpacing: '.08em', textTransform: 'uppercase' }}>{first.campaign_name}</span>
              {first.campaign_setting && <span style={{ fontSize: '12px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em' }}>{first.campaign_setting}</span>}
              {first.i_am_gm && <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#c0392b', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>GM</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
              {list.map(c => (
                <Link key={c.id} href={`/communities/${c.id}`}
                  style={{ display: 'block', background: '#1a1a1a', border: `1px solid ${c.status === 'dissolved' ? '#2a1210' : c.is_community ? '#2d5a1b' : '#5a4a1b'}`, borderRadius: '4px', padding: '12px', textDecoration: 'none', color: 'inherit', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{c.name}</span>
                    <span style={{ fontSize: '12px', padding: '1px 6px', borderRadius: '2px', background: c.status === 'dissolved' ? '#2a1210' : c.is_community ? '#1a2e10' : '#2a2010', color: c.status === 'dissolved' ? '#f5a89a' : c.is_community ? '#7fc458' : '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {c.status === 'dissolved' ? 'Dissolved' : c.is_community ? 'Community' : 'Group'}
                    </span>
                  </div>
                  {c.description && <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.35, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</div>}
                  <div style={{ fontSize: '12px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                    {c.member_count} member{c.member_count === 1 ? '' : 's'}{!c.is_community && c.member_count > 0 ? ` · ${13 - c.member_count} to Community` : ''}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      {/* Create Community modal */}
      {showCreate && (
        <div onClick={() => !creating && setShowCreate(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '100%', maxWidth: '440px' }}>
            <div style={{ fontSize: '12px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>New Community</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>Found a group of survivors</div>

            <div style={{ marginBottom: '10px' }}>
              <div style={lbl}>Campaign</div>
              {campaigns.length === 0 ? (
                <div style={{ padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }}>
                  You&apos;re not in any campaigns yet.
                </div>
              ) : (
                <select value={newCampaignId} onChange={e => { setNewCampaignId(e.target.value); loadPinsForCampaign(e.target.value) }}
                  style={{ ...inp, appearance: 'none' }}>
                  <option value="">— pick a campaign —</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.setting ? ` · ${c.setting}` : ''}{c.i_am_gm ? ' (GM)' : ''}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={lbl}>Name</div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. The Greenhouse" style={inp} />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={lbl}>Description (optional)</div>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={lbl}>Homestead pin (optional)</div>
              <select value={newHomestead} onChange={e => setNewHomestead(e.target.value)}
                disabled={!newCampaignId}
                style={{ ...inp, appearance: 'none', opacity: newCampaignId ? 1 : 0.5 }}>
                <option value="">— none —</option>
                {pins.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {createError && (
              <div style={{ padding: '8px 10px', marginBottom: '10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                {createError}
                {/row-level security/i.test(createError) && (
                  <div style={{ marginTop: '6px', color: '#cce0f5' }}>
                    The GM needs to run <code style={{ color: '#EF9F27' }}>sql/communities-rls-open-to-members.sql</code> in Supabase so members can create communities. Until then only GMs can.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => !creating && setShowCreate(false)} disabled={creating}
                style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: creating ? 'not-allowed' : 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating || !newCampaignId || !newName.trim()}
                style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: creating || !newCampaignId || !newName.trim() ? 'not-allowed' : 'pointer', opacity: creating || !newCampaignId || !newName.trim() ? 0.6 : 1 }}>
                {creating ? 'Creating…' : 'Create Community'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
