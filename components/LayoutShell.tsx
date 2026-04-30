'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { installDebugLog, setDebugContext } from '../lib/debug-log'
import Sidebar from './Sidebar'

// Pages that ghosts (unauthenticated users) can view
const PUBLIC_PAGES = ['/', '/map', '/welcome', '/dashboard', '/stories', '/campaigns', '/characters', '/creating-a-character', '/characters/new', '/characters/quick', '/characters/random']

// Pages that always hide the sidebar
const NO_SIDEBAR_PAGES = ['/login', '/signup', '/firsttimers']
// Pages that use their own full-width layout (popouts + the table view).
// CONVENTION: any new popout route should end in `-sheet` or `-popout`
// (or live under `/popout/...`) so it's auto-included here without an edit.
const FULL_WIDTH_PATTERN = /^\/stories\/[^/]+\/table$|^\/vehicle$|^\/gm-screen$|^\/handout$|-sheet$|-popout$|^\/popout\//

function MobileBanner() {
  const [isPhone, setIsPhone] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    // Detect actual phones via coarse pointer + small physical screen. A narrow
    // popout window on a desktop has fine pointer + large screen.width, so it
    // no longer triggers the banner.
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const smallScreen = window.screen.width <= 768
    setIsPhone(coarse && smallScreen)
  }, [])
  if (!isPhone || dismissed) return null
  return (
    <div style={{
      padding: '16px 20px', background: '#2a1210', borderBottom: '1px solid #c0392b',
      fontSize: '16px', color: '#f5a89a', fontFamily: 'Barlow, sans-serif', textAlign: 'center',
      position: 'relative',
    }}>
      The Tapestry is best experienced on a desktop or tablet.
      <button onClick={() => setDismissed(true)}
        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#f5a89a', fontSize: '16px', cursor: 'pointer' }}>✕</button>
    </div>
  )
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [suspended, setSuspended] = useState(false)
  const [checked, setChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Auth check runs ONCE on mount, then again only on real auth events
  // (SIGNED_IN / SIGNED_OUT). Previously the dep array was [pathname], which
  // fired a getUser() + profiles select on every navigation — a network
  // round-trip in front of every link click. Pathname changes don't change
  // who's logged in, so this was wasted work that made soft-nav feel slow.
  useEffect(() => {
    // Install global telemetry once per page. dlog captures unhandled
    // errors / rejections / page-load timing into public.debug_log.
    // Manual dlog.{info,warn,error,perf} calls available throughout the
    // app. Disable per-tab with localStorage.debug_log='0'.
    installDebugLog()

    let cancelled = false
    // Dedupe loadProfile across the initial checkSession() AND the
    // onAuthStateChange SIGNED_IN handler. Supabase fires SIGNED_IN
    // immediately on subscribe whenever a session is present, which
    // duplicated the suspended-profile query on every page load.
    // Combined with 5 simultaneous browser mounts during playtest,
    // every duplicate became one extra concurrent query hitting the
    // already-stretched Supabase pool.
    let loadedForUserId: string | null = null

    async function loadProfile(userId: string) {
      if (loadedForUserId === userId) return
      loadedForUserId = userId
      const { data: profile } = await supabase
        .from('profiles')
        .select('suspended')
        .eq('id', userId)
        .single()
      if (cancelled) return
      setSuspended(!!profile?.suspended)
    }

    async function checkSession() {
      try {
        // Use the shared auth cache (lib/auth-cache.ts) instead of
        // supabase.auth.getUser(). Two reasons:
        //   1. getUser() takes the auth Web Lock and round-trips to
        //      /auth/v1/user. If a backgrounded tab is mid-mount and
        //      holding the lock, the login-tab's check queues 5s, then
        //      steals — and to the user the login click "does nothing"
        //      because the original promise aborts. getCachedAuth()
        //      uses getSession() which is a localStorage read; the lock
        //      contention drops to near-zero.
        //   2. The 30s TTL means within a tab's normal lifetime, the
        //      check is effectively free. Auth-state changes
        //      (SIGNED_IN/OUT/TOKEN_REFRESHED) invalidate the cache so
        //      we never serve stale identity.
        // Tradeoff: getSession is local-only, doesn't server-validate.
        // For LayoutShell's "is anyone logged in" check that's fine —
        // false positives (stale session that's actually expired) get
        // caught by the next RLS-protected query returning empty/401.
        const { user } = await getCachedAuth()
        if (cancelled) return
        if (!user) {
          setIsAuthenticated(false)
          setChecked(true)
          return
        }
        setIsAuthenticated(true)
        setDebugContext({ userId: user.id })
        // DON'T await loadProfile — it's a non-critical "is this user
        // suspended" check. Awaiting it gates the entire UI shell on a
        // single Supabase query; if the pool is saturated (5-browser
        // playtest) or the network is slow, the user sees a permanent
        // "Loading" screen. The suspended flag is for showing a banner
        // — it can hydrate after the shell renders. The shell itself
        // only needs to know: is anyone authenticated?
        setChecked(true)
        loadProfile(user.id).catch(() => {/* swallowed; non-critical */})
      } catch (e) {
        if (cancelled) return
        setIsAuthenticated(false)
        setChecked(true)
      }
    }

    checkSession()

    // React to real auth state changes — sign-in (e.g. after the
    // /login flow), sign-out (sign-out button or token failure
    // elsewhere). TOKEN_REFRESHED fires on background refresh and
    // doesn't change identity, so we ignore it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setIsAuthenticated(false)
        setSuspended(false)
        setChecked(true)
      } else if (event === 'SIGNED_IN') {
        setIsAuthenticated(true)
        loadProfile(session.user.id)
        setChecked(true)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (!checked) return <div style={{ flex: 1, background: '#0f0f0f' }} />

  // Redirect unauthenticated users to login for protected pages.
  // Preserve the current path (with any query string) as a `?redirect=` param
  // so deep links — especially invite URLs like /join/<code> — survive the
  // login round-trip. Previously this pushed to a bare /login and silently
  // dropped the destination, so invited users ended up at /dashboard.
  const isPublicPage = PUBLIC_PAGES.some(p => pathname === p) || pathname === '/map'
  if (!isAuthenticated && !isPublicPage && !['/login', '/signup', '/firsttimers'].includes(pathname)) {
    const search = typeof window !== 'undefined' ? window.location.search : ''
    const fullPath = pathname + search
    router.push(`/login?redirect=${encodeURIComponent(fullPath)}`)
    return <div style={{ flex: 1, background: '#0f0f0f' }} />
  }

  if (suspended) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', fontFamily: 'Barlow, sans-serif' }}>
        <div style={{ maxWidth: '480px', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '48px', fontWeight: 700, color: '#c0392b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Suspended
          </div>
          <div style={{ fontSize: '15px', color: '#d4cfc9', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            Your account has been suspended by a Thriver. You are unable to interact with The Tapestry at this time.
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5' }}>
            If you believe this is in error, contact a Thriver directly.
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            style={{ marginTop: '2rem', padding: '8px 24px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  const hideSidebar = NO_SIDEBAR_PAGES.includes(pathname) || FULL_WIDTH_PATTERN.test(pathname)

  if (hideSidebar) {
    return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}><MobileBanner />{children}</div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <MobileBanner />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
