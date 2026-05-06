import Link from 'next/link'

// /welcome/guide — table of contents for the Beginners' Guide.
// Lists all 12 chapters with their titles + a brief description.
// Each chapter is its own page (/welcome/guide/[chapter]) that
// reads the matching docs/beginners-guide-NN.txt at request time.
//
// Source-of-truth for chapter titles is the .txt files themselves
// (line 2 of each file). The list below mirrors them — keep in
// sync if a chapter is renamed or reordered.

const CHAPTERS: { num: string; title: string; blurb: string }[] = [
  { num: '01', title: 'Navigating the Site',          blurb: 'Where everything is. Sidebar, header, the main surfaces.' },
  { num: '02', title: 'Pins, Notifications, and Roles', blurb: 'How the GM/Player split works and what the bell + pins mean.' },
  { num: '03', title: 'The World Map',                  blurb: 'Pinning places, drawing tags, the Distemper world view.' },
  { num: '04', title: 'Creating a Character',           blurb: 'The wizard, Quick Character, Random Character, Paradigms.' },
  { num: '05', title: 'Creating a Story',               blurb: 'New campaign flow — Custom, Setting, Module, Community.' },
  { num: '06', title: 'The Table and Sessions',         blurb: 'How a session runs. Joining, the table view, leaving.' },
  { num: '07', title: 'The Tactical Map',               blurb: 'Scenes, tokens, walls/doors, fog, day/night.' },
  { num: '08', title: 'Combat',                          blurb: 'Initiative, actions, attacks, damage, special moves.' },
  { num: '09', title: 'Creating a Community',           blurb: 'Founding, recruiting, roles, weekly Morale.' },
  { num: '10', title: 'NPCs and Recruitment',           blurb: 'Hidden NPCs, First Impressions, Recruit checks.' },
  { num: '11', title: 'The Campfire',                   blurb: 'Forums, War Stories, LFG, between-session activity.' },
  { num: '12', title: 'Rumors',                         blurb: 'Modules, Adventures — running someone else\'s content.' },
]

export const metadata = { title: 'Beginners\' Guide — The Tapestry' }

export default function BeginnersGuideTOC() {
  // Inline styles to match /welcome's existing visual language —
  // tomato-red headings, dark-grey card surfaces, Carlito for chrome.
  // Avoiding a dedicated CSS module since /welcome uses inline too.
  const sectionHeading: React.CSSProperties = {
    fontSize: '13px', color: '#c0392b', fontWeight: 600,
    letterSpacing: '.12em', textTransform: 'uppercase',
    fontFamily: 'Carlito, sans-serif', marginTop: '1.5rem', marginBottom: '0.5rem',
  }
  const card: React.CSSProperties = {
    background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px',
    padding: '14px 16px', marginBottom: '8px',
  }
  const cardTitle: React.CSSProperties = {
    fontSize: '15px', color: '#f5f2ee', fontWeight: 700,
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em',
    textTransform: 'uppercase', marginBottom: '4px',
  }
  const cardBody: React.CSSProperties = {
    fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif',
    lineHeight: 1.4,
  }

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '2rem 1rem', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        <Link href="/welcome" style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em', textDecoration: 'none' }}>← Welcome</Link>

        <h1 style={{ fontFamily: 'Carlito, sans-serif', fontSize: '36px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#c0392b', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
          Beginners' Guide
        </h1>
        <p style={{ fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginBottom: '1.5rem' }}>
          A walkthrough for new survivors and storytellers. Twelve chapters, each ~5–10 minutes. Read straight through, or jump to whatever you're stuck on.
        </p>

        <div style={sectionHeading}>Chapters</div>
        {CHAPTERS.map(c => (
          <Link key={c.num} href={`/welcome/guide/${c.num}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ ...card, cursor: 'pointer', transition: 'border-color 120ms' }}>
              <div style={cardTitle}>
                <span style={{ color: '#EF9F27', marginRight: '10px' }}>{c.num}</span>
                {c.title}
              </div>
              <div style={cardBody}>{c.blurb}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
