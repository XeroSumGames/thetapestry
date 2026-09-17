'use client'
// /v2/dashboard - the first page in the house frame.
//
// Phase 1.2a of tasks/plan-one-frame-new-pages-2026-09-15.md. STAGED on
// purpose: the plan's 1.2 puts the PINS panel in the right rail, and that needs
// MapView's panel state lifted out into shared state first (~25 props, plus the
// three layout couplings documented at the top of components/PinsPanel.tsx).
// Doing the lift before Xero has reacted to the frame itself would be building
// on an unjudged foundation, so 1.2a ships the parts that do not depend on it -
// the rails, the section strip, the real menu and the real map - and 1.2b adds
// pins to the right rail.
//
// So: no right rail yet. Frame supports that by design (two-column grid, and
// the section strip's last tab flexes via navstrip--noright), and the standard
// allows a page with genuinely no player-side content to suppress it.
//
// The map renders with its own inner pins LIST suppressed (showSidebar false),
// which is why the canvas is full width here. Pin markers still draw - only the
// 300px list panel is absent, and that is the thing moving to the rail in 1.2b.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Frame, { type NavTab } from '../../../components/Frame'
import { SiteIdentity, SiteNav } from '../../../components/SiteMenu'
import { getCachedAuth } from '../../../lib/auth-cache'
import { siteMenuProfile } from '../../../lib/data/profiles'
import { profileUsernames } from '../../../lib/data/map'
import { useGlobalPresence } from '../../../lib/realtime/useGlobalPresence'
import { isThriver as roleIsThriver } from '../../../lib/auth/roles'
import { reportSupabaseError } from '../../../lib/supabase-errors'

// ssr:false for the same reason the old dashboard does it: Leaflet touches
// window on import.
const MapView = dynamic(() => import('../../../components/MapView'), { ssr: false })

// The section strip. Plan 1.3 repoints these at their /v2 equivalents as each
// is built; until then every tab except DASHBOARD goes to the page that exists
// today, so the strip is never decorative. That does mean leaving the frame
// when you click one - an interim state, not the design.
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
  const [presentUsernames, setPresentUsernames] = useState<string[]>([])

  // Presence comes from the app-wide provider mounted in app/layout.tsx, so the
  // frame gets the online count without opening a second channel.
  const { activeIds } = useGlobalPresence()
  const onlineCount = activeIds?.length ?? 0

  // The menu's own data. The old sidebar loads this for itself; this is a
  // different page, so there is no double fetch. Kept as a page-level load
  // rather than a shared hook for now - the hook is worth extracting once the
  // frame is settled and there are genuinely two long-lived consumers.
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

  // Thrivers get the named roster behind the presence count; everyone else sees
  // only the number, so the lookup is skipped entirely for them.
  const ids = useMemo(() => (activeIds ?? []).filter(Boolean), [activeIds])
  useEffect(() => {
    if (!roleIsThriver(userRole) || ids.length === 0) { setPresentUsernames([]); return }
    let cancelled = false
    ;(async () => {
      const { data, error } = await profileUsernames(ids)
      if (cancelled) return
      if (error) { reportSupabaseError(error, 'v2-dashboard:presence-roster'); return }
      setPresentUsernames(((data ?? []) as any[]).map(r => r.username).filter(Boolean))
    })()
    return () => { cancelled = true }
  }, [userRole, ids])

  const onNav = useCallback((id: string) => {
    const href = SECTIONS.find(s => s.id === id)?.href
    if (href) router.push(href)
  }, [router])

  return (
    <Frame
      titleBar={
        <>
          <span className="tb-mark">The Tapestry</span>
          <span className="tb-sep" />
          <span className="tb-dim">DASHBOARD</span>
          <span className="tb-spacer" />
        </>
      }
      nav={SECTIONS}
      navActive="dashboard"
      onNav={onNav}
      left={
        // THE RAIL ITSELF MUST NOT SCROLL. Measured at 1280x800 the menu is
        // 1206px tall in a 721px rail, so without this the whole column
        // scrolls - which the standard forbids ("rails never scroll; long
        // lists scroll in their own box"). The reference's .fcol is
        // overflow-y:auto and simply never had content long enough to hit it.
        // Fixed here rather than in frame.css so the shared geometry stays a
        // faithful copy; if 1.4 decides every rail should behave this way, the
        // rule belongs in .fcol and this wrapper goes away.
        <>
          <SiteIdentity
            username={username}
            userRole={userRole}
            userId={userId}
            onlineCount={onlineCount}
            presentUsernames={presentUsernames}
          />
          {/* pendingCount 0 hides the Moderation Queue badge. A known gap, not
              an oversight: the old sidebar counts pending rumors with its own
              inline query, and duplicating that read here would need a lib/data
              helper of its own. Thrivers still get the link, just without the
              number, until 1.2b. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <SiteNav userRole={userRole} pendingCount={0} />
          </div>
        </>
      }
      centre={<MapView embedded />}
    />
  )
}
