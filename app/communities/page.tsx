'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import Link from 'next/link'

// My Communities — top-level index. Lists every community the current user
// can see (via RLS — they're the GM of the campaign, or a member of it).
// Grouped by campaign. Clicking a card opens the detail page.

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

export default function CommunitiesIndexPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<CommunityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      // Pull all communities RLS allows us to see. Then enrich with member
      // count + campaign name + GM flag.
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
    load()
  }, [])

  // Group by campaign
  const grouped = rows.reduce<Record<string, CommunityRow[]>>((acc, r) => {
    (acc[r.campaign_id] ||= []).push(r)
    return acc
  }, {})

  if (loading) return <div style={{ padding: '2rem', color: '#cce0f5', fontSize: '14px' }}>Loading…</div>
  if (!userId) return <div style={{ padding: '2rem', color: '#cce0f5', fontSize: '14px' }}>Sign in to see your communities.</div>

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '0.25rem' }}>My Communities</h1>
      <p style={{ color: '#cce0f5', fontSize: '14px', marginBottom: '1.5rem' }}>
        Every group of survivors you're part of — yours and the ones you've been recruited into.
        Reach 13 members and a Group becomes a Community, with weekly Morale Checks.
      </p>

      {rows.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#5a5550', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          You haven't founded or joined any communities yet.
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#3a3a3a', textTransform: 'none', letterSpacing: 0 }}>
            A GM creates a community inside a campaign — it'll appear here once you're a member.
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
    </div>
  )
}
