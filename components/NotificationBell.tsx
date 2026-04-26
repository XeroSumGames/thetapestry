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
  // Phase E Sprint 4 — structured payload for action-bearing
  // notifications (encounters, link proposals, etc). Carries
  // encounter_id / link_id / world_community_id so the inline
  // Accept/Decline buttons can target the right row without
  // parsing the body text.
  metadata?: Record<string, any> | null
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
  // Phase E Sprint 4c — once the user accepts or declines an action
  // notification (encounter / link proposal), drop it into this set
  // so the inline buttons hide. Keyed by notification id; cleared on
  // bell-init reload.
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set())
  const [actingId, setActingId] = useState<string | null>(null)
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

  // Phase E Sprint 4c — Accept / Decline handlers for action-bearing
  // notifications. The metadata jsonb on the notification carries
  // the underlying row id (encounter_id or link_id). The actual
  // status flip happens on community_encounters / world_community_links;
  // RLS gates the recipient (us) so the update will succeed only if
  // we're the source community's GM.
  async function handleEncounterAction(n: Notification, accepted: boolean) {
    const encounterId = n.metadata?.encounter_id as string | undefined
    if (!encounterId) return
    setActingId(n.id)
    const { error } = await supabase
      .from('community_encounters')
      .update({
        status: accepted ? 'accepted' : 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('id', encounterId)
    setActingId(null)
    if (error) { alert(`Action failed: ${error.message}`); return }
    setActionedIds(prev => { const next = new Set(prev); next.add(n.id); return next })
    if (!n.read) markAsRead(n.id)
  }

  async function handleMigrationAction(n: Notification, accepted: boolean) {
    const migrationId = n.metadata?.migration_id as string | undefined
    if (!migrationId) return
    setActingId(n.id)
    const { error } = await supabase
      .from('community_migrations')
      .update({
        status: accepted ? 'accepted' : 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('id', migrationId)
    setActingId(null)
    if (error) { alert(`Action failed: ${error.message}`); return }
    setActionedIds(prev => { const next = new Set(prev); next.add(n.id); return next })
    if (!n.read) markAsRead(n.id)
  }

  async function handleLinkAction(n: Notification, accepted: boolean) {
    const linkId = n.metadata?.link_id as string | undefined
    if (!linkId) return
    setActingId(n.id)
    // 'active' = accepted; 'declined' = rejected. Schema enforces
    // these values; trigger fires the close-the-loop notification
    // back to the proposer.
    const { error } = await supabase
      .from('world_community_links')
      .update({
        status: accepted ? 'active' : 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('id', linkId)
    setActingId(null)
    if (error) { alert(`Action failed: ${error.message}`); return }
    setActionedIds(prev => { const next = new Set(prev); next.add(n.id); return next })
    if (!n.read) markAsRead(n.id)
  }

  function colorizeBody(body: string, type: string, metadata?: any): React.ReactNode {
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
    // Phase E — Thriver queue alert when a new world_community is
    // submitted. Body: `<submitter> submitted "<name>" from
    // <campaign> for Tapestry publication.`
    if (type === 'moderation_community') {
      const match = body.match(/^(.+?) submitted "(.+?)" from (.+?) for Tapestry publication\.$/)
      if (match) {
        return (
          <>
            <span style={{ color: '#7fc458' }}>{match[1]}</span> submitted{' '}
            <span style={{ color: '#d48bd4' }}>"{match[2]}"</span> from{' '}
            <span style={{ color: '#EF9F27' }}>{match[3]}</span> for Tapestry publication.
          </>
        )
      }
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
    // "X has grown to N members — it's officially a Community now."
    if (type === 'community_milestone') {
      const match = body.match(/^(.+?) has grown to (\d+) members — it'?s officially a Community now\.?$/)
      if (match) return <><span style={{ color: '#c0392b' }}>{match[1]}</span> has grown to <span style={{ color: '#EF9F27' }}>{match[2]}</span> members — it's officially a <span style={{ color: '#7fc458' }}>Community</span> now.</>
    }
    // Phase E Sprint 4a — cross-campaign encounter. Body shape (the
    // trigger emits "encountered" without "has", so match either
    // form defensively so old + new rows both colorize):
    //   <username>'s campaign "<campaign>" [has ]encountered your community "<community>"[: narrative]
    if (type === 'community_encounter') {
      const m = body.match(/^(.+?)'s campaign "(.+?)" (?:has )?encountered your community "(.+?)"(?::\s*(.+))?$/)
      if (m) return (
        <>
          <span style={{ color: '#7ab3d4' }}>{m[1]}</span>'s campaign{' '}
          <span style={{ color: '#EF9F27' }}>"{m[2]}"</span> encountered your community{' '}
          <span style={{ color: '#d48bd4' }}>"{m[3]}"</span>
          {m[4] && <><br /><span style={{ color: '#cce0f5', fontStyle: 'italic' }}>"{m[4]}"</span></>}
        </>
      )
    }
    // Phase E Sprint 4b — link proposal. Body shape:
    //   <username> proposes a <type> between "<from>" and your "<to>"[: narrative]
    if (type === 'community_link_proposal') {
      const m = body.match(/^(.+?) proposes a (trade|alliance|feud) between "(.+?)" and your "(.+?)"(?::\s*(.+))?$/)
      if (m) {
        const typeColor = m[2] === 'trade' ? '#7fc458' : m[2] === 'alliance' ? '#7ab3d4' : '#c0392b'
        return (
          <>
            <span style={{ color: '#7ab3d4' }}>{m[1]}</span> proposes a{' '}
            <span style={{ color: typeColor, fontWeight: 700, textTransform: 'uppercase' }}>{m[2]}</span>{' '}
            between <span style={{ color: '#EF9F27' }}>"{m[3]}"</span> and your{' '}
            <span style={{ color: '#d48bd4' }}>"{m[4]}"</span>
            {m[5] && <><br /><span style={{ color: '#cce0f5', fontStyle: 'italic' }}>"{m[5]}"</span></>}
          </>
        )
      }
    }
    // Phase E Sprint 4e — migration request. Body shape:
    //   Survivor "<npc>" from "<source>" seeks shelter in your "<target>"[: narrative]
    if (type === 'community_migration') {
      const m = body.match(/^Survivor "(.+?)" from "(.+?)" seeks shelter in your "(.+?)"(?::\s*(.+))?$/)
      if (m) return (
        <>
          Survivor <span style={{ color: '#7fc458' }}>"{m[1]}"</span> from{' '}
          <span style={{ color: '#f5a89a' }}>"{m[2]}"</span> seeks shelter in your{' '}
          <span style={{ color: '#d48bd4' }}>"{m[3]}"</span>
          {m[4] && <><br /><span style={{ color: '#cce0f5', fontStyle: 'italic' }}>"{m[4]}"</span></>}
        </>
      )
    }
    // Phase E Sprint 4e — migration response. Body shape:
    //   "<target>" accepted|declined "<npc>" from your "<source>"
    if (type === 'community_migration_response') {
      const m = body.match(/^"(.+?)" (accepted|declined) "(.+?)" from your "(.+?)"$/)
      if (m) {
        const accepted = m[2] === 'accepted'
        const statusColor = accepted ? '#7fc458' : '#f5a89a'
        return (
          <>
            <span style={{ color: '#d48bd4' }}>"{m[1]}"</span>{' '}
            <span style={{ color: statusColor, fontWeight: 700, textTransform: 'uppercase' }}>{m[2]}</span>{' '}
            <span style={{ color: '#7fc458' }}>"{m[3]}"</span> from your{' '}
            <span style={{ color: '#f5a89a' }}>"{m[4]}"</span>
          </>
        )
      }
    }
    // Phase E — Thriver approve / reject on world_communities. Body
    // starts with 'Your published community "<name>"'. We bold the
    // name and colorize the status word.
    if (type === 'world_community_moderation') {
      const status = (metadata as any)?.moderation_status as string | undefined
      const name = (metadata as any)?.name as string | undefined
      const statusColor = status === 'approved' ? '#7fc458' : status === 'rejected' ? '#f5a89a' : '#EF9F27'
      if (name && status) {
        return (
          <>
            Your published community <span style={{ color: '#EF9F27' }}>"{name}"</span> is now{' '}
            <span style={{ color: statusColor, fontWeight: 700, textTransform: 'uppercase' }}>{status}</span>.
          </>
        )
      }
    }

    // Phase E — Thriver deletion of a published community.
    if (type === 'world_community_deleted') {
      const name = (metadata as any)?.name as string | undefined
      if (name) {
        return (
          <>
            A Thriver removed <span style={{ color: '#EF9F27' }}>"{name}"</span> from the Distemperverse. The source campaign community is untouched — you can re-publish from the Community ▾ Status panel.
          </>
        )
      }
    }

    // Phase 5 Sprint 3 — subscriber alert when a new module version
    // is published.
    if (type === 'module_version_published') {
      const name = (metadata as any)?.module_name as string | undefined
      const version = (metadata as any)?.version as string | undefined
      const changelog = (metadata as any)?.changelog as string | undefined
      if (name && version) {
        return (
          <>
            A new version of <span style={{ color: '#d48bd4' }}>"{name}"</span> (
            <span style={{ color: '#c4a7f0', fontWeight: 700 }}>v{version}</span>
            ) is available{changelog ? <>: <span style={{ color: '#cce0f5', fontStyle: 'italic' }}>{changelog}</span></> : '.'}
          </>
        )
      }
    }

    // Phase E — Thriver-side alert when a published community's
    // public info is edited (description / faction / homestead /
    // etc.). metadata.changed_fields is a string[].
    if (type === 'world_community_updated') {
      const editor = (metadata as any)?.editor_username as string | undefined
      const name = (metadata as any)?.name as string | undefined
      const fields = (metadata as any)?.changed_fields as string[] | undefined
      if (editor && name && fields) {
        return (
          <>
            <span style={{ color: '#7fc458' }}>{editor}</span> updated public info on{' '}
            <span style={{ color: '#d48bd4' }}>"{name}"</span>{' '}
            (<span style={{ color: '#EF9F27' }}>{fields.join(', ')}</span>).
          </>
        )
      }
    }

    // Phase 5 — someone started running the author's module.
    if (type === 'module_subscriber') {
      const name = (metadata as any)?.module_name as string | undefined
      if (name) {
        return (
          <>
            A GM started running <span style={{ color: '#c4a7f0' }}>"{name}"</span>.
          </>
        )
      }
    }

    // Phase 5 — Thriver approved or rejected a listed module submission.
    if (type === 'module_approved') {
      const name = (metadata as any)?.module_name as string | undefined
      if (name) {
        return (
          <>
            Your module <span style={{ color: '#c4a7f0' }}>"{name}"</span> was{' '}
            <span style={{ color: '#7fc458', fontWeight: 700 }}>approved</span> and is now listed.
          </>
        )
      }
    }

    if (type === 'module_rejected') {
      const name = (metadata as any)?.module_name as string | undefined
      if (name) {
        return (
          <>
            Your module <span style={{ color: '#c4a7f0' }}>"{name}"</span> was{' '}
            <span style={{ color: '#f5a89a', fontWeight: 700 }}>not approved</span>. You can edit and re-submit.
          </>
        )
      }
    }

    if (type === 'module_archived') {
      const name = (metadata as any)?.module_name as string | undefined
      if (name) {
        return (
          <>
            <span style={{ color: '#c4a7f0' }}>"{name}"</span> has been{' '}
            <span style={{ color: '#5a5550', fontWeight: 700 }}>archived</span> by its author. Your campaign content is untouched.
          </>
        )
      }
    }

    // Inventory wedge B — cross-user item transfer. metadata carries
    // item_name / qty / from_label / target_character_name. Body shape
    // (from notify_inventory_received RPC):
    //   You received <qty>× <item> from <from_label>
    if (type === 'inventory_received') {
      const itemName = (metadata as any)?.item_name as string | undefined
      const qty = (metadata as any)?.qty as number | undefined
      const fromLabel = (metadata as any)?.from_label as string | undefined
      if (itemName && qty != null && fromLabel) {
        return (
          <>
            You received <span style={{ color: '#7fc458', fontWeight: 700 }}>{qty}× {itemName}</span> from{' '}
            <span style={{ color: '#7ab3d4' }}>{fromLabel}</span>
          </>
        )
      }
    }

    // Phase E Sprint 4b — link response. Body shape:
    //   "<recipient>" <status> your <type> proposal with "<proposer>"
    if (type === 'community_link_response') {
      const m = body.match(/^"(.+?)" (active|declined) your (trade|alliance|feud) proposal with "(.+?)"$/)
      if (m) {
        const accepted = m[2] === 'active'
        const statusColor = accepted ? '#7fc458' : '#f5a89a'
        return (
          <>
            <span style={{ color: '#d48bd4' }}>"{m[1]}"</span>{' '}
            <span style={{ color: statusColor, fontWeight: 700, textTransform: 'uppercase' }}>{accepted ? 'accepted' : 'declined'}</span>{' '}
            your {m[3]} proposal with <span style={{ color: '#EF9F27' }}>"{m[4]}"</span>
          </>
        )
      }
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
            background: '#c0392b', color: '#fff', fontSize: '13px',
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
          // Wider container + hard clip so long notification bodies
          // wrap cleanly instead of punching out the right edge.
          width: '360px', maxWidth: 'calc(100vw - 20px)',
          maxHeight: '400px', overflowY: 'auto', overflowX: 'hidden',
          background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', zIndex: 9999,
          boxSizing: 'border-box',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #2e2e2e' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif' }}>Notifications</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead}
                  style={{ background: 'none', border: 'none', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={deleteAll}
                  style={{ background: 'none', border: 'none', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Delete all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#cce0f5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
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
                  // Keep long titles + bodies inside the dropdown.
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : '#111')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: 0, flex: 1, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{n.title}</span>
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
                <div style={{
                  fontSize: '13px', color: '#d4cfc9', lineHeight: 1.4, textAlign: 'left',
                  // Belt + suspenders — some earlier ancestor CSS was
                  // still truncating with ellipsis on narrow widths.
                  // Explicitly force normal wrap, no truncation, and
                  // clamp to the row width.
                  display: 'block', width: '100%', maxWidth: '100%', boxSizing: 'border-box',
                  whiteSpace: 'normal', textOverflow: 'clip',
                  wordWrap: 'break-word', wordBreak: 'break-word', overflowWrap: 'anywhere',
                }}>{colorizeBody(n.body, n.type, (n as any).metadata)}</div>
                {/* Phase E Sprint 4c — inline Accept / Decline. Shown
                    on action-bearing notifications when the user
                    hasn't yet acted on this card in the current
                    session. After action the buttons hide (see
                    actionedIds). The DB status flip on
                    community_encounters / world_community_links is
                    what makes the action durable; this UI is a
                    convenience surface so the recipient doesn't have
                    to navigate to the source community to respond. */}
                {(n.type === 'community_encounter' || n.type === 'community_link_proposal' || n.type === 'community_migration')
                  && !actionedIds.has(n.id)
                  && (n.metadata?.encounter_id || n.metadata?.link_id || n.metadata?.migration_id) && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => n.type === 'community_encounter'
                        ? handleEncounterAction(n, true)
                        : n.type === 'community_link_proposal'
                          ? handleLinkAction(n, true)
                          : handleMigrationAction(n, true)}
                      disabled={actingId === n.id}
                      style={{ padding: '4px 12px', background: '#1a2010', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: actingId === n.id ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: actingId === n.id ? 0.4 : 1 }}>
                      ✓ Accept
                    </button>
                    <button
                      onClick={() => n.type === 'community_encounter'
                        ? handleEncounterAction(n, false)
                        : n.type === 'community_link_proposal'
                          ? handleLinkAction(n, false)
                          : handleMigrationAction(n, false)}
                      disabled={actingId === n.id}
                      style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: actingId === n.id ? 'not-allowed' : 'pointer', opacity: actingId === n.id ? 0.4 : 1 }}>
                      ✗ Decline
                    </button>
                  </div>
                )}
                {actionedIds.has(n.id) && (n.type === 'community_encounter' || n.type === 'community_link_proposal' || n.type === 'community_migration') && (
                  <div style={{ marginTop: '6px', fontSize: '13px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>✓ Responded</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
