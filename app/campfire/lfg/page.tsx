'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

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
  created_at: string
  updated_at: string
}

interface PostWithAuthor extends LfgPost {
  author_username: string
}

type Filter = 'all' | 'gm_seeking_players' | 'player_seeking_game'

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
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ kind: Kind; title: string; body: string; setting: string; schedule: string }>({
    kind: 'gm_seeking_players', title: '', body: '', setting: '', schedule: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)
      await loadPosts()
    }
    init()
  }, [])

  async function loadPosts() {
    setLoading(true)
    const { data: postRows } = await supabase
      .from('lfg_posts')
      .select('*')
      .order('updated_at', { ascending: false })
    const list = (postRows ?? []) as LfgPost[]

    if (list.length === 0) { setPosts([]); setLoading(false); return }
    const authorIds = Array.from(new Set(list.map(p => p.author_user_id)))
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', authorIds)
    const nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))

    setPosts(list.map(p => ({ ...p, author_username: nameMap[p.author_user_id] ?? 'Unknown' })))
    setLoading(false)
  }

  function startCompose() {
    setEditingId(null)
    setDraft({ kind: 'gm_seeking_players', title: '', body: '', setting: '', schedule: '' })
    setComposing(true)
  }

  function startEdit(p: PostWithAuthor) {
    setEditingId(p.id)
    setDraft({ kind: p.kind, title: p.title, body: p.body, setting: p.setting ?? '', schedule: p.schedule ?? '' })
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
    const payload = {
      kind: draft.kind,
      title: draft.title.trim(),
      body: draft.body.trim(),
      setting: draft.setting.trim() || null,
      schedule: draft.schedule.trim() || null,
    }
    if (editingId) {
      const { error } = await supabase.from('lfg_posts').update(payload).eq('id', editingId)
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('lfg_posts').insert({ ...payload, author_user_id: myId })
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
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

  const visible = filter === 'all' ? posts : posts.filter(p => p.kind === filter)

  // ── Styles ───────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee',
    fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '13px', color: '#cce0f5',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', marginBottom: '4px',
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
            Looking for Group
          </div>
          <div style={{ fontSize: '14px', color: '#5a8a40', lineHeight: 1.6 }}>
            Find a campaign to join, or post that your table needs players.
          </div>
        </div>
        {!composing && (
          <button onClick={startCompose}
            style={{ padding: '9px 16px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + New Post
          </button>
        )}
      </div>

      {/* Composer */}
      {composing && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #7ab3d4', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 600, color: '#7ab3d4', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            {editingId ? 'Edit Post' : 'New Post'}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>I am</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['gm_seeking_players', 'player_seeking_game'] as Kind[]).map(k => (
                <button key={k} onClick={() => setDraft(d => ({ ...d, kind: k }))}
                  style={{ flex: 1, padding: '6px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${draft.kind === k ? KIND_ACCENT[k] : '#3a3a3a'}`, background: draft.kind === k ? '#242424' : '#1a1a1a', color: draft.kind === k ? KIND_ACCENT[k] : '#d4cfc9' }}>
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
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Setting</label>
              <input style={inp} value={draft.setting} onChange={e => setDraft(d => ({ ...d, setting: e.target.value }))}
                placeholder="Distemper, Chased, Homebrew..." />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Schedule</label>
              <input style={inp} value={draft.schedule} onChange={e => setDraft(d => ({ ...d, schedule: e.target.value }))}
                placeholder="Sundays 7pm EST, weekly..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleSave} disabled={!draft.title.trim() || !draft.body.trim() || saving}
              style={{ flex: 1, padding: '9px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'wait' : 'pointer', opacity: (!draft.title.trim() || !draft.body.trim()) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Post')}
            </button>
            <button onClick={cancelCompose}
              style={{ padding: '9px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
        {([
          ['all', 'All', '#f5f2ee'],
          ['gm_seeking_players', 'GMs', KIND_ACCENT.gm_seeking_players],
          ['player_seeking_game', 'Players', KIND_ACCENT.player_seeking_game],
        ] as [Filter, string, string][]).map(([val, label, accent]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '6px 14px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${filter === val ? accent : '#3a3a3a'}`, background: filter === val ? '#242424' : '#1a1a1a', color: filter === val ? accent : '#d4cfc9' }}>
            {label}
          </button>
        ))}
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
              <div key={p.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${accent}`, borderRadius: '4px', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', color: accent, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                    {KIND_LABEL[p.kind]}
                  </span>
                  <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>by {p.author_username}</span>
                  <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                  <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTimestamp(p.updated_at)}</span>
                </div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
                  {p.body}
                </div>
                {(p.setting || p.schedule) && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {p.setting && (
                      <span style={{ padding: '2px 8px', background: '#0f2035', border: '1px solid #2e4a6b', borderRadius: '3px', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {p.setting}
                      </span>
                    )}
                    {p.schedule && (
                      <span style={{ padding: '2px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {p.schedule}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {!isMine && (
                    <a href={`/messages?dm=${p.author_user_id}`}
                      style={{ padding: '6px 14px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                      💬 Message
                    </a>
                  )}
                  {isMine && (
                    <>
                      <button onClick={() => startEdit(p)}
                        style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)}
                        style={{ padding: '6px 14px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
