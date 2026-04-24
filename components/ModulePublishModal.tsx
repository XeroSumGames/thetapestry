'use client'
// Phase 5 Sprint 2 — Module publish wizard.
//
// A single-page modal (not a multi-step wizard) that lets the GM turn
// their current campaign into a published module version. The modal
// decides up front whether this is the first publish or a re-publish
// by checking for an existing module on the campaign (via
// getModuleForCampaign before opening). First publish creates the
// module row; re-publish inserts a new module_versions row pointing
// at the existing module and lets the user pick a semver bump kind.
//
// The snapshot build happens client-side through buildCampaignSnapshot
// — same supabase client, RLS applies to every read. Publish inserts
// the module_versions row with the jsonb snapshot. No server RPC.

import { useState, useEffect } from 'react'
import {
  buildCampaignSnapshot,
  publishModuleVersion,
  bumpSemver,
  type ModuleForCampaign,
  type SnapshotCounts,
} from '../lib/modules'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ModulePublishModalProps {
  supabase: SupabaseClient
  campaignId: string
  campaignName: string
  campaignDescription?: string | null
  existingModule: ModuleForCampaign | null
  onClose: () => void
  onPublished: (result: { moduleId: string; versionId: string; version: string }) => void
}

export default function ModulePublishModal({
  supabase,
  campaignId,
  campaignName,
  campaignDescription,
  existingModule,
  onClose,
  onPublished,
}: ModulePublishModalProps) {
  const isRepublish = !!existingModule

  const [name, setName] = useState(existingModule?.name ?? campaignName)
  const [tagline, setTagline] = useState(existingModule?.tagline ?? '')
  const [description, setDescription] = useState(existingModule?.description ?? campaignDescription ?? '')
  const [visibility, setVisibility] = useState<'private' | 'unlisted' | 'listed'>(
    existingModule?.visibility ?? 'private',
  )
  const [bumpKind, setBumpKind] = useState<'major' | 'minor' | 'patch'>('minor')
  const [changelog, setChangelog] = useState('')

  const [includePins, setIncludePins] = useState(true)
  const [includeNpcs, setIncludeNpcs] = useState(true)
  const [includeScenes, setIncludeScenes] = useState(true)
  const [includeHandouts, setIncludeHandouts] = useState(true)

  const [counts, setCounts] = useState<SnapshotCounts | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>('')

  // Preview counts refresh whenever the include toggles change so the
  // author sees a live count of what's about to travel in the module.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setPreviewing(true)
      try {
        const { counts } = await buildCampaignSnapshot(supabase, campaignId, {
          includePins,
          includeNpcs,
          includeScenes,
          includeHandouts,
        })
        if (!cancelled) setCounts(counts)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Preview failed')
      } finally {
        if (!cancelled) setPreviewing(false)
      }
    })()
    return () => { cancelled = true }
  }, [supabase, campaignId, includePins, includeNpcs, includeScenes, includeHandouts])

  const nextVersion = isRepublish && existingModule?.latest_version
    ? bumpSemver(existingModule.latest_version.version, bumpKind)
    : '1.0.0'

  async function handlePublish() {
    if (!name.trim()) { setError('Name is required.'); return }
    setSubmitting(true)
    setError('')
    try {
      const { snapshot } = await buildCampaignSnapshot(supabase, campaignId, {
        includePins, includeNpcs, includeScenes, includeHandouts,
      })
      const result = await publishModuleVersion(supabase, {
        campaignId,
        moduleId: existingModule?.id,
        name: name.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        parentSetting: existingModule?.parent_setting ?? 'custom',
        visibility,
        version: nextVersion,
        changelog: changelog.trim() || null,
        snapshot,
      })
      onPublished({ ...result, version: nextVersion })
    } catch (e: any) {
      setError(e?.message ?? 'Publish failed')
      setSubmitting(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────
  const backdrop: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 2000, padding: '20px',
  }
  const panel: React.CSSProperties = {
    background: '#1a1a1a', border: '1px solid #5a2e5a', borderLeft: '3px solid #8b5cf6',
    borderRadius: '4px', width: '640px', maxWidth: '100%',
    maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }
  const header: React.CSSProperties = {
    padding: '14px 18px', borderBottom: '1px solid #2e2e2e',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }
  const body: React.CSSProperties = {
    padding: '18px', flex: 1, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: '14px',
  }
  const footer: React.CSSProperties = {
    padding: '14px 18px', borderTop: '1px solid #2e2e2e',
    display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em',
    marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif',
  }
  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
    boxSizing: 'border-box',
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        <div style={header}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c4a7f0' }}>
            📦 {isRepublish ? `Publish New Version — ${existingModule!.name}` : 'Publish as Module'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#c4a7f0', fontSize: '22px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={body}>

          {/* Name */}
          <div>
            <label style={lbl}>Module Name</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Arena" />
          </div>

          {/* Tagline */}
          <div>
            <label style={lbl}>Tagline <span style={{ color: '#cce0f5', fontWeight: 400 }}>(optional, one-liner)</span></label>
            <input style={inp} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. A gladiator sandbox set in post-collapse Missouri." />
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>Description <span style={{ color: '#cce0f5', fontWeight: 400 }}>(optional)</span></label>
            <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="What this module is, who it's for, how many sessions it runs…" />
          </div>

          {/* Visibility */}
          <div>
            <label style={lbl}>Visibility</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['private', 'unlisted', 'listed'] as const).map(v => (
                <button key={v} type="button" onClick={() => setVisibility(v)}
                  style={{ flex: 1, padding: '8px', border: `1px solid ${visibility === v ? '#8b5cf6' : '#3a3a3a'}`, background: visibility === v ? '#2a1a3e' : '#242424', borderRadius: '3px', color: visibility === v ? '#c4a7f0' : '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {v === 'private' && '🔒 Private'}
                  {v === 'unlisted' && '🔗 Unlisted'}
                  {v === 'listed' && '🌐 Listed'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px', fontFamily: 'Barlow, sans-serif', lineHeight: 1.5 }}>
              {visibility === 'private' && 'Only you can pick this module when creating a campaign.'}
              {visibility === 'unlisted' && 'Anyone with the module link can subscribe, but it doesn\'t appear in any marketplace.'}
              {visibility === 'listed' && 'Will appear in the public marketplace after Thriver approval.'}
            </div>
          </div>

          {/* Content picker */}
          <div>
            <label style={lbl}>Include in snapshot</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px 12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                <input type="checkbox" checked={includePins} onChange={e => setIncludePins(e.target.checked)} />
                📍 Pins{counts !== null && <span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Barlow Condensed, sans-serif' }}>{includePins ? counts.pins : 0}</span>}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                <input type="checkbox" checked={includeNpcs} onChange={e => setIncludeNpcs(e.target.checked)} />
                🧑 NPCs{counts !== null && <span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Barlow Condensed, sans-serif' }}>{includeNpcs ? counts.npcs : 0}</span>}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                <input type="checkbox" checked={includeScenes} onChange={e => setIncludeScenes(e.target.checked)} />
                🗺 Tactical scenes{counts !== null && <span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Barlow Condensed, sans-serif' }}>{includeScenes ? `${counts.scenes} / ${counts.tokens} tokens` : 0}</span>}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                <input type="checkbox" checked={includeHandouts} onChange={e => setIncludeHandouts(e.target.checked)} />
                📄 Handouts{counts !== null && <span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Barlow Condensed, sans-serif' }}>{includeHandouts ? counts.handouts : 0}</span>}
              </label>
            </div>
            {previewing && <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>Reading campaign…</div>}
          </div>

          {/* Semver bump (re-publish only) */}
          {isRepublish && existingModule?.latest_version && (
            <div>
              <label style={lbl}>Version bump <span style={{ color: '#cce0f5', fontWeight: 400 }}>(current v{existingModule.latest_version.version})</span></label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['patch', 'minor', 'major'] as const).map(k => (
                  <button key={k} type="button" onClick={() => setBumpKind(k)}
                    style={{ flex: 1, padding: '8px', border: `1px solid ${bumpKind === k ? '#8b5cf6' : '#3a3a3a'}`, background: bumpKind === k ? '#2a1a3e' : '#242424', borderRadius: '3px', color: bumpKind === k ? '#c4a7f0' : '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {k} → v{bumpSemver(existingModule.latest_version!.version, k)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Changelog (re-publish only) */}
          {isRepublish && (
            <div>
              <label style={lbl}>Changelog <span style={{ color: '#cce0f5', fontWeight: 400 }}>(what changed in this version?)</span></label>
              <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={changelog} onChange={e => setChangelog(e.target.value)} placeholder="e.g. Added 3 NPCs to the south wing, fixed handout typos, re-balanced the Costco encounter." />
            </div>
          )}

          {error && (
            <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px' }}>
              {error}
            </div>
          )}
        </div>

        <div style={footer}>
          <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            → Publishing v{nextVersion}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} disabled={submitting}
              style={{ padding: '8px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: submitting ? 'not-allowed' : 'pointer' }}>
              Cancel
            </button>
            <button onClick={handlePublish} disabled={submitting || !name.trim()}
              style={{ padding: '8px 18px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !name.trim() ? 0.4 : 1, fontWeight: 600 }}>
              {submitting ? 'Publishing…' : `📦 Publish v${nextVersion}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
