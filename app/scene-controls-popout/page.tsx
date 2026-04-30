'use client'
// Popped-out tactical scene controls. Same buttons as the inline GM
// strip in TacticalMap.tsx, but in their own browser window so the GM
// can keep them on a second monitor and let the map fill its screen.
//
// State sync model:
//   • DB-backed scene fields (name, grid_cols, grid_rows, cell_feet,
//     background_url, is_locked) — written to Supabase; the main
//     window picks them up via its tactical_scenes realtime sub.
//     Snapshot to/from the popout via the same realtime sub on this
//     side.
//   • Local UI state (zoom, cellPx, showGrid, gridColor, gridOpacity,
//     showRangeOverlay, mapLocked-toggle UX) — synced via
//     BroadcastChannel through lib/scene-controls-bus.ts. Bidirectional;
//     the popout requests a snapshot on mount, the main window replies
//     with current values.
//   • View-fit commands (Fit to Map, Fit to Screen, Place Tokens) —
//     unidirectional cmd messages popout → main. They depend on
//     bgImageRef + containerRef which only exist in TacticalMap, so
//     the popout just signals intent.
//
// Route name ends in `-popout` so LayoutShell auto-hides the sidebar
// (per the FULL_WIDTH_PATTERN convention in AGENTS.md).

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { createSceneControlsBus, type SceneControlsBus } from '../../lib/scene-controls-bus'

interface Scene {
  id: string
  name: string
  grid_cols: number
  grid_rows: number
  cell_feet: number | null
  cell_px: number | null
  background_url: string | null
  is_locked: boolean
  campaign_id: string
}

export default function SceneControlsPopoutPage() {
  const supabase = createClient()
  const params = useSearchParams()
  const campaignId = params?.get('c') ?? ''

  const [scene, setScene] = useState<Scene | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  // In-app confirm state. Native confirm() in this popout truncates
  // its message because Chromium sizes the dialog from the parent
  // window width (~250px), so the prompt body ("Delete the map
  // image?") gets clipped behind a "thetapestry.distemperver…" header.
  // We render our own modal instead — no clipping, full control.
  const [confirming, setConfirming] = useState<null | 'map' | 'scene'>(null)
  // GM's library of background images across all their campaigns —
  // surfaced as a dropdown so they can re-skin the current scene with
  // a map they've already uploaded somewhere else.
  const [reusableMaps, setReusableMaps] = useState<{ key: string; label: string; url: string }[]>([])

  // Local UI state — mirror the keys that TacticalMap holds. Defaults
  // get overwritten by the snapshot the main window posts back in
  // response to our request_snapshot on mount.
  const [zoom, setZoom] = useState(1)
  const [cellPx, setCellPx] = useState(35)
  const [showGrid, setShowGrid] = useState(true)
  const [gridColor, setGridColor] = useState('white')
  const [gridOpacity, setGridOpacity] = useState(0.4)
  const [showRangeOverlay, setShowRangeOverlay] = useState(true)
  const [mapLocked, setMapLocked] = useState(false)

  const busRef = useRef<SceneControlsBus | null>(null)
  // Suppress one round-trip when we apply an inbound state — otherwise
  // we'd echo the change right back out and start a feedback loop.
  const suppressOutboundRef = useRef(false)
  // Tracks the last scene whose DB cell_px we hydrated into local
  // state. Without this guard, every realtime tactical_scenes UPDATE
  // (name change, lock toggle, our own debounced cell_px write) would
  // re-run load() and clobber the user's in-flight cellPx adjustment
  // with whatever's currently in the DB. Same pattern TacticalMap
  // uses (lastSyncedSceneIdRef there too) to keep DB sync scoped to
  // genuine scene-id changes.
  const lastSyncedSceneIdRef = useRef<string | null>(null)

  // Initial load: scenes + active scene.
  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('tactical_scenes')
        .select('*')
        .eq('campaign_id', campaignId)
      if (cancelled) return
      if (error) { setError(error.message); return }
      const allScenes = (data ?? []) as Scene[]
      setScenes(allScenes)
      const active = allScenes.find(s => (s as any).is_active) ?? allScenes[0] ?? null
      setScene(active)
      // Hydrate cellPx from the active scene's stored value, but ONLY
      // when the scene id actually changed. Suppress the persist
      // effect so this read doesn't immediately echo back as a write.
      if (active && active.id !== lastSyncedSceneIdRef.current) {
        lastSyncedSceneIdRef.current = active.id
        if (typeof active.cell_px === 'number' && active.cell_px > 0) {
          suppressOutboundRef.current = true
          setCellPx(active.cell_px)
          setTimeout(() => { suppressOutboundRef.current = false }, 0)
        }
      }
    }
    load()
    // Live: any tactical_scenes change refreshes our copy so DB writes
    // from the main window flow back here.
    const channel = supabase.channel(`tactical_popout_${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tactical_scenes', filter: `campaign_id=eq.${campaignId}` }, () => load())
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [supabase, campaignId])

  // Reuse-map library: any scene the GM has uploaded a background to,
  // across ALL their campaigns. Lets them re-skin the current scene
  // without re-uploading. De-duped by URL so a file used by N scenes
  // appears once.
  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    ;(async () => {
      const { user } = await getCachedAuth()
      if (!user) return
      const { data: gmCampaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('gm_user_id', user.id)
      if (cancelled || !gmCampaigns || gmCampaigns.length === 0) return
      const ids = (gmCampaigns as any[]).map(c => c.id)
      const { data: gmScenes } = await supabase
        .from('tactical_scenes')
        .select('id, name, campaign_id, background_url')
        .in('campaign_id', ids)
        .not('background_url', 'is', null)
      if (cancelled || !gmScenes) return
      const campaignName = new Map((gmCampaigns as any[]).map(c => [c.id, c.name]))
      const seen = new Set<string>()
      const items: { key: string; label: string; url: string }[] = []
      for (const s of gmScenes as any[]) {
        const url = s.background_url as string
        if (!url || seen.has(url)) continue
        seen.add(url)
        const cn = campaignName.get(s.campaign_id) ?? 'Untitled'
        items.push({ key: s.id, url, label: `${cn} → ${s.name}` })
      }
      // Stable alpha sort so the list is predictable run-to-run.
      items.sort((a, b) => a.label.localeCompare(b.label))
      setReusableMaps(items)
    })()
    return () => { cancelled = true }
  }, [supabase, campaignId])

  // Bus setup — listen for state echoes + snapshots, request a snapshot
  // on mount to populate our local state from the main window.
  useEffect(() => {
    if (!campaignId) return
    const bus = createSceneControlsBus(campaignId)
    if (!bus) return
    busRef.current = bus

    const offState = bus.onState((key, value) => {
      // Apply inbound without re-broadcasting (avoid feedback loop).
      suppressOutboundRef.current = true
      try {
        switch (key) {
          case 'zoom':              setZoom(value); break
          case 'cellPx':            setCellPx(value); break
          case 'showGrid':          setShowGrid(value); break
          case 'gridColor':         setGridColor(value); break
          case 'gridOpacity':       setGridOpacity(value); break
          case 'showRangeOverlay':  setShowRangeOverlay(value); break
          case 'mapLocked':         setMapLocked(value); break
        }
      } finally {
        // Restore on next tick so the upcoming useEffect outbound
        // broadcasters see the suppression flag still set during
        // their first run after this state change.
        setTimeout(() => { suppressOutboundRef.current = false }, 0)
      }
    })

    const offSnapshot = bus.onSnapshot(state => {
      suppressOutboundRef.current = true
      try {
        if (typeof state.zoom === 'number') setZoom(state.zoom)
        if (typeof state.cellPx === 'number') setCellPx(state.cellPx)
        if (typeof state.showGrid === 'boolean') setShowGrid(state.showGrid)
        if (typeof state.gridColor === 'string') setGridColor(state.gridColor)
        if (typeof state.gridOpacity === 'number') setGridOpacity(state.gridOpacity)
        if (typeof state.showRangeOverlay === 'boolean') setShowRangeOverlay(state.showRangeOverlay)
        if (typeof state.mapLocked === 'boolean') setMapLocked(state.mapLocked)
      } finally {
        setTimeout(() => { suppressOutboundRef.current = false }, 0)
      }
    })

    bus.requestSnapshot()
    return () => { offState(); offSnapshot(); bus.close(); busRef.current = null }
  }, [campaignId])

  // Outbound broadcasters — fire when local state changes due to a
  // user-driven setX in the popout. The suppression flag prevents
  // echoes when state was set by an inbound bus message.
  useEffect(() => { if (!suppressOutboundRef.current) busRef.current?.postState('zoom', zoom) }, [zoom])
  useEffect(() => { if (!suppressOutboundRef.current) busRef.current?.postState('cellPx', cellPx) }, [cellPx])
  useEffect(() => { if (!suppressOutboundRef.current) busRef.current?.postState('showGrid', showGrid) }, [showGrid])
  useEffect(() => { if (!suppressOutboundRef.current) busRef.current?.postState('gridColor', gridColor) }, [gridColor])
  useEffect(() => { if (!suppressOutboundRef.current) busRef.current?.postState('gridOpacity', gridOpacity) }, [gridOpacity])
  useEffect(() => { if (!suppressOutboundRef.current) busRef.current?.postState('showRangeOverlay', showRangeOverlay) }, [showRangeOverlay])
  useEffect(() => { if (!suppressOutboundRef.current) busRef.current?.postState('mapLocked', mapLocked) }, [mapLocked])

  // Persist cellPx to tactical_scenes.cell_px so it survives reload.
  // Without this the popout + TacticalMap stay in sync over the bus
  // for the lifetime of the session, but when either window remounts
  // they rehydrate from DB which is still the old value (default 35).
  // Debounced because the stepper fires each click; we don't want a
  // DB write per +/-. Skip writes triggered by inbound bus messages
  // (suppressOutboundRef) so applying a remote update doesn't echo
  // back as a redundant DB write.
  const cellPxPersistRef = useRef<any>(null)
  useEffect(() => {
    if (suppressOutboundRef.current) return
    if (!scene) return
    if (cellPxPersistRef.current) clearTimeout(cellPxPersistRef.current)
    const sceneId = scene.id
    const value = cellPx
    cellPxPersistRef.current = setTimeout(() => {
      supabase.from('tactical_scenes').update({ cell_px: value }).eq('id', sceneId)
    }, 400)
    return () => { if (cellPxPersistRef.current) clearTimeout(cellPxPersistRef.current) }
  }, [cellPx, scene?.id, supabase])

  // Helpers — mirror TacticalMap's onClick handlers but operate directly
  // on supabase / local state. The main window will see DB updates via
  // its existing tactical_scenes realtime sub.
  async function uploadBackground(file: File) {
    if (!scene) return
    setUploading(true)
    const path = `${campaignId}/${scene.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
    const { error: uErr } = await supabase.storage.from('tactical-maps').upload(path, file, { upsert: true })
    if (uErr) { setError('Upload failed: ' + uErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('tactical-maps').getPublicUrl(path)
    const { error: updErr } = await supabase.from('tactical_scenes').update({ background_url: urlData.publicUrl }).eq('id', scene.id)
    if (updErr) { setError('Save failed: ' + updErr.message); setUploading(false); return }
    setUploading(false)
  }

  async function updateSceneField(field: keyof Scene, value: any) {
    if (!scene) return
    setScene(prev => prev ? { ...prev, [field]: value } : prev)
    await supabase.from('tactical_scenes').update({ [field]: value }).eq('id', scene.id)
  }

  async function activateScene(id: string) {
    await supabase.from('tactical_scenes').update({ is_active: false }).eq('campaign_id', campaignId)
    await supabase.from('tactical_scenes').update({ is_active: true }).eq('id', id)
    busRef.current?.postCommand('fit_to_screen')  // tell main window to re-fit on the new scene
  }

  async function toggleLock() {
    if (!scene) return
    const newLocked = !mapLocked
    setMapLocked(newLocked)
    await supabase.from('tactical_scenes').update({ is_locked: newLocked }).eq('id', scene.id)
    setScene(prev => prev ? { ...prev, is_locked: newLocked } : prev)
  }

  async function performDeleteMap() {
    if (!scene) return
    await supabase.from('tactical_scenes').update({ background_url: null }).eq('id', scene.id)
    setScene(prev => prev ? { ...prev, background_url: null } : prev)
  }

  async function performDeleteScene() {
    if (!scene) return
    await supabase.from('scene_tokens').delete().eq('scene_id', scene.id)
    await supabase.from('tactical_scenes').delete().eq('id', scene.id)
    setScene(null)
  }

  // Loading / empty states
  if (!campaignId) {
    return <div style={fullPage}>Missing <code>?c=&lt;campaign-id&gt;</code> param.</div>
  }
  if (error) {
    return <div style={fullPage}>{error}</div>
  }
  if (!scene) {
    return <div style={fullPage}>{scenes.length === 0 ? 'No scenes in this campaign.' : 'Loading…'}</div>
  }

  // ── Panel ────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#0d0d0d', height: '100vh', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'auto', boxSizing: 'border-box' }}>

      <select value={scene.id} onChange={e => activateScene(e.target.value)}
        style={{ padding: '4px 8px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', width: '100%', height: '28px', boxSizing: 'border-box', textAlign: 'center', marginBottom: '4px' }}>
        {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <div style={{ marginBottom: '4px' }}>
        <div style={lbl}>Scene Name</div>
        <input value={scene.name} onChange={e => updateSceneField('name', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', textAlign: 'center' }} />
      </div>

      <label style={{ ...btn, cursor: 'pointer' }}>
        {uploading ? '...' : 'Upload Map'}
        <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) uploadBackground(e.target.files[0]) }} />
      </label>

      {reusableMaps.length > 0 && (
        // Reuse-from-library — pick a background_url from any of the
        // GM's other scenes and stamp it onto the current one. The
        // current scene's URL is excluded from the list.
        <select
          defaultValue=""
          onChange={e => {
            const url = e.target.value
            if (!url) return
            updateSceneField('background_url', url)
            e.currentTarget.value = ''
          }}
          title="Reuse a map you've already uploaded to another story or scene"
          style={{ ...btn, color: '#7ab3d4' }}>
          <option value="">📂 Reuse map…</option>
          {reusableMaps.filter(m => m.url !== scene.background_url).map(m => (
            <option key={m.key} value={m.url}>{m.label}</option>
          ))}
        </select>
      )}

      <button onClick={() => busRef.current?.postCommand('place_tokens')}
        style={{ ...btn, color: '#7fc458' }}>Place Tokens</button>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={btnSmall}>−</button>
        <span style={{ ...btnSmall, flex: 1, cursor: 'default' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={btnSmall}>+</button>
      </div>

      {/* Grid controls */}
      <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '6px', marginTop: '4px' }}>
        <button onClick={() => setShowGrid(p => !p)}
          style={{ ...btn, background: showGrid ? '#1a2e10' : 'rgba(15,15,15,.85)', border: `1px solid ${showGrid ? '#2d5a1b' : '#3a3a3a'}`, color: showGrid ? '#7fc458' : '#3a3a3a', marginBottom: '4px' }}>
          Grid {showGrid ? 'ON' : 'OFF'}
        </button>
        <select value={gridColor} onChange={e => setGridColor(e.target.value)}
          style={{ ...btn, marginBottom: '4px' }}>
          <option value="white">White</option>
          <option value="black">Black</option>
          <option value="#888">Grey</option>
          <option value="#c0392b">Red</option>
          <option value="#3498db">Blue</option>
          <option value="#f1c40f">Yellow</option>
          <option value="#27ae60">Green</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '4px' }}>
          <input type="range" min="5" max="100" value={Math.round(gridOpacity * 100)} onChange={e => setGridOpacity(parseInt(e.target.value) / 100)}
            style={{ flex: 1, accentColor: '#c0392b', minWidth: 0 }} />
          <span style={{ fontSize: '13px', color: '#d4cfc9', fontFamily: 'Carlito, sans-serif', minWidth: '34px', textAlign: 'right' }}>{Math.round(gridOpacity * 100)}%</span>
        </div>
        <button onClick={() => busRef.current?.postCommand('fit_to_map')}
          style={{ ...btn, color: '#7ab3d4', marginBottom: '4px' }}>Fit to Map</button>

        {/* 2×2 stepper grid — was 4 stacked rows. Layout transposes
            so Cols stacks above Rows in the left column and Cell (ft)
            stacks above Cell (px) in the right column — pairs the
            grid-dimension steppers and the cell-size steppers
            visually. */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Stepper label="Cols" value={scene.grid_cols} onChange={v => updateSceneField('grid_cols', Math.max(1, v))} />
            <Stepper label="Rows" value={scene.grid_rows} onChange={v => updateSceneField('grid_rows', Math.max(1, v))} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Stepper label="Cell (ft)" value={scene.cell_feet ?? 3} onChange={v => updateSceneField('cell_feet', Math.max(1, v))} suffix="ft" />
            <Stepper label="Cell (px)" value={cellPx} onChange={v => setCellPx(Math.max(5, Math.min(200, v)))} suffix="px" step={5} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button onClick={() => busRef.current?.postCommand('fit_to_screen')}
        style={{ ...btn, color: '#7ab3d4' }}>Fit to Screen</button>

      <button onClick={toggleLock}
        style={{ ...btn, background: mapLocked ? '#2a1210' : 'rgba(15,15,15,.85)', border: `1px solid ${mapLocked ? '#c0392b' : '#3a3a3a'}`, color: mapLocked ? '#f5a89a' : '#d4cfc9' }}>
        {mapLocked ? 'Unlock Map' : 'Lock Map'}
      </button>

      <button onClick={() => setShowRangeOverlay(p => !p)}
        style={{ ...btn, background: showRangeOverlay ? '#1a2e10' : 'rgba(15,15,15,.85)', border: `1px solid ${showRangeOverlay ? '#2d5a1b' : '#3a3a3a'}`, color: showRangeOverlay ? '#7fc458' : '#d4cfc9' }}>
        {showRangeOverlay ? 'Hide Ranges' : 'Show Ranges'}
      </button>

      {scene.background_url && (
        <button onClick={() => setConfirming('map')} style={{ ...btn, border: '1px solid #c0392b', color: '#f5a89a' }}>Delete Map</button>
      )}

      <button onClick={() => setConfirming('scene')} style={{ ...btn, border: '1px solid #c0392b', color: '#f5a89a' }}>Delete Scene</button>

      {/* In-app confirmation overlay — replaces native confirm() which
          gets clipped by the narrow popout window width. */}
      {confirming && (
        <div onClick={() => setConfirming(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 10 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#1a1a1a', border: '1px solid #c0392b', borderRadius: 4, padding: 14, width: '100%', maxWidth: 240, textAlign: 'center' }}>
            <div style={{ color: '#f5f2ee', fontSize: 14, marginBottom: 10, fontFamily: 'Carlito, sans-serif', lineHeight: 1.4 }}>
              {confirming === 'map'
                ? 'Delete the map image?'
                : <>Delete scene <span style={{ color: '#f5a89a' }}>&ldquo;{scene.name}&rdquo;</span>? This cannot be undone.</>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setConfirming(null)}
                style={{ ...btn, flex: 1 }}>Cancel</button>
              <button onClick={async () => {
                const action = confirming
                setConfirming(null)
                if (action === 'map') await performDeleteMap()
                else if (action === 'scene') await performDeleteScene()
              }}
                style={{ ...btn, flex: 1, background: '#c0392b', borderColor: '#c0392b', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stepper subcomponent — replaces three inline copies in TacticalMap
// for cols / rows / cell_feet so the popout panel stays readable.
function Stepper({ label, value, onChange, suffix, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number
}) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
        <button onClick={() => onChange(value - step)} style={stepBtn}>−</button>
        <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', minWidth: '30px', textAlign: 'center' }}>{value}{suffix}</span>
        <button onClick={() => onChange(value + step)} style={stepBtn}>+</button>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: '13px', color: '#fff', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px', textAlign: 'center' }
const btn: React.CSSProperties = { padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }
const btnSmall: React.CSSProperties = { padding: '4px 6px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const stepBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }
const fullPage: React.CSSProperties = { background: '#0d0d0d', color: '#cce0f5', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Carlito, sans-serif', fontSize: '14px', padding: '20px', textAlign: 'center' }
