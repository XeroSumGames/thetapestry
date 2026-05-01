import Link from 'next/link'
import { RuleHero } from '../../../components/rules/RuleSection'
import StyleBanner from '../../../components/rules/StyleBanner'

// /rules/communities2 — Style B (many short pages) hub. Comparison test
// only; once the user picks A or B the loser gets deleted.

const SUB_PAGES = [
  {
    slug: 'recruitment',
    title: 'Recruitment Check',
    summary:
      'How PCs recruit NPCs — Cohort, Conscript, Convert. Outcome tables for each approach.',
  },
  {
    slug: 'apprentices',
    title: 'Apprentices',
    summary:
      'Unlocked only on Moment of High Insight. 3 + 5 CDP, 1 Paradigm, train to PC-level − 1.',
  },
  {
    slug: 'morale',
    title: 'Morale Check',
    summary:
      'Weekly cohesion check for Communities — six modifier slots, six outcomes, 3-strike dissolution.',
  },
  {
    slug: 'structure',
    title: 'Community Structure',
    summary:
      'Role minimums (Gatherers 33%, Maintainers 20%, Safety 5–10%) plus the Fed and Clothed Checks.',
  },
  {
    slug: 'crb-additions',
    title: 'CRB Additions',
    summary:
      'Inspiration +1 SMod per level. Inspiration Lv4 +4 to Morale. Psychology* Lv4 +3 to Morale.',
  },
]

export const metadata = {
  title: 'Communities (Style B) — XSE SRD',
}

export default function CommunitiesHubPage() {
  return (
    <>
      <StyleBanner
        current="B"
        otherHref="/rules/communities"
        otherLabel="Style A"
        description="Many short pages. Each subsection has its own URL — better for direct linking, more clicks for whole-section reference."
      />
      <RuleHero
        eyebrow="§08 · Communities (Style B)"
        title="Communities"
        intro="When a Group of player characters and recruited NPCs reaches 13 or more members, it becomes a Community. Pick a sub-section below."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {SUB_PAGES.map(p => (
          <Link
            key={p.slug}
            href={`/rules/communities2/${p.slug}`}
            style={{
              display: 'block',
              padding: '1rem 1.125rem',
              background: '#1a1a1a',
              border: '1px solid #2e2e2e',
              borderLeft: '3px solid #c0392b',
              borderRadius: 3,
              textDecoration: 'none',
              color: '#f5f2ee',
            }}
          >
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
              {p.title}
            </div>
            <div style={{ fontSize: 14, color: '#d4cfc9', lineHeight: 1.6 }}>
              {p.summary}
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
