'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter } from 'next/navigation'
import { logFirstEvent } from '../../../lib/events'

export default function JoinCampaignPage() {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleJoin() {
    if (!code.trim()) return
    setJoining(true)
    setError('')
    const { user } = await getCachedAuth()
    if (!user) { setError('Not logged in.'); setJoining(false); return }

    const { data: campaign, error: findErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('invite_code', code.trim().toUpperCase())
      .single()

    if (findErr || !campaign) {
      setError('Invalid invite code. Check with your GM and try again.')
      setJoining(false)
      return
    }

    const { error: joinErr } = await supabase.from('campaign_members').insert({
      campaign_id: campaign.id,
      user_id: user.id,
    })

    if (joinErr) {
      if (joinErr.code === '23505') {
        // Already a member — just redirect
        router.push(`/stories/${campaign.id}`)
        return
      }
      setError(joinErr.message)
      setJoining(false)
      return
    }

    logFirstEvent('first_campaign_joined', { campaign_id: campaign.id })
    router.push(`/stories/${campaign.id}`)
  }

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Join a Story
        </div>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', borderLeft: '3px solid #7ab3d4' }}>
        <p style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.7, marginBottom: '16px' }}>
          Enter the invite code your GM gave you. Codes are 6 characters and look like <strong style={{ color: '#f5f2ee' }}>WOLF47</strong>.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Invite Code</label>
          <input
            style={{ width: '100%', padding: '12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '22px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.2em', textTransform: 'uppercase', boxSizing: 'border-box', textAlign: 'center' }}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            maxLength={6}
          />
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleJoin} disabled={joining || code.trim().length < 6}
            style={{ flex: 1, padding: '10px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: joining || code.trim().length < 6 ? 0.6 : 1 }}>
            {joining ? 'Joining...' : 'Join Story'}
          </button>
          <button onClick={() => router.back()}
            style={{ padding: '10px 20px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600,
  color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em',
  marginBottom: '6px', fontFamily: 'Carlito, sans-serif',
}
