'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import { useRouter, useParams } from 'next/navigation'
import { logFirstEvent } from '../../../lib/events'
import { getCampaignModuleCover } from '../../../lib/data/campaigns'
import { SETTINGS } from '../../../lib/settings'

export default function JoinByCodePage() {
  const params = useParams()
  const code = (params.code as string).toUpperCase()
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState<'loading' | 'found' | 'error'>('loading')
  const [campaign, setCampaign] = useState<any>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function find() {
      const { user } = await getCachedAuth()
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(`/join/${code}`)}`)
        return
      }
      // invite_code is no longer column-readable (enumeration leak; 2026-06-23).
      // The definer RPC matches an EXACT code and returns the joinable fields
      // (id/name/setting/description/cover_image_url/gm_user_id), never the code.
      const { data } = await supabase.rpc('find_campaign_by_invite_code', { p_code: code }).single()
      if (!data) { setStatus('error'); return }
      setCampaign(data)
      setStatus('found')
      const cover = data.cover_image_url || await getCampaignModuleCover(data.id)
      setCoverUrl(cover)
    }
    find()
  }, [code])

  async function handleJoin(asObserver = false) {
    setJoining(true)
    const { user } = await getCachedAuth()
    if (!user) { router.push(`/login?redirect=${encodeURIComponent(`/join/${code}`)}`); return }
    // Server-side validates the code and performs the membership insert
    // atomically (join_campaign_by_invite_code) - a raw table insert can no
    // longer join an arbitrary campaign_id regardless of code possession.
    // "Join Story" (asObserver=false, the default) reconciles a stale observer
    // seat back to player on re-join; "Join as Observer" (asObserver=true)
    // joins as a silent watcher and lands at the table, not the lobby.
    const { data, error } = await supabase.rpc('join_campaign_by_invite_code', { p_code: code, p_observer: asObserver }).single()
    if (error || !data) { setStatus('error'); setJoining(false); return }
    if (!asObserver) logFirstEvent('first_campaign_joined', { campaign_id: campaign.id })
    router.push(asObserver ? `/stories/${campaign.id}/table` : `/stories/${campaign.id}`)
  }

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.08em', textTransform: 'uppercase' }}>
      Looking up story...
    </div>
  )

  if (status === 'error') return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Carlito, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '20px', color: '#f5a89a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Invalid Code</div>
        <div style={{ fontSize: '13px', color: '#7a7068', marginBottom: '20px' }}>That invite code doesn&apos;t match any story.</div>
        <Link href="/stories/join" style={{ padding: '10px 20px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>Try Again</Link>
      </div>
    </div>
  )

  const settingLabel = SETTINGS[campaign.setting] ?? campaign.setting ?? null

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Carlito, sans-serif', position: 'relative', overflow: 'hidden' }}>

      {/* Atmospheric blurred background */}
      {coverUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" aria-hidden style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(18px) brightness(0.25) saturate(0.6)', transform: 'scale(1.08)', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.65) 100%)', zIndex: 1, pointerEvents: 'none' }} />
        </>
      )}

      {/* Card */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '460px', margin: '1.5rem', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}>

        {/* Cover image */}
        {coverUrl ? (
          <div style={{ width: '100%', height: '220px', position: 'relative', overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={campaign.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(18,18,18,1) 100%)' }} />
          </div>
        ) : (
          <div style={{ width: '100%', height: '80px', background: '#111', borderBottom: '1px solid #1a1a1a' }} />
        )}

        {/* Content */}
        <div style={{ background: '#121212', padding: coverUrl ? '0 28px 28px' : '28px', marginTop: coverUrl ? '-8px' : 0 }}>

          {/* Setting chip */}
          {settingLabel && (
            <div style={{ display: 'inline-block', fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '3px', background: '#1a2e10', color: '#7fc458', border: '1px solid #2d5a1b', marginBottom: '10px', fontWeight: 700 }}>
              {settingLabel}
            </div>
          )}

          {/* Invite label */}
          <div style={{ fontSize: '13px', color: '#c0392b', textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700, marginBottom: '6px' }}>
            You&apos;ve been invited to join
          </div>

          {/* Campaign name */}
          <div style={{ fontSize: '32px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#fff', lineHeight: 1.05, marginBottom: campaign.description ? '14px' : '22px' }}>
            {campaign.name}
          </div>

          {/* Hook */}
          {campaign.description && (
            <p style={{ fontSize: '15px', color: '#cce0f5', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '24px', borderLeft: '2px solid #c0392b', paddingLeft: '14px' }}>
              {campaign.description}
            </p>
          )}

          {/* CTA */}
          <button onClick={() => handleJoin(false)} disabled={joining}
            style={{ width: '100%', padding: '14px', background: joining ? '#7a1f16' : '#c0392b', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '15px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, cursor: joining ? 'not-allowed' : 'pointer', opacity: joining ? 0.7 : 1, transition: 'background .15s' }}>
            {joining ? 'Joining...' : 'Join Story'}
          </button>

          {/* Secondary, quieter option - join to watch silently instead of play. */}
          <button onClick={() => handleJoin(true)} disabled={joining}
            style={{ width: '100%', marginTop: '10px', padding: '9px', background: 'transparent', border: '1px solid #2d5a1b', borderRadius: '4px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.05em', cursor: joining ? 'not-allowed' : 'pointer', opacity: joining ? 0.6 : 1 }}>
            Just want to watch? Join as Observer
          </button>

          <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '13px', color: '#5a5a5a' }}>
            Story code: <span style={{ color: '#7a7068', letterSpacing: '.1em' }}>{code}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
