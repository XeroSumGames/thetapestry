'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

// /campfire/forums — index of community threads. Pinned threads float
// to the top; the rest sort by latest_reply_at DESC. Cross-campaign by
// design (Campfire = the meta layer).

type Category = 'lore' | 'rules' | 'session-recaps' | 'general'

const CATEGORY_LABEL: Record<Category, string> = {
  lore: 'Lore',
  rules: 'Rules',
  'session-recaps': 'Session Recaps',
  general: 'General',
}

const CATEGORY_ACCENT: Record<Category, string> = {
  lore: '#b87333',
  rules: '#7ab3d4',
  'session-recaps': '#8b5cf6',
  general: '#7fc458',
}

interface Thread {
  id: string
  author_user_id: string
  category: Category
  title: string
  body: string
  pinned: boolean
  locked: boolean
  reply_count: number
  latest_reply_at: string
  created_at: string
}

interface ThreadWithAuthor extends Thread {
  author_username: string
}

type Filter = 'all' | Category

export default function ForumsIndexPage() {
  const supabase = createClient()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState<{ category: Category; title: string; body: string }>({
    category: 'general', title: '', body: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)
      await loadThreads()
    }
    init()
  }, [])

  async function loadThreads() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('forum_threads')
      .select('*')
      .order('pinned', { ascending: false })
      .order('latest_reply_at', { ascending: false })
    const list = (rows ?? []) as Thread[]
    if (list.length === 0) { setThreads([]); setLoading(false); return }
    const authorIds = Array.from(new Set(list.map(t => t.author_user_id)))
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', authorIds)
    const nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
    setThreads(list.map(t => ({ ...t, author_username: nameMap[t.author_user_id] ?? 'Unknown' })))
    setLoading(false)
  }

  function startCompose() {
    setDraft({ category: 'general', title: '', body: '' })
    setComposing(true)
  }

  async function handleCreate() {
    if (!myId || !draft.title.trim() || !draft.body.trim() || saving) return
    setSaving(true)
    const { data, error } = await supabase.from('forum_threads').insert({
      author_user_id: myId,
      category: draft.category,
      title: draft.title.trim(),
      body: draft.body.trim(),
    }).select('id').single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setComposing(false)
    if (data?.id) router.push(`/campfire/forums/${data.id}`)
  }

  function formatRelative(iso: string) {
    const d = new Date(iso)
    const ms = Date.now() - d.getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const visible = filter === 'all' ? threads : threads.filter(t => t.category === filter)

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
            Forums
          </div>
          <div style={{ fontSize: '14px', color: '#5a8a40', lineHeight: 1.6 }}>
            Lore, rules questions, session recaps, and everything else.
          </div>
        </div>
        {!composing && (
          <button onClick={startCompose}
            style={{ padding: '9px 16px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + New Thread
          </button>
        )}
      </div>

      {/* Composer */}
      {composing && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #7ab3d4', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 600, color: '#7ab3d4', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
            New Thread
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>Category</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => (
                <button key={c} onClick={() => setDraft(d => ({ ...d, category: c }))}
                  style={{ padding: '6px 14px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${draft.category === c ? CATEGORY_ACCENT[c] : '#3a3a3a'}`, background: draft.category === c ? '#242424' : '#1a1a1a', color: draft.category === c ? CATEGORY_ACCENT[c] : '#d4cfc9' }}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={lbl}>Title</label>
            <input style={inp} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="What's on your mind?" />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Body</label>
            <textarea style={{ ...inp, minHeight: '160px', resize: 'vertical', fontFamily: 'Barlow, sans-serif' }} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleCreate} disabled={!draft.title.trim() || !draft.body.trim() || saving}
              style={{ flex: 1, padding: '9px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: saving ? 'wait' : 'pointer', opacity: (!draft.title.trim() || !draft.body.trim()) ? 0.5 : 1 }}>
              {saving ? 'Posting...' : 'Post Thread'}
            </button>
            <button onClick={() => setComposing(false)}
              style={{ padding: '9px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')}
          style={{ padding: '6px 14px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${filter === 'all' ? '#f5f2ee' : '#3a3a3a'}`, background: filter === 'all' ? '#242424' : '#1a1a1a', color: filter === 'all' ? '#f5f2ee' : '#d4cfc9' }}>
          All
        </button>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => (
          <button key={c} onClick={() => setFilter(c)}
            style={{ padding: '6px 14px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${filter === c ? CATEGORY_ACCENT[c] : '#3a3a3a'}`, background: filter === c ? '#242424' : '#1a1a1a', color: filter === c ? CATEGORY_ACCENT[c] : '#d4cfc9' }}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* Thread list */}
      {loading ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          {filter === 'all' ? 'No threads yet. Start one.' : 'No threads in this category.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visible.map(t => {
            const accent = CATEGORY_ACCENT[t.category]
            return (
              <a key={t.id} href={`/campfire/forums/${t.id}`}
                style={{ display: 'block', textDecoration: 'none', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${accent}`, borderRadius: '4px', padding: '10px 14px' }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#242424'}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = '#1a1a1a'}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  {t.pinned && <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>📌 Pinned</span>}
                  <span style={{ fontSize: '13px', color: accent, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                    {CATEGORY_LABEL[t.category]}
                  </span>
                  {t.locked && <span style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🔒 Locked</span>}
                </div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {t.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cce0f5' }}>
                  <span>by {t.author_username}</span>
                  <span style={{ color: '#5a5550' }}>·</span>
                  <span>{t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'}</span>
                  <span style={{ color: '#5a5550' }}>·</span>
                  <span>{formatRelative(t.latest_reply_at)}</span>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
