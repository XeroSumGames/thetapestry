'use client'
// /modules/import — second entry point into the module-publish flow.
//
// The first entry point is from a campaign edit page ("Publish as
// Module" → opens ModulePublishModal with the live campaign as the
// source). This page lets a GM publish a module from an exported
// campaign-snapshot JSON file instead. Same modal, same downstream
// pipeline; only the snapshot source differs.
//
// Used to migrate The Arena out of the paused GM Kit v1 seed-table
// pipeline and into the canonical module system, but doubles as a
// permanent tool — any GM with a snapshot they exported can publish a
// module from it.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase-browser'
import { snapshotToModuleSnapshot, looksLikeCampaignSnapshot } from '../../../lib/snapshot-to-module'
import type { ModuleSnapshot, SnapshotCounts } from '../../../lib/modules'
import ModulePublishModal from '../../../components/ModulePublishModal'

interface ParsedSnapshot {
  fileName: string
  snapshot: ModuleSnapshot
  counts: SnapshotCounts
  capturedAt: string | null
  sourceCampaignId: string | null
}

export default function ImportSnapshotPage() {
  const supabase = createClient()
  const router = useRouter()

  const [parsed, setParsed] = useState<ParsedSnapshot | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState<string>('')
  const [parsing, setParsing] = useState(false)
  const [published, setPublished] = useState<{ moduleId: string; versionId: string; version: string } | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''  // allow re-pick of the same file later
    if (!f) return
    setError('')
    setParsing(true)
    try {
      const text = await f.text()
      let json: any
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error('That file isn\'t valid JSON. Did you pick the right export?')
      }
      if (!looksLikeCampaignSnapshot(json)) {
        throw new Error('That JSON doesn\'t look like a campaign snapshot — expected top-level npcs/pins/scenes arrays.')
      }
      const { snapshot, counts } = snapshotToModuleSnapshot(json)
      setParsed({
        fileName: f.name,
        snapshot,
        counts,
        capturedAt: typeof json.captured_at === 'string' ? json.captured_at : null,
        sourceCampaignId: typeof json.campaign_id === 'string' ? json.campaign_id : null,
      })
    } catch (err: any) {
      setError(err?.message ?? 'Could not read snapshot file.')
      setParsed(null)
    } finally {
      setParsing(false)
    }
  }

  function defaultModuleNameFromFile(fileName: string): string {
    // "arena-final-export.tapestry-snapshot.json" → "Arena Final Export"
    return fileName
      .replace(/\.tapestry-snapshot\.json$/i, '')
      .replace(/\.json$/i, '')
      .split(/[-_\s]+/)
      .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '')
      .join(' ')
      .trim() || 'New Module'
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 20px', color: '#d4cfc9' }}>

      <div style={{ marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', color: '#c4a7f0', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>
        Module System
      </div>
      <h1 style={{ margin: '0 0 8px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
        Publish from Snapshot
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '15px', lineHeight: 1.6, color: '#cce0f5', maxWidth: '620px' }}>
        Upload a campaign-snapshot JSON file (the export format produced by the snapshots panel on a campaign's edit page) and publish it as a module — same flow as &ldquo;Publish as Module&rdquo; from a live campaign, but sourced from the file instead of the database.
      </p>

      <label style={{ display: 'block', padding: '20px', background: parsed ? '#1a2e10' : '#1a1a1a', border: `2px dashed ${parsed ? '#2d5a1b' : '#5a2e5a'}`, borderRadius: '4px', textAlign: 'center', cursor: 'pointer', marginBottom: '12px', transition: 'background 200ms' }}>
        <div style={{ fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', color: parsed ? '#7fc458' : '#c4a7f0', fontWeight: 600 }}>
          {parsing ? 'Reading…' : parsed ? `✓ ${parsed.fileName}` : '📂 Pick a .tapestry-snapshot.json file'}
        </div>
        {parsed && (
          <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '8px', fontFamily: 'Barlow Condensed, sans-serif' }}>
            {parsed.counts.npcs} NPCs · {parsed.counts.pins} pins · {parsed.counts.scenes} scenes ({parsed.counts.tokens} tokens) · {parsed.counts.handouts} handouts
            {parsed.capturedAt && <> · captured {new Date(parsed.capturedAt).toLocaleString()}</>}
          </div>
        )}
        <input type="file" accept=".json,application/json" hidden onChange={handleFile} />
      </label>

      {error && (
        <div style={{ padding: '10px 14px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow, sans-serif', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ padding: '9px 16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
          ← Back to dashboard
        </button>
        <button onClick={() => parsed && setShowModal(true)} disabled={!parsed}
          style={{ padding: '9px 18px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: parsed ? 'pointer' : 'not-allowed', opacity: parsed ? 1 : 0.4, fontWeight: 600 }}>
          📦 Continue to publish wizard
        </button>
      </div>

      {published && (
        <div style={{ marginTop: '16px', padding: '14px 16px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '4px' }}>
          <div style={{ fontSize: '14px', color: '#7fc458', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
            ✓ Module published — v{published.version}
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginBottom: '10px' }}>
            The module is live and (if you set visibility to Listed) queued for Thriver review. It will appear in the Module picker on campaign creation as soon as it's approved.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setPublished(null); setParsed(null) }}
              style={{ padding: '7px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              📂 Import another snapshot
            </button>
            <button onClick={() => router.push('/dashboard')}
              style={{ padding: '7px 14px', background: '#1a3a5c', border: '1px solid #7ab3d4', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              ← Back to dashboard
            </button>
          </div>
          <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em' }}>
            module id: <code style={{ color: '#cce0f5' }}>{published.moduleId}</code>
          </div>
        </div>
      )}

      {showModal && parsed && (
        <ModulePublishModal
          supabase={supabase}
          campaignId={null}
          campaignName={defaultModuleNameFromFile(parsed.fileName)}
          existingModule={null}
          initialSnapshot={parsed.snapshot}
          initialCounts={parsed.counts}
          onClose={() => setShowModal(false)}
          onPublished={(result) => {
            setShowModal(false)
            setPublished(result)
          }}
        />
      )}
    </div>
  )
}
