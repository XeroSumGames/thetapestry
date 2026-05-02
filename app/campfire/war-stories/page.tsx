'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { logEvent } from '../../../lib/events'
import { isMissingSchema, missingSchemaMessage } from '../../../lib/supabase-errors'
import { renderRichText } from '../../../lib/rich-text'
import {
  composePickerOptions,
  SETTING_FILTER_CHIPS,
  settingLabel,
  settingAccent,
  useUrlSettingFilter,
} from '../../../lib/campfire-settings'
import ReactionButtons, { aggregateReactions, type ReactionAggregate } from '../../../components/ReactionButtons'
import InlineRepliesPanel from '../../../components/InlineRepliesPanel'

// /campfire/war-stories — post memorable session moments, legendary rolls,
// character beats. Cross-campaign feed: anyone signed in can read; authors
// manage their own posts. Optional campaign tag surfaces which story each
// came from.

interface Attachment {
  name: string
  path: string
  url: string
  size?: number
  type?: string
}

interface Story {
  id: string
  author_user_id: string
  campaign_id: string | null
  title: string
  body: string
  attachments: Attachment[]
  setting: string | null
  moderation_status: 'pending' | 'approved' | 'rejected'
  moderator_notes: string | null
  // Phase 4E final — count maintained by the war_story_replies trigger.
  // Nullable to tolerate rows from before the migration.
  reply_count: number | null
  created_at: string
  updated_at: string
}

interface StoryWithMeta extends Story {
  author_username: string
  campaign_name: string | null
}

// Compose-time scope. Campaign = tag with the chosen campaign (private to
// that group post-Phase-4B). Setting = cross-campaign within a setting hub.
// Global = nothing (visible to everyone, no setting filter).
type Scope = 'campaign' | 'setting' | 'global'

const BUCKET = 'war-stories'
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i

export default function WarStoriesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [stories, setStories] = useState<StoryWithMeta[]>([])
  const [myCampaigns, setMyCampaigns] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; body: string; campaign_id: string; scope: Scope; setting: string }>({
    title: '', body: '', campaign_id: '', scope: 'campaign', setting: 'district_zero',
  })
  // null = "All settings"; '' = "Global only"; <slug> = single setting.
  // Seeded from the ?setting= URL param so picking a setting on the
  // /campfire hub propagates here.
  const [settingFilter, setSettingFilter] = useUrlSettingFilter()
  // Phase 4E — pagination. Same cursor-based shape as Forums.
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const PAGE_SIZE = 50
  // Phase 4E (final) — reaction aggregates per story. Empty default so
  // first paint shows ▲0 / ▼0 until the loader fills in.
  const [reactions, setReactions] = useState<Record<string, ReactionAggregate>>({})
  // Phase 4E (final) — full-text search. searchQuery is the user-typed
  // string; searchActive flips to true while a search is running and
  // the visible list is search-result-driven (vs. the normal feed).
  // Pagination is disabled in search mode (rank-ordered hits, capped).
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchActive, setSearchActive] = useState<boolean>(false)
  const [searching, setSearching] = useState<boolean>(false)
  // Phase 4E (final) — inline reply expand. Stored as a single id so
  // only one panel is open at a time; clicking the toggle on another
  // story switches focus.
  const [openRepliesFor, setOpenRepliesFor] = useState<string | null>(null)
  // Local override for reply_count so the chip number updates live as
  // replies post / delete without a full refetch.
  const [replyCountOverride, setReplyCountOverride] = useState<Record<string, number>>({})
  // Composer attachment state. `newFiles` = picks waiting to upload on save;
  // `existingAttachments` = files already saved on the story being edited
  // (so the editor can remove them). Fresh-post flow only uses newFiles.
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)
  // True when the war_stories table or one of its columns is absent
  // from the schema cache — i.e. the GM hasn't applied the
  // sql/war-stories.sql migration on this database yet. Detected on
  // the first SELECT in loadStories(); locks the composer with a
  // friendly banner instead of letting users hit a raw error on save.
  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    async function init() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)
      // Campaigns the user is a member of (GM or player) — used as the
      // optional campaign-tag dropdown on the composer. Pulled via
      // campaign_members to include campaigns where the user is a player,
      // not just those they GM.
      const { data: memberRows } = await supabase
        .from('campaign_members')
        .select('campaign_id, campaigns:campaign_id(id, name)')
        .eq('user_id', user.id)
      const camps = ((memberRows ?? []) as any[])
        .map(r => r.campaigns as { id: string; name: string } | null)
        .filter((c): c is { id: string; name: string } => !!c && !!c.id && !!c.name)
      // Dedupe (user could appear as both GM and player on the same row
      // shape in theory).
      const seen = new Set<string>()
      setMyCampaigns(camps.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true }))
      await loadStories()
    }
    init()
  }, [])

  async function loadStories() {
    setLoading(true)
    const { data: rows, error: readErr } = await supabase
      .from('war_stories')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
    // Migration not applied yet — set the flag, render the banner,
    // skip the rest of the load. Don't blow up the page.
    if (isMissingSchema(readErr)) {
      setTableMissing(true)
      setStories([])
      setLoading(false)
      return
    }
    const list = (rows ?? []) as Story[]
    setHasMore(list.length === PAGE_SIZE)
    if (list.length === 0) { setStories([]); setLoading(false); return }

    const authorIds = Array.from(new Set(list.map(s => s.author_user_id)))
    const campaignIds = Array.from(new Set(list.map(s => s.campaign_id).filter((x): x is string => !!x)))

    const [profRes, campRes] = await Promise.all([
      supabase.from('profiles').select('id, username').in('id', authorIds),
      campaignIds.length > 0
        ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
        : Promise.resolve({ data: [] }),
    ])
    const nameMap = Object.fromEntries((profRes.data ?? []).map((p: any) => [p.id, p.username]))
    const campMap = Object.fromEntries((campRes.data ?? []).map((c: any) => [c.id, c.name]))

    setStories(list.map(s => ({
      ...s,
      attachments: Array.isArray(s.attachments) ? s.attachments : [],
      author_username: nameMap[s.author_user_id] ?? 'Unknown',
      campaign_name: s.campaign_id ? (campMap[s.campaign_id] ?? null) : null,
    })))
    // Reaction hydration — single batched fetch keyed by story ids so
    // each card's ▲/▼ counts are paint-ready on first render.
    const ids = list.map(s => s.id)
    if (ids.length > 0) {
      const { data: reactRows } = await supabase
        .from('war_story_reactions')
        .select('war_story_id, user_id, kind')
        .in('war_story_id', ids)
      setReactions(aggregateReactions(reactRows ?? [], 'war_story_id', myId))
    }
    setLoading(false)
  }

  // Phase 4E (final) — FTS search. Replaces the visible list with up
  // to 50 highest-ranked hits matching the query against title+body.
  // Submitting an empty/whitespace query clears search mode and falls
  // back to the standard feed.
  async function runSearch() {
    const q = searchQuery.trim()
    if (!q) {
      setSearchActive(false)
      setHasMore(true)
      await loadStories()
      return
    }
    setSearching(true)
    setSearchActive(true)
    const { data: rows, error } = await supabase
      .from('war_stories')
      .select('*')
      .textSearch('search_tsv', q, { type: 'plain', config: 'english' })
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) {
      alert('Search failed: ' + error.message)
      setSearching(false)
      return
    }
    const list = (rows ?? []) as Story[]
    setHasMore(false)  // search results don't paginate
    if (list.length === 0) { setStories([]); setSearching(false); return }
    const authorIds = Array.from(new Set(list.map(s => s.author_user_id)))
    const campaignIds = Array.from(new Set(list.map(s => s.campaign_id).filter((x): x is string => !!x)))
    const [profRes, campRes] = await Promise.all([
      supabase.from('profiles').select('id, username').in('id', authorIds),
      campaignIds.length > 0
        ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
        : Promise.resolve({ data: [] }),
    ])
    const nameMap = Object.fromEntries((profRes.data ?? []).map((p: any) => [p.id, p.username]))
    const campMap = Object.fromEntries((campRes.data ?? []).map((c: any) => [c.id, c.name]))
    setStories(list.map(s => ({
      ...s,
      attachments: Array.isArray(s.attachments) ? s.attachments : [],
      author_username: nameMap[s.author_user_id] ?? 'Unknown',
      campaign_name: s.campaign_id ? (campMap[s.campaign_id] ?? null) : null,
    })))
    // Hydrate reactions for the search hits.
    const ids = list.map(s => s.id)
    if (ids.length > 0) {
      const { data: reactRows } = await supabase
        .from('war_story_reactions')
        .select('war_story_id, user_id, kind')
        .in('war_story_id', ids)
      setReactions(aggregateReactions(reactRows ?? [], 'war_story_id', myId))
    }
    setSearching(false)
  }

  // Phase 4E — append the next page of stories. Same offset shape as
  // Forums; new updated_at touches above the cursor are tolerable for
  // a polish-tier feed.
  async function loadMoreStories() {
    if (loadingMore || !hasMore || tableMissing) return
    setLoadingMore(true)
    const offset = stories.length
    const { data: rows } = await supabase
      .from('war_stories')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    const list = (rows ?? []) as Story[]
    setHasMore(list.length === PAGE_SIZE)
    if (list.length === 0) { setLoadingMore(false); return }
    const authorIds = Array.from(new Set(list.map(s => s.author_user_id)))
    const campaignIds = Array.from(new Set(list.map(s => s.campaign_id).filter((x): x is string => !!x)))
    const [profRes, campRes] = await Promise.all([
      supabase.from('profiles').select('id, username').in('id', authorIds),
      campaignIds.length > 0
        ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
        : Promise.resolve({ data: [] }),
    ])
    const nameMap = Object.fromEntries((profRes.data ?? []).map((p: any) => [p.id, p.username]))
    const campMap = Object.fromEntries((campRes.data ?? []).map((c: any) => [c.id, c.name]))
    setStories(prev => [...prev, ...list.map(s => ({
      ...s,
      attachments: Array.isArray(s.attachments) ? s.attachments : [],
      author_username: nameMap[s.author_user_id] ?? 'Unknown',
      campaign_name: s.campaign_id ? (campMap[s.campaign_id] ?? null) : null,
    }))])
    // Append reactions for the newly-loaded ids.
    const ids = list.map(s => s.id)
    if (ids.length > 0) {
      const { data: reactRows } = await supabase
        .from('war_story_reactions')
        .select('war_story_id, user_id, kind')
        .in('war_story_id', ids)
      const more = aggregateReactions(reactRows ?? [], 'war_story_id', myId)
      setReactions(prev => ({ ...prev, ...more }))
    }
    setLoadingMore(false)
  }

  function startCompose() {
    setEditingId(null)
    // Default to Campaign scope when the user has any campaigns; fall back
    // to Setting otherwise. Auto-pick the most recent campaign so the
    // common "I want to share what just happened in our session" flow
    // takes one click.
    const defaultCampaignId = myCampaigns[0]?.id ?? ''
    const defaultScope: Scope = defaultCampaignId ? 'campaign' : 'setting'
    setDraft({ title: '', body: '', campaign_id: defaultCampaignId, scope: defaultScope, setting: 'district_zero' })
    setNewFiles([])
    setExistingAttachments([])
    setComposing(true)
  }

  function startEdit(s: StoryWithMeta) {
    setEditingId(s.id)
    // Reconstruct the scope from the saved row. campaign_id wins if both
    // are set (shouldn't happen via the composer but tolerate it). Fall
    // back to setting if there's no campaign tag.
    const scope: Scope = s.campaign_id ? 'campaign' : (s.setting ? 'setting' : 'global')
    setDraft({
      title: s.title,
      body: s.body,
      campaign_id: s.campaign_id ?? '',
      scope,
      setting: s.setting ?? 'district_zero',
    })
    setNewFiles([])
    setExistingAttachments(Array.isArray(s.attachments) ? s.attachments : [])
    setComposing(true)
  }

  async function handleSave() {
    if (!myId || !draft.title.trim() || !draft.body.trim() || saving) return
    setSaving(true)
    // The scope radio collapses into the campaign_id + setting columns:
    //   campaign → campaign_id set, setting null
    //   setting  → campaign_id null, setting set
    //   global   → both null
    // Belt-and-braces null-out the unselected one so editing a row from
    // one scope to another doesn't leave stale data behind. Phase 4B:
    // campaign-scoped stories skip thriver review (instant approve);
    // setting/global queue for moderation. Editing an existing story
    // from setting → campaign re-approves; campaign → setting re-queues.
    const isCampaignScope = draft.scope === 'campaign' && !!draft.campaign_id
    const payload: Record<string, any> = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      campaign_id: draft.scope === 'campaign' ? (draft.campaign_id || null) : null,
      setting: draft.scope === 'setting' ? draft.setting : null,
      moderation_status: isCampaignScope ? 'approved' : 'pending',
      approved_at: isCampaignScope ? new Date().toISOString() : null,
      // Clear approved_by when re-queueing so the moderator sees a
      // fresh review.
      approved_by: isCampaignScope ? null : null,
    }

    // Determine the story id we'll upload attachments under. For edits the
    // id is known; for new posts we insert first and take the returned id.
    let storyId: string
    if (editingId) {
      const { error } = await supabase.from('war_stories').update(payload).eq('id', editingId)
      if (error) {
        if (isMissingSchema(error)) {
          setTableMissing(true)
          alert(missingSchemaMessage('War Stories', 'sql/war-stories.sql'))
        } else {
          alert('Error: ' + error.message)
        }
        setSaving(false)
        return
      }
      storyId = editingId
    } else {
      const { data, error } = await supabase.from('war_stories')
        .insert({ ...payload, author_user_id: myId, attachments: [] })
        .select('id').single()
      if (error || !data) {
        if (isMissingSchema(error)) {
          setTableMissing(true)
          alert(missingSchemaMessage('War Stories', 'sql/war-stories.sql'))
        } else {
          alert('Error: ' + (error?.message ?? 'unknown'))
        }
        setSaving(false)
        return
      }
      storyId = data.id
      void logEvent('war_story_published', {
        story_id: storyId,
        campaign_id: (payload as any).campaign_id ?? null,
        setting: (payload as any).setting ?? null,
      })
    }

    // Upload each picked file to <author>/<story>/<filename>. upsert:true
    // lets an editor overwrite a same-named file instead of erroring.
    const uploaded: Attachment[] = []
    for (const file of newFiles) {
      const path = `${myId}/${storyId}/${file.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
      if (upErr) { alert(`Upload failed for ${file.name}: ${upErr.message}`); continue }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      uploaded.push({ name: file.name, path, url: urlData.publicUrl, size: file.size, type: file.type })
    }

    // Merge existing (minus any the editor removed) + newly-uploaded.
    const merged = [...existingAttachments, ...uploaded]
    const { error: patchErr } = await supabase.from('war_stories')
      .update({ attachments: merged })
      .eq('id', storyId)
    if (patchErr) { alert('Failed to save attachments: ' + patchErr.message) }

    setSaving(false)
    setComposing(false)
    setEditingId(null)
    setNewFiles([])
    setExistingAttachments([])
    await loadStories()
  }

  // When editing, let the author drop an attachment. Removes from the
  // bucket first, then from the local `existingAttachments` list — the
  // subsequent save writes the updated list to the attachments column.
  async function removeExistingAttachment(att: Attachment) {
    if (!confirm(`Remove "${att.name}" from this story?`)) return
    const { error } = await supabase.storage.from(BUCKET).remove([att.path])
    if (error) { alert('Error: ' + error.message); return }
    setExistingAttachments(prev => prev.filter(a => a.path !== att.path))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this War Story?')) return
    // Best-effort cleanup of the bucket folder. Stories whose attachments
    // column is already empty just skip this. We do this BEFORE the row
    // delete so RLS still sees the author as the owner.
    const story = stories.find(s => s.id === id)
    if (story && Array.isArray(story.attachments) && story.attachments.length > 0) {
      const paths = story.attachments.map(a => a.path).filter(Boolean)
      if (paths.length > 0) {
        await supabase.storage.from(BUCKET).remove(paths)
      }
    }
    const { error } = await supabase.from('war_stories').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    await loadStories()
  }

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Apply the active setting chip filter to the loaded stories. The chip
  // strip itself is the only filter axis on War Stories — no category, no
  // kind, so this collapses straight to the visible list.
  const visibleStories = useMemo(() => {
    if (settingFilter === null) return stories
    if (settingFilter === '') return stories.filter(s => !s.setting)
    return stories.filter(s => s.setting === settingFilter)
  }, [stories, settingFilter])

  // Per-chip counts shown in the badge. __all__ is the unfiltered total;
  // __global__ counts rows with no setting tag. Featured slugs map to
  // their slug key directly.
  const settingCounts = useMemo(() => {
    const map: Record<string, number> = { __all__: stories.length, __global__: 0 }
    stories.forEach(s => {
      if (!s.setting) map.__global__++
      else map[s.setting] = (map[s.setting] ?? 0) + 1
    })
    return map
  }, [stories])

  // Author banner counts — surfaces own pending/rejected so the user
  // knows their setting/global stories are queued. Campaign-scoped
  // stories instant-publish so they never contribute.
  const myPendingCount = stories.filter(s => s.author_user_id === myId && s.moderation_status === 'pending').length
  const myRejectedCount = stories.filter(s => s.author_user_id === myId && s.moderation_status === 'rejected').length

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

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
            War Stories
          </div>
          <div style={{ fontSize: '14px', color: '#5a8a40', lineHeight: 1.6 }}>
            Session highlights, legendary rolls, character moments — share what happened at your table.
          </div>
        </div>
        {!composing && (
          <button onClick={startCompose} disabled={tableMissing}
            title={tableMissing ? 'War Stories migration not applied yet — see banner below.' : undefined}
            style={{ padding: '9px 16px', background: '#3a2516', border: '1px solid #b87333', borderRadius: '3px', color: '#b87333', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: tableMissing ? 'not-allowed' : 'pointer', opacity: tableMissing ? 0.4 : 1 }}>
            + New Story
          </button>
        )}
      </div>

      {/* Migration-not-applied banner — friendly fallback when the
          war_stories table is missing from the schema cache. The
          composer + post button are disabled until a Thriver applies
          the migration; existing readers don't see this. */}
      {tableMissing && (
        <div style={{ background: '#2a2010', border: '1px solid #5a4a1b', borderLeft: '3px solid #EF9F27', borderRadius: '4px', padding: '12px 16px', marginBottom: '1.25rem', color: '#EF9F27', fontSize: '14px', lineHeight: 1.5 }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Feature not yet enabled</div>
          <div style={{ color: '#d4cfc9' }}>
            War Stories isn&apos;t live on this database yet — a Thriver needs to apply <code style={{ background: '#0f0f0f', padding: '1px 6px', borderRadius: '2px', color: '#EF9F27' }}>sql/war-stories.sql</code> (and <code style={{ background: '#0f0f0f', padding: '1px 6px', borderRadius: '2px', color: '#EF9F27' }}>sql/war-stories-attachments.sql</code> for image uploads) in Supabase. Once that&apos;s done, refresh and post away.
          </div>
        </div>
      )}

      {/* Author moderation banner. Only setting/global stories queue;
          campaign-scoped instant-publish so they don't appear here. */}
      {(myPendingCount > 0 || myRejectedCount > 0) && (
        <div style={{ background: '#2a2010', border: '1px solid #5a4a1b', borderLeft: '3px solid #EF9F27', borderRadius: '4px', padding: '10px 14px', marginBottom: '1rem', fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
          {myPendingCount > 0 && (
            <span>⏳ You have {myPendingCount} stor{myPendingCount > 1 ? 'ies' : 'y'} awaiting Thriver review.</span>
          )}
          {myPendingCount > 0 && myRejectedCount > 0 && <span> </span>}
          {myRejectedCount > 0 && (
            <span style={{ color: '#f5a89a' }}>✗ {myRejectedCount} stor{myRejectedCount > 1 ? 'ies' : 'y'} not approved.</span>
          )}
        </div>
      )}

      {/* Composer */}
      {composing && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #b87333', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', fontWeight: 600, color: '#b87333', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            {editingId ? 'Edit Story' : 'New Story'}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>Title</label>
            <input style={inp} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="e.g. That time we talked the raiders down" />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>The Story</label>
            <textarea style={{ ...inp, minHeight: '200px', resize: 'vertical', fontFamily: 'Barlow, sans-serif', lineHeight: 1.55 }} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
              placeholder="Tell the table what happened." />
          </div>
          {/* Scope picker — replaces the old "From Campaign (optional)"
              dropdown. Three options: campaign-private (default if user
              has campaigns), setting-tagged, or fully global. The
              sub-control below the radio adapts to the selected scope. */}
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Where to post?</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {(['campaign', 'setting', 'global'] as Scope[]).map(s => {
                const active = draft.scope === s
                const accent = s === 'campaign' ? '#b87333' : (s === 'setting' ? '#7ab3d4' : '#9aa5b0')
                const disabled = s === 'campaign' && myCampaigns.length === 0
                const label = s === 'campaign' ? '👥 Campaign' : (s === 'setting' ? '🏷 Setting' : '🌐 Global')
                return (
                  <button key={s} onClick={() => !disabled && setDraft(d => ({ ...d, scope: s }))}
                    disabled={disabled}
                    title={disabled ? 'You aren’t a member of any campaign yet.' : undefined}
                    style={{ padding: '6px 14px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: '3px', border: `1px solid ${active ? accent : '#3a3a3a'}`, background: active ? '#242424' : '#1a1a1a', color: active ? accent : '#d4cfc9', opacity: disabled ? 0.4 : 1 }}>
                    {label}
                  </button>
                )
              })}
            </div>
            {draft.scope === 'campaign' && myCampaigns.length > 0 && (
              <select value={draft.campaign_id} onChange={e => setDraft(d => ({ ...d, campaign_id: e.target.value }))}
                style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                {myCampaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {draft.scope === 'setting' && (
              <select value={draft.setting} onChange={e => setDraft(d => ({ ...d, setting: e.target.value }))}
                style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                {composePickerOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {draft.scope === 'global' && (
              <div style={{ fontSize: '13px', color: '#9aa5b0', fontStyle: 'italic', padding: '4px 2px' }}>
                Cross-setting — no setting or campaign tag. Visible everywhere.
              </div>
            )}
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Attachments (optional)</label>
            {/* Existing (edit-only). Each row has a × to remove; removal
                deletes from the bucket immediately so the on-save merge
                picks up the new list correctly. */}
            {existingAttachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '6px' }}>
                {existingAttachments.map(att => {
                  const isImg = IMAGE_RE.test(att.name)
                  return (
                    <div key={att.path} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                      {isImg && <img src={att.url} alt="" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '2px' }} />}
                      <a href={att.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: '13px', color: '#b87333', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</a>
                      <button onClick={() => removeExistingAttachment(att)}
                        style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '15px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Picker for new files (staged until save). */}
            <label style={{ display: 'block', padding: '10px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', cursor: 'pointer' }}>
              {newFiles.length > 0
                ? <span style={{ color: '#7fc458' }}>{newFiles.length} file{newFiles.length > 1 ? 's' : ''} staged</span>
                : '+ Add files (images, PDFs, etc.)'}
              <input type="file" multiple hidden onChange={e => {
                if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files!)])
                e.target.value = ''
              }} />
            </label>
            {newFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 8px', marginTop: '3px', fontSize: '13px', color: '#cce0f5', background: '#1f1f1f', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleSave} disabled={!draft.title.trim() || !draft.body.trim() || saving}
              style={{ flex: 1, padding: '9px', background: '#3a2516', border: '1px solid #b87333', borderRadius: '3px', color: '#b87333', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'wait' : 'pointer', opacity: (!draft.title.trim() || !draft.body.trim()) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Post Story')}
            </button>
            <button onClick={() => { setComposing(false); setEditingId(null) }}
              style={{ padding: '9px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phase 4E (final) — full-text search. Submitting fires an FTS
          query against title+body via the search_tsv generated column;
          clearing returns to the standard feed. */}
      {!tableMissing && (
        <form onSubmit={e => { e.preventDefault(); runSearch() }}
          style={{ display: 'flex', gap: '6px', marginBottom: '0.75rem', alignItems: 'center' }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search stories…"
            style={{ flex: 1, padding: '8px 12px', background: '#1a1a1a', border: `1px solid ${searchActive ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
          <button type="submit" disabled={searching}
            style={{ padding: '8px 14px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: searching ? 'wait' : 'pointer', fontWeight: 600 }}>
            {searching ? '…' : '🔍 Search'}
          </button>
          {searchActive && (
            <button type="button" onClick={() => { setSearchQuery(''); setSearchActive(false); loadStories() }}
              style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </form>
      )}

      {/* Setting filter chip strip — featured settings + Global. Click "All"
          to clear. War Stories has no other axis of filtering, so this is
          the only chip row. */}
      {!tableMissing && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
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
      )}

      {/* Story list */}
      {loading ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : visibleStories.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          {settingFilter === null ? 'No stories yet. Be the first to post one.' : 'No stories match this filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleStories.map(s => {
            const isMine = s.author_user_id === myId
            return (
              <div key={s.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #b87333', borderRadius: '4px', padding: '1rem 1.25rem' }}>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {s.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>by {s.author_username}</span>
                  <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTimestamp(s.updated_at)}</span>
                  {s.campaign_name && (
                    <>
                      <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                      <span style={{ padding: '1px 8px', background: '#3a2516', border: '1px solid #b87333', borderRadius: '3px', fontSize: '13px', color: '#b87333', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {s.campaign_name}
                      </span>
                    </>
                  )}
                  {s.setting && (() => {
                    const tagAccent = settingAccent(s.setting)
                    return (
                      <>
                        <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                        <span style={{ padding: '1px 8px', background: `${tagAccent}22`, color: tagAccent, border: `1px solid ${tagAccent}55`, borderRadius: '3px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          {settingLabel(s.setting)}
                        </span>
                      </>
                    )
                  })()}
                  {s.moderation_status === 'pending' && (
                    <>
                      <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                      <span style={{ padding: '1px 8px', background: '#2a2010', color: '#EF9F27', border: '1px solid #EF9F27', borderRadius: '3px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                        ⏳ Pending review
                      </span>
                    </>
                  )}
                  {s.moderation_status === 'rejected' && (
                    <>
                      <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                      <span style={{ padding: '1px 8px', background: '#2a1010', color: '#f5a89a', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                        ✗ Rejected
                      </span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: (s.attachments.length > 0 || isMine) ? '12px' : 0 }}>
                  {renderRichText(s.body, { linkify: true })}
                </div>
                {/* Attachments. Images render as clickable thumbnails
                    (open full-size in new tab); non-images show as a
                    download-link pill. The 240px max width keeps a row of
                    thumbnails tidy when there are several. */}
                {s.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: isMine ? '12px' : 0 }}>
                    {s.attachments.map(att => {
                      const isImg = IMAGE_RE.test(att.name)
                      return isImg ? (
                        <a key={att.path} href={att.url} target="_blank" rel="noreferrer" title={att.name}
                          style={{ display: 'block', width: '240px', maxWidth: '100%', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden', background: '#0f0f0f' }}>
                          <img src={att.url} alt={att.name} style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '360px', objectFit: 'contain' }} />
                        </a>
                      ) : (
                        <a key={att.path} href={att.url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b87333', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                          📎 {att.name}
                        </a>
                      )
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Phase 4E — reactions row. Available to everyone
                      signed in; the author can still vote on their own
                      story (mirrors Forums B). */}
                  <ReactionButtons
                    table="war_story_reactions"
                    fkColumn="war_story_id"
                    targetId={s.id}
                    userId={myId}
                    initialUp={reactions[s.id]?.up ?? 0}
                    initialDown={reactions[s.id]?.down ?? 0}
                    initialOwn={reactions[s.id]?.own ?? null}
                  />
                  {/* Phase 4E — replies toggle. Inline-expand panel
                      mirrors the Forums reply UX without needing a
                      detail page. */}
                  {(() => {
                    const liveCount = replyCountOverride[s.id] ?? s.reply_count ?? 0
                    const open = openRepliesFor === s.id
                    return (
                      <button onClick={() => setOpenRepliesFor(open ? null : s.id)}
                        style={{ padding: '5px 12px', background: open ? '#1a3a5c' : '#242424', border: `1px solid ${open ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: open ? '#7ab3d4' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        💬 {liveCount} {liveCount === 1 ? 'reply' : 'replies'} {open ? '▴' : '▾'}
                      </button>
                    )
                  })()}
                  {isMine && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => startEdit(s)}
                        style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(s.id)}
                        style={{ padding: '5px 12px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {openRepliesFor === s.id && (
                  <InlineRepliesPanel
                    table="war_story_replies"
                    fkColumn="war_story_id"
                    parentId={s.id}
                    userId={myId}
                    onReplyCountChange={delta => setReplyCountOverride(prev => ({
                      ...prev,
                      [s.id]: (prev[s.id] ?? s.reply_count ?? 0) + delta,
                    }))}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Phase 4E — Load older stories. */}
      {!loading && hasMore && stories.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button onClick={loadMoreStories} disabled={loadingMore}
            style={{ padding: '8px 18px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: loadingMore ? 'wait' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}>
            {loadingMore ? 'Loading…' : 'Load older stories'}
          </button>
        </div>
      )}
    </div>
  )
}
