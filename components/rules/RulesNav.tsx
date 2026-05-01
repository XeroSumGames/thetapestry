'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RULE_SECTIONS } from '../../lib/rules/sections'

// Left-rail nav for /rules/*. Active section's anchors expand inline;
// inactive sections collapse to title only. The currently-visible H2 on
// the page becomes the highlighted anchor (IntersectionObserver).

export default function RulesNav() {
  const pathname = usePathname()
  const activeSlug = pathname.replace(/^\/rules\/?/, '').split('/')[0] || ''
  const [activeAnchor, setActiveAnchor] = useState<string>('')

  // Initial-load anchor scroll. With main being a scroll container
  // (instead of the document), the browser's native "scroll to hash on
  // load" may not engage. Manually scrollIntoView the hash target after
  // hydration so deep links like /rules/communities#apprentices land in
  // the right spot. Also re-runs on hash changes inside the page.
  useEffect(() => {
    function scrollToHash() {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      const target = document.getElementById(hash)
      if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
    // Defer one frame so layout has settled before we measure.
    const timer = window.setTimeout(scrollToHash, 0)
    window.addEventListener('hashchange', scrollToHash)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [pathname])

  // Track which H2 is currently most visible. Scroll happens on the
  // <main> column (see app/rules/layout.tsx), so we pin the
  // IntersectionObserver root to that element. Without an explicit root,
  // the observer would watch viewport intersections — but the viewport
  // doesn't scroll, only main does, so the highlight wouldn't update.
  // Intersect at 35% from top so the highlight changes when a heading
  // hits the upper third of the visible area.
  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>('main [data-rule-anchor]'),
    )
    if (headings.length === 0) return
    const root = headings[0].closest('main')
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .map(e => ({
            id: (e.target as HTMLElement).dataset.ruleAnchor || '',
            top: e.target.getBoundingClientRect().top,
          }))
          .filter(v => v.id)
        if (visible.length === 0) return
        const lowest = visible.reduce((a, b) => (a.top > b.top ? a : b))
        setActiveAnchor(lowest.id)
      },
      { root, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    )
    headings.forEach(h => obs.observe(h))
    return () => obs.disconnect()
  }, [pathname])

  const linkBase: React.CSSProperties = {
    display: 'block',
    padding: '6px 14px',
    fontFamily: 'Carlito, sans-serif',
    fontSize: '13px',
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    color: '#d4cfc9',
    borderLeft: '2px solid transparent',
  }
  const linkActive: React.CSSProperties = {
    ...linkBase,
    color: '#f5f2ee',
    borderLeftColor: '#c0392b',
    background: '#1a1a1a',
  }
  const anchorLinkBase: React.CSSProperties = {
    display: 'block',
    padding: '4px 14px 4px 28px',
    fontFamily: 'Barlow, sans-serif',
    fontSize: '13px',
    color: '#cce0f5',
    textDecoration: 'none',
    borderLeft: '2px solid transparent',
  }
  const anchorLinkActive: React.CSSProperties = {
    ...anchorLinkBase,
    color: '#f5f2ee',
    borderLeftColor: '#7ab3d4',
    background: '#161616',
  }

  return (
    <nav
      aria-label="Rules navigation"
      style={{
        width: 260,
        flexShrink: 0,
        borderRight: '1px solid #2e2e2e',
        background: '#0f0f0f',
        height: '100%',
        overflowY: 'auto',
        paddingTop: 12,
        paddingBottom: 24,
      }}
    >
      <Link
        href="/rules"
        style={{
          display: 'block',
          padding: '14px',
          fontFamily: 'Carlito, sans-serif',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: '#c0392b',
          textDecoration: 'none',
          borderBottom: '1px solid #2e2e2e',
          marginBottom: 8,
        }}
      >
        XSE SRD v1.1
      </Link>
      {RULE_SECTIONS.map(section => {
        const isActive = section.slug === activeSlug
        return (
          <div key={section.slug} style={{ marginBottom: 2 }}>
            <Link
              href={`/rules/${section.slug}`}
              style={isActive ? linkActive : linkBase}
            >
              <span style={{ color: '#7a7a7a', marginRight: 8 }}>
                {section.number}
              </span>
              {section.title.replace(/^Appendix [A-D] — /, '')}
            </Link>
            {isActive && section.anchors.length > 0 && (
              <div style={{ paddingTop: 4, paddingBottom: 6 }}>
                {section.anchors.map(a => {
                  const isActiveAnchor = a.id === activeAnchor
                  return (
                    <a
                      key={a.id}
                      href={`#${a.id}`}
                      style={isActiveAnchor ? anchorLinkActive : anchorLinkBase}
                    >
                      {a.label}
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
