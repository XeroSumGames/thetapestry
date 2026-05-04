'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { logEvent } from '../../../lib/events'
import { renderRichText } from '../../../lib/rich-text'
import { useRouter } from 'next/navigation'
import {
  composePickerOptions,
  SETTING_FILTER_CHIPS,
  settingLabel,
  settingAccent,
  useUrlSettingFilter,
} from '../../../lib/campfire-settings'
import ReactionButtons, { aggregateReactions, type ReactionAggregate } from '../../../components/ReactionButtons'
import InlineRepliesPanel from '../../../components/InlineRepliesPanel'
import AuthorBadge from '../../../components/AuthorBadge'

// /campfire/lfg — bulletin board for finding GMs and players. Cross-campaign
// by design: this is the meta layer, not tied to any single story. Anyone
// signed in can browse; only the post's author can edit or delete it.

type Kind = 'gm_seeking_players' | 'player_seeking_game'

interface LfgPost {
  id: string
  author_user_id: string
  kind: Kind
  title: string
  body: string
  setting: string | null
  schedule: string | null
  moderation_status: 'pending' | 'approved' | 'rejected'
  moderator_notes: string | null
  // Phase 4E final — count maintained by lfg_post_replies trigger.
  reply_count: number | null
  created_at: string
  updated_at: string
}

interface PostWithAuthor extends LfgPost {
  author_username: string
  author_avatar_url: string | null
}

type Filter = 'all' | 'gm_seeking_players' | 'player_seeking_game'

// Compose-time scope. LFG has no campaign_id concept (LFG is by nature
// looking-for-cross-campaign), so the choices are setting-tagged or
// global only — no campaign scope.
type Scope = 'setting' | 'global'

const KIND_LABEL: Record<Kind, string> = {
  gm_seeking_players: 'GM seeking players',
  player_seeking_game: 'Player seeking game',
}

const KIND_ACCENT: Record<Kind, string> = {
  gm_seeking_players: '#c0392b',
  player_seeking_game: '#7ab3d4',
}

export default function LfgPage() {
  const supabase = createClient()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  // null = "All settings"; '' = "Global only"; <slug> = single setting.
  // Seeded from the ?setting= URL param so picking a setting on the
  // /campfire hub propagates here.
  const [settingFilter, setSettingFilter] = useUrlSettingFilter()
  // Phase 4E — schedule freetext filter. Schedule is a free-text column
  // (e.g. "Sundays 7pm EST", "Bi-weekly Tuesdays") so we substring-match
  // case-insensitively rather than try to parse natural-language times.
  const [scheduleQuery, setScheduleQuery] = useState<string>('')
  // Phase 4E — pagination. Same shape as Forums + War Stories.
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const PAGE_SIZE = 50
  // Phase 4E (final) — reaction aggregates per LFG post.
  const [reactions, setReactions] = useState<Record<string, ReactionAggregate>>({})
  // Phase 4E (final) — inline reply expand. Single open id at a time.
  const [openRepliesFor, setOpenRepliesFor] = useState<string | null>(null)
  const [replyCountOverride, setReplyCountOverride] = useState<Record<string, number>>({})
  // Phase 4E (final) — FTS state.
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchActive, setSearchActive] = useState<boolean>(false)
  const [searching, setSearching] = useState<boolean>(false)
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ kind: Kind; title: string; body: string; scope: Scope; setting: string; schedule: string }>({
    kind: 'gm_seeking_players', title: '', body: '', scope: 'setting', setting: 'district_zero', schedule: '',
  })
  const [saving, setSaving] = useState(false)
  // Which post's Share popover is open (id) and per-post copy-confirmation flash.
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [copiedFlash, setCopiedFlash] = useState<string | null>(null)
  // Interest state. `myInterests` is the set of post ids I've expressed
  // interest in (drives the toggle label). `interestsByPost` is a
  // post_id → list-of-interested-users map populated only for posts I
  // authored, so I can show a roster + 💬 Message buttons under my own posts.
  const [myInterests, setMyInterests] = useState<Set<string>>(new Set())
  const [interestsByPost, setInterestsByPost] = useState<Record<string, { user_id: string; username: string }[]>>({})
  const [interestPending, setInterestPending] = useState<Set<string>>(new Set())
  // Campaigns I GM — used by the 🎟 Invite picker on my own LFG posts so I
  // can DM an interested player a one-click join link without leaving this
  // page. Empty array = button is hidden (nothing to invite to).
  const [myCampaigns, setMyCampaigns] = useState<{ id: string; name: string; invite_code: string }[]>([])
  // Which roster row's invite picker is open. Key shape: `${postId}:${userId}`.
  const [invitingFor, setInvitingFor] = useState<string | null>(null)
  // Per-row "✓ Invite sent" flash, same key shape as invitingFor.
  const [inviteSentFor, setInviteSentFor] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function init() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)
      // Fetch the user's GM'd campaigns once. Used by the 🎟 Invite picker;
      // cheap query that doesn't change during a session, so no need to
      // refetch on every loadPosts call.
      const { data: campRows } = await supabase
        .from('campaigns')
        .select('id, name, invite_code')
        .eq('gm_user_id', user.id)
        .order('name', { ascending: true })
      setMyCampaigns((campRows ?? []) as { id: string; name: string; invite_code: string }[])
      await loadPosts()
    }
    init()
  }, [])

  // After the first render that includes posts, if the URL has a hash like
  // #lfg-<id>, scroll the matching card into view and flash a highlight ring.
  // Done in a one-shot effect keyed on `loading` flipping to false so we
  // don't fight the user's manual scroll later.
  useEffect(() => {
    if (loading) return
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (!hash || !hash.startsWith('#lfg-')) return
    const el = document.getElementById(hash.slice(1))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.transition = 'box-shadow .4s'
      el.style.boxShadow = '0 0 0 2px #7ab3d4'
      setTimeout(() => { el.style.boxShadow = '' }, 1600)
    }
  }, [loading])

  // Close the Share popover on outside click.
  useEffect(() => {
    if (!shareOpenId) return
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (!t.closest('[data-share-root]')) setShareOpenId(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [shareOpenId])

  // Close the Invite picker on outside click. Identical pattern to the
  // Share popover — separate effect so each closes independently when the
  // other opens.
  useEffect(() => {
    if (!invitingFor) return
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (!t.closest('[data-invite-root]')) setInvitingFor(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [invitingFor])

  async function sendInvite(otherUserId: string, postId: string, campaign: { id: string; name: string; invite_code: string }) {
    if (!myId) return
    // Phase 4E (final) — replaces the old DM-with-link flow with a
    // structured campaign_invitations row. The trigger creates a
    // notification on the recipient with type='campaign_invitation'
    // carrying invitation_id in metadata; NotificationBell renders
    // inline Accept / Decline buttons that update the row's status,
    // which in turn triggers an auto-add to campaign_members + a
    // response notification back to the sender.
    const { error } = await supabase.from('campaign_invitations').insert({
      campaign_id: campaign.id,
      sender_user_id: myId,
      recipient_user_id: otherUserId,
      message: null,
    })
    if (error) {
      // Unique constraint on (campaign_id, recipient_user_id, status='pending')
      // means a duplicate pending invite already exists. Treat that as
      // success — the user already has the prior invite waiting.
      if (error.code === '23505') {
        alert('You already have a pending invite to this player on this campaign.')
      } else {
        alert('Could not send invite: ' + error.message)
        return
      }
    }
    const key = `${postId}:${otherUserId}`
    setInvitingFor(null)
    setInviteSentFor(prev => new Set(prev).add(key))
    setTimeout(() => {
      setInviteSentFor(prev => {
        const next = new Set(prev); next.delete(key); return next
      })
    }, 2200)
  }

  function postUrl(postId: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/campfire/lfg#lfg-${postId}`
  }

  function shareText(p: PostWithAuthor) {
    return `${KIND_LABEL[p.kind]} on The Tapestry — ${p.title}`
  }

  async function copyLink(p: PostWithAuthor) {
    const url = postUrl(p.id)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedFlash(p.id)
      setTimeout(() => setCopiedFlash(prev => (prev === p.id ? null : prev)), 1600)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  function shareTo(target: 'reddit' | 'twitter' | 'facebook', p: PostWithAuthor) {
    const url = encodeURIComponent(postUrl(p.id))
    const title = encodeURIComponent(shareText(p))
    let href = ''
    if (target === 'reddit')   href = `https://www.reddit.com/submit?url=${url}&title=${title}`
    if (target === 'twitter')  href = `https://twitter.com/intent/tweet?text=${title}&url=${url}`
    if (target === 'facebook') href = `https://www.facebook.com/sharer/sharer.php?u=${url}`
    window.open(href, '_blank', 'noopener,noreferrer,width=640,height=720')
  }

  async function loadPosts() {
    setLoading(true)
    const { data: postRows } = await supabase
      .from('lfg_posts')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
    const list = (postRows ?? []) as LfgPost[]
    setHasMore(list.length === PAGE_SIZE)

    if (list.length === 0) {
      setPosts([])
      setMyInterests(new Set())
      setInterestsByPost({})
      setLoading(false)
      return
    }
    const authorIds = Array.from(new Set(list.map(p => p.author_user_id)))
    // Pull all interests we're allowed to see in one shot. RLS already
    // restricts this to (a) our own interests and (b) interests on posts
    // we authored — so nothing private leaks.
    const { data: ints } = await supabase
      .from('lfg_interests')
      .select('post_id, interested_user_id')

    const intRows = (ints ?? []) as { post_id: string; interested_user_id: string }[]

    const interestUserIds = intRows.map(r => r.interested_user_id)
    const allUserIds = Array.from(new Set([...authorIds, ...interestUserIds]))
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', allUserIds)
    const nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
    const avatarMap: Record<string, string | null> = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.avatar_url ?? null]))

    const myCurrentId = (await getCachedAuth()).user?.id ?? null
    const myInts = new Set<string>()
    const byPost: Record<string, { user_id: string; username: string }[]> = {}
    intRows.forEach(r => {
      if (r.interested_user_id === myCurrentId) myInts.add(r.post_id)
      // Only build the roster for posts I authored — the rest of the
      // intRows visible via RLS are my own interests on others' posts.
      const post = list.find(p => p.id === r.post_id)
      if (post && post.author_user_id === myCurrentId) {
        if (!byPost[r.post_id]) byPost[r.post_id] = []
        byPost[r.post_id].push({
          user_id: r.interested_user_id,
          username: nameMap[r.interested_user_id] ?? 'Unknown',
        })
      }
    })
    setMyInterests(myInts)
    setInterestsByPost(byPost)
    setPosts(list.map(p => ({ ...p, author_username: nameMap[p.author_user_id] ?? 'Unknown', author_avatar_url: avatarMap[p.author_user_id] ?? null })))
    // Reaction hydration for the visible posts.
    const ids = list.map(p => p.id)
    if (ids.length > 0) {
      const { data: reactRows } = await supabase
        .from('lfg_post_reactions')
        .select('post_id, user_id, kind')
        .in('post_id', ids)
      setReactions(aggregateReactions(reactRows ?? [], 'post_id', myCurrentId))
    }
    setLoading(false)
  }

  // Phase 4E (final) — FTS. Replaces the visible post list with up to
  // 50 hits. Doesn't fetch interests for hits (they're roster-only on
  // author-owned posts; if your search hits your own posts you'll
  // already have those interests cached from the initial load).
  async function runSearch() {
    const q = searchQuery.trim()
    if (!q) {
      setSearchActive(false)
      setHasMore(true)
      await loadPosts()
      return
    }
    setSearching(true)
    setSearchActive(true)
    const { data: rows } = await supabase
      .from('lfg_posts')
      .select('*')
      .textSearch('search_tsv', q, { type: 'plain', config: 'english' })
      .order('updated_at', { ascending: false })
      .limit(50)
    const list = (rows ?? []) as LfgPost[]
    setHasMore(false)
    if (list.length === 0) { setPosts([]); setSearching(false); return }
    const authorIds = Array.from(new Set(list.map(p => p.author_user_id)))
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', authorIds)
    const nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
    const avatarMap: Record<string, string | null> = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.avatar_url ?? null]))
    setPosts(list.map(p => ({ ...p, author_username: nameMap[p.author_user_id] ?? 'Unknown', author_avatar_url: avatarMap[p.author_user_id] ?? null })))
    const ids = list.map(p => p.id)
    if (ids.length > 0) {
      const { data: reactRows } = await supabase
        .from('lfg_post_reactions')
        .select('post_id, user_id, kind')
        .in('post_id', ids)
      setReactions(aggregateReactions(reactRows ?? [], 'post_id', myId))
    }
    setSearching(false)
  }

  // Phase 4E — append the next page. Cursor = current posts.length.
  // We don't refetch interests here; they were already pulled in full
  // via the RLS-scoped select on the initial load (it's small enough
  // to hydrate everything visible in one round-trip). New posts coming
  // in via realtime are out-of-scope for v1.
  async function loadMorePosts() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const offset = posts.length
    const { data: postRows } = await supabase
      .from('lfg_posts')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    const list = (postRows ?? []) as LfgPost[]
    setHasMore(list.length === PAGE_SIZE)
    if (list.length === 0) { setLoadingMore(false); return }
    const authorIds = Array.from(new Set(list.map(p => p.author_user_id)))
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', authorIds)
    const nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
    const avatarMap: Record<string, string | null> = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.avatar_url ?? null]))
    setPosts(prev => [...prev, ...list.map(p => ({ ...p, author_username: nameMap[p.author_user_id] ?? 'Unknown', author_avatar_url: avatarMap[p.author_user_id] ?? null }))])
    const ids = list.map(p => p.id)
    if (ids.length > 0) {
      const { data: reactRows } = await supabase
        .from('lfg_post_reactions')
        .select('post_id, user_id, kind')
        .in('post_id', ids)
      const more = aggregateReactions(reactRows ?? [], 'post_id', myId)
      setReactions(prev => ({ ...prev, ...more }))
    }
    setLoadingMore(false)
  }

  async function toggleInterest(postId: string) {
    if (!myId) return
    if (interestPending.has(postId)) return
    setInterestPending(prev => new Set(prev).add(postId))
    const alreadyInterested = myInterests.has(postId)
    if (alreadyInterested) {
      const { error } = await supabase
        .from('lfg_interests')
        .delete()
        .eq('post_id', postId)
        .eq('interested_user_id', myId)
      if (error) { alert('Error: ' + error.message) }
      else {
        setMyInterests(prev => {
          const next = new Set(prev); next.delete(postId); return next
        })
      }
    } else {
      const { error } = await supabase
        .from('lfg_interests')
        .insert({ post_id: postId, interested_user_id: myId })
      if (error) { alert('Error: ' + error.message) }
      else {
        setMyInterests(prev => new Set(prev).add(postId))
        void logEvent('lfg_interest_pinged', { post_id: postId })
      }
    }
    setInterestPending(prev => {
      const next = new Set(prev); next.delete(postId); return next
    })
  }

  function startCompose() {
    setEditingId(null)
    setDraft({ kind: 'gm_seeking_players', title: '', body: '', scope: 'setting', setting: 'district_zero', schedule: '' })
    setComposing(true)
  }

  function startEdit(p: PostWithAuthor) {
    setEditingId(p.id)
    // Old rows may carry free-text settings ("Distemper, Chased, Homebrew...")
    // that don't map to any registered slug. If we recognize the slug, keep
    // the Setting scope; otherwise fall back to Global so the editor doesn't
    // show a broken option in the dropdown.
    const knownSlugs = composePickerOptions().map(o => o.value)
    const isKnown = !!p.setting && knownSlugs.includes(p.setting)
    setDraft({
      kind: p.kind,
      title: p.title,
      body: p.body,
      scope: isKnown ? 'setting' : 'global',
      setting: isKnown ? p.setting! : 'district_zero',
      schedule: p.schedule ?? '',
    })
    setComposing(true)
  }

  function cancelCompose() {
    setComposing(false)
    setEditingId(null)
  }

  async function handleSave() {
    if (!myId) return
    if (!draft.title.trim() || !draft.body.trim() || saving) return
    setSaving(true)
    const payload: Record<string, any> = {
      kind: draft.kind,
      title: draft.title.trim(),
      body: draft.body.trim(),
      // Setting scope writes the slug; Global scope writes null. The
      // freetext input was deprecated in Phase 4A — old rows survive but
      // editing one snaps it to the slug picker (or Global if unknown).
      setting: draft.scope === 'setting' ? draft.setting : null,
      schedule: draft.schedule.trim() || null,
      // Phase 4B: LFG has no campaign scope (it's cross-campaign by
      // definition), so every post queues for thriver review. Edits
      // re-queue too — content changed, prior approval no longer holds.
      moderation_status: 'pending',
      approved_by: null,
      approved_at: null,
    }
    if (editingId) {
      const { error } = await supabase.from('lfg_posts').update(payload).eq('id', editingId)
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('lfg_posts').insert({ ...payload, author_user_id: myId })
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
      void logEvent('lfg_post_created', {
        kind: (payload as any).kind,
        setting: (payload as any).setting ?? null,
      })
    }
    setSaving(false)
    setComposing(false)
    setEditingId(null)
    await loadPosts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this post?')) return
    const { error } = await supabase.from('lfg_posts').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await loadPosts()
  }

  function formatTimestamp(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Setting filter applied first, kind filter on top of that. Mirrors
  // the layout: setting chip strip is the outer/primary axis, the kind
  // pills (GMs / Players) tighten further.
  const settingFiltered = useMemo(() => {
    if (settingFilter === null) return posts
    if (settingFilter === '') return posts.filter(p => !p.setting)
    return posts.filter(p => p.setting === settingFilter)
  }, [posts, settingFilter])
  const kindFiltered = filter === 'all' ? settingFiltered : settingFiltered.filter(p => p.kind === filter)
  // Schedule filter applies last (most specific). Empty query = no filter.
  const scheduleQ = scheduleQuery.trim().toLowerCase()
  const visible = scheduleQ === ''
    ? kindFiltered
    : kindFiltered.filter(p => (p.schedule ?? '').toLowerCase().includes(scheduleQ))
  // Author banner counts. LFG has no campaign scope, so every post
  // queues — non-zero counts here are normal, not exceptional.
  const myPendingCount = posts.filter(p => p.author_user_id === myId && p.moderation_status === 'pending').length
  const myRejectedCount = posts.filter(p => p.author_user_id === myId && p.moderation_status === 'rejected').length
  // Per-chip counts for the setting strip — respects the active kind filter
  // so the badge numbers match what'll actually show.
  const settingCounts = useMemo(() => {
    const base = filter === 'all' ? posts : posts.filter(p => p.kind === filter)
    const map: Record<string, number> = { __all__: base.length, __global__: 0 }
    base.forEach(p => {
      if (!p.setting) map.__global__++
      else map[p.setting] = (map[p.setting] ?? 0) + 1
    })
    return map
  }, [posts, filter])

  // ── Styles ───────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee',
    fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '13px', color: '#cce0f5',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', marginBottom: '4px',
  }
  const shareItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '7px 12px', background: 'none',
    border: 'none', color: '#d4cfc9', fontSize: '13px',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left',
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
            Looking for Group
          </div>
          <div style={{ fontSize: '14px', color: '#5a8a40', lineHeight: 1.6 }}>
            Find a campaign to join, or post that your table needs players.
          </div>
        </div>
        {!composing && (
          <button onClick={startCompose}
            style={{ padding: '9px 16px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + New Post
          </button>
        )}
      </div>

      {/* Author moderation banner. Every LFG post queues, so this is
          the user's own pending list. */}
      {(myPendingCount > 0 || myRejectedCount > 0) && (
        <div style={{ background: '#2a2010', border: '1px solid #5a4a1b', borderLeft: '3px solid #EF9F27', borderRadius: '4px', padding: '10px 14px', marginBottom: '1rem', fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
          {myPendingCount > 0 && (
            <span>⏳ You have {myPendingCount} post{myPendingCount > 1 ? 's' : ''} awaiting Thriver review.</span>
          )}
          {myPendingCount > 0 && myRejectedCount > 0 && <span> </span>}
          {myRejectedCount > 0 && (
            <span style={{ color: '#f5a89a' }}>✗ {myRejectedCount} post{myRejectedCount > 1 ? 's' : ''} not approved.</span>
          )}
        </div>
      )}

      {/* Composer */}
      {composing && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #7ab3d4', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', fontWeight: 600, color: '#7ab3d4', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            {editingId ? 'Edit Post' : 'New Post'}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>I am</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['gm_seeking_players', 'player_seeking_game'] as Kind[]).map(k => (
                <button key={k} onClick={() => setDraft(d => ({ ...d, kind: k }))}
                  style={{ flex: 1, padding: '6px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${draft.kind === k ? KIND_ACCENT[k] : '#3a3a3a'}`, background: draft.kind === k ? '#242424' : '#1a1a1a', color: draft.kind === k ? KIND_ACCENT[k] : '#d4cfc9' }}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>Title</label>
            <input style={inp} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder={draft.kind === 'gm_seeking_players' ? 'e.g. Distemper — Chased setting, weekly' : 'e.g. Veteran player looking for a long-term game'} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>Pitch</label>
            <textarea style={{ ...inp, minHeight: '110px', resize: 'vertical', fontFamily: 'Barlow, sans-serif' }} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
              placeholder={draft.kind === 'gm_seeking_players' ? 'Describe the campaign — tone, themes, what kind of players you want.' : 'Describe what you are looking for — playstyle, character ideas, schedule.'} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Where to post?</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {(['setting', 'global'] as Scope[]).map(s => {
                const active = draft.scope === s
                const accent = s === 'setting' ? '#7ab3d4' : '#9aa5b0'
                return (
                  <button key={s} onClick={() => setDraft(d => ({ ...d, scope: s }))}
                    style={{ padding: '6px 14px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${active ? accent : '#3a3a3a'}`, background: active ? '#242424' : '#1a1a1a', color: active ? accent : '#d4cfc9' }}>
                    {s === 'setting' ? '🏷 Setting' : '🌐 Global'}
                  </button>
                )
              })}
            </div>
            {draft.scope === 'setting' ? (
              <select value={draft.setting} onChange={e => setDraft(d => ({ ...d, setting: e.target.value }))}
                style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                {composePickerOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: '13px', color: '#9aa5b0', fontStyle: 'italic', padding: '4px 2px' }}>
                Open to any setting — visible everywhere.
              </div>
            )}
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Schedule</label>
            <input style={inp} value={draft.schedule} onChange={e => setDraft(d => ({ ...d, schedule: e.target.value }))}
              placeholder="Sundays 7pm EST, weekly..." />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleSave} disabled={!draft.title.trim() || !draft.body.trim() || saving}
              style={{ flex: 1, padding: '9px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'wait' : 'pointer', opacity: (!draft.title.trim() || !draft.body.trim()) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Post')}
            </button>
            <button onClick={cancelCompose}
              style={{ padding: '9px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phase 4E (final) — full-text search. */}
      <form onSubmit={e => { e.preventDefault(); runSearch() }}
        style={{ display: 'flex', gap: '6px', marginBottom: '0.75rem', alignItems: 'center' }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search LFG posts…"
          style={{ flex: 1, padding: '8px 12px', background: '#1a1a1a', border: `1px solid ${searchActive ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
        <button type="submit" disabled={searching}
          style={{ padding: '8px 14px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: searching ? 'wait' : 'pointer', fontWeight: 600 }}>
          {searching ? '…' : '🔍 Search'}
        </button>
        {searchActive && (
          <button type="button" onClick={() => { setSearchQuery(''); setSearchActive(false); loadPosts() }}
            style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </form>

      {/* Setting filter chip strip — featured settings + Global. Click "All"
          to clear; combines with the kind chips below. */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {SETTING_FILTER_CHIPS.map(opt => {
          const key = opt.value === null ? '__all__' : (opt.value === '' ? '__global__' : opt.value)
          const count = settingCounts[key] ?? 0
          const active = settingFilter === opt.value
          return (
            <button key={key} onClick={() => setSettingFilter(opt.value)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '999px', border: `1px solid ${active ? opt.accent : '#3a3a3a'}`, background: active ? `${opt.accent}22` : '#1a1a1a', color: active ? opt.accent : '#d4cfc9' }}>
              <span>{opt.label}</span>
              <span style={{ background: active ? `${opt.accent}33` : '#242424', color: active ? opt.accent : '#9aa5b0', padding: '1px 7px', borderRadius: '999px', fontSize: '13px', fontWeight: 700 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Kind filter chips + Schedule freetext filter (Phase 4E). */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {([
          ['all', 'All', '#f5f2ee'],
          ['gm_seeking_players', 'GMs', KIND_ACCENT.gm_seeking_players],
          ['player_seeking_game', 'Players', KIND_ACCENT.player_seeking_game],
        ] as [Filter, string, string][]).map(([val, label, accent]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '6px 14px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${filter === val ? accent : '#3a3a3a'}`, background: filter === val ? '#242424' : '#1a1a1a', color: filter === val ? accent : '#d4cfc9' }}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input value={scheduleQuery} onChange={e => setScheduleQuery(e.target.value)}
            placeholder="Filter by schedule (e.g. Sundays, weekly)…"
            style={{ width: '260px', padding: '6px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
          {scheduleQuery && (
            <button onClick={() => setScheduleQuery('')}
              title="Clear schedule filter"
              style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Post list */}
      {loading ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          {filter === 'all' ? 'No posts yet. Be the first to post.' : 'No posts match this filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visible.map(p => {
            const isMine = p.author_user_id === myId
            const accent = KIND_ACCENT[p.kind]
            return (
              <div key={p.id} id={`lfg-${p.id}`} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${accent}`, borderRadius: '4px', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: accent, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                    {KIND_LABEL[p.kind]}
                  </span>
                  <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>by</span>
                  <AuthorBadge username={p.author_username} avatarUrl={p.author_avatar_url} size={18} />
                  <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTimestamp(p.updated_at)}</span>
                  {p.moderation_status === 'pending' && (
                    <span style={{ padding: '1px 8px', background: '#2a2010', color: '#EF9F27', border: '1px solid #EF9F27', borderRadius: '999px', fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      ⏳ Pending review
                    </span>
                  )}
                  {p.moderation_status === 'rejected' && (
                    <span style={{ padding: '1px 8px', background: '#2a1010', color: '#f5a89a', border: '1px solid #c0392b', borderRadius: '999px', fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      ✗ Rejected
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
                  {renderRichText(p.body, { linkify: true })}
                </div>
                {(p.setting || p.schedule) && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {p.setting && (() => {
                      const tagAccent = settingAccent(p.setting)
                      return (
                        <span style={{ padding: '2px 8px', background: `${tagAccent}22`, border: `1px solid ${tagAccent}55`, borderRadius: '3px', fontSize: '13px', color: tagAccent, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          {settingLabel(p.setting)}
                        </span>
                      )
                    })()}
                    {p.schedule && (
                      <span style={{ padding: '2px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {p.schedule}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Phase 4E — reaction row. Available for everyone
                      including the author (votes signal "this looks
                      worth pursuing" rather than self-promotion). */}
                  <ReactionButtons
                    table="lfg_post_reactions"
                    fkColumn="post_id"
                    targetId={p.id}
                    userId={myId}
                    initialUp={reactions[p.id]?.up ?? 0}
                    initialDown={reactions[p.id]?.down ?? 0}
                    initialOwn={reactions[p.id]?.own ?? null}
                  />
                  {/* Asymmetric flow: viewers express interest with a toggle;
                      authors see the roster of interested users below the
                      action row and can DM them from there. The author never
                      gets a generic "Message" affordance for random viewers. */}
                  {!isMine && (() => {
                    const interested = myInterests.has(p.id)
                    const pending = interestPending.has(p.id)
                    return (
                      <button onClick={() => toggleInterest(p.id)} disabled={pending}
                        style={{ padding: '6px 14px', background: interested ? '#1a2e10' : '#1a3a5c', border: `1px solid ${interested ? '#2d5a1b' : '#7ab3d4'}`, borderRadius: '3px', color: interested ? '#7fc458' : '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.6 : 1 }}>
                        {interested ? '✓ Interested' : "I'm Interested"}
                      </button>
                    )
                  })()}
                  {isMine && (
                    <>
                      <button onClick={() => startEdit(p)}
                        style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        style={{ padding: '6px 14px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </>
                  )}
                  {/* Share popover. Anchored relative to the trigger so the
                      menu opens directly beneath it; closes on outside click
                      via the document-level mousedown handler above. */}
                  <div data-share-root style={{ position: 'relative' }}>
                    <button onClick={() => setShareOpenId(prev => prev === p.id ? null : p.id)}
                      style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      🔗 Share
                    </button>
                    {shareOpenId === p.id && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10, minWidth: '180px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', boxShadow: '0 4px 12px rgba(0,0,0,.5)', padding: '4px', display: 'flex', flexDirection: 'column' }}>
                        <button onClick={() => copyLink(p)} style={shareItemStyle}>
                          📋 {copiedFlash === p.id ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button onClick={() => { copyLink(p); }} title="Discord has no share-intent URL — paste this link into your channel; Discord will auto-render a preview." style={shareItemStyle}>
                          💬 Discord (Copy)
                        </button>
                        <button onClick={() => shareTo('reddit', p)} style={shareItemStyle}>
                          🟠 Reddit
                        </button>
                        <button onClick={() => shareTo('twitter', p)} style={shareItemStyle}>
                          ✕ X (Twitter)
                        </button>
                        <button onClick={() => shareTo('facebook', p)} style={shareItemStyle}>
                          🔵 Facebook
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Phase 4E — replies toggle for everyone. */}
                  {(() => {
                    const liveCount = replyCountOverride[p.id] ?? p.reply_count ?? 0
                    const open = openRepliesFor === p.id
                    return (
                      <button onClick={() => setOpenRepliesFor(open ? null : p.id)}
                        style={{ padding: '6px 14px', background: open ? '#1a3a5c' : '#242424', border: `1px solid ${open ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: open ? '#7ab3d4' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        💬 {liveCount} {liveCount === 1 ? 'reply' : 'replies'} {open ? '▴' : '▾'}
                      </button>
                    )
                  })()}
                </div>
                {openRepliesFor === p.id && (
                  <InlineRepliesPanel
                    table="lfg_post_replies"
                    fkColumn="post_id"
                    parentId={p.id}
                    userId={myId}
                    onReplyCountChange={delta => setReplyCountOverride(prev => ({
                      ...prev,
                      [p.id]: (prev[p.id] ?? p.reply_count ?? 0) + delta,
                    }))}
                  />
                )}
                {/* Interested-user roster — author-only. RLS scopes the rows
                    in interestsByPost so this list is empty for everyone
                    except the post's author. The 💬 Message button here is
                    where DMs originate from now (the asymmetric flow). */}
                {isMine && interestsByPost[p.id] && interestsByPost[p.id].length > 0 && (
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #2e2e2e' }}>
                    <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Interested ({interestsByPost[p.id].length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {interestsByPost[p.id].map(u => {
                        const inviteKey = `${p.id}:${u.user_id}`
                        const pickerOpen = invitingFor === inviteKey
                        const justSent = inviteSentFor.has(inviteKey)
                        return (
                          <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                              {u.username}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <a href={`/messages?dm=${u.user_id}`}
                                style={{ padding: '3px 10px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                                💬 Message
                              </a>
                              {/* Invite picker. Hidden if the GM has no
                                  campaigns to invite to (avoids teasing
                                  a dead button). Anchored relative to the
                                  trigger; click-outside closes it. */}
                              {myCampaigns.length > 0 && (
                                <div data-invite-root style={{ position: 'relative' }}>
                                  <button onClick={() => setInvitingFor(prev => prev === inviteKey ? null : inviteKey)} disabled={justSent}
                                    style={{ padding: '3px 10px', background: justSent ? '#1a2e10' : '#242424', border: `1px solid ${justSent ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: justSent ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: justSent ? 'default' : 'pointer' }}>
                                    {justSent ? '✓ Invite Sent' : '🎟 Invite'}
                                  </button>
                                  {pickerOpen && (
                                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 10, minWidth: '220px', maxHeight: '240px', overflowY: 'auto', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', boxShadow: '0 4px 12px rgba(0,0,0,.5)', padding: '4px', display: 'flex', flexDirection: 'column' }}>
                                      <div style={{ padding: '6px 10px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                                        Invite to…
                                      </div>
                                      {myCampaigns.map(c => (
                                        <button key={c.id} onClick={() => sendInvite(u.user_id, p.id, c)}
                                          style={{ display: 'block', width: '100%', padding: '7px 12px', background: 'none', border: 'none', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left' }}>
                                          {c.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Phase 4E — Load older LFG posts. */}
      {!loading && hasMore && posts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button onClick={loadMorePosts} disabled={loadingMore}
            style={{ padding: '8px 18px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: loadingMore ? 'wait' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}>
            {loadingMore ? 'Loading…' : 'Load older posts'}
          </button>
        </div>
      )}
    </div>
  )
}
