'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import MessagesPage from '../messages/page'
import LfgPage from './lfg/page'
import ForumsPage from './forums/page'
import Forums2Page from './forums2/page'
import WarStoriesPage from './war-stories/page'
import TimestampPage from './timestamp/page'
import { FEATURED_SETTING_SLUGS, settingLabel, settingAccent } from '../../lib/campfire-settings'

// /campfire — two-mode hub.
//
//   No ?tab=… in the URL  → portal/landing layout (CampfirePortal): a card
//                           grid with Setting Hubs (DZ + Kings Crossroads)
//                           and an Explore grid (Messages, LFG, Forums,
//                           Forums B, War Stories, Timestamps, Homebrew).
//   ?tab=<id> in the URL  → tab-strip experience (CampfireTabStrip): the
//                           original embedded-route shell where each tab
//                           imports the dedicated route component so deep
//                           links (?dm=<id>, ?setting=<slug>) keep working.
//
// Why both? The portal cards link into ?tab=<id>, so first-time visitors
// land on a clean menu and seasoned users keep their tab muscle memory.
// Promoted from /campfire2 → /campfire on 2026-05-01 after the A/B win.

type TabId = 'messages' | 'lfg' | 'forums' | 'forums2' | 'war-stories' | 'timestamps' | 'homebrew'

interface TabDef {
  id: TabId
  label: string
  accent: string
  soon?: boolean
  preview?: boolean
}

const TABS: TabDef[] = [
  { id: 'messages',     label: 'Messages',           accent: '#8b5cf6' },
  { id: 'lfg',          label: 'Looking for Group',  accent: '#c0392b' },
  { id: 'forums',       label: 'Forums',             accent: '#7fc458' },
  { id: 'forums2',      label: 'Forums B',           accent: '#7ab3d4', preview: true },
  { id: 'war-stories',  label: 'War Stories',        accent: '#b87333' },
  { id: 'timestamps',   label: 'Timestamps',         accent: '#7ab3d4' },
  { id: 'homebrew',     label: 'Homebrew',           accent: '#1a4a6b', soon: true },
]

// Top-level switcher. Reading ?tab once on render is enough — useState is
// then wired to it inside the tab-strip so the URL stays in sync as the
// user clicks tabs. Clicking a portal card sets ?tab=<id> via Link, which
// flips the page over to the tab-strip mode automatically.
export default function CampfirePage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabId | null
  if (tabParam) return <CampfireTabStrip />
  return <CampfirePortal />
}

// ---- Portal mode ----------------------------------------------------------

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

function CampfirePortal() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const settingParam = searchParams.get('setting') ?? ''
  function handleSettingChange(value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (!value) sp.delete('setting')
    else sp.set('setting', value)
    router.replace(`/campfire?${sp.toString()}`, { scroll: false })
  }

  // Carry whatever setting filter the user picked at the portal into the
  // tab-strip drill-down. The feed surfaces (LFG/Forums/War Stories) read
  // ?setting= via useUrlSettingFilter so this preserves their choice.
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

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px', lineHeight: 1.1 }}>
            The Campfire
          </div>
          <div style={{ fontSize: '14px', color: '#cce0f5', lineHeight: 1.5, maxWidth: '680px' }}>
            Take a seat. Connect with players, GMs, and visitors outside of campaigns.
          </div>
        </div>

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
                  <div style={{ fontSize: '15px', color: '#cce0f5', lineHeight: 1.5, marginBottom: '14px' }}>
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
                    <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: isSoon ? '#5a5a5a' : card.accent, flex: 1 }}>
                      {card.label}
                    </span>
                    {card.badge === 'preview' && (
                      <span style={{ fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', color: card.accent, opacity: 0.7 }}>preview</span>
                    )}
                    {card.badge === 'soon' && (
                      <span style={{ fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#cce0f5', opacity: 0.5 }}>soon</span>
                    )}
                  </div>
                  <div style={{ fontSize: '15px', color: isSoon ? '#5a5a5a' : '#cce0f5', lineHeight: 1.5 }}>
                    {card.description}
                  </div>
                </>
              )
              const baseStyle = {
                display: 'block',
                textDecoration: 'none',
                background: '#161616',
                border: '1px solid #2e2e2e',
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

      </div>
    </div>
  )
}

// ---- Tab-strip mode (drill-down from a portal card) -----------------------

function CampfireTabStrip() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Resolve the active tab from ?tab=. Falls back to the first non-soon
  // tab if the value is unknown or points at a "soon" placeholder. Note:
  // we only enter this component when ?tab= is set, so tabParam is non-null.
  const tabParam = searchParams.get('tab') as TabId | null
  const initial = TABS.find(t => t.id === tabParam && !t.soon)?.id ?? TABS.find(t => !t.soon)!.id
  const [activeTab, setActiveTab] = useState<TabId>(initial)

  // Keep ?tab in sync as the user clicks. Replace (not push) preserves
  // back-button behavior — back from a tab returns to the portal.
  useEffect(() => {
    const current = searchParams.get('tab')
    if (current === activeTab) return
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('tab', activeTab)
    router.replace(`/campfire?${sp.toString()}`, { scroll: false })
  }, [activeTab])

  const settingParam = searchParams.get('setting') ?? ''
  function handleSettingChange(value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (!value) sp.delete('setting')
    else sp.set('setting', value)
    router.replace(`/campfire?${sp.toString()}`, { scroll: false })
  }
  const settingDropdownApplies = activeTab === 'lfg' || activeTab === 'forums' || activeTab === 'forums2' || activeTab === 'war-stories'

  const active = TABS.find(t => t.id === activeTab) ?? TABS[0]
  const isFlexFillTab = activeTab === 'messages'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, fontFamily: 'Barlow, sans-serif', background: '#0f0f0f' }}>

      <div style={{ padding: '1.25rem 1.5rem 0', borderBottom: '1px solid #2e2e2e' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <Link href="/campfire" style={{ textDecoration: 'none', fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '24px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1 }}
            title="Back to The Campfire portal">
            The Campfire
          </Link>
          <div style={{ fontSize: '13px', color: '#5a8a40', lineHeight: 1.5 }}>
            Take a seat. Here you can connect with players, GMs, and visitors outside of campaigns.
          </div>
        </div>

        {settingDropdownApplies && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.08em', textTransform: 'uppercase' }}>
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
        )}

        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const selected = t.id === activeTab
            return (
              <button
                key={t.id}
                onClick={() => !t.soon && setActiveTab(t.id)}
                disabled={t.soon}
                style={{
                  padding: '8px 16px',
                  background: selected ? '#242424' : 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${selected ? t.accent : 'transparent'}`,
                  color: selected ? t.accent : (t.soon ? '#3a3a3a' : '#d4cfc9'),
                  fontFamily: 'Carlito, sans-serif',
                  fontSize: '14px',
                  fontWeight: selected ? 700 : 500,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  cursor: t.soon ? 'default' : 'pointer',
                  transition: 'color .12s, border-color .12s',
                }}
                onMouseEnter={e => { if (!t.soon && !selected) (e.currentTarget as HTMLButtonElement).style.color = '#f5f2ee' }}
                onMouseLeave={e => { if (!t.soon && !selected) (e.currentTarget as HTMLButtonElement).style.color = '#d4cfc9' }}
              >
                {t.label}
                {t.soon && <span style={{ marginLeft: '6px', fontSize: '13px', color: '#cce0f5', opacity: .4 }}>— soon</span>}
                {t.preview && <span style={{ marginLeft: '6px', fontSize: '13px', color: t.accent, opacity: .7 }}>· preview</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div style={isFlexFillTab
        ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
        : { flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {activeTab === 'messages' && <MessagesPage />}
        {activeTab === 'lfg' && <LfgPage />}
        {activeTab === 'forums' && <ForumsPage />}
        {activeTab === 'forums2' && <Forums2Page />}
        {activeTab === 'war-stories' && <WarStoriesPage />}
        {activeTab === 'timestamps' && <TimestampPage />}
        {activeTab === 'homebrew' && (
          <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem 1.5rem', textAlign: 'center', background: '#1a1a1a', border: `1px solid ${active.accent}`, borderRadius: '4px', opacity: 0.7 }}>
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: active.accent, marginBottom: '8px' }}>
              {active.label}
            </div>
            <div style={{ fontSize: '14px', color: '#5a8a40', lineHeight: 1.6 }}>
              Coming soon. Custom rules, house variants, fan content — all in one place.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
