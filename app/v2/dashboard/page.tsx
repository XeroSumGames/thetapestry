'use client'
// /v2/dashboard - the Dashboard in the house frame.
//
// Built to the approved mockup, D:\ClaudeOutput\tapestry-frame.html, on Xero's
// 2026-09-16 directive ("make the dev server look like this"). That settled the
// arrangement 1.2a had guessed at: identity lives in the TITLE BAR and the left
// rail is MENU ONLY, which is also what removes the doubled "The Tapestry".
//
// Still staged on one point: the right rail is the PINS panel in the mockup,
// and that needs MapView's panel state lifted out (~25 props plus the three
// layout couplings documented at the top of components/PinsPanel.tsx). Until
// then the map keeps its own inner pins list and this page suppresses the right
// rail, which Frame supports natively.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Frame, { type NavTab } from '../../../components/Frame'
import { SiteTitleBar, SiteNav } from '../../../components/SiteMenu'
import { getCachedAuth } from '../../../lib/auth-cache'
import { siteMenuProfile } from '../../../lib/data/profiles'
import { useGlobalPresence } from '../../../lib/realtime/useGlobalPresence'
import { reportSupabaseError } from '../../../lib/supabase-errors'

// ssr:false for the same reason the old dashboard does it: Leaflet touches
// window on import.
const MapView = dynamic(() => import('../../../components/MapView'), { ssr: false })

// The section strip, exactly the six the mockup shows. Plan 1.3 points these at
// their own /v2 pages; until then the five that are not DASHBOARD go to the
// page that exists today, so no tab is decorative.
const SECTIONS: (NavTab & { href?: string })[] = [
  { id: 'dashboard', label: 'DASHBOARD' },
  { id: 'survivors', label: 'MY SURVIVORS', href: '/characters' },
  { id: 'stories', label: 'MY STORIES', href: '/stories' },
  { id: 'communities', label: 'MY COMMUNITIES', href: '/communities' },
  { id: 'campfire', label: 'THE CAMPFIRE', href: '/campfire' },
  { id: 'rules', label: 'THE RULES', href: '/rules' },
]

export default function V2DashboardPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Presence comes from the app-wide provider mounted in app/layout.tsx, so the
  // frame gets the online count without opening a second channel. The mockup's
  // title bar shows the count alone, so no name lookup is needed here.
  const { activeIds } = useGlobalPresence()
  const onlineCount = activeIds?.length ?? 0

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { user } = await getCachedAuth()
      if (cancelled || !user) return
      setUserId(user.id)
      const { data, error } = await siteMenuProfile(user.id)
      if (cancelled) return
      if (error) { reportSupabaseError(error, 'v2-dashboard:site-menu-profile'); return }
      setUsername(data.username)
      setUserRole(data.role)
    })()
    return () => { cancelled = true }
  }, [])

  const onNav = useCallback((id: string) => {
    const href = SECTIONS.find(s => s.id === id)?.href
    if (href) router.push(href)
  }, [router])

  return (
    <Frame
      titleBar={
        <SiteTitleBar
          username={username}
          userRole={userRole}
          userId={userId}
          onlineCount={onlineCount}
        />
      }
      nav={SECTIONS}
      navActive="dashboard"
      onNav={onNav}
      left={
        // Menu only, per the mockup. The rail itself never scrolls; the list
        // scrolls in its own box (app/v2/frame.css .railscroll).
        //
        // pendingCount 0 hides the Moderation Queue badge - a known gap, not an
        // oversight: the old sidebar counts pending rumors with its own inline
        // query and duplicating it needs a lib/data helper of its own.
        <div className="railscroll">
          <SiteNav userRole={userRole} pendingCount={0} variant="frame" />
        </div>
      }
      centre={<MapView embedded />}
    />
  )
}
