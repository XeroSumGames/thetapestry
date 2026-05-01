import Link from 'next/link'
import { RULE_SECTIONS } from '../../lib/rules/sections'
import { RuleHero } from '../../components/rules/RuleSection'

// /rules — landing page. Hero + grid of section cards.

export default function RulesIndexPage() {
  return (
    <>
      <RuleHero
        eyebrow="Xero Sum Engine"
        title="SRD v1.1"
        intro="The complete system reference for the Xero Sum Engine, the rules-light d6 framework that powers Distemper. Every section below is canonical — when a rule here disagrees with anything in-app, the rules win."
      />

      <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {RULE_SECTIONS.map(section => (
          <Link
            key={section.slug}
            href={`/rules/${section.slug}`}
            style={{
              display: 'block',
              padding: '1rem 1.125rem',
              background: '#1a1a1a',
              border: '1px solid #2e2e2e',
              borderLeft: '3px solid #c0392b',
              borderRadius: 3,
              textDecoration: 'none',
              color: '#f5f2ee',
              transition: 'background 0.1s ease',
            }}
          >
            <div
              style={{
                fontFamily: 'Carlito, sans-serif',
                fontSize: 13,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: section.stub ? '#7a7a7a' : '#c0392b',
                marginBottom: 6,
              }}
            >
              §{section.number}
              {section.stub ? ' · forthcoming' : ''}
            </div>
            <div
              style={{
                fontFamily: 'Carlito, sans-serif',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                color: '#f5f2ee',
                marginBottom: 8,
                lineHeight: 1.1,
              }}
            >
              {section.title}
            </div>
            <div style={{ fontSize: 14, color: '#d4cfc9', lineHeight: 1.6 }}>
              {section.summary}
            </div>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: '3rem', fontSize: 13, color: '#7a7a7a', lineHeight: 1.7 }}>
        Source: <code>XSE SRD v1.1.17</code>. Pre-digested implementation extracts live in <code>tasks/rules-extract-*.md</code> in the codebase.
      </p>
    </>
  )
}
