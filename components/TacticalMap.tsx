'use client'
import { memo, useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getWeaponByName } from '../lib/weapons'
import { vividTokenBorder } from './NpcRoster'
import { createSceneControlsBus, type SceneControlsBus } from '../lib/scene-controls-bus'

// Feet per band — used when drawing the primary-weapon range circle for PC/NPC tokens
const RANGE_BAND_FEET: Record<string, number> = {
  'Engaged': 5,
  'Close': 30,
  'Medium': 100,
  'Long': 300,
  'Distant': 600,
}
// Melee "Close" means reach (~10ft), not the ranged Close band (30ft)
const MELEE_RANGE_FEET: Record<string, number> = {
  'Engaged': 5,
  'Close': 10,
}

interface Token {
  id: string
  scene_id: string
  name: string
  token_type: string
  character_id: string | null
  npc_id: string | null
  portrait_url: string | null
  destroyed_portrait_url: string | null
  grid_x: number
  grid_y: number
  // Multi-cell footprint (objects only — defaults to 1×1). Lets a wide
  // truck or long wall actually occupy the cells it covers, instead of
  // visually overflowing a single-cell anchor.
  grid_w: number
  grid_h: number
  // PCs that the GM has opted-in to move this token (objects only — a
  // PC token is implicitly controlled by its owner). Empty = GM-only.
  controlled_by_character_ids?: string[] | null
  is_visible: boolean
  color: string
  wp_max: number | null
  wp_current: number | null
  scale: number
  rotation: number
}

interface Scene {
  id: string
  campaign_id: string
  name: string
  background_url: string | null
  grid_cols: number
  grid_rows: number
  cell_feet: number
  cell_px: number
  img_scale: number
  is_active: boolean
  is_locked: boolean
  has_grid: boolean
}

interface Props {
  campaignId: string
  isGM: boolean
  initiativeOrder: any[]
  onTokenClick?: (token: Token) => void
  onTokenSelect?: (token: Token | null) => void
  tokenRefreshKey?: number
  campaignNpcs?: any[]
  entries?: any[]
  myCharacterId?: string | null
  moveMode?: { characterId?: string; npcId?: string; objectTokenId?: string; feet: number } | null
  onMoveComplete?: () => void
  onMoveCancel?: () => void
  // Throw-to-cell mode for grenades / thrown explosives. When set, the
  // map paints every cell within `rangeFeet` of the attacker orange and
  // a click on a valid cell calls onThrowComplete(gx, gy). Separate from
  // moveMode because the cell-click resolves to a blast center, not a
  // token move, and the range math uses weapon range not movement feet.
  // hasBlast: when true, the TacticalMap renders Engaged/Close/Far rings
  // around the cell under the cursor so the thrower can SEE the blast
  // footprint before committing. friendlyCharacterIds: any of these PCs
  // inside the 100ft far-band trigger a confirm() prompt before the
  // throw fires — saves the player from accidentally lobbing a grenade
  // into their own teammates.
  throwMode?: { attackerCharId: string | null; attackerNpcId: string | null; rangeFeet: number; hasBlast?: boolean; friendlyCharacterIds?: string[] } | null
  onThrowComplete?: (gx: number, gy: number) => void
  onThrowCancel?: () => void
  onTokensUpdate?: (tokens: { id: string; name: string; token_type: string; character_id: string | null; npc_id: string | null; grid_x: number; grid_y: number; wp_max: number | null; wp_current: number | null }[], cellFeet: number) => void
  onTokenChanged?: () => void                               // Notify parent to broadcast token_changed so other clients re-fetch
  onPlayerDragMove?: (characterId: string) => void          // Player finished a valid drag-move; parent consumes 1 action
  // GM dragged the *active* combatant's token. Parent consumes 1 action
  // on whichever initiative row owns the token. GM drags of off-turn
  // tokens stay free (cleanup / repositioning use case).
  onGMDragMove?: (args: { characterId?: string; npcId?: string }) => void
  // Campaign vehicle data — used as a fallback for object tokens that
  // were placed without their wp_max/wp_current copied across (so the
  // selected-token panel still shows the correct stats by name match).
  vehicles?: { name: string; wp_max?: number; wp_current?: number; speed?: number }[]
  // Player-or-GM clicks Move on an object token in the in-map panel.
  // Parent owns the moveMode state + the speed × 30ft / acceleration
  // ramp logic, so we just hand off the tokenId.
  onObjectMove?: (tokenId: string) => void
}

function TacticalMap({ campaignId, isGM, initiativeOrder, onTokenClick, onTokenSelect, tokenRefreshKey, campaignNpcs, entries, myCharacterId, moveMode, onMoveComplete, onMoveCancel, throwMode, onThrowComplete, onThrowCancel, onTokensUpdate, onTokenChanged, onPlayerDragMove, onGMDragMove, vehicles, onObjectMove }: Props) {
  const supabase = createClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Pan coalescing — multiple mousemove events per frame get merged into
  // a single scroll write via requestAnimationFrame. Without this, every
  // move wrote to scrollLeft/scrollTop synchronously, which thrashed
  // layout/paint and felt jerky at high mouse rates on large maps.
  const panTargetRef = useRef<{ x: number; y: number } | null>(null)
  const panRAFRef = useRef<number | null>(null)
  // Press-and-hold ping (playtest #31): press on empty cell and hold still
  // for ~600ms to drop a ping, instead of the old double-click gesture.
  // Panning still starts immediately on the same mousedown; mousemove
  // beyond a small jitter threshold cancels the hold, leaving just a pan.
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  // Hover cell tracked during throwMode so the blast preview rings
  // (Engaged/Close/Far) follow the cursor. Null when not in throw mode
  // or cursor is off-grid. See draw() and handleMouseMove.
  const [throwHoverCell, setThrowHoverCell] = useState<{ gx: number; gy: number } | null>(null)
  const [scene, setScene] = useState<Scene | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [dragging, setDragging] = useState<{ tokenId: string; offsetX: number; offsetY: number } | null>(null)

  // Toggle a body-level class while a token drag is in progress so any
  // fixed-position overlay (notification dropdown, messages dropdown,
  // future popups pinned to viewport edges) can opt out of intercepting
  // the drop via CSS — `body.dragging-token .drag-blocker { pointer-events: none }`.
  // Per Xero's playtest report — bottom-left of the tactical map was
  // unreachable because some overlay was catching the drop.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (dragging) document.body.classList.add('dragging-token')
    else document.body.classList.remove('dragging-token')
    return () => { document.body.classList.remove('dragging-token') }
  }, [dragging])
  const dragPosRef = useRef<{ px: number; py: number } | null>(null) // pixel position of dragged token (canvas coords)
  const dragRAFRef = useRef<number | null>(null)                     // rAF handle for drag-move redraws (playtest #28)
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [showRangeOverlay, setShowRangeOverlay] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [setupName, setSetupName] = useState('Scene')
  const [setupCols, setSetupCols] = useState(20)
  const [setupRows, setSetupRows] = useState(15)
  const [setupHasGrid, setSetupHasGrid] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [panning, setPanning] = useState<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)
  const [mapLocked, setMapLocked] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [imgScale, setImgScale] = useState(1)
  const [gridColor, setGridColor] = useState('white')
  const [ping, setPing] = useState<{ gx: number; gy: number; t: number; color: string; count: number } | null>(null)
  const pingChannelRef = useRef<any>(null)
  const tacticalChannelRef = useRef<any>(null)
  const [gridOpacity, setGridOpacity] = useState(0.4)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [cellPx, setCellPx] = useState(35)
  const [resizing, setResizing] = useState<{ corner: string; startX: number; startY: number; startZoom: number } | null>(null)
  const mapDrawRef = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 })
  const tokensRef = useRef<Token[]>([])
  const portraitCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const tokenAnimRef = useRef<Map<string, { fromX: number; fromY: number; toX: number; toY: number; t: number }>>(new Map())
  const animFrameRef = useRef<number>(0)
  // Which scene we've already auto-centered the scroll for — prevents
  // stealing the user's scroll after they've moved around.
  const centeredSceneIdRef = useRef<string | null>(null)
  const sceneRef = useRef<Scene | null>(null)

  // Keep refs in sync for canvas drawing
  useEffect(() => { tokensRef.current = tokens }, [tokens])
  useEffect(() => { sceneRef.current = scene }, [scene])

  // Load scenes
  // Tracks the last scene whose saved cellPx / imgScale we applied to
  // local UI state. cellPx and imgScale are LIVE local controls — the
  // popout's Cell-px stepper and the zoom slider write them via the
  // broadcast channel without persisting to the DB on every tick.
  // Without this guard, a `tactical_scenes` realtime UPDATE (e.g. from
  // a +Col click on the popout writing grid_cols) re-runs loadScenes
  // and clobbers the user's in-flight local cellPx / imgScale by
  // snapping them back to the DB row. Result: the map appears to
  // "enlarge" or "shrink" whenever you nudge cols/rows. Only sync from
  // DB when the active scene ID actually changes.
  const lastSyncedSceneIdRef = useRef<string | null>(null)

  async function loadScenes() {
    const { data } = await supabase.from('tactical_scenes').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    setScenes(data ?? [])
    const active = (data ?? []).find((s: Scene) => s.is_active)
    if (active) {
      setScene(active)
      loadTokens(active.id)
      // Apply saved visual settings ONLY on first load or scene switch.
      if (lastSyncedSceneIdRef.current !== active.id) {
        if (active.cell_px) setCellPx(active.cell_px)
        if (active.img_scale) setImgScale(active.img_scale)
        setMapLocked(active.is_locked ?? false)
        lastSyncedSceneIdRef.current = active.id
      }
    } else if (data && data.length > 0 && isGM) {
      // No active scene — auto-activate the most recent one
      const first = data[0]
      await supabase.from('tactical_scenes').update({ is_active: true }).eq('id', first.id)
      setScene(first)
      loadTokens(first.id)
      if (lastSyncedSceneIdRef.current !== first.id) {
        if (first.cell_px) setCellPx(first.cell_px)
        if (first.img_scale) setImgScale(first.img_scale)
        setMapLocked(first.is_locked ?? false)
        lastSyncedSceneIdRef.current = first.id
      }
    } else if ((!data || data.length === 0) && isGM) {
      // No scenes at all — open Create Scene modal
      setShowSetup(true)
    }
  }

  async function loadTokens(sceneId: string) {
    // Soft-deleted tokens (archived_at not null) preserve their position
    // for a future remap but render as if absent. Filter them out here.
    const { data } = await supabase.from('scene_tokens').select('*').eq('scene_id', sceneId).is('archived_at', null)
    setTokens(data ?? [])
  }

  // Init + Realtime
  useEffect(() => {
    loadScenes()
    const channel = supabase.channel(`tactical_${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scene_tokens' }, () => {
        if (sceneRef.current) loadTokens(sceneRef.current.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tactical_scenes', filter: `campaign_id=eq.${campaignId}` }, () => {
        loadScenes()
      })
      .on('broadcast', { event: 'token_moved' }, () => {
        if (sceneRef.current) loadTokens(sceneRef.current.id)
      })
      .on('broadcast', { event: 'scene_activated' }, () => {
        // GM activated a different tactical scene. Reload the scene
        // list — loadScenes auto-picks the is_active=true row, so the
        // player's view follows immediately whether their pane is
        // open or closed.
        loadScenes()
      })
      .on('broadcast', { event: 'tactical_zoom' }, (msg: any) => {
        // GM zoom snaps players' view to match (playtest #27). Players
        // can still zoom locally afterwards — the sync only fires when
        // the GM actively changes zoom, so a player's later adjustment
        // isn't clobbered until the GM zooms again.
        if (!isGM) {
          const nextZoom = msg?.payload?.zoom
          if (typeof nextZoom === 'number' && nextZoom > 0) setZoom(nextZoom)
        }
      })
      .subscribe()
    tacticalChannelRef.current = channel
    const pingCh = supabase.channel(`ping_${campaignId}`)
      .on('broadcast', { event: 'gm_ping' }, (msg: any) => {
        const p = msg?.payload ?? {}
        const gx = p.gx ?? p.payload?.gx
        const gy = p.gy ?? p.payload?.gy
        const color = p.color ?? p.payload?.color ?? '#EF9F27'
        if (gx != null && gy != null) setPing({ gx, gy, t: 0, color, count: 2 })
      })
      .subscribe()
    pingChannelRef.current = pingCh
    return () => { supabase.removeChannel(channel); supabase.removeChannel(pingCh); if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [campaignId])

  // Center the viewport on the middle of the current map content (image or
  // grid, whichever is larger). Only runs once per scene id so it doesn't
  // steal the user's scroll after they've panned around. Called after draw()
  // has sized the canvas.
  function centerViewport() {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    // Use setTimeout(0) so the canvas dimensions written inside draw() have
    // settled into the DOM before we read scroll dimensions.
    setTimeout(() => {
      if (!container || !canvas) return
      const scrollX = Math.max(0, (canvas.width - container.clientWidth) / 2)
      const scrollY = Math.max(0, (canvas.height - container.clientHeight) / 2)
      container.scrollLeft = scrollX
      container.scrollTop = scrollY
    }, 0)
  }

  // Load background image when scene changes
  useEffect(() => {
    if (!scene?.background_url) {
      bgImageRef.current = null
      draw()
      if (scene && centeredSceneIdRef.current !== scene.id) {
        centeredSceneIdRef.current = scene.id
        centerViewport()
      }
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      bgImageRef.current = img
      // If the scene has no saved img_scale yet (first time), pick a sensible default
      // so the image fits the GM's container. GM can then Lock Map to persist.
      if (isGM && (scene.img_scale == null || scene.img_scale === 1) && containerRef.current && img.naturalWidth > 0) {
        const cw = containerRef.current.clientWidth
        const fit = cw / img.naturalWidth
        // Only override if natural is much wider than container (avoid touching existing manual scales)
        if (img.naturalWidth > cw * 1.1) setImgScale(fit)
      }
      draw()
      // Center once per scene. After the image loads, canvas dimensions are
      // final — this is the right moment to scroll to the middle.
      if (centeredSceneIdRef.current !== scene.id) {
        centeredSceneIdRef.current = scene.id
        centerViewport()
      }
    }
    img.src = scene.background_url
  }, [scene?.background_url])

  // Refresh tokens when parent signals a change
  useEffect(() => { if (sceneRef.current) loadTokens(sceneRef.current.id) }, [tokenRefreshKey])

  // Live token-patch listener — lets external popups (like ObjectCard's
  // rotation slider) push optimistic patches into our `tokens` state
  // mid-drag without going through DB → realtime → reload, which is
  // too slow for slider-style continuous interaction. The DB write
  // still happens on commit (mouseup) so other clients sync via the
  // normal postgres_changes path. Window-level CustomEvent because
  // ObjectCard is rendered outside TacticalMap's tree.
  useEffect(() => {
    function onPatch(ev: Event) {
      const detail = (ev as CustomEvent).detail
      if (!detail?.tokenId || typeof detail.patch !== 'object') return
      setTokens(prev => prev.map(t => t.id === detail.tokenId ? { ...t, ...detail.patch } : t))
    }
    if (typeof window === 'undefined') return
    window.addEventListener('tapestry:token-patch', onPatch)
    return () => window.removeEventListener('tapestry:token-patch', onPatch)
  }, [])

  // Redraw on token/scene changes
  // campaignNpcs/entries are in the dep list so HP damage repaints the pips immediately — missing them meant tokens stayed stale until some other dependency (click, zoom, move) forced a redraw.
  useEffect(() => { draw() }, [tokens, scene, selectedToken, zoom, showGrid, gridColor, gridOpacity, imgScale, cellPx, moveMode, throwMode, throwHoverCell, showRangeOverlay, ping, dragging, campaignNpcs, entries])

  // Notify parent of token positions for range calculations
  useEffect(() => {
    if (onTokensUpdate && scene) {
      onTokensUpdate(tokens.map(t => ({ id: t.id, name: t.name, token_type: t.token_type, character_id: t.character_id, npc_id: t.npc_id, grid_x: t.grid_x, grid_y: t.grid_y, wp_max: t.wp_max, wp_current: t.wp_current, controlled_by_character_ids: t.controlled_by_character_ids ?? null, rotation: t.rotation ?? 0 })), scene.cell_feet ?? 3)
    }
  }, [tokens, scene?.cell_feet])

  // GM-only: broadcast zoom changes so player views snap to match (playtest
  // #27). The receiving-side listener is in the realtime subscribe block
  // above; it only runs for non-GM clients, so a GM changing zoom doesn't
  // echo back to themselves. Broadcast only fires once `tacticalChannelRef`
  // has subscribed to avoid firing before the channel is ready.
  useEffect(() => {
    if (!isGM || !tacticalChannelRef.current) return
    tacticalChannelRef.current.send({ type: 'broadcast', event: 'tactical_zoom', payload: { zoom } })
  }, [zoom, isGM])

  // Spacebar = pan-mode visual cue + click-and-drag override.
  // Arrow keys (or WASD) = continuous smooth pan via rAF, no mouse
  // needed. Multiple keys can be held for diagonal pan. Steady 60fps
  // velocity decouples pan from mouse jitter — fixes the "still
  // jerky" complaint where mouse-rate-bound drag was the bottleneck.
  useEffect(() => {
    const heldKeys = new Set<string>()
    let rafId: number | null = null
    const PAN_PX_PER_FRAME = 14

    function tick() {
      if (heldKeys.size === 0 || !containerRef.current) {
        rafId = null
        return
      }
      let dx = 0, dy = 0
      if (heldKeys.has('ArrowLeft') || heldKeys.has('KeyA')) dx -= PAN_PX_PER_FRAME
      if (heldKeys.has('ArrowRight') || heldKeys.has('KeyD')) dx += PAN_PX_PER_FRAME
      if (heldKeys.has('ArrowUp') || heldKeys.has('KeyW')) dy -= PAN_PX_PER_FRAME
      if (heldKeys.has('ArrowDown') || heldKeys.has('KeyS')) dy += PAN_PX_PER_FRAME
      if (dx !== 0 || dy !== 0) {
        // Diagonal normalization — keep total speed consistent so
        // diagonals don't outpace cardinals by 1.41×.
        if (dx !== 0 && dy !== 0) {
          dx *= 0.707
          dy *= 0.707
        }
        containerRef.current.scrollLeft += dx
        containerRef.current.scrollTop += dy
      }
      rafId = requestAnimationFrame(tick)
    }

    function isInputTarget(t: EventTarget | null): boolean {
      if (!t) return false
      const tag = (t as HTMLElement).tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isInputTarget(e.target)) return
      // preventDefault on EVERY spacebar keydown (including the
      // auto-repeats fired while held), not just the first. The
      // browser default for spacebar is page-down scroll, and on
      // auto-repeat each repeat fires another scroll — which during
      // a spacebar+drag pan reads as the page constantly jumping
      // back up against the user's drag. The state-set gates on
      // !e.repeat so we don't churn the spaceHeld state every frame,
      // but the preventDefault must always fire while space is down.
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) setSpaceHeld(true)
        return
      }
      if (e.code === 'Escape' && onMoveCancel) {
        onMoveCancel()
        return
      }
      const isPanKey = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)
      if (isPanKey) {
        e.preventDefault()
        if (!heldKeys.has(e.code)) {
          heldKeys.add(e.code)
          if (rafId == null) rafId = requestAnimationFrame(tick)
        }
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpaceHeld(false)
      heldKeys.delete(e.code)
    }

    // Visibility/blur safety: if the user tabs away mid-pan, drop all
    // held keys so the pan doesn't run forever in the background.
    function onBlur() {
      heldKeys.clear()
      setSpaceHeld(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [onMoveCancel])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  function getCellSize(): number {
    return cellPx
  }

  function draw() {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const s = sceneRef.current
    if (!s) return

    // Canvas must be large enough for the zoomed view AND the scaled image
    const baseW = container.clientWidth
    const baseH = container.clientHeight
    const cellSize = getCellSize()
    const gridW = s.grid_cols * cellSize
    const gridH = s.grid_rows * cellSize
    // Image size is derived from the image's own natural dimensions (same file
    // → same dims for everyone) scaled by img_scale. This keeps GM and players
    // pixel-identical AND decouples the image from grid changes — adding a
    // column or row moves the grid, not the map.
    let imgW = 0, imgH = 0
    if (bgImageRef.current) {
      const img = bgImageRef.current
      imgW = img.naturalWidth * imgScale
      imgH = img.naturalHeight * imgScale
    }
    canvas.width = Math.max(baseW, baseW * zoom, imgW)
    canvas.height = Math.max(baseH, baseH * zoom, imgH)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const offsetX = 0
    const offsetY = 0

    // Clear
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Apply zoom — scales everything: image, grid, tokens
    ctx.save()
    ctx.scale(zoom, zoom)

    // Background image — natural-dimensions × img_scale, same for every viewer.
    if (bgImageRef.current) {
      const img = bgImageRef.current
      const scaledW = img.naturalWidth * imgScale
      const scaledH = img.naturalHeight * imgScale
      ctx.drawImage(img, 0, 0, scaledW, scaledH)
      mapDrawRef.current = { x: 0, y: 0, w: scaledW, h: scaledH }

      // Resize handles at corners (GM only, unlocked)
      if (isGM && !mapLocked) {
        const hs = 10
        ctx.fillStyle = '#c0392b'
        ;[
          [0, 0], [scaledW - hs, 0],
          [0, scaledH - hs], [scaledW - hs, scaledH - hs],
        ].forEach(([hx, hy]) => ctx.fillRect(hx, hy, hs, hs))
      }
    } else {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(offsetX, offsetY, gridW, gridH)
    }

    // Grid overlay
    if (showGrid) {
    const cellW = gridW / s.grid_cols
    const cellH = gridH / s.grid_rows
    // Grid lines
    ctx.globalAlpha = gridOpacity
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 0.5
    for (let x = 0; x <= s.grid_cols; x++) {
      ctx.beginPath()
      ctx.moveTo(offsetX + x * cellW, offsetY)
      ctx.lineTo(offsetX + x * cellW, offsetY + gridH)
      ctx.stroke()
    }
    for (let y = 0; y <= s.grid_rows; y++) {
      ctx.beginPath()
      ctx.moveTo(offsetX, offsetY + y * cellH)
      ctx.lineTo(offsetX + gridW, offsetY + y * cellH)
      ctx.stroke()
    }
    // Column labels (A, B, C...)
    ctx.fillStyle = gridColor
    ctx.font = `${Math.max(8, cellW * 0.3)}px Carlito`
    ctx.textAlign = 'center'
    for (let x = 0; x < s.grid_cols; x++) {
      ctx.fillText(String.fromCharCode(65 + (x % 26)), offsetX + x * cellW + cellW / 2, offsetY - 4)
    }
    // Row labels (1, 2, 3...)
    ctx.textAlign = 'right'
    for (let y = 0; y < s.grid_rows; y++) {
      ctx.fillText(String(y + 1), offsetX - 4, offsetY + y * cellH + cellH / 2 + 4)
    }
    ctx.globalAlpha = 1
    } // end showGrid

    // Move mode highlight — draw valid movement cells
    if (moveMode) {
      const ft = s.cell_feet ?? 3
      const moveCells = Math.floor(moveMode.feet / ft)
      const moveTok = tokensRef.current.find(t =>
        (moveMode.characterId && t.character_id === moveMode.characterId) ||
        (moveMode.npcId && t.npc_id === moveMode.npcId) ||
        (moveMode.objectTokenId && t.id === moveMode.objectTokenId)
      )
      if (moveTok) {
        const occupied = new Set(tokensRef.current.filter(t => t.id !== moveTok.id).map(t => `${t.grid_x},${t.grid_y}`))
        for (let gx = 0; gx < s.grid_cols; gx++) {
          for (let gy = 0; gy < s.grid_rows; gy++) {
            const dist = Math.max(Math.abs(gx - moveTok.grid_x), Math.abs(gy - moveTok.grid_y))
            if (dist > 0 && dist <= moveCells && !occupied.has(`${gx},${gy}`)) {
              ctx.fillStyle = 'rgba(127,196,88,0.25)'
              ctx.fillRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
              ctx.strokeStyle = 'rgba(127,196,88,0.5)'
              ctx.lineWidth = 1
              ctx.strokeRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
            }
          }
        }
      }
    }

    // Throw-to-cell highlight — paint every cell within weapon range of
    // the attacker token orange so the player can see where they can
    // place the grenade. Uses Chebyshev distance (same as moveMode) so
    // diagonal cells count as 1 step, matching how ranges are shown
    // elsewhere in the engine.
    if (throwMode) {
      const ft = s.cell_feet ?? 3
      const rangeCells = Math.floor(throwMode.rangeFeet / ft)
      const throwerTok = tokensRef.current.find(t =>
        (throwMode.attackerCharId && t.character_id === throwMode.attackerCharId) ||
        (throwMode.attackerNpcId && t.npc_id === throwMode.attackerNpcId)
      )
      if (throwerTok) {
        for (let gx = 0; gx < s.grid_cols; gx++) {
          for (let gy = 0; gy < s.grid_rows; gy++) {
            const dist = Math.max(Math.abs(gx - throwerTok.grid_x), Math.abs(gy - throwerTok.grid_y))
            // Include the thrower's own cell (dist=0) so a player can
            // drop a grenade at their feet if they really want to. Max
            // bound: rangeCells. Dropping on self = Engaged = full blast
            // to self, which is intentionally brutal.
            if (dist <= rangeCells) {
              ctx.fillStyle = 'rgba(239,159,39,0.22)'
              ctx.fillRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
              ctx.strokeStyle = 'rgba(239,159,39,0.55)'
              ctx.lineWidth = 1
              ctx.strokeRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
            }
          }
        }

        // Blast preview — when the weapon has Blast Radius, paint
        // Engaged/Close/Far rings around the cell under the cursor so
        // the thrower can see the splash footprint before committing.
        // Bands per CRB p.71-72: Engaged = 5ft full, Close = 30ft 50%,
        // Far = 100ft 25%. Only drawn for cells the thrower can
        // actually reach (filtered by rangeCells gate above) so the
        // preview doesn't follow the cursor off into unreachable
        // territory.
        if (throwMode.hasBlast && throwHoverCell) {
          const hov = throwHoverCell
          const reachDist = Math.max(Math.abs(hov.gx - throwerTok.grid_x), Math.abs(hov.gy - throwerTok.grid_y))
          if (reachDist <= rangeCells) {
            // Per playtest 2026-04-27: only Engaged + Close bands are
            // damaging. Drop the Far/25% faint shading from the preview.
            const engagedCells = Math.max(1, Math.round(5 / ft))
            const closeCells = Math.max(1, Math.round(30 / ft))
            for (let gx = 0; gx < s.grid_cols; gx++) {
              for (let gy = 0; gy < s.grid_rows; gy++) {
                const d = Math.max(Math.abs(gx - hov.gx), Math.abs(gy - hov.gy))
                let fill: string | null = null
                if (d <= engagedCells) fill = 'rgba(192,57,43,0.45)'      // red — full damage
                else if (d <= closeCells) fill = 'rgba(239,159,39,0.32)'  // amber — 50%
                if (fill) {
                  ctx.fillStyle = fill
                  ctx.fillRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
                }
              }
            }
            // Outline the impact cell brightly so the player can read it
            // through all the band shading.
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'
            ctx.lineWidth = 2
            ctx.strokeRect(offsetX + hov.gx * cellSize + 1, offsetY + hov.gy * cellSize + 1, cellSize - 2, cellSize - 2)
          }
        }
      }
    }

    // Range circles for selected PC/NPC token — Engaged, Move 9ft, primary weapon range.
    // Object tokens (crates, cars, doors) don't get circles — they don't attack or move.
    // Visibility rule (playtest #19): range bands are attacker-side info. The GM
    // sees circles on any selected token; a player only sees circles on their
    // OWN PC token. Clicking an enemy NPC or another player no longer reveals
    // their weapon range to a non-GM viewer.
    if (showRangeOverlay && selectedToken) {
      const selTok = tokensRef.current.find(t => t.id === selectedToken)
      const isMyToken = !!myCharacterId && selTok?.character_id === myCharacterId
      const canSeeBands = isGM || isMyToken
      if (selTok && selTok.token_type !== 'object' && canSeeBands) {
        const cx = offsetX + selTok.grid_x * cellSize + cellSize / 2
        const cy = offsetY + selTok.grid_y * cellSize + cellSize / 2
        const ft = s.cell_feet ?? 3

        // Look up PRIMARY weapon for this token
        let weaponRangeBand = 'Engaged'
        let weaponIsMelee = true
        if (selTok.npc_id && campaignNpcs) {
          const npc = campaignNpcs.find((n: any) => n.id === selTok.npc_id)
          const weaponName = npc?.skills?.weapon?.weaponName
          if (weaponName) {
            const w = getWeaponByName(weaponName)
            if (w) { weaponRangeBand = w.range; weaponIsMelee = w.category === 'melee' }
          }
        } else if (selTok.character_id && entries) {
          const entry = entries.find((e: any) => e.character.id === selTok.character_id)
          const weaponName = entry?.character.data?.weaponPrimary?.weaponName
          if (weaponName) {
            const w = getWeaponByName(weaponName)
            if (w) { weaponRangeBand = w.range; weaponIsMelee = w.category === 'melee' }
          }
        }
        const weaponRangeFt = weaponIsMelee
          ? (MELEE_RANGE_FEET[weaponRangeBand] ?? 5)
          : (RANGE_BAND_FEET[weaponRangeBand] ?? 5)
        const rawWeaponCells = Math.max(1, Math.ceil(weaponRangeFt / ft))
        // Clamp visual radius to the map's own extent — a 300ft/600ft circle on a
        // 20-cell map just engulfs everything. Label keeps the real range so the
        // player still knows "Sniper (600ft)" even when the circle stops at the edge.
        const mapExtentCells = Math.max(s.grid_cols, s.grid_rows)
        const weaponCells = Math.min(rawWeaponCells, mapExtentCells)
        const clampedLabel = rawWeaponCells > mapExtentCells
          ? `${weaponRangeBand} (${weaponRangeFt}ft — reaches map edge)`
          : `${weaponRangeBand} (${weaponRangeFt}ft)`

        const circles = [
          { cells: weaponCells, fill: 'rgba(192,57,43,0.18)', stroke: '#ff4040', label: clampedLabel },
          { cells: 3, fill: 'rgba(52,152,219,0.15)', stroke: '#5dade2', label: 'Move (9ft)' },
          { cells: Math.max(1, Math.ceil(3 / ft)), fill: 'rgba(127,196,88,0.20)', stroke: '#7fc458', label: 'Engaged' },
        ]
        // Largest first so smaller ones layer on top
        circles.sort((a, b) => b.cells - a.cells)
        circles.forEach(c => {
          ctx.beginPath()
          ctx.arc(cx, cy, c.cells * cellSize, 0, Math.PI * 2)
          ctx.fillStyle = c.fill
          ctx.fill()
          ctx.strokeStyle = c.stroke
          ctx.globalAlpha = 1
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.font = `bold 12px Carlito`
          ctx.fillStyle = c.stroke
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(c.label, cx, cy - c.cells * cellSize + 12)
        })
      }
    }

    // Tokens. Sort so objects render first (bottom), then NPCs, then PCs
    // on top — canvas is painter's-algorithm, last draw wins. Prevents a
    // barrel or crate from covering a player token when they share a
    // neighboring cell. Stable within each tier via index fallback.
    const toks = [...tokensRef.current].sort((a, b) => {
      const tier = (t: any) => t.token_type === 'object' ? 0 : t.token_type === 'npc' ? 1 : 2
      return tier(a) - tier(b)
    })
    const activeEntry = initiativeOrder.find((e: any) => e.is_active)

    let hasActiveAnim = false
    toks.forEach(t => {
      if (!t.is_visible && !isGM) return
      // Multi-cell footprint (objects only — defaults to 1×1). The
      // anchor cell stays (grid_x, grid_y); the visual is centered on
      // the rectangle's midpoint so a 5×2 truck covers the cells it
      // says it does.
      const gw = t.grid_w ?? 1
      const gh = t.grid_h ?? 1
      // Dragged token follows cursor
      const targetPxX = offsetX + (t.grid_x + gw / 2) * cellSize
      const targetPxY = offsetY + (t.grid_y + gh / 2) * cellSize
      let cx = targetPxX
      let cy = targetPxY
      const isBeingDragged = dragging?.tokenId === t.id && dragPosRef.current
      if (isBeingDragged) {
        cx = dragPosRef.current!.px
        cy = dragPosRef.current!.py
      }
      const anim = !isBeingDragged ? tokenAnimRef.current.get(t.id) : undefined
      if (anim) {
        anim.t = Math.min(1, anim.t + 0.08)
        const ease = 1 - Math.pow(1 - anim.t, 3) // ease-out cubic
        cx = anim.fromX + (anim.toX - anim.fromX) * ease
        cy = anim.fromY + (anim.toY - anim.fromY) * ease
        if (anim.t >= 1) tokenAnimRef.current.delete(t.id)
        else hasActiveAnim = true
      }
      const tokenScale = t.scale ?? 1.0
      const radius = cellSize * 0.4 * tokenScale

      // Pin marker — minimal render, just the emoji at the grid center.
      // No square background, no name label, no WP bar. token_type='pin'
      // is reserved for these markers (set by the "Add to tactical map"
      // button on campaign pins). Click hit detection still works
      // because radius is set; the GM can drag it like any other token.
      if (t.token_type === 'pin') {
        if (selectedToken === t.id) {
          ctx.shadowColor = '#c0392b'
          ctx.shadowBlur = 12
        }
        const fontPx = Math.max(20, cellSize * 0.9 * tokenScale)
        ctx.font = `${fontPx}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(t.name || '📍', cx, cy)
        ctx.shadowBlur = 0
        return
      }

      // Active combatant glow
      const isActive = activeEntry && (
        (t.character_id && activeEntry.character_id === t.character_id) ||
        (t.npc_id && activeEntry.npc_id === t.npc_id) ||
        (t.name === activeEntry.character_name)
      )
      if (isActive) {
        ctx.shadowColor = '#7fc458'
        ctx.shadowBlur = 12
      }

      // Selected highlight
      if (selectedToken === t.id) {
        ctx.shadowColor = '#c0392b'
        ctx.shadowBlur = 16
      }

      // GM always sees tokens at full opacity — no fading for "hidden"
      // tokens. The is_visible flag only gates player rendering (line
      // above: skip if !is_visible && !isGM). For the GM, the token is
      // simply on the map; whether players can see it is the GM's
      // workflow concern, not a visual cue they need on their canvas.

      // Determine mortal wound / dead status
      let tokenDead = false
      let tokenMortal = false
      if (t.npc_id && campaignNpcs) {
        const npc = campaignNpcs.find((n: any) => n.id === t.npc_id)
        if (npc) {
          const wp = npc.wp_current ?? npc.wp_max ?? 10
          tokenDead = npc.status === 'dead' || (wp === 0 && npc.death_countdown != null && npc.death_countdown <= 0)
          tokenMortal = wp === 0 && !tokenDead
        }
      } else if (t.character_id && entries) {
        const entry = entries.find((e: any) => e.character.id === t.character_id)
        if (entry) {
          const wp = entry.liveState.wp_current ?? entry.liveState.wp_max ?? 10
          tokenDead = wp === 0
          tokenMortal = wp === 0
        }
      } else if (t.token_type === 'object' && (t as any).wp_max != null) {
        const wp = (t as any).wp_current ?? (t as any).wp_max ?? 0
        tokenDead = wp <= 0
      }

      // Destroyed objects fade further than downed PCs/NPCs so they read as
      // "gone" rather than just "out of the fight". Keep full opacity when a
      // destroyed portrait is set — the alt art is the story, don't mute it.
      const hasDestroyedArt = t.token_type === 'object' && tokenDead && !!t.destroyed_portrait_url
      if (tokenDead && !hasDestroyedArt) ctx.globalAlpha = t.token_type === 'object' ? 0.3 : 0.5

      // Apply rotation
      const tokenRotation = (t.rotation ?? 0) * Math.PI / 180
      if (tokenRotation !== 0) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(tokenRotation)
        ctx.translate(-cx, -cy)
      }

      // Token shape — circle for PC/NPC, square for objects
      const isObject = t.token_type === 'object'
      // Destroyed objects swap to the alternate portrait if one is set, so
      // broken crates / wrecked cars visually transform instead of just
      // fading. Falls back to the regular portrait + shatter overlay.
      const useDestroyedArt = hasDestroyedArt
      const activePortraitUrl = useDestroyedArt ? t.destroyed_portrait_url : t.portrait_url
      const portraitImg = activePortraitUrl ? portraitCacheRef.current.get(activePortraitUrl) : null
      if (isObject) {
        // Object token footprint: gw × gh cells × scale. For multi-cell
        // objects (gw or gh > 1) the GM has explicitly sized the token,
        // so the image fills that exact rectangle (stretches if the
        // chosen dimensions don't match the image aspect). For 1×1
        // objects with an image, we preserve the image's natural aspect
        // within the cell so a wide truck dropped at 1×1 doesn't look
        // deformed.
        const isMultiCell = gw > 1 || gh > 1
        let drawW: number
        let drawH: number
        if (isMultiCell) {
          drawW = gw * cellSize * tokenScale
          drawH = gh * cellSize * tokenScale
        } else if (portraitImg && portraitImg.complete && portraitImg.naturalWidth > 0) {
          const aspect = portraitImg.naturalWidth / portraitImg.naturalHeight
          drawW = aspect >= 1 ? radius * 2 : radius * 2 * aspect
          drawH = aspect >= 1 ? (radius * 2) / aspect : radius * 2
        } else {
          drawW = radius * 2
          drawH = radius * 2
        }
        if (portraitImg && portraitImg.complete && portraitImg.naturalWidth > 0) {
          ctx.drawImage(portraitImg, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
          ctx.strokeStyle = selectedToken === t.id ? '#f5f2ee' : '#EF9F27'
          ctx.lineWidth = selectedToken === t.id ? 3 : 1.5
          ctx.strokeRect(cx - drawW / 2, cy - drawH / 2, drawW, drawH)
        } else {
          ctx.fillStyle = t.is_visible ? (t.color || '#EF9F27') : 'rgba(239,159,39,0.3)'
          ctx.fillRect(cx - drawW / 2, cy - drawH / 2, drawW, drawH)
          ctx.strokeStyle = selectedToken === t.id ? '#f5f2ee' : 'rgba(255,255,255,0.6)'
          ctx.lineWidth = selectedToken === t.id ? 3 : 1
          ctx.strokeRect(cx - drawW / 2, cy - drawH / 2, drawW, drawH)
          // Emoji or initials
          ctx.fillStyle = '#f5f2ee'
          ctx.font = `${Math.max(12, radius * 1.2)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const initials = t.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
          ctx.fillText(initials, cx, cy)
        }
      } else {
        // Circle token (PC/NPC)
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        if (portraitImg && portraitImg.complete && portraitImg.naturalWidth > 0) {
          ctx.save()
          ctx.clip()
          ctx.drawImage(portraitImg, cx - radius, cy - radius, radius * 2, radius * 2)
          ctx.restore()
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          // Brighten the stored disposition color at render time so
          // legacy tokens get the vivid palette without a DB rewrite.
          ctx.strokeStyle = isActive ? '#7fc458' : selectedToken === t.id ? '#f5f2ee' : vividTokenBorder(t.color)
          ctx.lineWidth = isActive || selectedToken === t.id ? 3 : 2
          ctx.stroke()
        } else {
          ctx.fillStyle = t.is_visible ? vividTokenBorder(t.color) : 'rgba(192,57,43,0.3)'
          ctx.fill()
          ctx.strokeStyle = isActive ? '#7fc458' : selectedToken === t.id ? '#f5f2ee' : 'rgba(255,255,255,1)'
          ctx.lineWidth = isActive || selectedToken === t.id ? 3 : 1.5
          ctx.stroke()
          ctx.fillStyle = '#f5f2ee'
          ctx.font = `bold ${Math.max(10, radius * 0.8)}px Carlito`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const initials = t.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
          ctx.fillText(initials, cx, cy)
        }
      }
      // Load portrait(s) for next draw — both intact and destroyed URLs, so
      // WP transitions don't flash an empty square while the alt image loads.
      const urlsToPreload = [t.portrait_url, t.destroyed_portrait_url].filter((u): u is string => !!u)
      for (const url of urlsToPreload) {
        if (!portraitCacheRef.current.has(url)) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => draw()
          img.src = url
          if (portraitCacheRef.current.size > 100) { const firstKey = portraitCacheRef.current.keys().next().value; if (firstKey) portraitCacheRef.current.delete(firstKey) }
          portraitCacheRef.current.set(url, img)
        }
      }

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // Dead or mortally wounded — red combat X for everyone (PCs, NPCs,
      // destroyed objects). Previously objects got a subtle dark-crack
      // pattern that was too easy to miss at a glance on busy terrain;
      // the red X matches the PC/NPC "this token is out of the fight"
      // convention so the map reads consistently. Skip when a destroyed
      // portrait is rendering — the portrait itself conveys destruction.
      if ((tokenMortal || tokenDead) && !useDestroyedArt) {
        ctx.save()
        ctx.globalAlpha = 1
        ctx.strokeStyle = '#ff2020'
        ctx.lineWidth = Math.max(4, radius * 0.3)
        ctx.lineCap = 'round'
        const xSize = radius * 0.7
        ctx.beginPath()
        ctx.moveTo(cx - xSize, cy - xSize)
        ctx.lineTo(cx + xSize, cy + xSize)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx + xSize, cy - xSize)
        ctx.lineTo(cx - xSize, cy + xSize)
        ctx.stroke()
        ctx.restore()
      }

      // Restore rotation before drawing name (name should be horizontal)
      if (tokenRotation !== 0) ctx.restore()

      // Name below — objects get up to 2 lines, characters get first word only
      const fontSize = Math.max(14, cellSize * 0.34)
      ctx.font = `bold ${fontSize}px Carlito`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const isObj = t.token_type === 'object'
      const namePadX = 4
      const namePadY = 2
      let nameY: number
      let nameH: number
      if (isObj && t.name.includes(' ')) {
        // Two-line name for objects
        const words = t.name.split(' ')
        const mid = Math.ceil(words.length / 2)
        const line1 = words.slice(0, mid).join(' ')
        const line2 = words.slice(mid).join(' ')
        const lineH = fontSize + 2
        const nameY1 = cy + radius + lineH / 2 + 4
        const nameY2 = nameY1 + lineH
        const maxW = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + namePadX * 2
        const blockH = lineH * 2 + namePadY * 2
        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        ctx.fillRect(Math.round(cx - maxW / 2), Math.round(nameY1 - lineH / 2 - namePadY), Math.round(maxW), Math.round(blockH))
        ctx.fillStyle = '#f5f2ee'
        ctx.fillText(line1, cx, nameY1)
        ctx.fillText(line2, cx, nameY2)
        nameY = nameY2
        nameH = lineH
      } else {
        const nameText = t.name.split(' ')[0]
        nameY = cy + radius + fontSize / 2 + 4
        const nameMetrics = ctx.measureText(nameText)
        const nameW = nameMetrics.width + namePadX * 2
        nameH = fontSize + namePadY * 2
        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        ctx.fillRect(Math.round(cx - nameW / 2), Math.round(nameY - nameH / 2), Math.round(nameW), Math.round(nameH))
        ctx.fillStyle = '#f5f2ee'
        ctx.fillText(nameText, cx, nameY)
      }

      // WP bar beneath name
      let wpCur = 0, wpMax = 0
      if (t.npc_id && campaignNpcs) {
        const npc = campaignNpcs.find((n: any) => n.id === t.npc_id)
        if (npc) { wpCur = npc.wp_current ?? npc.wp_max ?? 10; wpMax = npc.wp_max ?? 10 }
      } else if (t.character_id && entries) {
        const entry = entries.find((e: any) => e.character.id === t.character_id)
        if (entry) { wpCur = entry.liveState.wp_current ?? entry.liveState.wp_max ?? 10; wpMax = entry.liveState.wp_max ?? 10 }
      } else if (t.token_type === 'object' && (t as any).wp_max != null) {
        wpMax = (t as any).wp_max ?? 0; wpCur = (t as any).wp_current ?? wpMax
      }
      if (wpMax > 0) {
        const barW = radius * 1.6
        const barH = 4
        const barY = nameY + nameH / 2 + 3
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(Math.round(cx - barW / 2), Math.round(barY), Math.round(barW), barH)
        const wpPct = Math.max(0, Math.min(1, wpCur / wpMax))
        const wpColor = wpPct > 0.5 ? '#7fc458' : wpPct > 0.25 ? '#EF9F27' : '#c0392b'
        ctx.fillStyle = wpColor
        ctx.fillRect(Math.round(cx - barW / 2), Math.round(barY), Math.round(barW * wpPct), barH)
      }

      // Initiative order badge (top-left of token)
      if (initiativeOrder.length > 0) {
        const initIdx = initiativeOrder.findIndex((e: any) =>
          (t.character_id && e.character_id === t.character_id) ||
          (t.npc_id && e.npc_id === t.npc_id) ||
          (t.name === e.character_name)
        )
        if (initIdx >= 0) {
          const badgeR = Math.max(8, radius * 0.35)
          const bx = cx - radius * 0.7
          const by = cy - radius * 0.7
          ctx.beginPath()
          ctx.arc(bx, by, badgeR, 0, Math.PI * 2)
          ctx.fillStyle = initiativeOrder[initIdx].is_active ? '#7fc458' : '#242424'
          ctx.fill()
          ctx.strokeStyle = '#f5f2ee'
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.fillStyle = '#f5f2ee'
          ctx.font = `bold ${Math.max(8, badgeR * 1.2)}px Carlito`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(initIdx + 1), bx, by)
        }
      }

      ctx.globalAlpha = 1
    })

    // Ping — double pulsing ring that fades out (GM=orange, player=green)
    if (ping) {
      const pingCx = offsetX + ping.gx * cellSize + cellSize / 2
      const pingCy = offsetY + ping.gy * cellSize + cellSize / 2
      const pingProgress = Math.min(1, ping.t)
      const pingRadius = cellSize * 0.5 + cellSize * 1.5 * pingProgress
      const pingAlpha = 1 - pingProgress
      ctx.beginPath()
      ctx.arc(pingCx, pingCy, pingRadius, 0, Math.PI * 2)
      ctx.strokeStyle = ping.color
      ctx.lineWidth = 3
      ctx.globalAlpha = pingAlpha
      ctx.stroke()
      if (pingProgress < 0.3) {
        ctx.beginPath()
        ctx.arc(pingCx, pingCy, cellSize * 0.2, 0, Math.PI * 2)
        ctx.fillStyle = ping.color
        ctx.globalAlpha = pingAlpha
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ping.t += 0.02
      if (ping.t >= 1) {
        if (ping.count > 1) {
          setPing({ ...ping, t: 0, count: ping.count - 1 })
        } else {
          setPing(null)
        }
      } else {
        hasActiveAnim = true
      }
    }

    ctx.restore() // undo zoom scale

    // Continue animation loop if tokens are still moving
    if (hasActiveAnim) {
      animFrameRef.current = requestAnimationFrame(draw)
    }
  }

  // Mouse handlers
  function getGridPos(e: React.MouseEvent): { gx: number; gy: number } | null {
    if (!canvasRef.current || !scene) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const cellSize = getCellSize()
    const gridW = scene.grid_cols * cellSize
    const gridH = scene.grid_rows * cellSize
    const offsetX = (canvasRef.current.width - gridW) / 2
    const offsetY = (canvasRef.current.height - gridH) / 2
    const mx = (e.clientX - rect.left) / zoom
    const my = (e.clientY - rect.top) / zoom
    const gx = Math.floor((mx - 0) / cellSize)
    const gy = Math.floor((my - 0) / cellSize)
    if (gx < 0 || gx >= scene.grid_cols || gy < 0 || gy >= scene.grid_rows) return null
    return { gx, gy }
  }

  function getTokenAt(gx: number, gy: number): Token | undefined {
    // Multi-cell objects cover (grid_x, grid_y) through (+gw-1, +gh-1).
    // Clicking ANY cell in that footprint selects the token. PCs/NPCs
    // (gw=gh=1) collapse to the original exact-cell match.
    return tokens.find(t => {
      if (!(t.is_visible || isGM)) return false
      const gw = t.grid_w ?? 1
      const gh = t.grid_h ?? 1
      return gx >= t.grid_x && gx < t.grid_x + gw && gy >= t.grid_y && gy < t.grid_y + gh
    })
  }

  // Pan starts on mousedown. Move/up are handled by the React onMouseMove
  // / onMouseUp on the canvas (see handleMouseMove pan branch + handleMouseUp
  // pan branch). Window-level listener variant was tried earlier and broke
  // baseline pan; reverted to React handlers which work reliably.
  function startPan(startClientX: number, startClientY: number) {
    if (!containerRef.current) return
    setPanning({
      startX: startClientX,
      startY: startClientY,
      startPanX: containerRef.current.scrollLeft,
      startPanY: containerRef.current.scrollTop,
    })
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Throw-to-cell — click a valid cell to drop the grenade there.
    // Checked BEFORE moveMode because a GM/player in throwMode never
    // wants to accidentally fall through to move-click semantics.
    if (throwMode) {
      const pos = getGridPos(e)
      if (pos && scene) {
        const ft = scene.cell_feet ?? 3
        const rangeCells = Math.floor(throwMode.rangeFeet / ft)
        const throwerTok = tokens.find(t =>
          (throwMode.attackerCharId && t.character_id === throwMode.attackerCharId) ||
          (throwMode.attackerNpcId && t.npc_id === throwMode.attackerNpcId)
        )
        if (throwerTok) {
          const dist = Math.max(Math.abs(pos.gx - throwerTok.grid_x), Math.abs(pos.gy - throwerTok.grid_y))
          if (dist <= rangeCells) {
            // Friendly-fire confirm — for Blast Radius weapons, scan
            // the 100ft far-band for any token whose character_id is
            // in the friendlyCharacterIds list. If we find any, prompt
            // the player by name + band before firing the throw.
            // Cancel keeps throwMode active so they can pick again
            // without re-clicking the Attack button.
            // Friendly-fire scan now includes the attacker themselves
            // (the splash code no longer carves out the thrower per
            // CRB p.71-72 — they take damage if they're in radius).
            // Self-hits get a (YOU) tag in the confirm dialog so the
            // player knows what they're doing before they cook off a
            // grenade at their own feet.
            const friendlies = throwMode.friendlyCharacterIds ?? []
            const attackerCharId = throwMode.attackerCharId
            if (throwMode.hasBlast && (friendlies.length > 0 || attackerCharId)) {
              // Per playtest 2026-04-27: blast only damages Engaged and
              // Close. Anything beyond 30ft takes no damage, so don't
              // warn the player about it.
              const engagedCells = Math.max(1, Math.round(5 / ft))
              const closeCells = Math.max(1, Math.round(30 / ft))
              const hits: { name: string; band: string; isSelf: boolean }[] = []
              for (const tok of tokens) {
                if (!tok.character_id) continue
                const isSelf = !!attackerCharId && tok.character_id === attackerCharId
                const isFriendly = friendlies.includes(tok.character_id)
                if (!isSelf && !isFriendly) continue
                const d = Math.max(Math.abs(tok.grid_x - pos.gx), Math.abs(tok.grid_y - pos.gy))
                if (d > closeCells) continue
                const band = d <= engagedCells ? 'Engaged' : 'Close'
                hits.push({ name: tok.name, band, isSelf })
              }
              if (hits.length > 0) {
                const list = hits.map(h => `  • ${h.name}${h.isSelf ? ' (YOU)' : ''} (${h.band})`).join('\n')
                const ok = window.confirm(`This blast will hit:\n\n${list}\n\nThrow anyway?`)
                if (!ok) return // stay in throwMode so the player can pick a different cell
              }
            }
            onThrowComplete?.(pos.gx, pos.gy)
            return
          }
        }
      }
      // Out-of-range click — cancel so the player can retry or back out.
      onThrowCancel?.()
      return
    }
    // Move mode — click a valid cell to move the token there
    if (moveMode) {
      const pos = getGridPos(e)
      if (pos && scene) {
        const ft = scene.cell_feet ?? 3
        const moveCells = Math.floor(moveMode.feet / ft)
        const moveTok = tokens.find(t =>
          (moveMode.characterId && t.character_id === moveMode.characterId) ||
          (moveMode.npcId && t.npc_id === moveMode.npcId) ||
          (moveMode.objectTokenId && t.id === moveMode.objectTokenId)
        )
        if (moveTok) {
          const dist = Math.max(Math.abs(pos.gx - moveTok.grid_x), Math.abs(pos.gy - moveTok.grid_y))
          const occupied = new Set(tokens.filter(t => t.id !== moveTok.id).map(t => `${t.grid_x},${t.grid_y}`))
          if (dist > 0 && dist <= moveCells && !occupied.has(`${pos.gx},${pos.gy}`)) {
            // Animate and move
            const fromX = moveTok.grid_x * cellPx + cellPx / 2
            const fromY = moveTok.grid_y * cellPx + cellPx / 2
            const toX = pos.gx * cellPx + cellPx / 2
            const toY = pos.gy * cellPx + cellPx / 2
            tokenAnimRef.current.set(moveTok.id, { fromX, fromY, toX, toY, t: 0 })
            setTokens(prev => prev.map(t => t.id === moveTok.id ? { ...t, grid_x: pos.gx, grid_y: pos.gy } : t))
            supabase.from('scene_tokens').update({ grid_x: pos.gx, grid_y: pos.gy }).eq('id', moveTok.id).then(() => {
              tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_moved', payload: {} })
              onMoveComplete?.()
            })
            return
          }
        }
      }
      return
    }
    // Spacebar held = always pan
    if (spaceHeld) {
      startPan(e.clientX, e.clientY)
      return
    }
    const pos = getGridPos(e)
    // Alt+left-click on ANY cell (empty or with a token) fires a ping.
    // Bumped above the token-click branch per Xero — the previous
    // "empty-cell only" gate meant you couldn't ping a specific NPC's
    // location, which is the most common case.
    if (pos && e.altKey) {
      const color = isGM ? '#EF9F27' : '#7fc458'
      setPing({ gx: pos.gx, gy: pos.gy, t: 0, color, count: 2 })
      pingChannelRef.current?.send({ type: 'broadcast', event: 'gm_ping', payload: { gx: pos.gx, gy: pos.gy, color } })
      return
    }
    if (pos) {
      const tok = getTokenAt(pos.gx, pos.gy)
      if (tok) {
        setSelectedToken(tok.id)
        onTokenSelect?.(tok)
        // Drag permission:
        //   - GM: always (can reposition any token at any time)
        //   - Player: only their own PC token, AND only if they still have
        //     actions remaining this round. Once actions_remaining hits 0,
        //     their token is locked until their next turn — playtest #10.
        //     Out of combat (no initiative entry exists), always draggable.
        const ownInitEntry = tok.character_id
          ? initiativeOrder.find((e: any) => e.character_id === tok.character_id)
          : null
        const playerLocked = ownInitEntry != null && (ownInitEntry.actions_remaining ?? 0) <= 0
        // A non-GM player can drag a token if (a) it's their own PC and
        // they aren't action-locked, OR (b) it's an object the GM has
        // explicitly added them to via the Edit Object → Controlled By
        // list (e.g. the driver of a vehicle moving the vehicle token).
        const isControlledObject = !!myCharacterId
          && tok.token_type === 'object'
          && Array.isArray(tok.controlled_by_character_ids)
          && tok.controlled_by_character_ids.includes(myCharacterId)
        const canDrag = isGM
          || (!!myCharacterId && tok.character_id === myCharacterId && !playerLocked)
          || isControlledObject
        if (canDrag && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect()
          const mx = (e.clientX - rect.left) / zoom
          const my = (e.clientY - rect.top) / zoom
          const cellSize = getCellSize()
          const tokCx = tok.grid_x * cellSize + cellSize / 2
          const tokCy = tok.grid_y * cellSize + cellSize / 2
          setDragging({ tokenId: tok.id, offsetX: tokCx - mx, offsetY: tokCy - my })
          dragPosRef.current = { px: tokCx, py: tokCy }
        }
        return
      }
    }
    // Check if clicking a resize handle (corners of the map image)
    if (isGM && !mapLocked && bgImageRef.current && canvasRef.current && containerRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      // Convert to canvas-space (undo zoom so coordinates match where handles are drawn)
      const mx = (e.clientX - rect.left) / zoom
      const my = (e.clientY - rect.top) / zoom
      const m = mapDrawRef.current
      const hs = 14 // hit area slightly larger than visual handle
      const corners = [
        { name: 'tl', x: m.x, y: m.y },
        { name: 'tr', x: m.x + m.w - hs, y: m.y },
        { name: 'bl', x: m.x, y: m.y + m.h - hs },
        { name: 'br', x: m.x + m.w - hs, y: m.y + m.h - hs },
      ]
      for (const c of corners) {
        if (mx >= c.x && mx <= c.x + hs && my >= c.y && my <= c.y + hs) {
          console.warn('[TacticalMap] resize start:', c.name, 'zoom:', zoom)
          setResizing({ corner: c.name, startX: e.clientX, startY: e.clientY, startZoom: imgScale })
          return
        }
      }
    }
    // No token or handle clicked — start panning (unless locked)
    setSelectedToken(null)
    onTokenSelect?.(null)
    if (!mapLocked) {
      startPan(e.clientX, e.clientY)
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    // Update blast preview hover cell first so it tracks even while
    // the player is panning / dragging in the rare overlap case.
    updateThrowHover(e)
    if (resizing) {
      const delta = e.clientX - resizing.startX
      const scaleDelta = delta / 300
      setImgScale(Math.max(0.1, Math.min(5, resizing.startZoom + scaleDelta)))
      return
    }
    if (panning && containerRef.current) {
      const dx = e.clientX - panning.startX
      const dy = e.clientY - panning.startY
      // Buffer the target and let requestAnimationFrame flush it at the
      // browser's paint cadence. Mousemove can fire hundreds of times per
      // second; writing scroll every time thrashes layout. rAF coalesces
      // into one write per frame.
      panTargetRef.current = { x: panning.startPanX - dx, y: panning.startPanY - dy }
      if (panRAFRef.current == null) {
        panRAFRef.current = requestAnimationFrame(() => {
          panRAFRef.current = null
          const t = panTargetRef.current
          if (t && containerRef.current) {
            containerRef.current.scrollLeft = t.x
            containerRef.current.scrollTop = t.y
          }
        })
      }
      return
    }
    if (dragging && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / zoom
      const my = (e.clientY - rect.top) / zoom
      dragPosRef.current = { px: mx + dragging.offsetX, py: my + dragging.offsetY }
      // Coalesce redraws to one per animation frame (playtest #28). Calling
      // draw() synchronously on every mousemove forced a full canvas
      // repaint at whatever rate the mouse fires (can be 500Hz+ on gaming
      // mice), which visibly stuttered and burnt GPU time. rAF keeps the
      // dragged token locked to cursor at the browser's paint cadence.
      if (dragRAFRef.current == null) {
        dragRAFRef.current = requestAnimationFrame(() => {
          dragRAFRef.current = null
          draw()
        })
      }
    }
  }

  // While in throwMode, track the hovered grid cell so draw() can paint
  // the blast preview rings (Engaged/Close/Far) under the cursor. Mouse
  // events fire often; throttling isn't worth it because draw() already
  // skips redundant frames via the same dependency array.
  function updateThrowHover(e: React.MouseEvent) {
    if (!throwMode?.hasBlast) {
      if (throwHoverCell) setThrowHoverCell(null)
      return
    }
    const pos = getGridPos(e)
    if (!pos) {
      if (throwHoverCell) setThrowHoverCell(null)
      return
    }
    if (!throwHoverCell || throwHoverCell.gx !== pos.gx || throwHoverCell.gy !== pos.gy) {
      setThrowHoverCell({ gx: pos.gx, gy: pos.gy })
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (resizing) {
      setResizing(null)
      return
    }
    if (panning) {
      // Flush any pending rAF so the last pan target lands before release.
      if (panRAFRef.current != null) {
        cancelAnimationFrame(panRAFRef.current)
        panRAFRef.current = null
        const t = panTargetRef.current
        if (t && containerRef.current) {
          containerRef.current.scrollLeft = t.x
          containerRef.current.scrollTop = t.y
        }
      }
      panTargetRef.current = null
      setPanning(null)
      return
    }
    if (!dragging) return
    const tokenId = dragging.tokenId
    const tok = tokensRef.current.find(t => t.id === tokenId)
    const pos = getGridPos(e)
    const moved = pos && tok && (pos.gx !== tok.grid_x || pos.gy !== tok.grid_y)
    // Distance gate for player drags (playtest #24): a player dragging their
    // own PC token is performing a Move action, capped at 1 move = ~10ft =
    // 3 cells at 3ft/cell (or ceil(10/cell_feet) for other grid scales). GMs
    // bypass this entirely — they can reposition any token anywhere.
    // Out-of-combat (no initiative entry) also bypasses.
    const isPlayerDrag = !isGM && tok && myCharacterId && tok.character_id === myCharacterId
    const ownInit = isPlayerDrag && tok ? initiativeOrder.find((ie: any) => ie.character_id === tok.character_id) : null
    const inCombat = !!ownInit
    const cellFt = sceneRef.current?.cell_feet ?? 3
    const maxMoveCells = Math.max(1, Math.ceil(10 / cellFt))
    const dragDistCells = pos && tok ? Math.max(Math.abs(pos.gx - tok.grid_x), Math.abs(pos.gy - tok.grid_y)) : 0
    const outOfRange = isPlayerDrag && inCombat && moved && dragDistCells > maxMoveCells
    if (outOfRange) {
      alert(`Can't move that far — max ${maxMoveCells} cell${maxMoveCells === 1 ? '' : 's'} (${cellFt * maxMoveCells}ft) per Move action.`)
    }
    if (moved && dragPosRef.current && !outOfRange) {
      const toX = pos!.gx * cellPx + cellPx / 2
      const toY = pos!.gy * cellPx + cellPx / 2
      tokenAnimRef.current.set(tokenId, { fromX: dragPosRef.current.px, fromY: dragPosRef.current.py, toX, toY, t: 0 })
    }
    // Clear drag state synchronously — never block cursor release on DB I/O
    dragPosRef.current = null
    if (dragRAFRef.current != null) {
      cancelAnimationFrame(dragRAFRef.current)
      dragRAFRef.current = null
    }
    setDragging(null)
    if (moved && !outOfRange) {
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, grid_x: pos!.gx, grid_y: pos!.gy } : t))
      supabase.from('scene_tokens').update({ grid_x: pos!.gx, grid_y: pos!.gy }).eq('id', tokenId).then(({ error }: any) => {
        if (error) console.warn('[TacticalMap] token move failed:', error)
        else tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_moved', payload: {} })
      })
      // Player drag in combat costs 1 action. Parent handles the DB write
      // via consumeAction (no log entry — drag movement is self-evident from
      // the token animation on the map).
      if (isPlayerDrag && inCombat && tok && tok.character_id) {
        onPlayerDragMove?.(tok.character_id)
      }
      // GM drag of the active combatant's token — same 1-action cost as
      // a player drag. Without this branch the GM could drag an active NPC
      // (e.g. Frankie) across the map repeatedly with actions_remaining
      // never decrementing, so the round wouldn't advance. GM drags of
      // OFF-turn tokens stay free (existing cleanup / repositioning path).
      else if (isGM && tok && (tok.character_id || tok.npc_id)) {
        const activeEntry = initiativeOrder.find((ie: any) => ie.is_active)
        const isActiveTok = !!activeEntry && (
          (!!tok.character_id && activeEntry.character_id === tok.character_id) ||
          (!!tok.npc_id && activeEntry.npc_id === tok.npc_id)
        )
        if (isActiveTok) {
          onGMDragMove?.({ characterId: tok.character_id ?? undefined, npcId: tok.npc_id ?? undefined })
        }
      }
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    const pos = getGridPos(e)
    if (!pos) return
    const tok = getTokenAt(pos.gx, pos.gy)
    if (tok && onTokenClick) { onTokenClick(tok); return }
    // Bare double-click on empty cell does nothing — ping moved to
    // Alt+left-click on mousedown (single click). Removed Alt+double-
    // click duplicate path 2026-04-29.
  }

  // Scene management
  async function createScene() {
    const { data, error } = await supabase.from('tactical_scenes').insert({
      campaign_id: campaignId, name: setupName, grid_cols: setupCols, grid_rows: setupRows, cell_feet: 3, cell_px: 35, is_active: true, has_grid: setupHasGrid,
    }).select().single()
    if (error) { console.error('[TacticalMap] createScene error:', error.message); alert('Failed to create scene: ' + error.message); return }
    if (data) {
      // Deactivate other scenes
      await supabase.from('tactical_scenes').update({ is_active: false }).eq('campaign_id', campaignId).neq('id', data.id)
      setScene(data)
      setShowSetup(false)
      await loadScenes()
    }
  }

  async function activateScene(sceneId: string) {
    await supabase.from('tactical_scenes').update({ is_active: false }).eq('campaign_id', campaignId)
    await supabase.from('tactical_scenes').update({ is_active: true }).eq('id', sceneId)
    await loadScenes()
    // Force-push the scene switch to every connected client. Even if the
    // postgres_changes UPDATE on tactical_scenes is delivered, the
    // broadcast is a guaranteed nudge — particularly important so
    // players whose TacticalMap pane is closed open it on the new scene.
    tacticalChannelRef.current?.send({ type: 'broadcast', event: 'scene_activated', payload: { sceneId } })
  }

  // uploadBackground used to live here for the inline GM panel's
  // Upload Map button. The panel moved to /scene-controls-popout
  // which uploads on its own; the popout's write triggers our
  // tactical_scenes realtime sub and the canvas re-fetches the new
  // background_url. So this function was dead and got removed.

  async function autoPopulateTokens() {
    if (!scene) return
    // Clear existing tokens
    await supabase.from('scene_tokens').delete().eq('scene_id', scene.id)
    // Add tokens from initiative order
    const newTokens = initiativeOrder.map((entry: any, i: number) => ({
      scene_id: scene.id,
      name: entry.character_name,
      token_type: entry.is_npc ? 'npc' : 'pc',
      character_id: entry.character_id || null,
      npc_id: entry.npc_id || null,
      portrait_url: entry.portrait_url || null,
      grid_x: entry.is_npc ? 2 : 0,
      grid_y: Math.min(i * 2, scene.grid_rows - 1),
      is_visible: true,
      color: entry.is_npc ? '#c0392b' : '#7ab3d4',
    }))
    if (newTokens.length > 0) {
      await supabase.from('scene_tokens').insert(newTokens)
    }
    await loadTokens(scene.id)
  }

  // Fit-to-Map and Fit-to-Screen are extracted as named functions so
  // both the inline panel onClick AND the popped-out controls (via
  // BroadcastChannel) can trigger them. They depend on bgImageRef +
  // containerRef which only exist in this component, so the popout
  // can't run them itself — it sends a 'fit_to_map' / 'fit_to_screen'
  // command and we run it here.
  async function fitToMap() {
    if (!bgImageRef.current || !containerRef.current || !scene) return
    const img = bgImageRef.current
    const cw = containerRef.current.clientWidth
    const ch = containerRef.current.clientHeight
    const imgAspect = img.naturalWidth / img.naturalHeight
    let drawW: number, drawH: number
    if (imgAspect > cw / ch) { drawW = cw; drawH = cw / imgAspect }
    else { drawH = ch; drawW = ch * imgAspect }
    const localCellPx = Math.max(20, drawW / 30)
    const newCols = Math.round(drawW / localCellPx)
    const newRows = Math.round(drawH / localCellPx)
    setScene(p => p ? { ...p, grid_cols: newCols, grid_rows: newRows } : p)
    await supabase.from('tactical_scenes').update({ grid_cols: newCols, grid_rows: newRows }).eq('id', scene.id)
  }

  function fitToScreen() {
    const container = containerRef.current
    if (container && bgImageRef.current) {
      const containerW = container.clientWidth
      const img = bgImageRef.current
      setImgScale(img.naturalWidth > 0 ? containerW / img.naturalWidth : 1)
    } else {
      setImgScale(1)
    }
    setZoom(1)
    setPanX(0)
    setPanY(0)
    if (containerRef.current) { containerRef.current.scrollTop = 0; containerRef.current.scrollLeft = 0 }
  }

  // Scene-controls bus — keeps the popped-out controls window in sync.
  // State broadcasts go out whenever local UI state changes; commands
  // come in from the popout (Fit to Map, Fit to Screen, Place Tokens).
  const sceneControlsBusRef = useRef<SceneControlsBus | null>(null)
  // Suppress one outbound broadcast when applying an inbound state, to
  // prevent infinite echo loops between popout and main window.
  const sceneControlsSuppressRef = useRef(false)
  // Keep the latest command handlers in a ref so the bus useEffect can
  // call them without re-subscribing every render.
  const sceneControlsHandlersRef = useRef({
    fit_to_map: () => {},
    fit_to_screen: () => {},
    place_tokens: () => {},
  })
  sceneControlsHandlersRef.current = {
    fit_to_map: () => { fitToMap() },
    fit_to_screen: () => { fitToScreen() },
    place_tokens: () => { autoPopulateTokens() },
  }

  useEffect(() => {
    if (!isGM || !campaignId) return
    const bus = createSceneControlsBus(campaignId)
    if (!bus) return
    sceneControlsBusRef.current = bus

    const offState = bus.onState((key, value) => {
      sceneControlsSuppressRef.current = true
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
        setTimeout(() => { sceneControlsSuppressRef.current = false }, 0)
      }
    })

    const offCmd = bus.onCommand(name => {
      const fn = (sceneControlsHandlersRef.current as any)[name]
      if (typeof fn === 'function') fn()
    })

    const offReq = bus.onRequestSnapshot(() => {
      bus.postSnapshot({
        zoom, cellPx, showGrid, gridColor, gridOpacity,
        showRangeOverlay, mapLocked,
      })
    })

    return () => { offState(); offCmd(); offReq(); bus.close(); sceneControlsBusRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGM, campaignId])

  // Outbound state broadcasts — fire when local state changes due to a
  // user-driven setX in this window. Suppressed during inbound apply.
  useEffect(() => { if (!sceneControlsSuppressRef.current) sceneControlsBusRef.current?.postState('zoom', zoom) }, [zoom])
  useEffect(() => { if (!sceneControlsSuppressRef.current) sceneControlsBusRef.current?.postState('cellPx', cellPx) }, [cellPx])
  useEffect(() => { if (!sceneControlsSuppressRef.current) sceneControlsBusRef.current?.postState('showGrid', showGrid) }, [showGrid])
  useEffect(() => { if (!sceneControlsSuppressRef.current) sceneControlsBusRef.current?.postState('gridColor', gridColor) }, [gridColor])
  useEffect(() => { if (!sceneControlsSuppressRef.current) sceneControlsBusRef.current?.postState('gridOpacity', gridOpacity) }, [gridOpacity])
  useEffect(() => { if (!sceneControlsSuppressRef.current) sceneControlsBusRef.current?.postState('showRangeOverlay', showRangeOverlay) }, [showRangeOverlay])
  useEffect(() => { if (!sceneControlsSuppressRef.current) sceneControlsBusRef.current?.postState('mapLocked', mapLocked) }, [mapLocked])

  async function toggleTokenVisibility(tokenId: string) {
    const tok = tokens.find(t => t.id === tokenId)
    if (!tok) return
    await supabase.from('scene_tokens').update({ is_visible: !tok.is_visible }).eq('id', tokenId)
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, is_visible: !t.is_visible } : t))
    // Notify parent so it can broadcast token_changed — previously players had
    // to hard-refresh to see a Reveal. postgres_changes on scene_tokens may
    // not fire reliably for all clients (replication/RLS quirks); the
    // broadcast path is the reliable fallback.
    onTokenChanged?.()
  }

  async function removeToken(tokenId: string) {
    await supabase.from('scene_tokens').delete().eq('id', tokenId)
    setTokens(prev => prev.filter(t => t.id !== tokenId))
  }

  // No scene — show setup (z-index above NPC cards overlay)
  if (!scene && isGM) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', position: 'relative', zIndex: 1200 }}>
        {showSetup && (
          <div onClick={() => setShowSetup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '320px' }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem' }}>New Scene</div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Name</div>
                <input value={setupName} onChange={e => setSetupName(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowSetup(false)}
                  style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                <button onClick={createScene}
                  style={{ flex: 2, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!scene) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', position: 'relative', zIndex: 1200 }}>Waiting for GM to set up a scene...</div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', background: '#111', overflow: 'hidden' }}>
      {/* GM scene-controls used to live here as an inline 130-px left
          strip. Moved to a separate browser window — opened via the
          "Map Setup" header button on the table page (table/page.tsx).
          State syncs over BroadcastChannel; see lib/scene-controls-bus.ts
          and the bus handlers earlier in this file. The map canvas now
          gets the full table-page width. */}

      {/* Map canvas area — scrollable when zoomed */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Zoom control — top right */}
        <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>0%</span>
          <input type="range" min={25} max={100} step={5} value={Math.round(zoom * 100)}
            onChange={e => setZoom(Number(e.target.value) / 100)}
            style={{ width: '60px', accentColor: '#7ab3d4', cursor: 'pointer' }} />
          <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>100%</span>
        </div>
        <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto', contain: 'layout paint', overscrollBehavior: 'contain' }}>
        <canvas ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={undefined}
          style={{
            display: 'block',
            cursor: panning ? 'grabbing' : spaceHeld ? 'grab' : resizing ? 'nwse-resize' : dragging ? 'grabbing' : 'default',
            // Promote the canvas to its own GPU compositor layer so the
            // browser doesn't repaint the entire visible region on every
            // scroll write. Removes the 'twitch' that appears on large
            // backgrounds when the layout system has to recalculate
            // paint regions every mousemove. translateZ(0) is the
            // canonical layer-promotion hint; will-change reinforces it.
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        />
        </div>

      {/* Selected token info — bottom left */}
      {selectedToken && (() => {
        const tok = tokens.find(t => t.id === selectedToken)
        if (!tok) return null
        // Players who are listed in this token's controlled_by_character_ids
        // (e.g. the driver of a vehicle) get the Rot slider here too —
        // matches the GM's instant-feedback experience for their own
        // controllable tokens. Size / Cells / Hide / Remove / Edit
        // stay GM-only since those are bookkeeping ops the player
        // shouldn't tweak.
        const isControllerOfThis = !!myCharacterId
          && Array.isArray(tok.controlled_by_character_ids)
          && tok.controlled_by_character_ids.includes(myCharacterId)
        const canRotate = isGM || isControllerOfThis
        return (
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 10, background: 'rgba(15,15,15,.9)', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '8px 12px', minWidth: '150px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{tok.name}</div>
              <button onClick={() => setSelectedToken(null)} style={{ background: 'none', border: 'none', color: '#5a5550', fontSize: '14px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{tok.token_type} · {String.fromCharCode(65 + tok.grid_x)}{tok.grid_y + 1}</div>
            {/* WP bar — object tokens only. Falls back to the matching
                vehicle's wp_max/wp_current when the token itself was
                placed without those stats copied across. Same fallback
                logic as ObjectCard so the two surfaces agree. */}
            {tok.token_type === 'object' && (() => {
              const veh = vehicles?.find(v => v.name === tok.name)
              const wpMax = tok.wp_max ?? veh?.wp_max ?? null
              const wpCurrent = tok.wp_current ?? veh?.wp_current ?? wpMax
              if (!wpMax || wpMax <= 0) return null
              const pct = Math.max(0, Math.min(1, (wpCurrent ?? wpMax) / wpMax))
              const barColor = pct > 0.66 ? '#7fc458' : pct > 0.33 ? '#EF9F27' : '#c0392b'
              return (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '2px' }}>
                    <span>WP</span>
                    <span>{wpCurrent ?? wpMax} / {wpMax}</span>
                  </div>
                  <div style={{ height: '6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct * 100}%`, background: barColor, transition: 'width 0.2s' }} />
                  </div>
                </div>
              )
            })()}
            {/* Action buttons — split into two groups so the GM-only
                ones (Hide/Reveal/Remove/Edit) stay gated while Move
                is available to anyone who can rotate the token (i.e.
                listed in controlled_by_character_ids). */}
            {(isGM || (canRotate && tok.token_type === 'object' && onObjectMove)) && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                {canRotate && tok.token_type === 'object' && onObjectMove && (
                  <button onClick={() => { onObjectMove(tok.id); setSelectedToken(null) }}
                    style={{ padding: '2px 6px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '2px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Move
                  </button>
                )}
                {isGM && (
                  <button onClick={() => toggleTokenVisibility(tok.id)}
                    style={{ padding: '2px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: tok.is_visible ? '#7fc458' : '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                    {tok.is_visible ? 'Hide' : 'Reveal'}
                  </button>
                )}
                {isGM && (
                  <button onClick={() => { removeToken(tok.id); setSelectedToken(null) }}
                    style={{ padding: '2px 6px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
                {isGM && tok.token_type === 'object' && onTokenClick && (
                  <button onClick={() => { onTokenClick(tok); setSelectedToken(null) }}
                    style={{ padding: '2px 6px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '2px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Edit
                  </button>
                )}
              </div>
            )}
            {(isGM || canRotate) && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {isGM && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', width: '30px' }}>Size</span>
                  <input type="range" min={0.3} max={10} step={0.1} value={tok.scale ?? 1}
                    onChange={async e => {
                      const v = parseFloat(e.target.value)
                      setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, scale: v } : t))
                      await supabase.from('scene_tokens').update({ scale: v }).eq('id', tok.id)
                    }}
                    style={{ flex: 1, accentColor: '#7ab3d4', cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', width: '28px', textAlign: 'right' }}>{((tok.scale ?? 1) * 100).toFixed(0)}%</span>
                </div>
                )}
                {canRotate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', width: '30px' }}>Rot</span>
                  <input type="range" min={0} max={360} step={5} value={tok.rotation ?? 0}
                    onChange={async e => {
                      const v = parseFloat(e.target.value)
                      setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, rotation: v } : t))
                      await supabase.from('scene_tokens').update({ rotation: v }).eq('id', tok.id)
                    }}
                    style={{ flex: 1, accentColor: '#EF9F27', cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', width: '28px', textAlign: 'right' }}>{(tok.rotation ?? 0).toFixed(0)}°</span>
                </div>
                )}
                {/* Multi-cell footprint controls — objects only, GM only.
                    PCs/NPCs are always 1×1 (their visual is already cell-
                    sized via the scale slider). */}
                {isGM && tok.token_type === 'object' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', width: '30px' }}>Cells</span>
                    <input type="number" min={1} max={20} step={1} value={tok.grid_w ?? 1}
                      title="Width in cells"
                      onChange={async e => {
                        const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                        setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, grid_w: v } : t))
                        await supabase.from('scene_tokens').update({ grid_w: v }).eq('id', tok.id)
                      }}
                      style={{ width: '46px', padding: '2px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center' }} />
                    <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>×</span>
                    <input type="number" min={1} max={20} step={1} value={tok.grid_h ?? 1}
                      title="Height in cells"
                      onChange={async e => {
                        const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                        setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, grid_h: v } : t))
                        await supabase.from('scene_tokens').update({ grid_h: v }).eq('id', tok.id)
                      }}
                      style={{ width: '46px', padding: '2px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Scene setup modal */}
      {showSetup && (
        <div onClick={() => setShowSetup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '320px' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '1rem' }}>New Scene</div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Name</div>
              <input value={setupName} onChange={e => setSetupName(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowSetup(false)}
                style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createScene}
                style={{ flex: 2, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Create</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// Wrap in memo so re-renders triggered by parent updates that don't
// change ANY of TacticalMap's props (chat messages, modal toggles,
// rolls feed updates) skip the entire canvas component. Default
// shallow comparison is sufficient — the parent passes data props
// by reference (initiativeOrder / entries / campaignNpcs / vehicles
// / mapTokens) and stabilized callbacks via useStableCallback. When
// any data ref changes (real combat update), props differ and the
// component renders normally.
export default memo(TacticalMap)
