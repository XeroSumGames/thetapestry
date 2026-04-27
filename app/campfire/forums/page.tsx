'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

// /campfire/forums — Discourse-style index. Avatar bubble + category pill
// + title + first-line excerpt on the left; reply count + latest activity
// on the right. Pinned threads float to the top; rest sort by latest_reply_at.

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

// Deterministic avatar tint from a user id so each author gets a consistent
// color without us having to store one. Hash-mod into a curated palette.
const AVATAR_PALETTE = [
  '#b87333', '#7ab3d4', '#8b5cf6', '#7fc458', '#EF9F27',
  '#c0392b', '#1abc9c', '#e67e22', '#9b59b6', '#3498db',
]
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
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
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const visible = filter === 'all' ? threads : threads.filter(t => t.category === filter)
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: threads.length, lore: 0, rules: 0, 'session-recaps': 0, general: 0 }
    threads.forEach(t => { c[t.category]++ })
    return c
  }, [threads])

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
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
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
            style={{ padding: '9px 16px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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

      {/* Filter chips with per-category counts */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <FilterChip
          label="All"
          count={counts.all}
          accent="#f5f2ee"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => (
          <FilterChip
            key={c}
            label={CATEGORY_LABEL[c]}
            count={counts[c]}
            accent={CATEGORY_ACCENT[c]}
            active={filter === c}
            onClick={() => setFilter(c)}
          />
        ))}
      </div>

      {/* Thread list — Discourse-style row: avatar + (pill, title, excerpt) + meta-stack */}
      {loading ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          {filter === 'all' ? 'No threads yet. Start one.' : 'No threads in this category.'}
        </div>
      ) : (
        <div style={{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: '6px', overflow: 'hidden' }}>
          {visible.map((t, i) => {
            const accent = CATEGORY_ACCENT[t.category]
            const initial = (t.author_username || '?').charAt(0).toUpperCase()
            const tint = avatarColor(t.author_user_id)
            const excerpt = t.body.replace(/\s+/g, ' ').trim().slice(0, 140)
            return (
              <a key={t.id} href={`/campfire/forums/${t.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto',
                  gap: '14px',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid #242424',
                  textDecoration: 'none',
                  background: '#141414',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#1c1c1c'}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = '#141414'}
              >
                {/* Avatar bubble — author initial in a tinted circle */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${tint}, ${tint}aa)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
                  fontSize: '17px', color: '#0f0f0f',
                  border: '1px solid #2e2e2e',
                }}>
                  {initial}
                </div>

                {/* Middle: pill row + title + excerpt */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    {/* Category pill */}
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      background: `${accent}22`,
                      color: accent,
                      border: `1px solid ${accent}55`,
                      borderRadius: '999px',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                    }}>
                      {CATEGORY_LABEL[t.category]}
                    </span>
                    {t.pinned && <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>📌 Pinned</span>}
                    {t.locked && <span style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🔒 Locked</span>}
                    <span style={{ fontSize: '13px', color: '#cce0f5' }}>· {t.author_username}</span>
                  </div>
                  <div style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#f5f2ee',
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.title}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#9aa5b0',
                    lineHeight: 1.45,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {excerpt || '—'}
                  </div>
                </div>

                {/* Right: replies + relative time, stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', minWidth: '70px' }}>
                  <div style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: t.reply_count > 0 ? '#f5f2ee' : '#5a5550',
                    letterSpacing: '.04em',
                    lineHeight: 1,
                  }}>
                    {t.reply_count}
                  </div>
                  <div style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '13px',
                    color: '#cce0f5',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                  }}>
                    {t.reply_count === 1 ? 'reply' : 'replies'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7a7570', marginTop: '2px' }}>
                    {formatRelative(t.latest_reply_at)}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, count, accent, active, onClick }: {
  label: string; count: number; accent: string; active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px',
        fontSize: '13px',
        fontFamily: 'Barlow Condensed, sans-serif',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        borderRadius: '999px',
        border: `1px solid ${active ? accent : '#3a3a3a'}`,
        background: active ? `${accent}22` : '#1a1a1a',
        color: active ? accent : '#d4cfc9',
      }}>
      <span>{label}</span>
      <span style={{
        background: active ? `${accent}33` : '#242424',
        color: active ? accent : '#9aa5b0',
        padding: '1px 7px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 700,
      }}>{count}</span>
    </button>
  )
}
