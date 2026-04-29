'use client'
// /modules — Phase C marketplace browse page.
//
// Public-facing surface for discovering modules (the campaign-create
// picker shows the same data, but only at the moment of starting a new
// campaign). Visibility / approval filtering is enforced by RLS via
// listAvailableModules; this page is just presentation + filtering on
// the client.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { listAvailableModules, type ModuleListing } from '../../lib/modules'

const SETTING_LABELS: Record<string, string> = {
  custom: 'Custom',
  mongrels: 'Mongrels',
  chased: 'Chased',
  district_zero: 'District Zero',
  arena: 'The Arena',
  empty: 'Empty',
}

export default function ModuleMarketplacePage() {
  const supabase = createClient()
  const [modules, setModules] = useState<ModuleListing[] | null>(null)
  const [loadError, setLoadError] = useState<string>('')
  const [search, setSearch] = useState('')
  const [settingFilter, setSettingFilter] = useState<string>('')
  // Thriver-only DELETE on each module card. Resolved once on mount.
  // RLS on `modules` already gates DELETE to author OR Thriver — UI
  // surface here matches that, hiding the button for everyone else
  // so it's not even visible.
  const [isThriver, setIsThriver] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    listAvailableModules(supabase)
      .then(setModules)
      .catch((e: any) => { setLoadError(e?.message ?? 'Failed to load modules.'); setModules([]) })
  }, [supabase])

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const role = (data?.role ?? '').toLowerCase()
      if (role === 'thriver') setIsThriver(true)
    })()
  }, [supabase])

  async function handleDelete(m: ModuleListing) {
    // Pre-fetch counts for an honest confirm. Don't block on errors —
    // fall back to a generic confirm if either count fails.
    const [{ count: versionCount }, { count: subCount }] = await Promise.all([
      supabase.from('module_versions').select('*', { count: 'exact', head: true }).eq('module_id', m.id),
      supabase.from('module_subscriptions').select('*', { count: 'exact', head: true }).eq('module_id', m.id),
    ])
    const v = versionCount ?? 0
    const s = subCount ?? 0
    const lines = [
      `Permanently delete "${m.name}"?`,
      '',
      `This will hard-delete:`,
      `  • the module`,
      `  • ${v} version${v === 1 ? '' : 's'}`,
      `  • ${s} subscription record${s === 1 ? '' : 's'}`,
      '',
      s > 0
        ? `Subscribed campaigns lose update notifications, but their cloned content (NPCs / pins / scenes / handouts that came from this module) stays. They just stop getting "New version available" pings.`
        : 'No campaigns currently subscribe.',
      '',
      'This cannot be undone.',
    ]
    if (!confirm(lines.join('\n'))) return
    setDeletingId(m.id)
    const { error } = await supabase.from('modules').delete().eq('id', m.id)
    setDeletingId(null)
    if (error) {
      alert(`Delete failed: ${error.message}`)
      return
    }
    // Optimistic local removal — don't refetch the whole list.
    setModules(prev => prev ? prev.filter(x => x.id !== m.id) : prev)
  }

  // Only show approved listings + the user's own modules. listAvailableModules
  // already filters to non-archived modules with at least one published version.
  const filtered = useMemo(() => {
    if (!modules) return null
    const q = search.trim().toLowerCase()
    return modules.filter(m => {
      if (settingFilter && (m.parent_setting ?? 'custom') !== settingFilter) return false
      if (!q) return true
      return (
        (m.name ?? '').toLowerCase().includes(q) ||
        (m.tagline ?? '').toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [modules, search, settingFilter])

  // Distinct setting values present in the loaded module set, for the
  // filter dropdown. Always include "All" + every option that has at
  // least one module.
  const availableSettings = useMemo(() => {
    if (!modules) return []
    const set = new Set<string>()
    for (const m of modules) set.add(m.parent_setting ?? 'custom')
    return Array.from(set).sort()
  }, [modules])

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px', color: '#d4cfc9' }}>
      <div style={{ marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', color: '#c4a7f0', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>
        Module System
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <h1 style={{ margin: 0, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          Module Marketplace
        </h1>
        {/* Inbound import path — once a GM has a campaign-snapshot
            export, /modules/import publishes it as a module. Linked
            from here so users who land on the marketplace directly
            don't have to hunt for it in the sidebar. */}
        <Link href="/modules/import" style={{ textDecoration: 'none' }}>
          <button style={{ padding: '9px 16px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📂 Import from snapshot
          </button>
        </Link>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '15px', lineHeight: 1.6, color: '#cce0f5', maxWidth: '720px' }}>
        Adventures, sandboxes, and one-shots authored by GMs and shipped as one-click installs. Pick one when you create a campaign and your table seeds with NPCs, scenes, pins, and handouts already in place.
      </p>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search modules…"
          style={{ flex: '1 1 240px', padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }}
        />
        <select
          value={settingFilter}
          onChange={e => setSettingFilter(e.target.value)}
          style={{ padding: '8px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none', cursor: 'pointer' }}
        >
          <option value="">All settings</option>
          {availableSettings.map(s => (
            <option key={s} value={s}>{SETTING_LABELS[s] ?? s}</option>
          ))}
        </select>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginLeft: 'auto' }}>
          {filtered ? `${filtered.length} module${filtered.length === 1 ? '' : 's'}` : '…'}
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '10px 14px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', marginBottom: '16px' }}>
          {loadError}
        </div>
      )}

      {modules === null ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#5a5550', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Loading modules…
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: '#1a1a1a', border: '1px dashed #3a3a3a', borderRadius: '4px' }}>
          <div style={{ fontSize: '14px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
            {search || settingFilter ? 'No modules match those filters' : 'No modules yet'}
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>
            {search || settingFilter
              ? 'Clear the filters to see all available modules.'
              : <>Be the first to publish — open any campaign\'s edit page and click <strong>Publish as Module</strong>, or upload an exported snapshot at <Link href="/modules/import" style={{ color: '#c4a7f0' }}>/modules/import</Link>.</>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filtered!.map(m => (
            <ModuleCard
              key={m.id}
              module={m}
              canDelete={isThriver}
              deleting={deletingId === m.id}
              onDelete={() => handleDelete(m)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ModuleCard({ module: m, canDelete, deleting, onDelete }: { module: ModuleListing; canDelete: boolean; deleting: boolean; onDelete: () => void }) {
  const settingLabel = SETTING_LABELS[m.parent_setting ?? 'custom'] ?? m.parent_setting
  const version = m.latest_version?.version
  const publishedAt = m.latest_version?.published_at

  return (
    <Link href={`/modules/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #2e2e2e',
          borderLeft: '3px solid #8b5cf6',
          borderRadius: '4px',
          overflow: 'hidden',
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 200ms, transform 200ms',
          position: 'relative',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#5a2e5a' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e' }}
      >
        {/* Thriver-only DELETE — top-right corner. preventDefault on the
            click stops the wrapping <Link> from navigating; stopPropagation
            keeps the delete confirm from also being treated as a card-open. */}
        {canDelete && (
          <button
            disabled={deleting}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete() }}
            title="Thriver: delete module + all versions + subscriptions"
            style={{
              position: 'absolute', top: '6px', right: '6px', zIndex: 2,
              padding: '3px 9px',
              background: 'rgba(0, 0, 0, 0.7)',
              border: '1px solid #c0392b',
              borderRadius: '3px',
              color: '#f5a89a',
              fontSize: '13px',
              fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              cursor: deleting ? 'wait' : 'pointer',
              opacity: deleting ? 0.5 : 1,
            }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        {/* Cover image, or gradient placeholder */}
        <div style={{
          height: '140px',
          background: m.cover_image_url
            ? `url(${m.cover_image_url}) center/cover`
            : 'linear-gradient(135deg, #1a1a1a 0%, #2a1a3e 100%)',
          borderBottom: '1px solid #2e2e2e',
          display: 'flex', alignItems: 'flex-end', padding: '8px',
        }}>
          {!m.cover_image_url && (
            <div style={{ fontSize: '36px', opacity: 0.4 }}>📦</div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px', flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1.2 }}>
              {m.name}
            </div>
            {version && (
              <div style={{ fontSize: '13px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', flexShrink: 0 }}>
                v{version}
              </div>
            )}
          </div>

          {m.tagline && (
            <div style={{ fontSize: '14px', color: '#d4cfc9', fontFamily: 'Barlow, sans-serif', lineHeight: 1.4 }}>
              {m.tagline}
            </div>
          )}

          {/* Setting badge + visibility */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: 'auto', paddingTop: '6px' }}>
            {settingLabel && (
              <span style={{ padding: '2px 8px', background: '#2a1a3e', border: '1px solid #5a2e5a', borderRadius: '3px', fontSize: '13px', color: '#c4a7f0', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {settingLabel}
              </span>
            )}
            {m.visibility === 'unlisted' && (
              <span style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                🔗 Unlisted
              </span>
            )}
            {m.visibility === 'private' && (
              <span style={{ padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                🔒 Private
              </span>
            )}
            {publishedAt && (
              <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>
                {new Date(publishedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
