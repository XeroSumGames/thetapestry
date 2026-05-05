'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NotificationBell from './NotificationBell'
import MessagesBell from './MessagesBell'
import BugReportButton from './BugReportButton'

// Left sidebar — restructured 2026-04-22 per user spec:
//
//   [Logo / Tapestry v0.5]
//   [Username + Role Badge + Bell]
//   ——— divider ———
//   The Tapestry (header)
//     Welcome to the Tapestry
//     The World
//     My Survivors
//     My Stories
//     My Communities
//     The Campfire
//     Rumors
//     The Rules
//   ——— divider ———
//   Survivors (header)
//     Creating a Survivor
//     Backstory Generation
//     Quick Character
//     Random Character
//     Paradigms — soon
//   ——— divider ———
//   Tools (header, Thriver-only)
//     Moderation Queue
//     Resize Portraits
//     Rescale Tactical Scenes
//     Logs
//     Copy Map Position
//   [Create Account / Sign In] or [Log Out]
//   [Xero Sum Games tiny logo]

export default function Sidebar() {
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'survivor' | 'thriver' | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [onlineCount, setOnlineCount] = useState(0)
  // Thriver-only roster of currently-online users. Surfaces as a hover
  // popup over the "Survivors present: N" line so a Thriver can see WHO
  // is on the platform at any moment, not just the count. Resolved from
  // the global_presence channel's user_id keys → profiles.username.
  const [presentUsernames, setPresentUsernames] = useState<string[]>([])
  const [presenceHover, setPresenceHover] = useState(false)
  const presenceRef = useRef<any>(null)
  const router = useRouter()
  const supabase = createClient()

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { setLoaded(true); return }
      const { data: profile } = await supabase.from('profiles').select('username, role, avatar_url').eq('id', user.id).single()
      if (!profile) { setLoaded(true); return }
      setUsername(profile.username)
      setAvatarUrl((profile as any).avatar_url ?? null)
      setUserRole((profile.role as string).toLowerCase() as 'survivor' | 'thriver')
      if (profile.role === 'thriver') {
        const { count } = await supabase.from('map_pins').select('*', { count: 'exact', head: true }).eq('pin_type', 'rumor').eq('status', 'pending')
        setPendingCount(count ?? 0)
      }
      setLoaded(true)

      // Global presence — track who's online across the platform.
      // For Thrivers, also resolve the present user_ids → usernames so
      // the hover popup can show the roster. Survivors only need the
      // count, so we skip the username lookup for them.
      const isThriver = profile.role === 'thriver'
      presenceRef.current = supabase.channel('global_presence', { config: { presence: { key: user.id } } })
      presenceRef.current.on('presence', { event: 'sync' }, async () => {
        const ids = Object.keys(presenceRef.current.presenceState())
        setOnlineCount(ids.length)
        if (isThriver && ids.length > 0) {
          const { data: rows } = await supabase.from('profiles').select('id, username').in('id', ids)
          // Stable sort so the popup doesn't re-shuffle on every sync.
          const names = (rows ?? []).map((r: any) => r.username as string).sort((a: string, b: string) => a.localeCompare(b))
          setPresentUsernames(names)
        } else {
          setPresentUsernames([])
        }
      })
      presenceRef.current.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await presenceRef.current.track({ user_id: user.id })
        }
      })
    }
    load()
    return () => { if (presenceRef.current) supabase.removeChannel(presenceRef.current) }
  }, [])

  if (!loaded) return null
  const isGuest = !username

  const linkStyle = (accent: string) => ({
    display: 'block' as const, padding: '10px 14px', color: '#f5f2ee',
    textDecoration: 'none', fontSize: '15px', fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.04em', textTransform: 'uppercase' as const,
    borderLeft: `3px solid ${accent}`, marginBottom: '2px',
  })

  const sectionHeading = {
    padding: '10px 14px 6px', fontSize: '15px', color: '#f5f2ee',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em',
    textTransform: 'uppercase' as const, fontWeight: 700,
  }

  const divider = <div style={{ height: '1px', background: '#2e2e2e', margin: '8px 0' }} />

  function hover(e: React.MouseEvent<HTMLAnchorElement>, on: boolean) {
    e.currentTarget.style.background = on ? '#242424' : 'transparent'
  }

  return (
    <div style={{ width: '220px', flexShrink: 0, background: '#1a1a1a', borderRight: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* Branding */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #c0392b', textAlign: 'center' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <img src="/DistemperLogoRedv5.png" alt="Distemper" style={{ height: '28px', objectFit: 'contain', marginBottom: '4px' }} />
          <div style={{ fontFamily: 'Distemper, sans-serif', fontSize: '18px', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1 }}>The Tapestry <span style={{ fontSize: '13px', color: '#f5f2ee' }}>v0.5</span></div>
        </Link>
        {onlineCount > 0 && (
          <div
            onMouseEnter={() => userRole === 'thriver' && setPresenceHover(true)}
            onMouseLeave={() => setPresenceHover(false)}
            style={{ position: 'relative', fontSize: '14px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '4px', cursor: userRole === 'thriver' ? 'help' : 'default' }}>
            Survivors present: {onlineCount}
            {/* Thriver-only roster popup. Anchored under the count line,
                left-aligned with the sidebar so it doesn't clip. Survivors
                see only the count — keeps presence-style anonymity for
                non-Thriver viewers. */}
            {presenceHover && userRole === 'thriver' && presentUsernames.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '4px', minWidth: '180px', maxWidth: '240px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '8px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.6)', zIndex: 1000, textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Online now</div>
                {presentUsernames.map(n => (
                  <div key={n} style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', letterSpacing: 0, textTransform: 'none', padding: '1px 0' }}>
                    · {n}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User header */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #2e2e2e', fontFamily: 'Carlito, sans-serif' }}>
        {isGuest ? (
          <span style={{ color: '#7fc458', fontSize: '14px', letterSpacing: '.12em', textTransform: 'uppercase' }}>Ghost <span style={{ fontSize: '13px' }}>— You Don&apos;t Exist</span></span>
        ) : (
          <>
            {/* Line 1: Username, with the role badge ONLY for Thrivers.
                Survivor is the default — surfacing the badge for every
                logged-in user adds visual noise without adding info. */}
            <div style={{ fontSize: '14px', letterSpacing: '.1em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '7px', textAlign: 'center' }}>
              <span style={{ color: '#f5f2ee' }}>{username}</span>
              {userRole === 'thriver' && (
                <span style={{ color: '#c0392b', marginLeft: '5px' }}>(Thriver)</span>
              )}
            </div>
            {/* Line 2: icons — equal-width slots so visual midpoints
                line up regardless of each component's internal padding.
                space-evenly + space-around both gave uneven gaps because
                the three children have different intrinsic widths
                (MessagesBell + NotificationBell wrap their buttons in
                different padding; the Campfire emoji has none). Three
                fixed-width centred cells fix it. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><MessagesBell /></div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><NotificationBell /></div>
              {/* Campfire shortcut — emoji glyphs ignore CSS color, so
                  use opacity + grayscale to actually grey the icon out
                  while it's a placeholder ('coming soon' from the
                  user-header surface; the full /campfire page is still
                  reachable from the main nav below). Matches the
                  MessagesBell dim-when-idle treatment. */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <span title="The Campfire — coming soon" style={{ fontSize: '16px', lineHeight: 1, display: 'flex', alignItems: 'center', cursor: 'default', opacity: 0.45, filter: 'grayscale(1)' }}>🔥</span>
              </div>
              {/* Bug report — opens a modal where the user describes
                  what broke. Insert into bug_reports fires the
                  notify_bug_report trigger which emails Xero via the
                  existing call_notify_thriver path. */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><BugReportButton /></div>
            </div>
          </>
        )}
      </div>

      {/* The Tapestry — top-level destinations. Section header suppressed
          per user spec: "Welcome to the Tapestry" is the first link so a
          "THE TAPESTRY" heading right above it reads as redundant. The
          user-header above already provides its own borderBottom, so no
          explicit {divider} is needed here. */}
      <Link href="/welcome"     style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>A Guide to the Tapestry</Link>
      <Link href="/map"         style={linkStyle('#c0392b')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>The World</Link>
      <Link href="/characters"  style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Survivors</Link>
      <Link href="/stories"     style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Stories</Link>
      <Link href="/communities" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Communities</Link>
      <Link href="/campfire" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>The Campfire</Link>
      <Link href="/rumors"   style={linkStyle('#8b5cf6')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Rumors</Link>
      <Link href="/rules"    style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>The Rules</Link>
      {/* External link out to the brand site. New tab + rel=noreferrer
          since it leaves the app entirely. Same visual treatment as
          the in-app links so the sidebar stays uniform. */}
      <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer"
        style={linkStyle('#3a3a3a')}
        onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
        The DistemperVerse ↗
      </a>

      {/* Phase 4C — setting hubs (DZ + Kings Crossroads) moved into
          /campfire 2026-05-01 per user spec; sidebar only shows the
          top-level Tapestry destinations. */}

      {divider}

      {/* Survivors — character creation paths */}
      <div style={sectionHeading}>Survivors</div>
      <Link href="/creating-a-character" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Creating a Survivor</Link>
      <Link href="/characters/new"       style={linkStyle('#c0392b')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Backstory Generation</Link>
      <Link href="/characters/quick"     style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Quick Character</Link>
      <Link href="/characters/random"    style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Random Character</Link>
      <Link href="/characters/paradigms"  style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Paradigms</Link>

      {divider}

      {/* Tools — Thriver-only. Keeps elevated destinations behind the role gate
          so Survivors don't see admin surfaces. */}
      {userRole === 'thriver' && (
        <>
          <div style={sectionHeading}>Tools</div>
          <Link href="/moderate"
            style={{ ...linkStyle('#EF9F27'), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
            Moderation Queue
            {pendingCount > 0 && <span style={{ background: '#c0392b', color: '#fff', fontSize: '13px', padding: '1px 6px', borderRadius: '3px' }}>{pendingCount}</span>}
          </Link>
          <Link href="/rumors/import"                style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Publish Module from Snapshot</Link>
          <Link href="/tools/portrait-resizer"       style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Resize Portraits</Link>
          <Link href="/tools/rescale-tactical-scenes" style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Rescale Tactical Scenes</Link>
          <Link href="/tools/reseed-campaign"        style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Reseed Campaign</Link>
          <Link href="/tools/campaign-explorer"      style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Campaign Explorer</Link>
          <Link href="/tools/migrate-character-photos" style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Migrate Character Photos</Link>
          <Link href="/logging"                       style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Logs</Link>
          <Link href="/record"                        style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Playtest Recorder</Link>
          <a href="#"
            onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('tapestry-copy-map-position')) }}
            style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
            Copy Map Position
          </a>
          {divider}
        </>
      )}

      {/* (Removed 2026-05-01: Equipment "— soon" placeholder + the
          Forums + Looking for Group duplicates — those are still
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
            <Link href="/login" style={{ display: 'block', width: '100%', padding: '8px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
              Sign In
            </Link>
          </>
        ) : (
          <>
            {/* Account row — avatar + username, click to open
                /account. Compact so the bottom of the sidebar
                stays uncluttered. Avatar circle falls back to a
                colored circle with the user's initial when no
                avatar is set. */}
            <Link href="/account"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', textDecoration: 'none', borderRadius: '3px', color: '#d4cfc9' }}
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
