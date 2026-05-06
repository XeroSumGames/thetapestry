'use client'
// /modules/[id] — public-facing module detail.
//
// Sister page to /modules — a card on that grid links here. Shows the
// full description, version history (latest first), and a "Create
// campaign with this module" CTA that pre-selects the module on the
// new-campaign flow via ?module=<id>.
//
// RLS handles visibility: author always sees their own modules; listed
// + approved modules are visible to everyone; private/unlisted return
// 0 rows for non-author viewers (rendered as "module not found").

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import {
  listModuleReviews,
  isModuleSubscriber,
  upsertModuleReview,
  deleteModuleReview,
  type ModuleReview,
} from '../../../lib/modules'

const SETTING_LABELS: Record<string, string> = {
  custom: 'Custom',
  mongrels: 'Mongrels',
  chased: 'Chased',
  district_zero: 'District Zero',
  arena: 'The Arena',
  empty: 'Empty',
}

interface ModuleDetail {
  id: string
  name: string
  tagline: string | null
  description: string | null
  cover_image_url: string | null
  parent_setting: string | null
  visibility: 'private' | 'unlisted' | 'listed'
  author_user_id: string | null
  created_at: string
  archived_at: string | null
  // moderation_status only present once the Phase B+ migration ran;
  // missing on older rows.
  moderation_status?: string | null
  // Aggregate review fields — populated by trigger from
  // sql/modules-phase-c-reviews.sql. May be 0/null on older rows.
  avg_rating?: number | null
  rating_count?: number | null
}

interface VersionRow {
  id: string
  version: string
  version_major: number
  version_minor: number
  version_patch: number
  published_at: string
  changelog: string | null
  subscriber_count: number
}

export default function ModuleDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [mod, setMod] = useState<ModuleDetail | null>(null)
  const [versions, setVersions] = useState<VersionRow[] | null>(null)
  const [authorName, setAuthorName] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string>('')
  // Reviews — public list + the current user's existing review (if any)
  // so we can show "Edit Yours" instead of "Write a Review" when they
  // already have one. canReview is gated on having an active
  // subscription to this module (the RLS policy enforces it server-side
  // too; this is just to hide the form when it would 403).
  const [reviews, setReviews] = useState<ModuleReview[] | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [canReview, setCanReview] = useState(false)
  const [draftRating, setDraftRating] = useState(0)
  const [draftBody, setDraftBody] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string>('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('modules')
          .select('id, name, tagline, description, cover_image_url, parent_setting, visibility, author_user_id, created_at, archived_at, moderation_status, avg_rating, rating_count')
          .eq('id', id)
          .maybeSingle()
        if (cancelled) return
        if (error) { setError(error.message); return }
        if (!data) { setNotFound(true); return }
        setMod(data as ModuleDetail)

        // Versions — newest first by major/minor/patch then by published_at.
        const { data: vRows } = await supabase
          .from('module_versions')
          .select('id, version, version_major, version_minor, version_patch, published_at, changelog, subscriber_count')
          .eq('module_id', id)
          .order('version_major', { ascending: false })
          .order('version_minor', { ascending: false })
          .order('version_patch', { ascending: false })
        if (!cancelled) setVersions((vRows ?? []) as VersionRow[])

        // Author display name (best-effort; unauthenticated viewers may
        // see anonymous if profiles RLS blocks).
        if (data.author_user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', data.author_user_id)
            .maybeSingle()
          if (!cancelled) setAuthorName(profile?.username ?? null)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load module.')
      }
    })()
    return () => { cancelled = true }
  }, [supabase, id])

  // Reviews load. Separate effect so the form can re-fetch after
  // submit without re-triggering the heavy module/version load above.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const { user } = await getCachedAuth()
      if (cancelled) return
      setCurrentUserId(user?.id ?? null)
      const [list, sub] = await Promise.all([
        listModuleReviews(supabase, id),
        user ? isModuleSubscriber(supabase, id) : Promise.resolve(false),
      ])
      if (cancelled) return
      setReviews(list)
      setCanReview(sub)
      // Pre-fill the form if the current user already has a review.
      if (user) {
        const mine = list.find(r => r.user_id === user.id)
        if (mine) {
          setDraftRating(mine.rating)
          setDraftBody(mine.body ?? '')
        }
      }
    })()
    return () => { cancelled = true }
  }, [supabase, id])

  async function handleSubmitReview() {
    if (!id || draftRating < 1) return
    setSavingReview(true)
    setReviewError('')
    const { ok, error: err } = await upsertModuleReview(supabase, id, draftRating, draftBody)
    setSavingReview(false)
    if (!ok) {
      setReviewError(err ?? 'Failed to save review.')
      return
    }
    // Refetch the reviews list + the module aggregates so the chip
    // updates without requiring a page reload.
    const [list, { data: refreshed }] = await Promise.all([
      listModuleReviews(supabase, id),
      supabase.from('modules').select('avg_rating, rating_count').eq('id', id).maybeSingle(),
    ])
    setReviews(list)
    if (refreshed && mod) {
      setMod({ ...mod, avg_rating: (refreshed as any).avg_rating, rating_count: (refreshed as any).rating_count })
    }
  }

  async function handleDeleteOwnReview() {
    if (!id || !currentUserId || !reviews) return
    const mine = reviews.find(r => r.user_id === currentUserId)
    if (!mine) return
    if (!confirm('Delete your review? You can write a new one any time.')) return
    const { ok, error: err } = await deleteModuleReview(supabase, mine.id)
    if (!ok) { alert(err ?? 'Failed to delete.'); return }
    setDraftRating(0)
    setDraftBody('')
    const [list, { data: refreshed }] = await Promise.all([
      listModuleReviews(supabase, id),
      supabase.from('modules').select('avg_rating, rating_count').eq('id', id).maybeSingle(),
    ])
    setReviews(list)
    if (refreshed && mod) {
      setMod({ ...mod, avg_rating: (refreshed as any).avg_rating, rating_count: (refreshed as any).rating_count })
    }
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 20px', textAlign: 'center', color: '#d4cfc9' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
        <h1 style={{ margin: '0 0 8px', fontFamily: 'Carlito, sans-serif', fontSize: '24px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>Module not found</h1>
        <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#cce0f5' }}>
          This module may be private, unlisted, or archived.
        </p>
        <Link href="/rumors" style={{ color: '#c4a7f0', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>← Back to marketplace</Link>
      </div>
    )
  }

  if (!mod) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 20px', textAlign: 'center', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
        {error || 'Loading…'}
      </div>
    )
  }

  const settingLabel = SETTING_LABELS[mod.parent_setting ?? 'custom'] ?? mod.parent_setting
  const isArchived = !!mod.archived_at
  const isPendingModeration = mod.visibility === 'listed' && mod.moderation_status === 'pending'

  function handleSubscribe() {
    router.push(`/campaigns/new?module=${mod!.id}`)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px', color: '#d4cfc9' }}>

      <div style={{ marginBottom: '14px' }}>
        <Link href="/rumors" style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
          ← Back to marketplace
        </Link>
      </div>

      {/* Hero */}
      <div style={{
        background: mod.cover_image_url ? `url(${mod.cover_image_url}) center/cover` : 'linear-gradient(135deg, #1a1a1a 0%, #2a1a3e 100%)',
        height: '220px',
        borderRadius: '4px',
        marginBottom: '14px',
        position: 'relative',
        border: '1px solid #2e2e2e',
        borderLeft: '3px solid #8b5cf6',
      }}>
        {!mod.cover_image_url && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', opacity: 0.3 }}>📦</div>
        )}
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'Carlito, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          {mod.name}
        </h1>
        <button
          onClick={handleSubscribe}
          disabled={isArchived || isPendingModeration}
          style={{
            padding: '10px 20px',
            background: isArchived || isPendingModeration ? '#242424' : '#2a1a3e',
            border: `1px solid ${isArchived || isPendingModeration ? '#3a3a3a' : '#5a2e5a'}`,
            borderRadius: '3px',
            color: isArchived || isPendingModeration ? '#5a5550' : '#c4a7f0',
            fontSize: '14px',
            fontFamily: 'Carlito, sans-serif',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            cursor: isArchived || isPendingModeration ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isArchived ? 'Archived' : isPendingModeration ? 'Pending review' : '📦 Create campaign with this'}
        </button>
      </div>

      {/* Tags row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        {settingLabel && (
          <span style={{ padding: '3px 10px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', fontSize: '13px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            {settingLabel}
          </span>
        )}
        {mod.visibility === 'listed' && (
          <span style={{ padding: '3px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            🌐 Listed
          </span>
        )}
        {mod.visibility === 'unlisted' && (
          <span style={{ padding: '3px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            🔗 Unlisted
          </span>
        )}
        {mod.visibility === 'private' && (
          <span style={{ padding: '3px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            🔒 Private
          </span>
        )}
        {authorName && (
          <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
            by <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{authorName}</span>
          </span>
        )}
        {(mod.rating_count ?? 0) > 0 && (
          <span title={`Average rating across ${mod.rating_count} review${mod.rating_count === 1 ? '' : 's'}`}
            style={{ padding: '3px 10px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            ⭐ {(mod.avg_rating ?? 0).toFixed(1)} <span style={{ opacity: 0.7 }}>({mod.rating_count})</span>
          </span>
        )}
      </div>

      {mod.tagline && (
        <p style={{ margin: '0 0 14px', fontSize: '17px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', fontStyle: 'italic', lineHeight: 1.5 }}>
          {mod.tagline}
        </p>
      )}

      {isPendingModeration && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#2a2010', border: '1px solid #a17a14', borderRadius: '3px', color: '#fcd34d', fontSize: '13px' }}>
          ⏳ This module is awaiting Thriver review before it appears in the public marketplace listing.
        </div>
      )}

      {mod.description && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '14px 16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
            About this module
          </div>
          <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'Carlito, sans-serif' }}>
            {mod.description}
          </div>
        </div>
      )}

      {/* Reviews — public list + write-your-own form for active
          subscribers. Hidden when nobody's reviewed AND the current
          user can't review yet, so we don't show an empty card on
          fresh modules a non-subscriber lands on. */}
      {(() => {
        const myReview = currentUserId && reviews ? reviews.find(r => r.user_id === currentUserId) ?? null : null
        const showCard = (reviews && reviews.length > 0) || canReview
        if (!showCard) return null
        return (
          <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '14px 16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>
              Reviews
            </div>

            {/* Write / edit your own. Only renders when canReview === true
                (active subscription) — RLS would 403 the upsert otherwise. */}
            {canReview && (
              <div style={{ marginBottom: '16px', padding: '10px 12px', background: '#0f1a2e', border: '1px solid #2e2e5a', borderRadius: '3px' }}>
                <div style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                  {myReview ? 'Edit your review' : 'Write a review'}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setDraftRating(n)}
                      title={`${n} star${n === 1 ? '' : 's'}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '24px', lineHeight: 1, color: n <= draftRating ? '#EF9F27' : '#3a3a3a' }}>
                      ★
                    </button>
                  ))}
                  {draftRating > 0 && (
                    <span style={{ alignSelf: 'center', marginLeft: '8px', fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em' }}>
                      {draftRating}/5
                    </span>
                  )}
                </div>
                <textarea
                  value={draftBody}
                  onChange={e => setDraftBody(e.target.value)}
                  placeholder="What worked, what didn't, who's it for? (optional)"
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', resize: 'vertical', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" onClick={handleSubmitReview} disabled={savingReview || draftRating < 1}
                    style={{ padding: '7px 14px', background: draftRating > 0 ? '#1a1a2e' : '#111', border: `1px solid ${draftRating > 0 ? '#2e2e5a' : '#2e2e2e'}`, borderRadius: '3px', color: draftRating > 0 ? '#7ab3d4' : '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: draftRating > 0 && !savingReview ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                    {savingReview ? 'Saving…' : myReview ? 'Update review' : 'Submit review'}
                  </button>
                  {myReview && (
                    <button type="button" onClick={handleDeleteOwnReview}
                      style={{ padding: '7px 12px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Delete
                    </button>
                  )}
                  {reviewError && (
                    <span style={{ fontSize: '13px', color: '#f5a89a' }}>{reviewError}</span>
                  )}
                </div>
              </div>
            )}

            {/* Public review list */}
            {reviews === null ? (
              <div style={{ fontSize: '13px', color: '#5a5550' }}>Loading…</div>
            ) : reviews.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
                No reviews yet. {canReview ? 'Be the first.' : 'Subscribers can leave reviews — pick a campaign with this module to write one.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reviews.map(r => (
                  <div key={r.id} style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: r.body ? '4px' : 0 }}>
                      <span style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                        {'★'.repeat(r.rating)}<span style={{ color: '#3a3a3a' }}>{'★'.repeat(5 - r.rating)}</span>
                        <span style={{ marginLeft: '8px', color: '#f5f2ee', fontWeight: 600 }}>{r.author_username ?? 'unknown'}</span>
                      </span>
                      <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.body && (
                      <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, fontFamily: 'Carlito, sans-serif', whiteSpace: 'pre-wrap' }}>
                        {r.body}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Version history */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '14px 16px' }}>
        <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '10px' }}>
          Version history
        </div>
        {versions === null ? (
          <div style={{ fontSize: '13px', color: '#5a5550' }}>Loading…</div>
        ) : versions.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#5a5550' }}>No versions published yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {versions.map((v, i) => (
              <div key={v.id} style={{
                padding: '8px 12px',
                background: i === 0 ? '#2a1a3e' : '#242424',
                border: `1px solid ${i === 0 ? '#5a2e5a' : '#3a3a3a'}`,
                borderRadius: '3px',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: i === 0 ? '#c4a7f0' : '#d4cfc9', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                    v{v.version}{i === 0 && <span style={{ marginLeft: '8px', fontSize: '13px', color: '#7fc458', letterSpacing: '.06em', textTransform: 'uppercase' }}>← latest</span>}
                  </span>
                  <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
                    {new Date(v.published_at).toLocaleDateString()} · {v.subscriber_count ?? 0} subscriber{v.subscriber_count === 1 ? '' : 's'}
                  </span>
                </div>
                {v.changelog && (
                  <div style={{ marginTop: '6px', fontSize: '13px', color: '#d4cfc9', whiteSpace: 'pre-wrap', fontFamily: 'Carlito, sans-serif' }}>
                    {v.changelog}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
