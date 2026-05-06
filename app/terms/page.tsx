'use client'
// /terms — beta-period terms of service. Plain-language, narrow-scope.
// Will get a proper legal pass before public launch.

import Link from 'next/link'

export default function TermsPage() {
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
            Terms of Service
          </div>
          <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1, marginBottom: '6px' }}>
            The deal we&apos;re asking you to agree to
          </div>
          <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
            Beta-period plain-language version. Last updated 2026-05-04.
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>What this is</div>
          <div style={body}>
            <p>The Tapestry is a companion app for the Distemper / XSE TTRPG, in active beta. It&apos;s provided as-is. We&apos;re building in the open with real users; expect bugs, expect breakage, expect features to change. Use the 🐛 icon in the sidebar to report anything that goes wrong — we read every report.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Your account</div>
          <div style={body}>
            <ul style={{ paddingLeft: '18px', margin: '6px 0 0' }}>
              <li>You&apos;re responsible for keeping your password safe.</li>
              <li>Don&apos;t share your account with someone else; create a separate account for them. Free, fast.</li>
              <li>Don&apos;t use someone else&apos;s account without permission.</li>
              <li>Don&apos;t use the platform for anything illegal, abusive, or harassing.</li>
              <li>We can suspend or delete accounts that violate these terms. We&apos;ll try to tell you why first when we can.</li>
            </ul>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Your content</div>
          <div style={body}>
            <p>Stuff you create — characters, campaigns, NPCs, pins, scenes, forum posts — stays yours. By posting it on the platform, you give us a license to host and display it as part of running the platform. Nothing more. We don&apos;t claim ownership of your creative work.</p>
            <p>Modules you publish to the marketplace are subject to your chosen visibility (Private / Unlisted / Listed). Listed modules go through moderation review before they appear publicly.</p>
            <p>Don&apos;t post content that infringes someone else&apos;s copyright, that&apos;s defamatory, or that depicts illegal activity. Distemper is a horror game — dark themes are fine; specific real-world abuse / hate / harassment isn&apos;t.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Distemper IP</div>
          <div style={body}>
            <p>The Distemper setting, the XSE rule system, and the DistemperVerse brand are owned by Xero Sum Games. Using The Tapestry doesn&apos;t grant you a license to publish those outside the platform. Inside the platform, fair use applies — write your character&apos;s backstory, run your campaign, share war stories.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Beta caveats</div>
          <div style={body}>
            <ul style={{ paddingLeft: '18px', margin: '6px 0 0' }}>
              <li>Features can change or disappear without notice.</li>
              <li>Data loss is possible (we make backups; we can&apos;t promise zero loss).</li>
              <li>The platform may go offline for maintenance with little or no warning.</li>
              <li>No SLAs, no uptime guarantees, no warranty of any kind during beta.</li>
              <li>If something is broken in a way that costs you a session, we&apos;re sorry, but we can&apos;t compensate you for it.</li>
            </ul>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Liability</div>
          <div style={body}>
            <p>Use the platform at your own risk. We&apos;re not liable for damages arising from your use of the platform, to the extent allowed by law. (A real legal pass goes here pre-public-launch.)</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Changes</div>
          <div style={body}>
            <p>If we change these terms in a way that materially affects you, we&apos;ll surface a notice on the platform before the change takes effect.</p>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Contact</div>
          <div style={body}>
            <p>Questions: <a href="mailto:xerosumstudio@gmail.com" style={{ color: '#c4a7f0' }}>xerosumstudio@gmail.com</a> or the 🐛 icon in the sidebar.</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/privacy" style={{ color: '#c4a7f0', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            See also: Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  )
}
