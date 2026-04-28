'use client'
import Link from 'next/link'

// "A Guide to the Tapestry" — the reference hub for returning users.
// First-time users land at /firsttimers instead. The standard left sidebar
// is provided by LayoutShell (see NO_SIDEBAR_PAGES — /welcome is NOT in it).
export default function WelcomePage() {

  // ---- Shared styles ----
  const card: React.CSSProperties = {
    background: '#161616',
    border: '1px solid #2e2e2e',
    borderRadius: '4px',
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  }
  const cardTitle: React.CSSProperties = {
    fontFamily: 'Barlow Condensed, sans-serif',
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: '#f5f2ee',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }
  const cardBody: React.CSSProperties = {
    fontSize: '15px',
    color: '#d4cfc9',
    lineHeight: 1.65,
    flex: 1,
  }
  const cardLink: React.CSSProperties = {
    fontFamily: 'Barlow Condensed, sans-serif',
    fontSize: '13px',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: '#cce0f5',
    textDecoration: 'none',
    alignSelf: 'flex-start',
    padding: '6px 14px',
    border: '1px solid #3a3a3a',
    borderRadius: '3px',
    background: '#242424',
  }
  const sectionHeading: React.CSSProperties = {
    fontFamily: 'Barlow Condensed, sans-serif',
    fontSize: '13px',
    letterSpacing: '.2em',
    textTransform: 'uppercase',
    color: '#c0392b',
    marginBottom: '10px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', overflowY: 'auto' }}>

      {/* Hero */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3.5rem 1.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '10px' }}>
          Reference &amp; Help
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '46px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '14px' }}>
          A Guide to the Tapestry
        </div>
        <div style={{ fontSize: '16px', color: '#cce0f5', maxWidth: '640px', margin: '0 auto', lineHeight: 1.7 }}>
          Come back here whenever you need a refresher on what lives where. Each section below points to a part of the platform, with a short note on what it&apos;s for and how to get the most out of it.
        </div>
        <div style={{ fontSize: '13px', color: '#8a8a8a', marginTop: '14px' }}>
          New here? Start with <Link href="/firsttimers" style={{ color: '#cce0f5', textDecoration: 'underline' }}>Welcome to the DistemperVerse</Link>.
        </div>
        <div style={{ width: '60px', height: '2px', background: '#c0392b', margin: '2rem auto 0' }} />
      </div>

      {/* Main destinations */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 1.5rem 2rem' }}>
        <div style={sectionHeading}>The Tapestry</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '2.5rem' }}>

          <div style={card}>
            <div style={cardTitle}><span>🗺️</span>The World</div>
            <div style={cardBody}>The interactive map of the post-flu world. Drop pins, file Rumors, and watch what other survivors are reporting. Substantiated Rumors shape the canon over time.</div>
            <Link href="/map" style={cardLink}>Open Map</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🧬</span>My Survivors</div>
            <div style={cardBody}>Your roster of characters. Build new ones via Backstory Generation, the Quick Character Generator, or the Random Character path. Sheets, gear, and history all live here.</div>
            <Link href="/characters" style={cardLink}>My Survivors</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>📖</span>My Stories</div>
            <div style={cardBody}>Campaigns and one-shots you&apos;re part of, as a player or GM. The story table, scenes, and session history all hang off of a Story.</div>
            <Link href="/stories" style={cardLink}>My Stories</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🏘️</span>My Communities</div>
            <div style={cardBody}>Communities are persistent groups of survivors who share a base, resources, and Morale. Recruit, lose, and grow them across sessions — XSE §08 Community drives the rules.</div>
            <Link href="/communities" style={cardLink}>My Communities</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>📦</span>Modules</div>
            <div style={cardBody}>Pre-built scenes, NPCs, items, and storylines you can subscribe to and import into your own campaigns. Authors snapshot their content; you pull versioned copies.</div>
            <Link href="/modules" style={cardLink}>Browse Modules</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🔥</span>The Campfire</div>
            <div style={cardBody}>The town notice board for the Tapestry — Looking-for-Group posts, Rumors from the world map, War Stories, and world events. <span style={{ color: '#8a8a8a' }}>(In progress.)</span></div>
            <Link href="/campfire" style={cardLink}>Visit the Campfire</Link>
          </div>

        </div>

        {/* Survivor creation paths */}
        <div style={sectionHeading}>Building a Survivor</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '2.5rem' }}>
          <div style={card}>
            <div style={cardTitle}>Creating a Survivor</div>
            <div style={cardBody}>The full guide — how Character Development Points (CDP), chapters, and trait acquisition work.</div>
            <Link href="/creating-a-character" style={cardLink}>Read Guide</Link>
          </div>
          <div style={card}>
            <div style={cardTitle}>Backstory Generation</div>
            <div style={cardBody}>Spend CDP across the chapters of your survivor&apos;s life — the rich path. Best for first survivors.</div>
            <Link href="/characters/new" style={cardLink}>Start</Link>
          </div>
          <div style={card}>
            <div style={cardTitle}>Quick Character</div>
            <div style={cardBody}>Skip the chapters. Spend a flat 20 CDP and customize directly. For experienced players.</div>
            <Link href="/characters/quick" style={cardLink}>Start</Link>
          </div>
          <div style={card}>
            <div style={cardTitle}>Random Character</div>
            <div style={cardBody}>Roll up a survivor on the fly. Great for NPCs or table emergencies.</div>
            <Link href="/characters/random" style={cardLink}>Roll</Link>
          </div>
        </div>

        {/* Quick reference — placeholder slot for cheat-sheets, FAQs, etc. */}
        <div style={sectionHeading}>Quick Reference</div>
        <div style={{ ...card, marginBottom: '2.5rem' }}>
          <div style={cardBody}>
            Cheat sheets and rules excerpts will live here — common terms (CDP, WP, RP, Stress, Inspiration), house rules, and links into the SRD &amp; Distemper CRB. Tell me what you want surfaced first and I&apos;ll wire it in.
          </div>
        </div>

        {/* External links */}
        <div style={sectionHeading}>Off-Platform</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '4rem' }}>
          <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer" style={cardLink}>DistemperVerse.com 🔗</a>
          <a href="https://www.xerosumgames.com"   target="_blank" rel="noreferrer" style={cardLink}>XeroSumGames.com 🔗</a>
          <a href="https://www.xerosumstudio.com"  target="_blank" rel="noreferrer" style={cardLink}>XeroSumStudio.com 🔗</a>
        </div>

      </div>
    </div>
  )
}
