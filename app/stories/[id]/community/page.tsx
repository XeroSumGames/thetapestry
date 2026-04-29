'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase-browser'
import { getCachedAuth } from '../../../../lib/auth-cache'

// Phase D — Community Dashboard. Campaign-scoped full-screen GM view
// into every Community in this campaign: Morale/Fed/Clothed history,
// current role distribution vs SRD minimums, recruitment success
// breakdown by approach, member-type breakdown.
// Non-GMs land on a minimal read-only summary (implemented separately
// via the inline block in CampaignCommunity + this page's "access
// denied" branch). Route: /stories/[campaignId]/community.

interface Community {
  id: string
  name: string
  status: 'forming' | 'active' | 'dissolved'
  week_number: number
  consecutive_failures: number
  created_at: string
  dissolved_at: string | null
}
interface MoraleRow {
  week_number: number
  outcome: string
  total: number
  cmod_for_next: number
  members_before: number
  members_after: number
  modifiers_json: any
  rolled_at: string
}
interface ResourceRow {
  week_number: number
  kind: 'fed' | 'clothed'
  outcome: string
  total: number
  rolled_at: string
}
interface Member {
  id: string
  npc_id: string | null
  character_id: string | null
  role: 'gatherer' | 'maintainer' | 'safety' | 'unassigned' | 'assigned'
  recruitment_type: 'cohort' | 'conscript' | 'convert' | 'apprentice' | 'founder' | 'member'
}
interface RecruitRow {
  damage_json: any
}

// Outcome → border/text color. Matches the Weekly Check modal palette.
function outcomeColor(o: string): string {
  const s = (o ?? '').toLowerCase().replace(/ /g, '_')
  if (s === 'wild_success' || s === 'high_insight') return '#7fc458'
  if (s === 'success') return '#7ab3d4'
  if (s === 'failure') return '#EF9F27'
  if (s === 'dire_failure' || s === 'low_insight') return '#c0392b'
  return '#d4cfc9'
}
function prettyOutcome(o: string): string {
  return (o ?? '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}
function fmtCmod(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return '0'
}

export default function CommunityDashboardPage() {
  const params = useParams()
  const campaignId = params?.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [isGM, setIsGM] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [communities, setCommunities] = useState<Community[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Per-community detail state; lazy-loaded for the selected community.
  const [morale, setMorale] = useState<MoraleRow[]>([])
  const [resources, setResources] = useState<ResourceRow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [recruits, setRecruits] = useState<RecruitRow[]>([])

  useEffect(() => {
    async function load() {
      if (!campaignId) return
      const { user } = await getCachedAuth()
      const [camp, coms] = await Promise.all([
        supabase.from('campaigns').select('name, gm_user_id').eq('id', campaignId).maybeSingle(),
        supabase.from('communities')
          .select('id, name, status, week_number, consecutive_failures, created_at, dissolved_at')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: true }),
      ])
      if (camp.data) {
        setCampaignName((camp.data as any).name)
        setIsGM(user?.id === (camp.data as any).gm_user_id)
      }
      const list = (coms.data ?? []) as Community[]
      setCommunities(list)
      if (list.length > 0) setSelectedId(list[0].id)
      setLoading(false)
    }
    load()
  }, [campaignId, supabase])

  useEffect(() => {
    async function loadCommunity() {
      if (!selectedId) return
      const [moraleRes, resRes, memRes, recRes] = await Promise.all([
        supabase.from('community_morale_checks')
          .select('week_number, outcome, total, cmod_for_next, members_before, members_after, modifiers_json, rolled_at')
          .eq('community_id', selectedId)
          .order('week_number', { ascending: false })
          .limit(20),
        supabase.from('community_resource_checks')
          .select('week_number, kind, outcome, total, rolled_at')
          .eq('community_id', selectedId)
          .order('week_number', { ascending: false })
          .limit(40),
        supabase.from('community_members')
          .select('id, npc_id, character_id, role, recruitment_type')
          .eq('community_id', selectedId)
          .is('left_at', null),
        // Recruitment history — pull from roll_log for this campaign
        // where the recruit's damage_json.communityId matches. Cheaper
        // than joining; filter client-side since damage_json isn't
        // easily queryable without a GIN.
        supabase.from('roll_log')
          .select('damage_json')
          .eq('campaign_id', campaignId)
          .eq('outcome', 'recruit'),
      ])
      setMorale((moraleRes.data ?? []) as MoraleRow[])
      setResources((resRes.data ?? []) as ResourceRow[])
      setMembers((memRes.data ?? []) as Member[])
      const allRecruits = (recRes.data ?? []) as RecruitRow[]
      setRecruits(allRecruits.filter(r => (r.damage_json as any)?.communityId === selectedId))
    }
    loadCommunity()
  }, [selectedId, campaignId, supabase])

  const selected = useMemo(() => communities.find(c => c.id === selectedId) ?? null, [communities, selectedId])

  // Role distribution — NPC labor pool only (matches CampaignCommunity
  // and the Morale modal's Enough Hands computation).
  const roleDistribution = useMemo(() => {
    const labor = members.filter(m => m.npc_id && m.role !== 'assigned')
    const n = labor.length
    const g = labor.filter(m => m.role === 'gatherer').length
    const mt = labor.filter(m => m.role === 'maintainer').length
    const s = labor.filter(m => m.role === 'safety').length
    const u = labor.filter(m => m.role === 'unassigned').length
    return {
      n, gatherers: g, maintainers: mt, safety: s, unassigned: u,
      gatherPct: n > 0 ? Math.round(100 * g / n) : 0,
      maintainPct: n > 0 ? Math.round(100 * mt / n) : 0,
      safetyPct: n > 0 ? Math.round(100 * s / n) : 0,
    }
  }, [members])

  // Recruitment stats — totals by approach, success/failure split.
  const recruitStats = useMemo(() => {
    const byApproach: Record<string, { success: number; fail: number }> = {
      cohort: { success: 0, fail: 0 },
      conscript: { success: 0, fail: 0 },
      convert: { success: 0, fail: 0 },
    }
    let apprenticeSuccesses = 0
    for (const r of recruits) {
      const dj = r.damage_json as any
      const approach = (dj?.approach ?? 'cohort') as string
      const outcome = (dj?.rollOutcome ?? '') as string
      const success = outcome === 'Success' || outcome === 'Wild Success' || outcome === 'High Insight'
      if (byApproach[approach]) {
        byApproach[approach][success ? 'success' : 'fail']++
      }
      if (success && dj?.apprentice) apprenticeSuccesses++
    }
    const total = recruits.length
    const totalSuccess = (byApproach.cohort.success + byApproach.conscript.success + byApproach.convert.success)
    return {
      total, totalSuccess,
      successRate: total > 0 ? Math.round(100 * totalSuccess / total) : 0,
      byApproach, apprenticeSuccesses,
    }
  }, [recruits])

  // Member breakdown by recruitment_type.
  const memberBreakdown = useMemo(() => {
    const out: Record<string, number> = { founder: 0, member: 0, cohort: 0, conscript: 0, convert: 0, apprentice: 0 }
    for (const m of members) out[m.recruitment_type] = (out[m.recruitment_type] ?? 0) + 1
    return out
  }, [members])

  if (loading) return <div style={{ padding: '2rem', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>Loading…</div>
  if (!isGM) return (
    <div style={{ padding: '2rem', color: '#cce0f5', maxWidth: '600px', margin: '0 auto', fontFamily: 'Barlow Condensed, sans-serif' }}>
      <div style={{ fontSize: '18px', color: '#c0392b', textTransform: 'uppercase', letterSpacing: '.06em' }}>GM Only</div>
      <div style={{ marginTop: '8px', fontSize: '15px' }}>The Community Dashboard is restricted to the campaign's GM. Players see the read-only summary on the Community panel instead.</div>
      <Link href={`/stories/${campaignId}`} style={{ display: 'inline-block', marginTop: '1rem', color: '#7ab3d4', fontSize: '15px' }}>← Back to campaign</Link>
    </div>
  )

  // Shared styles
  const cardBox: React.CSSProperties = { background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '16px' }
  const h2: React.CSSProperties = { fontSize: '15px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '10px' }
  const label: React.CSSProperties = { fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1.5rem 4rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <Link href={`/stories/${campaignId}/table`} style={{ color: '#7ab3d4', fontSize: '13px', textDecoration: 'none', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>← {campaignName} table</Link>
      </div>
      <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Community Dashboard</div>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', color: '#EF9F27', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '1.5rem', fontWeight: 700 }}>{campaignName}</div>

      {communities.length === 0 ? (
        <div style={{ ...cardBox, textAlign: 'center', color: '#cce0f5', fontSize: '15px' }}>
          No communities in this campaign yet. Create one from the Community ▾ → New Community menu on the table page.
        </div>
      ) : (
        <>
          {/* Community picker */}
          {communities.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {communities.map(c => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  style={{ padding: '8px 14px', background: selectedId === c.id ? '#1a2e10' : 'transparent', border: `1px solid ${selectedId === c.id ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', color: selectedId === c.id ? '#7fc458' : '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: selectedId === c.id ? 700 : 400 }}>
                  {c.name}{c.status === 'dissolved' ? ' ✗' : ''}
                </button>
              ))}
            </div>
          )}

          {/* Header summary */}
          {selected && (
            <div style={{ ...cardBox, marginBottom: '1rem', display: 'flex', alignItems: 'baseline', gap: '18px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '22px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {selected.status} · Week {selected.week_number} · {selected.consecutive_failures}/3 failures · {members.length} members
                </div>
              </div>
            </div>
          )}

          {/* Morale history */}
          <div style={{ ...cardBox, marginBottom: '1rem' }}>
            <div style={h2}>📊 Morale History (last 20 weeks)</div>
            {morale.length === 0 ? (
              <div style={{ fontSize: '15px', color: '#cce0f5' }}>No weekly checks rolled yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #2e2e2e', color: '#5a5550', fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>Week</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #2e2e2e', color: '#5a5550', fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>Outcome</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #2e2e2e', color: '#5a5550', fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>Total</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #2e2e2e', color: '#5a5550', fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>Members</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #2e2e2e', color: '#5a5550', fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>Next Mood</th>
                  </tr>
                </thead>
                <tbody>
                  {morale.map((m, i) => {
                    const color = outcomeColor(m.outcome)
                    const delta = m.members_after - m.members_before
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1f1f1f' }}>
                        <td style={{ padding: '6px 8px', color: '#cce0f5' }}>{m.week_number}</td>
                        <td style={{ padding: '6px 8px', color, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{prettyOutcome(m.outcome)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#f5f2ee' }}>{m.total}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#cce0f5' }}>
                          {m.members_after}
                          {delta !== 0 && <span style={{ color: delta < 0 ? '#f5a89a' : '#7fc458' }}> ({delta > 0 ? '+' : ''}{delta})</span>}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: m.cmod_for_next > 0 ? '#7fc458' : m.cmod_for_next < 0 ? '#f5a89a' : '#cce0f5', fontWeight: 700 }}>{fmtCmod(m.cmod_for_next)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Resource history */}
          <div style={{ ...cardBox, marginBottom: '1rem' }}>
            <div style={h2}>🌾🔧 Resource History (last 40 rolls)</div>
            {resources.length === 0 ? (
              <div style={{ fontSize: '15px', color: '#cce0f5' }}>No resource checks yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px' }}>
                {resources.map((r, i) => {
                  const color = outcomeColor(r.outcome)
                  return (
                    <div key={i} style={{ padding: '6px 8px', background: '#1a1a1a', border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, borderRadius: '3px' }}>
                      <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {r.kind === 'fed' ? '🌾 Fed' : '🔧 Clothed'} · Wk {r.week_number}
                      </div>
                      <div style={{ fontSize: '15px', color, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{prettyOutcome(r.outcome)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Role distribution */}
          <div style={{ ...cardBox, marginBottom: '1rem' }}>
            <div style={h2}>👥 Current Role Distribution (NPC labor pool)</div>
            {roleDistribution.n === 0 ? (
              <div style={{ fontSize: '15px', color: '#cce0f5' }}>No NPC members.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { name: 'Gatherers', count: roleDistribution.gatherers, pct: roleDistribution.gatherPct, min: 33 },
                  { name: 'Maintainers', count: roleDistribution.maintainers, pct: roleDistribution.maintainPct, min: 20 },
                  { name: 'Safety', count: roleDistribution.safety, pct: roleDistribution.safetyPct, min: 5 },
                  { name: 'Unassigned', count: roleDistribution.unassigned, pct: roleDistribution.n > 0 ? Math.round(100 * roleDistribution.unassigned / roleDistribution.n) : 0, min: 0 },
                ].map(row => {
                  const ok = row.pct >= row.min
                  return (
                    <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                      <span style={{ width: '120px', color: '#cce0f5', letterSpacing: '.04em', textTransform: 'uppercase' }}>{row.name}</span>
                      <div style={{ flex: 1, height: '14px', background: '#0d0d0d', border: '1px solid #2e2e2e', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${Math.min(100, row.pct)}%`, height: '100%', background: row.min > 0 && !ok ? '#c0392b' : '#7fc458', transition: 'width 0.3s' }} />
                        {row.min > 0 && (
                          <div style={{ position: 'absolute', left: `${row.min}%`, top: 0, bottom: 0, width: '2px', background: '#EF9F27' }} title={`min ${row.min}%`} />
                        )}
                      </div>
                      <span style={{ width: '90px', textAlign: 'right', color: ok ? '#7fc458' : row.min > 0 ? '#c0392b' : '#cce0f5', fontWeight: 700 }}>{row.count} ({row.pct}%)</span>
                      <span style={{ width: '60px', textAlign: 'right', color: '#5a5550', fontSize: '13px' }}>{row.min > 0 ? `min ${row.min}%` : '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recruitment stats */}
          <div style={{ ...cardBox, marginBottom: '1rem' }}>
            <div style={h2}>🤝 Recruitment Stats</div>
            {recruitStats.total === 0 ? (
              <div style={{ fontSize: '15px', color: '#cce0f5' }}>No recruitment attempts logged for this community yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '10px 12px', background: '#0f1a2e', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
                  <div style={{ ...label, marginBottom: '4px' }}>Overall</div>
                  <div style={{ fontSize: '17px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                    {recruitStats.totalSuccess}/{recruitStats.total} ({recruitStats.successRate}%)
                  </div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {recruitStats.apprenticeSuccesses} became Apprentices
                  </div>
                </div>
                {(['cohort', 'conscript', 'convert'] as const).map(ap => {
                  const s = recruitStats.byApproach[ap]
                  const t = s.success + s.fail
                  const rate = t > 0 ? Math.round(100 * s.success / t) : 0
                  return (
                    <div key={ap} style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      <div style={{ ...label, marginBottom: '4px', textTransform: 'capitalize' }}>{ap}</div>
                      <div style={{ fontSize: '17px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                        {s.success}/{t} ({rate}%)
                      </div>
                      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {s.success} success · {s.fail} fail
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Member type breakdown */}
          <div style={cardBox}>
            <div style={h2}>Members by Recruitment Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
              {Object.entries(memberBreakdown).map(([type, count]) => (
                <div key={type} style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', textAlign: 'center' }}>
                  <div style={{ ...label, marginBottom: '4px', textTransform: 'capitalize' }}>{type}</div>
                  <div style={{ fontSize: '19px', color: count > 0 ? '#f5f2ee' : '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
