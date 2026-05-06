'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-browser'
import { getCachedAuth } from '../../../../lib/auth-cache'
import { renderRichText } from '../../../../lib/rich-text'

// /campfire/forums/[id] — thread detail. Original post + reply chain +
// reply composer at the bottom. Authors can edit/delete their own posts;
// other users see a 💬 Message deep-link to /messages?dm=<authorId>.

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
  updated_at: string
}

interface Reply {
  id: string
  thread_id: string
  author_user_id: string
  body: string
  created_at: string
  updated_at: string
}

export default function ForumThreadPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [myId, setMyId] = useState<string | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [editingThread, setEditingThread] = useState(false)
  const [threadDraft, setThreadDraft] = useState({ title: '', body: '', category: 'general' as Category })
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [newReply, setNewReply] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    async function init() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)
      await loadAll()
    }
    init()
  }, [id])

  async function loadAll() {
    setLoading(true)
    const [threadRes, repliesRes] = await Promise.all([
      supabase.from('forum_threads').select('*').eq('id', id).single(),
      supabase.from('forum_replies').select('*').eq('thread_id', id).order('created_at', { ascending: true }),
    ])
    if (!threadRes.data) { router.push('/campfire/forums'); return }
    const t = threadRes.data as Thread
    const rs = (repliesRes.data ?? []) as Reply[]
    setThread(t)
    setReplies(rs)

    const ids = Array.from(new Set([t.author_user_id, ...rs.map(r => r.author_user_id)]))
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids)
    setAuthorNames(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username])))
    setLoading(false)
  }

  function startEditThread() {
    if (!thread) return
    setThreadDraft({ title: thread.title, body: thread.body, category: thread.category })
    setEditingThread(true)
  }

  async function saveThreadEdit() {
    if (!thread) return
    if (!threadDraft.title.trim() || !threadDraft.body.trim()) return
    const { error } = await supabase.from('forum_threads').update({
      title: threadDraft.title.trim(),
      body: threadDraft.body.trim(),
      category: threadDraft.category,
    }).eq('id', thread.id)
    if (error) { alert('Error: ' + error.message); return }
    setEditingThread(false)
    await loadAll()
  }

  async function deleteThread() {
    if (!thread) return
    if (!confirm('Delete this thread? All replies will be removed too.')) return
    const { error } = await supabase.from('forum_threads').delete().eq('id', thread.id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/campfire/forums')
  }

  async function postReply() {
    if (!myId || !thread || !newReply.trim() || posting) return
    setPosting(true)
    const { error } = await supabase.from('forum_replies').insert({
      thread_id: thread.id,
      author_user_id: myId,
      body: newReply.trim(),
    })
    setPosting(false)
    if (error) { alert('Error: ' + error.message); return }
    setNewReply('')
    await loadAll()
  }

  function startEditReply(r: Reply) {
    setEditingReplyId(r.id)
    setReplyDraft(r.body)
  }

  async function saveReplyEdit() {
    if (!editingReplyId || !replyDraft.trim()) return
    const { error } = await supabase.from('forum_replies').update({ body: replyDraft.trim() }).eq('id', editingReplyId)
    if (error) { alert('Error: ' + error.message); return }
    setEditingReplyId(null)
    setReplyDraft('')
    await loadAll()
  }

  async function deleteReply(replyId: string) {
    if (!confirm('Delete this reply?')) return
    const { error } = await supabase.from('forum_replies').delete().eq('id', replyId)
    if (error) { alert('Error: ' + error.message); return }
    await loadAll()
  }

  function formatTimestamp(iso: string) {
    const d = new Date(iso)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading || !thread) {
    return <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontSize: '13px', color: '#cce0f5', textAlign: 'center' }}>Loading...</div>
  }

  const accent = CATEGORY_ACCENT[thread.category]
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee',
    fontSize: '13px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box',
  }

  const renderAuthorRow = (authorId: string, ts: string) => {
    const isMe = authorId === myId
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600 }}>
          {authorNames[authorId] ?? 'Unknown'}
        </span>
        <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTimestamp(ts)}</span>
        {!isMe && (
          <a href={`/messages?dm=${authorId}`}
            style={{ marginLeft: 'auto', padding: '2px 10px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            💬 Message
          </a>
        )}
      </div>
    )
  }

  const isMyThread = thread.author_user_id === myId

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Carlito, sans-serif' }}>

      {/* Back link */}
      <Link href="/campfire/forums" style={{ display: 'inline-block', fontSize: '13px', color: '#cce0f5', textDecoration: 'none', marginBottom: '1rem', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        ← Back to Forums
      </Link>

      {/* Thread header / OP */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${accent}`, borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        {editingThread ? (
          <>
            <div style={{ marginBottom: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => (
                <button key={c} onClick={() => setThreadDraft(d => ({ ...d, category: c }))}
                  style={{ padding: '6px 14px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px', border: `1px solid ${threadDraft.category === c ? CATEGORY_ACCENT[c] : '#3a3a3a'}`, background: threadDraft.category === c ? '#242424' : '#1a1a1a', color: threadDraft.category === c ? CATEGORY_ACCENT[c] : '#d4cfc9' }}>
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
            <input style={{ ...inp, marginBottom: '8px' }} value={threadDraft.title} onChange={e => setThreadDraft(d => ({ ...d, title: e.target.value }))} />
            <textarea style={{ ...inp, minHeight: '160px', resize: 'vertical', marginBottom: '8px' }} value={threadDraft.body} onChange={e => setThreadDraft(d => ({ ...d, body: e.target.value }))} />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={saveThreadEdit} disabled={!threadDraft.title.trim() || !threadDraft.body.trim()}
                style={{ padding: '7px 16px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Save
              </button>
              <button onClick={() => setEditingThread(false)}
                style={{ padding: '7px 16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {thread.pinned && <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>📌 Pinned</span>}
              <span style={{ fontSize: '13px', color: accent, fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                {CATEGORY_LABEL[thread.category]}
              </span>
              {thread.locked && <span style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>🔒 Locked</span>}
            </div>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '24px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '10px' }}>
              {thread.title}
            </div>
            {renderAuthorRow(thread.author_user_id, thread.created_at)}
            <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
              {renderRichText(thread.body, { linkify: true })}
            </div>
            {isMyThread && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={startEditThread}
                  style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={deleteThread}
                  style={{ padding: '5px 12px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Replies */}
      <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', color: '#cce0f5', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
        {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.25rem' }}>
        {replies.map(r => {
          const isMine = r.author_user_id === myId
          const editing = editingReplyId === r.id
          return (
            <div key={r.id} style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px 14px' }}>
              {renderAuthorRow(r.author_user_id, r.created_at)}
              {editing ? (
                <>
                  <textarea style={{ ...inp, minHeight: '100px', resize: 'vertical', marginBottom: '8px' }} value={replyDraft} onChange={e => setReplyDraft(e.target.value)} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={saveReplyEdit} disabled={!replyDraft.trim()}
                      style={{ padding: '5px 12px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Save
                    </button>
                    <button onClick={() => { setEditingReplyId(null); setReplyDraft('') }}
                      style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: isMine ? '8px' : '0' }}>
                    {renderRichText(r.body, { linkify: true })}
                  </div>
                  {isMine && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => startEditReply(r)}
                        style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => deleteReply(r.id)}
                        style={{ padding: '4px 10px', background: '#242424', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Reply composer */}
      {thread.locked ? (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '14px', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>
          🔒 This thread is locked. No new replies.
        </div>
      ) : (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #7ab3d4', borderRadius: '4px', padding: '12px 14px' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', fontWeight: 600, color: '#7ab3d4', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Reply
          </div>
          <textarea style={{ ...inp, minHeight: '110px', resize: 'vertical', marginBottom: '8px' }} value={newReply} onChange={e => setNewReply(e.target.value)} placeholder="Write a reply..." />
          <button onClick={postReply} disabled={!newReply.trim() || posting}
            style={{ padding: '8px 18px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: posting ? 'wait' : 'pointer', opacity: !newReply.trim() ? 0.5 : 1 }}>
            {posting ? 'Posting...' : 'Post Reply'}
          </button>
        </div>
      )}
    </div>
  )
}
