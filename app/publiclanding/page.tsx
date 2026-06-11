// /publiclanding - HOLDING PAGE.
//
// 2026-06-11: Xero is rewriting the pitch. The previous draft content is
// preserved in git history (one commit back) and can be restored or
// referenced when the rewrite is done.
//
// The F1 redirect (app/page.tsx) still sends anon visitors here, so this
// is what cold backers / hand-typers see during the rewrite window.
// Keep it minimal, on-brand, and honest about the state.
//
// To restore: replace this file with the new rewritten content.

import Link from 'next/link'

const BG = '#0f0f0f'
const FG = '#f5f2ee'
const DIM = '#cce0f5'
const ACCENT = '#c0392b'

export default function PublicLandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: FG, fontFamily: 'Carlito, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '560px', textAlign: 'center' }}>

        <div style={{ display: 'inline-block', padding: '4px 12px', marginBottom: '1.5rem', background: '#2a1210', border: `1px solid ${ACCENT}`, borderRadius: '3px', fontSize: '13px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#f5a89a' }}>
          The Tapestry
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '1rem', letterSpacing: '.02em' }}>
          Something new is being written.
        </h1>

        <p style={{ fontSize: '15px', color: DIM, lineHeight: 1.6, marginBottom: '2.5rem' }}>
          The Tapestry is the virtual tabletop for Distemper, a tabletop RPG
          set fifteen years after the world stopped working. We&apos;re polishing
          the pitch page right now. Check back in a few days, or get in touch
          if you&apos;re a reviewer, podcaster, or backer who can&apos;t wait.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <Link href="/login" style={{ padding: '10px 20px', background: ACCENT, color: FG, border: `1px solid ${ACCENT}`, borderRadius: '3px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.1em', textDecoration: 'none', fontWeight: 600 }}>
            Sign In
          </Link>
          <Link href="/press" style={{ padding: '10px 20px', background: 'transparent', color: FG, border: `1px solid ${FG}`, borderRadius: '3px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.1em', textDecoration: 'none', fontWeight: 600 }}>
            Press Kit
          </Link>
        </div>

        <p style={{ fontSize: '13px', color: '#888', marginTop: '2rem' }}>
          Beta opens July 2026. Kickstarter September 2026.
        </p>

      </div>
    </div>
  )
}
