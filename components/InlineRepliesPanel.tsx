'use client'
// Phase 4E — inline-expand reply panel for War Stories + LFG. Mirrors
// the Forums thread-detail reply UX (flat list ordered ASC by
// created_at + textarea composer at the bottom) but lives inline
// inside a parent feed card that toggles open/closed.
//
// The parent passes the table + FK column for both the replies AND
// the parent counter (to keep pagination cursors / latest_reply_at
// monotonic). Trigger handles the count bump server-side; this
// component just inserts and re-fetches.

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { renderRichText } from '../lib/rich-text'

interface ReplyRow {
  id: string
  author_user_id: string
  body: string
  created_at: string
  updated_at: string
}

interface ReplyWithAuthor extends ReplyRow {
  author_username: string
}

interface Props {
  table: 'war_story_replies' | 'lfg_post_replies'
  fkColumn: 'war_story_id' | 'post_id'
  parentId: string
  /** Current authed user; null = no composer (read-only). */
  userId: string | null
  /** Callback after a successful reply insert/delete so the parent
   *  card can refresh its reply_count badge. Receives the +/- delta. */
  onReplyCountChange?: (delta: number) => void
}

export default function InlineRepliesPanel({
  table, fkColumn, parentId, userId, onReplyCountChange,
}: Props) {
  const supabase = createClient()
  const [replies, setReplies] = useState<ReplyWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<string>('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const { data: rows } = await supabase
        .from(table)
        .select('*')
        .eq(fkColumn, parentId)
        .order('created_at', { ascending: true })
      const list = (rows ?? []) as ReplyRow[]
      if (list.length === 0) {
        if (alive) { setReplies([]); setLoading(false) }
        return
      }
      const ids = Array.from(new Set(list.map(r => r.author_user_id)))
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', ids)
      const nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
      if (alive) {
        setReplies(list.map(r => ({ ...r, author_username: nameMap[r.author_user_id] ?? 'Unknown' })))
        setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [parentId])

  async function handlePost() {
    if (!userId || posting || !draft.trim()) return
    setPosting(true)
    const body = draft.trim()
    const { data, error } = await supabase
      .from(table)
      .insert({ [fkColumn]: parentId, author_user_id: userId, body } as any)
      .select('*')
      .single()
    if (error || !data) {
      alert('Reply failed: ' + (error?.message ?? 'unknown'))
      setPosting(false)
      return
    }
    // Hydrate the new row's username from cache or single fetch.
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle()
    const username = (prof as any)?.username ?? 'You'
    setReplies(prev => [...prev, { ...(data as any), author_username: username }])
    setDraft('')
    onReplyCountChange?.(+1)
    setPosting(false)
  }

  async function handleDelete(replyId: string) {
    if (!userId) return
    if (!confirm('Delete this reply?')) return
    const { error } = await supabase.from(table).delete().eq('id', replyId)
    if (error) { alert('Delete failed: ' + error.message); return }
    setReplies(prev => prev.filter(r => r.id !== replyId))
    onReplyCountChange?.(-1)
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div style={{ marginTop: '12px', padding: '10px 12px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>
        💬 Replies
      </div>
      {loading ? (
        <div style={{ fontSize: '13px', color: '#9aa5b0', fontStyle: 'italic' }}>Loading…</div>
      ) : replies.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#9aa5b0', fontStyle: 'italic' }}>No replies yet — be the first.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {replies.map(r => {
            const isMine = r.author_user_id === userId
            return (
              <div key={r.id} style={{ padding: '8px 10px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${isMine ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: isMine ? '#7ab3d4' : '#cce0f5', fontWeight: 700, letterSpacing: '.04em' }}>
                    {r.author_username}{isMine ? ' (you)' : ''}
                  </span>
                  <span style={{ fontSize: '13px', color: '#5a5550' }}>·</span>
                  <span style={{ fontSize: '13px', color: '#9aa5b0' }}>{fmt(r.created_at)}</span>
                  <div style={{ flex: 1 }} />
                  {isMine && (
                    <button onClick={() => handleDelete(r.id)} title="Delete reply"
                      style={{ background: 'transparent', border: 'none', color: '#5a5550', fontSize: '13px', cursor: 'pointer', padding: '0 4px' }}>×</button>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {renderRichText(r.body, { linkify: true })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {userId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '6px', borderTop: '1px dashed #2e2e2e' }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="Write a reply…"
            style={{ width: '100%', minHeight: '60px', resize: 'vertical', padding: '6px 10px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', lineHeight: 1.5 }} />
          <div>
            <button onClick={handlePost} disabled={posting || !draft.trim()}
              style={{ padding: '6px 16px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: posting ? 'wait' : 'pointer', opacity: draft.trim() ? 1 : 0.5, fontWeight: 600 }}>
              {posting ? 'Posting…' : 'Post reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
