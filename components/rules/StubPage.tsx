import Link from 'next/link'
import { findSection } from '../../lib/rules/sections'
import { RuleHero } from './RuleSection'

// Placeholder used by every /rules/* page that hasn't been written yet.
// Renders the section's anchor list as a "Coming up" outline, plus a link
// back to the rules index.

export default function StubPage({ slug }: { slug: string }) {
  const section = findSection(slug)
  if (!section) {
    return (
      <>
        <RuleHero
          eyebrow="Rules"
          title="Section not found"
          intro="The section you tried to load doesn't exist in the SRD."
        />
        <Link href="/rules" style={{ color: '#7ab3d4' }}>
          ← Back to all rules
        </Link>
      </>
    )
  }
  return (
    <>
      <RuleHero
        eyebrow={`§${section.number} · ${section.title}`}
        title={section.title.replace(/^Appendix [A-D] — /, '')}
        intro={section.summary}
      />
      <div
        style={{
          padding: '1.25rem 1.5rem',
          background: '#1a1a1a',
          border: '1px solid #2e2e2e',
          borderLeft: '3px solid #c0392b',
          borderRadius: 3,
          marginBottom: '2rem',
          color: '#f5a89a',
          fontFamily: 'Carlito, sans-serif',
          fontSize: 13,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        Content forthcoming — this section's copy is being prepared from the
        SRD v1.1.17.
      </div>
      {section.anchors.length > 0 && (
        <>
          <h2
            style={{
              fontFamily: 'Carlito, sans-serif',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: '#cce0f5',
              marginTop: '2rem',
              marginBottom: '1rem',
            }}
          >
            What this section will cover
          </h2>
          <ul
            style={{
              fontSize: 17,
              color: '#d4cfc9',
              lineHeight: 1.8,
              paddingLeft: '1.25rem',
              margin: 0,
            }}
          >
            {section.anchors.map(a => (
              <li key={a.id}>{a.label}</li>
            ))}
          </ul>
        </>
      )}
      <p style={{ marginTop: '3rem' }}>
        <Link
          href="/rules"
          style={{
            color: '#7ab3d4',
            fontFamily: 'Carlito, sans-serif',
            fontSize: 13,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          ← All sections
        </Link>
      </p>
    </>
  )
}
