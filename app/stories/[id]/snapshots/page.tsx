'use client'
// Story → Snapshots — own page, host for the CampaignSnapshots component.
// Was embedded inside /stories/[id]/edit; pulled out so the Edit page is
// just metadata fields + map style, and snapshot management has the
// dedicated breathing room it deserves (save / restore / download /
// import are 4 distinct flows, each with its own confirm dialog).
//
// GM-only: same RLS gate as the Snapshots component itself
// (campaign_snapshots policies). The page redirects non-GM visitors
// back to /stories/[id] to avoid showing an empty page.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-browser'
import { getCachedAuth } from '../../../../lib/auth-cache'
import CampaignSnapshots from '../../../../components/CampaignSnapshots'

interface CampaignRow {
  id: string
  name: string
  gm_user_id: string
}

export default function StorySnapshotsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<CampaignRow | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const { user } = await getCachedAuth()
      if (cancelled) return
      if (!user) { router.push(`/login?redirect=/stories/${id}/snapshots`); return }

      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name, gm_user_id')
        .eq('id', id)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) { router.push('/stories'); return }
      const c = data as CampaignRow
      // GM-only — players don't manage snapshots. Bounce them back
      // to the story page so they see something useful.
      if (c.gm_user_id !== user.id) {
        setAccessDenied(true)
        setLoading(false)
        return
      }
      setCampaign(c)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, router, supabase])

  if (loading) {
    return <div style={{ padding: '24px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
  }
  if (accessDenied || !campaign) {
    return (
      <div style={{ padding: '24px', maxWidth: '560px', margin: '0 auto', color: '#d4cfc9' }}>
        <div style={{ fontSize: '20px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>Access Denied</div>
        <div style={{ fontSize: '14px' }}>Snapshots are GM-only.</div>
        <Link href={`/stories/${id}`} style={{ display: 'inline-block', marginTop: '16px', color: '#c4a7f0' }}>← Back to Story</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif', color: '#d4cfc9' }}>
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <Link href={`/stories/${id}`} style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          ← {campaign.name}
        </Link>
      </div>
      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '13px', color: '#EF9F27', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>Snapshots</div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          {campaign.name}
        </div>
      </div>

      <CampaignSnapshots campaignId={campaign.id} isGM={true} />
    </div>
  )
}
