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
import {
  forkSubscription,
  unsubscribeSubscription,
  reactivateSubscription,
  type ModuleSnapshot,
} from '../../../../../../lib/modules'
import ModuleReviewModal from '../../../../../../components/ModuleReviewModal'

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
  const [subscription, setSubscription] = useState<{ id: string; current_version_id: string | null; status: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [acting, setActing] = useState(false)

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
          .select('id, current_version_id, status')
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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Carlito, sans-serif', color: '#f5f2ee' }}>
      Loading version history…
    </div>
  )

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Carlito, sans-serif' }}>

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #8b5cf6', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c4a7f0' }}>
          📦 {moduleName || 'Module'} — Version History
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => router.back()}
          style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Back
        </button>
      </div>

      {subscription && (() => {
        const currentVersion = versions.find(v => v.id === subscription.current_version_id)
        const latestVersion = versions[0]
        const isBehind = subscription.status === 'active'
          && currentVersion && latestVersion
          && currentVersion.id !== latestVersion.id
        return (
          <div style={{ padding: '10px 14px', marginBottom: '1.25rem', background: '#2a1a3e', border: '1px solid #5a2e5a', borderLeft: '3px solid #8b5cf6', borderRadius: '4px', fontFamily: 'Carlito, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c4a7f0', marginBottom: '4px' }}>
                  This campaign is subscribed
                </div>
                <div style={{ fontSize: '14px', color: '#cce0f5', lineHeight: 1.5 }}>
                  Current cloned version: <strong style={{ color: '#f5f2ee' }}>{currentVersion ? `v${currentVersion.version}` : 'unknown'}</strong>
                  {' · '}status: <strong style={{ color: subscription.status === 'forked' ? '#EF9F27' : subscription.status === 'active' ? '#7fc458' : '#cce0f5' }}>{subscription.status}</strong>
                  {isBehind && <> · <span style={{ color: '#c4a7f0' }}>Latest is v{latestVersion.version}</span></>}
                </div>
              </div>
              {isBehind && (
                <button onClick={() => setReviewOpen(true)} disabled={acting}
                  style={{ padding: '7px 14px', background: '#2a102a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: acting ? 0.4 : 1 }}>
                  📦 Review v{latestVersion.version}
                </button>
              )}
              {subscription.status === 'active' && (
                <button onClick={async () => {
                  if (!confirm('Fork this subscription? You\'ll keep your current cloned content but stop receiving update prompts. You can re-activate later from this page.')) return
                  setActing(true)
                  try { await forkSubscription(supabase, subscription.id); setSubscription({ ...subscription, status: 'forked' }) }
                  catch (e: any) { alert(`Fork failed: ${e?.message ?? e}`) }
                  setActing(false)
                }} disabled={acting}
                  style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #EF9F27', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: acting ? 'not-allowed' : 'pointer' }}>
                  ⑂ Fork
                </button>
              )}
              {(subscription.status === 'forked' || subscription.status === 'unsubscribed') && (
                <button onClick={async () => {
                  setActing(true)
                  try { await reactivateSubscription(supabase, subscription.id); setSubscription({ ...subscription, status: 'active' }) }
                  catch (e: any) { alert(`Reactivate failed: ${e?.message ?? e}`) }
                  setActing(false)
                }} disabled={acting}
                  style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #7fc458', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: acting ? 'not-allowed' : 'pointer' }}>
                  ↻ Re-activate
                </button>
              )}
              {subscription.status !== 'unsubscribed' && (
                <button onClick={async () => {
                  if (!confirm('Unsubscribe from this module? Your cloned content stays in place but the link to the source module ends. You can re-subscribe by creating a new campaign from the module.')) return
                  setActing(true)
                  try { await unsubscribeSubscription(supabase, subscription.id); setSubscription({ ...subscription, status: 'unsubscribed' }) }
                  catch (e: any) { alert(`Unsubscribe failed: ${e?.message ?? e}`) }
                  setActing(false)
                }} disabled={acting}
                  style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: acting ? 'not-allowed' : 'pointer' }}>
                  ✕ Unsubscribe
                </button>
              )}
            </div>
          </div>
        )
      })()}

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
                <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.04em', color: isCurrent ? '#c4a7f0' : '#f5f2ee' }}>
                  v{v.version}
                </div>
                {isCurrent && (
                  <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#2a1a3e', border: '1px solid #5a2e5a', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                    Your clone
                  </span>
                )}
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                  {formatDate(v.published_at)}
                </div>
                <div style={{ flex: 1 }} />
                {v.subscriber_count > 0 && (
                  <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '2px', background: '#1a2e10', border: '1px solid #2d5a1b', color: '#7fc458', fontFamily: 'Carlito, sans-serif' }}>
                    {v.subscriber_count} subscriber{v.subscriber_count === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {v.changelog && (
                <div style={{ fontSize: '14px', color: '#d4cfc9', lineHeight: 1.5, marginBottom: '6px', whiteSpace: 'pre-wrap' }}>
                  {v.changelog}
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                <span style={{ color: '#5a5550', textTransform: 'uppercase' }}>Changes vs prior:</span>{' '}
                <span style={{ color: '#f5f2ee' }}>{summary}</span>
              </div>
            </div>
          )
        })}
      </div>

      {reviewOpen && subscription && (() => {
        const current = versions.find(v => v.id === subscription.current_version_id)
        const latest = versions[0]
        if (!current || !latest) return null
        return (
          <ModuleReviewModal
            supabase={supabase}
            subscriptionId={subscription.id}
            campaignId={campaignId}
            moduleName={moduleName}
            currentVersionId={current.id}
            currentVersionLabel={current.version}
            newVersionId={latest.id}
            newVersionLabel={latest.version}
            currentSnapshot={current.snapshot}
            newSnapshot={latest.snapshot}
            onClose={() => setReviewOpen(false)}
            onApplied={async ({ errors }) => {
              setReviewOpen(false)
              if (errors.length > 0) alert(`Applied with some errors:\n${errors.join('\n')}`)
              else alert(`Applied v${latest.version} to this campaign.`)
              // Re-fetch the subscription + versions so the page reflects the new state.
              const { data: newSub } = await supabase.from('module_subscriptions')
                .select('id, current_version_id, status')
                .eq('id', subscription.id)
                .maybeSingle()
              if (newSub) setSubscription(newSub as any)
            }}
          />
        )
      })()}
    </div>
  )
}
