'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import Sidebar from './Sidebar'

// Pages that ghosts (unauthenticated users) can view
const PUBLIC_PAGES = ['/', '/map', '/welcome', '/dashboard']

// Pages that always hide the sidebar
const NO_SIDEBAR_PAGES = ['/login', '/signup', '/firsttimers', '/welcome']

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

  const hideSidebar = NO_SIDEBAR_PAGES.includes(pathname) || !isAuthenticated

  if (hideSidebar) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Ghost bar for unauthenticated users on public pages */}
        {!isAuthenticated && isPublicPage && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#111', borderBottom: '1px solid #c0392b', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/DistemperLogoRedv5.png" alt="Distemper" style={{ height: '20px', objectFit: 'contain' }} />
              <span style={{ fontFamily: 'Distemper, sans-serif', fontSize: '16px', textTransform: 'uppercase', color: '#f5f2ee' }}>The Tapestry</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href="/map" style={{ padding: '5px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>The World</a>
              <a href="/login" style={{ padding: '5px 14px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Sign In</a>
              <a href="/signup" style={{ padding: '5px 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Create Account</a>
            </div>
          </div>
        )}
        {children}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
