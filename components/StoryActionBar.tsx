'use client'
// StoryActionBar — the single, canonical action bar shown at the top of
// every campaign page (hub + Edit + Snapshots + Sessions + Community).
// Replaces both the inline 7-button cluster that used to live in
// /stories/[id]/page.tsx AND the older <StoryToolsNav> sub-page nav.
//
// Per the 2026-04-29 directive — "when clicking any of these buttons,
// this top bar should always look the same." Single component =
// guaranteed visual + behavioral consistency.
//
// Buttons (in order):
//   LAUNCH · EDIT · SHARE · GM KIT · SNAPSHOT · PUBLISH · DELETE
//
// The component is self-sufficient: given just a campaignId, it
// loads everything it needs (campaign row for name/invite code/GM,
// the existing module for the Publish-vs-Update label) and owns its
// own modals (ModulePublishModal, the Delete confirm, the GM Kit
// export progress state).
//
// Active-page highlighting is driven by usePathname() so on the Edit
// sub-page the EDIT button gets a brighter border + bold weight, and
// the user always knows where they are.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { exportGmKit } from '../lib/gm-kit'
import { getModuleForCampaign, archiveModule, type ModuleForCampaign } from '../lib/modules'
import ModulePublishModal from './ModulePublishModal'

interface CampaignLite {
  id: string
  name: string
  description: string
  invite_code: string
  gm_user_id: string
}

interface Props {
  campaignId: string
}

export default function StoryActionBar({ campaignId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname() ?? ''

  const [campaign, setCampaign] = useState<CampaignLite | null>(null)
  const [isGM, setIsGM] = useState(false)
  const [existingModule, setExistingModule] = useState<ModuleForCampaign | null>(null)
  // Subscriber-side update notice — separate from existingModule
  // (which is "this campaign IS a module's source"). moduleUpdate is
  // "this campaign was subscribed to a module that the author has
  // since pushed a newer version of." Renders as a button on the bar
  // that routes to the version diff page.
  const [moduleUpdate, setModuleUpdate] = useState<{
    moduleId: string
    moduleName: string
    currentVersion: string
    latestVersion: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)

  // Active-page highlight. The hub matches when there's no sub-segment
  // after the id (so /stories/<id> exactly).
  const onSubpath = (suffix: string) => pathname.endsWith(suffix)
  const onHub = pathname === `/stories/${campaignId}`

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { user } = await getCachedAuth()
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, description, invite_code, gm_user_id')
        .eq('id', campaignId)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setCampaign(data as CampaignLite)
        setIsGM(!!user && (data as any).gm_user_id === user.id)
      }
      // Module lookup only matters for the GM (Publish/Archive labels).
      if (user && data && (data as any).gm_user_id === user.id) {
        const mod = await getModuleForCampaign(supabase, campaignId)
        if (!cancelled) setExistingModule(mod)

        // Subscriber-side update check — surface the first outdated
        // module subscription. Mirrors the pattern that used to live
        // on /stories/[id]/page.tsx so the bar carries the notice on
        // every page, not just the hub.
        const { data: subs } = await supabase
          .from('module_subscriptions')
          .select('module_id, current_version_id, module:modules(name, latest_version_id)')
          .eq('campaign_id', campaignId)
          .eq('status', 'active')
        for (const sub of (subs ?? []) as any[]) {
          const modRow = Array.isArray(sub.module) ? sub.module[0] : sub.module
          const latestId = modRow?.latest_version_id
          if (latestId && latestId !== sub.current_version_id) {
            const { data: vs } = await supabase
              .from('module_versions')
              .select('id, version')
              .in('id', [sub.current_version_id, latestId].filter(Boolean))
            const vMap = new Map<string, string>((vs ?? []).map((v: any) => [v.id, v.version]))
            if (!cancelled) {
              setModuleUpdate({
                moduleId: sub.module_id,
                moduleName: modRow?.name ?? 'Module',
                currentVersion: vMap.get(sub.current_version_id) ?? '?',
                latestVersion: vMap.get(latestId) ?? '?',
              })
            }
            break  // only surface the first outdated module
          }
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [campaignId])

  function copyInviteLink() {
    if (!campaign) return
    const link = `${window.location.origin}/join/${campaign.invite_code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExportKit() {
    if (!campaign || exporting) return
    setExporting(true)
    const result = await exportGmKit(supabase, campaignId)
    setExporting(false)
    if (!result.ok) alert(`GM Kit export failed: ${result.error ?? 'unknown error'}`)
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this story? This cannot be undone.')) return
    await supabase.from('campaigns').delete().eq('id', campaignId)
    router.push('/stories')
  }

  async function handleArchiveModule() {
    if (!existingModule) return
    const isListed = existingModule.visibility === 'listed'
    const msg = isListed
      ? `Archive "${existingModule.name}"? It will be hidden from the marketplace and no one new can subscribe. All subscriber campaigns keep their content. This cannot be undone from this page.`
      : `Archive "${existingModule.name}"? It will no longer appear when others create campaigns. All subscriber content is untouched.`
    if (!confirm(msg)) return
    try {
      const { count } = await supabase
        .from('module_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('module_id', existingModule.id)
        .eq('status', 'active')
      const subCount = count ?? 0
      let hardDelete = false
      if (subCount === 0 && !isListed) {
        hardDelete = confirm('No one has subscribed yet. Permanently delete the module entirely, or just archive it?\n\nOK = Delete permanently\nCancel = Archive (keeps version history)')
      }
      await archiveModule(supabase, existingModule.id, hardDelete)
      setExistingModule(null)
      alert(hardDelete ? '📦 Module deleted.' : '📦 Module archived. Subscribers have been notified.')
    } catch (e: any) {
      alert(`Archive failed: ${e?.message ?? 'unknown error'}`)
    }
  }

  // Render nothing until the campaign loads — avoids a flash of an
  // empty-state bar. The hub page renders its title above; if this
  // bar is briefly absent on a hard reload it's hardly noticed.
  if (!campaign) return null

  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '1.25rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Player view = a slimmer surface (Launch + Share only). The
          GM-only actions just don't render. */}
      <a href={`/stories/${campaignId}/table`} target="_blank" rel="noreferrer"
        style={btn('#c0392b', '#fff', '#c0392b', false)}>
        Launch
      </a>
      {isGM && (
        <Link href={`/stories/${campaignId}/edit`} style={btn('#242424', '#f5f2ee', '#3a3a3a', onSubpath('/edit'))}>
          Edit
        </Link>
      )}
      <button onClick={copyInviteLink} style={btn('#1a3a5c', '#7ab3d4', '#7ab3d4', false) as any}>
        {copied ? 'Copied!' : 'Share'}
      </button>
      {isGM && (
        <button onClick={handleExportKit} disabled={exporting}
          title="Download every pin, NPC, scene, token, handout (with images) as a portable .zip"
          style={{ ...btn('#1a2e10', '#7fc458', '#2d5a1b', false), opacity: exporting ? 0.6 : 1 } as any}>
          {exporting ? 'Packaging…' : 'GM Kit'}
        </button>
      )}
      {isGM && (
        <Link href={`/stories/${campaignId}/snapshots`} style={btn('#2a2010', '#EF9F27', '#5a4a1b', onSubpath('/snapshots'))}>
          Snapshot
        </Link>
      )}
      {isGM && (!existingModule || !existingModule.archived_at) && (
        <button onClick={() => setPublishOpen(true)}
          title={existingModule
            ? `Publish a new version of "${existingModule.name}" (current v${existingModule.latest_version?.version ?? '1.0.0'})`
            : 'Publish this campaign as a reusable module other GMs can subscribe to'}
          style={btn('#2a1a3e', '#c4a7f0', '#5a2e5a', false) as any}>
          {existingModule ? `Module v${existingModule.latest_version?.version ?? '1.0.0'}` : 'Publish'}
        </button>
      )}
      {isGM && existingModule?.archived_at && (
        <span style={{ padding: '6px 12px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>
          Archived
        </span>
      )}
      {isGM && existingModule && !existingModule.archived_at && (
        <button onClick={handleArchiveModule}
          title="Archive this module — removes it from the marketplace, notifies subscribers"
          style={btn('#1a1a1a', '#5a5550', '#3a3a3a', false) as any}>
          Archive
        </button>
      )}
      {isGM && moduleUpdate && (
        <Link href={`/stories/${campaignId}/modules/${moduleUpdate.moduleId}/versions`}
          title={`"${moduleUpdate.moduleName}" has a newer version. You're on v${moduleUpdate.currentVersion}; latest is v${moduleUpdate.latestVersion}. Click to see what changed.`}
          style={{ ...btn('#2a1a3e', '#c4a7f0', '#8b5cf6', false), fontWeight: 700, textDecoration: 'none' } as any}>
          📦 v{moduleUpdate.latestVersion} ↑
        </Link>
      )}
      {isGM && (
        <button onClick={handleDelete} style={btn('#7a1f16', '#f5a89a', '#7a1f16', false) as any}>
          Delete
        </button>
      )}

      {/* Publish modal — owned by the bar so it's reachable from any
          page that mounts the bar. Refreshes existingModule on success
          so the button re-labels with the new version number. */}
      {isGM && publishOpen && (
        <ModulePublishModal
          supabase={supabase}
          campaignId={campaignId}
          campaignName={campaign.name}
          campaignDescription={campaign.description}
          existingModule={existingModule}
          onClose={() => setPublishOpen(false)}
          onPublished={async ({ version }) => {
            setPublishOpen(false)
            const refreshed = await getModuleForCampaign(supabase, campaignId)
            setExistingModule(refreshed)
            alert(`📦 Published v${version}. Other GMs can now pick this module when creating a campaign.`)
          }}
        />
      )}
    </div>
  )
}

// Same shape as the hub's btn() helper, with an active flag for
// sub-page highlighting (brighter border, bold weight, faint inset
// glow so the active button reads as "you are here").
function btn(bg: string, color: string, border: string, active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', background: bg, border: `1px solid ${active ? color : border}`,
    borderRadius: '3px', color, fontSize: '13px',
    fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    whiteSpace: 'nowrap', lineHeight: 1,
    fontWeight: active ? 700 : 400,
    boxShadow: active ? `0 0 0 1px ${color} inset` : undefined,
  }
}
