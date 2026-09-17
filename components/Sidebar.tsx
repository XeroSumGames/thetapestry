'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { isThriver as roleIsThriver } from '../lib/auth/roles'
import { useGlobalPresence } from '../lib/realtime/useGlobalPresence'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteIdentity, SiteNav } from './SiteMenu'

// Left sidebar - restructured 2026-04-22 per user spec:
//
//   [Logo / Tapestry v0.5]
//   [Username + Role Badge + Bell]
//   --- divider ---
//   The Tapestry (header)
//     Welcome to the Tapestry
//     The World
//     My Survivors
//     My Stories
//     My Communities
//     The Campfire
//     Rumors
//     The Rules
//   --- divider ---
//   Survivors (header)
//     Creating a Survivor
//     Backstory Generation
//     Quick Character
//     Random Character
//     Paradigms - soon
//   --- divider ---
//   Tools (header, Thriver-only)
//     Moderation Queue
//     Logs
//     Ape Generator Log
//     Feature Manifest
//     Create Tokens
//     Character Photos
//     Publish from Snapshot
//     Rescale Tactical Scenes
//     Reseed Campaign
//     Campaign Explorer
//     Copy Map Position
//   [Create Account / Sign In] or [Log Out]
//   [Xero Sum Games tiny logo]

export default function Sidebar() {
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'survivor' | 'thriver' | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [onlineCount, setOnlineCount] = useState(0)
  // Thriver-only roster of currently-online users. Surfaces as a hover
  // popup over the "Survivors present: N" line so a Thriver can see WHO
  // is on the platform at any moment, not just the count. Resolved from
  // the global_presence channel's user_id keys → profiles.username.
  const [presentUsernames, setPresentUsernames] = useState<string[]>([])
  // Thrivers get the named roster; everyone else just sees the count.
  const [showRoster, setShowRoster] = useState(false)
  // Delta-cache id -> username so a presence 'sync' only queries profiles for
  // ids we haven't resolved yet (scale: every join/leave platform-wide fires a
  // sync; the old code re-queried ALL present ids each time). Plus a debounce
  // timer so a burst of syncs collapses into one resolve.
  const usernameCacheRef = useRef<Map<string, string>>(new Map())
  const presenceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { setLoaded(true); return }
      const { data: profile } = await supabase.from('profiles').select('username, role, avatar_url').eq('id', user.id).single()
      if (!profile) { setLoaded(true); return }
      setUserId(user.id)
      setUsername(profile.username)
      setAvatarUrl((profile as any).avatar_url ?? null)
      setUserRole((profile.role as string).toLowerCase() as 'survivor' | 'thriver')
      if (roleIsThriver(profile)) {
        const { count } = await supabase.from('map_pins').select('*', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending')
        setPendingCount(count ?? 0)
      }
      setLoaded(true)

      // Presence itself is owned by the app-root PresenceProvider (one channel
      // for the whole app); this component only records whether to resolve the
      // username roster (Thrivers) or just show the count.
      setShowRoster(roleIsThriver(profile))
    }
    load()
    return () => {
      if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current)
    }
  }, [])

  // Roster from the shared presence provider. `activeIds` excludes anyone idle
  // past IDLE_MS, so a tab left open for weeks no longer reads as "online".
  const { activeIds } = useGlobalPresence()
  useEffect(() => {
    setOnlineCount(activeIds.length)
    if (!showRoster) { setPresentUsernames([]); return }
    // Debounce + delta-resolve usernames: collapse a burst of presence syncs
    // into one query and only fetch ids not already cached.
    if (presenceDebounceRef.current) clearTimeout(presenceDebounceRef.current)
    presenceDebounceRef.current = setTimeout(async () => {
      const cache = usernameCacheRef.current
      const missing = activeIds.filter(id => !cache.has(id))
      if (missing.length > 0) {
        const { data: rows } = await supabase.from('profiles').select('id, username').in('id', missing)
        for (const r of (rows ?? [])) cache.set((r as any).id, (r as any).username as string)
      }
      // Build from cache for the CURRENTLY-active ids only, so someone who left
      // (or went idle) drops off even though their name stays cached.
      setPresentUsernames(activeIds
        .map(id => cache.get(id))
        .filter((n): n is string => !!n)
        .sort((a, b) => a.localeCompare(b)))
    }, 1200)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds, showRoster])

  if (!loaded) return null
  const isGuest = !username


  return (
    <div style={{ width: '220px', flexShrink: 0, background: '#1a1a1a', borderRight: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      <SiteIdentity
        username={username}
        userRole={userRole}
        userId={userId}
        onlineCount={onlineCount}
        presentUsernames={presentUsernames}
      />

      <SiteNav userRole={userRole} pendingCount={pendingCount} />

      {/* (Removed 2026-05-01: Equipment "- soon" placeholder + the
          Forums + Looking for Group duplicates - those are still
          reachable via /campfire's tab strip. The Rules promoted up
          beside Rumors 2026-05-01.) */}

      {/* Spacer + bottom section */}
      <div style={{ flex: 1 }} />

      <div style={{ padding: '8px 14px', borderTop: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isGuest ? (
          <>
            <Link href="/signup" style={{ display: 'block', width: '100%', padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
              Create Account
            </Link>
            <Link href="/login" style={{ display: 'block', width: '100%', padding: '8px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
              Sign In
            </Link>
          </>
        ) : (
          <>
            {/* Account row - avatar + username, click to open
                /account. Compact so the bottom of the sidebar
                stays uncluttered. Avatar circle falls back to a
                colored circle with the user's initial when no
                avatar is set. */}
            <Link href="/account"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', textDecoration: 'none', borderRadius: '3px', color: '#f5f2ee' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1a1a1a' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}>
              <span style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: avatarUrl ? `url(${avatarUrl}) center/cover` : '#2a1a3e',
                border: '1px solid #5a2e5a', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700,
              }}>
                {!avatarUrl && (username ? username[0].toUpperCase() : '?')}
              </span>
              <span style={{ flex: 1, fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {username || 'Account'}
              </span>
            </Link>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
              style={{ width: '100%', padding: '8px', background: 'none', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Log Out
            </button>
          </>
        )}
      </div>

      <div style={{ padding: '8px 14px 12px', textAlign: 'center' }}>
        <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer">
          <img src="/XeroSumGamesLogoV13.png" alt="Xero Sum Games" style={{ height: '18px', objectFit: 'contain', opacity: 0.6 }} />
        </a>
      </div>

    </div>
  )
}
