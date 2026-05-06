'use client'
import { useEffect, useMemo, useState } from 'react'
import { notFound, useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { SETTING_PINS, type SettingPin } from '../../../lib/setting-pins'
import {
  getSettingMeta,
  hasSettingHub,
  settingDisplayName,
  type SettingMeta,
} from '../../../lib/setting-meta'

// /settings/[setting] — Phase 4C setting hub. One dynamic page per
// featured setting (District Zero + Kings Crossroads). The page is the
// landing surface for cross-campaign discovery within a setting:
//
//   1. Header — name, tagline, blurb, "Run a campaign in [Setting]" CTA.
//   2. Canon timeline — all SETTING_PINS[slug] rendered as a list with
//      category-keyed icons + per-pin "View on map" deep-link
//      (?flyTo=lat,lng&zoom=…).
//   3. Communities — published world_communities sourced from any
//      campaign tagged with this setting (joined through campaigns).
//      Only `moderation_status='approved'` rows render.
//   4. Setting feed — recent N posts from each Campfire surface
//      (Forums / War Stories / LFG) filtered to this setting via the
//      Phase 4A `setting` discriminator. Each block links to the full
//      surface with the setting context dropdown pre-set.
//
// Phase 4D will add a "World Event" feed pulled from per-community
// auto-posts; Phase 4E layers on pagination / FTS / threading polish.

interface PinByCategory {
  [category: string]: SettingPin[]
}

interface WorldCommunity {
  id: string
  name: string
  description: string | null
  homestead_lat: number | null
  homestead_lng: number | null
  size_band: string
  community_status: string
  faction_label: string | null
  source_campaign_id: string
}

interface FeedRow {
  id: string
  title: string
  body: string
  created_at: string
  author_username: string
}

const CATEGORY_ICON: Record<string, string> = {
  military: '🛡',
  government: '🏛',
  resource: '📦',
  residence: '🏠',
  encounter: '⚔️',
  landmark: '📍',
  location: '📌',
  shop: '🛒',
  medical: '⚕️',
  food: '🍞',
  default: '📍',
}
function pinIcon(p: SettingPin): string {
  return CATEGORY_ICON[p.category ?? 'default'] ?? CATEGORY_ICON.default
}

const RECENT_FEED_LIMIT = 5

export default function SettingHubPage() {
  const params = useParams<{ setting: string }>()
  const slug = params?.setting
  const router = useRouter()
  const supabase = createClient()

  // Bail out before any state gets created if the slug isn't featured.
  // Next will render the standard not-found UI rather than an empty page.
  if (!slug || !hasSettingHub(slug)) {
    notFound()
  }

  const meta = getSettingMeta(slug) as SettingMeta
  const name = settingDisplayName(slug)
  const pins = SETTING_PINS[slug] ?? []

  const [authChecked, setAuthChecked] = useState(false)
  const [communities, setCommunities] = useState<WorldCommunity[]>([])
  const [communitiesLoading, setCommunitiesLoading] = useState(true)
  const [forumThreads, setForumThreads] = useState<FeedRow[]>([])
  const [warStories, setWarStories] = useState<FeedRow[]>([])
  const [lfgPosts, setLfgPosts] = useState<FeedRow[]>([])
  const [feedLoading, setFeedLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      setAuthChecked(true)
      await Promise.all([loadCommunities(), loadFeeds()])
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  async function loadCommunities() {
    setCommunitiesLoading(true)
    // Two-step join: world_communities has no `setting` column directly,
    // so we first pull every campaign tagged with this setting, then
    // filter world_communities by source_campaign_id IN (...). Single
    // round-trip per side; cheaper than asking PostgREST to do an
    // embed-join filter (which requires !inner syntax + extra setup).
    const { data: campaignRows } = await supabase
      .from('campaigns')
      .select('id')
      .eq('setting', slug)
    const campaignIds = (campaignRows ?? []).map((c: any) => c.id)
    if (campaignIds.length === 0) {
      setCommunities([])
      setCommunitiesLoading(false)
      return
    }
    const { data } = await supabase
      .from('world_communities')
      .select('id, name, description, homestead_lat, homestead_lng, size_band, community_status, faction_label, source_campaign_id')
      .in('source_campaign_id', campaignIds)
      .eq('moderation_status', 'approved')
      .order('last_public_update_at', { ascending: false })
    setCommunities((data ?? []) as WorldCommunity[])
    setCommunitiesLoading(false)
  }

  async function loadFeeds() {
    setFeedLoading(true)
    // Three parallel fetches — only approved + tagged-to-this-setting
    // rows. Each fetch limits to RECENT_FEED_LIMIT so the page paints
    // fast even when a feed is dense; the "See all" links route to the
    // full surface with the setting filter pre-applied.
    const [forumsRes, warStoriesRes, lfgRes] = await Promise.all([
      supabase.from('forum_threads')
        .select('id, title, body, created_at, author_user_id')
        .eq('setting', slug)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(RECENT_FEED_LIMIT),
      supabase.from('war_stories')
        .select('id, title, body, created_at, author_user_id')
        .eq('setting', slug)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(RECENT_FEED_LIMIT),
      supabase.from('lfg_posts')
        .select('id, title, body, created_at, author_user_id')
        .eq('setting', slug)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(RECENT_FEED_LIMIT),
    ])
    // Single-batch profile lookup across all three feeds for username
    // hydration — saves three round-trips.
    const allRows = [
      ...(forumsRes.data ?? []),
      ...(warStoriesRes.data ?? []),
      ...(lfgRes.data ?? []),
    ]
    const authorIds = Array.from(new Set(allRows.map((r: any) => r.author_user_id).filter(Boolean)))
    let nameMap: Record<string, string> = {}
    if (authorIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', authorIds)
      nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]))
    }
    const decorate = (rows: any[]): FeedRow[] =>
      rows.map(r => ({
        id: r.id,
        title: r.title,
        body: r.body,
        created_at: r.created_at,
        author_username: nameMap[r.author_user_id] ?? 'Unknown',
      }))
    setForumThreads(decorate(forumsRes.data ?? []))
    setWarStories(decorate(warStoriesRes.data ?? []))
    setLfgPosts(decorate(lfgRes.data ?? []))
    setFeedLoading(false)
  }

  // Group canon pins by category so the timeline section can render
  // them as labeled clusters rather than one undifferentiated list.
  const pinsByCategory = useMemo<PinByCategory>(() => {
    const map: PinByCategory = {}
    for (const p of pins) {
      const cat = p.category ?? 'location'
      if (!map[cat]) map[cat] = []
      map[cat].push(p)
    }
    return map
  }, [pins])

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (!authChecked) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Carlito, sans-serif', color: '#cce0f5', fontSize: '13px' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Carlito, sans-serif' }}>

      {/* Header — name, tagline, blurb, primary CTA. The accent color
          drives the underline + run-campaign button so each hub is
          visually distinct. */}
      <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: `2px solid ${meta.accent}` }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: meta.accent, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
          The Distemperverse · Setting Hub
        </div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '36px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '8px', lineHeight: 1.1 }}>
          {name}
        </div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '15px', color: meta.accent, fontStyle: 'italic', marginBottom: '12px' }}>
          {meta.tagline}
        </div>
        <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '16px', maxWidth: '720px' }}>
          {meta.blurb}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href={`/stories/new?setting=${slug}`}
            style={{ padding: '10px 18px', background: `${meta.accent}22`, border: `1px solid ${meta.accent}`, borderRadius: '3px', color: meta.accent, fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, textDecoration: 'none' }}>
            Run a Campaign in {name}
          </Link>
          <Link href={`/map?flyTo=${meta.mapCenter.lat},${meta.mapCenter.lng}&zoom=${meta.mapZoom}`}
            style={{ padding: '10px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            🗺 Open on Map
          </Link>
        </div>
      </div>

      {/* Canon Timeline — pins from SETTING_PINS, grouped by category.
          The section title says "Timeline" because the original spec
          framed these as the canonical setting markers; for hubs
          without temporal ordering they read more like a gazetteer. */}
      <Section title="Canon Locations" accent={meta.accent} count={pins.length}>
        {pins.length === 0 ? (
          <Empty>No canon locations registered for this setting yet.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.entries(pinsByCategory).map(([cat, list]) => (
              <div key={cat}>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: '#cce0f5', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {cat} ({list.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {list.map(p => (
                    <Link key={p.title}
                      href={`/map?flyTo=${p.lat},${p.lng}&zoom=${meta.mapZoom + 2}`}
                      style={{ display: 'block', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', textDecoration: 'none', transition: 'border-color .12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = meta.accent}
                      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2e2e2e'}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{pinIcon(p)}</span>
                        <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                          {p.title}
                        </span>
                      </div>
                      {p.notes && (
                        <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, marginTop: '4px', paddingLeft: '22px' }}>
                          {p.notes}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Communities — published world_communities filtered to this
          setting's campaigns. Approved-only via the world_communities
          RLS + filter. */}
      <Section title="Communities" accent={meta.accent} count={communities.length}>
        {communitiesLoading ? (
          <Empty>Loading…</Empty>
        ) : communities.length === 0 ? (
          <Empty>No published communities here yet. Be the first — run a campaign and publish your community to the Distemperverse.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {communities.map(c => {
              const hasCoords = c.homestead_lat != null && c.homestead_lng != null
              return (
                <div key={c.id} style={{ padding: '12px 14px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: `3px solid ${meta.accent}`, borderRadius: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '17px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      🏘 {c.name}
                    </span>
                    <span style={{ padding: '1px 8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '2px', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {c.size_band}
                    </span>
                    <span style={{ padding: '1px 8px', background: '#1a2010', border: '1px solid #2d5a1b', borderRadius: '2px', fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {c.community_status}
                    </span>
                    {c.faction_label && (
                      <span style={{ padding: '1px 8px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '2px', fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        {c.faction_label}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, marginBottom: hasCoords ? '8px' : 0 }}>
                      {c.description}
                    </div>
                  )}
                  {hasCoords && (
                    <Link href={`/map?flyTo=${c.homestead_lat},${c.homestead_lng}&zoom=${meta.mapZoom + 2}`}
                      style={{ fontSize: '13px', color: meta.accent, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
                      🗺 View on map →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Setting Feed — three feed-snapshot blocks for Forums / War
          Stories / LFG. Each block shows the most recent N posts
          tagged with this setting; "See all" links pre-apply the
          setting context filter on the destination. */}
      <Section title="Setting Feed" accent={meta.accent}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          <FeedBlock
            title="💬 Forums"
            accent="#7fc458"
            rows={forumThreads}
            loading={feedLoading}
            seeAllHref={`/campfire?tab=forums&setting=${slug}`}
            formatDate={formatDate}
          />
          <FeedBlock
            title="🎭 War Stories"
            accent="#b87333"
            rows={warStories}
            loading={feedLoading}
            seeAllHref={`/campfire?tab=war-stories&setting=${slug}`}
            formatDate={formatDate}
          />
          <FeedBlock
            title="🎲 Looking for Group"
            accent="#7ab3d4"
            rows={lfgPosts}
            loading={feedLoading}
            seeAllHref={`/campfire?tab=lfg&setting=${slug}`}
            formatDate={formatDate}
          />
        </div>
      </Section>

    </div>
  )
}

function Section({ title, accent, count, children }: { title: string; accent: string; count?: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
        <h2 style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.1em', textTransform: 'uppercase', margin: 0 }}>
          {title}
        </h2>
        {typeof count === 'number' && (
          <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', color: accent, fontWeight: 700, padding: '1px 8px', background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: '999px' }}>
            {count}
          </span>
        )}
        <div style={{ flex: 1, height: '1px', background: '#2e2e2e' }} />
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5', fontStyle: 'italic' }}>
      {children}
    </div>
  )
}

function FeedBlock({ title, accent, rows, loading, seeAllHref, formatDate }: {
  title: string; accent: string; rows: FeedRow[]; loading: boolean;
  seeAllHref: string; formatDate: (iso: string) => string;
}) {
  return (
    <div style={{ background: '#141414', border: '1px solid #2e2e2e', borderTop: `2px solid ${accent}`, borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', fontWeight: 700, color: accent, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <Link href={seeAllHref} style={{ fontSize: '13px', color: accent, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          See all →
        </Link>
      </div>
      {loading ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', fontStyle: 'italic' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#9aa5b0', fontStyle: 'italic' }}>Nothing posted yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map(r => (
            <div key={r.id} style={{ padding: '6px 8px', background: '#1a1a1a', borderRadius: '3px' }}>
              <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.author_username} · {formatDate(r.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
