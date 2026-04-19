'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import Sidebar from './Sidebar'

// Pages that ghosts (unauthenticated users) can view
const PUBLIC_PAGES = ['/', '/map', '/welcome', '/dashboard', '/stories', '/campaigns', '/characters', '/creating-a-character', '/characters/new', '/characters/quick', '/characters/random']

// Pages that always hide the sidebar
const NO_SIDEBAR_PAGES = ['/login', '/signup', '/firsttimers', '/welcome']
// Pages that use their own full-width layout
const FULL_WIDTH_PATTERN = /^\/stories\/[^/]+\/table$|^\/vehicle$|^\/gm-screen$|^\/character-sheet$|^\/handout$/

function MobileBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div style={{
      display: 'none', padding: '16px 20px', background: '#2a1210', borderBottom: '1px solid #c0392b',
      fontSize: '16px', color: '#f5a89a', fontFamily: 'Barlow, sans-serif', textAlign: 'center',
      position: 'relative',
    }}
    className="mobile-banner">
      The Tapestry is best experienced on a desktop or tablet.
      <button onClick={() => setDismissed(true)}
        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#f5a89a', fontSize: '16px', cursor: 'pointer' }}>✕</button>
      <style>{`@media (max-width: 768px) { .mobile-banner { display: block !important; } }`}</style>
    </div>
  )
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [suspended, setSuspended] = useState(false)
  const [checked, setChecked] = useState(false)
  const [onboarded, setOnboarded] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          await supabase.auth.signOut()
          setIsAuthenticated(false)
          setChecked(true)
          return
        }

        setIsAuthenticated(true)

        const { data: profile } = await supabase
          .from('profiles')
          .select('suspended, onboarded')
          .eq('id', user.id)
          .single()

        if (profile?.suspended) setSuspended(true)
        if (profile?.onboarded) setOnboarded(true)
        setChecked(true)
      } catch (e) {
        await supabase.auth.signOut()
        setIsAuthenticated(false)
        setChecked(true)
      }
    }
    checkSession()
  }, [pathname])

  if (!checked) return <div style={{ flex: 1, background: '#0f0f0f' }} />

  // Redirect unauthenticated users to login for protected pages
  const isPublicPage = PUBLIC_PAGES.some(p => pathname === p) || pathname === '/map'
  if (!isAuthenticated && !isPublicPage && !['/login', '/signup', '/firsttimers'].includes(pathname)) {
    router.push('/login')
    return <div style={{ flex: 1, background: '#0f0f0f' }} />
  }

  if (suspended) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', fontFamily: 'Barlow, sans-serif' }}>
        <div style={{ maxWidth: '480px', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '48px', fontWeight: 700, color: '#c0392b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Suspended
          </div>
          <div style={{ fontSize: '15px', color: '#d4cfc9', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            Your account has been suspended by a Thriver. You are unable to interact with The Tapestry at this time.
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5' }}>
            If you believe this is in error, contact a Thriver directly.
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            style={{ marginTop: '2rem', padding: '8px 24px', background: 'none', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
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
