'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { RuleSection } from '../../lib/rules/sections'

// Generic pill nav for /rules/<section>/<anchor> pages. Renders one pill
// per anchor in the section's outline + a leading "Overview" pill that
// links back to the section hub. The active pill is detected from
// pathname — reusing the generic SubNav across every section avoids the
// per-section copy-pastes.
//
// Replaces components/rules/communities/SubNav.tsx (Communities-only)
// after the 2026-05-01 SRD redesign.

export default function SectionSubNav({ section }: { section: RuleSection }) {
  const pathname = usePathname()
  // Strip the section prefix; what's left is either '' (hub) or the
  // active anchor slug. URL shape: /rules/<section>[/<anchor>]
  const prefix = `/rules/${section.slug}`
  const tail = pathname.replace(prefix, '').replace(/^\//, '').split('/')[0] || ''

  const items: { slug: string; label: string }[] = [
    { slug: '', label: 'Overview' },
    ...section.anchors.map(a => ({ slug: a.id, label: a.label })),
  ]

  return (
    <nav
      aria-label={`${section.title} sub-sections`}
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: '2rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #2e2e2e',
      }}
    >
      {items.map(item => {
        const isActive = item.slug === tail
        return (
          <Link
            key={item.slug || 'overview'}
            href={item.slug ? `${prefix}/${item.slug}` : prefix}
            style={{
              padding: '6px 12px',
              fontFamily: 'Carlito, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              color: isActive ? '#f5f2ee' : '#cce0f5',
              background: isActive ? '#c0392b' : '#1a1a1a',
              border: '1px solid ' + (isActive ? '#c0392b' : '#2e2e2e'),
              borderRadius: 3,
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
