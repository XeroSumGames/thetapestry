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

export interface SiteNavProps {
  userRole: string | null
  /** Pending-rumor count for the Moderation Queue badge. 0 hides it. */
  pendingCount: number
}

/**
 * Every site destination: the top-level links, the Survivors section, and the
 * Thriver-only Tools section. `data-tour` attributes are preserved verbatim -
 * the onboarding tour targets them by selector.
 */
export function SiteNav({ userRole, pendingCount }: SiteNavProps) {
  return (
    <>
      {/* The Tapestry - top-level destinations. Section header suppressed
          per user spec: "Welcome to the Tapestry" is the first link so a
          "THE TAPESTRY" heading right above it reads as redundant. The
          user-header above already provides its own borderBottom, so no
          explicit {divider} is needed here. */}
      <Link href="/dashboard?tour=1" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>A Guide to the Tapestry</Link>
      <Link href="/map"         data-tour="dashboard" style={linkStyle('#c0392b')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>The World</Link>
      <Link href="/characters"  data-tour="dashboard survivors" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Survivors</Link>
      <Link href="/stories"     data-tour="dashboard stories" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Stories</Link>
      <Link href="/stories/join" data-tour="dashboard" style={linkStyle('#7ab3d4')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Join a Story</Link>
      <Link href="/communities" data-tour="dashboard communities" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>My Communities</Link>
      <Link href="/campfire" data-tour="dashboard campfire" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>The Campfire</Link>
      <Link href="/rumors"   data-tour="dashboard rumors" style={linkStyle('#8b5cf6')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Rumors</Link>
      <Link href="/rules"    data-tour="dashboard" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>The Rules</Link>
      <Link href="/quick-reference" data-tour="dashboard" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Quick Reference</Link>
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

      {divider}

      {/* Survivors - character creation paths */}
      <div style={sectionHeading}>Survivors</div>
      <Link href="/creating-a-character" data-tour="characters" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Creating a Survivor</Link>
      {/* Order 2026-08-06 (Xero): Backstory leads since the onboarding tour
          marks it [Recommended]; Quick then Random follow, Paradigms last.
          Supersedes the earlier T3-3 "Random first" onboarding call. */}
      <Link href="/characters/new"       data-tour="characters" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Backstory Generation</Link>
      <Link href="/characters/quick"     data-tour="characters" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Quick Character</Link>
      <Link href="/characters/random"    data-tour="characters" style={linkStyle('#7fc458')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Random Character</Link>
      <Link href="/characters/paradigms"  data-tour="characters" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Paradigms</Link>
      {roleIsThriver(userRole) && (
        <Link href="/pregens" data-tour="characters" style={linkStyle('#3a3a3a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Pregens</Link>
      )}

      {divider}

      {/* Tools - Thriver-only. Keeps elevated destinations behind the role gate
          so Survivors don't see admin surfaces. */}
      {roleIsThriver(userRole) && (
        <>
          <div style={sectionHeading}>Tools</div>
          {/* Order locked 2026-05-16 per Xero: the four daily-driver
              tools (Moderation, Logs, Create Tokens, Migrate Photos)
              ride at the top; the rest of the admin surfaces sit
              below in their previous relative order. */}
          <Link href="/moderate"
            style={{ ...linkStyle('#EF9F27'), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
            Moderation Queue
            {pendingCount > 0 && <span style={{ background: '#c0392b', color: '#fff', fontSize: '13px', padding: '1px 6px', borderRadius: '3px' }}>{pendingCount}</span>}
          </Link>
          <Link href="/logging"                       style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Logs</Link>
          <Link href="/ape-log"                       style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Ape Generator Log</Link>
          <Link href="/tools/feature-manifest"        style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Feature Manifest</Link>
          <Link href="/tools/token-creator"          style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Create Tokens</Link>
          <Link href="/tools/migrate-character-photos" style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Character Photos</Link>
          <Link href="/rumors/import"                style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Publish from Snapshot</Link>
          <Link href="/tools/rescale-tactical-scenes" style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Rescale Tactical Scenes</Link>
          <Link href="/tools/reseed-campaign"        style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Reseed Campaign</Link>
          <Link href="/tools/campaign-explorer"      style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>Campaign Explorer</Link>
          {/* Not a link: dispatches a window event that MapView listens for
              (components/MapView.tsx), so it only does anything on a page
              where the map is mounted. Behaviour unchanged by this move. */}
          <a href="#"
            onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('tapestry-copy-map-position')) }}
            style={linkStyle('#EF9F27')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
            Copy Map Position
          </a>
          {divider}
        </>
      )}
    </>
  )
}
