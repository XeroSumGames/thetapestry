'use client'
// The chrome every /v2 page shares: title bar, section strip, left rail.
//
// Phase 1.3 of tasks/plan-one-frame-new-pages-2026-09-15.md, built to the
// approved mockup (D:\ClaudeOutput\tapestry-frame.html). Each section page
// supplies only its CENTRE; nothing else differs between them, which is the
// whole point of the frame.
//
// WHY THE CENTRE IS A PROP RATHER THAN children-of-a-layout: the section strip
// needs to know which tab is active, and a Next layout cannot see which child
// route rendered it without threading state back up. Passing `centre` and
// `active` keeps that explicit.
//
// WHY THIS IS A CLIENT COMPONENT THAT ACCEPTS A ReactNode: app/rules/page.tsx is
// a SERVER component while the other four sections are client ones. A server
// component cannot be imported into a client component - but it CAN be passed
// into one as a prop. So each /v2 section page stays whatever it already is and
// hands its content in, and this shell never has to care which kind it got.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Frame, { type NavTab } from './Frame'
import { SiteTitleBar, SiteNav } from './SiteMenu'
import { getCachedAuth } from '../lib/auth-cache'
import { siteMenuProfile } from '../lib/data/profiles'
import { useGlobalPresence } from '../lib/realtime/useGlobalPresence'
import { reportSupabaseError } from '../lib/supabase-errors'

/** The six world-view sections, in the mockup's order. */
export const V2_SECTIONS: (NavTab & { href: string })[] = [
  { id: 'dashboard', label: 'DASHBOARD', href: '/v2/dashboard' },
  { id: 'survivors', label: 'MY SURVIVORS', href: '/v2/characters' },
  { id: 'stories', label: 'MY STORIES', href: '/v2/stories' },
  { id: 'communities', label: 'MY COMMUNITIES', href: '/v2/communities' },
  { id: 'campfire', label: 'THE CAMPFIRE', href: '/v2/campfire' },
  { id: 'rules', label: 'THE RULES', href: '/v2/rules' },
]

export default function V2Shell({
  active,
  centre,
  right,
  titleNote,
}: {
  /** Which section tab is lit. One of V2_SECTIONS' ids. */
  active: string
  centre: React.ReactNode
  /**
   * The player panel. Omitted for now on every section: the mockup puts the
   * PINS panel here, and that needs MapView's panel state lifted out (1.2b).
   * Frame falls back to a two-column grid when it is absent, and the section
   * strip drops its last-tab 260px rule with it.
   */
  right?: React.ReactNode
  /** Overrides the title bar's section label. Defaults to the active tab. */
  titleNote?: string
}) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // App-wide presence provider, so the frame gets the count without opening a
  // second channel. The mockup's title bar shows the count alone.
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
      if (error) { reportSupabaseError(error, 'v2-shell:site-menu-profile'); return }
      setUsername(data.username)
      setUserRole(data.role)
    })()
    return () => { cancelled = true }
  }, [])

  const onNav = useCallback((id: string) => {
    const href = V2_SECTIONS.find(s => s.id === id)?.href
    // Every tab now stays inside the frame - no section leaves it.
    if (href) router.push(href)
  }, [router])

  const label = titleNote ?? V2_SECTIONS.find(s => s.id === active)?.label ?? ''

  return (
    <Frame
      titleBar={
        <>
          <SiteTitleBar
            username={username}
            userRole={userRole}
            userId={userId}
            onlineCount={onlineCount}
          />
        </>
      }
      nav={V2_SECTIONS}
      navActive={active}
      onNav={onNav}
      left={
        // Menu only, per the mockup. The rail never scrolls; the list scrolls in
        // its own box (app/v2/frame.css .railscroll).
        //
        // pendingCount 0 hides the Moderation Queue badge - a known gap: the old
        // sidebar counts pending rumors with its own inline query, and
        // duplicating it needs a lib/data helper of its own.
        <div className="railscroll">
          <SiteNav userRole={userRole} pendingCount={0} variant="frame" />
        </div>
      }
      centre={centre}
      right={right}
    />
  )
}
