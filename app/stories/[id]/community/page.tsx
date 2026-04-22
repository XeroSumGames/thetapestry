'use client'
// Campaign community — full-page view for the CURRENT campaign's
// communities (as opposed to /communities which is the cross-campaign
// index). Mounts CampaignCommunity, which handles creation, member
// management, role assignment, and (Phase B) recruitment landing.
//
// Reachable from the table page's header "Community" button (GM only).
// Players get a read-only view via the same component — it gates its
// own create/manage controls on the `isGM` prop.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase-browser'
import CampaignCommunity from '../../../../components/CampaignCommunity'

export default function CampaignCommunityPage() {
  const params = useParams()
  const campaignId = params.id as string
  const supabase = createClient()
  const [isGM, setIsGM] = useState(false)
  const [loading, setLoading] = useState(true)
  const [campaignName, setCampaignName] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: c } = await supabase
        .from('campaigns')
        .select('name, gm_user_id')
        .eq('id', campaignId)
        .maybeSingle()
      setIsGM((c as any)?.gm_user_id === user.id)
      setCampaignName((c as any)?.name ?? '')
      setLoading(false)
    }
    load()
  }, [campaignId])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.25rem 1rem 3rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
          <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', letterSpacing: '.06em', textTransform: 'uppercase', color: '#c0392b', margin: 0 }}>
            Communities
          </h1>
          {campaignName && (
            <span style={{ fontSize: '14px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              · {campaignName}
            </span>
          )}
        </div>
        <p style={{ color: '#cce0f5', fontSize: '14px', marginBottom: '1rem' }}>
          Create and manage communities inside this campaign. A Group becomes a Community at 13+ members,
          at which point weekly Morale Checks apply.
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          <a href={`/stories/${campaignId}/table`}
            style={{ padding: '6px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            ← Back to Table
          </a>
          <a href="/communities"
            style={{ padding: '6px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            All My Communities
          </a>
        </div>

        <div style={{ background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          <CampaignCommunity campaignId={campaignId} isGM={isGM} />
        </div>
      </div>
    </div>
  )
}
