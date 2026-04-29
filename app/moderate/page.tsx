'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

interface Pin {
  id: string
  user_id: string
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: string
  status: string
  created_at: string
  profiles?: { username: string }
  attachments?: string[]
}

interface Profile {
  id: string
  username: string
  email: string
  role: string
  created_at: string
  suspended: boolean
}

function actionBtn(borderColor: string, color: string): React.CSSProperties {
  return {
    // Tightened from '6px 14px' → '5px 10px' so the whole user-row
    // button stack (Make Thriver / Characters / Suspend / Delete)
    // fits on a single line without wrapping. Paired with nowrap on
    // the container (line ~411) and minWidth:0 on the left column.
    padding: '5px 10px', background: 'none',
    border: `1px solid ${borderColor}`, borderRadius: '3px',
    color, fontSize: '13px', cursor: 'pointer',
    fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

const navLink: React.CSSProperties = {
  padding: '5px 12px', background: '#242424',
  border: '1px solid #3a3a3a', borderRadius: '3px',
  color: '#f5f2ee', fontSize: '13px',
  fontFamily: 'Barlow Condensed, sans-serif',
  letterSpacing: '.06em', textTransform: 'uppercase',
  textDecoration: 'none',
}

export default function ModerationPage() {
  const [section, setSection] = useState<'rumors' | 'users' | 'npcs' | 'communities' | 'modules'>('users')
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [acting, setActing] = useState<string | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [worldNpcs, setWorldNpcs] = useState<any[]>([])
  const [npcsLoading, setNpcsLoading] = useState(false)
  // Phase E Sprint 2 — world_communities moderation queue. Same
  // shape as world_npcs: pending / approved / rejected via the
  // shared filter state. Approve writes moderation_status +
  // approved_by + approved_at per the world_communities RLS.
  const [worldCommunities, setWorldCommunities] = useState<any[]>([])
  const [communitiesLoading, setCommunitiesLoading] = useState(false)
  const [modules, setModules] = useState<any[]>([])
  const [modulesLoading, setModulesLoading] = useState(false)
  // Role check — all four queues on this page are gated by an RLS
  // policy that requires profiles.role = 'thriver'. Non-Thrivers see
  // 0 rows silently, which is a trap. We pull the role once on mount
  // and render a banner when it's not 'thriver'.
  const [myRole, setMyRole] = useState<string | null>(null)
  const [roleChecked, setRoleChecked] = useState(false)
  // Pending counts per queue so the tab buttons can light up green
  // when there's something waiting. Users counts "new in last 7
  // days" (no moderation status concept there); rumors / npcs /
  // communities count actual pending rows.
  const [pendingCounts, setPendingCounts] = useState<{ users: number; rumors: number; npcs: number; communities: number; modules: number }>({ users: 0, rumors: 0, npcs: 0, communities: 0, modules: 0 })
  const router = useRouter()
  const supabase = createClient()

  async function loadPendingCounts() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [rumorsRes, npcsRes, commsRes, usersRes, modulesRes] = await Promise.all([
      supabase.from('map_pins').select('id', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending'),
      supabase.from('world_npcs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('world_communities').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabase.from('modules').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending').eq('visibility', 'listed'),
    ])
    setPendingCounts({
      rumors: rumorsRes.count ?? 0,
      npcs: npcsRes.count ?? 0,
      communities: commsRes.count ?? 0,
      users: usersRes.count ?? 0,
      modules: modulesRes.count ?? 0,
    })
  }

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      // Cache role for the banner gate. Not a hard block — the page
      // still loads so the user can see the empty state alongside
      // the banner, but at least they know why.
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      setMyRole((prof as any)?.role ?? null)
      setRoleChecked(true)
      if (((prof as any)?.role ?? '').toLowerCase() === 'thriver') {
        loadPendingCounts()
      }
      load()
    }
    check()
  }, [filter])

  const isThriver = typeof myRole === 'string' && myRole.toLowerCase() === 'thriver'

  useEffect(() => {
    if (section === 'users') loadUsers()
    if (section === 'npcs') loadWorldNpcs()
    if (section === 'communities') loadWorldCommunities()
    if (section === 'modules') loadModules()
  }, [section, filter])

  async function loadWorldNpcs() {
    setNpcsLoading(true)
    const { data } = await supabase.from('world_npcs').select('*, profiles:created_by(username)').eq('status', 'pending').order('created_at', { ascending: false })
    setWorldNpcs(data ?? [])
    setNpcsLoading(false)
  }

  async function handleNpcAction(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('world_npcs').update({ status, approved_by: user?.id ?? null, approved_at: new Date().toISOString() }).eq('id', id)
    setWorldNpcs(prev => prev.filter(n => n.id !== id))
    setActing(null)
  }

  async function loadWorldCommunities() {
    setCommunitiesLoading(true)
    // Plain fetch — the previous embed-join syntax
    // `publisher:published_by(username)` fails silently because
    // published_by FKs into `auth.users`, which has no `username`
    // column and isn't traversable from PostgREST. Count queries
    // happened to work (no join), which is why the tab lit up with
    // a "1" badge while the list stayed empty. Do a two-step
    // hydration instead — plain SELECT, then batched lookups for
    // publisher username + source campaign name.
    const { data, error } = await supabase
      .from('world_communities')
      .select('*')
      .eq('moderation_status', filter)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[moderate/communities] load failed:', error)
      setWorldCommunities([])
      setCommunitiesLoading(false)
      return
    }
    const rows = data ?? []
    const userIds = Array.from(new Set(rows.map((r: any) => r.published_by).filter(Boolean)))
    const campaignIds = Array.from(new Set(rows.map((r: any) => r.source_campaign_id).filter(Boolean)))
    const [profilesRes, campaignsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('profiles').select('id, username').in('id', userIds)
        : Promise.resolve({ data: [] as any[], error: null as any }),
      campaignIds.length > 0
        ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ])
    const userMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]))
    const campMap = new Map((campaignsRes.data ?? []).map((c: any) => [c.id, c]))
    setWorldCommunities(rows.map((r: any) => ({
      ...r,
      publisher: userMap.get(r.published_by) ?? null,
      campaigns: campMap.get(r.source_campaign_id) ?? null,
    })))
    setCommunitiesLoading(false)
  }

  async function handleCommunityAction(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('world_communities').update({
      moderation_status: status,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert(`Moderation action failed: ${error.message}`); setActing(null); return }
    // Match the NPC pattern — drop the row from this filter's list so
    // the queue shortens immediately. Switching filter tabs re-fetches.
    setWorldCommunities(prev => prev.filter(c => c.id !== id))
    setActing(null)
  }

  async function handleCommunityDelete(id: string) {
    if (!confirm('Permanently delete this world_communities row? The source campaign community stays intact. Use this to force an unpublish.')) return
    setActing(id)
    const { error } = await supabase.from('world_communities').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); setActing(null); return }
    setWorldCommunities(prev => prev.filter(c => c.id !== id))
    setActing(null)
  }

  async function loadModules() {
    setModulesLoading(true)
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('moderation_status', filter)
      .eq('visibility', 'listed')
      .order('created_at', { ascending: false })
    if (error) { setModulesLoading(false); return }
    // Hydrate author usernames via profiles
    const authorIds = [...new Set((data ?? []).map((m: any) => m.author_user_id).filter(Boolean))]
    let profileMap: Record<string, string> = {}
    if (authorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', authorIds)
      profileMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
    }
    setModules((data ?? []).map((m: any) => ({ ...m, author_username: profileMap[m.author_user_id] ?? 'unknown' })))
    setModulesLoading(false)
  }

  async function handleModuleAction(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    const mod = modules.find(m => m.id === id)
    const { error } = await supabase.from('modules').update({
      moderation_status: status,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert(`Moderation action failed: ${error.message}`); setActing(null); return }
    // Lock all versions as a platform copy when approving.
    if (status === 'approved') {
      await supabase
        .from('module_versions')
        .update({ platform_locked_at: new Date().toISOString() })
        .eq('module_id', id)
        .is('platform_locked_at', null)
    }
    // Notify the author
    if (mod?.author_user_id) {
      await supabase.from('notifications').insert({
        user_id: mod.author_user_id,
        type: status === 'approved' ? 'module_approved' : 'module_rejected',
        title: status === 'approved' ? 'Module approved' : 'Module rejected',
        body: status === 'approved'
          ? `Your module "${mod.name}" has been approved and is now listed.`
          : `Your module "${mod.name}" was not approved. You can edit and re-submit.`,
        metadata: { module_id: id, module_name: mod.name },
      })
    }
    setModules(prev => prev.filter(m => m.id !== id))
    setActing(null)
  }

  async function load() {
    setLoading(true)
    const { data: rawData } = await supabase
      .from('map_pins')
      .select('*, profiles!map_pins_user_id_fkey(username)')
      .eq('pin_type', 'rumor')
      .eq('status', filter)
      .order('created_at', { ascending: false })

    const withAttachments = await Promise.all((rawData ?? []).map(async (pin: any) => {
      const { data: files } = await supabase.storage
        .from('pin-attachments')
        .list(`${pin.user_id}/${pin.id}`)
      return { ...pin, attachments: files?.map((f: any) => f.name) ?? [] }
    }))
    setPins(withAttachments)
    setLoading(false)
  }

  async function loadUsers() {
    setUsersLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setUsersLoading(false)
  }

  async function handleRoleChange(id: string, newRole: 'Survivor' | 'Thriver') {
    setActing(id)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    if (error) {
      alert(`Failed to update role: ${error.message}`)
    } else {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
    }
    setActing(null)
  }

  async function handleSuspend(id: string, suspended: boolean) {
    setActing(id)
    await supabase.from('profiles').update({ suspended }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, suspended } : u))
    setActing(null)
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Permanently delete this account? This cannot be undone.')) return
    setActing(id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ user_id: id, caller_id: user?.id }),
      })
      const result = await res.json()
      if (!res.ok) { alert(result.error || 'Failed to delete user'); return }
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err: any) {
      alert('Failed to delete user: ' + (err?.message || String(err)))
    } finally {
      setActing(null)
    }
  }

  async function handleAction(id: string, action: 'approved' | 'rejected') {
    setActing(id)
    await supabase.from('map_pins').update({ status: action }).eq('id', id)
    setPins(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }

  async function handleDelete(id: string) {
    setActing(id)
    await supabase.from('map_pins').delete().eq('id', id)
    setPins(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Moderation
        </div>
        <div style={{ fontSize: '13px', color: '#d4cfc9', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          Thriver Console
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/map" style={navLink}>Map</Link>
      </div>

      {/* Thriver-only gate. Non-Thrivers get a single compact banner
          and nothing else — no empty queues to rummage through, no
          tab strip, no page contents. Suppressed until roleChecked
          flips so we don't flash the banner during the profile
          fetch. */}
      {roleChecked && !isThriver && (
        <div style={{ padding: '14px 18px', background: '#2a1210', border: '1px solid #c0392b', borderLeft: '3px solid #c0392b', borderRadius: '4px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>
          ⚠ Thriver-only page
        </div>
      )}

      {roleChecked && isThriver && (<>

      {/* Section tabs. Green outline when the queue has pending work:
          rumors / npcs / communities gate on actual pending rows,
          users counts "new signups in last 7 days" since it has no
          moderation status concept. Green supersedes the active-red
          only when the tab isn't currently selected — the selected
          tab keeps its red accent so the user can tell where they
          are. Count badge appears next to the label. */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['users', 'rumors', 'npcs', 'communities', 'modules'] as const).map(s => {
          const count = pendingCounts[s]
          const hasPending = count > 0
          const isActive = section === s
          const borderColor = isActive ? '#c0392b' : (hasPending ? '#2d5a1b' : '#3a3a3a')
          const color = isActive ? '#f5a89a' : (hasPending ? '#7fc458' : '#d4cfc9')
          const label = s === 'rumors' ? 'Rumor Queue' : s === 'users' ? 'Users' : s === 'npcs' ? 'NPCs' : s === 'communities' ? '🌐 Communities' : '📦 Modules'
          return (
            <button key={s} onClick={() => setSection(s)} style={{
              padding: '7px 16px',
              border: `1px solid ${borderColor}`,
              background: isActive ? '#2a1210' : (hasPending ? '#0f1a0f' : '#242424'),
              color,
              borderRadius: '3px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '.06em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span>{label}</span>
              {hasPending && (
                <span style={{ fontSize: '13px', padding: '1px 6px', borderRadius: '10px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontWeight: 700 }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── RUMORS ── */}
      {section === 'rumors' && (
        <>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '7px 16px',
                border: `1px solid ${filter === f ? '#c0392b' : '#3a3a3a'}`,
                background: filter === f ? '#2a1210' : '#242424',
                color: filter === f ? '#f5a89a' : '#d4cfc9',
                borderRadius: '3px', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '.06em', textTransform: 'uppercase',
              }}>
                {f}
              </button>
            ))}
          </div>

          {loading && <div style={{ color: '#d4cfc9', fontSize: '13px' }}>Loading...</div>}

          {!loading && pins.length === 0 && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
              No {filter} rumors.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pins.map(p => (
              <div key={p.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #EF9F27', borderRadius: '4px', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>
                      Submitted by {p.profiles?.username ?? 'unknown'} &mdash; {formatDate(p.created_at)}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'monospace' }}>
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                  </div>
                </div>

                {p.notes && (
                  <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a' }}>
                    {p.notes}
                  </div>
                )}

                {p.attachments && p.attachments.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    {p.attachments.map((name: string) => (
                      <div key={name} style={{ fontSize: '13px', color: '#7ab3d4', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                        <span style={{ opacity: 0.7 }}>📎</span>
                        <span>Uploaded file: {name}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px' }}>
                  {filter === 'pending' && (
                    <>
                      <button onClick={() => handleAction(p.id, 'approved')} disabled={acting === p.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                      <button onClick={() => handleAction(p.id, 'rejected')} disabled={acting === p.id} style={actionBtn('#7a1f16', '#f5a89a')}>Reject</button>
                    </>
                  )}
                  {filter === 'approved' && (
                    <button onClick={() => handleAction(p.id, 'rejected')} disabled={acting === p.id} style={actionBtn('#7a1f16', '#f5a89a')}>Revoke</button>
                  )}
                  {filter === 'rejected' && (
                    <button onClick={() => handleAction(p.id, 'approved')} disabled={acting === p.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                  )}
                  <button onClick={() => handleDelete(p.id)} disabled={acting === p.id} style={actionBtn('#2e2e2e', '#cce0f5')}>Delete</button>
                  <Link href={`/map?flyTo=${p.lat},${p.lng}`}
                    style={{ ...actionBtn('#1a3a5c', '#7ab3d4'), textDecoration: 'none', display: 'inline-block' }}
                    title="Open the in-app world map centered on this pin">
                    View on map
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── USERS ── */}
      {section === 'users' && (
        <>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>{users.length} registered user{users.length !== 1 ? 's' : ''}</span>
            {users.length > 0 && (
              <a href={`mailto:?bcc=${users.map(u => u.email).filter(Boolean).join(',')}`}
                style={{ padding: '3px 10px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer' }}>
                Email All Users
              </a>
            )}
          </div>

          {usersLoading && <div style={{ color: '#d4cfc9', fontSize: '13px' }}>Loading...</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {users.map(u => (
              <div key={u.id} style={{
                background: '#1a1a1a', border: '1px solid #2e2e2e',
                borderLeft: `3px solid ${u.role?.toLowerCase() === 'thriver' ? '#c0392b' : '#3a3a3a'}`,
                borderRadius: '4px', padding: '10px 1.25rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.username}
                    {u.email && <span style={{ color: '#cce0f5', fontWeight: 400, marginLeft: '6px', fontSize: '14px' }}>({u.email})</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Joined {formatDate(u.created_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                  {u.suspended && (
                    <span style={{ fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px', background: '#2a1a00', color: '#EF9F27', border: '1px solid #EF9F27' }}>
                      Suspended
                    </span>
                  )}
                  <span style={{
                    fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif',
                    letterSpacing: '.08em', textTransform: 'uppercase',
                    padding: '3px 8px', borderRadius: '2px',
                    background: u.role?.toLowerCase() === 'thriver' ? '#2a1210' : '#1a1a2e',
                    color: u.role?.toLowerCase() === 'thriver' ? '#f5a89a' : '#7ab3d4',
                    border: `1px solid ${u.role?.toLowerCase() === 'thriver' ? '#c0392b' : '#2e2e5a'}`,
                  }}>
                    {u.role}
                  </span>
                  {u.role?.toLowerCase() === 'thriver' ? (
                    <button onClick={() => handleRoleChange(u.id, 'Survivor')} disabled={acting === u.id} style={actionBtn('#3a3a3a', '#d4cfc9')}>
                      Make Survivor
                    </button>
                  ) : (
                    <button onClick={() => handleRoleChange(u.id, 'Thriver')} disabled={acting === u.id} style={actionBtn('#c0392b', '#f5a89a')}>
                      Make Thriver
                    </button>
                  )}
                  <Link href={`/moderate/users/${u.id}/characters`} style={{ ...actionBtn('#1a3a5c', '#7ab3d4'), textDecoration: 'none', textAlign: 'center' }}>
                    Characters
                  </Link>
                  <button onClick={() => handleSuspend(u.id, !u.suspended)} disabled={acting === u.id}
                    style={actionBtn(u.suspended ? '#2d5a1b' : '#5a3a00', u.suspended ? '#7fc458' : '#EF9F27')}>
                    {u.suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                  <button onClick={() => handleDeleteUser(u.id)} disabled={acting === u.id} style={actionBtn('#7a1f16', '#f5a89a')}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* World NPCs moderation */}
      {section === 'npcs' && (
        <>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem' }}>
            {npcsLoading ? 'Loading...' : `${worldNpcs.length} pending NPC${worldNpcs.length !== 1 ? 's' : ''}`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {worldNpcs.map(npc => (
              <div key={npc.id} style={{ padding: '12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {npc.portrait_url ? <img src={npc.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</div>
                    <div style={{ fontSize: '13px', color: '#cce0f5' }}>
                      by {(npc.profiles as any)?.username ?? 'Unknown'} &middot; {formatDate(npc.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {npc.npc_type && <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
                    {npc.setting && <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{npc.setting === 'district_zero' ? 'District Zero' : npc.setting === 'chased' ? 'Chased' : 'Custom'}</span>}
                  </div>
                </div>
                {npc.public_description && (
                  <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '8px', lineHeight: 1.5 }}>{npc.public_description}</div>
                )}
                <div style={{ display: 'flex', gap: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>
                  {['RSN', 'ACU', 'PHY', 'INF', 'DEX'].map((attr, i) => {
                    const vals = [npc.reason, npc.acumen, npc.physicality, npc.influence, npc.dexterity]
                    return <span key={attr}>{attr} {vals[i] > 0 ? `+${vals[i]}` : vals[i]}</span>
                  })}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleNpcAction(npc.id, 'approved')} disabled={acting === npc.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                  <button onClick={() => handleNpcAction(npc.id, 'rejected')} disabled={acting === npc.id} style={actionBtn('#7a1f16', '#f5a89a')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── WORLD COMMUNITIES (Phase E Sprint 2) ── */}
      {section === 'communities' && (
        <>
          {/* Filter — pending / approved / rejected. Same control as
              the rumor queue; re-uses the shared `filter` state. */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '7px 16px',
                border: `1px solid ${filter === f ? '#c0392b' : '#3a3a3a'}`,
                background: filter === f ? '#2a1210' : '#242424',
                color: filter === f ? '#f5a89a' : '#d4cfc9',
                borderRadius: '3px', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '.06em', textTransform: 'uppercase',
              }}>
                {f}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem' }}>
            {communitiesLoading ? 'Loading...' : `${worldCommunities.length} ${filter} communit${worldCommunities.length === 1 ? 'y' : 'ies'}`}
          </div>

          {!communitiesLoading && worldCommunities.length === 0 && (
            <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
              No {filter} communities.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {worldCommunities.map(wc => {
              const hasCoords = wc.homestead_lat != null && wc.homestead_lng != null
              const publisherName = (wc.publisher as any)?.username ?? 'unknown'
              const sourceCampaignName = (wc.campaigns as any)?.name ?? 'unknown campaign'
              return (
                <div key={wc.id} style={{ padding: '14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${filter === 'approved' ? '#7fc458' : filter === 'rejected' ? '#c0392b' : '#d48bd4'}`, borderRadius: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '19px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        🌐 {wc.name}
                      </div>
                      <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>
                        Published by <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{publisherName}</span> {wc.created_at ? `on ${formatDate(wc.created_at)}` : ''} · from <span style={{ color: '#EF9F27' }}>{sourceCampaignName}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{wc.size_band}</span>
                      <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#1a2010', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{wc.community_status}</span>
                      {wc.faction_label && (
                        <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{wc.faction_label}</span>
                      )}
                    </div>
                  </div>

                  {wc.description && (
                    <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a' }}>
                      {wc.description}
                    </div>
                  )}

                  <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    <span>
                      <span style={{ color: '#5a5550', letterSpacing: '.06em', textTransform: 'uppercase' }}>Homestead:</span>{' '}
                      {hasCoords
                        ? <span style={{ fontFamily: 'monospace', color: '#f5f2ee' }}>{wc.homestead_lat.toFixed(4)}, {wc.homestead_lng.toFixed(4)}</span>
                        : <span style={{ color: '#EF9F27' }}>unlocated — won't appear on the world map</span>}
                    </span>
                    <span>
                      <span style={{ color: '#5a5550', letterSpacing: '.06em', textTransform: 'uppercase' }}>Last update:</span>{' '}
                      <span style={{ color: '#f5f2ee' }}>{wc.last_public_update_at ? formatDate(wc.last_public_update_at) : '—'}</span>
                    </span>
                  </div>

                  {wc.moderator_notes && (
                    <div style={{ fontSize: '13px', color: '#f5a89a', marginBottom: '8px', padding: '6px 8px', background: '#2a1010', borderRadius: '3px', border: '1px solid #c0392b' }}>
                      <span style={{ color: '#5a5550', letterSpacing: '.06em', textTransform: 'uppercase' }}>Moderator notes:</span> {wc.moderator_notes}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {filter === 'pending' && (
                      <>
                        <button onClick={() => handleCommunityAction(wc.id, 'approved')} disabled={acting === wc.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                        <button onClick={() => handleCommunityAction(wc.id, 'rejected')} disabled={acting === wc.id} style={actionBtn('#7a1f16', '#f5a89a')}>Reject</button>
                      </>
                    )}
                    {filter === 'approved' && (
                      <button onClick={() => handleCommunityAction(wc.id, 'rejected')} disabled={acting === wc.id} style={actionBtn('#7a1f16', '#f5a89a')}>Revoke</button>
                    )}
                    {filter === 'rejected' && (
                      <button onClick={() => handleCommunityAction(wc.id, 'approved')} disabled={acting === wc.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                    )}
                    <button onClick={() => handleCommunityDelete(wc.id)} disabled={acting === wc.id} style={actionBtn('#2e2e2e', '#cce0f5')}>Delete</button>
                    {hasCoords && (
                      <Link href={`/map?flyTo=${wc.homestead_lat},${wc.homestead_lng}`}
                        style={{ ...actionBtn('#1a3a5c', '#7ab3d4'), textDecoration: 'none', display: 'inline-block' }}
                        title="Open the in-app world map centered on this community's Homestead">
                        View on map
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── MODULES ── */}
      {section === 'modules' && (
        <>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '7px 16px', border: `1px solid ${filter === f ? '#c0392b' : '#3a3a3a'}`,
                background: filter === f ? '#2a1210' : '#242424', color: filter === f ? '#f5a89a' : '#d4cfc9',
                borderRadius: '3px', cursor: 'pointer', fontSize: '13px',
                fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
              }}>{f}</button>
            ))}
          </div>

          {modulesLoading && <div style={{ color: '#5a5550', fontSize: '13px' }}>Loading…</div>}
          {!modulesLoading && modules.length === 0 && (
            <div style={{ color: '#5a5550', fontSize: '13px', fontStyle: 'italic' }}>
              No {filter} modules.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {modules.map(m => (
              <div key={m.id} style={{ padding: '14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${filter === 'approved' ? '#7fc458' : filter === 'rejected' ? '#c0392b' : '#8b5cf6'}`, borderRadius: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '19px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      📦 {m.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>
                      By <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{m.author_username}</span>{m.created_at ? ` · submitted ${formatDate(m.created_at)}` : ''}
                      {m.parent_setting && m.parent_setting !== 'custom' && (
                        <span style={{ marginLeft: '8px', color: '#EF9F27' }}>· {m.parent_setting}</span>
                      )}
                    </div>
                  </div>
                  {m.tagline && (
                    <div style={{ fontSize: '13px', color: '#c4a7f0', fontStyle: 'italic' }}>{m.tagline}</div>
                  )}
                </div>

                {m.description && (
                  <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a' }}>
                    {m.description}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {filter === 'pending' && (
                    <>
                      <button onClick={() => handleModuleAction(m.id, 'approved')} disabled={acting === m.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                      <button onClick={() => handleModuleAction(m.id, 'rejected')} disabled={acting === m.id} style={actionBtn('#7a1f16', '#f5a89a')}>Reject</button>
                    </>
                  )}
                  {filter === 'approved' && (
                    <button onClick={() => handleModuleAction(m.id, 'rejected')} disabled={acting === m.id} style={actionBtn('#7a1f16', '#f5a89a')}>Revoke</button>
                  )}
                  {filter === 'rejected' && (
                    <button onClick={() => handleModuleAction(m.id, 'approved')} disabled={acting === m.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      </>)}

    </div>
  )
}
