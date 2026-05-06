'use client'
// /privacy — beta-period privacy policy. Plain-language, narrow-scope.
// Replaces the placeholder; will get a proper legal pass before public
// launch. The point during beta is just to disclose what's actually
// being collected so testers know what they're agreeing to.

import Link from 'next/link'

export default function PrivacyPage() {
  const card: React.CSSProperties = {
    background: '#161616', border: '1px solid #2e2e2e', borderRadius: '4px',
    padding: '20px 24px', marginBottom: '14px',
  }
  const cardTitle: React.CSSProperties = {
    fontFamily: 'Carlito, sans-serif', fontSize: '15px', fontWeight: 700,
    letterSpacing: '.12em', textTransform: 'uppercase', color: '#c0392b',
    marginBottom: '10px',
  }
  const body: React.CSSProperties = {
    fontSize: '14px', color: '#d4cfc9', lineHeight: 1.6,
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#0f0f0f', color: '#d4cfc9' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '6px' }}>
            Privacy
          </div>
          <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1, marginBottom: '6px' }}>
            How we handle your data
          </div>
          <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
            Beta-period plain-language version. Last updated 2026-05-04.
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>What we collect</div>
          <div style={body}>
            <p>When you sign up:</p>
            <ul style={{ paddingLeft: '18px', margin: '6px 0 12px' }}>
              <li>Your email address (used for account recovery + transactional notices)</li>
              <li>A username you pick (publicly visible alongside any content you author)</li>
              <li>An encrypted password hash (never plaintext; we never see it)</li>
            </ul>
            <p>When you use the platform:</p>
            <ul style={{ paddingLeft: '18px', margin: '6px 0 12px' }}>
              <li>Content you author — characters, NPCs, pins, scenes, forum posts, war stories, LFG posts</li>
              <li>Your account avatar and (optionally) character portraits, stored in the platform&apos;s storage layer</li>
              <li>A small set of funnel events (pin reveals, character creation, recruit attempts, etc.) for product analytics — never sold, never shared</li>
              <li>Bug reports you submit (page URL + browser info + your description)</li>
            </ul>
            <p>What we do NOT collect: tracking pixels, third-party advertising data, payment info (none yet — paid features will route through Stripe when they exist).</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Who sees your data</div>
          <div style={body}>
            <ul style={{ paddingLeft: '18px', margin: '6px 0 0' }}>
              <li><strong>You</strong> — always, full access</li>
              <li><strong>Other players in your campaign</strong> — characters, pins, NPCs, scenes you&apos;ve revealed (per the GM&apos;s settings)</li>
              <li><strong>Thrivers (platform moderators)</strong> — for moderation only: flagged content, public Rumor pins awaiting approval, public Communities, etc.</li>
              <li><strong>Anyone</strong> — content you&apos;ve explicitly published as public (forum posts, listed Modules, world Communities)</li>
              <li><strong>No one else.</strong> We do not sell, rent, or share your data with third parties.</li>
            </ul>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Where data lives</div>
          <div style={body}>
            <p>Your account, characters, campaigns, and content are stored in <strong>Supabase</strong> (PostgreSQL + storage), hosted on AWS. Outbound transactional email goes through <strong>Resend</strong>. The site itself is hosted on <strong>Vercel</strong>. These are the only third parties that touch your data, all of them under standard SaaS data-processing agreements.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Deleting your account</div>
          <div style={body}>
            <p>You can delete your account at any time from <Link href="/account" style={{ color: '#c4a7f0' }}>/account</Link>. Deletion removes your profile, characters, and personally-identifying data. Content you authored that&apos;s entangled with other users (campaigns where other players still play, modules other GMs subscribed to, public forum posts) is anonymized rather than deleted, so the rest of the platform doesn&apos;t break for everyone else.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Cookies + local storage</div>
          <div style={body}>
            <p>We use a single auth cookie (so you stay logged in) and a small amount of browser localStorage (UI preferences like sidebar state, cell size, last-viewed map zoom). No tracking cookies, no third-party cookies, no advertising IDs.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Children</div>
          <div style={body}>
            <p>Distemper is a horror TTRPG with mature themes. The Tapestry is intended for users 13 and older. We don&apos;t knowingly collect data from children under 13.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Questions</div>
          <div style={body}>
            <p>This policy will get a proper legal pass before public launch. If you have a privacy question during beta, reach out to <a href="mailto:xerosumstudio@gmail.com" style={{ color: '#c4a7f0' }}>xerosumstudio@gmail.com</a> or use the 🐛 bug report icon in the sidebar.</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/terms" style={{ color: '#c4a7f0', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            See also: Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  )
}
