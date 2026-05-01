'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FEATURED_SETTING_SLUGS, settingLabel, settingAccent } from '../../lib/campfire-settings'

// /campfire2 — Style B mockup of The Campfire as a portal/landing page,
// not a tab strip. Sketched 2026-05-01 alongside /campfire (Style A) for
// visual comparison; pattern mirrors /rules vs /rules/communities2.
//
// Two-tier card layout:
//   1. Setting Hubs row — large featured cards for the two hubs that
//      already exist (DZ + Kings Crossroads). These are the marquee
//      destinations; they get more visual weight than feed surfaces.
//   2. Explore grid — equal-sized cards for each Campfire surface
//      (Messages, LFG, Forums, Forums B, War Stories, Timestamps,
//      Homebrew). Each card carries the surface's existing accent
//      color and links straight to its dedicated route.
//
// Setting-context picker is preserved at the top as an optional filter
// for users who want to scope before they click into a feed surface
// (the surface routes already read ?setting=…). Picking nothing keeps
// the existing all-settings default.

interface HubCard {
  slug: string
  name: string
  tagline: string
}

const HUBS: HubCard[] = [
  {
    slug: 'district_zero',
    name: 'District Zero',
    tagline: 'The downstream district where the world ended quietly. Live canon, NPCs, and pins.',
  },
  {
    slug: 'kings_crossroads_mall',
    name: 'Kings Crossroads',
    tagline: 'Mall, motel, gas, gospel. The crossroads town nothing crosses anymore.',
  },
]

interface ExploreCard {
  href: string
  glyph: string
  label: string
  accent: string
  description: string
  badge?: 'preview' | 'soon'
}

const EXPLORE: ExploreCard[] = [
  { href: '/campfire?tab=messages',    glyph: '✉️',  label: 'Messages',          accent: '#8b5cf6', description: 'Direct conversations with players, GMs, and visitors.' },
  { href: '/campfire?tab=lfg',         glyph: '🎲',  label: 'Looking for Group', accent: '#c0392b', description: 'Find a campaign to join, or recruit players for one of yours.' },
  { href: '/campfire?tab=forums',      glyph: '💬',  label: 'Forums',            accent: '#7fc458', description: 'Discussions across the Tapestry — strategy, rules, world theory.' },
  { href: '/campfire?tab=forums2',     glyph: '📰',  label: 'Forums B',          accent: '#7ab3d4', description: 'A short-page take on Forums for A/B comparison.', badge: 'preview' },
  { href: '/campfire?tab=war-stories', glyph: '⚔️',  label: 'War Stories',       accent: '#b87333', description: 'Session writeups, memorable moments, and post-mortems.' },
  { href: '/campfire?tab=timestamps',  glyph: '⏰',  label: 'Timestamps',        accent: '#7ab3d4', description: 'Discord-style time tokens for cross-timezone play scheduling.' },
  { href: '/campfire?tab=homebrew',    glyph: '🛠️', label: 'Homebrew',          accent: '#1a4a6b', description: 'Custom rules, house variants, fan content.', badge: 'soon' },
]

export default function CampfireMockupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const settingParam = searchParams.get('setting') ?? ''
  function handleSettingChange(value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (!value) sp.delete('setting')
    else sp.set('setting', value)
    router.replace(`/campfire2?${sp.toString()}`, { scroll: false })
  }

  // Preserve any chosen setting context when linking into a feed surface
  // — the dedicated /campfire?tab= routes already read ?setting= via
  // useUrlSettingFilter, so the filter follows the user across.
  function withSetting(href: string): string {
    if (!settingParam) return href
    const [path, q] = href.split('?')
    const sp = new URLSearchParams(q || '')
    sp.set('setting', settingParam)
    return `${path}?${sp.toString()}`
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontFamily: 'Carlito, sans-serif', background: '#0f0f0f' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* Title block */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
            The Campfire
          </div>
          <div style={{ fontSize: '14px', color: '#cce0f5', lineHeight: 1.5, maxWidth: '680px' }}>
            Take a seat. Connect with players, GMs, and visitors outside of campaigns — or step into one of the live setting hubs below.
          </div>
        </div>

        {/* Setting context picker — optional filter that propagates into
            any feed surface the user clicks into. Carries forward via
            withSetting() on every link below. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Setting context:
          </span>
          <select value={settingParam} onChange={e => handleSettingChange(e.target.value)}
            style={{ padding: '5px 10px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', cursor: 'pointer' }}>
            <option value="">All settings</option>
            {FEATURED_SETTING_SLUGS.map(slug => (
              <option key={slug} value={slug}>{settingLabel(slug)}</option>
            ))}
            <option value="global">Global only</option>
          </select>
          {settingParam && (
            <button onClick={() => handleSettingChange('')}
              style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>

        {/* Setting Hubs section — the two marquee destinations. Two-up
            grid; collapses to single column on narrow viewports via
            grid-template-columns auto-fit. */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px', borderBottom: '1px solid #2e2e2e', paddingBottom: '8px' }}>
            Setting Hubs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
            {HUBS.map(hub => {
              const accent = settingAccent(hub.slug)
              return (
                <Link key={hub.slug} href={`/settings/${hub.slug}`}
                  style={{ display: 'block', textDecoration: 'none', background: '#161616', border: `1px solid ${accent}`, borderLeft: `8px solid ${accent}`, borderRadius: '4px', padding: '1.5rem', transition: 'background .12s, transform .12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1e1e1e' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#161616' }}>
                  <div style={{ fontSize: '13px', letterSpacing: '.14em', textTransform: 'uppercase', color: accent, marginBottom: '6px', fontWeight: 700 }}>
                    Hub
                  </div>
                  <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '26px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '10px', lineHeight: 1.1 }}>
                    {hub.name}
                  </div>
                  <div style={{ fontSize: '14px', color: '#cce0f5', lineHeight: 1.5, marginBottom: '14px' }}>
                    {hub.tagline}
                  </div>
                  <div style={{ fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase', color: accent, fontWeight: 700 }}>
                    Visit Hub →
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Explore section — equal-sized cards for each Campfire surface.
            Three-column grid that auto-collapses based on viewport width
            (each card needs at least 280px to read well). */}
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '12px', borderBottom: '1px solid #2e2e2e', paddingBottom: '8px' }}>
            Explore the Campfire
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {EXPLORE.map(card => {
              const isSoon = card.badge === 'soon'
              const content = (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px', lineHeight: 1, opacity: isSoon ? 0.4 : 1, filter: isSoon ? 'grayscale(1)' : 'none' }}>{card.glyph}</span>
                    <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '15px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: isSoon ? '#5a5a5a' : card.accent, flex: 1 }}>
                      {card.label}
                    </span>
                    {card.badge === 'preview' && (
                      <span style={{ fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', color: card.accent, opacity: 0.7 }}>preview</span>
                    )}
                    {card.badge === 'soon' && (
                      <span style={{ fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#cce0f5', opacity: 0.5 }}>soon</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: isSoon ? '#5a5a5a' : '#cce0f5', lineHeight: 1.5 }}>
                    {card.description}
                  </div>
                </>
              )
              const baseStyle = {
                display: 'block',
                textDecoration: 'none',
                background: '#161616',
                border: `1px solid ${isSoon ? '#2e2e2e' : '#2e2e2e'}`,
                borderLeft: `4px solid ${isSoon ? '#3a3a3a' : card.accent}`,
                borderRadius: '4px',
                padding: '1rem 1.25rem',
                transition: 'background .12s, border-color .12s',
                cursor: isSoon ? 'default' : 'pointer',
              } as const
              if (isSoon) {
                return <div key={card.label} style={baseStyle}>{content}</div>
              }
              return (
                <Link key={card.label} href={withSetting(card.href)}
                  style={baseStyle}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#1e1e1e'; (e.currentTarget as HTMLAnchorElement).style.borderColor = card.accent }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#161616'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2e2e2e' }}>
                  {content}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Footer note — tells the user this is the alt mockup. Mirrors
            the /rules/communities2 pattern so it's discoverable as an
            A/B without being a permanent fixture. */}
        <div style={{ marginTop: '2.5rem', fontSize: '13px', color: '#cce0f5', opacity: 0.55, textAlign: 'center', borderTop: '1px solid #2e2e2e', paddingTop: '1rem' }}>
          Style B mockup. The current Campfire lives at <Link href="/campfire" style={{ color: '#cce0f5' }}>/campfire</Link>.
        </div>

      </div>
    </div>
  )
}
