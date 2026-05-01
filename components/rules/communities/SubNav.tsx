'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Pill nav for /rules/communities2/* — lets the user hop between the 5
// sub-sections without going back to the hub. Style B feature only.

const PAGES: { slug: string; label: string }[] = [
  { slug: '', label: 'Overview' },
  { slug: 'recruitment', label: 'Recruitment' },
  { slug: 'apprentices', label: 'Apprentices' },
  { slug: 'morale', label: 'Morale' },
  { slug: 'structure', label: 'Structure' },
  { slug: 'crb-additions', label: 'CRB Additions' },
]

export default function CommunitiesSubNav() {
  const pathname = usePathname()
  const current =
    pathname
      .replace(/^\/rules\/communities2\/?/, '')
      .split('/')[0] || ''
  return (
    <nav
      aria-label="Communities sub-sections"
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: '2rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #2e2e2e',
      }}
    >
      {PAGES.map(p => {
        const isActive = p.slug === current
        return (
          <Link
            key={p.slug || 'overview'}
            href={`/rules/communities2${p.slug ? '/' + p.slug : ''}`}
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
            {p.label}
          </Link>
        )
      })}
    </nav>
  )
}
