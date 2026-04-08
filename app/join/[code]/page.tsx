'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import { logFirstEvent } from '../../../lib/events'

export default function JoinByCodePage() {
  const params = useParams()
  const code = (params.code as string).toUpperCase()
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState<'loading' | 'found' | 'error'>('loading')
  const [campaign, setCampaign] = useState<any>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function find() {
      const { data } = await supabase.from('campaigns').select('*').eq('invite_code', code).single()
      if (data) { setCampaign(data); setStatus('found') }
      else setStatus('error')
    }
    find()
  }, [code])

  async function handleJoin() {
    setJoining(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?redirect=/join/${code}`); return }
    const { error } = await supabase.from('campaign_members').insert({ campaign_id: campaign.id, user_id: user.id })
    if (error && error.code !== '23505') { setStatus('error'); return }
    if (!error) logFirstEvent('first_campaign_joined', { campaign_id: campaign.id })
    router.push(`/stories/${campaign.id}`)
  }

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif' }}>
      Looking up story...
    </div>
  )

  if (status === 'error') return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '20px', color: '#f5a89a', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>Invalid Code</div>
        <div style={{ fontSize: '13px', color: '#d4cfc9', marginBottom: '16px' }}>That invite code doesn't match any story.</div>
        <a href="/stories/join" style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Try Again</a>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ maxWidth: '420px', width: '100%', padding: '2rem', background: '#1a1a1a', border: '1px solid #2e2e2e', borderLeft: '3px solid #c0392b', borderRadius: '4px', margin: '1rem' }}>
        <div style={{ fontSize: '11px', color: '#c0392b', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>You've been invited to join</div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#f5f2ee', marginBottom: '8px' }}>{campaign.name}</div>
        {campaign.description && <p style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.6, marginBottom: '16px' }}>{campaign.description}</p>}
        <button onClick={handleJoin} disabled={joining}
          style={{ width: '100%', padding: '12px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: joining ? 0.6 : 1 }}>
          {joining ? 'Joining...' : 'Join Story'}
        </button>
      </div>
    </div>
  )
}
