'use client'
// /moderate/users/[userId]/activity
// Cross-surface activity dossier for a single user. Used by the
// TRACK button on the /moderate user list. All data sources are
// queried in parallel; each section shows a count + the most
// recent ~10 items as a preview. No edit affordances — pure
// observation surface for moderators investigating a user.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../../../lib/supabase-browser'
import { getCachedAuth } from '../../../../../lib/auth-cache'
import { useRouter, useParams } from 'next/navigation'

interface UserHeader {
  id: string
  username: string
  email: string
  role: string
  created_at: string
  suspended_until: string | null
  suspended_reason: string | null
  last_sign_in_at: string | null
}

interface CharacterRow {
  id: string
  name: string
  created_at: string
}

interface CampaignRow {
  id: string
  name: string
  created_at: string
}

interface RollRow {
  id: string
  created_at: string
  label: string | null
  character_name: string | null
  outcome: string | null
  total: number | null
  campaign_id: string | null
}

interface ForumThreadRow {
  id: string
  title: string
  created_at: string
  setting: string | null
}

interface ForumReplyRow {
  id: string
  body: string
  created_at: string
  thread_id: string
}

interface WarStoryRow {
  id: string
  title: string
  created_at: string
}

interface LfgRow {
  id: string
  title: string
  created_at: string
  setting: string | null
}

interface BugRow {
  id: string
  description: string
  created_at: string
  status: string
  page_url: string | null
}

interface PinRow {
  id: string
  title: string | null
  created_at: string
  pin_type: string | null
  status: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function shortDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function UserActivityPage() {
  const params = useParams()
  const userId = params.userId as string
  const router = useRouter()
  const supabase = createClient()

  const [header, setHeader] = useState<UserHeader | null>(null)
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [characterCount, setCharacterCount] = useState(0)
  const [campaignsOwned, setCampaignsOwned] = useState<CampaignRow[]>([])
  const [campaignsJoined, setCampaignsJoined] = useState<CampaignRow[]>([])
  const [rolls, setRolls] = useState<RollRow[]>([])
  const [rollCount, setRollCount] = useState(0)
  const [forumThreads, setForumThreads] = useState<ForumThreadRow[]>([])
  const [forumReplies, setForumReplies] = useState<ForumReplyRow[]>([])
  const [warStories, setWarStories] = useState<WarStoryRow[]>([])
  const [lfgPosts, setLfgPosts] = useState<LfgRow[]>([])
  const [bugs, setBugs] = useState<BugRow[]>([])
  const [pins, setPins] = useState<PinRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }

      const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (myProfile?.role?.toLowerCase() !== 'thriver') { router.push('/dashboard'); return }

      // All 11 data sources in parallel — header, character list +
      // count, campaigns owned + joined, roll log preview + count,
      // forum threads + replies, war stories, LFG posts, bug reports,
      // map pins. Counts use head:true; previews limit to 10 newest.
      const [
        hdr, chars, charCount, owned, joinedRows, rollData, rollTotal,
        threads, replies, stories, lfg, bugRows, pinRows,
      ] = await Promise.all([
        supabase.rpc('admin_user_with_login', { target_user_id: userId }),
        supabase.from('characters').select('id, name, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
        supabase.from('characters').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('campaigns').select('id, name, created_at').eq('gm_user_id', userId).order('created_at', { ascending: false }),
        supabase.from('campaign_members').select('campaign_id, joined_at, campaigns(id, name, created_at)').eq('user_id', userId).order('joined_at', { ascending: false }),
        supabase.from('roll_log').select('id, created_at, label, character_name, outcome, total, campaign_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('roll_log').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('forum_threads').select('id, title, created_at, setting').eq('author_user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('forum_replies').select('id, body, created_at, thread_id').eq('author_user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('war_stories').select('id, title, created_at').eq('author_user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('lfg_posts').select('id, title, created_at, setting').eq('author_user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('bug_reports').select('id, description, created_at, status, page_url').eq('reporter_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('map_pins').select('id, title, created_at, pin_type, status').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      ])

      const headerRow = (hdr.data ?? [])[0] as UserHeader | undefined
      if (!headerRow) {
        alert('User not found.')
        router.push('/moderate?section=users')
        return
      }
      setHeader(headerRow)
      setCharacters((chars.data ?? []) as CharacterRow[])
      setCharacterCount(charCount.count ?? 0)
      setCampaignsOwned((owned.data ?? []) as CampaignRow[])
      // campaign_members gives a join row; flatten the embedded campaign.
      setCampaignsJoined(
        ((joinedRows.data ?? []) as any[])
          .map(r => r.campaigns)
          .filter((c): c is CampaignRow => !!c && !!c.id)
      )
      setRolls((rollData.data ?? []) as RollRow[])
      setRollCount(rollTotal.count ?? 0)
      setForumThreads((threads.data ?? []) as ForumThreadRow[])
      setForumReplies((replies.data ?? []) as ForumReplyRow[])
      setWarStories((stories.data ?? []) as WarStoryRow[])
      setLfgPosts((lfg.data ?? []) as LfgRow[])
      setBugs((bugRows.data ?? []) as BugRow[])
      setPins((pinRows.data ?? []) as PinRow[])
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading || !header) return (
    <div style={{ padding: '2rem', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>Loading activity…</div>
  )

  const until = header.suspended_until ? new Date(header.suspended_until) : null
  const isSuspended = !!(until && until.getTime() > Date.now())
  const isPermanent = isSuspended && until!.getFullYear() >= 2099

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Carlito, sans-serif' }}>
      {/* Header — mirrors the moderate page user-row layout: identity
          chips on top, key dates inline. No action buttons here; this
          page is read-only. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <Link href="/moderate?section=users" style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', marginTop: '4px' }}>
          Back
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
              {header.username}
            </span>
            <span style={{
              fontSize: '13px', fontFamily: 'Carlito, sans-serif',
              letterSpacing: '.08em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: '2px',
              background: header.role?.toLowerCase() === 'thriver' ? '#2a1210' : '#1a1a2e',
              color: header.role?.toLowerCase() === 'thriver' ? '#f5a89a' : '#7ab3d4',
              border: `1px solid ${header.role?.toLowerCase() === 'thriver' ? '#c0392b' : '#2e2e5a'}`,
            }}>
              {header.role}
            </span>
            {isSuspended && (
              <span title={header.suspended_reason ?? undefined}
                style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px', background: '#2a1a00', color: '#EF9F27', border: '1px solid #EF9F27' }}>
                {isPermanent ? 'Suspended (perm)' : `Suspended → ${until!.toLocaleDateString()}`}
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px' }}>
            {header.email}
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '2px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <span><span style={{ color: '#7a8a9a' }}>Joined </span>{formatDate(header.created_at)}</span>
            <span><span style={{ color: '#7a8a9a' }}>Last login </span>{formatDate(header.last_sign_in_at)}</span>
          </div>
        </div>
      </div>

      {/* Section grid — each panel: title row with count, then a list
          preview. Empty sections collapse to a single muted line. */}
      <Section title="Characters" count={characterCount} viewAllHref={`/moderate/users/${userId}/characters`}>
        {characters.length === 0 ? <Empty /> : characters.map(c => (
          <Row key={c.id} primary={c.name} secondary={shortDate(c.created_at)} />
        ))}
      </Section>

      <Section title="Campaigns owned (GM)" count={campaignsOwned.length}>
        {campaignsOwned.length === 0 ? <Empty /> : campaignsOwned.map(c => (
          <Row key={c.id} primary={c.name}
            secondary={shortDate(c.created_at)}
            href={`/stories/${c.id}`} />
        ))}
      </Section>

      <Section title="Campaigns joined (player)" count={campaignsJoined.length}>
        {campaignsJoined.length === 0 ? <Empty /> : campaignsJoined.map(c => (
          <Row key={c.id} primary={c.name}
            secondary={shortDate(c.created_at)}
            href={`/stories/${c.id}`} />
        ))}
      </Section>

      <Section title="Recent rolls" count={rollCount} subtitle={rollCount > rolls.length ? `showing ${rolls.length} most recent` : undefined}>
        {rolls.length === 0 ? <Empty /> : rolls.map(r => (
          <Row key={r.id}
            primary={`${r.character_name ?? '—'} · ${r.label ?? 'roll'}`}
            secondary={`${[r.outcome, r.total].filter(v => v != null && v !== '').join(' · ')} · ${shortDate(r.created_at)}`} />
        ))}
      </Section>

      <Section title="Forum threads" count={forumThreads.length}>
        {forumThreads.length === 0 ? <Empty /> : forumThreads.map(t => (
          <Row key={t.id} primary={t.title}
            secondary={`${t.setting ?? 'campaign'} · ${shortDate(t.created_at)}`}
            href={`/campfire/forums/${t.id}`} />
        ))}
      </Section>

      <Section title="Forum replies" count={forumReplies.length}>
        {forumReplies.length === 0 ? <Empty /> : forumReplies.map(r => (
          <Row key={r.id}
            primary={(r.body ?? '').slice(0, 80) + ((r.body?.length ?? 0) > 80 ? '…' : '')}
            secondary={shortDate(r.created_at)}
            href={`/campfire/forums/${r.thread_id}`} />
        ))}
      </Section>

      <Section title="War stories" count={warStories.length}>
        {warStories.length === 0 ? <Empty /> : warStories.map(s => (
          <Row key={s.id} primary={s.title} secondary={shortDate(s.created_at)} />
        ))}
      </Section>

      <Section title="LFG posts" count={lfgPosts.length}>
        {lfgPosts.length === 0 ? <Empty /> : lfgPosts.map(p => (
          <Row key={p.id} primary={p.title}
            secondary={`${p.setting ?? '—'} · ${shortDate(p.created_at)}`} />
        ))}
      </Section>

      <Section title="Bug reports" count={bugs.length}>
        {bugs.length === 0 ? <Empty /> : bugs.map(b => (
          <Row key={b.id}
            primary={(b.description ?? '').slice(0, 80) + ((b.description?.length ?? 0) > 80 ? '…' : '')}
            secondary={`${b.status} · ${b.page_url ?? '—'} · ${shortDate(b.created_at)}`} />
        ))}
      </Section>

      <Section title="Map pins" count={pins.length}>
        {pins.length === 0 ? <Empty /> : pins.map(p => (
          <Row key={p.id} primary={p.title ?? '(untitled)'}
            secondary={`${p.pin_type ?? '—'} · ${p.status ?? '—'} · ${shortDate(p.created_at)}`} />
        ))}
      </Section>
    </div>
  )
}

function Section({
  title, count, subtitle, viewAllHref, children,
}: {
  title: string
  count: number
  subtitle?: string
  viewAllHref?: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          {title}
        </span>
        <span style={{ fontSize: '13px', color: '#cce0f5' }}>
          ({count})
        </span>
        {subtitle && (
          <span style={{ fontSize: '13px', color: '#7a8a9a', fontStyle: 'italic' }}>
            {subtitle}
          </span>
        )}
        {viewAllHref && (
          <Link href={viewAllHref} style={{ marginLeft: 'auto', fontSize: '13px', color: '#7ab3d4', textDecoration: 'none', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            View all →
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {children}
      </div>
    </section>
  )
}

function Row({ primary, secondary, href }: { primary: string; secondary?: string; href?: string }) {
  const inner = (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: '10px',
      padding: '5px 10px', background: '#1a1a1a',
      border: '1px solid #2e2e2e', borderRadius: '3px',
      fontSize: '13px',
    }}>
      <span style={{ color: '#f5f2ee', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {primary}
      </span>
      {secondary && (
        <span style={{ color: '#7a8a9a', flexShrink: 0 }}>
          {secondary}
        </span>
      )}
    </div>
  )
  if (href) {
    return <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link>
  }
  return inner
}

function Empty() {
  return (
    <div style={{ fontSize: '13px', color: '#7a8a9a', fontStyle: 'italic', padding: '4px 10px' }}>
      None.
    </div>
  )
}
