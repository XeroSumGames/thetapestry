'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { renderRichText } from '../../lib/rich-text'
import { useRouter, useSearchParams } from 'next/navigation'

interface Participant {
  user_id: string
  username: string
  last_read_at: string | null
  joined_at: string
}

interface ConversationRow {
  id: string
  created_at: string
  participants: Participant[]
  latest_message: { body: string; created_at: string; sender_user_id: string } | null
  unread: number
  archived_at: string | null
}

interface Message {
  id: string
  conversation_id: string
  sender_user_id: string
  body: string
  created_at: string
}

interface UserResult {
  id: string
  username: string
}

export default function MessagesPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [myId, setMyId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Load user + conversations ──────────────────────────────────
  useEffect(() => {
    async function init() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)
      await loadConversations(user.id)

      // If ?conv=<conversationId> is in the URL, open that conversation
      // directly. Used by the MessagesBell dropdown's per-row OPEN button
      // so a click can deep-link straight into the right thread instead of
      // dumping the user at the conversation list. We trust loadConversations'
      // RLS-filtered list to gate access — only set activeConvId if the user
      // is actually a participant in that conv.
      const convId = searchParams.get('conv')
      if (convId) {
        const { data: myPart } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('conversation_id', convId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (myPart) setActiveConvId(convId)
      }

      // If ?dm=<userId> is in the URL, open or create that DM immediately.
      const dmUserId = searchParams.get('dm')
      if (dmUserId && dmUserId !== user.id) {
        const { data } = await supabase.rpc('get_or_create_dm', { other_user_id: dmUserId })
        if (data) { await loadConversations(user.id); setActiveConvId(data) }
      }
    }
    init()
  }, [])

  async function loadConversations(userId: string) {
    setLoadingConvs(true)
    // Fetch conversations the user is in.
    const { data: cpRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, joined_at, archived_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })

    if (!cpRows || cpRows.length === 0) { setConversations([]); setLoadingConvs(false); return }

    const convIds = cpRows.map((r: any) => r.conversation_id)

    // Fetch all participants for those conversations (to get other user names).
    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, last_read_at, joined_at')
      .in('conversation_id', convIds)

    // Hydrate usernames.
    const allUserIds = [...new Set((allParticipants ?? []).map((p: any) => p.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', allUserIds)
    const profileMap: Record<string, string> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]))

    // Fetch latest message per conversation.
    const latestMap: Record<string, any> = {}
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

    const convs: ConversationRow[] = cpRows.map((row: any) => {
      const parts = (allParticipants ?? [])
        .filter((p: any) => p.conversation_id === row.conversation_id)
        .map((p: any) => ({ ...p, username: profileMap[p.user_id] ?? 'Unknown' }))
      const myPart = parts.find((p: any) => p.user_id === userId)
      const latest = latestMap[row.conversation_id] ?? null
      // Unread = latest message is newer than my last_read_at, and I didn't send it.
      const unread = latest && latest.sender_user_id !== userId
        && (!myPart?.last_read_at || new Date(latest.created_at) > new Date(myPart.last_read_at))
        ? 1 : 0
      return {
        id: row.conversation_id,
        created_at: row.joined_at,
        participants: parts,
        latest_message: latest,
        unread,
        archived_at: row.archived_at ?? null,
      }
    }).sort((a: ConversationRow, b: ConversationRow) => {
      const at = a.latest_message?.created_at ?? a.created_at
      const bt = b.latest_message?.created_at ?? b.created_at
      return new Date(bt).getTime() - new Date(at).getTime()
    })

    setConversations(convs)
    setLoadingConvs(false)
  }

  // ── Open conversation ──────────────────────────────────────────
  useEffect(() => {
    if (!activeConvId || !myId) return
    loadMessages(activeConvId)
    markRead(activeConvId, myId)
    subscribeToMessages(activeConvId)
    return () => { channelRef.current?.unsubscribe() }
  }, [activeConvId])

  async function loadMessages(convId: string) {
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMessages((data ?? []) as Message[])
    setLoadingMsgs(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function markRead(convId: string, userId: string) {
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .eq('user_id', userId)
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, unread: 0 } : c
    ))
  }

  function subscribeToMessages(convId: string) {
    channelRef.current?.unsubscribe()
    channelRef.current = supabase
      .channel(`messages:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload: any) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new as Message]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        if (myId) markRead(convId, myId)
      })
      .subscribe()
  }

  // ── Send ───────────────────────────────────────────────────────
  async function handleSend() {
    if (!body.trim() || !activeConvId || !myId || sending) return
    setSending(true)
    const text = body.trim()
    setBody('')
    await supabase.from('messages').insert({
      conversation_id: activeConvId,
      sender_user_id: myId,
      body: text,
    })
    // Update latest_message preview optimistically.
    setConversations(prev => prev.map(c =>
      c.id === activeConvId
        ? { ...c, latest_message: { body: text, created_at: new Date().toISOString(), sender_user_id: myId } }
        : c
    ))
    setSending(false)
  }

  // ── User search (for starting new DM) ─────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${searchQuery.trim()}%`)
        .neq('id', myId ?? '')
        .limit(8)
      setSearchResults((data ?? []) as UserResult[])
    }, 200)
    return () => clearTimeout(t)
  }, [searchQuery, myId])

  async function openDM(otherUserId: string) {
    const { data, error } = await supabase.rpc('get_or_create_dm', { other_user_id: otherUserId })
    if (error) {
      console.error('get_or_create_dm error:', error)
      alert(`Could not start conversation: ${error.message}`)
      return
    }
    if (data) {
      setSearching(false)
      setSearchQuery('')
      setSearchResults([])
      if (myId) await loadConversations(myId)
      setActiveConvId(data)
    }
  }

  // ── Conversation actions ───────────────────────────────────────
  async function archiveConversation(convId: string) {
    setOpenMenuConvId(null)
    await supabase.from('conversation_participants')
      .update({ archived_at: new Date().toISOString() })
      .eq('conversation_id', convId).eq('user_id', myId)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, archived_at: new Date().toISOString() } : c))
    if (activeConvId === convId) setActiveConvId(null)
  }

  async function unarchiveConversation(convId: string) {
    setOpenMenuConvId(null)
    await supabase.from('conversation_participants')
      .update({ archived_at: null })
      .eq('conversation_id', convId).eq('user_id', myId)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, archived_at: null } : c))
  }

  async function deleteConversation(convId: string) {
    setOpenMenuConvId(null)
    if (!confirm('Delete this conversation? It will be removed for you only.')) return
    await supabase.from('conversation_participants')
      .delete().eq('conversation_id', convId).eq('user_id', myId)
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (activeConvId === convId) setActiveConvId(null)
  }

  async function blockUser(otherUserId: string, convId: string) {
    setOpenMenuConvId(null)
    if (!confirm("Block this user? They won't be able to DM you.")) return
    await supabase.from('user_blocks').insert({ blocker_id: myId, blocked_id: otherUserId })
    await archiveConversation(convId)
  }

  // ── Helpers ───────────────────────────────────────────────────
  function otherParticipants(conv: ConversationRow) {
    return conv.participants.filter(p => p.user_id !== myId)
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // ── Styles ────────────────────────────────────────────────────
  const menuItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '7px 12px', background: 'none', border: 'none',
    color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left',
  }

  const panelBase: React.CSSProperties = {
    background: '#1a1a1a', borderRight: '1px solid #2e2e2e',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }

  const activeConv = conversations.find(c => c.id === activeConvId)
  const activeOther = activeConv ? otherParticipants(activeConv) : []

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'Barlow, sans-serif', background: '#0f0f0f' }}>

      {/* ── Left: conversation list ─────────────────────────── */}
      <div style={{ ...panelBase, width: '280px', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            Messages
          </div>
          <button onClick={() => { setSearching(s => !s); setSearchQuery(''); setSearchResults([]) }}
            title="Start a new conversation"
            style={{ background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: searching ? '#c4a7f0' : '#7fc458', fontSize: '16px', cursor: 'pointer', padding: '2px 8px', lineHeight: 1 }}>
            ✏
          </button>
        </div>

        {/* User search */}
        {searching && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #2e2e2e' }}>
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by username…"
              style={{ width: '100%', padding: '6px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }}
            />
            {searchResults.length > 0 && (
              <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {searchResults.map(u => (
                  <button key={u.id} onClick={() => openDM(u.id)}
                    style={{ padding: '6px 10px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left' }}>
                    {u.username}
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#4d7a35', fontStyle: 'italic' }}>No users found</div>
            )}
          </div>
        )}

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }} onClick={() => openMenuConvId && setOpenMenuConvId(null)}>
          {loadingConvs && (
            <div style={{ padding: '1rem', color: '#4d7a35', fontSize: '13px', textAlign: 'center' }}>Loading…</div>
          )}
          {!loadingConvs && conversations.filter(c => !c.archived_at).length === 0 && !showArchived && (
            <div style={{ padding: '1.5rem 1rem', color: '#4d7a35', fontSize: '13px', textAlign: 'center', lineHeight: 1.6 }}>
              No messages yet.<br />Hit ✏ to start a conversation.
            </div>
          )}
          {conversations
            .filter(c => showArchived ? !!c.archived_at : !c.archived_at)
            .map(conv => {
            const others = otherParticipants(conv)
            const label = others.map(o => o.username).join(', ') || 'Unknown'
            const isActive = conv.id === activeConvId
            const preview = conv.latest_message?.body ?? ''
            const menuOpen = openMenuConvId === conv.id
            return (
              <div key={conv.id} style={{ position: 'relative', borderBottom: '1px solid #1e1e1e' }}>
                <div
                  onClick={() => { setActiveConvId(conv.id); setOpenMenuConvId(null) }}
                  style={{
                    padding: '9px 36px 9px 14px',
                    background: isActive ? '#242424' : 'transparent',
                    borderLeft: `3px solid ${isActive ? '#8b5cf6' : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#1e1e1e' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: conv.unread ? 700 : 400, color: conv.unread ? '#f5f2ee' : '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                    {conv.latest_message && (
                      <span style={{ fontSize: '13px', color: '#4d7a35', flexShrink: 0 }}>
                        {formatTime(conv.latest_message.created_at)}
                      </span>
                    )}
                    {conv.unread > 0 && (
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8b5cf6', flexShrink: 0, display: 'inline-block' }} />
                    )}
                  </div>
                  {preview && (
                    <div style={{ fontSize: '13px', color: '#4d7a35', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.latest_message?.sender_user_id === myId ? 'You: ' : ''}{preview}
                    </div>
                  )}
                </div>
                {/* ⋮ menu trigger */}
                <button
                  onClick={e => { e.stopPropagation(); setOpenMenuConvId(menuOpen ? null : conv.id) }}
                  style={{ position: 'absolute', top: '8px', right: '6px', background: 'none', border: 'none', color: '#4d7a35', fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: '2px 4px', borderRadius: '3px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#7fc458')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4d7a35')}
                  title="Options"
                >⋮</button>
                {/* Dropdown */}
                {menuOpen && (
                  <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '28px', right: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '4px', zIndex: 100, minWidth: '130px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    {conv.archived_at ? (
                      <button onClick={() => unarchiveConversation(conv.id)} style={menuItemStyle}>Unarchive</button>
                    ) : (
                      <button onClick={() => archiveConversation(conv.id)} style={menuItemStyle}>Archive</button>
                    )}
                    <button onClick={() => deleteConversation(conv.id)} style={{ ...menuItemStyle, color: '#f5a89a' }}>Delete</button>
                    {others.length > 0 && (
                      <button onClick={() => blockUser(others[0].user_id, conv.id)} style={{ ...menuItemStyle, color: '#f5a89a' }}>Block {others[0].username}</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {/* Archive toggle */}
          {!loadingConvs && conversations.some(c => c.archived_at) && (
            <button onClick={() => setShowArchived(s => !s)}
              style={{ width: '100%', padding: '8px', background: 'none', border: 'none', color: '#4d7a35', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', borderTop: '1px solid #1e1e1e' }}>
              {showArchived ? '← Back' : `Archived (${conversations.filter(c => c.archived_at).length})`}
            </button>
          )}
        </div>
      </div>

      {/* ── Right: message thread ───────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {!activeConvId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '32px' }}>💬</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', color: '#4d7a35', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              Select a conversation or start a new one
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
                {activeOther.map(o => o.username).join(', ') || 'Conversation'}
              </div>
            </div>

            {/* Send form — at the top for easy access */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #2e2e2e', display: 'flex', gap: '8px', flexShrink: 0 }}>
              <input
                autoFocus
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Send a message… (Enter to send)"
                maxLength={2000}
                style={{ flex: 1, padding: '9px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '20px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', outline: 'none' }}
              />
              <button onClick={handleSend} disabled={!body.trim() || sending}
                style={{ padding: '9px 18px', background: body.trim() ? '#8b5cf6' : '#242424', border: `1px solid ${body.trim() ? '#8b5cf6' : '#3a3a3a'}`, borderRadius: '20px', color: body.trim() ? '#fff' : '#4d7a35', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: body.trim() ? 'pointer' : 'default', transition: 'all .15s', flexShrink: 0 }}>
                Send
              </button>
            </div>

            {/* Messages — spacer pushes content to bottom without the justifyContent overflow bug */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
              <div style={{ flex: 1 }} />
              {loadingMsgs && <div style={{ color: '#4d7a35', fontSize: '13px', textAlign: 'center' }}>Loading…</div>}
              {messages.map((msg, i) => {
                const isMine = msg.sender_user_id === myId
                const prevMsg = messages[i - 1]
                const showSender = !isMine && (!prevMsg || prevMsg.sender_user_id !== msg.sender_user_id)
                const senderName = activeOther.find(o => o.user_id === msg.sender_user_id)?.username ?? 'Unknown'
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    {showSender && (
                      <div style={{ fontSize: '13px', color: '#4d7a35', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', marginBottom: '2px', paddingLeft: '4px' }}>
                        {senderName}
                      </div>
                    )}
                    <div style={{
                      maxWidth: '68%', padding: '8px 12px',
                      background: isMine ? '#2a1a3e' : '#242424',
                      border: `1px solid ${isMine ? '#5a2e5a' : '#2e2e2e'}`,
                      borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      fontSize: '14px', color: '#f5f2ee', lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}>
                      {renderRichText(msg.body, { linkify: true })}
                    </div>
                    <div style={{ fontSize: '13px', color: '#4d7a35', marginTop: '1px', paddingLeft: '4px', paddingRight: '4px' }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
