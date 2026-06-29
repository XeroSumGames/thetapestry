'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter } from 'next/navigation'
import { logFirstEvent } from '../../../lib/events'
import { setMemberObserver } from '../../../lib/data/campaigns'

export default function JoinCampaignPage() {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [isObserver, setIsObserver] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const codeParam = params.get('code')
    if (codeParam) setCode(codeParam.toUpperCase())
    if (params.get('observer') === '1') setIsObserver(true)
  }, [])

  async function handleJoin() {
    if (!code.trim()) return
    setJoining(true)
    setError('')
    const { user } = await getCachedAuth()
    if (!user) { setError('Not logged in.'); setJoining(false); return }

    // invite_code is no longer column-readable (enumeration leak; 2026-06-23).
    // Look up by exact code via the definer RPC (it trims + uppercases too).
    const { data: campaign, error: findErr } = await supabase
      .rpc('find_campaign_by_invite_code', { p_code: code.trim() })
      .single()

    if (findErr || !campaign) {
      setError('Invalid invite code. Check with your GM and try again.')
      setJoining(false)
      return
    }

    // Observers go straight to the table to watch silently; players land
    // at the lobby to assign a survivor first.
    const destination = isObserver ? `/stories/${campaign.id}/table` : `/stories/${campaign.id}`

    const { error: joinErr } = await supabase.from('campaign_members').insert({
      campaign_id: campaign.id,
      user_id: user.id,
      observer: isObserver,
    })

    if (joinErr) {
      if (joinErr.code === '23505') {
        // Already a member. The insert is a no-op on conflict, so the
        // observer flag would be silently dropped - someone who followed
        // the observer link while already seated would never actually
        // become an observer. Upgrade the existing seat explicitly.
        if (isObserver) {
          await setMemberObserver(campaign.id, user.id, true)
        }
        router.push(destination)
        return
      }
      setError(joinErr.message)
      setJoining(false)
      return
    }

    if (!isObserver) logFirstEvent('first_campaign_joined', { campaign_id: campaign.id })
    router.push(destination)
  }

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Carlito, sans-serif' }}>

      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          {isObserver ? 'Join as Observer' : 'Join a Story'}
        </div>
      </div>

      {isObserver && (
        <div style={{ background: '#1a2010', border: '1px solid #2d5a1b', borderRadius: '4px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', lineHeight: 1.6 }}>
          Observer mode: you will join the session silently - no player bar entry, no combat slot. You see the table as a player but are invisible to the group.
        </div>
      )}

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', borderLeft: `3px solid ${isObserver ? '#7fc458' : '#7ab3d4'}` }}>
        <p style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.7, marginBottom: '16px' }}>
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
            style={{ flex: 1, padding: '10px', background: isObserver ? '#1a2e10' : '#1a3a5c', border: `1px solid ${isObserver ? '#7fc458' : '#7ab3d4'}`, borderRadius: '3px', color: isObserver ? '#7fc458' : '#7ab3d4', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: joining || code.trim().length < 6 ? 0.6 : 1 }}>
            {joining ? 'Joining...' : isObserver ? 'Join as Observer' : 'Join Story'}
          </button>
          <button onClick={() => router.back()}
            style={{ padding: '10px 20px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600,
  color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.08em',
  marginBottom: '6px', fontFamily: 'Carlito, sans-serif',
}
