'use client'
// Phase 5 Sprint 3 — Module version history page.
//
// Route: /stories/<campaign_id>/modules/<module_id>/versions
//
// Shows every published version of a module in reverse-chronological
// order, with:
//   - version number (bold)
//   - published timestamp
//   - author's changelog
//   - one-line diff summary against the previous version
//     ("+2 NPCs, 3 handouts updated, −1 pin")
//   - subscriber-count chip
//
// Accessible to:
//   - the module's author (always)
//   - any campaign that's subscribed to it (so they can see the
//     history of what landed + what was in the version they cloned)
//   - Thrivers (for moderation)
//
// The campaign_id in the URL is mainly for the "Review this update"
// flow — so the page knows which subscriber context to consider
// current. If the viewer isn't actually subscribed, the page still
// renders but the Review button is hidden.

import { useEffect, useState } from 'react'
import { createClient } from '../../../../../../lib/supabase-browser'
import { useParams, useRouter } from 'next/navigation'
import { diffSnapshots, summarizeDiff } from '../../../../../../lib/module-diff'
import type { ModuleSnapshot } from '../../../../../../lib/modules'

interface VersionRow {
  id: string
  module_id: string
  version: string
  version_major: number
  version_minor: number
  version_patch: number
  published_at: string
  changelog: string | null
  snapshot: ModuleSnapshot
  subscriber_count: number
}

export default function ModuleVersionsPage() {
  const params = useParams<{ id: string; moduleId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const campaignId = params.id
  const moduleId = params.moduleId

  const [moduleName, setModuleName] = useState<string>('')
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [subscription, setSubscription] = useState<{ current_version_id: string | null; status: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [modRes, versRes, subRes] = await Promise.all([
        supabase.from('modules').select('name').eq('id', moduleId).maybeSingle(),
        supabase.from('module_versions')
          .select('id, module_id, version, version_major, version_minor, version_patch, published_at, changelog, snapshot, subscriber_count')
          .eq('module_id', moduleId)
          .order('published_at', { ascending: false }),
        supabase.from('module_subscriptions')
          .select('current_version_id, status')
          .eq('module_id', moduleId)
          .eq('campaign_id', campaignId)
          .maybeSingle(),
      ])
      if (cancelled) return
      setModuleName((modRes.data as any)?.name ?? '')
      setVersions((versRes.data ?? []) as VersionRow[])
      setSubscription((subRes.data as any) ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [moduleId, campaignId])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      Loading version history…
    </div>
  )

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #8b5cf6', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c4a7f0' }}>
          📦 {moduleName || 'Module'} — Version History
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => router.back()}
          style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Back
        </button>
      </div>

      {subscription && (
        <div style={{ padding: '10px 14px', marginBottom: '1.25rem', background: '#2a1a3e', border: '1px solid #5a2e5a', borderLeft: '3px solid #8b5cf6', borderRadius: '4px', fontSize: '14px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c4a7f0', marginBottom: '4px' }}>
            This campaign is subscribed
          </div>
          Current cloned version: <strong style={{ color: '#f5f2ee' }}>{(() => {
            const current = versions.find(v => v.id === subscription.current_version_id)
            return current ? `v${current.version}` : 'unknown'
          })()}</strong> · status: <strong style={{ color: subscription.status === 'forked' ? '#EF9F27' : subscription.status === 'active' ? '#7fc458' : '#cce0f5' }}>{subscription.status}</strong>
        </div>
      )}

      {versions.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#cce0f5', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          No versions published yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {versions.map((v, idx) => {
          const previous = versions[idx + 1]  // versions sorted DESC, so "next older" is idx + 1
          const diff = previous ? diffSnapshots(previous.snapshot, v.snapshot) : null
          const summary = diff ? summarizeDiff(diff) : '(initial version)'
          const isCurrent = subscription?.current_version_id === v.id
          return (
            <div key={v.id} style={{
              background: '#1a1a1a',
              border: `1px solid ${isCurrent ? '#8b5cf6' : '#2e2e2e'}`,
              borderLeft: `3px solid ${isCurrent ? '#8b5cf6' : '#5a2e5a'}`,
              borderRadius: '4px', padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', color: isCurrent ? '#c4a7f0' : '#f5f2ee' }}>
                  v{v.version}
                </div>
                {isCurrent && (
                  <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#2a1a3e', border: '1px solid #5a2e5a', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Your clone
                  </span>
                )}
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                  {formatDate(v.published_at)}
                </div>
                <div style={{ flex: 1 }} />
                {v.subscriber_count > 0 && (
                  <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {v.subscriber_count} subscriber{v.subscriber_count === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {v.changelog && (
                <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.5, marginBottom: '6px', whiteSpace: 'pre-wrap' }}>
                  {v.changelog}
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
                <span style={{ color: '#5a5550', textTransform: 'uppercase' }}>Changes vs prior:</span>{' '}
                <span style={{ color: '#f5f2ee' }}>{summary}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
