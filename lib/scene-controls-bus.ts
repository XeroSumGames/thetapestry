// Typed BroadcastChannel bus for syncing the tactical scene controls
// between the main TacticalMap window and the popped-out controls
// window.
//
// Two message kinds:
//   • 'state'   — bidirectional. Either window mutates a shared local
//                 UI state (zoom, gridColor, gridOpacity, showGrid,
//                 showRangeOverlay, cellPx, mapLocked); the other
//                 window applies the same setX call.
//   • 'cmd'     — popout → main only. Commands that need access to
//                 main-window-only refs (bgImageRef, containerRef) —
//                 fit_to_map, fit_to_screen, place_tokens.
//
// Channel name is keyed by campaignId so multi-campaign tabs in the
// same browser don't cross-talk. BroadcastChannel is auto-scoped by
// origin + tab group, so a Listed module's marketplace tab won't
// receive a campaign GM's controls.
//
// DB-backed scene fields (name, grid_cols, grid_rows, cell_feet,
// background_url, is_locked) are NOT sent over this bus — they're
// persisted to Supabase and the main window picks them up via the
// existing tactical_scenes realtime subscription. Single source of
// truth, no risk of bus and DB disagreeing.

export type SceneControlsStateKey =
  | 'zoom'
  | 'cellPx'
  | 'showGrid'
  | 'gridColor'
  | 'gridOpacity'
  | 'showRangeOverlay'
  | 'mapLocked'

export type SceneControlsCommand =
  | 'fit_to_map'
  | 'fit_to_screen'
  | 'place_tokens'

type Msg =
  | { kind: 'state'; key: SceneControlsStateKey; value: any }
  | { kind: 'cmd'; name: SceneControlsCommand }
  | { kind: 'request_snapshot' }
  | { kind: 'snapshot'; state: Partial<Record<SceneControlsStateKey, any>> }

export interface SceneControlsBus {
  postState(key: SceneControlsStateKey, value: any): void
  postCommand(name: SceneControlsCommand): void
  requestSnapshot(): void
  postSnapshot(state: Partial<Record<SceneControlsStateKey, any>>): void
  onState(handler: (key: SceneControlsStateKey, value: any) => void): () => void
  onCommand(handler: (name: SceneControlsCommand) => void): () => void
  onRequestSnapshot(handler: () => void): () => void
  onSnapshot(handler: (state: Partial<Record<SceneControlsStateKey, any>>) => void): () => void
  close(): void
}

export function createSceneControlsBus(campaignId: string): SceneControlsBus | null {
  // BroadcastChannel is supported in all modern browsers but guard for
  // SSR (no `window`) and for any older fallback case.
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  const channel = new BroadcastChannel(`tapestry-scene-controls-${campaignId}`)

  function on(predicate: (m: Msg) => boolean, fn: (m: Msg) => void): () => void {
    const handler = (e: MessageEvent<Msg>) => { if (predicate(e.data)) fn(e.data) }
    channel.addEventListener('message', handler as any)
    return () => channel.removeEventListener('message', handler as any)
  }

  return {
    postState(key, value) { channel.postMessage({ kind: 'state', key, value } satisfies Msg) },
    postCommand(name) { channel.postMessage({ kind: 'cmd', name } satisfies Msg) },
    requestSnapshot() { channel.postMessage({ kind: 'request_snapshot' } satisfies Msg) },
    postSnapshot(state) { channel.postMessage({ kind: 'snapshot', state } satisfies Msg) },
    onState(fn) {
      return on(m => m.kind === 'state', m => { if (m.kind === 'state') fn(m.key, m.value) })
    },
    onCommand(fn) {
      return on(m => m.kind === 'cmd', m => { if (m.kind === 'cmd') fn(m.name) })
    },
    onRequestSnapshot(fn) {
      return on(m => m.kind === 'request_snapshot', () => fn())
    },
    onSnapshot(fn) {
      return on(m => m.kind === 'snapshot', m => { if (m.kind === 'snapshot') fn(m.state) })
    },
    close() { channel.close() },
  }
}
