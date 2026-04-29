'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter } from 'next/navigation'

// /campfire/forums2 — Reddit/Lemmy-style mockup of the same forum data, for
// player feedback. Votes are LOCAL STATE ONLY — they reset on refresh and
// don't persist anywhere. If we choose this direction we'll add a votes
// table + RLS in a follow-up. The existing forum_threads / forum_replies
// tables drive the content; clicking a thread routes to the existing
// /campfire/forums/[id] reader so the reading experience is consistent.

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

interface ThreadWithMeta extends Thread {
  author_username: string
  seed_score: number   // deterministic baseline so threads look varied
}

type Filter = 'all' | Category
type Sort = 'hot' | 'new' | 'top'

// Hash a string to a small int for deterministic seeded values.
function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// Pseudo-score: reply_count * 3 + hash mod 90, biased so most threads land
// 0–120 and the busiest thread gets the highest. Pinned threads get +50.
function seedScore(t: Thread) {
  const base = t.reply_count * 3 + (hashStr(t.id) % 90)
  return t.pinned ? base + 50 : base
}

export default function Forums2Page() {
  const supabase = createClient()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('hot')

  // Local-only vote state: thread id -> +1 / -1 / 0. Reset on refresh.
  const [myVote, setMyVote] = useState<Record<string, 1 | -1 | 0>>({})

  useEffect(() => {
    async function init() {
      const { user } = await getCachedAuth()
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
    const list = (rows ?? []) as Thread[]
    if (list.length === 0) { setThreads([]); setLoading(false); return }
    const authorIds = Array.from(new Set(list.map(t => t.author_user_id)))
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', authorIds)
    const nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
    setThreads(list.map(t => ({
      ...t,
      author_username: nameMap[t.author_user_id] ?? 'Unknown',
      seed_score: seedScore(t),
    })))
    setLoading(false)
  }

  function castVote(id: string, dir: 1 | -1) {
    setMyVote(v => ({ ...v, [id]: v[id] === dir ? 0 : dir }))
  }

  function effectiveScore(t: ThreadWithMeta) {
    const v = myVote[t.id] ?? 0
    return t.seed_score + v
  }

  const sorted = useMemo(() => {
    const filtered = filter === 'all' ? threads : threads.filter(t => t.category === filter)
    const arr = [...filtered]
    if (sort === 'hot') {
      // Hot = score weighted by recency. Score / max(age_hours, 2)^0.5
      arr.sort((a, b) => {
        const ageA = Math.max((Date.now() - new Date(a.latest_reply_at).getTime()) / 3600_000, 2)
        const ageB = Math.max((Date.now() - new Date(b.latest_reply_at).getTime()) / 3600_000, 2)
        const hotA = effectiveScore(a) / Math.sqrt(ageA)
        const hotB = effectiveScore(b) / Math.sqrt(ageB)
        return hotB - hotA
      })
    } else if (sort === 'new') {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else {
      arr.sort((a, b) => effectiveScore(b) - effectiveScore(a))
    }
    return arr
  }, [threads, filter, sort, myVote])

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

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            Forums
          </div>
          <span style={{
            padding: '2px 10px',
            background: '#1a3a5c',
            color: '#7ab3d4',
            border: '1px solid #7ab3d4',
            borderRadius: '999px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
          }}>
            Preview · Style B
          </span>
        </div>
        <div style={{ fontSize: '14px', color: '#5a8a40', lineHeight: 1.6 }}>
          Reddit-style preview. Votes are local-only (reset on refresh) — let us know what you think.
        </div>
      </div>

      {/* Sort + filter row */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: '#141414',
        border: '1px solid #2e2e2e',
        borderRadius: '6px',
        padding: '10px 12px',
        marginBottom: '1rem',
      }}>
        {/* Sort segmented control */}
        <div style={{ display: 'flex', gap: '0', border: '1px solid #3a3a3a', borderRadius: '4px', overflow: 'hidden' }}>
          {(['hot', 'new', 'top'] as Sort[]).map((s, i) => (
            <button key={s} onClick={() => setSort(s)}
              style={{
                padding: '6px 14px',
                background: sort === s ? '#1a3a5c' : 'transparent',
                color: sort === s ? '#7ab3d4' : '#d4cfc9',
                border: 'none',
                borderLeft: i === 0 ? 'none' : '1px solid #3a3a3a',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}>
              {s === 'hot' ? '🔥 Hot' : s === 'new' ? '✨ New' : '⭐ Top'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <FilterChip label="All" accent="#f5f2ee" active={filter === 'all'} onClick={() => setFilter('all')} />
          {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => (
            <FilterChip key={c} label={CATEGORY_LABEL[c]} accent={CATEGORY_ACCENT[c]} active={filter === c} onClick={() => setFilter(c)} />
          ))}
        </div>
      </div>

      {/* Card feed */}
      {loading ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : sorted.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', textAlign: 'center', padding: '2rem', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          {filter === 'all' ? 'No threads yet.' : 'No threads in this category.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sorted.map(t => {
            const accent = CATEGORY_ACCENT[t.category]
            const v = myVote[t.id] ?? 0
            const score = effectiveScore(t)
            const excerpt = t.body.replace(/\s+/g, ' ').trim().slice(0, 220)
            return (
              <div key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr',
                  background: '#141414',
                  border: '1px solid #2e2e2e',
                  borderRadius: '6px',
                  overflow: 'hidden',
                }}>
                {/* Vote rail */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '2px',
                  padding: '10px 0',
                  background: '#0f0f0f',
                  borderRight: '1px solid #242424',
                }}>
                  <button
                    onClick={() => castVote(t.id, 1)}
                    aria-label="Upvote"
                    style={{
                      background: v === 1 ? '#7fc45822' : 'transparent',
                      border: 'none',
                      color: v === 1 ? '#7fc458' : '#9aa5b0',
                      fontSize: '18px',
                      cursor: 'pointer',
                      width: '32px',
                      height: '28px',
                      borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >▲</button>
                  <div style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: v === 1 ? '#7fc458' : v === -1 ? '#f5a89a' : '#f5f2ee',
                    letterSpacing: '.04em',
                    minWidth: '32px',
                    textAlign: 'center',
                  }}>
                    {score}
                  </div>
                  <button
                    onClick={() => castVote(t.id, -1)}
                    aria-label="Downvote"
                    style={{
                      background: v === -1 ? '#f5a89a22' : 'transparent',
                      border: 'none',
                      color: v === -1 ? '#f5a89a' : '#9aa5b0',
                      fontSize: '18px',
                      cursor: 'pointer',
                      width: '32px',
                      height: '28px',
                      borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >▼</button>
                </div>

                {/* Body */}
                <a href={`/campfire/forums/${t.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block', padding: '12px 14px' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#1c1c1c'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
                >
                  {/* Top meta row: subreddit-style category + author + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap', fontSize: '13px' }}>
                    <span style={{
                      color: accent,
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                    }}>
                      r/{CATEGORY_LABEL[t.category].toLowerCase().replace(/\s+/g, '-')}
                    </span>
                    <span style={{ color: '#5a5550' }}>·</span>
                    <span style={{ color: '#9aa5b0' }}>posted by</span>
                    <span style={{ color: '#cce0f5', fontWeight: 600 }}>u/{t.author_username}</span>
                    <span style={{ color: '#5a5550' }}>·</span>
                    <span style={{ color: '#7a7570' }}>{formatRelative(t.created_at)}</span>
                    {t.pinned && <span style={{ marginLeft: '4px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>📌 Pinned</span>}
                    {t.locked && <span style={{ marginLeft: '4px', color: '#f5a89a', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🔒 Locked</span>}
                  </div>

                  {/* Title */}
                  <div style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#f5f2ee',
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    lineHeight: 1.25,
                    marginBottom: '6px',
                  }}>
                    {t.title}
                  </div>

                  {/* Excerpt */}
                  <div style={{
                    fontSize: '14px',
                    color: '#cce0f5',
                    lineHeight: 1.5,
                    marginBottom: '10px',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {excerpt}
                  </div>

                  {/* Action row */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px',
                      background: '#1a1a1a',
                      borderRadius: '4px',
                      fontSize: '13px',
                      color: '#cce0f5',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}>
                      💬 {t.reply_count} {t.reply_count === 1 ? 'comment' : 'comments'}
                    </span>
                    <span style={{
                      fontSize: '13px',
                      color: '#7a7570',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                    }}>
                      Last activity {formatRelative(t.latest_reply_at)}
                    </span>
                  </div>
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, accent, active, onClick }: {
  label: string; accent: string; active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: '13px',
        fontFamily: 'Barlow Condensed, sans-serif',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        borderRadius: '999px',
        border: `1px solid ${active ? accent : '#3a3a3a'}`,
        background: active ? `${accent}22` : '#1a1a1a',
        color: active ? accent : '#d4cfc9',
        fontWeight: 700,
      }}>
      {label}
    </button>
  )
}
