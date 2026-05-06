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
  type ModuleSnapshot,
  type SnapshotCounts,
} from '../lib/modules'
import type { SupabaseClient } from '@supabase/supabase-js'
import ObjectImageCropper from './ObjectImageCropper'
import { ModalBackdrop, Z_INDEX } from '../lib/style-helpers'

export interface ModulePublishModalProps {
  supabase: SupabaseClient
  // null when publishing from an uploaded snapshot file (no source
  // campaign in the DB) — see /modules/import. The source_campaign_id
  // column on `modules` is nullable per spec §5.
  campaignId: string | null
  campaignName: string
  campaignDescription?: string | null
  existingModule: ModuleForCampaign | null
  // When set, the modal goes into snapshot-source mode: skip the live
  // buildCampaignSnapshot preview, hide the include-toggles (snapshot
  // is pre-filtered), and publish using this snapshot directly. Pair
  // with `initialCounts` so the preview row reads correctly.
  initialSnapshot?: ModuleSnapshot
  initialCounts?: SnapshotCounts
  onClose: () => void
  onPublished: (result: { moduleId: string; versionId: string; version: string }) => void
}

export default function ModulePublishModal({
  supabase,
  campaignId,
  campaignName,
  campaignDescription,
  existingModule,
  initialSnapshot,
  initialCounts,
  onClose,
  onPublished,
}: ModulePublishModalProps) {
  const isRepublish = !!existingModule
  // Snapshot-source mode flag — the modal switches behavior in three
  // places: preview useEffect (skipped), include-toggles UI (hidden),
  // and the publish handler (uses initialSnapshot directly instead of
  // calling buildCampaignSnapshot against the live campaign).
  const isSnapshotSource = !!initialSnapshot

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

  const [counts, setCounts] = useState<SnapshotCounts | null>(initialCounts ?? null)
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>('')

  // Cover image — pre-fill from the existing module on re-publish so
  // a previously-uploaded cover persists across versions. State value:
  //   string  — current cover URL (existing or freshly uploaded)
  //   null    — explicitly cleared by the user (will save as null)
  //   ''      — never set; treated as null on save
  // The "dirty" flag tracks whether the user actually changed the
  // cover this session, so re-publish without touching it doesn't
  // overwrite cover_image_url with an unintended value.
  const [coverUrl, setCoverUrl] = useState<string | null>(existingModule?.cover_image_url ?? null)
  const [coverDirty, setCoverDirty] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null)

  // Preview counts refresh whenever the include toggles change so the
  // author sees a live count of what's about to travel in the module.
  // In snapshot-source mode the snapshot is already filtered before it
  // reaches the modal, so we skip the live preview entirely and just
  // display the counts the caller passed in.
  useEffect(() => {
    if (isSnapshotSource || !campaignId) return
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
  }, [supabase, campaignId, includePins, includeNpcs, includeScenes, includeHandouts, isSnapshotSource])

  const nextVersion = isRepublish && existingModule?.latest_version
    ? bumpSemver(existingModule.latest_version.version, bumpKind)
    : '1.0.0'

  async function handlePublish() {
    if (!name.trim()) { setError('Name is required.'); return }
    setSubmitting(true)
    setError('')
    try {
      // Two source modes:
      //   • snapshot upload (initialSnapshot set) — use the pre-parsed
      //     ModuleSnapshot directly; campaignId is null since there's
      //     no source campaign in the DB.
      //   • live campaign — read fresh from the DB at publish time so
      //     any in-modal edits to the include-toggles take effect.
      let snapshotToPublish: ModuleSnapshot
      if (isSnapshotSource && initialSnapshot) {
        snapshotToPublish = initialSnapshot
      } else if (campaignId) {
        const result = await buildCampaignSnapshot(supabase, campaignId, {
          includePins, includeNpcs, includeScenes, includeHandouts,
        })
        snapshotToPublish = result.snapshot
      } else {
        throw new Error('No campaign and no snapshot — nothing to publish.')
      }
      const result = await publishModuleVersion(supabase, {
        campaignId,
        moduleId: existingModule?.id,
        name: name.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        parentSetting: existingModule?.parent_setting ?? 'custom',
        // Only include cover in the publish payload if the user
        // actually changed it this session. Untouched on re-publish =
        // leave the existing cover alone (undefined).
        coverImageUrl: coverDirty ? (coverUrl || null) : undefined,
        visibility,
        version: nextVersion,
        changelog: changelog.trim() || null,
        snapshot: snapshotToPublish,
      })
      onPublished({ ...result, version: nextVersion })
    } catch (e: any) {
      setError(e?.message ?? 'Publish failed')
      setSubmitting(false)
    }
  }

  // Cover image upload — same hardened cropper used for object
  // tokens (15 s encode timeout, 30 s upload timeout, error surfacing,
  // PNG-without-transparency falls back to JPEG, file input remounts
  // after each upload to avoid Safari's stale-selection bug).
  async function handleCoverCrop(blob: Blob, mimeType: string) {
    setCoverUploadError(null)
    setCoverUploading(true)
    try {
      const ext = mimeType === 'image/png' ? 'png' : 'jpg'
      const path = `${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString()}.${ext}`
      // 30s watchdog: supabase.storage.upload can hang indefinitely on
      // network drops; same Promise.race pattern as CampaignObjects.
      const uploadPromise = supabase.storage.from('module-covers').upload(path, blob, { contentType: mimeType })
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out after 30s.')), 30000)
      )
      const { error: upErr } = await Promise.race([uploadPromise, timeoutPromise]) as { error: any }
      if (upErr) throw new Error(upErr.message || 'Upload failed.')
      const { data: urlData } = supabase.storage.from('module-covers').getPublicUrl(path)
      setCoverUrl(urlData.publicUrl)
      setCoverDirty(true)
      setCoverFile(null)
    } catch (e: any) {
      setCoverUploadError(e?.message ?? 'Upload failed.')
    } finally {
      setCoverUploading(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────
  // Backdrop now via <ModalBackdrop> below.
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
    marginBottom: '6px', fontFamily: 'Carlito, sans-serif',
  }
  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif',
    boxSizing: 'border-box',
  }

  return (
    <ModalBackdrop onClose={onClose} zIndex={Z_INDEX.modal} opacity={0.75} padding="20px">
      <div style={panel}>

        <div style={header}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c4a7f0' }}>
            📦 {isRepublish ? `Publish New Version — ${existingModule!.name}` : isSnapshotSource ? 'Publish from Snapshot' : 'Publish as Module'}
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

          {/* Cover image — shown on /modules cards + the detail page hero. */}
          <div>
            <label style={lbl}>Cover image <span style={{ color: '#cce0f5', fontWeight: 400 }}>(optional)</span></label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '120px', height: '70px', flexShrink: 0,
                background: coverUrl ? `url(${coverUrl}) center/cover` : 'linear-gradient(135deg, #1a1a1a 0%, #2a1a3e 100%)',
                border: `1px solid ${coverUrl ? '#5a2e5a' : '#3a3a3a'}`,
                borderRadius: '3px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', color: '#5a5550',
              }}>
                {!coverUrl && '📦'}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'inline-block', padding: '6px 10px', background: '#242424', border: '1px dashed #3a3a3a', borderRadius: '3px', color: coverUploading ? '#5a5550' : '#c4a7f0', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', cursor: coverUploading ? 'wait' : 'pointer' }}>
                  {coverUploading ? 'Uploading…' : coverUrl ? 'Replace cover' : '+ Upload cover'}
                  <input type="file" accept="image/*" hidden disabled={coverUploading} onChange={e => { const f = e.target.files?.[0]; if (f) setCoverFile(f); e.target.value = '' }} />
                </label>
                {coverUrl && !coverUploading && (
                  <button onClick={() => { setCoverUrl(null); setCoverDirty(true) }}
                    style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    × Remove
                  </button>
                )}
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                  Shown on the marketplace card + module detail hero. Leave blank for a placeholder gradient.
                </div>
                {coverUploadError && (
                  <div style={{ fontSize: '13px', color: '#f5a89a', padding: '6px 8px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px' }}>
                    {coverUploadError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label style={lbl}>Visibility</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['private', 'unlisted', 'listed'] as const).map(v => (
                <button key={v} type="button" onClick={() => setVisibility(v)}
                  style={{ flex: 1, padding: '8px', border: `1px solid ${visibility === v ? '#8b5cf6' : '#3a3a3a'}`, background: visibility === v ? '#2a1a3e' : '#242424', borderRadius: '3px', color: visibility === v ? '#c4a7f0' : '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {v === 'private' && '🔒 Private'}
                  {v === 'unlisted' && '🔗 Unlisted'}
                  {v === 'listed' && '🌐 Listed'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
              {visibility === 'private' && 'Only you can pick this module when creating a campaign.'}
              {visibility === 'unlisted' && 'Anyone with the module link can subscribe, but it doesn\'t appear in any marketplace.'}
              {visibility === 'listed' && 'Will appear in the public marketplace after Thriver approval.'}
            </div>
          </div>

          {/* Content section — live campaign shows include toggles
              (so the author can exclude pins/scenes/etc.); snapshot
              source shows a read-only summary since the file is already
              filtered before it reaches the modal. */}
          {isSnapshotSource ? (
            <div>
              <label style={lbl}>From snapshot file</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                  📍 Pins<span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Carlito, sans-serif' }}>{counts?.pins ?? 0}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                  🧑 NPCs<span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Carlito, sans-serif' }}>{counts?.npcs ?? 0}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                  🗺 Tactical scenes<span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Carlito, sans-serif' }}>{counts ? `${counts.scenes} / ${counts.tokens} tokens` : '0'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif' }}>
                  📄 Handouts<span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Carlito, sans-serif' }}>{counts?.handouts ?? 0}</span>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em' }}>
                Snapshot file pre-parsed; PC tokens and live state already filtered out.
              </div>
            </div>
          ) : (
            <div>
              <label style={lbl}>Include in snapshot</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#111', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '10px 12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>
                  <input type="checkbox" checked={includePins} onChange={e => setIncludePins(e.target.checked)} />
                  📍 Pins{counts !== null && <span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Carlito, sans-serif' }}>{includePins ? counts.pins : 0}</span>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>
                  <input type="checkbox" checked={includeNpcs} onChange={e => setIncludeNpcs(e.target.checked)} />
                  🧑 NPCs{counts !== null && <span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Carlito, sans-serif' }}>{includeNpcs ? counts.npcs : 0}</span>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>
                  <input type="checkbox" checked={includeScenes} onChange={e => setIncludeScenes(e.target.checked)} />
                  🗺 Tactical scenes{counts !== null && <span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Carlito, sans-serif' }}>{includeScenes ? `${counts.scenes} / ${counts.tokens} tokens` : 0}</span>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d4cfc9', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>
                  <input type="checkbox" checked={includeHandouts} onChange={e => setIncludeHandouts(e.target.checked)} />
                  📄 Handouts{counts !== null && <span style={{ color: '#cce0f5', marginLeft: 'auto', fontFamily: 'Carlito, sans-serif' }}>{includeHandouts ? counts.handouts : 0}</span>}
                </label>
              </div>
              {previewing && <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '6px', fontFamily: 'Carlito, sans-serif' }}>Reading campaign…</div>}
            </div>
          )}

          {/* Semver bump (re-publish only) */}
          {isRepublish && existingModule?.latest_version && (
            <div>
              <label style={lbl}>Version bump <span style={{ color: '#cce0f5', fontWeight: 400 }}>(current v{existingModule.latest_version.version})</span></label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['patch', 'minor', 'major'] as const).map(k => (
                  <button key={k} type="button" onClick={() => setBumpKind(k)}
                    style={{ flex: 1, padding: '8px', border: `1px solid ${bumpKind === k ? '#8b5cf6' : '#3a3a3a'}`, background: bumpKind === k ? '#2a1a3e' : '#242424', borderRadius: '3px', color: bumpKind === k ? '#c4a7f0' : '#d4cfc9', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
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
          <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            → Publishing v{nextVersion}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} disabled={submitting}
              style={{ padding: '8px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: submitting ? 'not-allowed' : 'pointer' }}>
              Cancel
            </button>
            <button onClick={handlePublish} disabled={submitting || !name.trim()}
              style={{ padding: '8px 18px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '14px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !name.trim() ? 0.4 : 1, fontWeight: 600 }}>
              {submitting ? 'Publishing…' : `📦 Publish v${nextVersion}`}
            </button>
          </div>
        </div>

      </div>

      {/* Cover crop modal — overlays on top of the publish wizard
          while the user is cropping. Cropper does the encoding +
          surfaces upload errors via uploadError. On confirm we get
          the blob and mime type, run handleCoverCrop, and clear
          coverFile so the cropper unmounts. */}
      {coverFile && (
        <ObjectImageCropper
          file={coverFile}
          onCancel={() => { setCoverFile(null); setCoverUploadError(null) }}
          onCrop={(blob, _preview, mimeType) => handleCoverCrop(blob, mimeType)}
          uploadError={coverUploadError}
          onClearError={() => setCoverUploadError(null)}
        />
      )}
    </ModalBackdrop>
  )
}
