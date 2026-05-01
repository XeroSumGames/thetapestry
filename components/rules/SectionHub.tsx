import Link from 'next/link'
import { RuleHero } from './RuleSection'
import type { RuleSection } from '../../lib/rules/sections'

// SectionHub — the per-section landing layout that won A/B testing.
// Renders the section hero + a card grid where each card is one anchor
// from the section's outline. Used by every /rules/<section>/page.tsx
// after the 2026-05-01 SRD redesign so the experience is consistent
// across sections (was: each section was either a long single page or
// a 5-line stub).
//
// For non-stub sections, cards link to /rules/<section>/<anchor>. For
// stub sections, cards render with a "forthcoming" eyebrow and don't
// navigate — clicking them is a no-op until the sub-page exists.

export default function SectionHub({ section }: { section: RuleSection }) {
  return (
    <>
      <RuleHero
        eyebrow={`§${section.number} · ${section.title}`}
        title={section.title.replace(/^Appendix [A-D] — /, '')}
        intro={section.summary}
      />
      {section.anchors.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#7a7a7a', fontSize: 14, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Section outline forthcoming
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {section.anchors.map(anchor => {
            const card = (
              <>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: 13, letterSpacing: '.14em', textTransform: 'uppercase', color: section.stub ? '#7a7a7a' : '#c0392b', marginBottom: 6 }}>
                  {section.stub ? '· forthcoming' : `${section.title.split(' ')[0]}`}
                </div>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: 8, lineHeight: 1.1 }}>
                  {anchor.label}
                </div>
              </>
            )
            const baseStyle: React.CSSProperties = {
              display: 'block',
              padding: '1rem 1.125rem',
              background: '#1a1a1a',
              border: '1px solid #2e2e2e',
              borderLeft: '3px solid ' + (section.stub ? '#3a3a3a' : '#c0392b'),
              borderRadius: 3,
              textDecoration: 'none',
              color: '#f5f2ee',
              opacity: section.stub ? 0.7 : 1,
            }
            if (section.stub) {
              return <div key={anchor.id} style={baseStyle}>{card}</div>
            }
            return (
              <Link key={anchor.id} href={`/rules/${section.slug}/${anchor.id}`} style={baseStyle}>
                {card}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
