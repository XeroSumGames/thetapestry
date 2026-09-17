'use client'
// The site menu and the identity block, lifted out of components/Sidebar.tsx
// (Phase 0.2, tasks/plan-one-frame-new-pages-2026-09-15.md) so the new /v2
// frame can render the same menu in a rail without a second copy of the links.
//
// PURELY PRESENTATIONAL, on purpose. Every data fetch stays where it was in
// Sidebar.tsx - the profile read, the pending-rumor count and the presence
// roster all still live there and their results arrive here as props. That
// keeps this a JSX move with no query relocation and no change in when
// anything is fetched, which is what makes "the old sidebar behaves
// identically" provable rather than merely argued.
//
// Two reasons not to make these components self-loading:
//   1. Sidebar's one profile query selects username + role + avatar_url, and
//      avatar_url is only used by the bottom account row that stays behind. A
//      self-loading menu would either duplicate that read (two profile queries
//      per page) or need the row split across two queries.
//   2. check-arch counts inline supabase reads outside lib/data repo-wide and
//      strictly, at baseline with no headroom, so a duplicated read fails the
//      gate outright. (Writing that rule out with the literal dotted call
//      syntax in a comment ALSO trips it - the counter matches raw text, so at
//      zero headroom even documenting the rule costs a point. Learned here.)
//
// When /v2 renders these in Phase 1.2 it supplies the same props from its own
// loader. If that turns out to duplicate Sidebar's effect, THEN a shared hook
// is worth extracting - with two real consumers to shape it, rather than one
// speculative one.
import { useState } from 'react'
import Link from 'next/link'
import { isThriver as roleIsThriver } from '../lib/auth/roles'
import NotificationBell from './NotificationBell'
import MessagesBell from './MessagesBell'
import BugReportButton from './BugReportButton'
import RecorderToggleButton from './RecorderToggleButton'

// Moved verbatim from Sidebar.tsx. Module scope rather than per-render: none of
// them read component state.
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

export interface SiteIdentityProps {
  /** Empty string means a ghost (unauthenticated, or no profile row). */
  username: string
  userRole: string | null
  userId: string | null
  onlineCount: number
  presentUsernames: string[]
}

/**
 * Logo, title + version, the Survivors-present count with its Thriver-only
 * roster popup, and the user header (username, Thriver badge, icon row) or the
 * Ghost link. Renders the two bordered blocks from the top of the old sidebar.
 */
export function SiteIdentity({ username, userRole, userId, onlineCount, presentUsernames }: SiteIdentityProps) {
  // Hover state is presentational, so it moves here rather than staying behind
  // in Sidebar and being threaded through as a prop.
  const [presenceHover, setPresenceHover] = useState(false)
  const isGuest = !username

  return (
    <>
      {/* Branding */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #c0392b', textAlign: 'center' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <img src="/DistemperLogoRedv5.png" alt="Distemper" style={{ height: '28px', objectFit: 'contain', marginBottom: '4px' }} />
          <div style={{ fontFamily: 'Distemper, sans-serif', fontSize: '18px', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1 }}>The Tapestry <span style={{ fontSize: '13px', color: '#f5f2ee' }}>v0.5</span></div>
        </Link>
        {onlineCount > 0 && (
          <div
            onMouseEnter={() => roleIsThriver(userRole) && setPresenceHover(true)}
            onMouseLeave={() => setPresenceHover(false)}
            style={{ position: 'relative', fontSize: '14px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '4px', cursor: roleIsThriver(userRole) ? 'help' : 'default' }}>
            Survivors present: {onlineCount}
            {/* Thriver-only roster popup. Anchored under the count line,
                left-aligned with the sidebar so it doesn't clip. Survivors
                see only the count - keeps presence-style anonymity for
                non-Thriver viewers. */}
            {presenceHover && roleIsThriver(userRole) && presentUsernames.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '4px', minWidth: '180px', maxWidth: '240px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '8px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.6)', zIndex: 1000, textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Online now</div>
                {presentUsernames.map(n => (
                  <div key={n} style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: 0, textTransform: 'none', padding: '1px 0' }}>
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
          <Link href="/signup" style={{ display: 'block', textAlign: 'center', color: '#7fc458', fontSize: '14px', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'underline' }}>You are a Ghost</Link>
        ) : (
          <>
            {/* Line 1: Username, with the role badge ONLY for Thrivers.
                Survivor is the default - surfacing the badge for every
                logged-in user adds visual noise without adding info. */}
            <div style={{ fontSize: '14px', letterSpacing: '.1em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '7px', textAlign: 'center' }}>
              <span style={{ color: '#f5f2ee' }}>{username}</span>
              {roleIsThriver(userRole) && (
                <span style={{ color: '#c0392b', marginLeft: '5px' }}>(Thriver)</span>
              )}
            </div>
            {/* Line 2: icons - equal-width slots so visual midpoints
                line up regardless of each component's internal padding.
                space-evenly + space-around both gave uneven gaps because
                the three children have different intrinsic widths
                (MessagesBell + NotificationBell wrap their buttons in
                different padding; the Campfire emoji has none). Three
                fixed-width centred cells fix it. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><NotificationBell /></div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><MessagesBell /></div>
              {/* Campfire shortcut - emoji glyphs ignore CSS color, so
                  use opacity + grayscale to actually grey the icon out
                  while it's a placeholder ('coming soon' from the
                  user-header surface; the full /campfire page is still
                  reachable from the main nav below). Matches the
                  MessagesBell dim-when-idle treatment. */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Link href="/campfire" title="The Campfire" style={{ fontSize: '16px', lineHeight: 1, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>🔥</Link>
              </div>
              {/* Bug report - opens a modal where the user describes
                  what broke. Insert into bug_reports fires the
                  notify_bug_report trigger which emails Xero via the
                  existing call_notify_thriver path. */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><BugReportButton /></div>
              {/* Recorder toggle - Thriver-only diagnostic tool */}
              {roleIsThriver(userRole) && userId && (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <RecorderToggleButton userId={userId} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

/**
 * Destinations that exist inside the /v2 frame. In frame mode a menu link
 * pointing at one of these is rewritten so the rail keeps you in the frame -
 * the rail is the biggest, most familiar target on screen, so a link that
 * ejects you reads as the frame being broken even when every section tab works.
 *
 * Anything NOT listed keeps pointing at today's page and leaves the frame. That
 * is deliberate: an ejecting link is bad, a dead link is worse. The list grows
 * as /v2 pages are built.
 *
 * "The World" maps to the Dashboard because the Dashboard's centre IS the world
 * map - the same component /map renders.
 *
 * "A Guide to the Tapestry" is deliberately NOT mapped: the onboarding tour
 * targets the OLD sidebar's links by selector, so it has to stay on the old
 * pages until the switch (plan, Risks).
 */
const V2_HREF: Record<string, string> = {
  '/map': '/v2/dashboard',
  '/characters': '/v2/characters',
  '/stories': '/v2/stories',
  '/communities': '/v2/communities',
  '/campfire': '/v2/campfire',
  '/rules': '/v2/rules',
}

export interface SiteNavProps {
  userRole: string | null
  /** Pending-rumor count for the Moderation Queue badge. 0 hides it. */
  pendingCount: number
  /**
   * 'sidebar' (default) renders the inline styles the old sidebar has always
   * used, so that surface stays byte-identical. 'frame' drops them and lets
   * app/v2/frame.css style the menu as the approved mockup does.
   *
   * A variant rather than a second component on purpose: the link list, the
   * role gates and the data-tour attributes must not exist twice, or the two
   * menus drift the first time someone adds a destination.
   */
  variant?: 'sidebar' | 'frame'
}

/**
 * Every site destination: the top-level links, the Survivors section, and the
 * Thriver-only Tools section. `data-tour` attributes are preserved verbatim -
 * the onboarding tour targets them by selector.
 */
export function SiteNav({ userRole, pendingCount, variant = 'sidebar' }: SiteNavProps) {
  const frame = variant === 'frame'
  // In frame mode the accent survives as the link's left border colour, which
  // is what carries the red/blue/purple/green coding across both looks.
  const navProps = (accent: string) => frame
    ? { style: { borderLeftColor: accent } as React.CSSProperties }
    : {
        style: linkStyle(accent),
        onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => hover(e, true),
        onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => hover(e, false),
      }
  const headingProps = frame ? { className: 'grp' } : { style: sectionHeading }
  const navHref = (h: string) => (frame ? V2_HREF[h] ?? h : h)
  const Wrap: any = frame ? 'nav' : 'div'
  const wrapProps = frame ? { className: 'menu' } : { style: { display: 'contents' as const } }
  return (
    <Wrap {...wrapProps}>
      {/* The Tapestry - top-level destinations. Section header suppressed
          per user spec: "Welcome to the Tapestry" is the first link so a
          "THE TAPESTRY" heading right above it reads as redundant. The
          user-header above already provides its own borderBottom, so no
          explicit {divider} is needed here. */}
      <Link href={navHref('/dashboard?tour=1')} {...navProps('#3a3a3a')}>A Guide to the Tapestry</Link>
      <Link href={navHref('/map')}         data-tour="dashboard" {...navProps('#c0392b')}>The World</Link>
      <Link href={navHref('/characters')}  data-tour="dashboard survivors" {...navProps('#3a3a3a')}>My Survivors</Link>
      <Link href={navHref('/stories')}     data-tour="dashboard stories" {...navProps('#3a3a3a')}>My Stories</Link>
      <Link href={navHref('/stories/join')} data-tour="dashboard" {...navProps('#7ab3d4')}>Join a Story</Link>
      <Link href={navHref('/communities')} data-tour="dashboard communities" {...navProps('#3a3a3a')}>My Communities</Link>
      <Link href={navHref('/campfire')} data-tour="dashboard campfire" {...navProps('#3a3a3a')}>The Campfire</Link>
      <Link href={navHref('/rumors')}   data-tour="dashboard rumors" {...navProps('#8b5cf6')}>Rumors</Link>
      <Link href={navHref('/rules')}    data-tour="dashboard" {...navProps('#3a3a3a')}>The Rules</Link>
      <Link href={navHref('/quick-reference')} data-tour="dashboard" {...navProps('#3a3a3a')}>Quick Reference</Link>
      {/* External link out to the brand site. New tab + rel=noreferrer
          since it leaves the app entirely. Same visual treatment as
          the in-app links so the sidebar stays uniform. */}
      <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer"
        style={linkStyle('#3a3a3a')}
        onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
        The DistemperVerse ↗
      </a>

      {/* Phase 4C - setting hubs (DZ + Kings Crossroads) moved into
          /campfire 2026-05-01 per user spec; sidebar only shows the
          top-level Tapestry destinations. */}

      {!frame && divider}

      {/* Survivors - character creation paths */}
      <div {...headingProps}>Survivors</div>
      <Link href={navHref('/creating-a-character')} data-tour="characters" {...navProps('#3a3a3a')}>Creating a Survivor</Link>
      {/* Order 2026-08-06 (Xero): Backstory leads since the onboarding tour
          marks it [Recommended]; Quick then Random follow, Paradigms last.
          Supersedes the earlier T3-3 "Random first" onboarding call. */}
      <Link href={navHref('/characters/new')}       data-tour="characters" {...navProps('#3a3a3a')}>Backstory Generation</Link>
      <Link href={navHref('/characters/quick')}     data-tour="characters" {...navProps('#3a3a3a')}>Quick Character</Link>
      <Link href={navHref('/characters/random')}    data-tour="characters" {...navProps('#7fc458')}>Random Character</Link>
      <Link href={navHref('/characters/paradigms')}  data-tour="characters" {...navProps('#3a3a3a')}>Paradigms</Link>
      {roleIsThriver(userRole) && (
        <Link href={navHref('/pregens')} data-tour="characters" {...navProps('#3a3a3a')}>Pregens</Link>
      )}

      {!frame && divider}

      {/* Tools - Thriver-only. Keeps elevated destinations behind the role gate
          so Survivors don't see admin surfaces. */}
      {roleIsThriver(userRole) && (
        <>
          <div {...headingProps}>Tools</div>
          {/* Order locked 2026-05-16 per Xero: the four daily-driver
              tools (Moderation, Logs, Create Tokens, Migrate Photos)
              ride at the top; the rest of the admin surfaces sit
              below in their previous relative order. */}
          <Link href={navHref('/moderate')}
            {...navProps('#EF9F27')}
            style={frame
              ? { borderLeftColor: '#EF9F27', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
              : { ...linkStyle('#EF9F27'), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Moderation Queue
            {pendingCount > 0 && <span style={{ background: '#c0392b', color: '#fff', fontSize: '13px', padding: '1px 6px', borderRadius: '3px' }}>{pendingCount}</span>}
          </Link>
          <Link href={navHref('/logging')}                       {...navProps('#EF9F27')}>Logs</Link>
          <Link href={navHref('/ape-log')}                       {...navProps('#EF9F27')}>Ape Generator Log</Link>
          <Link href={navHref('/tools/feature-manifest')}        {...navProps('#EF9F27')}>Feature Manifest</Link>
          <Link href={navHref('/tools/token-creator')}          {...navProps('#EF9F27')}>Create Tokens</Link>
          <Link href={navHref('/tools/migrate-character-photos')} {...navProps('#EF9F27')}>Character Photos</Link>
          <Link href={navHref('/rumors/import')}                {...navProps('#EF9F27')}>Publish from Snapshot</Link>
          <Link href={navHref('/tools/rescale-tactical-scenes')} {...navProps('#EF9F27')}>Rescale Tactical Scenes</Link>
          <Link href={navHref('/tools/reseed-campaign')}        {...navProps('#EF9F27')}>Reseed Campaign</Link>
          <Link href={navHref('/tools/campaign-explorer')}      {...navProps('#EF9F27')}>Campaign Explorer</Link>
          {/* Not a link: dispatches a window event that MapView listens for
              (components/MapView.tsx), so it only does anything on a page
              where the map is mounted. Behaviour unchanged by this move. */}
          <a href="#"
            onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('tapestry-copy-map-position')) }}
            {...navProps('#EF9F27')}>
            Copy Map Position
          </a>
          {!frame && divider}
        </>
      )}
    </Wrap>
  )
}

export interface SiteTitleBarProps {
  /** Empty string means a ghost (unauthenticated, or no profile row). */
  username: string
  userRole: string | null
  userId: string | null
  onlineCount: number
}

/**
 * The identity row for the frame's title bar: logo, app name and version, the
 * Survivors-present count, then the user and their icons pushed right.
 *
 * This is where the approved mockup puts identity - NOT the left rail, which is
 * menu only. SiteIdentity (above) keeps the rail-shaped arrangement the OLD
 * sidebar renders, and stays exactly as it is; the two are different layouts of
 * the same information for two different surfaces, which is why the icon
 * components are shared rather than the block.
 *
 * Deliberately no Thriver roster popover here: the mockup's title bar shows the
 * count alone, so the frame does not need the profiles-by-id lookup the old
 * sidebar does for names.
 */
export function SiteTitleBar({ username, userRole, userId, onlineCount }: SiteTitleBarProps) {
  const isGuest = !username
  return (
    <>
      <Link href="/v2/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <img className="tb-logo" src="/DistemperLogoRedv5.png" alt="Distemper" />
      </Link>
      <span className="tb-app">The Tapestry <small>v0.5</small></span>
      <span className="tb-sep" />
      {onlineCount > 0 && <span className="tb-clip">Survivors present: {onlineCount}</span>}
      <span className="tb-spacer" />
      {isGuest ? (
        <Link href="/signup" style={{ color: '#7fc458', fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'underline' }}>
          You are a Ghost
        </Link>
      ) : (
        <>
          <span className="who">
            {username}
            {roleIsThriver(userRole) && <span className="role">(Thriver)</span>}
          </span>
          <span className="tb-icons">
            <NotificationBell />
            <MessagesBell />
            <Link href="/v2/campfire" title="The Campfire" style={{ fontSize: '16px', lineHeight: 1, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>&#128293;</Link>
            <BugReportButton />
            {roleIsThriver(userRole) && userId && <RecorderToggleButton userId={userId} />}
          </span>
        </>
      )}
    </>
  )
}
