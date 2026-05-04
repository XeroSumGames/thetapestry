'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
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
  // Legacy boolean — pre-2026-05-04 schema had a `suspended` flag.
  // The current column is `suspended_until` (timestamptz) which
  // RLS predicates check; this stays optional for back-compat reads.
  suspended?: boolean
  suspended_until: string | null
  suspended_reason: string | null
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
    fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

const navLink: React.CSSProperties = {
  padding: '5px 12px', background: '#242424',
  border: '1px solid #3a3a3a', borderRadius: '3px',
  color: '#f5f2ee', fontSize: '13px',
  fontFamily: 'Carlito, sans-serif',
  letterSpacing: '.06em', textTransform: 'uppercase',
  textDecoration: 'none',
}

export default function ModerationPage() {
  const [section, setSection] = useState<'rumors' | 'users' | 'npcs' | 'communities' | 'modules' | 'forums' | 'warstories' | 'lfg' | 'bugs'>('users')
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
  // Phase 4B — three new Campfire moderation queues. Same shape as
  // world_communities: text moderation_status with pending/approved/
  // rejected, approve writes approved_by + approved_at. RLS for all
  // three tables lets thrivers SELECT/UPDATE.
  const [forumThreads, setForumThreads] = useState<any[]>([])
  const [forumsLoading, setForumsLoading] = useState(false)
  const [warStories, setWarStories] = useState<any[]>([])
  const [warStoriesLoading, setWarStoriesLoading] = useState(false)
  const [lfgPosts, setLfgPosts] = useState<any[]>([])
  const [lfgLoading, setLfgLoading] = useState(false)
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
  const [pendingCounts, setPendingCounts] = useState<{ users: number; rumors: number; npcs: number; communities: number; modules: number; forums: number; warstories: number; lfg: number; bugs: number }>({ users: 0, rumors: 0, npcs: 0, communities: 0, modules: 0, forums: 0, warstories: 0, lfg: 0, bugs: 0 })
  const [bugs, setBugs] = useState<any[]>([])
  const [bugsLoading, setBugsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function loadPendingCounts() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [rumorsRes, npcsRes, commsRes, usersRes, modulesRes, forumsRes, warstoriesRes, lfgRes, bugsRes] = await Promise.all([
      supabase.from('map_pins').select('id', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending'),
      supabase.from('world_npcs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('world_communities').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabase.from('modules').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending').eq('visibility', 'listed'),
      supabase.from('forum_threads').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('war_stories').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('lfg_posts').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ])
    setPendingCounts({
      rumors: rumorsRes.count ?? 0,
      npcs: npcsRes.count ?? 0,
      communities: commsRes.count ?? 0,
      users: usersRes.count ?? 0,
      modules: modulesRes.count ?? 0,
      forums: forumsRes.count ?? 0,
      warstories: warstoriesRes.count ?? 0,
      lfg: lfgRes.count ?? 0,
      bugs: bugsRes.count ?? 0,
    })
  }

  async function loadBugs() {
    setBugsLoading(true)
    const { data } = await supabase
      .from('bug_reports')
      .select('id, reporter_id, reporter_email, reporter_name, page_url, description, user_agent, status, thriver_notes, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setBugs(data ?? [])
    setBugsLoading(false)
  }

  async function setBugStatus(bugId: string, nextStatus: 'open' | 'triaged' | 'fixed' | 'wontfix') {
    await supabase.from('bug_reports').update({ status: nextStatus }).eq('id', bugId)
    setBugs(prev => prev.map(b => b.id === bugId ? { ...b, status: nextStatus } : b))
    void loadPendingCounts()
  }

  useEffect(() => {
    async function check() {
      const { user } = await getCachedAuth()
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
    if (section === 'forums') loadForumThreads()
    if (section === 'warstories') loadWarStories()
    if (section === 'lfg') loadLfgPosts()
    if (section === 'bugs') loadBugs()
  }, [section, filter])

  async function loadWorldNpcs() {
    setNpcsLoading(true)
    const { data } = await supabase.from('world_npcs').select('*, profiles:created_by(username)').eq('status', 'pending').order('created_at', { ascending: false })
    setWorldNpcs(data ?? [])
    setNpcsLoading(false)
  }

  async function handleNpcAction(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    const { user } = await getCachedAuth()
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
    const { user } = await getCachedAuth()
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
    const { user } = await getCachedAuth()
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

  // ── Phase 4B: Campfire moderation loaders ─────────────────────────
  // Each loader does a plain SELECT (no embed-join) plus a single
  // batched profiles lookup for author usernames. Mirrors the
  // world_communities pattern in this same file. Filter is the shared
  // pending/approved/rejected state.

  async function loadForumThreads() {
    setForumsLoading(true)
    const { data, error } = await supabase
      .from('forum_threads')
      .select('*')
      .eq('moderation_status', filter)
      .order('created_at', { ascending: false })
    if (error) { setForumsLoading(false); setForumThreads([]); return }
    const rows = data ?? []
    const authorIds = Array.from(new Set(rows.map((r: any) => r.author_user_id).filter(Boolean)))
    const campaignIds = Array.from(new Set(rows.map((r: any) => r.campaign_id).filter(Boolean)))
    const [profsRes, campsRes] = await Promise.all([
      authorIds.length > 0 ? supabase.from('profiles').select('id, username').in('id', authorIds) : Promise.resolve({ data: [] }),
      campaignIds.length > 0 ? supabase.from('campaigns').select('id, name').in('id', campaignIds) : Promise.resolve({ data: [] }),
    ])
    const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.username]))
    const campMap = new Map((campsRes.data ?? []).map((c: any) => [c.id, c.name]))
    setForumThreads(rows.map((r: any) => ({
      ...r,
      author_username: profMap.get(r.author_user_id) ?? 'unknown',
      campaign_name: r.campaign_id ? campMap.get(r.campaign_id) ?? null : null,
    })))
    setForumsLoading(false)
  }

  async function handleForumAction(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    const { user } = await getCachedAuth()
    const { error } = await supabase.from('forum_threads').update({
      moderation_status: status,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert(`Moderation action failed: ${error.message}`); setActing(null); return }
    setForumThreads(prev => prev.filter(t => t.id !== id))
    setActing(null)
  }

  async function handleForumDelete(id: string) {
    if (!confirm('Permanently delete this thread? This also removes all replies.')) return
    setActing(id)
    const { error } = await supabase.from('forum_threads').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); setActing(null); return }
    setForumThreads(prev => prev.filter(t => t.id !== id))
    setActing(null)
  }

  async function loadWarStories() {
    setWarStoriesLoading(true)
    const { data, error } = await supabase
      .from('war_stories')
      .select('*')
      .eq('moderation_status', filter)
      .order('created_at', { ascending: false })
    if (error) { setWarStoriesLoading(false); setWarStories([]); return }
    const rows = data ?? []
    const authorIds = Array.from(new Set(rows.map((r: any) => r.author_user_id).filter(Boolean)))
    const campaignIds = Array.from(new Set(rows.map((r: any) => r.campaign_id).filter(Boolean)))
    const [profsRes, campsRes] = await Promise.all([
      authorIds.length > 0 ? supabase.from('profiles').select('id, username').in('id', authorIds) : Promise.resolve({ data: [] }),
      campaignIds.length > 0 ? supabase.from('campaigns').select('id, name').in('id', campaignIds) : Promise.resolve({ data: [] }),
    ])
    const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.username]))
    const campMap = new Map((campsRes.data ?? []).map((c: any) => [c.id, c.name]))
    setWarStories(rows.map((r: any) => ({
      ...r,
      author_username: profMap.get(r.author_user_id) ?? 'unknown',
      campaign_name: r.campaign_id ? campMap.get(r.campaign_id) ?? null : null,
    })))
    setWarStoriesLoading(false)
  }

  async function handleWarStoryAction(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    const { user } = await getCachedAuth()
    const { error } = await supabase.from('war_stories').update({
      moderation_status: status,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert(`Moderation action failed: ${error.message}`); setActing(null); return }
    setWarStories(prev => prev.filter(s => s.id !== id))
    setActing(null)
  }

  async function handleWarStoryDelete(id: string) {
    if (!confirm('Permanently delete this story? Attachments are NOT auto-cleaned (manual S3 cleanup if needed).')) return
    setActing(id)
    const { error } = await supabase.from('war_stories').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); setActing(null); return }
    setWarStories(prev => prev.filter(s => s.id !== id))
    setActing(null)
  }

  async function loadLfgPosts() {
    setLfgLoading(true)
    const { data, error } = await supabase
      .from('lfg_posts')
      .select('*')
      .eq('moderation_status', filter)
      .order('created_at', { ascending: false })
    if (error) { setLfgLoading(false); setLfgPosts([]); return }
    const rows = data ?? []
    const authorIds = Array.from(new Set(rows.map((r: any) => r.author_user_id).filter(Boolean)))
    const profsRes = authorIds.length > 0
      ? await supabase.from('profiles').select('id, username').in('id', authorIds)
      : { data: [] as any[] }
    const profMap = new Map((profsRes.data ?? []).map((p: any) => [p.id, p.username]))
    setLfgPosts(rows.map((r: any) => ({
      ...r,
      author_username: profMap.get(r.author_user_id) ?? 'unknown',
    })))
    setLfgLoading(false)
  }

  async function handleLfgAction(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    const { user } = await getCachedAuth()
    const { error } = await supabase.from('lfg_posts').update({
      moderation_status: status,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert(`Moderation action failed: ${error.message}`); setActing(null); return }
    setLfgPosts(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }

  async function handleLfgDelete(id: string) {
    if (!confirm('Permanently delete this LFG post? Attached interest rows go too.')) return
    setActing(id)
    const { error } = await supabase.from('lfg_posts').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); setActing(null); return }
    setLfgPosts(prev => prev.filter(p => p.id !== id))
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

  // durationDays = 0 means clear (unsuspend); -1 means permanent
  // (set to year 2099); otherwise days from now.
  async function handleSuspend(id: string, durationDays: number, reason?: string) {
    setActing(id)
    let suspended_until: string | null
    if (durationDays === 0) {
      suspended_until = null
    } else if (durationDays < 0) {
      suspended_until = '2099-12-31T00:00:00Z'
    } else {
      suspended_until = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    }
    const patch: Record<string, any> = { suspended_until }
    if (reason !== undefined) patch.suspended_reason = reason || null
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) {
      alert(`Suspension update failed: ${error.message}`)
    } else {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, suspended_until, suspended_reason: reason ?? u.suspended_reason } : u))
    }
    setActing(null)
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Permanently delete this account? This cannot be undone.')) return
    setActing(id)
    try {
      const { user } = await getCachedAuth()
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
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
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
        <div style={{ padding: '14px 18px', background: '#2a1210', border: '1px solid #c0392b', borderLeft: '3px solid #c0392b', borderRadius: '4px', color: '#f5a89a', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>
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
        {(['users', 'rumors', 'npcs', 'communities', 'modules', 'forums', 'warstories', 'lfg', 'bugs'] as const).map(s => {
          const count = pendingCounts[s]
          const hasPending = count > 0
          const isActive = section === s
          const borderColor = isActive ? '#c0392b' : (hasPending ? '#2d5a1b' : '#3a3a3a')
          const color = isActive ? '#f5a89a' : (hasPending ? '#7fc458' : '#d4cfc9')
          const label = s === 'rumors' ? 'Rumor Queue'
            : s === 'users' ? 'Users'
            : s === 'npcs' ? 'NPCs'
            : s === 'communities' ? 'Communities'
            : s === 'modules' ? 'Modules'
            : s === 'forums' ? 'Forums'
            : s === 'warstories' ? 'War Stories'
            : s === 'bugs' ? 'Bugs'
            : 'LFG'
          return (
            <button key={s} onClick={() => setSection(s)} style={{
              flex: 1,
              padding: '7px 10px',
              border: `1px solid ${borderColor}`,
              background: isActive ? '#2a1210' : (hasPending ? '#0f1a0f' : '#242424'),
              color,
              borderRadius: '3px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'Carlito, sans-serif',
              letterSpacing: '.04em', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
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
                fontSize: '13px', fontFamily: 'Carlito, sans-serif',
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
                    <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase' }}>
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
                style={{ padding: '3px 10px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer' }}>
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
                  <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.username}
                    {u.email && <span style={{ color: '#cce0f5', fontWeight: 400, marginLeft: '6px', fontSize: '14px' }}>({u.email})</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Joined {formatDate(u.created_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                  {(() => {
                    // suspended_until in the future = currently suspended.
                    // Past or null = clear. Renders a chip with the until-
                    // date so a Thriver can see when it expires.
                    const until = u.suspended_until ? new Date(u.suspended_until) : null
                    const isSuspended = until && until.getTime() > Date.now()
                    if (!isSuspended) return null
                    const isPermanent = until!.getFullYear() >= 2099
                    return (
                      <span title={u.suspended_reason ?? undefined}
                        style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px', background: '#2a1a00', color: '#EF9F27', border: '1px solid #EF9F27' }}>
                        {isPermanent ? 'Suspended (perm)' : `Suspended → ${until!.toLocaleDateString()}`}
                      </span>
                    )
                  })()}
                  <span style={{
                    fontSize: '13px', fontFamily: 'Carlito, sans-serif',
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
                  {(() => {
                    const until = u.suspended_until ? new Date(u.suspended_until) : null
                    const isSuspended = until && until.getTime() > Date.now()
                    if (isSuspended) {
                      return (
                        <button onClick={() => handleSuspend(u.id, 0)} disabled={acting === u.id}
                          style={actionBtn('#2d5a1b', '#7fc458')}>
                          Unsuspend
                        </button>
                      )
                    }
                    // Inline duration picker — user picks length, we
                    // immediately apply. Default placeholder reads
                    // "Suspend…" so the GM intent is clear.
                    return (
                      <select value="" disabled={acting === u.id}
                        onChange={async e => {
                          const v = e.target.value
                          if (!v) return
                          const reason = window.prompt('Reason for suspension (optional, shown to other Thrivers):', '') ?? undefined
                          const days = v === 'perm' ? -1 : parseInt(v, 10)
                          await handleSuspend(u.id, days, reason)
                          e.target.value = ''
                        }}
                        style={{
                          padding: '4px 6px',
                          background: '#3a2a00',
                          border: '1px solid #5a3a00',
                          borderRadius: '3px',
                          color: '#EF9F27',
                          fontSize: '13px',
                          fontFamily: 'Carlito, sans-serif',
                          letterSpacing: '.06em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}>
                        <option value="">Suspend…</option>
                        <option value="1">24 hours</option>
                        <option value="7">7 days</option>
                        <option value="30">30 days</option>
                        <option value="perm">Permanent</option>
                      </select>
                    )
                  })()}
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
                    {npc.portrait_url ? <img src={npc.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px', fontWeight: 700, color: '#c0392b', fontFamily: 'Carlito, sans-serif' }}>{npc.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{npc.name}</div>
                    <div style={{ fontSize: '13px', color: '#cce0f5' }}>
                      by {(npc.profiles as any)?.username ?? 'Unknown'} &middot; {formatDate(npc.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {npc.npc_type && <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{npc.npc_type}</span>}
                    {npc.setting && <span style={{ fontSize: '13px', padding: '1px 5px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{npc.setting === 'district_zero' ? 'District Zero' : npc.setting === 'chased' ? 'Chased' : 'Custom'}</span>}
                  </div>
                </div>
                {npc.public_description && (
                  <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '8px', lineHeight: 1.5 }}>{npc.public_description}</div>
                )}
                <div style={{ display: 'flex', gap: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>
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
                fontSize: '13px', fontFamily: 'Carlito, sans-serif',
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
                      <div style={{ fontSize: '19px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                        🌐 {wc.name}
                      </div>
                      <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px' }}>
                        Published by <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{publisherName}</span> {wc.created_at ? `on ${formatDate(wc.created_at)}` : ''} · from <span style={{ color: '#EF9F27' }}>{sourceCampaignName}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#1a1a2e', border: '1px solid #2e2e5a', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{wc.size_band}</span>
                      <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#1a2010', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{wc.community_status}</span>
                      {wc.faction_label && (
                        <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#2a2010', border: '1px solid #5a4a1b', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{wc.faction_label}</span>
                      )}
                    </div>
                  </div>

                  {wc.description && (
                    <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a' }}>
                      {wc.description}
                    </div>
                  )}

                  <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px', fontFamily: 'Carlito, sans-serif', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
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
                fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
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
                    <div style={{ fontSize: '19px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
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

      {/* ── FORUMS (Phase 4B) ── */}
      {section === 'forums' && (
        <CampfireQueue
          title="Forum Threads"
          icon="💬"
          accent="#7fc458"
          rows={forumThreads}
          loading={forumsLoading}
          filter={filter}
          setFilter={setFilter}
          acting={acting}
          onApprove={(id) => handleForumAction(id, 'approved')}
          onReject={(id) => handleForumAction(id, 'rejected')}
          onDelete={handleForumDelete}
          renderRow={(t: any) => (
            <>
              <div style={{ fontSize: '19px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                💬 {t.title}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px' }}>
                by <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{t.author_username}</span> · {formatDate(t.created_at)} · <span style={{ color: '#7fc458', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t.category}</span>
                {t.setting && <span style={{ color: '#7ab3d4', marginLeft: '6px' }}>· {t.setting}</span>}
                {t.campaign_name && <span style={{ color: '#b87333', marginLeft: '6px' }}>· {t.campaign_name}</span>}
              </div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a', whiteSpace: 'pre-wrap' }}>
                {t.body}
              </div>
            </>
          )}
        />
      )}

      {/* ── WAR STORIES (Phase 4B) ── */}
      {section === 'warstories' && (
        <CampfireQueue
          title="War Stories"
          icon="🎭"
          accent="#b87333"
          rows={warStories}
          loading={warStoriesLoading}
          filter={filter}
          setFilter={setFilter}
          acting={acting}
          onApprove={(id) => handleWarStoryAction(id, 'approved')}
          onReject={(id) => handleWarStoryAction(id, 'rejected')}
          onDelete={handleWarStoryDelete}
          renderRow={(s: any) => (
            <>
              <div style={{ fontSize: '19px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                🎭 {s.title}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px' }}>
                by <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{s.author_username}</span> · {formatDate(s.created_at)}
                {s.setting && <span style={{ color: '#7ab3d4', marginLeft: '6px' }}>· {s.setting}</span>}
                {s.campaign_name && <span style={{ color: '#b87333', marginLeft: '6px' }}>· {s.campaign_name}</span>}
              </div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a', whiteSpace: 'pre-wrap' }}>
                {s.body}
              </div>
              {Array.isArray(s.attachments) && s.attachments.length > 0 && (
                <div style={{ fontSize: '13px', color: '#7ab3d4', marginBottom: '8px' }}>
                  📎 {s.attachments.length} attachment{s.attachments.length !== 1 ? 's' : ''}
                </div>
              )}
            </>
          )}
        />
      )}

      {/* ── LFG (Phase 4B) ── */}
      {section === 'lfg' && (
        <CampfireQueue
          title="Looking for Group"
          icon="🎲"
          accent="#7ab3d4"
          rows={lfgPosts}
          loading={lfgLoading}
          filter={filter}
          setFilter={setFilter}
          acting={acting}
          onApprove={(id) => handleLfgAction(id, 'approved')}
          onReject={(id) => handleLfgAction(id, 'rejected')}
          onDelete={handleLfgDelete}
          renderRow={(p: any) => (
            <>
              <div style={{ fontSize: '19px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                🎲 {p.title}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px' }}>
                by <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{p.author_username}</span> · {formatDate(p.created_at)} · <span style={{ color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.04em' }}>{p.kind === 'gm_seeking_players' ? 'GM seeking players' : 'Player seeking game'}</span>
                {p.setting && <span style={{ color: '#7ab3d4', marginLeft: '6px' }}>· {p.setting}</span>}
                {p.schedule && <span style={{ color: '#7fc458', marginLeft: '6px' }}>· {p.schedule}</span>}
              </div>
              <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '8px', padding: '8px 10px', background: '#242424', borderRadius: '3px', borderLeft: '2px solid #3a3a3a', whiteSpace: 'pre-wrap' }}>
                {p.body}
              </div>
            </>
          )}
        />
      )}

      {/* ── Bug reports (Tier A) ── */}
      {section === 'bugs' && (
        <div>
          <div style={{ fontSize: '18px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
            🐛 Bug Reports
          </div>
          {bugsLoading ? (
            <div style={{ padding: '20px', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>Loading…</div>
          ) : bugs.length === 0 ? (
            <div style={{ padding: '20px', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>No bug reports yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bugs.map((b: any) => {
                const statusColor: Record<string, string> = {
                  open: '#f5a89a',
                  triaged: '#EF9F27',
                  fixed: '#7fc458',
                  wontfix: '#5a5550',
                }
                return (
                  <div key={b.id} style={{
                    padding: '12px 14px',
                    background: '#1a1010',
                    border: '1px solid #3a3a3a',
                    borderLeft: `3px solid ${statusColor[b.status] ?? '#3a3a3a'}`,
                    borderRadius: '3px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                        {b.reporter_name ?? b.reporter_email ?? '(unknown)'}
                      </span>
                      <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                      <span style={{ fontSize: '13px', color: '#9aa5b0', fontFamily: 'Carlito, sans-serif' }}>
                        {new Date(b.created_at).toLocaleString()}
                      </span>
                      <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                      <span style={{ fontSize: '13px', color: statusColor[b.status] ?? '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                        {b.status}
                      </span>
                    </div>
                    {b.page_url && (
                      <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', marginBottom: '6px', wordBreak: 'break-all' }}>
                        {b.page_url}
                      </div>
                    )}
                    <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.5, fontFamily: 'Barlow, sans-serif', whiteSpace: 'pre-wrap', marginBottom: '8px', padding: '8px 10px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      {b.description}
                    </div>
                    {b.user_agent && (
                      <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', wordBreak: 'break-all' }}>
                        UA: {b.user_agent}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(['open', 'triaged', 'fixed', 'wontfix'] as const).map(s => (
                        <button key={s} onClick={() => setBugStatus(b.id, s)}
                          disabled={b.status === s}
                          style={{
                            padding: '5px 10px',
                            background: b.status === s ? '#0f1a0f' : 'transparent',
                            border: `1px solid ${b.status === s ? '#2d5a1b' : '#3a3a3a'}`,
                            borderRadius: '3px',
                            color: b.status === s ? '#7fc458' : '#cce0f5',
                            fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                            letterSpacing: '.06em', textTransform: 'uppercase',
                            cursor: b.status === s ? 'default' : 'pointer',
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      </>)}

    </div>
  )
}

// Reusable queue UI for the three Campfire moderation surfaces. Same
// shape as the inline world_communities + modules blocks above (filter
// pills, count line, empty state, row list with action buttons), just
// generic over the row content via the renderRow prop.
function CampfireQueue({
  title, icon, accent, rows, loading, filter, setFilter, acting,
  onApprove, onReject, onDelete, renderRow,
}: {
  title: string; icon: string; accent: string;
  rows: any[]; loading: boolean;
  filter: 'pending' | 'approved' | 'rejected';
  setFilter: (f: 'pending' | 'approved' | 'rejected') => void;
  acting: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  renderRow: (row: any) => React.ReactNode;
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
        {(['pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px',
            border: `1px solid ${filter === f ? '#c0392b' : '#3a3a3a'}`,
            background: filter === f ? '#2a1210' : '#242424',
            color: filter === f ? '#f5a89a' : '#d4cfc9',
            borderRadius: '3px', cursor: 'pointer',
            fontSize: '13px', fontFamily: 'Carlito, sans-serif',
            letterSpacing: '.06em', textTransform: 'uppercase',
          }}>{f}</button>
        ))}
      </div>

      <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '1rem' }}>
        {loading ? 'Loading...' : `${rows.length} ${filter} ${title.toLowerCase()}`}
      </div>

      {!loading && rows.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
          No {filter} {title.toLowerCase()}.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map(r => (
          <div key={r.id} style={{ padding: '14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${filter === 'approved' ? '#7fc458' : filter === 'rejected' ? '#c0392b' : accent}`, borderRadius: '4px' }}>
            {renderRow(r)}
            {r.moderator_notes && (
              <div style={{ fontSize: '13px', color: '#f5a89a', marginBottom: '8px', padding: '6px 8px', background: '#2a1010', borderRadius: '3px', border: '1px solid #c0392b' }}>
                <span style={{ color: '#5a5550', letterSpacing: '.06em', textTransform: 'uppercase' }}>Moderator notes:</span> {r.moderator_notes}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {filter === 'pending' && (
                <>
                  <button onClick={() => onApprove(r.id)} disabled={acting === r.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
                  <button onClick={() => onReject(r.id)} disabled={acting === r.id} style={actionBtn('#7a1f16', '#f5a89a')}>Reject</button>
                </>
              )}
              {filter === 'approved' && (
                <button onClick={() => onReject(r.id)} disabled={acting === r.id} style={actionBtn('#7a1f16', '#f5a89a')}>Revoke</button>
              )}
              {filter === 'rejected' && (
                <button onClick={() => onApprove(r.id)} disabled={acting === r.id} style={actionBtn('#2d5a1b', '#7fc458')}>Approve</button>
              )}
              <button onClick={() => onDelete(r.id)} disabled={acting === r.id} style={actionBtn('#2e2e2e', '#cce0f5')}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

