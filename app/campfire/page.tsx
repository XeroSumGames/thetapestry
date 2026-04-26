'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MessagesPage from '../messages/page'
import LfgPage from './lfg/page'
import ForumsPage from './forums/page'
import WarStoriesPage from './war-stories/page'
import TimestampPage from './timestamp/page'

// /campfire — one-stop-shop. Each Campfire feature is rendered as a tab
// here; we import the existing route components directly so deep-links
// like /messages, /campfire/lfg, /campfire/forums keep working (those
// routes still exist) AND the embedded version lives here. Single source
// of truth — the same component renders in both places.
//
// The active tab is reflected in ?tab=… so users can refresh, share, or
// be deep-linked into a specific tab. Search params on the campfire URL
// are also forwarded into the embedded component (e.g. ?dm=<id> still
// works for the Messages tab).

type TabId = 'messages' | 'lfg' | 'forums' | 'war-stories' | 'timestamps' | 'homebrew'

interface TabDef {
  id: TabId
  label: string
  accent: string
  soon?: boolean
}

const TABS: TabDef[] = [
  { id: 'messages',     label: 'Messages',           accent: '#8b5cf6' },
  { id: 'lfg',          label: 'Looking for Group',  accent: '#c0392b' },
  { id: 'forums',       label: 'Forums',             accent: '#7fc458' },
  { id: 'war-stories',  label: 'War Stories',        accent: '#b87333' },
  { id: 'timestamps',   label: 'Timestamps',         accent: '#7ab3d4' },
  { id: 'homebrew',     label: 'Homebrew',           accent: '#1a4a6b', soon: true },
]

const DEFAULT_TAB: TabId = 'lfg'

export default function CampfirePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Resolve the active tab from ?tab=. Falls back to the default if the
  // value is missing, unknown, or points at a "soon" placeholder.
  const tabParam = searchParams.get('tab') as TabId | null
  const initial = TABS.find(t => t.id === tabParam && !t.soon)?.id ?? DEFAULT_TAB
  const [activeTab, setActiveTab] = useState<TabId>(initial)

  // Keep the URL in sync without pushing new history entries on every
  // click. Replace preserves all other query params (e.g. ?dm=<id>).
  useEffect(() => {
    const current = searchParams.get('tab')
    if (current === activeTab) return
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('tab', activeTab)
    router.replace(`/campfire?${sp.toString()}`, { scroll: false })
  }, [activeTab])

  const active = TABS.find(t => t.id === activeTab) ?? TABS[0]
  // Messages embeds a flex-fill layout (sidebar + thread); LFG and Forums
  // are scrollable max-width feeds. Switch the wrapper between the two
  // shapes accordingly.
  const isFlexFillTab = activeTab === 'messages'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, fontFamily: 'Barlow, sans-serif', background: '#0f0f0f' }}>

      {/* Title + tab bar — sticky-feeling header. Doesn't actually stick;
          just sits at the top of the column flex parent so the content
          area below scrolls (or fills, for Messages) on its own. */}
      <div style={{ padding: '1.25rem 1.5rem 0', borderBottom: '1px solid #2e2e2e' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '24px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            The Campfire
          </div>
          <div style={{ fontSize: '13px', color: '#5a8a40', lineHeight: 1.5 }}>
            Take a seat. Here you can connect with players, GMs, and visitors outside of campaigns.
          </div>
        </div>

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
                  fontFamily: 'Barlow Condensed, sans-serif',
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
                {t.label}{t.soon && <span style={{ marginLeft: '6px', fontSize: '13px', color: '#3a3a3a' }}>— soon</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div style={isFlexFillTab
        ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
        : { flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {activeTab === 'messages' && <MessagesPage />}
        {activeTab === 'lfg' && <LfgPage />}
        {activeTab === 'forums' && <ForumsPage />}
        {activeTab === 'war-stories' && <WarStoriesPage />}
        {activeTab === 'timestamps' && <TimestampPage />}
        {activeTab === 'homebrew' && (
          <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem 1.5rem', textAlign: 'center', background: '#1a1a1a', border: `1px solid ${active.accent}`, borderRadius: '4px', opacity: 0.7 }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: active.accent, marginBottom: '8px' }}>
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
