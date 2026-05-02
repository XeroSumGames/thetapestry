'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'

// /tools/campaign-explorer — Thriver-only oversight surface.
// Lists every campaign on the platform with the GM's username + counts
// for pins, NPCs, tactical scenes, handouts, and members. Sortable +
// filterable so the Thriver can audit who's building what without
// having to drop into each campaign by hand.
//
// RLS already gives Thrivers SELECT bypass on campaigns + the five
// related tables, so the queries here just trust that. If those
// policies tighten later, this tool would need a server-side route.

interface CampaignRow {
  id: string
  name: string
  setting: string | null
  description: string | null
  status: string | null
  session_status: string | null
  session_count: number | null
  created_at: string
  last_accessed_at: string | null
  gm_user_id: string
  gm_username: string
  members: number
  pins: number
  npcs: number
  scenes: number
  handouts: number
}

const panel: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }
const h1Style: React.CSSProperties = { fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '26px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', lineHeight: 1.1 }
const subLabel: React.CSSProperties = { fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }
const cellHeader: React.CSSProperties = { ...subLabel, textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #2e2e2e', cursor: 'pointer', userSelect: 'none' }
const cell: React.CSSProperties = { fontSize: '13px', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee', padding: '6px 8px', borderBottom: '1px solid #1a1a1a' }

type SortKey = 'name' | 'gm' | 'setting' | 'members' | 'pins' | 'npcs' | 'scenes' | 'handouts' | 'created' | 'last'

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

export default function CampaignExplorerPage() {
  const supabase = createClient()
  const [authChecked, setAuthChecked] = useState(false)
  const [isThriver, setIsThriver] = useState(false)
  const [rows, setRows] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('last')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [hideEmpty, setHideEmpty] = useState(false)

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { setAuthChecked(true); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const thriver = (profile?.role ?? '').toString().toLowerCase() === 'thriver'
      setIsThriver(thriver)
      setAuthChecked(true)
      if (thriver) void loadCampaigns()
    })()
  }, [])

  async function loadCampaigns() {
    setLoading(true)
    // Pull every campaign + GM lookup. Thriver bypass on campaigns RLS
    // means we get the full set; non-Thrivers wouldn't reach this page.
    const { data: camps } = await supabase
      .from('campaigns')
      .select('id, name, setting, description, status, session_status, session_count, created_at, last_accessed_at, gm_user_id')
      .order('created_at', { ascending: false })
    if (!camps || camps.length === 0) { setRows([]); setLoading(false); return }

    // Resolve GM usernames in one batched lookup.
    const gmIds = [...new Set((camps as any[]).map(c => c.gm_user_id).filter(Boolean))]
    const { data: profs } = await supabase.from('profiles').select('id, username').in('id', gmIds)
    const usernameById: Record<string, string> = {}
    for (const p of (profs ?? []) as any[]) usernameById[p.id] = p.username

    // Aggregate counts in parallel — five queries, one per related
    // table. Server-side count('*') with no head:true gives us the
    // count column per row group when paired with the .select pattern.
    const ids = (camps as any[]).map(c => c.id)
    const [memRows, pinRows, npcRows, sceneRows, handoutRows] = await Promise.all([
      supabase.from('campaign_members').select('campaign_id').in('campaign_id', ids).is('left_at', null),
      supabase.from('campaign_pins').select('campaign_id').in('campaign_id', ids),
      supabase.from('campaign_npcs').select('campaign_id').in('campaign_id', ids),
      supabase.from('tactical_scenes').select('campaign_id').in('campaign_id', ids),
      supabase.from('campaign_notes').select('campaign_id').in('campaign_id', ids),
    ])
    function countBy(rows: any): Record<string, number> {
      const map: Record<string, number> = {}
      for (const r of (rows.data ?? []) as any[]) map[r.campaign_id] = (map[r.campaign_id] ?? 0) + 1
      return map
    }
    const memC = countBy(memRows)
    const pinC = countBy(pinRows)
    const npcC = countBy(npcRows)
    const sceneC = countBy(sceneRows)
    const handoutC = countBy(handoutRows)

    setRows((camps as any[]).map(c => ({
      id: c.id, name: c.name, setting: c.setting, description: c.description,
      status: c.status, session_status: c.session_status,
      session_count: c.session_count,
      created_at: c.created_at, last_accessed_at: c.last_accessed_at,
      gm_user_id: c.gm_user_id,
      gm_username: usernameById[c.gm_user_id] ?? '?',
      members: memC[c.id] ?? 0,
      pins: pinC[c.id] ?? 0,
      npcs: npcC[c.id] ?? 0,
      scenes: sceneC[c.id] ?? 0,
      handouts: handoutC[c.id] ?? 0,
    })))
    setLoading(false)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'name' || key === 'gm' || key === 'setting' ? 'asc' : 'desc') }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rows
    if (q) {
      out = out.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.gm_username.toLowerCase().includes(q) ||
        (r.setting ?? '').toLowerCase().includes(q),
      )
    }
    if (hideEmpty) {
      out = out.filter(r => r.pins + r.npcs + r.scenes + r.handouts + r.members > 0)
    }
    out = [...out].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'name':     return dir * a.name.localeCompare(b.name)
        case 'gm':       return dir * a.gm_username.localeCompare(b.gm_username)
        case 'setting':  return dir * (a.setting ?? '').localeCompare(b.setting ?? '')
        case 'members':  return dir * (a.members - b.members)
        case 'pins':     return dir * (a.pins - b.pins)
        case 'npcs':     return dir * (a.npcs - b.npcs)
        case 'scenes':   return dir * (a.scenes - b.scenes)
        case 'handouts': return dir * (a.handouts - b.handouts)
        case 'created':  return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        case 'last':     return dir * (new Date(a.last_accessed_at ?? a.created_at).getTime() - new Date(b.last_accessed_at ?? b.created_at).getTime())
      }
    })
    return out
  }, [rows, search, sortKey, sortDir, hideEmpty])

  if (!authChecked) return null
  if (!isThriver) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#cce0f5', textAlign: 'center' }}>
      Thriver access only.
    </div>
  )

  const totals = filtered.reduce(
    (acc, r) => ({
      members: acc.members + r.members,
      pins: acc.pins + r.pins,
      npcs: acc.npcs + r.npcs,
      scenes: acc.scenes + r.scenes,
      handouts: acc.handouts + r.handouts,
    }),
    { members: 0, pins: 0, npcs: 0, scenes: 0, handouts: 0 },
  )

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      <div style={h1Style}>Campaign Explorer</div>

      <div style={panel}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, GM, or setting…"
            style={{ flex: '1 1 280px', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />
            Hide empty
          </label>
          <button onClick={() => void loadCampaigns()}
            style={{ padding: '8px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
        <div style={{ ...subLabel, marginTop: '10px', color: '#5a5550' }}>
          {filtered.length} of {rows.length} campaigns · {totals.members} members · {totals.pins} pins · {totals.npcs} NPCs · {totals.scenes} scenes · {totals.handouts} handouts
        </div>
      </div>

      <div style={{ ...panel, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Barlow, sans-serif', minWidth: '900px' }}>
          <thead>
            <tr>
              <SortHeader label="Campaign"  active={sortKey === 'name'}     dir={sortDir} onClick={() => toggleSort('name')}     />
              <SortHeader label="GM"        active={sortKey === 'gm'}       dir={sortDir} onClick={() => toggleSort('gm')}       />
              <SortHeader label="Setting"   active={sortKey === 'setting'}  dir={sortDir} onClick={() => toggleSort('setting')}  />
              <SortHeader label="Members"   active={sortKey === 'members'}  dir={sortDir} onClick={() => toggleSort('members')}  align="right" />
              <SortHeader label="Pins"      active={sortKey === 'pins'}     dir={sortDir} onClick={() => toggleSort('pins')}     align="right" />
              <SortHeader label="NPCs"      active={sortKey === 'npcs'}     dir={sortDir} onClick={() => toggleSort('npcs')}     align="right" />
              <SortHeader label="Scenes"    active={sortKey === 'scenes'}   dir={sortDir} onClick={() => toggleSort('scenes')}   align="right" />
              <SortHeader label="Handouts"  active={sortKey === 'handouts'} dir={sortDir} onClick={() => toggleSort('handouts')} align="right" />
              <SortHeader label="Created"   active={sortKey === 'created'}  dir={sortDir} onClick={() => toggleSort('created')}  align="right" />
              <SortHeader label="Last Run"  active={sortKey === 'last'}     dir={sortDir} onClick={() => toggleSort('last')}     align="right" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{ ...cell, fontWeight: 700 }}>
                  <Link href={`/stories/${r.id}/table`} style={{ color: '#f5f2ee', textDecoration: 'none' }}>
                    {r.name}
                  </Link>
                </td>
                <td style={{ ...cell, color: '#cce0f5' }}>{r.gm_username}</td>
                <td style={{ ...cell, color: '#cce0f5' }}>{r.setting ?? '—'}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.members}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.pins}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.npcs}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.scenes}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.handouts}</td>
                <td style={{ ...cell, textAlign: 'right', color: '#cce0f5' }} title={new Date(r.created_at).toLocaleString()}>{fmtRelative(r.created_at)}</td>
                <td style={{ ...cell, textAlign: 'right', color: '#cce0f5' }} title={r.last_accessed_at ? new Date(r.last_accessed_at).toLocaleString() : 'never'}>{fmtRelative(r.last_accessed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && !loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            No campaigns match the filter.
          </div>
        )}
      </div>
    </div>
  )
}

function SortHeader({ label, active, dir, onClick, align = 'left' }: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th
      onClick={onClick}
      style={{ ...cellHeader, textAlign: align, color: active ? '#f5f2ee' : '#cce0f5', borderBottom: active ? '1px solid #c0392b' : '1px solid #2e2e2e' }}>
      {label}{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  )
}
