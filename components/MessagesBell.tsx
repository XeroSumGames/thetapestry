'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

interface UnreadItem {
  conversation_id: string
  sender_user_id: string
  sender_username: string
  body: string
  created_at: string
}

// Headline format requested by the user — "08.43pm on 4/28/2026":
// - lowercase am/pm
// - period (not colon) between hours and minutes
// - zero-padded hours
// - m/d/yyyy date (no leading zeros)
function formatHeadline(iso: string): string {
  const d = new Date(iso)
  let h = d.getHours()
  const min = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12
  if (h === 0) h = 12
  const hh = String(h).padStart(2, '0')
  const mm = String(min).padStart(2, '0')
  const date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  return `${hh}.${mm}${ampm} on ${date}`
}

export default function MessagesBell() {
  const supabase = createClient()
  const [items, setItems] = useState<UnreadItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const userIdRef = useRef<string | null>(null)

  async function loadUnread(uid: string) {
    // 1. Conversations I'm in + my last_read_at per conversation.
    const { data: cpRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', uid)
    if (!cpRows || cpRows.length === 0) { setItems([]); return }

    const convIds = cpRows.map((r: any) => r.conversation_id)

    // 2. Latest message NOT from me, per conversation. Run in parallel —
    //    Supabase doesn't have a one-shot "latest per group" without
    //    leaning on a view, and conversation count per user is small.
    const latestMap: Record<string, { body: string; created_at: string; sender_user_id: string }> = {}
    await Promise.all(convIds.map(async (cid: string) => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('body, created_at, sender_user_id')
        .eq('conversation_id', cid)
        .neq('sender_user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
      if (msgs && msgs.length > 0) latestMap[cid] = msgs[0]
    }))

    // 3. Filter to unread: latest non-me message is newer than my
    //    last_read_at (or last_read_at is null = never read).
    const unreadRows = cpRows.filter((r: any) => {
      const m = latestMap[r.conversation_id]
      if (!m) return false
      return !r.last_read_at || new Date(m.created_at) > new Date(r.last_read_at)
    })

    if (unreadRows.length === 0) { setItems([]); return }

    // 4. Resolve sender usernames in one round-trip.
    const senderIds = Array.from(new Set(unreadRows.map((r: any) => latestMap[r.conversation_id].sender_user_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', senderIds)
    const nameMap: Record<string, string> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))

    const built: UnreadItem[] = unreadRows.map((r: any) => {
      const m = latestMap[r.conversation_id]
      return {
        conversation_id: r.conversation_id,
        sender_user_id: m.sender_user_id,
        sender_username: nameMap[m.sender_user_id] ?? 'Someone',
        body: m.body,
        created_at: m.created_at,
      }
    }).sort((a: UnreadItem, b: UnreadItem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setItems(built)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id
      await loadUnread(user.id)

      // Realtime: new message anywhere → recount; my last_read_at update → recount.
      // Same triggers as the previous count-only implementation; the
      // recount now also rebuilds the dropdown's item list.
      channelRef.current = supabase.channel(`msgs_bell_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        }, () => {
          if (userIdRef.current) loadUnread(userIdRef.current)
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          if (userIdRef.current) loadUnread(userIdRef.current)
        })
        .subscribe()
    }
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  // Close dropdown on outside click — same pattern as NotificationBell.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function openMessages() {
    // Match prior MessagesBell behavior — /messages opens in a new tab.
    window.open('/messages', '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  const unread = items.length
  const dim = unread === 0

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        title={dim ? 'Messages — no unread' : `Messages — ${unread} unread`}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          color: '#aaa',
          fontSize: '16px',
          lineHeight: 1,
          marginRight: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          opacity: dim ? 0.45 : 1,
          filter: dim ? 'grayscale(1)' : 'none',
          transition: 'opacity 0.15s, filter 0.15s',
        }}
      >
        💬
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: '#c0392b',
            color: '#fff',
            fontSize: '13px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: 700,
            borderRadius: '8px',
            padding: '0 4px',
            lineHeight: '14px',
            minWidth: '14px',
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          // Pin to viewport like NotificationBell so the dropdown
          // escapes the sidebar's clipping. Anchored just below the
          // icon, hard left so it doesn't run off-screen on narrow
          // windows. Matches NotificationBell's left:10px convention.
          position: 'fixed',
          top: (ref.current?.getBoundingClientRect().bottom ?? 40) + 4 + 'px',
          left: '10px',
          width: '360px',
          maxWidth: 'calc(100vw - 20px)',
          maxHeight: '400px',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: '#1a1a1a',
          border: '1px solid #3a3a3a',
          borderRadius: '4px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          zIndex: 9999,
          boxSizing: 'border-box',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #2e2e2e' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>Messages</span>
            <button onClick={openMessages}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
              View all
            </button>
          </div>

          {/* List */}
          {items.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              No new messages
            </div>
          ) : (
            items.map(it => (
              <div key={it.conversation_id}
                style={{
                  padding: '10px 12px',
                  background: '#111',
                  borderBottom: '1px solid #2e2e2e',
                  borderLeft: '3px solid #c0392b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#f5f2ee',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }}>
                    <span style={{ color: '#7fc458', fontWeight: 700 }}>{it.sender_username}</span>
                    {' '}sent you a message at{' '}
                    <span style={{ color: '#cce0f5' }}>{formatHeadline(it.created_at)}</span>
                  </div>
                </div>
                <button onClick={openMessages}
                  style={{
                    flexShrink: 0,
                    padding: '5px 14px',
                    background: '#242424',
                    border: '1px solid #3a3a3a',
                    borderRadius: '3px',
                    color: '#cce0f5',
                    fontSize: '13px',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}>
                  Open
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
