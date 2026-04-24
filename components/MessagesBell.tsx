'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'

export default function MessagesBell() {
  const supabase = createClient()
  const router = useRouter()
  const [unread, setUnread] = useState(0)
  const channelRef = useRef<any>(null)
  const userIdRef = useRef<string | null>(null)

  async function countUnread(uid: string) {
    // Count conversations where latest message is newer than last_read_at
    const { data } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', uid)

    if (!data || data.length === 0) { setUnread(0); return }

    let count = 0
    await Promise.all(data.map(async (cp: { conversation_id: string; last_read_at: string | null }) => {
      const { data: msgs } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', cp.conversation_id)
        .neq('sender_user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
      if (msgs && msgs.length > 0) {
        const lastMsg = msgs[0].created_at
        if (!cp.last_read_at || lastMsg > cp.last_read_at) count++
      }
    }))
    setUnread(count)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id
      await countUnread(user.id)

      // Realtime: new message in any conversation I'm in → recount
      channelRef.current = supabase.channel(`msgs_bell_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        }, () => {
          if (userIdRef.current) countUnread(userIdRef.current)
        })
        // Also watch last_read_at updates so badge clears when user reads
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          if (userIdRef.current) countUnread(userIdRef.current)
        })
        .subscribe()
    }
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  return (
    <button
      onClick={() => router.push('/messages')}
      title="Messages"
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
  )
}
