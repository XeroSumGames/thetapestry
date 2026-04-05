'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import Sidebar from './Sidebar'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [suspended, setSuspended] = useState(false)
  const [checked, setChecked] = useState(false)
  const [onboarded, setOnboarded] = useState(false)

  const isWelcome = pathname === '/welcome'
  const hideSidebar = pathname === '/login' || pathname === '/signup' || (isWelcome && !onboarded)

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          // Clean up any stale session data
          await supabase.auth.signOut()
          setChecked(true)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('suspended, onboarded')
          .eq('id', user.id)
          .single()

        if (profile?.suspended) setSuspended(true)
        if (profile?.onboarded) setOnboarded(true)
        setChecked(true)
      } catch (e) {
        // Any auth error — clear session and continue
        await supabase.auth.signOut()
        setChecked(true)
      }
    }
    checkSession()
  }, [pathname])

  if (!checked) return <div style={{ flex: 1, background: '#0f0f0f' }} />

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

  if (hideSidebar) {
    return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>{children}</div>
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