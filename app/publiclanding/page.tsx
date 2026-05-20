// /publiclanding - Public landing page for cold visitors (reviewers,
// YouTubers, bloggers). Sidebar-suppressed via NO_SIDEBAR_PAGES in
// LayoutShell.tsx; visible to ghosts via PUBLIC_PAGES.
//
// DRAFT (2026-05-20). Placeholder copy and screenshot boxes. Real
// copy + assets to be supplied by Xero before 2026-06-15 launch.
// Pairs with /press (press kit) and the launch plan at
// tasks/launch-plan-2026-06-15.md.

import Link from 'next/link'

const BG = '#0f0f0f'
const FG = '#f5f2ee'
const DIM = '#cce0f5'
const ACCENT = '#c0392b'
const PANEL = '#1a1a1a'
const BORDER = '#3a3a3a'

export default function PublicLandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: FG, fontFamily: 'Carlito, sans-serif', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>

        {/* Hero */}
        <section style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ display: 'inline-block', padding: '4px 10px', marginBottom: '1rem', background: '#2a1210', border: `1px solid ${ACCENT}`, borderRadius: '3px', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#f5a89a' }}>
            Currently in Beta
          </div>
          <h1 style={{ fontSize: '64px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', margin: '0 0 0.5rem', lineHeight: 1 }}>
            The Tapestry
          </h1>
          <div style={{ fontSize: '18px', letterSpacing: '.1em', color: DIM, marginBottom: '2rem' }}>
            A platform for the DistemperVerse - campaigns, characters, communities, and shared world-state across every story.
          </div>
          <div style={{ width: '60px', height: '2px', background: ACCENT, margin: '0 auto 2rem' }} />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{ padding: '12px 28px', background: ACCENT, color: FG, fontSize: '14px', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, textDecoration: 'none', borderRadius: '3px' }}>
              Request Beta Access
            </Link>
            <Link href="/press" style={{ padding: '12px 28px', background: PANEL, border: `1px solid ${BORDER}`, color: DIM, fontSize: '14px', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '3px' }}>
              Press Kit
            </Link>
          </div>
        </section>

        {/* What it is */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '22px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem' }}>
            What is Tapestry?
          </h2>
          <div style={{ fontSize: '16px', lineHeight: 1.6, color: FG, marginBottom: '1rem' }}>
            [PLACEHOLDER] Tapestry is a web-based platform for playing Distemper, a tabletop RPG set in a post-pandemic shared world. The system handles everything a Game Master and players need: character creation, dice rolls with full canon support, an interactive tactical map, real-time chat, vehicle and community management, persistent world state, and modular adventures called Rumors that any GM can publish or remix.
          </div>
          <div style={{ fontSize: '16px', lineHeight: 1.6, color: FG }}>
            [PLACEHOLDER] Unlike a generic VTT, Tapestry is built around one game's rules and one shared setting. That means deeper mechanical support, no manual house-ruling, and a single authoritative canon that survives sessions. The DistemperVerse is the world; Tapestry is how you play in it.
          </div>
        </section>

        {/* Who it's for */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '22px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem' }}>
            Who is it for?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: DIM, marginBottom: '0.5rem' }}>
                GMs running Distemper
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                [PLACEHOLDER] Full rules support, persistent world state across sessions, community + faction tracking, modular published adventures.
              </div>
            </div>
            <div style={{ padding: '1rem', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: DIM, marginBottom: '0.5rem' }}>
                Players in a Distemper campaign
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                [PLACEHOLDER] Character sheet that does the math, inventory + encumbrance tracking, tactical map for combat, war stories archived across campaigns.
              </div>
            </div>
            <div style={{ padding: '1rem', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: DIM, marginBottom: '0.5rem' }}>
                Curious about the setting
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                [PLACEHOLDER] Public Rules pages, world atlas, community-published Rumors. Read first, decide later.
              </div>
            </div>
          </div>
        </section>

        {/* Screenshots */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '22px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem' }}>
            What it looks like
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'In-session table', caption: 'Combat + chat + tactical map' },
              { label: 'Character sheet', caption: 'Stats, skills, inventory, lasting wounds' },
              { label: 'Community dashboard', caption: 'Morale, resources, members' },
            ].map((s, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ aspectRatio: '16/10', background: '#242424', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '14px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  [SCREENSHOT PLACEHOLDER]
                </div>
                <div style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: DIM, marginBottom: '0.25rem' }}>{s.label}</div>
                  <div style={{ fontSize: '13px', color: '#999' }}>{s.caption}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: 'center', padding: '2rem', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px' }}>
          <div style={{ fontSize: '22px', letterSpacing: '.08em', textTransform: 'uppercase', color: FG, marginBottom: '0.5rem' }}>
            Ready to roll?
          </div>
          <div style={{ fontSize: '14px', color: DIM, marginBottom: '1.5rem' }}>
            Tapestry is in beta. Request access and we'll get you set up.
          </div>
          <Link href="/signup" style={{ padding: '12px 28px', background: ACCENT, color: FG, fontSize: '14px', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, textDecoration: 'none', borderRadius: '3px' }}>
            Request Beta Access
          </Link>
        </section>

        {/* Footer */}
        <footer style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: `1px solid ${BORDER}`, textAlign: 'center', fontSize: '13px', color: '#888' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <Link href="/press" style={{ color: DIM, marginRight: '1rem' }}>Press Kit</Link>
            <Link href="/rules" style={{ color: DIM, marginRight: '1rem' }}>Rules</Link>
            <Link href="/login" style={{ color: DIM }}>Sign In</Link>
          </div>
          <div>The Tapestry - Distemper. Currently in beta. (c) 2026.</div>
        </footer>

      </div>
    </div>
  )
}
