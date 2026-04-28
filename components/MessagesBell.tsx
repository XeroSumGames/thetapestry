'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

interface ConvItem {
  conversation_id: string
  // The latest message's sender. May be me — when it is, the headline
  // flips to "You sent <other> a message at ...".
  latest_sender_user_id: string
  latest_sender_username: string
  // Other participants in the conv (excluding me). For 1:1 DMs this is
  // a single name; for group chats we comma-join.
  other_names: string[]
  body: string
  created_at: string
  is_unread: boolean
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

const MAX_ITEMS = 10

export default function MessagesBell() {
  const supabase = createClient()
  const [items, setItems] = useState<ConvItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const userIdRef = useRef<string | null>(null)

  async function loadConversations(uid: string) {
    // 1. My conversations + last_read_at.
    const { data: cpRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', uid)
    if (!cpRows || cpRows.length === 0) { setItems([]); return }

    const convIds = cpRows.map((r: any) => r.conversation_id)
    const myReadMap: Record<string, string | null> = Object.fromEntries(
      cpRows.map((r: any) => [r.conversation_id, r.last_read_at])
    )

    // 2. All participants of those convs (so we can show other-party names
    //    and resolve the latest message's sender username in one round-trip).
    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)
    const userIds = Array.from(new Set((allParticipants ?? []).map((p: any) => p.user_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds)
    const nameMap: Record<string, string> = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id, p.username])
    )

    // 3. Latest message per conversation (any sender, including me — read
    //    items can show "You sent <other> a message at ..."). Parallel
    //    fetch; conv count per user is small enough for this to be fine.
    const latestMap: Record<string, { body: string; created_at: string; sender_user_id: string }> = {}
    await Promise.all(convIds.map(async (cid: string) => {
      const { data } = await supabase
        .from('messages')
        .select('body, created_at, sender_user_id')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) latestMap[cid] = data
    }))

    // 4. Build items, skipping conversations with no messages yet.
    const built: ConvItem[] = convIds
      .filter((cid: string) => !!latestMap[cid])
      .map((cid: string) => {
        const m = latestMap[cid]
        const lastReadAt = myReadMap[cid]
        // Unread iff the latest message is from someone else AND newer
        // than my last_read_at (or I've never read).
        const isUnread = m.sender_user_id !== uid
          && (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt))
        const others = (allParticipants ?? [])
          .filter((p: any) => p.conversation_id === cid && p.user_id !== uid)
          .map((p: any) => nameMap[p.user_id] ?? 'Unknown')
        return {
          conversation_id: cid,
          latest_sender_user_id: m.sender_user_id,
          latest_sender_username: nameMap[m.sender_user_id] ?? 'Someone',
          other_names: others,
          body: m.body,
          created_at: m.created_at,
          is_unread: isUnread,
        }
      })
      .sort((a: ConvItem, b: ConvItem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, MAX_ITEMS)

    setItems(built)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id
      await loadConversations(user.id)

      // Realtime: any new message in a conv I'm in → reload list. Also
      // watch my own last_read_at updates so the bell + bold state clear
      // when I read a thread elsewhere (e.g. in the messages page).
      channelRef.current = supabase.channel(`msgs_bell_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        }, () => {
          if (userIdRef.current) loadConversations(userIdRef.current)
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          if (userIdRef.current) loadConversations(userIdRef.current)
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

  function openConversation(convId: string | null) {
    // Per-row OPEN deep-links to /messages?conv=<id>; the messages page
    // accepts that param and selects the conv on load. Header "View all"
    // passes null and lands on the conversation list. Both open in a new
    // tab — preserves the prior MessagesBell behavior.
    const url = convId ? `/messages?conv=${encodeURIComponent(convId)}` : '/messages'
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  const unreadCount = items.filter(i => i.is_unread).length
  const dim = unreadCount === 0

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        title={dim ? 'Messages — no unread' : `Messages — ${unreadCount} unread`}
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
        {unreadCount > 0 && (
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
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          // Pin to viewport so the dropdown escapes the sidebar's clip.
          // Anchored just below the icon, hard left so it doesn't run
          // off-screen on narrow windows. Matches NotificationBell.
          position: 'fixed',
          top: (ref.current?.getBoundingClientRect().bottom ?? 40) + 4 + 'px',
          left: '10px',
          width: '380px',
          maxWidth: 'calc(100vw - 20px)',
          maxHeight: '420px',
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
            <button onClick={() => openConversation(null)}
              style={{ background: 'none', border: 'none', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
              View all
            </button>
          </div>

          {/* List */}
          {items.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              No messages yet
            </div>
          ) : (
            items.map(it => {
              const myUid = userIdRef.current
              const fromMe = !!myUid && it.latest_sender_user_id === myUid
              // For 1:1 DMs, "<other>". For group chats with N>1 others,
              // join the names so the recipient is identifiable.
              const otherDisplay = it.other_names.length > 0
                ? it.other_names.join(', ')
                : 'Unknown'

              return (
                <div key={it.conversation_id}
                  style={{
                    padding: '10px 12px',
                    background: it.is_unread ? '#111' : 'transparent',
                    borderBottom: '1px solid #2e2e2e',
                    borderLeft: it.is_unread ? '3px solid #c0392b' : '3px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    opacity: it.is_unread ? 1 : 0.78,
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      // Bold the entire headline when unread per Xero's
                      // direction. Read items render at normal weight.
                      fontWeight: it.is_unread ? 700 : 400,
                      color: it.is_unread ? '#f5f2ee' : '#d4cfc9',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}>
                      {fromMe ? (
                        <>
                          You sent{' '}
                          <span style={{ color: '#7fc458' }}>{otherDisplay}</span>
                          {' '}a message at{' '}
                          <span style={{ color: '#cce0f5' }}>{formatHeadline(it.created_at)}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: '#7fc458' }}>{it.latest_sender_username}</span>
                          {' '}sent you a message at{' '}
                          <span style={{ color: '#cce0f5' }}>{formatHeadline(it.created_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button onClick={() => openConversation(it.conversation_id)}
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
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
