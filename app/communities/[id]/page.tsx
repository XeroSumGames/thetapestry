'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import CampaignCommunity from '../../../components/CampaignCommunity'

// Detail page for one community. Loads the community row to find its
// campaign, then mounts CampaignCommunity scoped to that campaign. User
// clicks the community header in that component to expand it; for a
// dedicated detail view we auto-open it below.

export default function CommunityDetailPage() {
  const params = useParams()
  const communityId = params?.id as string
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaignName, setCampaignName] = useState<string>('')
  const [isGM, setIsGM] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      if (!communityId) return
      const { user } = await getCachedAuth()
      const { data: com } = await supabase.from('communities').select('campaign_id').eq('id', communityId).maybeSingle()
      if (!com) { setNotFound(true); setLoading(false); return }
      setCampaignId(com.campaign_id)
      const { data: camp } = await supabase.from('campaigns').select('name, gm_user_id').eq('id', com.campaign_id).maybeSingle()
      if (camp) {
        setCampaignName(camp.name)
        setIsGM(user?.id === camp.gm_user_id)
      }
      setLoading(false)
    }
    load()
  }, [communityId])

  if (loading) return <div style={{ padding: '2rem', color: '#cce0f5' }}>Loading…</div>
  if (notFound) return (
    <div style={{ padding: '2rem', color: '#cce0f5', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ fontSize: '18px', fontFamily: 'Carlito, sans-serif', color: '#c0392b', textTransform: 'uppercase', letterSpacing: '.06em' }}>Community not found</div>
      <div style={{ marginTop: '8px' }}>It may have been deleted, or you may not have access.</div>
      <Link href="/communities" style={{ display: 'inline-block', marginTop: '1rem', color: '#7ab3d4' }}>← My Communities</Link>
    </div>
  )
  if (!campaignId) return null

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '1.5rem 1.5rem 4rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/communities" style={{ color: '#7ab3d4', fontSize: '13px', textDecoration: 'none', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>← My Communities</Link>
      </div>
      <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Campaign</div>
      <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', color: '#EF9F27', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '1rem' }}>{campaignName}</div>
      {/* Reuse the per-campaign panel; its list will include this community and
          the GM can open/manage it inline. */}
      <div style={{ background: '#111', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
        <CampaignCommunity campaignId={campaignId} isGM={isGM} initialOpenId={communityId} />
      </div>
    </div>
  )
}
