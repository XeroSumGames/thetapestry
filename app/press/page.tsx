// /press - Press kit. Public-readable, sidebar-suppressed. Built for
// reviewers, YouTubers, and bloggers who land here from outreach or
// from /publiclanding's footer.
//
// DRAFT (2026-05-20; date refs reconciled 2026-05-30). Placeholder
// copy + asset links. Real assets + founder bio + final messaging
// supplied by Xero ahead of KS reviewer outreach.
// Active timeline: Beta-500 opens 2026-07-01, Kickstarter 2026-09-01.
// Source-of-truth: tasks/north-star.md +
// tasks/kickstarter-readiness-2026-09-01.md.

import Link from 'next/link'

const BG = '#0f0f0f'
const FG = '#f5f2ee'
const DIM = '#cce0f5'
const ACCENT = '#c0392b'
const PANEL = '#1a1a1a'
const BORDER = '#3a3a3a'

const CONTACT_EMAIL = '[PLACEHOLDER@thetapestry.distemperverse.com]'

export default function PressKitPage() {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: FG, fontFamily: 'Carlito, sans-serif', overflowY: 'auto' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>

        {/* Title */}
        <header style={{ marginBottom: '3rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '1.5rem' }}>
          <div style={{ fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: ACCENT, marginBottom: '0.5rem' }}>
            Press Kit
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', margin: '0 0 0.5rem', lineHeight: 1 }}>
            The Tapestry
          </h1>
          <div style={{ fontSize: '15px', color: DIM, marginBottom: '1rem' }}>
            A platform for the DistemperVerse - currently in beta.
          </div>
          <Link href="/publiclanding" style={{ fontSize: '13px', color: DIM, textDecoration: 'underline' }}>
            &larr; Back to landing
          </Link>
        </header>

        {/* Quick facts */}
        <section style={{ marginBottom: '3rem', padding: '1rem', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '0.75rem' }}>
            Quick Facts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1.5rem', fontSize: '14px' }}>
            <div style={{ color: DIM }}>Product:</div>
            <div>The Tapestry - web platform for playing Distemper, a tabletop RPG.</div>
            <div style={{ color: DIM }}>Setting:</div>
            <div>The DistemperVerse - post-pandemic shared world.</div>
            <div style={{ color: DIM }}>Status:</div>
            <div>Beta. Limited public availability via invite. Full launch TBD.</div>
            <div style={{ color: DIM }}>Pricing:</div>
            <div>[PLACEHOLDER] Free during beta. Paid tiers planned post-launch.</div>
            <div style={{ color: DIM }}>Platform:</div>
            <div>Web (desktop browser primary; mobile responsive in progress).</div>
            <div style={{ color: DIM }}>URL:</div>
            <div><Link href="https://thetapestry.distemperverse.com" style={{ color: DIM }}>thetapestry.distemperverse.com</Link></div>
            <div style={{ color: DIM }}>Founded:</div>
            <div>[PLACEHOLDER year + founder name]</div>
          </div>
        </section>

        {/* Product description */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '22px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem' }}>
            About
          </h2>
          <div style={{ fontSize: '15px', lineHeight: 1.6, marginBottom: '1rem' }}>
            [PLACEHOLDER paragraph 1] The Tapestry is a purpose-built web platform for playing Distemper, a tabletop RPG set in a shared post-pandemic world. Where generic virtual tabletops require manual setup of rules, sheets, and tokens, Tapestry ships those built-in: full character creation, encoded mechanics, real-time chat, an interactive tactical map, vehicle and community systems, and modular adventures called Rumors that any GM can publish or remix.
          </div>
          <div style={{ fontSize: '15px', lineHeight: 1.6, marginBottom: '1rem' }}>
            [PLACEHOLDER paragraph 2] The DistemperVerse is the world Tapestry is built around. A post-pandemic America where small communities scratch out a living against a backdrop of broken infrastructure, persistent rumors of the old world, and the daily question of who survives. Players take the role of Survivors and Thrivers; GMs run campaigns that can span months or years and link into the wider shared canon.
          </div>
          <div style={{ fontSize: '15px', lineHeight: 1.6 }}>
            [PLACEHOLDER paragraph 3] Tapestry is in beta as of 2026-05-20, with an active playtester group and limited public availability via invite. Full launch and pricing are planned post-beta. Reviewers, YouTubers, and bloggers are welcome - press inquiries at the contact email below.
          </div>
        </section>

        {/* Founder bio */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '22px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem' }}>
            Founder
          </h2>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: '120px', height: '120px', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase', flexShrink: 0 }}>
              [PHOTO]
            </div>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: DIM, marginBottom: '0.5rem' }}>
                [PLACEHOLDER - Founder name]
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                [PLACEHOLDER bio - 1 paragraph. Background, why Distemper, why Tapestry, what's coming. Keep under 150 words for press inclusion.]
              </div>
            </div>
          </div>
        </section>

        {/* Hero screenshots */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '22px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem' }}>
            Screenshots
          </h2>
          <div style={{ fontSize: '13px', color: DIM, marginBottom: '1rem' }}>
            Click to download full-resolution. Free to use in articles and videos with credit.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {[
              'In-session table view',
              'Tactical map with tokens',
              'Character sheet',
              'Community dashboard',
              'Campaign world map',
            ].map((label, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ aspectRatio: '16/10', background: '#242424', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  [PNG PLACEHOLDER]
                </div>
                <div style={{ padding: '0.5rem 0.75rem', fontSize: '13px', color: DIM }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Logo pack */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '22px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem' }}>
            Logos
          </h2>
          <div style={{ fontSize: '13px', color: DIM, marginBottom: '1rem' }}>
            [PLACEHOLDER - link to ZIP containing: PNG (transparent), SVG, monochrome variants, social-media-cropped versions]
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {['Primary mark', 'Wordmark', 'Monochrome', 'Social square'].map((label, i) => (
              <div key={i} style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ color: '#666', fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase' }}>[LOGO]</div>
                <div style={{ fontSize: '13px', color: DIM }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact + embargo */}
        <section style={{ marginBottom: '3rem', padding: '1.25rem', background: PANEL, border: `2px solid ${ACCENT}`, borderRadius: '3px' }}>
          <h2 style={{ fontSize: '20px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', marginTop: 0 }}>
            Press Contact + Embargo
          </h2>
          <div style={{ fontSize: '14px', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            Reach out for review access, embargo coordination, or interview requests:
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: DIM, marginBottom: '1rem' }}>
            {CONTACT_EMAIL}
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#bbb' }}>
            [PLACEHOLDER] If you have a planned publication date and want advance access + assets, we'll work out timing.
            Embargoes accepted in writing only. Quotes can be on the record or attributed to "the team at The Tapestry" as you prefer.
          </div>
        </section>

        {/* Boilerplate */}
        <section>
          <h2 style={{ fontSize: '22px', letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT, marginBottom: '1rem', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0.5rem' }}>
            Boilerplate
          </h2>
          <div style={{ padding: '1rem', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: '3px', fontSize: '13px', lineHeight: 1.6, color: DIM, fontStyle: 'italic' }}>
            "[PLACEHOLDER 2-sentence boilerplate suitable for press releases. The Tapestry is a web platform for playing Distemper, a tabletop RPG set in the post-pandemic DistemperVerse. Currently in beta at thetapestry.distemperverse.com.]"
          </div>
        </section>

        {/* Footer */}
        <footer style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: `1px solid ${BORDER}`, fontSize: '13px', color: '#888', textAlign: 'center' }}>
          <Link href="/publiclanding" style={{ color: DIM, marginRight: '1rem' }}>Landing</Link>
          <Link href="/rules" style={{ color: DIM }}>Public Rules</Link>
          <div style={{ marginTop: '0.5rem' }}>The Tapestry - Distemper. (c) 2026.</div>
        </footer>

      </div>
    </div>
  )
}
