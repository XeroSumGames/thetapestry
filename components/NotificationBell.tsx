'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../lib/supabase-browser'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Fetch recent notifications
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      const items = data ?? []
      setNotifications(items)
      setUnreadCount(items.filter((n: any) => !n.read).length)

      // Subscribe to new notifications
      channelRef.current = supabase.channel(`notif_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload: any) => {
          const newNotif = payload.new as Notification
          setNotifications(prev => [newNotif, ...prev].slice(0, 10))
          setUnreadCount(prev => prev + 1)
        })
        .subscribe()
    }
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markAsRead(id: string) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
    if (error) { console.error('[NotificationBell] markAsRead error:', error.message); return }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllAsRead() {
    if (!userId) return
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    if (error) { console.error('[NotificationBell] markAllAsRead error:', error.message); return }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    setOpen(false)
  }

  async function deleteNotification(id: string) {
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) { console.error('[NotificationBell] delete error:', error.message); return }
    setNotifications(prev => {
      const removed = prev.find(n => n.id === id)
      if (removed && !removed.read) setUnreadCount(c => Math.max(0, c - 1))
      return prev.filter(n => n.id !== id)
    })
  }

  async function deleteAll() {
    if (!userId) return
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId)
    if (error) { console.error('[NotificationBell] deleteAll error:', error.message); return }
    setNotifications([])
    setUnreadCount(0)
    setOpen(false)
  }

  function handleNotifClick(n: Notification) {
    if (!n.read) markAsRead(n.id)
    if (n.link) window.location.href = n.link
    setOpen(false)
  }

  function colorizeBody(body: string, type: string): React.ReactNode {
    // "X joined Y as Z" or "X is now playing as Z in Y"
    if (type === 'player_joined') {
      const matchAs = body.match(/^(.+?) joined (.+?) as (.+)$/)
      if (matchAs) return <><span style={{ color: '#7fc458' }}>{matchAs[1]}</span> joined <span style={{ color: '#c0392b' }}>{matchAs[2]}</span> as <span style={{ color: '#7ab3d4' }}>{matchAs[3]}</span></>
      const matchPlaying = body.match(/^(.+?) is now playing as (.+?) in (.+)$/)
      if (matchPlaying) return <><span style={{ color: '#7fc458' }}>{matchPlaying[1]}</span> is now playing as <span style={{ color: '#7ab3d4' }}>{matchPlaying[2]}</span> in <span style={{ color: '#c0392b' }}>{matchPlaying[3]}</span></>
      const matchWith = body.match(/^(.+?) joined (.+?) with (.+)$/)
      if (matchWith) return <><span style={{ color: '#7fc458' }}>{matchWith[1]}</span> joined <span style={{ color: '#c0392b' }}>{matchWith[2]}</span> as <span style={{ color: '#7ab3d4' }}>{matchWith[3]}</span></>
      const match = body.match(/^(.+?) joined (.+)$/)
      if (match) return <><span style={{ color: '#7fc458' }}>{match[1]}</span> joined <span style={{ color: '#c0392b' }}>{match[2]}</span></>
    }
    // "X has left Y"
    if (type === 'player_left') {
      const match = body.match(/^(.+?) has left (.+)$/)
      if (match) return <><span style={{ color: '#f5a89a' }}>{match[1]}</span> has left <span style={{ color: '#c0392b' }}>{match[2]}</span></>
    }
    // "Your GM has opened Session N in Y"
    if (type === 'session_opened') {
      const match = body.match(/^(.+? Session \d+) in (.+)$/)
      if (match) return <>{match[1]} in <span style={{ color: '#c0392b' }}>{match[2]}</span></>
    }
    // "X just signed up"
    if (type === 'new_survivor') {
      const match = body.match(/^(.+?) just signed up$/)
      if (match) return <><span style={{ color: '#7fc458' }}>{match[1]}</span> just signed up</>
    }
    // "X submitted a pin: Y" or "X submitted an NPC: Y"
    if (type === 'moderation_pin' || type === 'moderation_npc') {
      const match = body.match(/^(.+?) submitted (?:a pin|an NPC): (.+)$/)
      if (match) return <><span style={{ color: '#7fc458' }}>{match[1]}</span> submitted: <span style={{ color: '#EF9F27' }}>{match[2]}</span></>
    }
    // "Your pin "X" has been approved/rejected"
    if (type === 'rumor_approved') {
      const match = body.match(/Your pin [""]?(.+?)[""]? has been approved/)
      if (match) return <>Your pin <span style={{ color: '#EF9F27' }}>{match[1]}</span> has been approved and is now visible on the world map</>
    }
    if (type === 'rumor_rejected') {
      const match = body.match(/Your pin [""]?(.+?)[""]? has been reviewed/)
      if (match) return <>Your pin <span style={{ color: '#EF9F27' }}>{match[1]}</span> has been reviewed and was not approved</>
    }
    return body
  }

  if (!userId) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(prev => !prev)}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={unreadCount > 0 ? '#EF9F27' : '#3a3a3a'} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C10.9 2 10 2.9 10 4C10 4.1 10 4.2 10 4.3C7.7 5.1 6 7.3 6 10V16L4 18V19H20V18L18 16V10C18 7.3 16.3 5.1 14 4.3C14 4.2 14 4.1 14 4C14 2.9 13.1 2 12 2ZM12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22Z"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-2px', right: '0',
            background: '#c0392b', color: '#fff', fontSize: '9px',
            fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
            minWidth: '16px', height: '16px', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed', top: (ref.current?.getBoundingClientRect().bottom ?? 40) + 4 + 'px', left: '10px',
          width: '320px', maxHeight: '400px', overflowY: 'auto',
          background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 9999,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #2e2e2e' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>Notifications</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead}
                  style={{ background: 'none', border: 'none', color: '#7ab3d4', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={deleteAll}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Delete all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#3a3a3a', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              No notifications yet
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} onClick={() => handleNotifClick(n)}
                style={{
                  padding: '10px 12px',
                  background: n.read ? 'transparent' : '#111',
                  borderBottom: '1px solid #2e2e2e',
                  cursor: n.link ? 'pointer' : 'default',
                  borderLeft: n.read ? '3px solid transparent' : '3px solid #c0392b',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : '#111')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{n.title}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#cce0f5' }}>{timeAgo(n.created_at)}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id) }}
                      style={{ background: 'none', border: 'none', color: '#3a3a3a', fontSize: '14px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f5a89a')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>
                      ✕
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.4, textAlign: 'left' }}>{colorizeBody(n.body, n.type)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
