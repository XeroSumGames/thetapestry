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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '2.5rem' }}>

          <div style={card}>
            <div style={cardTitle}><span>🗺️</span>The World</div>
            <div style={cardBody}>This interactive map of the post-dog flu world allows you to drop pins for yourself or others, report rumors, and see what other survivors are reporting. Substantiated rumors shape the canon over time and are reflected here, on the world map.</div>
            <Link href="/map" style={cardLink}>Open Map</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🧬</span>My Survivors</div>
            <div style={cardBody}>Your roster of characters. Here you can create new ones via the Backstory Generation process that guides you through every step of your characters life before the pandemic, the Quick Character Generator for those that know the system and have a concept in mind, or pick a completely Random Character.</div>
            <Link href="/characters" style={cardLink}>My Survivors</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>📖</span>My Stories</div>
            <div style={cardBody}>Whether it is as a player or GM, here is where you can find the various campaigns and one-shots you&apos;re part of. This is where you launch The Table, where stories are told.</div>
            <Link href="/stories" style={cardLink}>My Stories</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🏘️</span>My Communities</div>
            <div style={cardBody}>Communities are persistent groups of survivors who share a base and resources. Recruit NPCs to your side as cohorts, conscripts, or converts as you grow across sessions, leaving an indelible mark on this persistent world.</div>
            <Link href="/communities" style={cardLink}>My Communities</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>🔥</span>The Campfire</div>
            <div style={cardBody}>The heart of the Tapestry, here players can find groups and GMs can find players. Built-in Looking-for-Group tools, Messaging, Forums, player-reported War Stories, and both rumors and confirmed world events. <span style={{ color: '#8a8a8a' }}>(In progress.)</span></div>
            <Link href="/campfire" style={cardLink}>Visit the Campfire</Link>
          </div>

          <div style={card}>
            <div style={cardTitle}><span>📦</span>Rumors</div>
            <div style={cardBody}>Pre-built scenes, encounters, adventures and campaigns that include NPCs, items, and storylines that you can subscribe to and import to play with your own group. Authors snapshot their content; GMs pull versioned copies.</div>
            <Link href="/modules" style={cardLink}>Browse Modules</Link>
          </div>

        </div>

        {/* Survivor creation paths — Creating a Survivor sits alone on
            its own row as the top-of-funnel guide; the three creation
            paths (Backstory, Quick, Random) share the row below. */}
        <div style={sectionHeading}>Building a Survivor</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '14px' }}>
          <div style={card}>
            <div style={cardTitle}>Creating a Survivor</div>
            <div style={cardBody}>The full guide — how Character Development Points (CDP), chapters, and trait acquisition work.</div>
            <Link href="/creating-a-character" style={cardLink}>Read Guide</Link>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '2.5rem' }}>
          <div style={card}>
            <div style={cardTitle}>Backstory Generation</div>
            <div style={cardBody}>Recommended for first time survivors, the Background Generation process allows you to spend Character Development Points during the different stages of your survivor&apos;s life to craft a character that directly matches your vision.</div>
            <Link href="/characters/new" style={cardLink}>Start</Link>
          </div>
          <div style={card}>
            <div style={cardTitle}>Quick Character</div>
            <div style={cardBody}>Recommended for experienced users, this option lets you spend 20 CDP on attributes and skills and directly customize your character.</div>
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
            Cheat sheets and rules excerpts will live here — common terms (CDP, WP, RP, Stress, Inspiration), house rules, and links into the Distemper Core Rulebook and the Xero Sum Engine SRD. Tell me what you want surfaced first and I&apos;ll wire it in.
          </div>
        </div>

        {/* External links — three equal-width tiles, each centred:
            logo on top, name+link below. Order: XeroSumGames →
            DistemperVerse → XeroSumStudio. */}
        <div style={{ ...sectionHeading, textAlign: 'center' }}>Off-Platform</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', justifyItems: 'center', alignItems: 'end', marginBottom: '4rem' }}>
          <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src="/XeroSumGamesLogoV13.png" alt="XeroSumGames" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
            <span style={cardLink}>XeroSumGames.com 🔗</span>
          </a>
          <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src="/distemper-dogsign-logo.png" alt="DistemperVerse" style={{ height: '80px', width: 'auto', objectFit: 'contain' }} />
            <span style={cardLink}>DistemperVerse.com 🔗</span>
          </a>
          <a href="https://www.xerosumstudio.com" target="_blank" rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src="/XeroSumStudioLogoV13.png" alt="XeroSumStudio" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
            <span style={cardLink}>XeroSumStudio.com 🔗</span>
          </a>
        </div>

      </div>
    </div>
  )
}
