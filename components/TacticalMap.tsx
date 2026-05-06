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
  // Phase 2 vision: door semantics for object tokens. When is_door
  // is true, click-to-toggle door_open instead of select. Closed
  // doors block movement INTO their cell. Visual: open=dashed; closed=solid + 🚪.
  is_door?: boolean | null
  door_open?: boolean | null
  // Walls + windows. Walls block movement + vision unconditionally.
  // Windows block movement (you're not walking through glass) but
  // vision passes through — a PC behind a window still illuminates
  // fog beyond it.
  is_wall?: boolean | null
  is_window?: boolean | null
  // Per-token vision radius (cells) — overrides the default 6 used
  // by the fog punch-through. Lets a torch-bearing PC illuminate
  // 8 cells, a sneaking scout 4, etc. NPC tokens can also carry a
  // value for future Phase 3 NPC-vision work.
  sight_radius_cells?: number | null
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
  show_grid?: boolean | null
  grid_color?: string | null
  grid_opacity?: number | null
  // GM-painted fog. Sparse map keyed by "x,y" (cell coords) — only
  // fogged cells stored, missing key = clear. Players see fogged
  // cells as opaque black + tokens inside fog are hidden from their
  // render. GM sees fog at reduced opacity. Phase 1 of the vision
  // system; sql/tactical-scenes-fog-state.sql.
  fog_state?: Record<string, boolean> | null
  // Wall/door/window segments. Each segment lives on cell edges
  // (drawn from intersection to intersection) so a wall is visually
  // thin instead of occupying a whole cell. See sql/tactical-scenes-walls.sql.
  walls?: WallSegment[] | null
  // Day/Night toggle per scene. Day = unbounded sight, only limited
  // by walls + closed doors (the "you can see for miles outdoors"
  // rule). Night = per-token sight_radius_cells governs how far
  // each PC can see (the "torch in the dark" rule). Default 'day'.
  lighting_mode?: 'day' | 'night' | null
}

interface WallSegment {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  kind: 'wall' | 'door' | 'window'
  door_open?: boolean   // only meaningful when kind === 'door'
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
  vehicles?: {
    name: string
    wp_max?: number
    wp_current?: number
    speed?: number
    // Mounted weapons — only the fields TacticalMap reads to render
    // firing arc cones. Full vehicle interface lives in
    // components/VehicleCard.tsx; this is a narrowed contract.
    mounted_weapons?: {
      name: string
      mount_angle?: number
      arc_degrees?: number
    }[]
  }[]
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
  // Multistory Path B — when set, the token-action panel renders a
  // scene picker so the GM can shunt the token to another scene
  // (e.g. PCs going upstairs in a multi-floor building). Initiative
  // entries are campaign-scoped, so combat continuity is preserved
  // automatically; only scene_tokens.scene_id needs to flip.
  const [movingTokenToScene, setMovingTokenToScene] = useState<string | null>(null)
  // Firing arc overlays — set of "tokenId:weaponIdx" strings the GM
  // wants visualized on the map. Lets a vehicle's front-mounted M60
  // (90° forward) render a translucent cone showing what the weapon
  // can actually hit, accounting for token rotation. Toggle per
  // weapon from the selected-token panel.
  const [firingArcs, setFiringArcs] = useState<Set<string>>(new Set())
  // Transient floating label after a door/window toggle. Coords are
  // in CELL units (so it follows zoom + pan correctly via the same
  // offsets the rest of the canvas uses). Auto-clears after ~1.6s.
  const [toggleLabel, setToggleLabel] = useState<{ x: number; y: number; text: string; key: number } | null>(null)
  function showToggleLabel(xCells: number, yCells: number, text: string) {
    const key = Date.now()
    setToggleLabel({ x: xCells, y: yCells, text, key })
    window.setTimeout(() => {
      setToggleLabel(prev => (prev && prev.key === key) ? null : prev)
    }, 1600)
  }
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
  // GM-painted fog editor state. fogEditMode null = play mode (fog is
  // a render-only display). 'paint' = drag to fog cells; 'erase' =
  // drag to clear cells. fogPainting = pointer is down + dragging.
  // Persisted to tactical_scenes.fog_state on a debounced write so
  // continuous-drag doesn't hammer the DB.
  // The scene-edit mode picker that lives in the (formerly) "Edit Fog"
  // toolbar. Fog tools (paint/erase/rect) and structure tools
  // (wall/door/window) all live here so the GM has one consolidated
  // editor instead of two competing toolbars. Name kept as
  // `fogEditMode` to avoid churning every callsite — it's "scene
  // edit mode" in spirit now.
  const [fogEditMode, setFogEditMode] = useState<'paint' | 'erase' | 'rect' | 'rect-erase' | 'wall' | 'door' | 'window' | null>(null)
  // GM fog/lighting toolbar position. Defaults to top-left (8,8) but
  // the GM can drag the ⠿ handle to reposition it — useful when the
  // toolbar is covering content the GM needs to interact with (e.g. a
  // token in the corner). Per-campaign localStorage so each GM's
  // preferred placement persists across sessions.
  const [fogBarPos, setFogBarPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 8, y: 8 }
    try {
      const saved = localStorage.getItem(`fog_bar_pos_${campaignId}`)
      if (saved) {
        const v = JSON.parse(saved)
        if (typeof v?.x === 'number' && typeof v?.y === 'number') return v
      }
    } catch {}
    return { x: 8, y: 8 }
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(`fog_bar_pos_${campaignId}`, JSON.stringify(fogBarPos)) } catch {}
  }, [fogBarPos, campaignId])
  const fogBarDragRef = useRef<{
    startX: number; startY: number; origX: number; origY: number
    barWidth: number; barHeight: number
    containerWidth: number; containerHeight: number
  } | null>(null)
  // The toolbar element ref — measured at drag-start so we know its
  // current width/height (the bar grows when Edit Fog expands the
  // paint/erase/rect controls). Used to clamp the drag target so the
  // toolbar can't be dragged past any edge of the canvas wrapper.
  const fogBarRef = useRef<HTMLDivElement | null>(null)
  function startFogBarDrag(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const bar = fogBarRef.current
    const container = bar?.parentElement // the canvas wrapper div
    if (!bar || !container) return
    const barRect = bar.getBoundingClientRect()
    const contRect = container.getBoundingClientRect()
    fogBarDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: fogBarPos.x,
      origY: fogBarPos.y,
      barWidth: barRect.width,
      barHeight: barRect.height,
      containerWidth: contRect.width,
      containerHeight: contRect.height,
    }
    const onMove = (mv: MouseEvent) => {
      const d = fogBarDragRef.current
      if (!d) return
      const dx = mv.clientX - d.startX
      const dy = mv.clientY - d.startY
      // Clamp so the toolbar can never be dragged off-screen. Floor
      // at (0, 0); ceiling at containerWidth/Height minus the bar's
      // own dimensions. Pre-fix the bar could be parked anywhere off
      // the visible canvas; the GM had to clear localStorage to
      // recover, which is unacceptable end-user UX.
      const maxX = Math.max(0, d.containerWidth - d.barWidth)
      const maxY = Math.max(0, d.containerHeight - d.barHeight)
      setFogBarPos({
        x: Math.min(maxX, Math.max(0, d.origX + dx)),
        y: Math.min(maxY, Math.max(0, d.origY + dy)),
      })
    }
    const onUp = () => {
      fogBarDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  function resetFogBarPos() {
    setFogBarPos({ x: 8, y: 8 })
  }
  const fogPaintingRef = useRef(false)
  const fogPendingSaveRef = useRef<number | null>(null)
  // Rectangle marquee for the 'rect' fog tool. Both corners are
  // captured in cell coords. While dragging, the canvas draws a
  // preview overlay; on mouseup, every cell inside the bounds gets
  // flipped into fog_state at once.
  // Rect-fog corners. Float cell-units (NOT integer-floored) so the
  // GM can drag a rectangle that doesn't snap to grid intersections.
  // On mouseup we compute which integer cells the float rectangle
  // overlaps and fog them in one batch.
  const [fogRectStart, setFogRectStart] = useState<{ x: number; y: number } | null>(null)
  const [fogRectEnd, setFogRectEnd] = useState<{ x: number; y: number } | null>(null)
  // Segment authoring state. wallDrawStart = the first intersection
  // the GM clicked; wallDrawHover = current cursor intersection for
  // the live preview line. On second click we commit the segment;
  // ESC clears the in-flight draw.
  const [wallsLocal, setWallsLocal] = useState<WallSegment[]>([])
  const wallsLocalRef = useRef<WallSegment[]>([])
  useEffect(() => { wallsLocalRef.current = wallsLocal }, [wallsLocal])
  const [wallDrawStart, setWallDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [wallDrawHover, setWallDrawHover] = useState<{ x: number; y: number } | null>(null)
  const wallsPendingSaveRef = useRef<number | null>(null)
  // Local mirror — the canonical fog state lives on `scene.fog_state`
  // but during a drag we update this immediately and persist on a
  // debounce; reconcile back to scene state when the realtime row
  // update lands.
  const [fogLocal, setFogLocal] = useState<Record<string, boolean>>({})
  const fogLocalRef = useRef<Record<string, boolean>>({})
  useEffect(() => { fogLocalRef.current = fogLocal }, [fogLocal])
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

  // Reconcile fog state from the scene row → local mirror. We don't
  // touch fogLocal during a drag (would get clobbered by realtime
  // echoes); we DO refresh from the row when the drag is idle so a
  // GM popout / second tab can land changes here.
  useEffect(() => {
    if (fogPaintingRef.current) return
    if (!scene) return
    const incoming = (scene.fog_state ?? {}) as Record<string, boolean>
    setFogLocal(incoming)
  }, [scene?.id, scene?.fog_state])

  // Same reconcile for wall segments. Authoring is click-based (not
  // drag), so there's no in-flight gate to worry about. We also run
  // a one-shot cleanup pass: any wall segments that overlap a door
  // or window get retroactively split, in case they were drawn
  // before auto-split shipped. If cleanup actually changed anything,
  // persist back to the DB so the next load is already clean.
  useEffect(() => {
    if (!scene) return
    const incoming = (scene.walls ?? []) as WallSegment[]
    const cleaned = cleanupOverlappingWalls(incoming)
    setWallsLocal(cleaned)
    if (isGM && cleaned.length !== incoming.length) {
      // Persist async — the local mirror is already correct.
      wallsLocalRef.current = cleaned
      scheduleWallsPersist()
    }
  }, [scene?.id, scene?.walls, isGM])

  // Retroactive auto-split: when a scene loads, walk every door /
  // window segment and slice any wall that overlaps it. Returns the
  // new array (walls split + openings preserved). Idempotent — a
  // second pass on already-clean data is a no-op.
  function cleanupOverlappingWalls(all: WallSegment[]): WallSegment[] {
    const openings = all.filter(w => w.kind === 'door' || w.kind === 'window')
    if (openings.length === 0) return all
    let walls = all.filter(w => w.kind === 'wall')
    for (const o of openings) {
      walls = splitOverlappingSegments(walls, o)
    }
    return [...walls, ...openings]
  }

  // Split any wall segments that overlap a new door/window/wall
  // segment on the same axis-aligned line. Returns the rewritten
  // array of pre-existing walls (with overlapping pieces sliced
  // out). The new segment itself is NOT included — caller appends.
  // Diagonal walls aren't split for v1 (no rotated buildings yet).
  function splitOverlappingSegments(existing: WallSegment[], inserted: WallSegment): WallSegment[] {
    // Tolerance for "same axis-aligned line" — float-precision
    // segment authoring means y-coords might differ by a tiny
    // fraction even when the GM clicked "the same wall." Anything
    // within ~1px at typical zoom counts as coincident.
    const EPS = 0.05
    const result: WallSegment[] = []
    const isHoriz = (s: WallSegment) => Math.abs(s.y1 - s.y2) < EPS
    const isVert  = (s: WallSegment) => Math.abs(s.x1 - s.x2) < EPS
    const insHoriz = isHoriz(inserted)
    const insVert  = isVert(inserted)
    if (!insHoriz && !insVert) return existing.slice() // diagonal — skip split
    for (const w of existing) {
      // Only walls auto-split. Doors and windows stay intact when a
      // new segment is drawn over them — the GM can manually right-
      // click delete those if they truly want to replace.
      if (w.kind !== 'wall') { result.push(w); continue }
      const wHoriz = isHoriz(w)
      const wVert  = isVert(w)
      // Same-axis check.
      if (insHoriz && wHoriz && Math.abs(w.y1 - inserted.y1) < EPS) {
        const wMin = Math.min(w.x1, w.x2)
        const wMax = Math.max(w.x1, w.x2)
        const iMin = Math.min(inserted.x1, inserted.x2)
        const iMax = Math.max(inserted.x1, inserted.x2)
        if (iMax <= wMin || iMin >= wMax) { result.push(w); continue }
        const y = w.y1
        if (iMin > wMin) {
          result.push({ id: crypto.randomUUID(), x1: wMin, y1: y, x2: iMin, y2: y, kind: 'wall' })
        }
        if (iMax < wMax) {
          result.push({ id: crypto.randomUUID(), x1: iMax, y1: y, x2: wMax, y2: y, kind: 'wall' })
        }
        // (No else — wall is fully consumed by overlap; drop it.)
      } else if (insVert && wVert && Math.abs(w.x1 - inserted.x1) < EPS) {
        const wMin = Math.min(w.y1, w.y2)
        const wMax = Math.max(w.y1, w.y2)
        const iMin = Math.min(inserted.y1, inserted.y2)
        const iMax = Math.max(inserted.y1, inserted.y2)
        if (iMax <= wMin || iMin >= wMax) { result.push(w); continue }
        const x = w.x1
        if (iMin > wMin) {
          result.push({ id: crypto.randomUUID(), x1: x, y1: wMin, x2: x, y2: iMin, kind: 'wall' })
        }
        if (iMax < wMax) {
          result.push({ id: crypto.randomUUID(), x1: x, y1: iMax, x2: x, y2: wMax, kind: 'wall' })
        }
      } else {
        result.push(w)
      }
    }
    return result
  }

  function scheduleWallsPersist() {
    if (!scene || !isGM) return
    const sceneId = scene.id
    if (wallsPendingSaveRef.current != null) {
      window.clearTimeout(wallsPendingSaveRef.current)
    }
    wallsPendingSaveRef.current = window.setTimeout(async () => {
      wallsPendingSaveRef.current = null
      await supabase.from('tactical_scenes').update({ walls: wallsLocalRef.current }).eq('id', sceneId)
    }, 200)
  }

  // Free-form mouse → cell-units conversion for wall/door/window
  // segment authoring. NOT rounded — segments now follow the cursor
  // pixel-precise so the GM can trace organic building shapes that
  // don't align to grid intersections. Doors and windows additionally
  // snap to nearby walls (see snapPointToNearestWall) so the
  // auto-split mechanic still works against arbitrary-angle walls.
  function getSegmentEndpoint(e: React.MouseEvent): { x: number; y: number } | null {
    if (!canvasRef.current || !scene) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const cellSize = getCellSize()
    const mx = (e.clientX - rect.left) / zoom
    const my = (e.clientY - rect.top) / zoom
    const x = Math.max(0, Math.min(scene.grid_cols, mx / cellSize))
    const y = Math.max(0, Math.min(scene.grid_rows, my / cellSize))
    return { x, y }
  }

  // Project a point onto the nearest WALL segment within `threshold`
  // cells. Returns the projected point if a wall is close enough, or
  // the original point otherwise. Used for door + window authoring
  // so a click-near-wall lands ON the wall's line — guaranteeing the
  // auto-split overlap check finds a match even with a fuzzy click.
  function snapPointToNearestWall(p: { x: number; y: number }, threshold = 0.45): { x: number; y: number } {
    let best: { x: number; y: number } | null = null
    let bestDist = threshold
    for (const w of wallsLocalRef.current) {
      if (w.kind !== 'wall') continue
      const dx = w.x2 - w.x1
      const dy = w.y2 - w.y1
      const len2 = dx * dx + dy * dy
      if (len2 < 1e-6) continue
      let t = ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / len2
      t = Math.max(0, Math.min(1, t))
      const px = w.x1 + t * dx
      const py = w.y1 + t * dy
      const d = Math.hypot(p.x - px, p.y - py)
      if (d < bestDist) { bestDist = d; best = { x: px, y: py } }
    }
    return best ?? p
  }

  // Cancel an in-flight wall draw on Escape. Useful when the GM
  // started a segment and changed their mind.
  useEffect(() => {
    if (!wallDrawStart) return
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        setWallDrawStart(null)
        setWallDrawHover(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wallDrawStart])

  // Debounced fog persist. Called from paint/erase mouse handlers; we
  // batch up to 300ms of drag activity into one DB update so a smooth
  // mouse drag doesn't fire 60 writes per second.
  function scheduleFogPersist() {
    if (!scene || !isGM) return
    const sceneId = scene.id
    if (fogPendingSaveRef.current != null) {
      window.clearTimeout(fogPendingSaveRef.current)
    }
    fogPendingSaveRef.current = window.setTimeout(async () => {
      fogPendingSaveRef.current = null
      const payload = fogLocalRef.current
      // Strip any keys whose value is false so the column stays sparse.
      const sparse: Record<string, boolean> = {}
      for (const k of Object.keys(payload)) if (payload[k]) sparse[k] = true
      await supabase.from('tactical_scenes').update({ fog_state: sparse }).eq('id', sceneId)
    }, 300)
  }

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
      // GM path: apply saved visual settings ONLY on first load or
      // scene switch. The lastSyncedSceneIdRef guard exists because
      // the GM's popout writes cellPx/imgScale to DB after a 400ms
      // debounce, which fires postgres_changes on the GM's main
      // window TacticalMap. Without the guard, every popout nudge
      // would re-run loadScenes and clobber the in-flight local
      // values that arrived via the bus seconds earlier.
      //
      // Player path: ALWAYS apply cellPx/imgScale from DB. Players
      // don't have a popout, can't make local changes, so there's
      // nothing to clobber. Pre-fix bug — when the GM adjusted
      // cellPx or imgScale via the popout, the player's view stayed
      // at the original first-load values forever, producing
      // dramatically different zoom/scale between GM and player
      // (the "scene looks different on player side" report).
      const isFirstLoad = lastSyncedSceneIdRef.current !== active.id
      if (isFirstLoad || !isGM) {
        if (active.cell_px) setCellPx(active.cell_px)
        if (active.img_scale) setImgScale(active.img_scale)
      }
      if (isFirstLoad) {
        setMapLocked(active.is_locked ?? false)
        // Grid render settings — persisted in tactical_scenes per
        // sql/tactical-scenes-grid-persist.sql so a main-window
        // refresh doesn't revert to the useState defaults.
        if (typeof active.show_grid === 'boolean') setShowGrid(active.show_grid)
        if (typeof active.grid_color === 'string' && active.grid_color) setGridColor(active.grid_color)
        if (typeof active.grid_opacity === 'number') setGridOpacity(active.grid_opacity)
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
        if (typeof first.show_grid === 'boolean') setShowGrid(first.show_grid)
        if (typeof first.grid_color === 'string' && first.grid_color) setGridColor(first.grid_color)
        if (typeof first.grid_opacity === 'number') setGridOpacity(first.grid_opacity)
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
      .on('broadcast', { event: 'firing_arc_toggle' }, (msg: any) => {
        // Cross-window arc toggle. The /vehicle popout broadcasts
        // { vehicleName, weaponIdx } when its 🎯 Show Arc button
        // gets clicked; we resolve the vehicle name to all matching
        // tokens on the active scene and flip each token+weapon
        // entry in firingArcs. Same effect as clicking the in-map
        // toggle, but it works from any window.
        const p = msg?.payload ?? {}
        const vehicleName: string | undefined = p.vehicleName
        const weaponIdx: number | undefined = p.weaponIdx
        if (!vehicleName || typeof weaponIdx !== 'number') return
        setFiringArcs(prev => {
          const next = new Set(prev)
          for (const tok of tokensRef.current) {
            if (tok.token_type !== 'object') continue
            if (tok.name !== vehicleName) continue
            const key = `${tok.id}:${weaponIdx}`
            if (next.has(key)) next.delete(key)
            else next.add(key)
          }
          return next
        })
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
  useEffect(() => { draw() }, [tokens, scene, selectedToken, zoom, showGrid, gridColor, gridOpacity, imgScale, cellPx, moveMode, throwMode, throwHoverCell, showRangeOverlay, ping, dragging, campaignNpcs, entries, fogLocal, fogEditMode, fogRectStart, fogRectEnd, wallsLocal, wallDrawStart, wallDrawHover, firingArcs, toggleLabel])

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

    // GM-painted fog overlay. Players see full opacity (cells are
    // hidden); GM sees a dimmer overlay so they can still inspect what
    // they've fogged. Drawn before tokens so token portraits go on
    // top for the GM (we'll separately suppress player-side tokens
    // sitting in fog below).
    //
    // PC vision punch-through: each PC token clears a Chebyshev
    // radius around itself from the rendered fog. Computed at draw
    // time so the GM's authored fog_state stays untouched — the GM
    // edit-mode view still shows the raw layer for predictable
    // painting. Out of edit mode, the GM sees what the players see.
    const VISION_RADIUS_CELLS = 30
    const rawFog = fogLocalRef.current
    let fogMap = rawFog
    // PC tokens that fire vision. PC-only by spec — NPCs don't lift
    // fog of war for players. is_visible=false (hidden NPC, but
    // shouldn't apply to a PC anyway) is also excluded as a safety.
    const pcVisionTokens = tokensRef.current.filter(t =>
      t.token_type !== 'object'
      && !!t.character_id
      && t.is_visible !== false
    )
    const hasPCs = pcVisionTokens.length > 0
    const hasPainted = Object.keys(rawFog).length > 0
    if (!fogEditMode && (hasPCs || hasPainted)) {
      // Build the segment + cell-based blocker sets. Both authoring
      // models coexist:
      //   • Wall/door/window SEGMENTS (cell edges, thin) — preferred,
      //     drawn via the toolbar's Wall/Door/Window tools.
      //   • Wall/door/window OBJECTS (whole-cell tokens, legacy) —
      //     still respected so existing scenes keep working.
      const segs = wallsLocalRef.current
      // Vision blockers: walls (always), closed doors, AND closed
      // windows (blinds/drapes drawn). Open windows (default state)
      // pass vision through the glass.
      const visionSegs = segs.filter(s =>
        s.kind === 'wall'
        || (s.kind === 'door' && s.door_open === false)
        || (s.kind === 'window' && s.door_open === false)
      )
      const cellBlockers = new Set<string>()
      for (const tok of tokensRef.current) {
        const blocks = !!tok.is_wall
          || (tok.is_door && tok.door_open === false)
          || (tok.is_window && tok.door_open === false)
        if (!blocks) continue
        const gw = tok.grid_w ?? 1
        const gh = tok.grid_h ?? 1
        for (let fx = 0; fx < gw; fx++) {
          for (let fy = 0; fy < gh; fy++) {
            cellBlockers.add(`${tok.grid_x + fx},${tok.grid_y + fy}`)
          }
        }
      }
      // Standard "do two segments cross" test (proper intersection,
      // touching endpoints don't count). Used for both segment LoS
      // and segment-based movement validation.
      function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
        const ccw = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
          (qx - px) * (ry - py) - (qy - py) * (rx - px)
        const d1 = ccw(cx, cy, dx, dy, ax, ay)
        const d2 = ccw(cx, cy, dx, dy, bx, by)
        const d3 = ccw(ax, ay, bx, by, cx, cy)
        const d4 = ccw(ax, ay, bx, by, dx, dy)
        return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
      }
      // True when ANY vision-blocking thing (segment OR cell) sits on
      // the line between origin cell center and candidate cell center.
      function losBlocked(ox: number, oy: number, tx: number, ty: number): boolean {
        if (ox === tx && oy === ty) return false
        const ax = ox + 0.5, ay = oy + 0.5
        const bx = tx + 0.5, by = ty + 0.5
        // Segment check
        for (const w of visionSegs) {
          if (segmentsCross(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2)) return true
        }
        // Legacy cell-block check (Bresenham). Only walks if there's
        // anything to potentially hit.
        if (cellBlockers.size === 0) return false
        let x = ox, y = oy
        const dx = Math.abs(tx - ox)
        const dy = Math.abs(ty - oy)
        const sx = ox < tx ? 1 : -1
        const sy = oy < ty ? 1 : -1
        let err = dx - dy
        for (let step = 0; step < dx + dy + 2; step++) {
          const e2 = 2 * err
          if (e2 > -dy) { err -= dy; x += sx }
          if (e2 < dx) { err += dx; y += sy }
          if (x === tx && y === ty) return false
          if (cellBlockers.has(`${x},${y}`)) return true
        }
        return false
      }
      const visible = new Set<string>()
      // Day mode: unbounded sight (only walls block). We sweep a
      // radius equal to the scene's diagonal so every cell is
      // candidate-visible; LoS check then trims to wall-bounded
      // visibility. Night mode: per-token sight_radius governs.
      const isDay = (s.lighting_mode ?? 'day') === 'day'
      const dayRadius = Math.max(s.grid_cols, s.grid_rows)
      for (const tok of pcVisionTokens) {
        const gw = tok.grid_w ?? 1
        const gh = tok.grid_h ?? 1
        // Per-token override (column added in
        // sql/scene-tokens-sight-radius.sql); falls back to the
        // default constant for legacy rows.
        const r = isDay ? dayRadius : (tok.sight_radius_cells ?? VISION_RADIUS_CELLS)
        for (let fx = 0; fx < gw; fx++) {
          for (let fy = 0; fy < gh; fy++) {
            const ox = tok.grid_x + fx
            const oy = tok.grid_y + fy
            for (let dx = -r; dx <= r; dx++) {
              for (let dy = -r; dy <= r; dy++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue
                const tx = ox + dx
                const ty = oy + dy
                if (losBlocked(ox, oy, tx, ty)) continue
                visible.add(`${tx},${ty}`)
              }
            }
          }
        }
      }
      const effective: Record<string, boolean> = {}
      // GM-painted fog: rendered when not currently in any PC's LoS.
      // (A PC standing in painted-fog cells punches through it.)
      for (const k of Object.keys(rawFog)) {
        if (rawFog[k] && !visible.has(k)) effective[k] = true
      }
      // Auto-fog: when at least one PC is on the scene, every cell
      // outside the PC LoS is also fogged. This is what makes
      // "closing a door re-hides what was beyond" work without the
      // GM painting fog there manually. Without PCs (e.g. GM staging
      // tokens before play starts), fog is purely manual.
      if (hasPCs) {
        for (let x = 0; x < s.grid_cols; x++) {
          for (let y = 0; y < s.grid_rows; y++) {
            const k = `${x},${y}`
            if (!visible.has(k)) effective[k] = true
          }
        }
      }
      fogMap = effective
    }
    const fogKeys = Object.keys(fogMap)
    if (fogKeys.length > 0) {
      const cellW = gridW / s.grid_cols
      const cellH = gridH / s.grid_rows
      ctx.save()
      ctx.fillStyle = isGM ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.92)'
      for (const k of fogKeys) {
        if (!fogMap[k]) continue
        const [gxStr, gyStr] = k.split(',')
        const gx = parseInt(gxStr, 10)
        const gy = parseInt(gyStr, 10)
        if (Number.isNaN(gx) || Number.isNaN(gy)) continue
        ctx.fillRect(offsetX + gx * cellW, offsetY + gy * cellH, cellW, cellH)
      }
      // Edit-mode hint: outline fogged cells so the GM can see the
      // patch boundaries clearly while painting.
      if (isGM && fogEditMode) {
        ctx.strokeStyle = 'rgba(196,167,240,0.5)'
        ctx.lineWidth = 1
        for (const k of fogKeys) {
          if (!fogMap[k]) continue
          const [gxStr, gyStr] = k.split(',')
          const gx = parseInt(gxStr, 10)
          const gy = parseInt(gyStr, 10)
          if (Number.isNaN(gx) || Number.isNaN(gy)) continue
          ctx.strokeRect(offsetX + gx * cellW + 0.5, offsetY + gy * cellH + 0.5, cellW - 1, cellH - 1)
        }
      }
      ctx.restore()
    }

    // Tokens. Sort so objects render first (bottom), then NPCs, then PCs
    // on top — canvas is painter's-algorithm, last draw wins. Prevents a
    // barrel or crate from covering a player token when they share a
    // neighboring cell. Stable within each tier via index fallback.
    const toks = [...tokensRef.current]
      // Player-side fog suppression: a token sitting in a fogged cell
      // is invisible to non-GM viewers. GM sees everything (their
      // overlay is only 35% opacity above). For multi-cell tokens we
      // check the token's anchor cell — close enough for v1; LoS-aware
      // hiding is Phase 3.
      .filter(t => isGM || !fogMap[`${t.grid_x},${t.grid_y}`])
      .sort((a, b) => {
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

      // Active combatant glow — pure white. Pre-fix this used the
      // friendly-disposition green (#7fc458), which was indistinguishable
      // from a friendly NPC's own border color and confused the GM about
      // who actually had the turn. White is the only ring that doesn't
      // collide with any disposition / faction color.
      const isActive = activeEntry && (
        (t.character_id && activeEntry.character_id === t.character_id) ||
        (t.npc_id && activeEntry.npc_id === t.npc_id) ||
        (t.name === activeEntry.character_name)
      )
      if (isActive) {
        ctx.shadowColor = '#ffffff'
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
        // Object-kind visual decision tree. Doors win first (they
        // have the most state — open/closed), then walls (always
        // solid), then windows (always transparent + mullion), then
        // generic objects fall through to the existing treatment.
        // Drawn for both portrait + emoji branches so custom art on
        // any of the three kinds picks up the right border treatment.
        const isDoor = !!t.is_door
        const doorOpen = isDoor ? (t.door_open ?? true) : true
        const isWall = !isDoor && !!t.is_wall
        const isWindow = !isDoor && !isWall && !!t.is_window
        // Helper: draw a stone "brick" texture inside the rect by
        // overlaying offset rectangles with subtle line work. Cheap,
        // canvas-only, no external image needed. ctx is passed in so
        // TS doesn't lose its non-null narrowing through the nested
        // function scope.
        function drawStoneFill(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
          const rows = Math.max(2, Math.round(h / 8))
          const rowH = h / rows
          c.save()
          c.fillStyle = '#3a3530'
          c.fillRect(x, y, w, h)
          c.strokeStyle = 'rgba(0,0,0,0.45)'
          c.lineWidth = 0.5
          for (let r = 0; r < rows; r++) {
            const ry = y + r * rowH
            c.beginPath()
            c.moveTo(x, ry)
            c.lineTo(x + w, ry)
            c.stroke()
            // Stagger vertical seam every other row to suggest
            // running-bond brickwork.
            const seamX = x + (r % 2 === 0 ? w / 2 : w / 4)
            c.beginPath()
            c.moveTo(seamX, ry)
            c.lineTo(seamX, ry + rowH)
            c.stroke()
            const seamX2 = x + (r % 2 === 0 ? 0 : 3 * w / 4)
            if (seamX2 > x && seamX2 < x + w) {
              c.beginPath()
              c.moveTo(seamX2, ry)
              c.lineTo(seamX2, ry + rowH)
              c.stroke()
            }
          }
          c.restore()
        }
        // Helper: draw a glass pane with a cross mullion. Used for
        // windows and any future "transparent obstacle" type. Windows
        // are see-through by default — the fill is barely-there blue
        // tint so the cell content stays fully readable; the mullion
        // is the structural cue that says "this is a window."
        function drawGlassFill(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
          c.save()
          c.fillStyle = 'rgba(122,179,212,0.06)'
          c.fillRect(x, y, w, h)
          c.strokeStyle = 'rgba(122,179,212,0.45)'
          c.lineWidth = 1
          // Vertical + horizontal mullion through the center of the
          // rect (suggests windowpane divisions).
          c.beginPath()
          c.moveTo(x + w / 2, y)
          c.lineTo(x + w / 2, y + h)
          c.moveTo(x, y + h / 2)
          c.lineTo(x + w, y + h / 2)
          c.stroke()
          c.restore()
        }
        const rectX = cx - drawW / 2
        const rectY = cy - drawH / 2
        if (portraitImg && portraitImg.complete && portraitImg.naturalWidth > 0) {
          // Open door fades so the cell beyond reads as passable.
          // Open window (default) is barely-tinted — vision passes
          // through clear glass. Closed window (blinds) renders at
          // full opacity to look "covered" and visually telegraph
          // that vision is blocked.
          const windowOpen = isWindow && (t.door_open !== false)
          if (isDoor && doorOpen) ctx.globalAlpha = 0.5
          if (isWindow) ctx.globalAlpha = windowOpen ? 0.3 : 0.95
          ctx.drawImage(portraitImg, rectX, rectY, drawW, drawH)
          ctx.globalAlpha = 1
          if (isDoor) {
            ctx.strokeStyle = doorOpen ? 'rgba(127,196,88,0.8)' : '#c0392b'
            ctx.lineWidth = doorOpen ? 1.5 : 3
            if (doorOpen) ctx.setLineDash([5, 4])
            ctx.strokeRect(rectX, rectY, drawW, drawH)
            ctx.setLineDash([])
          } else if (isWall) {
            ctx.strokeStyle = '#6b5e50'
            ctx.lineWidth = 3
            ctx.strokeRect(rectX, rectY, drawW, drawH)
          } else if (isWindow) {
            ctx.strokeStyle = '#7ab3d4'
            ctx.lineWidth = 2
            ctx.strokeRect(rectX, rectY, drawW, drawH)
            // Mullion cross laid over the portrait.
            ctx.save()
            ctx.strokeStyle = 'rgba(122,179,212,0.7)'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(cx, rectY)
            ctx.lineTo(cx, rectY + drawH)
            ctx.moveTo(rectX, cy)
            ctx.lineTo(rectX + drawW, cy)
            ctx.stroke()
            ctx.restore()
          } else {
            ctx.strokeStyle = selectedToken === t.id ? '#f5f2ee' : '#EF9F27'
            ctx.lineWidth = selectedToken === t.id ? 3 : 1.5
            ctx.strokeRect(rectX, rectY, drawW, drawH)
          }
        } else {
          // Emoji-rendered objects. Walls get a stone-brick fill +
          // dark border (no emoji — the texture is the visual);
          // windows get the glass + mullion treatment; doors keep
          // the existing open/closed colorway; everything else
          // falls back to the generic object look.
          if (isWall) {
            drawStoneFill(ctx, rectX, rectY, drawW, drawH)
            ctx.strokeStyle = selectedToken === t.id ? '#f5f2ee' : '#6b5e50'
            ctx.lineWidth = selectedToken === t.id ? 3 : 2
            ctx.strokeRect(rectX, rectY, drawW, drawH)
          } else if (isWindow) {
            // OPEN window (default) = clear glass: barely-there blue
            // tint + cross mullion + sky-blue frame. Vision passes.
            // CLOSED window = blinds: solid muted-amber fill, no
            // mullion (you can't see the glass through the blinds),
            // amber border. Vision blocked.
            const winOpen = t.door_open !== false
            if (winOpen) {
              drawGlassFill(ctx, rectX, rectY, drawW, drawH)
            } else {
              ctx.fillStyle = '#3e3220'
              ctx.fillRect(rectX, rectY, drawW, drawH)
              // Horizontal slats — fast suggestion of blinds without
              // a real texture.
              ctx.strokeStyle = 'rgba(168,146,74,0.6)'
              ctx.lineWidth = 1
              const slats = Math.max(3, Math.round(drawH / 6))
              for (let s = 1; s < slats; s++) {
                const sy = rectY + (drawH * s) / slats
                ctx.beginPath()
                ctx.moveTo(rectX, sy)
                ctx.lineTo(rectX + drawW, sy)
                ctx.stroke()
              }
            }
            ctx.strokeStyle = selectedToken === t.id ? '#f5f2ee'
              : (winOpen ? '#7ab3d4' : '#a8924a')
            ctx.lineWidth = selectedToken === t.id ? 3 : (winOpen ? 2 : 3)
            ctx.strokeRect(rectX, rectY, drawW, drawH)
          } else {
            // Open-door fill is much subtler than a closed door so the
            // visual immediately reads as "passable."
            const fill = isDoor && doorOpen
              ? 'rgba(127,196,88,0.18)'
              : (t.is_visible ? (t.color || '#EF9F27') : 'rgba(239,159,39,0.3)')
            ctx.fillStyle = fill
            ctx.fillRect(rectX, rectY, drawW, drawH)
            if (isDoor) {
              ctx.strokeStyle = doorOpen ? 'rgba(127,196,88,0.8)' : '#c0392b'
              ctx.lineWidth = doorOpen ? 1.5 : 3
              if (doorOpen) ctx.setLineDash([5, 4])
              ctx.strokeRect(rectX, rectY, drawW, drawH)
              ctx.setLineDash([])
            } else {
              ctx.strokeStyle = selectedToken === t.id ? '#f5f2ee' : 'rgba(255,255,255,0.6)'
              ctx.lineWidth = selectedToken === t.id ? 3 : 1
              ctx.strokeRect(rectX, rectY, drawW, drawH)
            }
          }
          // Emoji or initials. Walls render their texture only — no
          // emoji label — so the brickwork stays clean.
          if (!isWall) {
            ctx.fillStyle = '#f5f2ee'
            ctx.font = `${Math.max(12, radius * 1.2)}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const initials = t.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
            const label = isDoor ? '🚪' : isWindow ? '🪟' : initials
            ctx.fillText(label, cx, cy)
          }
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
          ctx.strokeStyle = isActive ? '#ffffff' : selectedToken === t.id ? '#f5f2ee' : vividTokenBorder(t.color)
          ctx.lineWidth = isActive || selectedToken === t.id ? 3 : 2
          ctx.stroke()
        } else {
          ctx.fillStyle = t.is_visible ? vividTokenBorder(t.color) : 'rgba(192,57,43,0.3)'
          ctx.fill()
          ctx.strokeStyle = isActive ? '#ffffff' : selectedToken === t.id ? '#f5f2ee' : 'rgba(255,255,255,1)'
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
          // Active turn = white badge with dark text; inactive = dark
          // badge with light text. White can't be confused with any
          // disposition color (the previous green had that problem).
          const badgeActive = initiativeOrder[initIdx].is_active
          ctx.beginPath()
          ctx.arc(bx, by, badgeR, 0, Math.PI * 2)
          ctx.fillStyle = badgeActive ? '#ffffff' : '#242424'
          ctx.fill()
          ctx.strokeStyle = '#f5f2ee'
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.fillStyle = badgeActive ? '#0f0f0f' : '#f5f2ee'
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

    // Vehicle mounted-weapon firing arcs. Each toggled arc renders a
    // translucent cone from the token's center, oriented by the
    // token's rotation + the weapon's mount_angle, opening to the
    // weapon's arc_degrees, extending to the weapon's max range
    // band. Drawn after tokens (so they overlay the vehicle without
    // being hidden) and after the wall segment block above is drawn
    // separately below — order: tokens → arcs → walls so doors etc.
    // remain crisp on top of arc fills.
    if (firingArcs.size > 0 && vehicles && vehicles.length > 0) {
      const cellW = (s.grid_cols * cellSize) / s.grid_cols
      const cellH = (s.grid_rows * cellSize) / s.grid_rows
      ctx.save()
      for (const tok of tokensRef.current) {
        if (tok.token_type !== 'object') continue
        const veh = vehicles.find(v => v.name === tok.name)
        if (!veh || !veh.mounted_weapons || veh.mounted_weapons.length === 0) continue
        for (let wi = 0; wi < veh.mounted_weapons.length; wi++) {
          const key = `${tok.id}:${wi}`
          if (!firingArcs.has(key)) continue
          const w = veh.mounted_weapons[wi]
          if (typeof w.mount_angle !== 'number' || typeof w.arc_degrees !== 'number') continue
          // Origin at the token's footprint center.
          const gw = tok.grid_w ?? 1
          const gh = tok.grid_h ?? 1
          const ox = offsetX + (tok.grid_x + gw / 2) * cellW
          const oy = offsetY + (tok.grid_y + gh / 2) * cellH
          // Weapon range → cone radius. Use the weapon definition's
          // primary range band converted to feet, then to cells via
          // scene cell_feet. Falls back to 20 cells when the weapon
          // isn't in the catalog.
          const wdef = getWeaponByName(w.name)
          const ft = s.cell_feet ?? 3
          const rangeFeet = wdef ? (RANGE_BAND_FEET[wdef.range] ?? 100) : 100
          const radius = (rangeFeet / ft) * cellSize
          // Token rotation in degrees + mount_angle in degrees, both
          // measured clockwise from "up" (the screen's negative-Y).
          // Convert to radians for canvas. Canvas 0° = +X (right), so
          // we rotate by -90° (forward = up by default).
          const tokenRot = tok.rotation ?? 0
          const facingDeg = tokenRot + w.mount_angle - 90
          const facingRad = facingDeg * Math.PI / 180
          const halfArc = (w.arc_degrees / 2) * Math.PI / 180
          // Wedge fill — purple-ish with low alpha so the underlying
          // map stays readable. Border at full opacity to anchor the
          // shape against busy backgrounds.
          ctx.beginPath()
          ctx.moveTo(ox, oy)
          ctx.arc(ox, oy, radius, facingRad - halfArc, facingRad + halfArc)
          ctx.closePath()
          ctx.fillStyle = 'rgba(196,167,240,0.18)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(196,167,240,0.85)'
          ctx.lineWidth = 1.5
          ctx.setLineDash([6, 4])
          ctx.stroke()
          ctx.setLineDash([])
          // Label at the cone's far edge so the GM can tell which
          // weapon's cone is which when multiple are toggled.
          const labelX = ox + Math.cos(facingRad) * radius * 0.8
          const labelY = oy + Math.sin(facingRad) * radius * 0.8
          ctx.fillStyle = '#c4a7f0'
          ctx.font = '13px Carlito, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(w.name, labelX, labelY)
        }
      }
      ctx.restore()
    }

    // Wall / door / window segments. Drawn after tokens so they sit
    // on top of object portraits — important for doors that need to
    // visually intersect a wall run. Color-coded by kind:
    //   wall       → solid stone gray, 4px
    //   door open  → dashed green, 3px
    //   door closed→ solid red, 4px
    //   window     → solid sky blue, 3px (with subtle dash)
    {
      const segments = wallsLocalRef.current
      if (segments.length > 0) {
        const cellW = (s.grid_cols * cellSize) / s.grid_cols
        const cellH = (s.grid_rows * cellSize) / s.grid_rows
        ctx.save()
        ctx.lineCap = 'round'
        for (const seg of segments) {
          const x1 = offsetX + seg.x1 * cellW
          const y1 = offsetY + seg.y1 * cellH
          const x2 = offsetX + seg.x2 * cellW
          const y2 = offsetY + seg.y2 * cellH
          if (seg.kind === 'wall') {
            ctx.strokeStyle = '#a08e75'
            ctx.lineWidth = 4
            ctx.setLineDash([])
          } else if (seg.kind === 'door') {
            const open = seg.door_open ?? true
            ctx.strokeStyle = open ? '#7fc458' : '#c0392b'
            ctx.lineWidth = open ? 3 : 4
            ctx.setLineDash(open ? [6, 4] : [])
          } else {
            // window — OPEN (default) = thin sky-blue dashed line,
            // reads as "see-through frame." CLOSED = blinds drawn,
            // renders as a solid muted-amber line that visually
            // "blocks" the view (matches the mechanical vision-block
            // when closed).
            const winOpen = seg.door_open !== false  // default = open
            ctx.strokeStyle = winOpen ? 'rgba(122,179,212,0.85)' : '#a8924a'
            ctx.lineWidth = winOpen ? 2 : 4
            ctx.setLineDash(winOpen ? [5, 3] : [])
          }
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
        // Live preview of the in-flight segment.
        if (wallDrawStart && wallDrawHover && (fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window')) {
          const x1 = offsetX + wallDrawStart.x * cellW
          const y1 = offsetY + wallDrawStart.y * cellH
          const x2 = offsetX + wallDrawHover.x * cellW
          const y2 = offsetY + wallDrawHover.y * cellH
          ctx.strokeStyle = fogEditMode === 'wall' ? '#a08e75'
            : fogEditMode === 'door' ? '#7fc458'
            : '#7ab3d4'
          ctx.globalAlpha = 0.55
          ctx.lineWidth = 4
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
        // Endpoint markers when in a draw mode — small dots at each
        // segment endpoint so the GM can see snap points.
        if (fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window') {
          ctx.setLineDash([])
          ctx.fillStyle = 'rgba(196,167,240,0.85)'
          for (const seg of segments) {
            ;[[seg.x1, seg.y1], [seg.x2, seg.y2]].forEach(([x, y]) => {
              ctx.beginPath()
              ctx.arc(offsetX + x * cellW, offsetY + y * cellH, 3, 0, Math.PI * 2)
              ctx.fill()
            })
          }
          if (wallDrawStart) {
            ctx.fillStyle = '#c4a7f0'
            ctx.beginPath()
            ctx.arc(offsetX + wallDrawStart.x * cellW, offsetY + wallDrawStart.y * cellH, 5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.setLineDash([])
        ctx.restore()
      }
    }

    // Rectangle marquee preview — draws while the GM is dragging
    // the Rect fog tool. On mouseup the rectangle is committed to
    // fog_state and the preview clears. Erase variant gets a red
    // tint so the GM knows it'll subtract.
    if ((fogEditMode === 'rect' || fogEditMode === 'rect-erase') && fogRectStart && fogRectEnd) {
      const cellW = (s.grid_cols * cellSize) / s.grid_cols
      const cellH = (s.grid_rows * cellSize) / s.grid_rows
      // Float-coord marquee — pixel-precise box that doesn't snap.
      const minX = Math.min(fogRectStart.x, fogRectEnd.x)
      const maxX = Math.max(fogRectStart.x, fogRectEnd.x)
      const minY = Math.min(fogRectStart.y, fogRectEnd.y)
      const maxY = Math.max(fogRectStart.y, fogRectEnd.y)
      const rx = offsetX + minX * cellW
      const ry = offsetY + minY * cellH
      const rw = Math.max(1, (maxX - minX) * cellW)
      const rh = Math.max(1, (maxY - minY) * cellH)
      const erase = fogEditMode === 'rect-erase'
      ctx.save()
      ctx.fillStyle = erase ? 'rgba(192,57,43,0.18)' : 'rgba(196,167,240,0.18)'
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = erase ? 'rgba(245,168,154,0.85)' : 'rgba(196,167,240,0.85)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1)
      ctx.setLineDash([])
      ctx.restore()
    }

    // Transient toggle label — flashes "Door opened" / "Window
    // closed" near the click point so the player gets explicit
    // feedback on what just happened. Auto-clears via setTimeout.
    if (toggleLabel) {
      const cellW = (s.grid_cols * cellSize) / s.grid_cols
      const cellH = (s.grid_rows * cellSize) / s.grid_rows
      const lx = offsetX + toggleLabel.x * cellW
      const ly = offsetY + toggleLabel.y * cellH
      ctx.save()
      ctx.font = 'bold 14px Carlito, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const tw = ctx.measureText(toggleLabel.text).width + 16
      const th = 22
      ctx.fillStyle = 'rgba(15,15,15,0.92)'
      ctx.strokeStyle = '#c4a7f0'
      ctx.lineWidth = 1.5
      ctx.fillRect(lx - tw / 2, ly - th - 14, tw, th)
      ctx.strokeRect(lx - tw / 2 + 0.5, ly - th - 14 + 0.5, tw - 1, th - 1)
      ctx.fillStyle = '#f5f2ee'
      ctx.fillText(toggleLabel.text, lx, ly - 14 - th / 2)
      ctx.restore()
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

  // Float-precision sub-cell mouse position. Used by the rect-fog
  // tool so the GM can drag a rectangle that doesn't snap to grid
  // intersections — gives a smooth marquee box. Out-of-bounds values
  // are clamped to scene edges so a drag past the canvas edge stays
  // on the map.
  function getCellPosFloat(e: React.MouseEvent): { x: number; y: number } | null {
    if (!canvasRef.current || !scene) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const cellSize = getCellSize()
    const mx = (e.clientX - rect.left) / zoom
    const my = (e.clientY - rect.top) / zoom
    const x = Math.max(0, Math.min(scene.grid_cols, mx / cellSize))
    const y = Math.max(0, Math.min(scene.grid_rows, my / cellSize))
    return { x, y }
  }

  function getTokenAt(gx: number, gy: number): Token | undefined {
    // First pass: exact-cell rect match. Multi-cell objects cover
    // (grid_x, grid_y) through (+gw-1, +gh-1). Standard PCs/NPCs at
    // 1x1 collapse to the original exact-cell match. This pass wins
    // first so a small PC standing on a vehicle's cell still grabs
    // when clicked exactly on that cell.
    const exact = tokens.find(t => {
      if (!(t.is_visible || isGM)) return false
      const gw = t.grid_w ?? 1
      const gh = t.grid_h ?? 1
      return gx >= t.grid_x && gx < t.grid_x + gw && gy >= t.grid_y && gy < t.grid_y + gh
    })
    if (exact) return exact

    // Second pass: visual-scale fallback. A token with scale > 1
    // renders a circle of `cellSize * 0.4 * scale` pixels — i.e.
    // `0.4 * scale` cells radius — but its grid footprint stays at
    // grid_w × grid_h. Without this pass, a vehicle scaled up to
    // look the right size on the canvas (e.g. Minnie at scale ~4)
    // is only grabbable from the single anchor cell, even though the
    // portrait visually covers a 3×3 area. Hit-test against the
    // rendered radius and pick the smallest matching token so a tiny
    // PC near the vehicle's edge still wins over the vehicle itself.
    let best: { tok: Token; radius: number } | null = null
    for (const t of tokens) {
      if (!(t.is_visible || isGM)) continue
      const scale = t.scale ?? 1
      if (scale <= 1) continue
      const gw = t.grid_w ?? 1
      const gh = t.grid_h ?? 1
      const cx = t.grid_x + gw / 2
      const cy = t.grid_y + gh / 2
      const visRadius = 0.4 * scale
      const dx = (gx + 0.5) - cx
      const dy = (gy + 0.5) - cy
      if (Math.hypot(dx, dy) <= visRadius) {
        if (!best || visRadius < best.radius) best = { tok: t, radius: visRadius }
      }
    }
    return best?.tok
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
    // Alt + right-click anywhere → toggle the nearest door OR window
    // (segment OR object token), regardless of edit mode. Universal
    // gesture for "open/close that thing." Door state flips
    // open/closed (existing behavior); window state flips
    // closed-glass (movement blocked, vision passes) ↔ open-glass
    // (passable both ways). Plain right-click + edit mode still
    // means "delete nearest segment" — alt distinguishes the two.
    if (e.button === 2 && e.altKey && canvasRef.current && scene) {
      e.preventDefault()
      const rect = canvasRef.current.getBoundingClientRect()
      const cellSize = getCellSize()
      const mxCells = (e.clientX - rect.left) / zoom / cellSize
      const myCells = (e.clientY - rect.top) / zoom / cellSize
      // 1) Try to find the nearest door/window SEGMENT within a half-
      //    cell. Segments are the primary surface.
      let bestSegId: string | null = null
      let bestSegDist = 0.5
      for (const w of wallsLocalRef.current) {
        if (w.kind !== 'door' && w.kind !== 'window') continue
        const dx = w.x2 - w.x1
        const dy = w.y2 - w.y1
        const len2 = dx * dx + dy * dy
        if (len2 < 1e-6) continue
        let t = ((mxCells - w.x1) * dx + (myCells - w.y1) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        const px = w.x1 + t * dx
        const py = w.y1 + t * dy
        const d = Math.hypot(mxCells - px, myCells - py)
        if (d < bestSegDist) { bestSegDist = d; bestSegId = w.id }
      }
      if (bestSegId) {
        setWallsLocal(prev => {
          const next = prev.map(w => w.id === bestSegId
            ? { ...w, door_open: !(w.door_open ?? (w.kind === 'window' ? false : true)) }
            : w)
          wallsLocalRef.current = next
          return next
        })
        scheduleWallsPersist()
        return
      }
      // 2) Fall through to object TOKEN under the cursor — only doors
      //    or windows. Toggle door_open the same way the existing
      //    door-token click handler does.
      const pos = getGridPos(e)
      if (pos) {
        const tok = getTokenAt(pos.gx, pos.gy)
        if (tok && (tok.is_door || tok.is_window)) {
          const nextOpen = !tok.door_open
          setTokens(prev => prev.map(x => x.id === tok.id ? { ...x, door_open: nextOpen } : x))
          supabase.from('scene_tokens').update({ door_open: nextOpen }).eq('id', tok.id).then(() => {
            tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
          })
          return
        }
      }
      return
    }
    // Right-click in any structure-edit mode → delete the segment
    // closest to the cursor (within ~half a cell). Lets the GM fix
    // mistakes without leaving the toolbar.
    if (fogEditMode && isGM && e.button === 2 && (fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window')) {
      e.preventDefault()
      if (!canvasRef.current || !scene) return
      const rect = canvasRef.current.getBoundingClientRect()
      const cellSize = getCellSize()
      const mx = (e.clientX - rect.left) / zoom / cellSize
      const my = (e.clientY - rect.top) / zoom / cellSize
      // Find nearest segment by point-to-segment distance.
      let bestId: string | null = null
      let bestDist = 0.5 // half-cell threshold
      for (const w of wallsLocalRef.current) {
        const dx = w.x2 - w.x1
        const dy = w.y2 - w.y1
        const len2 = dx * dx + dy * dy
        if (len2 < 1e-6) continue
        let t = ((mx - w.x1) * dx + (my - w.y1) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        const px = w.x1 + t * dx
        const py = w.y1 + t * dy
        const d = Math.hypot(mx - px, my - py)
        if (d < bestDist) { bestDist = d; bestId = w.id }
      }
      if (bestId) {
        setWallsLocal(prev => {
          const next = prev.filter(w => w.id !== bestId)
          wallsLocalRef.current = next
          return next
        })
        scheduleWallsPersist()
      }
      return
    }
    // Door / window SEGMENT click — plain click toggles open/closed
    // when not in any edit mode (gameplay interaction). Detection is
    // point-to-segment distance against door + window segments.
    if (!fogEditMode && e.button === 0 && wallsLocalRef.current.some(w => w.kind === 'door' || w.kind === 'window')) {
      if (canvasRef.current && scene) {
        const rect = canvasRef.current.getBoundingClientRect()
        const cellSize = getCellSize()
        const mx = (e.clientX - rect.left) / zoom / cellSize
        const my = (e.clientY - rect.top) / zoom / cellSize
        let bestSeg: WallSegment | null = null
        let bestDist = 0.3 // tighter threshold so a normal click on a token doesn't accidentally toggle a nearby door
        for (const w of wallsLocalRef.current) {
          if (w.kind !== 'door' && w.kind !== 'window') continue
          const dx = w.x2 - w.x1
          const dy = w.y2 - w.y1
          const len2 = dx * dx + dy * dy
          if (len2 < 1e-6) continue
          let t = ((mx - w.x1) * dx + (my - w.y1) * dy) / len2
          t = Math.max(0, Math.min(1, t))
          const px = w.x1 + t * dx
          const py = w.y1 + t * dy
          const d = Math.hypot(mx - px, my - py)
          if (d < bestDist) { bestDist = d; bestSeg = w }
        }
        if (bestSeg) {
          // Per-kind default for door_open when undefined: doors
          // default closed (false), windows default open (true).
          const kindDefault = bestSeg.kind === 'door' ? false : true
          const currentOpen = bestSeg.door_open ?? kindDefault
          const nextOpen = !currentOpen
          const targetId = bestSeg.id
          setWallsLocal(prev => {
            const next = prev.map(w => w.id === targetId ? { ...w, door_open: nextOpen } : w)
            wallsLocalRef.current = next
            return next
          })
          scheduleWallsPersist()
          // Toast — render midpoint of the segment.
          const midX = (bestSeg.x1 + bestSeg.x2) / 2
          const midY = (bestSeg.y1 + bestSeg.y2) / 2
          showToggleLabel(midX, midY, `${bestSeg.kind === 'door' ? 'Door' : 'Window'} ${nextOpen ? 'opened' : 'closed'}`)
          return
        }
      }
    }
    // Wall/door/window segment authoring. First click = start point;
    // second click = end point (commit). The preview line follows the
    // cursor between clicks. ESC cancels (handled in the keydown
    // effect above).
    if (fogEditMode && isGM && e.button === 0 && (fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window')) {
      const raw = getSegmentEndpoint(e)
      if (!raw) return
      // Doors + windows snap onto the nearest wall so they always
      // land on a wall's line — auto-split has a clean coincidence
      // to detect. Walls themselves stay free-form.
      const inter = (fogEditMode === 'wall') ? raw : snapPointToNearestWall(raw)
      if (!wallDrawStart) {
        setWallDrawStart(inter)
        setWallDrawHover(inter)
        return
      }
      // Second click — commit the segment if it's not zero-length.
      if (inter.x === wallDrawStart.x && inter.y === wallDrawStart.y) {
        // Same point — treat as cancel.
        setWallDrawStart(null)
        setWallDrawHover(null)
        return
      }
      const newSeg: WallSegment = {
        id: crypto.randomUUID(),
        x1: wallDrawStart.x, y1: wallDrawStart.y,
        x2: inter.x, y2: inter.y,
        kind: fogEditMode,
        // door = closed by default (blocks vision + movement until
        // opened); window = open by default (vision passes; glass
        // always blocks movement; "closed" = blinds drawn = blocks
        // vision). Wall has no toggle.
        door_open: fogEditMode === 'door' ? false
          : fogEditMode === 'window' ? true
          : undefined,
      }
      setWallsLocal(prev => {
        // Auto-split: when a new segment overlaps an existing wall
        // segment on the same axis-aligned line, the new segment
        // "punches a hole" in the wall — split the wall into the
        // pieces NOT under the new segment. Without this, a GM who
        // draws a continuous wall and then drops a door onto it
        // ends up with the wall AND the door coexisting at the
        // door's position, so the wall keeps blocking movement +
        // vision even though a door is "there."
        const split = splitOverlappingSegments(prev, newSeg)
        const next = [...split, newSeg]
        wallsLocalRef.current = next
        return next
      })
      scheduleWallsPersist()
      // Chain — pre-seed the next segment from the just-clicked
      // endpoint so the GM can draw an L or run-of-walls without
      // re-clicking. Press ESC or pick a different tool to stop.
      setWallDrawStart(inter)
      setWallDrawHover(inter)
      return
    }
    // Fog edit mode — paint or erase the cell under the cursor and
    // start tracking drag so handleMouseMove fills cells along the
    // drag path. Checked BEFORE every other mode so the GM can paint
    // fog without worrying about fall-through to token clicks.
    if (fogEditMode && isGM && e.button === 0) {
      const pos = getGridPos(e)
      if (pos) {
        fogPaintingRef.current = true
        if (fogEditMode === 'rect' || fogEditMode === 'rect-erase') {
          // Defer the state mutation to mouseup — during the drag
          // we only render a preview overlay so the GM can pick the
          // bounds. Capture float (sub-cell) coords so the marquee
          // box doesn't snap to grid intersections; a single-click
          // with no drag still affects the one cell at the click.
          const fpos = getCellPosFloat(e)
          if (fpos) {
            setFogRectStart(fpos)
            setFogRectEnd(fpos)
          }
        } else {
          const key = `${pos.gx},${pos.gy}`
          setFogLocal(prev => {
            const next = { ...prev }
            if (fogEditMode === 'paint') next[key] = true
            else delete next[key]
            fogLocalRef.current = next
            return next
          })
          scheduleFogPersist()
        }
      }
      return
    }
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
          // Open doors are passable — exclude them from the occupied
          // set. Closed doors stay in `occupied` and additionally
          // get a clearer reject below so we can surface "the door is
          // closed" feedback rather than a silent no-op.
          const occupied = new Set(
            tokens
              .filter(t => t.id !== moveTok.id)
              // Open doors pass through. Windows ALWAYS block movement
              // (glass is always there — toggle only affects vision via
              // blinds, not movement). Walls always block.
              .filter(t => !(t.is_door && t.door_open))
              .map(t => `${t.grid_x},${t.grid_y}`)
          )
          const closedDoorAtDest = tokens.some(t => t.is_door && t.door_open === false && t.grid_x === pos.gx && t.grid_y === pos.gy)
          if (closedDoorAtDest) {
            alert('That door is closed. Open it first or pick a different destination.')
            return
          }
          // Wall/door/window SEGMENT crossing check. Walls always block.
          // Doors block when closed; open doors pass. Windows ALWAYS
          // block movement (glass is always there; the toggle only
          // controls vision via blinds, not movement).
          const moveSegs = wallsLocalRef.current.filter(s =>
            s.kind === 'wall'
            || s.kind === 'window'
            || (s.kind === 'door' && s.door_open === false)
          )
          if (moveSegs.length > 0) {
            const ax = moveTok.grid_x + 0.5, ay = moveTok.grid_y + 0.5
            const bx = pos.gx + 0.5, by = pos.gy + 0.5
            const ccw = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
              (qx - px) * (ry - py) - (qy - py) * (rx - px)
            const crosses = moveSegs.some(w => {
              const d1 = ccw(w.x1, w.y1, w.x2, w.y2, ax, ay)
              const d2 = ccw(w.x1, w.y1, w.x2, w.y2, bx, by)
              const d3 = ccw(ax, ay, bx, by, w.x1, w.y1)
              const d4 = ccw(ax, ay, bx, by, w.x2, w.y2)
              return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
            })
            if (crosses) {
              alert('A wall or closed door blocks that path. Pick a destination on this side.')
              return
            }
          }
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
        // Door / window click intercept. Players (no drag permission
        // on this token) toggle immediately. GMs fall through to the
        // normal select+drag flow — handleMouseUp checks "drag with
        // no move" on a door/window and toggles in that case, so the
        // GM has move + click-to-toggle on one button.
        if (tok.is_door || tok.is_window) {
          const isController = !!myCharacterId
            && Array.isArray(tok.controlled_by_character_ids)
            && tok.controlled_by_character_ids.includes(myCharacterId)
          if (!isGM && !isController) {
            const nextOpen = !tok.door_open
            setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, door_open: nextOpen } : t))
            supabase.from('scene_tokens').update({ door_open: nextOpen }).eq('id', tok.id).then(() => {
              tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
            })
            // Token center for the floating label.
            const cx = tok.grid_x + (tok.grid_w ?? 1) / 2
            const cy = tok.grid_y + (tok.grid_h ?? 1) / 2
            showToggleLabel(cx, cy, `${tok.is_door ? 'Door' : 'Window'} ${nextOpen ? 'opened' : 'closed'}`)
            return
          }
        }
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
    // Wall draw preview — when a wallDrawStart exists, the moving
    // cursor traces a live segment to the cursor pos. Cheap state
    // update; render is gated on wallDrawHover changes. Doors and
    // windows snap to the nearest wall (matches commit-time
    // behavior) so the preview line lies on the wall's path.
    if (wallDrawStart && (fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window')) {
      const raw = getSegmentEndpoint(e)
      const inter = raw && (fogEditMode === 'wall' ? raw : snapPointToNearestWall(raw))
      if (inter && (!wallDrawHover || wallDrawHover.x !== inter.x || wallDrawHover.y !== inter.y)) {
        setWallDrawHover(inter)
      }
      // Don't return — fall through is fine, but no other handler
      // should fire while in segment mode.
      return
    }
    // Fog drag — extend the paint/erase from mousedown along the
    // cursor path. We touch each unique cell at most once per drag
    // so re-entering a cell mid-drag doesn't undo the operation.
    // Rect mode just updates the preview end cell; commit happens
    // on mouseup.
    if (fogEditMode && fogPaintingRef.current && isGM) {
      const pos = getGridPos(e)
      if (pos) {
        if (fogEditMode === 'rect' || fogEditMode === 'rect-erase') {
          // Track float position for smooth marquee.
          const fpos = getCellPosFloat(e)
          if (fpos && (!fogRectEnd || fogRectEnd.x !== fpos.x || fogRectEnd.y !== fpos.y)) {
            setFogRectEnd(fpos)
          }
          return
        }
        const key = `${pos.gx},${pos.gy}`
        setFogLocal(prev => {
          const has = !!prev[key]
          if (fogEditMode === 'paint' && has) return prev
          if (fogEditMode === 'erase' && !has) return prev
          const next = { ...prev }
          if (fogEditMode === 'paint') next[key] = true
          else delete next[key]
          fogLocalRef.current = next
          return next
        })
        scheduleFogPersist()
      }
      return
    }
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
    // End a fog paint drag. The last cell already got persisted on
    // the trailing scheduleFogPersist() of handleMouseMove; just
    // flip the in-flight ref off. Rect mode commits the rectangle
    // bounds here as one bulk write.
    if (fogPaintingRef.current) {
      fogPaintingRef.current = false
      if ((fogEditMode === 'rect' || fogEditMode === 'rect-erase') && fogRectStart && fogRectEnd) {
        const minX = Math.min(fogRectStart.x, fogRectEnd.x)
        const maxX = Math.max(fogRectStart.x, fogRectEnd.x)
        const minY = Math.min(fogRectStart.y, fogRectEnd.y)
        const maxY = Math.max(fogRectStart.y, fogRectEnd.y)
        // Cells overlapping the float rectangle (any-overlap rule).
        // Cell (i,j) overlaps the rect [minX,maxX]×[minY,maxY] iff
        //   i+1 > minX  AND  i < maxX  AND  j+1 > minY  AND  j < maxY
        // For a zero-area click (start == end at integer), clamp so
        // we still fog the cell at that point.
        const x1 = Math.floor(minX)
        const y1 = Math.floor(minY)
        const x2 = Math.max(x1, Math.ceil(maxX) - 1)
        const y2 = Math.max(y1, Math.ceil(maxY) - 1)
        const erase = fogEditMode === 'rect-erase'
        setFogLocal(prev => {
          const next = { ...prev }
          for (let x = x1; x <= x2; x++) {
            for (let y = y1; y <= y2; y++) {
              const k = `${x},${y}`
              if (erase) delete next[k]
              else next[k] = true
            }
          }
          fogLocalRef.current = next
          return next
        })
        scheduleFogPersist()
        setFogRectStart(null)
        setFogRectEnd(null)
      }
      return
    }
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
    // GM "drag" with zero movement on a door OR window = a click →
    // toggle. Drag with actual movement falls through to the normal
    // reposition path.
    if (tok && (tok.is_door || tok.is_window) && !moved) {
      const nextOpen = !tok.door_open
      setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, door_open: nextOpen } : t))
      supabase.from('scene_tokens').update({ door_open: nextOpen }).eq('id', tok.id).then(() => {
        tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
      })
      const cx = tok.grid_x + (tok.grid_w ?? 1) / 2
      const cy = tok.grid_y + (tok.grid_h ?? 1) / 2
      showToggleLabel(cx, cy, `${tok.is_door ? 'Door' : 'Window'} ${nextOpen ? 'opened' : 'closed'}`)
      setDragging(null)
      dragPosRef.current = null
      return
    }
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
      const dx = pos!.gx - tok!.grid_x
      const dy = pos!.gy - tok!.grid_y
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, grid_x: pos!.gx, grid_y: pos!.gy } : t))
      supabase.from('scene_tokens').update({ grid_x: pos!.gx, grid_y: pos!.gy }).eq('id', tokenId).then(({ error }: any) => {
        if (error) console.warn('[TacticalMap] token move failed:', error)
        else tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_moved', payload: {} })
      })
      // Vehicle passenger sync — when an object token whose name
      // matches a campaign vehicle moves, every PC/NPC riding in one
      // of its slots (driver / brewer / navigator / gunner /
      // passenger_seats) has their own token dragged along by the
      // same (dx, dy). Vehicles aren't a separate table; they live
      // on campaigns.vehicles JSONB. Name-based matching mirrors the
      // damage-sync pattern (commit c35770e) — fragile if two
      // vehicles share a name in one campaign, but that's a rare
      // edge case and the alternative (scene_tokens.vehicle_id FK)
      // is a bigger schema change. Fire-and-forget; if no vehicle
      // matches the name, .find returns undefined and we no-op.
      if (tok && tok.token_type === 'object' && (dx !== 0 || dy !== 0)) {
        void (async () => {
          const { data: camp } = await supabase
            .from('campaigns')
            .select('vehicles')
            .eq('id', campaignId)
            .maybeSingle()
          const list = ((camp as any)?.vehicles ?? []) as any[]
          const veh = list.find(v => v?.name === tok!.name)
          if (!veh) return
          // Collect every linked PC/NPC id across all slot kinds.
          const charIds: string[] = []
          const npcIds: string[] = []
          const push = (id: string | null | undefined, kind: string | null | undefined) => {
            if (!id) return
            if (kind === 'pc') charIds.push(id)
            else if (kind === 'npc') npcIds.push(id)
          }
          push(veh.driver_character_id, veh.driver_kind)
          push(veh.brewer_character_id, veh.brewer_kind)
          push(veh.navigator_character_id, veh.navigator_kind)
          for (const w of (veh.mounted_weapons ?? [])) {
            push(w?.shooter_character_id, w?.shooter_kind)
          }
          for (const s of (veh.passenger_seats ?? [])) {
            if (s) push(s.character_id, s.kind)
          }
          if (charIds.length === 0 && npcIds.length === 0) return
          // Find the matching tokens in this scene. The tokensRef has
          // the freshest version (the setTokens for the vehicle just
          // committed; React batched but the ref is updated already).
          const passengerToks = tokensRef.current.filter(t => {
            if (t.id === tokenId) return false  // don't double-move the vehicle itself
            if (t.character_id && charIds.includes(t.character_id)) return true
            if (t.npc_id && npcIds.includes(t.npc_id)) return true
            return false
          })
          if (passengerToks.length === 0) return
          // Move locally first for snappy feel, then persist.
          setTokens(prev => prev.map(t => {
            const isPassenger = passengerToks.some(p => p.id === t.id)
            return isPassenger ? { ...t, grid_x: t.grid_x + dx, grid_y: t.grid_y + dy } : t
          }))
          await Promise.all(passengerToks.map(p =>
            supabase.from('scene_tokens')
              .update({ grid_x: p.grid_x + dx, grid_y: p.grid_y + dy })
              .eq('id', p.id)
          ))
          tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_moved', payload: {} })
        })()
      }
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

        {/* GM Fog editor — top left by default; draggable via the ⠿
            handle on the left edge. Compact when collapsed (just the
            toggle button); expands into paint/erase + bulk controls
            when in edit mode. Hidden entirely from players. */}
        {isGM && scene && (
          <div ref={fogBarRef} style={{ position: 'absolute', top: `${fogBarPos.y}px`, left: `${fogBarPos.x}px`, zIndex: 10, background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Drag handle. ⠿ braille dots are universal "grippy" UX
                — same icon GmNotes / NpcRoster / CampaignPins all use
                for drag-to-reorder. mousedown starts the drag, doc-
                level listeners track move + up so the cursor doesn't
                have to stay on the handle. The drag is clamped to the
                canvas wrapper bounds so the bar can never be parked
                off-screen. */}
            <div onMouseDown={startFogBarDrag}
              title="Drag to reposition the fog/lighting toolbar"
              style={{ cursor: 'move', color: '#5a5550', fontSize: '14px', lineHeight: 1, userSelect: 'none', padding: '0 4px', flexShrink: 0 }}>⠿</div>
            {/* Reset to default position. Only shown when the bar has
                actually been moved — clean default state has no
                visible reset affordance. Click → snap back to top-left. */}
            {(fogBarPos.x !== 8 || fogBarPos.y !== 8) && (
              <button onClick={resetFogBarPos}
                title="Reset toolbar to default position (top-left)"
                style={{ background: 'none', border: 'none', color: '#5a5550', fontSize: '13px', lineHeight: 1, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>↺</button>
            )}
            {/* Day / Night toggle — outdoor scenes default 'day' (PCs
                see for miles, only walls block). Indoor/dark scenes
                flip to 'night' (per-token sight_radius governs;
                auto-fog kicks in beyond). Persists on
                tactical_scenes.lighting_mode so all viewers update. */}
            {(() => {
              const isDay = (scene.lighting_mode ?? 'day') === 'day'
              return (
                <button onClick={async () => {
                  const next = isDay ? 'night' : 'day'
                  await supabase.from('tactical_scenes').update({ lighting_mode: next }).eq('id', scene.id)
                  setScene(p => p ? { ...p, lighting_mode: next } : p)
                }}
                  title={isDay ? 'Day — sight unbounded, only walls block. Click to switch to Night.' : 'Night — per-token sight radius governs, auto-fog beyond. Click to switch to Day.'}
                  style={{ padding: '4px 10px', background: isDay ? '#2a2010' : '#0f1a2e', border: `1px solid ${isDay ? '#EF9F27' : '#7ab3d4'}`, borderRadius: '3px', color: isDay ? '#EF9F27' : '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  {isDay ? '🌞 Day' : '🌙 Night'}
                </button>
              )
            })()}
            {!fogEditMode && (
              <button onClick={() => setFogEditMode('paint')}
                title="Paint fog over cells the players shouldn't see. Drag to fog regions, switch to erase to clear."
                style={{ padding: '4px 10px', background: '#1a1a1a', border: '1px solid #5a2e5a', borderRadius: '3px', color: '#c4a7f0', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                🌫️ Edit Fog
              </button>
            )}
            {fogEditMode && (
              <>
                <button onClick={() => setFogEditMode('paint')}
                  title="Drag to fog cells one at a time"
                  style={{ padding: '4px 10px', background: fogEditMode === 'paint' ? '#2a1a3e' : '#1a1a1a', border: `1px solid ${fogEditMode === 'paint' ? '#c4a7f0' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'paint' ? '#c4a7f0' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  Paint
                </button>
                <button onClick={() => setFogEditMode('rect')}
                  title="Drag a rectangle to fog every cell inside on release"
                  style={{ padding: '4px 10px', background: fogEditMode === 'rect' ? '#2a1a3e' : '#1a1a1a', border: `1px solid ${fogEditMode === 'rect' ? '#c4a7f0' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'rect' ? '#c4a7f0' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  Rect
                </button>
                <button onClick={() => setFogEditMode('rect-erase')}
                  title="Drag a rectangle to clear every fogged cell inside on release"
                  style={{ padding: '4px 10px', background: fogEditMode === 'rect-erase' ? '#2a1210' : '#1a1a1a', border: `1px solid ${fogEditMode === 'rect-erase' ? '#f5a89a' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'rect-erase' ? '#f5a89a' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  Rect-Erase
                </button>
                <button onClick={() => setFogEditMode('erase')}
                  title="Drag to clear fog cells one at a time"
                  style={{ padding: '4px 10px', background: fogEditMode === 'erase' ? '#2a1a3e' : '#1a1a1a', border: `1px solid ${fogEditMode === 'erase' ? '#c4a7f0' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'erase' ? '#c4a7f0' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  Erase
                </button>
                <span style={{ width: '1px', height: '20px', background: '#3a3a3a' }} />
                {/* Structure tools — author thin wall/door/window
                    segments on cell edges. Click two intersections to
                    place a segment; segments chain (the second click
                    becomes the next segment's start) so an L-shaped
                    wall is two clicks. ESC or pick a different tool
                    to stop. Right-click any segment to delete it. */}
                <button onClick={() => { setFogEditMode('wall'); setWallDrawStart(null) }}
                  title="Draw walls — click intersection-to-intersection. Right-click a segment to delete."
                  style={{ padding: '4px 10px', background: fogEditMode === 'wall' ? '#2a2010' : '#1a1a1a', border: `1px solid ${fogEditMode === 'wall' ? '#a08e75' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'wall' ? '#a08e75' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  🧱 Wall
                </button>
                <button onClick={() => { setFogEditMode('door'); setWallDrawStart(null) }}
                  title="Draw doors. Players click them mid-game to open/close."
                  style={{ padding: '4px 10px', background: fogEditMode === 'door' ? '#1a2e10' : '#1a1a1a', border: `1px solid ${fogEditMode === 'door' ? '#7fc458' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'door' ? '#7fc458' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  🚪 Door
                </button>
                <button onClick={() => { setFogEditMode('window'); setWallDrawStart(null) }}
                  title="Draw windows — block movement, vision passes through."
                  style={{ padding: '4px 10px', background: fogEditMode === 'window' ? '#0f1a2e' : '#1a1a1a', border: `1px solid ${fogEditMode === 'window' ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'window' ? '#7ab3d4' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  🪟 Window
                </button>
                <span style={{ width: '1px', height: '20px', background: '#3a3a3a' }} />
                <button onClick={() => {
                    if (!scene) return
                    const all: Record<string, boolean> = {}
                    for (let x = 0; x < scene.grid_cols; x++) {
                      for (let y = 0; y < scene.grid_rows; y++) all[`${x},${y}`] = true
                    }
                    setFogLocal(all); fogLocalRef.current = all; scheduleFogPersist()
                  }}
                  title="Fog the whole scene"
                  style={{ padding: '4px 10px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Fog All
                </button>
                <button onClick={() => {
                    setFogLocal({}); fogLocalRef.current = {}; scheduleFogPersist()
                  }}
                  title="Clear all fog"
                  style={{ padding: '4px 10px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Clear All
                </button>
                <span style={{ width: '1px', height: '20px', background: '#3a3a3a' }} />
                {/* Hint banner — shown only in structure-edit modes
                    so the GM knows right-click + clear-walls exist
                    without digging through tooltips. */}
                {(fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window') && (
                  <>
                    <span title="Right-click any segment to delete it"
                      style={{ padding: '4px 8px', background: 'transparent', border: '1px dashed #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      ⌫ Right-click to delete
                    </span>
                    <button onClick={() => {
                        if (!confirm('Clear EVERY wall, door, and window from this scene?')) return
                        setWallsLocal([])
                        wallsLocalRef.current = []
                        scheduleWallsPersist()
                      }}
                      title="Wipe all wall/door/window segments on this scene"
                      style={{ padding: '4px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Clear Walls
                    </button>
                    <span style={{ width: '1px', height: '20px', background: '#3a3a3a' }} />
                  </>
                )}
                <button onClick={() => setFogEditMode(null)}
                  title="Exit fog editing — players see fog as-painted"
                  style={{ padding: '4px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  Done
                </button>
              </>
            )}
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto', contain: 'layout paint', overscrollBehavior: 'contain' }}>
        <canvas ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={e => {
            // Suppress the browser context menu when the right-click
            // means something to us:
            //   • Alt + right-click anywhere → toggle nearest
            //     door/window (handled in handleMouseDown).
            //   • Right-click in any structure-edit mode → delete
            //     nearest segment.
            if (e.altKey) { e.preventDefault(); return }
            if (fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window') {
              e.preventDefault()
            }
          }}
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
                {/* Mounted-weapon firing arcs. Renders a per-weapon
                    toggle button when this token's name matches a
                    vehicle definition that has weapons with arc data
                    set (mount_angle + arc_degrees). Click toggles a
                    translucent cone overlay on the map. Multiple
                    weapons can be on at once (turret + fixed). */}
                {tok.token_type === 'object' && (() => {
                  const veh = vehicles?.find(v => v.name === tok.name)
                  const arcWeapons = (veh?.mounted_weapons ?? []).map((w: any, i: number) => ({ w, i }))
                    .filter(({ w }: any) => typeof w.mount_angle === 'number' && typeof w.arc_degrees === 'number')
                  if (arcWeapons.length === 0) return null
                  return arcWeapons.map(({ w, i }: any) => {
                    const key = `${tok.id}:${i}`
                    const active = firingArcs.has(key)
                    return (
                      <button key={key} onClick={() => {
                          setFiringArcs(prev => {
                            const next = new Set(prev)
                            if (next.has(key)) next.delete(key)
                            else next.add(key)
                            return next
                          })
                        }}
                        title={`Toggle firing arc — ${w.arc_degrees}° at mount ${w.mount_angle}°`}
                        style={{ padding: '2px 6px', background: active ? '#2a1a3e' : '#1a1a2e', border: `1px solid ${active ? '#c4a7f0' : '#2e2e5a'}`, borderRadius: '2px', color: active ? '#c4a7f0' : '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                        🎯 {w.name}
                      </button>
                    )
                  })
                })()}
                {/* Multistory Path B — shunt this token to another
                    scene. Hidden when there's only one scene in the
                    campaign (no destination to pick). */}
                {isGM && scenes.length > 1 && (
                  <button onClick={() => setMovingTokenToScene(movingTokenToScene === tok.id ? null : tok.id)}
                    title="Move this token to a different scene (multi-floor building, scene transition, etc.)"
                    style={{ padding: '2px 6px', background: '#1a2e2e', border: '1px solid #2e5a5a', borderRadius: '2px', color: '#7adcd4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                    → Scene
                  </button>
                )}
              </div>
            )}
            {movingTokenToScene === tok.id && (
              <div style={{ marginTop: '6px', padding: '6px 8px', background: '#0f1f1f', border: '1px solid #2e5a5a', borderRadius: '3px' }}>
                <div style={{ fontSize: '13px', color: '#7adcd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Move to scene
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {scenes.filter(s => s.id !== tok.scene_id).map(s => (
                    <button key={s.id}
                      onClick={async () => {
                        // Reset grid_x/y to 1,1 in the new scene so the
                        // token doesn't end up off-grid when scenes
                        // have different dimensions. The GM can drag
                        // it into position on the target scene.
                        await supabase.from('scene_tokens')
                          .update({ scene_id: s.id, grid_x: 1, grid_y: 1 })
                          .eq('id', tok.id)
                        setMovingTokenToScene(null)
                        setSelectedToken(null)
                        // Local mirror — strip from current scene
                        // immediately so the GM sees the token gone
                        // before realtime catches up.
                        setTokens(prev => prev.filter(t => t.id !== tok.id))
                        tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
                      }}
                      style={{ textAlign: 'left', padding: '4px 8px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a2e2e')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {s.name}{s.is_active ? ' · active' : ''}
                    </button>
                  ))}
                  <button onClick={() => setMovingTokenToScene(null)}
                    style={{ marginTop: '2px', padding: '4px 8px', background: 'transparent', border: 'none', color: '#5a5550', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
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
                {/* Sight radius — only meaningful for PC tokens that
                    actually project vision. Range 0-20 cells; 6 is
                    the default (matches the legacy hardcoded value).
                    GM-only edit; the column is read at draw time so
                    a slider tweak immediately re-punches fog. */}
                {isGM && tok.token_type !== 'object' && tok.character_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', width: '30px' }}>Sight</span>
                    <input type="range" min={0} max={50} step={1} value={tok.sight_radius_cells ?? 30}
                      onChange={async e => {
                        const v = parseInt(e.target.value, 10)
                        setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, sight_radius_cells: v } : t))
                        await supabase.from('scene_tokens').update({ sight_radius_cells: v }).eq('id', tok.id)
                      }}
                      title={`Vision radius — ${tok.sight_radius_cells ?? 30} cells`}
                      style={{ flex: 1, accentColor: '#7ab3d4', cursor: 'pointer' }} />
                    <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', width: '28px', textAlign: 'right' }}>{tok.sight_radius_cells ?? 30}</span>
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
