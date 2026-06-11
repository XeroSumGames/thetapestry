'use client'
import { memo, useEffect, useRef, useState } from 'react'
import { getWeaponByName } from '../lib/weapons'
import { vividTokenBorder } from './NpcRoster'
import { createSceneControlsBus, type SceneControlsBus } from '../lib/scene-controls-bus'
import {
  campaignScenes, insertScene, updateScene, deactivateOtherScenes, deactivateAllScenes,
  sceneTokens, updateToken, insertTokens, deleteToken, deleteTokensForScene, campaignVehiclesOnly,
  campaignInitiativeOrder, toggleWallSegmentDoor,
} from '../lib/data/tactical'
import { useCampaignChannel } from '../lib/realtime/useCampaignChannel'
import { trace } from '../lib/playtest-recorder'
import { gridToCoverMap } from '../lib/tactical-grid'
import { useFogBarPosition } from '../lib/use-fog-bar-position'
import { tokenCentroidCell, centerScrollOnCell, scrollCellIntoView, drawFallbackToken, effectiveScale, fitWholeMapZoom, isCellInView, findMoveFollowToken, findCenterTargets, computeAboard } from '../lib/tactical-view'

// Feet per band - used when drawing the primary-weapon range circle for PC/NPC tokens
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
  // Multi-cell footprint (objects only - defaults to 1×1). Lets a wide
  // truck or long wall actually occupy the cells it covers, instead of
  // visually overflowing a single-cell anchor.
  grid_w: number
  grid_h: number
  // PCs that the GM has opted-in to move this token (objects only - a
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
  // vision passes through - a PC behind a window still illuminates
  // fog beyond it.
  is_wall?: boolean | null
  is_window?: boolean | null
  // Per-token vision radius (cells) - overrides the default 6 used
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
  // GM-painted fog. Sparse map keyed by "x,y" (cell coords) - only
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
  viewingSceneId?: string | null // Player follows this scene (explicit Share Map); GM ignores.
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
  // footprint before committing. friendlyCharacterIds / friendlyNpcIds:
  // tokens on the thrower's OWN side (SMOKE-3, 2026-05-21). A PC thrower's
  // friendlies are other PCs (friendlyCharacterIds); an NPC thrower's
  // friendlies are other NPCs (friendlyNpcIds). Cross-faction tokens
  // (an NPC's PCs, a PC's NPCs) are enemies and never trigger the warning -
  // hitting them is intended damage, not friendly fire. Any friendly inside
  // the blast bands triggers a confirm() before the throw fires.
  throwMode?: { attackerCharId: string | null; attackerNpcId: string | null; rangeFeet: number; hasBlast?: boolean; friendlyCharacterIds?: string[]; friendlyNpcIds?: string[] } | null
  onThrowComplete?: (gx: number, gy: number) => void
  onThrowCancel?: () => void
  onTokensUpdate?: (tokens: { id: string; name: string; token_type: string; character_id: string | null; npc_id: string | null; grid_x: number; grid_y: number; grid_w?: number | null; grid_h?: number | null; wp_max: number | null; wp_current: number | null }[], cellFeet: number) => void
  onTokenChanged?: () => void                               // Notify parent to broadcast token_changed so other clients re-fetch
  onPlayerDragMove?: (characterId: string) => void          // Player finished a valid drag-move; parent consumes 1 action
  // GM dragged the *active* combatant's token. Parent consumes 1 action
  // on whichever initiative row owns the token. GM drags of off-turn
  // tokens stay free (cleanup / repositioning use case).
  onGMDragMove?: (args: { characterId?: string; npcId?: string }) => void
  // Campaign vehicle data - used as a fallback for object tokens that
  // were placed without their wp_max/wp_current copied across (so the
  // selected-token panel still shows the correct stats by name match).
  vehicles?: {
    id?: string
    name: string
    wp_max?: number
    wp_current?: number
    speed?: number
    // Seat assignments - used to hide aboard tokens from the canvas
    // (passengers/crew vanish into the vehicle, with a badge on the
    // vehicle token showing the headcount) and to drive
    // syncVehiclePassengers when the vehicle moves.
    driver_character_id?: string | null
    driver_kind?: string | null
    brewer_character_id?: string | null
    brewer_kind?: string | null
    navigator_character_id?: string | null
    navigator_kind?: string | null
    passenger_seats?: ({ character_id: string; kind: string } | null)[]
    // Mounted weapons - fields used to render firing arc cones AND to
    // hide the assigned shooter token (treat shooters as aboard).
    mounted_weapons?: {
      name: string
      mount_angle?: number
      arc_degrees?: number
      shooter_character_id?: string | null
      shooter_kind?: string | null
    }[]
  }[]
  // Player-or-GM clicks Move on an object token in the in-map panel.
  // Parent owns the moveMode state + the speed × 30ft / acceleration
  // ramp logic, so we just hand off the tokenId.
  onObjectMove?: (tokenId: string) => void
  // Vehicle popout fires a broadcast on the tactical channel after
  // writing seat assignments. Parent supplies this callback to
  // refetch campaigns.vehicles + setVehicles so the aboard-filter
  // and passenger-count badge update immediately.
  onVehiclesNeedRefresh?: () => void
}

function TacticalMap({ campaignId, isGM, initiativeOrder, onTokenClick, onTokenSelect, tokenRefreshKey, campaignNpcs, entries, myCharacterId, viewingSceneId, moveMode, onMoveComplete, onMoveCancel, throwMode, onThrowComplete, onThrowCancel, onTokensUpdate, onTokenChanged, onPlayerDragMove, onGMDragMove, vehicles, onObjectMove, onVehiclesNeedRefresh }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Pan coalescing - multiple mousemove events per frame get merged into
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
  // the drop via CSS - `body.dragging-token .drag-blocker { pointer-events: none }`.
  // Per Xero's playtest report - bottom-left of the tactical map was
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
  // Multistory Path B - when set, the token-action panel renders a
  // scene picker so the GM can shunt the token to another scene
  // (e.g. PCs going upstairs in a multi-floor building). Initiative
  // entries are campaign-scoped, so combat continuity is preserved
  // automatically; only scene_tokens.scene_id needs to flip.
  const [movingTokenToScene, setMovingTokenToScene] = useState<string | null>(null)
  // Firing arc overlays - set of "tokenId:weaponIdx" strings the GM
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
  const [gridColor, setGridColor] = useState('white')
  const [ping, setPing] = useState<{ gx: number; gy: number; t: number; color: string; count: number } | null>(null)
  const [gridOpacity, setGridOpacity] = useState(0.4)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [cellPx, setCellPx] = useState(35)
  const [bgLoadTick, setBgLoadTick] = useState(0) // bumped on bg image load -> retriggers auto-grow-grid
  // Share View button feedback - flashes green for 1.5s after the GM
  // pushes their view to players. Sibling of CampaignMap's shareFlash
  // (added 2026-05-11). Tactical map ships the same pattern 2026-05-19.
  const [tacticalShareFlash, setTacticalShareFlash] = useState(false)
  // GM-painted fog editor state. fogEditMode null = play mode (fog is
  // a render-only display). 'paint' = drag to fog cells; 'erase' =
  // drag to clear cells. fogPainting = pointer is down + dragging.
  // Persisted to tactical_scenes.fog_state on a debounced write so
  // continuous-drag doesn't hammer the DB.
  // The scene-edit mode picker that lives in the (formerly) "Edit Fog"
  // toolbar. Fog tools (paint/erase/rect) and structure tools
  // (wall/door/window) all live here so the GM has one consolidated
  // editor instead of two competing toolbars. Name kept as
  // `fogEditMode` to avoid churning every callsite - it's "scene
  // edit mode" in spirit now.
  const [fogEditMode, setFogEditMode] = useState<'paint' | 'erase' | 'rect' | 'rect-erase' | 'wall' | 'wall-rect' | 'door' | 'window' | 'select' | null>(null)
  // Selected segment id (set by clicking a wall/door/window in Select
  // mode). Drives the highlight in the draw routine and the
  // segment-info action panel that floats below the fog toolbar.
  // Cleared automatically when the GM leaves Select mode.
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const selectedSegmentIdRef = useRef<string | null>(null)
  useEffect(() => { selectedSegmentIdRef.current = selectedSegmentId }, [selectedSegmentId])
  useEffect(() => { if (fogEditMode !== 'select') setSelectedSegmentId(null) }, [fogEditMode])
  // GM fog/lighting toolbar position - state, top-center default,
  // per-campaign persistence and reset all live in the hook.
  // setFogBarRef centers it on mount; fogBarRef is the measured node
  // (reused by the drag handler below).
  const {
    pos: fogBarPos, setPos: setFogBarPos, setRef: setFogBarRef,
    nodeRef: fogBarRef, reset: resetFogBarPos, isMoved: fogBarMoved,
  } = useFogBarPosition(campaignId)
  const fogBarDragRef = useRef<{
    startX: number; startY: number; origX: number; origY: number
    barWidth: number; barHeight: number
    containerWidth: number; containerHeight: number
  } | null>(null)
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
  // Wall-rect mode - drag from one corner to the opposite, commits 4
  // walls forming a closed rectangle. Faster than 4 click-click chains
  // for boxing in a square room. SHIFT honored via getSegmentEndpoint.
  const [wallRectStart, setWallRectStart] = useState<{ x: number; y: number } | null>(null)
  const [wallRectEnd, setWallRectEnd] = useState<{ x: number; y: number } | null>(null)
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
  // Local mirror - the canonical fog state lives on `scene.fog_state`
  // but during a drag we update this immediately and persist on a
  // debounce; reconcile back to scene state when the realtime row
  // update lands.
  const [fogLocal, setFogLocal] = useState<Record<string, boolean>>({})
  const fogLocalRef = useRef<Record<string, boolean>>({})
  useEffect(() => { fogLocalRef.current = fogLocal }, [fogLocal])
  const initiativeOrderRef = useRef<any[]>(initiativeOrder)
  useEffect(() => { initiativeOrderRef.current = initiativeOrder }, [initiativeOrder])
  // Direct ref-load avoids the prop-chain race that left move-follow stale on turn-change.
  async function loadInitiativeRef() {
    const { data } = await campaignInitiativeOrder(campaignId ?? '')
    if (data) initiativeOrderRef.current = data
  }
  const myCharacterIdRef = useRef<string | null | undefined>(myCharacterId)
  // Re-center once when we first learn which PC is ours (parent init() resolved after map loaded).
  useEffect(() => { const p = myCharacterIdRef.current; myCharacterIdRef.current = myCharacterId; if (!p && myCharacterId && centeredSceneIdRef.current) centerViewport() }, [myCharacterId])
  const mapDrawRef = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 })
  const tokensRef = useRef<Token[]>([])
  const portraitCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const tokenAnimRef = useRef<Map<string, { fromX: number; fromY: number; toX: number; toY: number; t: number }>>(new Map())
  const animFrameRef = useRef<number>(0)
  // Which scene we've already auto-centered the scroll for - prevents
  // stealing the user's scroll after they've moved around.
  const centeredSceneIdRef = useRef<string | null>(null)
  // loadTokens: prev ids scroll a new token into view; seq guard drops stale out-of-order fetches.
  const prevTokenIdsRef = useRef<Set<string>>(new Set())
  const prevTokenPosRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const tokenScrollSceneRef = useRef<string | null>(null)
  const loadTokensSeqRef = useRef(0)
  // Same guard for loadScenes: it fires from mount + the tactical_scenes
  // postgres sub (any scene-row update) + the scene_activated broadcast +
  // createScene, so concurrent fetches can resolve out of order and a stale
  // earlier one would clobber the fresh scene list / active scene (and push
  // stale fog/walls into the local mirror via the scene-reconcile effects).
  const loadScenesSeqRef = useRef(0)
  const sceneRef = useRef<Scene | null>(null)
  // invalidated when mover position, range, grid size, or occupied-cell set changes; key checked inline in draw()
  const moveZoneCacheRef = useRef<{ key: string; cells: Array<{gx: number; gy: number}> } | null>(null)
  // invalidated when thrower position, range, or grid size change; key checked inline in draw()
  const throwZoneCacheRef = useRef<{ key: string; cells: Array<{gx: number; gy: number}> } | null>(null)
  // invalidated when hover cell, band radii, or grid size change; key checked inline in draw()
  const blastZoneCacheRef = useRef<{ key: string; engCells: Array<{gx: number; gy: number}>; clCells: Array<{gx: number; gy: number}> } | null>(null)
  // invalidated when PC positions/sight, wall segments, cell blockers, or lighting mode change; key checked inline in draw()
  const fogVisibleCacheRef = useRef<{ key: string; visible: Set<string> } | null>(null)
  // invalidated when visKey, painted-fog cells, grid dims, or hasPCs/hasBlockers change; key checked inline in draw()
  const fogEffectiveCacheRef = useRef<{ key: string; effective: Record<string, boolean> } | null>(null)

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
      // Persist async - the local mirror is already correct.
      wallsLocalRef.current = cleaned
      scheduleWallsPersist()
    }
  }, [scene?.id, scene?.walls, isGM])

  // Retroactive auto-split: when a scene loads, walk every door /
  // window segment and slice any wall that overlaps it. Returns the
  // new array (walls split + openings preserved). Idempotent - a
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
  // out). The new segment itself is NOT included - caller appends.
  // Diagonal walls aren't split for v1 (no rotated buildings yet).
  function splitOverlappingSegments(existing: WallSegment[], inserted: WallSegment): WallSegment[] {
    // Tolerance for "same axis-aligned line" - float-precision
    // segment authoring means y-coords might differ by a tiny
    // fraction even when the GM clicked "the same wall." Anything
    // within ~1px at typical zoom counts as coincident.
    const EPS = 0.05
    const result: WallSegment[] = []
    const isHoriz = (s: WallSegment) => Math.abs(s.y1 - s.y2) < EPS
    const isVert  = (s: WallSegment) => Math.abs(s.x1 - s.x2) < EPS
    const insHoriz = isHoriz(inserted)
    const insVert  = isVert(inserted)
    if (!insHoriz && !insVert) return existing.slice() // diagonal - skip split
    for (const w of existing) {
      // Only walls auto-split. Doors and windows stay intact when a
      // new segment is drawn over them - the GM can manually right-
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
        // (No else - wall is fully consumed by overlap; drop it.)
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
      await updateScene(sceneId, { walls: wallsLocalRef.current as any })
    }, 200)
  }

  // Free-form mouse → cell-units conversion for wall/door/window
  // segment authoring. NOT rounded - segments now follow the cursor
  // pixel-precise so the GM can trace organic building shapes that
  // don't align to grid intersections. Doors and windows additionally
  // snap to nearby walls (see snapPointToNearestWall) so the
  // auto-split mechanic still works against arbitrary-angle walls.
  function getSegmentEndpoint(e: React.MouseEvent): { x: number; y: number } | null {
    if (!canvasRef.current || !scene) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const cellSize = getCellSize()
    const mx = (e.clientX - rect.left) / getScale()
    const my = (e.clientY - rect.top) / getScale()
    let x = Math.max(0, Math.min(scene.grid_cols, mx / cellSize))
    let y = Math.max(0, Math.min(scene.grid_rows, my / cellSize))
    // SHIFT-to-snap. Free-form drawing by default lets the GM draw
    // arbitrary angles for organic shapes (curves, irregular rooms).
    // Holding SHIFT locks the endpoint to the nearest grid intersection
    // so room outlines match the grid cleanly. Both click commits and
    // hover-preview updates flow through this function, so the modifier
    // is honored end-to-end. Same Photoshop / Figma idiom.
    if (e.shiftKey) {
      x = Math.round(x)
      y = Math.round(y)
    }
    return { x, y }
  }

  // Project a point onto the nearest WALL segment within `threshold`
  // cells. Returns the projected point if a wall is close enough, or
  // the original point otherwise. Used for door + window authoring
  // so a click-near-wall lands ON the wall's line - guaranteeing the
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
        setWallRectStart(null)
        setWallRectEnd(null)
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
      await updateScene(sceneId, { fog_state: sparse })
    }, 300)
  }

  // Load scenes
  // Tracks the last scene whose saved cell_px we applied to local UI state.
  // cell_px is a LIVE local control - the popout's Cell-px stepper writes it
  // via the broadcast channel without persisting to the DB on every tick.
  // Without this guard, a `tactical_scenes` realtime UPDATE (e.g. from a +Col
  // click on the popout writing grid_cols) re-runs loadScenes and clobbers the
  // user's in-flight local cell_px by snapping it back to the DB row. Result:
  // the map appears to "enlarge" or "shrink" whenever you nudge cols/rows. Only
  // sync from DB when the active scene ID actually changes.
  const lastSyncedSceneIdRef = useRef<string | null>(null), playerViewingSceneIdRef = useRef<string | null>(null) // 2nd: sticky scene lock; only Share Map re-targets it
  // Guards createScene against rapid double-fire (see createScene).
  const creatingSceneRef = useRef(false)

  async function loadScenes() {
    const seq = ++loadScenesSeqRef.current
    const { data: sceneRows } = await campaignScenes(campaignId)
    if (seq !== loadScenesSeqRef.current) return // superseded by a newer load - don't overwrite (or re-activate) with stale data
    const data = (sceneRows ?? []) as unknown as Scene[]
    setScenes(data)
    // Player: Share Map prop > sticky ref > is_active (first load); GM: is_active.
    const stickyId = !isGM ? (viewingSceneId ?? playerViewingSceneIdRef.current) : null
    const active = stickyId ? data.find((s: Scene) => s.id === stickyId) : data.find((s: Scene) => s.is_active)
    if (!isGM && active) playerViewingSceneIdRef.current = active.id
    if (active) {
      setScene(active)
      loadTokens(active.id)
      // GM path: apply saved cell_px ONLY on first load or scene switch. The
      // lastSyncedSceneIdRef guard exists because the GM's popout writes cell_px
      // to DB after a 400ms debounce, which fires postgres_changes on the GM's
      // main-window TacticalMap; without the guard every popout nudge would
      // re-run loadScenes and clobber the in-flight local value.
      //
      // Player path: ALWAYS apply cell_px from DB so the GM's cell-size change
      // reaches players (they have no popout, nothing to clobber). cell_px +
      // grid_cols/rows are now the ONLY shared map-scale fields - the bg renders
      // to the grid extent, so there is no separate img_scale to sync.
      const isFirstLoad = lastSyncedSceneIdRef.current !== active.id
      if (isFirstLoad || !isGM) {
        if (active.cell_px) setCellPx(active.cell_px)
      }
      if (isFirstLoad) {
        setMapLocked(active.is_locked ?? false)
        // Grid render settings - persisted in tactical_scenes per
        // sql/tactical-scenes-grid-persist.sql so a main-window
        // refresh doesn't revert to the useState defaults.
        if (typeof active.show_grid === 'boolean') setShowGrid(active.show_grid)
        if (typeof active.grid_color === 'string' && active.grid_color) setGridColor(active.grid_color)
        if (typeof active.grid_opacity === 'number') setGridOpacity(active.grid_opacity)
        lastSyncedSceneIdRef.current = active.id
      }
    } else if (data && data.length > 0 && isGM) {
      // No active scene - auto-activate the most recent one
      const first = data[0]
      await updateScene(first.id, { is_active: true })
      setScene(first)
      loadTokens(first.id)
      if (lastSyncedSceneIdRef.current !== first.id) {
        if (first.cell_px) setCellPx(first.cell_px)
        setMapLocked(first.is_locked ?? false)
        if (typeof first.show_grid === 'boolean') setShowGrid(first.show_grid)
        if (typeof first.grid_color === 'string' && first.grid_color) setGridColor(first.grid_color)
        if (typeof first.grid_opacity === 'number') setGridOpacity(first.grid_opacity)
        lastSyncedSceneIdRef.current = first.id
      }
    } else if ((!data || data.length === 0) && isGM) {
      // No scenes at all - open Create Scene modal
      setShowSetup(true)
    }
  }

  async function loadTokens(sceneId: string) {
    // Soft-deleted tokens (archived_at not null) preserve their position
    // for a future remap but render as if absent. Filter them out here.
    const seq = ++loadTokensSeqRef.current
    const { data } = await sceneTokens(sceneId)
    if (seq !== loadTokensSeqRef.current) return // superseded by a newer load - don't overwrite with stale data
    const toks = (data ?? []) as unknown as Token[]
    // Set ref immediately so centerViewport (called from img.onload or the
    // re-center below) reads fresh tokens rather than an empty/stale array.
    tokensRef.current = toks
    setTokens(toks)
    if (tokenScrollSceneRef.current === sceneId) {
      const container = containerRef.current, canvas = canvasRef.current
      // Appeared-token follow (existing)
      const appeared = toks.filter(t => (isGM || t.is_visible) && !prevTokenIdsRef.current.has(t.id))
      const target = appeared.find(t => t.token_type === 'pc') ?? appeared[0]
      if (target && container && canvas) scrollCellIntoView(container, canvas, target.grid_x, target.grid_y, getCellSize(), getScale())
      // Move-follow for active combatant + viewer's own PC (off-screen only)
      if (container && canvas) {
        const activeEntry = initiativeOrderRef.current.find((e: any) => e.is_active)
        const mover = findMoveFollowToken(toks, prevTokenPosRef.current, myCharacterIdRef.current, activeEntry)
        if (mover && !isCellInView({ cellX: mover.grid_x, cellY: mover.grid_y, cellPx: getCellSize(), zoom: getScale(), scrollLeft: container.scrollLeft, scrollTop: container.scrollTop, viewW: container.clientWidth, viewH: container.clientHeight }))
          scrollCellIntoView(container, canvas, mover.grid_x, mover.grid_y, getCellSize(), getScale())
      }
    } else {
      tokenScrollSceneRef.current = sceneId
      // Re-center if the background image loaded before tokens arrived (the
      // img.onload centerViewport ran with an empty tokensRef and centered
      // on map midpoint instead of the party). Now that tokensRef is fresh,
      // re-run so the player opens on their characters, not a blank corner.
      if (centeredSceneIdRef.current === sceneId) centerViewport()
    }
    prevTokenIdsRef.current = new Set(toks.map(t => t.id))
    prevTokenPosRef.current = new Map(toks.map(t => [t.id, { x: t.grid_x, y: t.grid_y }]))
  }

  // Init - load scenes on mount/campaign change. The render-loop's
  // animation frame is cancelled here too (unrelated to realtime; just
  // colocated with the old combined effect's teardown).
  useEffect(() => {
    loadScenes()
    void loadInitiativeRef()
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [campaignId])

  // Realtime - the combat-critical tactical channel, behind the
  // lib/realtime seam. 2 postgres subs (scene_tokens, this campaign's
  // tactical_scenes) + 6 broadcasts; every handler auto-Sentry-wrapped.
  // tacticalChannelRef aliases the handle's channelRef so the many
  // `.send()` sites below are unchanged. Broadcast handlers take the
  // typed payload directly (not msg.payload).
  const tacticalChannel = useCampaignChannel(campaignId, {
    channelName: `tactical_${campaignId}`,
    postgres: [
      { label: 'tactical:scene_tokens', event: '*', table: 'scene_tokens', handler: () => { if (sceneRef.current) loadTokens(sceneRef.current.id) } },
      { label: 'tactical:tactical_scenes', event: '*', table: 'tactical_scenes', filter: `campaign_id=eq.${campaignId}`, handler: () => { loadScenes() } },
      // Keeps initiativeOrderRef fresh so the move-follow in loadTokens always
      // sees the correct active combatant even when initiative changes race the
      // token_moved broadcast (turn-change race, Suspect #1).
      { label: 'tactical:initiative_order', event: '*', table: 'initiative_order', filter: `campaign_id=eq.${campaignId}`, handler: loadInitiativeRef },
    ],
    broadcasts: {
      token_moved: () => { if (sceneRef.current) loadTokens(sceneRef.current.id) },
      // Vehicle popout fires this on every successful seat-write; the
      // parent refetches campaigns.vehicles (aboard-token filter +
      // passenger badge). Belt-and-suspenders for the flaky jsonb
      // campaigns realtime UPDATE path.
      vehicle_updated: () => { onVehiclesNeedRefresh?.() },
      // GM activated a different scene - loadScenes auto-picks is_active.
      scene_activated: () => { loadScenes() },
      firing_arc_toggle: (p) => {
        // Cross-window arc toggle from the /vehicle popout - resolve the
        // vehicle name to all matching object tokens and flip each
        // token+weapon entry in firingArcs.
        const vehicleName = p?.vehicleName
        const weaponIdx = p?.weaponIdx
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
      },
      // (The tactical_zoom auto-broadcast was removed 2026-05-27: zoom is now a
      // purely LOCAL per-client slider - one person zooming must never change
      // anyone else's view. The deliberate Share View push below still exists.)
      tactical_view_share: (p) => {
        // GM Share View - one-shot deliberate push of scroll + zoom. Not a
        // continuous follow; players can keep panning after. (No img_scale: the
        // map scale is shared via grid dims, so only the viewport - zoom +
        // scroll - is pushed.)
        if (isGM) return
        if (typeof p?.zoom === 'number' && p.zoom > 0) setZoom(p.zoom)
        // Defer the scroll to next frame so a zoom change above resizes the
        // canvas first (else we scroll inside the OLD dims).
        if (typeof p?.scrollLeft === 'number' && typeof p?.scrollTop === 'number') {
          requestAnimationFrame(() => {
            const container = containerRef.current
            if (!container) return
            container.scrollTo({ left: p.scrollLeft, top: p.scrollTop, behavior: 'smooth' })
          })
        }
      },
    },
  })
  const tacticalChannelRef = tacticalChannel.channelRef

  // The ping channel is separate (its own ping_${id} topic). gm_ping
  // carries grid coords + color; players also fire it in green.
  const pingChannel = useCampaignChannel(campaignId, {
    channelName: `ping_${campaignId}`,
    broadcasts: {
      gm_ping: (p) => {
        const gx = p?.gx ?? (p as any)?.payload?.gx
        const gy = p?.gy ?? (p as any)?.payload?.gy
        const color = p?.color ?? (p as any)?.payload?.color ?? '#EF9F27'
        if (gx != null && gy != null) setPing({ gx, gy, t: 0, color, count: 3 })
      },
    },
  })
  const pingChannelRef = pingChannel.channelRef

  // Frame on scene open or CENTER button: prefer own PC > active combatant > PCs > visible.
  function centerViewport(rawZoomOverride?: number) {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    setTimeout(() => {
      if (!container || !canvas) return
      const s = sceneRef.current
      const cs = getCellSize()
      const gridW = s ? s.grid_cols * cs : 0
      const gridH = s ? s.grid_rows * cs : 0
      // Compute effective scale from raw zoom (fill-to-width: at zoom=1, grid fills container width).
      // Use expected canvas dims (canvas.width/height may be stale when called after setZoom).
      const rawZ = rawZoomOverride ?? zoom
      const scale = gridW > 0 ? effectiveScale(container.clientWidth, gridW, rawZ) : rawZ > 0 ? rawZ : 1
      const cw = s ? Math.max(container.clientWidth, gridW * scale) : canvas.width
      const ch = s ? Math.max(container.clientHeight, gridH * scale) : canvas.height
      const visible = tokensRef.current.filter(t => isGM || t.is_visible)
      const activeEntry = initiativeOrderRef.current.find((e: any) => e.is_active)
      const c = tokenCentroidCell(findCenterTargets(visible, myCharacterIdRef.current, activeEntry))
      if (c) {
        const { left, top } = centerScrollOnCell({ cellX: c.cellX, cellY: c.cellY, cellPx: cs, zoom: scale, canvasW: cw, canvasH: ch, viewW: container.clientWidth, viewH: container.clientHeight })
        container.scrollLeft = left; container.scrollTop = top
      } else {
        container.scrollLeft = Math.max(0, (cw - container.clientWidth) / 2)
        container.scrollTop = Math.max(0, (ch - container.clientHeight) / 2)
      }
    }, 0)
  }

  // Load background image when scene changes
  useEffect(() => {
    if (!scene?.background_url) {
      bgImageRef.current = null
      draw()
      if (scene && centeredSceneIdRef.current !== scene.id) {
        centeredSceneIdRef.current = scene.id
        setZoom(1)
        centerViewport(1)
      }
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      bgImageRef.current = img
      // The background renders to FILL the grid extent (see draw()), so there
      // is no per-client image scaling. The grid is fit to the image's aspect
      // by the effect below (GM-only, persisted), keeping art + grid + tokens
      // one shared composite. Per-screen fitting is a VIEWPORT concern - zoom /
      // scroll only (see fitToScreen) - never the shared map.
      setBgLoadTick(t => t + 1)
      draw()
      centeredSceneIdRef.current = scene.id
      setZoom(1)
      centerViewport(1)
    }
    img.src = scene.background_url
  }, [scene?.background_url])

  // Lock the grid to the background: size the grid to EXACTLY cover the image
  // at the current cell_px (gridToCoverMap), and persist it (GM-only) so every
  // client shares the same dims - the bg renders to the grid extent, so a
  // matching grid means it fills without distortion and tokens always sit on
  // the art. Runs on image load + cell_px change; re-asserts if the dims drift
  // (e.g. a popout edit). The equality guard stops a re-fire loop. REPLACED the
  // old grow-only cover, which let the grid grow LARGER than the art so tokens
  // past the art's edge fell into black (the "map not the same / tokens in the
  // void" playtest bug). Only applies when there's a background image; a
  // gridded-but-art-less scene keeps its manual dims.
  useEffect(() => {
    const img = bgImageRef.current, s = sceneRef.current, c = containerRef.current
    if (!img || !s || !c) return
    if (isGM) {
      const { cols, rows } = gridToCoverMap(img.naturalWidth, img.naturalHeight, 1, cellPx)
      if (!cols || !rows || (cols === s.grid_cols && rows === s.grid_rows)) return
      setScene(p => p ? { ...p, grid_cols: cols, grid_rows: rows } : p); updateScene(s.id, { grid_cols: cols, grid_rows: rows }).then(({ error }: any) => { if (error) console.error('[TM] auto-fit FAILED', error) })
    }
    setZoom(1); centerViewport(1)
  }, [bgLoadTick, cellPx, isGM, scene?.grid_cols, scene?.grid_rows])

  // Refresh tokens when parent signals a change
  useEffect(() => { if (sceneRef.current) loadTokens(sceneRef.current.id) }, [tokenRefreshKey])
  useEffect(() => { if (!isGM) { if (viewingSceneId) playerViewingSceneIdRef.current = viewingSceneId; loadScenes() } }, [viewingSceneId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live token-patch listener - lets external popups (like ObjectCard's
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
  // campaignNpcs/entries are in the dep list so HP damage repaints the pips immediately - missing them meant tokens stayed stale until some other dependency (click, zoom, move) forced a redraw.
  // `vehicles` MUST be in this dep array - the aboard-token filter +
  // passenger-count badge live inside draw() and read from the
  // vehicles prop via closure. Without this dep, boarding/disembarking
  // updated parent state but the canvas kept rendering the prior frame
  // until something else in the dep list happened to change. Cost is
  // one extra draw per vehicle update (cheap - single rAF tick).
  useEffect(() => { draw() }, [tokens, scene, selectedToken, zoom, showGrid, gridColor, gridOpacity, cellPx, moveMode, throwMode, throwHoverCell, showRangeOverlay, ping, dragging, campaignNpcs, entries, fogLocal, fogEditMode, fogRectStart, fogRectEnd, wallsLocal, wallDrawStart, wallDrawHover, wallRectStart, wallRectEnd, firingArcs, toggleLabel, vehicles])

  // Notify parent of token positions for range calculations
  useEffect(() => {
    if (onTokensUpdate && scene) {
      onTokensUpdate(tokens.map(t => ({ id: t.id, name: t.name, token_type: t.token_type, character_id: t.character_id, npc_id: t.npc_id, grid_x: t.grid_x, grid_y: t.grid_y, grid_w: t.grid_w ?? null, grid_h: t.grid_h ?? null, wp_max: t.wp_max, wp_current: t.wp_current, controlled_by_character_ids: t.controlled_by_character_ids ?? null, rotation: t.rotation ?? 0 })), scene.cell_feet ?? 3)
    }
  }, [tokens, scene?.cell_feet])

  // (Removed 2026-05-27: the GM-zoom auto-broadcast that snapped every player's
  // zoom to the GM's. Zoom is now a LOCAL per-client slider - one person
  // zooming must not change anyone else's view. The GM can still deliberately
  // push their view via the Share View button.)

  // Spacebar = pan-mode visual cue + click-and-drag override.
  // Arrow keys (or WASD) = continuous smooth pan via rAF, no mouse
  // needed. Multiple keys can be held for diagonal pan. Steady 60fps
  // velocity decouples pan from mouse jitter - fixes the "still
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
        // Diagonal normalization - keep total speed consistent so
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
      // auto-repeat each repeat fires another scroll - which during
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

  // Fill-to-width scale: at zoom=1 the grid fills the container width.
  // See lib/tactical-view effectiveScale(). Purely per-client; never broadcast.
  function getScale(): number {
    const container = containerRef.current
    const s = sceneRef.current
    if (!container || !s) return zoom > 0 ? zoom : 1
    const gridW = s.grid_cols * getCellSize()
    return effectiveScale(container.clientWidth, gridW, zoom)
  }

  function draw() {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const s = sceneRef.current
    if (!s) return

    // Canvas must be large enough for the zoomed view AND the full grid.
    const baseW = container.clientWidth
    const baseH = container.clientHeight
    const cellSize = getCellSize()
    const gridW = s.grid_cols * cellSize
    const gridH = s.grid_rows * cellSize
    // The background is LOCKED to the grid: it renders to exactly cover the grid
    // extent (gridW x gridH), so the art, the grid, and the tokens are ONE rigid
    // composite - tokens always sit ON the art (never in black) and it's
    // pixel-identical for every viewer (grid_cols/rows + cell_px are shared DB
    // fields). The grid auto-fits the image's aspect on load (see the bg-load
    // effect), so filling it introduces no visible distortion. img_scale - a
    // second, independent scale that decoupled the bg from the grid (bg didn't
    // fill the grid; tokens "bounced" when it was dragged) - was retired
    // 2026-05-27; the render no longer reads it.
    // Fill-to-width: at zoom=1, scale = containerW/gridW so gridW*scale == baseW.
    // Zoom > 1 over-fills width (scroll); zoom < 1 shrinks below container width.
    const scale = getScale()
    canvas.width = Math.max(baseW, gridW * scale)
    canvas.height = Math.max(baseH, gridH * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const offsetX = 0
    const offsetY = 0

    // Clear
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Apply the effective scale - scales everything: image, grid, tokens.
    ctx.save()
    ctx.scale(scale, scale)

    // Background image - drawn to fill the grid extent, identical for everyone.
    // No corner resize handles anymore: the bg can't be scaled independently of
    // the grid (that was the decoupling bug), so there's nothing to drag.
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, offsetX, offsetY, gridW, gridH)
      mapDrawRef.current = { x: offsetX, y: offsetY, w: gridW, h: gridH }
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

    // Move mode highlight - draw valid movement cells
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
        const mzKey = `${moveTok.grid_x},${moveTok.grid_y}:${moveCells}:${s.grid_cols}x${s.grid_rows}:${[...occupied].sort().join('|')}`
        if (moveZoneCacheRef.current?.key !== mzKey) {
          const cells: Array<{gx: number; gy: number}> = []
          for (let gx = 0; gx < s.grid_cols; gx++) {
            for (let gy = 0; gy < s.grid_rows; gy++) {
              const dist = Math.max(Math.abs(gx - moveTok.grid_x), Math.abs(gy - moveTok.grid_y))
              if (dist > 0 && dist <= moveCells && !occupied.has(`${gx},${gy}`)) cells.push({ gx, gy })
            }
          }
          moveZoneCacheRef.current = { key: mzKey, cells }
        }
        for (const { gx, gy } of moveZoneCacheRef.current!.cells) {
          ctx.fillStyle = 'rgba(127,196,88,0.25)'
          ctx.fillRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
          ctx.strokeStyle = 'rgba(127,196,88,0.5)'
          ctx.lineWidth = 1
          ctx.strokeRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
        }
      }
    }

    // Throw-to-cell highlight - paint every cell within weapon range of
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
        const tzKey = `${throwerTok.grid_x},${throwerTok.grid_y}:${rangeCells}:${s.grid_cols}x${s.grid_rows}`
        if (throwZoneCacheRef.current?.key !== tzKey) {
          const cells: Array<{gx: number; gy: number}> = []
          for (let gx = 0; gx < s.grid_cols; gx++) {
            for (let gy = 0; gy < s.grid_rows; gy++) {
              const dist = Math.max(Math.abs(gx - throwerTok.grid_x), Math.abs(gy - throwerTok.grid_y))
              // Include the thrower's own cell (dist=0) so a player can
              // drop a grenade at their feet if they really want to. Max
              // bound: rangeCells. Dropping on self = Engaged = full blast
              // to self, which is intentionally brutal.
              if (dist <= rangeCells) cells.push({ gx, gy })
            }
          }
          throwZoneCacheRef.current = { key: tzKey, cells }
        }
        for (const { gx, gy } of throwZoneCacheRef.current!.cells) {
          ctx.fillStyle = 'rgba(239,159,39,0.22)'
          ctx.fillRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
          ctx.strokeStyle = 'rgba(239,159,39,0.55)'
          ctx.lineWidth = 1
          ctx.strokeRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
        }

        // Blast preview - when the weapon has Blast Radius, paint
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
            const bzKey = `${hov.gx},${hov.gy}:${engagedCells}:${closeCells}:${s.grid_cols}x${s.grid_rows}`
            if (blastZoneCacheRef.current?.key !== bzKey) {
              const engCells: Array<{gx: number; gy: number}> = []
              const clCells: Array<{gx: number; gy: number}> = []
              for (let gx = 0; gx < s.grid_cols; gx++) {
                for (let gy = 0; gy < s.grid_rows; gy++) {
                  const d = Math.max(Math.abs(gx - hov.gx), Math.abs(gy - hov.gy))
                  if (d <= engagedCells) engCells.push({ gx, gy })
                  else if (d <= closeCells) clCells.push({ gx, gy })
                }
              }
              blastZoneCacheRef.current = { key: bzKey, engCells, clCells }
            }
            ctx.fillStyle = 'rgba(192,57,43,0.45)'  // red - full damage
            for (const { gx, gy } of blastZoneCacheRef.current!.engCells) {
              ctx.fillRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
            }
            ctx.fillStyle = 'rgba(239,159,39,0.32)'  // amber - 50%
            for (const { gx, gy } of blastZoneCacheRef.current!.clCells) {
              ctx.fillRect(offsetX + gx * cellSize + 1, offsetY + gy * cellSize + 1, cellSize - 2, cellSize - 2)
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

    // Range circles for selected PC/NPC token - Engaged, Move 9ft, primary weapon range.
    // Object tokens (crates, cars, doors) don't get circles - they don't attack or move.
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
        // Clamp visual radius to the map's own extent - a 300ft/600ft circle on a
        // 20-cell map just engulfs everything. Label keeps the real range so the
        // player still knows "Sniper (600ft)" even when the circle stops at the edge.
        const mapExtentCells = Math.max(s.grid_cols, s.grid_rows)
        const weaponCells = Math.min(rawWeaponCells, mapExtentCells)
        const clampedLabel = rawWeaponCells > mapExtentCells
          ? `${weaponRangeBand} (${weaponRangeFt}ft - reaches map edge)`
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
    // time so the GM's authored fog_state stays untouched - the GM
    // edit-mode view still shows the raw layer for predictable
    // painting. Out of edit mode, the GM sees what the players see.
    const VISION_RADIUS_CELLS = 30
    const rawFog = fogLocalRef.current
    let fogMap = rawFog
    // PC tokens that fire vision. PC-only by spec - NPCs don't lift
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
      //   • Wall/door/window SEGMENTS (cell edges, thin) - preferred,
      //     drawn via the toolbar's Wall/Door/Window tools.
      //   • Wall/door/window OBJECTS (whole-cell tokens, legacy) -
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
      // Whether the scene has any vision-blocking geometry. Drives
      // both the painted-fog defeasibility rule and the auto-fog
      // gate below - see the comment block at the painted-fog loop.
      const hasBlockers = visionSegs.length > 0 || cellBlockers.size > 0
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
      const isDay = (s.lighting_mode ?? 'day') === 'day'
      const dayRadius = Math.max(s.grid_cols, s.grid_rows)
      const visKey = `${isDay}:${dayRadius}:`
        + pcVisionTokens.map((t: Token) => `${t.grid_x},${t.grid_y},${t.sight_radius_cells ?? ''},${t.grid_w ?? 1},${t.grid_h ?? 1}`).join('|')
        + ':' + visionSegs.map((seg: WallSegment) => `${seg.x1},${seg.y1},${seg.x2},${seg.y2}`).join('|')
        + ':' + [...cellBlockers].sort().join('|')
      let visible: Set<string>
      if (fogVisibleCacheRef.current?.key === visKey) {
        visible = fogVisibleCacheRef.current.visible
      } else {
        visible = new Set<string>()
        // Vision sweep only runs if the scene has authored blockers
        // (walls / closed doors / closed windows / wall-tagged tokens).
        // On a no-blocker scene - building drawn into the background
        // image, no segments authored - day-mode unbounded sight would
        // mark every cell visible, defeating both painted fog and the
        // auto-fog blanket below. Skipping the sweep here means
        // `visible` stays empty, painted fog renders absolute, and
        // auto-fog is gated off (see below). Once the GM authors any
        // walls/doors/windows, vision becomes meaningful and both
        // painted fog and auto-fog become LoS-driven.
        if (hasBlockers) {
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
        }
        fogVisibleCacheRef.current = { key: visKey, visible }
      }
      // GM-painted fog: defeasible by PC LoS *when* the scene has
      // authored blockers - opening a window or door extends LoS
      // through that opening and clears painted fog along the path,
      // which is the GM's intuitive workflow. On no-blocker scenes
      // the `visible` set stays empty (we skipped the sweep above),
      // so painted fog renders absolute. This is the compromise
      // between two earlier attempts: pure-LoS-defeasible nuked
      // painted fog on no-blocker maps; pure-absolute broke
      // open-window-clears-fog on properly-authored maps.
      //
      // Auto-fog: every cell outside any PC's LoS is fogged. Only
      // meaningful when blockers exist - otherwise "outside LoS"
      // would be the empty set (with unbounded day-sight) or the
      // edge of the radius (in night mode), neither of which the
      // GM is likely to want as a default. So gate on hasBlockers
      // alongside hasPCs.
      const rawFogPaintedKey = Object.keys(rawFog).filter(k => rawFog[k]).sort().join('|')
      const effKey = `${visKey}::${s.grid_cols}x${s.grid_rows}:${hasPCs ? 1 : 0}:${hasBlockers ? 1 : 0}:${rawFogPaintedKey}`
      let effective: Record<string, boolean>
      if (fogEffectiveCacheRef.current?.key === effKey) {
        effective = fogEffectiveCacheRef.current.effective
      } else {
        effective = {}
        for (const k of Object.keys(rawFog)) {
          if (rawFog[k] && !visible.has(k)) effective[k] = true
        }
        if (hasPCs && hasBlockers) {
          for (let x = 0; x < s.grid_cols; x++) {
            for (let y = 0; y < s.grid_rows; y++) {
              const k = `${x},${y}`
              if (!visible.has(k)) effective[k] = true
            }
          }
        }
        fogEffectiveCacheRef.current = { key: effKey, effective }
      }
      fogMap = effective
    }
    const fogKeys = Object.keys(fogMap)
    if (fogKeys.length > 0) {
      const cellW = gridW / s.grid_cols
      const cellH = gridH / s.grid_rows
      ctx.save()
      // Fog opacity:
      //   • GM actively painting (fogEditMode truthy): light overlay
      //     (0.35) so the GM can see the underlying map structure
      //     while choosing what to fog.
      //   • Everyone else (GM not painting + every player): fully
      //     opaque black. Pre-fix this was `0.92` for players (8%
      //     translucent - token shadows + structure still bled
      //     through) and a permanent `0.35` for the GM whether or
      //     not they were editing. Reported tonight as "the fog
      //     isn't completely dark".
      const fogOpaque = !(isGM && fogEditMode)
      ctx.fillStyle = fogOpaque ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.35)'
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

    // Aboard-token suppression (2026-05-17; scene-scoped 2026-05-28). Crew in a
    // vehicle seat are hidden from the canvas (the vehicle token shows a 🪑 N
    // passenger badge instead). SCENE-SCOPED: a crew member only counts as
    // aboard on scenes where the vehicle has a token (matched by name) - so a
    // driver isn't hidden on maps the vehicle isn't even in. Pure + unit-tested
    // in lib/tactical-view (computeAboard).
    const tokenNamesOnScene = new Set(tokensRef.current.map(t => t.name))
    const { aboardCharIds, aboardNpcIds, passengerCountByVehicleName } = computeAboard(vehicles ?? [], tokenNamesOnScene)

    // Tokens. Sort so objects render first (bottom), then NPCs, then PCs
    // on top - canvas is painter's-algorithm, last draw wins. Prevents a
    // barrel or crate from covering a player token when they share a
    // neighboring cell. Stable within each tier via index fallback.
    const toks = [...tokensRef.current]
      // Hide tokens whose owner is currently aboard any vehicle. Done
      // before the fog filter so aboard tokens don't even contribute
      // their footprint cells to visibility checks.
      .filter(t => {
        if (t.character_id && aboardCharIds.has(t.character_id)) return false
        if (t.npc_id && aboardNpcIds.has(t.npc_id)) return false
        return true
      })
      // Player-side fog suppression: a token sitting in a fogged cell
      // is invisible to non-GM viewers. GM sees everything (their
      // overlay is only 35% opacity above). Combined with the
      // auto-fog-outside-PC-LoS pass earlier in this render, this is
      // the LoS gating - tokens behind walls are auto-fogged and
      // therefore filtered out here. For multi-cell tokens we scan
      // the entire grid_w × grid_h footprint: a token is visible iff
      // ANY of its cells is unfogged. (Anchor-only previously caused
      // a 2×2 vehicle straddling a wall to pop in/out based on the
      // top-left cell.)
      .filter(t => {
        if (isGM) return true
        const gw = t.grid_w ?? 1
        const gh = t.grid_h ?? 1
        if (gw === 1 && gh === 1) return !fogMap[`${t.grid_x},${t.grid_y}`]
        for (let dx = 0; dx < gw; dx++) {
          for (let dy = 0; dy < gh; dy++) {
            if (!fogMap[`${t.grid_x + dx},${t.grid_y + dy}`]) return true
          }
        }
        return false
      })
      .sort((a, b) => {
      const tier = (t: any) => t.token_type === 'object' ? 0 : t.token_type === 'npc' ? 1 : 2
      return tier(a) - tier(b)
    })
    const activeEntry = initiativeOrder.find((e: any) => e.is_active)

    let hasActiveAnim = false
    toks.forEach(t => {
     try {
      if (!t.is_visible && !isGM) return
      // Multi-cell footprint (objects only - defaults to 1×1). The
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

      // Pin marker - minimal render, just the emoji at the grid center.
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

      // Active combatant marker - GOLD (turn-spotlight) glow + ring + a
      // downward pointer arrow (drawn below). Replaces the old thin white
      // ring, which vanished into bright portraits + got lost among the
      // range rings (Xero, live session 2026-06-01: "hard to tell it's
      // Avery"). Gold reads as "your turn" and, like the old white, doesn't
      // collide with the green disposition / red selected highlight; the
      // dark-backed ring + arrow keep it legible on ANY background or color.
      const isActive = activeEntry && (
        (t.character_id && activeEntry.character_id === t.character_id) ||
        (t.npc_id && activeEntry.npc_id === t.npc_id) ||
        (t.name === activeEntry.character_name)
      )
      if (isActive) {
        ctx.shadowColor = '#ffc61f'
        ctx.shadowBlur = 20
      }

      // Selected highlight
      if (selectedToken === t.id) {
        ctx.shadowColor = '#c0392b'
        ctx.shadowBlur = 16
      }

      // GM always sees tokens at full opacity - no fading for "hidden"
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
          const wp = entry.liveState?.wp_current ?? entry.liveState?.wp_max ?? 10
          tokenDead = wp === 0
          tokenMortal = wp === 0
        }
      } else if (t.token_type === 'object' && (t as any).wp_max != null) {
        const wp = (t as any).wp_current ?? (t as any).wp_max ?? 0
        tokenDead = wp <= 0
      }

      // Destroyed objects fade further than downed PCs/NPCs so they read as
      // "gone" rather than just "out of the fight". Keep full opacity when a
      // destroyed portrait is set - the alt art is the story, don't mute it.
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

      // Token shape - circle for PC/NPC, square for objects
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
        // have the most state - open/closed), then walls (always
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
        // are see-through by default - the fill is barely-there blue
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
          // Open window (default) is barely-tinted - vision passes
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
          // dark border (no emoji - the texture is the visual);
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
              // Horizontal slats - fast suggestion of blinds without
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
          // Emoji or initials. Walls render their texture only - no
          // emoji label - so the brickwork stays clean.
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
          if (isActive) {
            // Dark backing ring (reads on any portrait) + bold gold ring.
            ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.stroke()
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2)
            ctx.strokeStyle = '#ffc61f'; ctx.lineWidth = 3.5; ctx.stroke()
          } else {
            ctx.strokeStyle = selectedToken === t.id ? '#f5f2ee' : vividTokenBorder(t.color)
            ctx.lineWidth = selectedToken === t.id ? 3 : 2
            ctx.stroke()
          }
        } else {
          ctx.fillStyle = t.is_visible ? vividTokenBorder(t.color) : 'rgba(192,57,43,0.3)'
          ctx.fill()
          if (isActive) {
            ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.stroke()
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2)
            ctx.strokeStyle = '#ffc61f'; ctx.lineWidth = 3.5; ctx.stroke()
          } else {
            ctx.strokeStyle = selectedToken === t.id ? '#f5f2ee' : 'rgba(255,255,255,1)'
            ctx.lineWidth = selectedToken === t.id ? 3 : 1.5
            ctx.stroke()
          }
          ctx.fillStyle = '#f5f2ee'
          ctx.font = `bold ${Math.max(10, radius * 0.8)}px Carlito`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const initials = t.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
          ctx.fillText(initials, cx, cy)
        }
      }
      // Load portrait(s) for next draw - both intact and destroyed URLs, so
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

      // Active-combatant turn pointer: a gold downward arrow hovering just
      // above the token, pointing at whoever has the turn. Shape-based, so
      // it's unmistakable regardless of background or token color (the ring
      // alone could still get lost on a busy map). Only PC/NPC combatants
      // are ever isActive, so objects never get one.
      if (isActive) {
        const gap = Math.max(5, radius * 0.4)
        const aw = Math.max(7, radius * 0.55)   // half-width of the arrow
        const ah = Math.max(8, radius * 0.6)    // height of the arrow
        const tipY = cy - radius - gap          // point sits just above the ring
        ctx.beginPath()
        ctx.moveTo(cx - aw, tipY - ah)
        ctx.lineTo(cx + aw, tipY - ah)
        ctx.lineTo(cx, tipY)
        ctx.closePath()
        ctx.fillStyle = '#ffc61f'
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#1a1a1a'
        ctx.stroke()
      }

      // Dead or mortally wounded - red combat X for everyone (PCs, NPCs,
      // destroyed objects). Previously objects got a subtle dark-crack
      // pattern that was too easy to miss at a glance on busy terrain;
      // the red X matches the PC/NPC "this token is out of the fight"
      // convention so the map reads consistently. Skip when a destroyed
      // portrait is rendering - the portrait itself conveys destruction.
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

      // Name below - objects get up to 2 lines, characters get first word only
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
        if (entry) { wpCur = entry.liveState?.wp_current ?? entry.liveState?.wp_max ?? 10; wpMax = entry.liveState?.wp_max ?? 10 }
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

      // Passenger-count badge (top-right of vehicle/object tokens).
      // Only rendered when a vehicle of this name has 1+ bodies in
      // any seat. Bare count - no chair icon, sized smaller than the
      // initiative badge so it reads as a secondary annotation.
      if (t.token_type === 'object') {
        const paxCount = passengerCountByVehicleName.get(t.name) ?? 0
        if (paxCount > 0) {
          const badgeR = Math.max(10, radius * 0.21)
          ctx.beginPath()
          ctx.arc(cx, cy, badgeR, 0, Math.PI * 2)
          ctx.fillStyle = '#1a2e10'
          ctx.fill()
          ctx.strokeStyle = '#7fc458'
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.fillStyle = '#7fc458'
          ctx.font = `bold ${Math.max(13, badgeR * 1.15)}px Carlito`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(paxCount), cx, cy)
        }
      }

      ctx.globalAlpha = 1
     } catch {
       // A bad token must never abort the loop + blank the rest - reset ctx, fallback-draw.
       ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; try { ctx.setLineDash([]) } catch {}
       if ((t?.rotation ?? 0) !== 0) { try { ctx.restore() } catch {} }
       drawFallbackToken(ctx, t, cellSize, offsetX, offsetY)
     }
    })

    // Ping - 3 pulsing rings that fade out, cycling red/green/red to match
    // the campaign map's ping (role color intentionally ignored - alternating
    // hue catches the eye peripherally). count runs 3 -> 2 -> 1.
    if (ping) {
      const pingCx = offsetX + ping.gx * cellSize + cellSize / 2
      const pingCy = offsetY + ping.gy * cellSize + cellSize / 2
      const pulseColor = ping.count === 2 ? '#39ff14' : '#ff3a1d'
      const pingProgress = Math.min(1, ping.t)
      const pingRadius = cellSize * 0.5 + cellSize * 1.5 * pingProgress
      const pingAlpha = 1 - pingProgress
      ctx.beginPath()
      ctx.arc(pingCx, pingCy, pingRadius, 0, Math.PI * 2)
      ctx.strokeStyle = pulseColor
      ctx.lineWidth = 3
      ctx.globalAlpha = pingAlpha
      ctx.stroke()
      if (pingProgress < 0.3) {
        ctx.beginPath()
        ctx.arc(pingCx, pingCy, cellSize * 0.2, 0, Math.PI * 2)
        ctx.fillStyle = pulseColor
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
    // separately below - order: tokens → arcs → walls so doors etc.
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
          // Wedge fill - purple-ish with low alpha so the underlying
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
    // on top of object portraits - important for doors that need to
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
          // Visibility pass 2026-05-09: doors and windows now render
          // THICKER (6px) than walls (4px) so interactive elements
          // sit visually above the wall flow. Colors brightened for
          // contrast against the warm-tan wall palette. Endpoint
          // dots draw below to signal "this segment terminates here,
          // it's a thing" - walls stay clean. Windows additionally
          // draw a dashed white halo first so they pop unambiguously
          // against the wall palette (especially the closed-amber
          // state which would otherwise blend into the tan walls).
          let strokeColor = '#a08e75'
          if (seg.kind === 'wall') {
            ctx.strokeStyle = '#a08e75'
            ctx.lineWidth = 4
            ctx.setLineDash([])
          } else if (seg.kind === 'door') {
            const open = seg.door_open ?? true
            strokeColor = open ? '#8de066' : '#e74c3c'
            ctx.strokeStyle = strokeColor
            ctx.lineWidth = 6
            ctx.setLineDash(open ? [6, 4] : [])
          } else {
            // window - OPEN (default) = sky-blue dashed line, reads
            // as "see-through frame." CLOSED = blinds drawn, renders
            // as a solid amber line that visually "blocks" the view
            // (matches the mechanical vision-block when closed).
            // Both states get a dashed white halo first; the colored
            // stroke draws on top, leaving white edges visible
            // perpendicular to the segment that read as a "window
            // frame" iconography regardless of state.
            const winOpen = seg.door_open !== false  // default = open
            ctx.save()
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = winOpen ? 9 : 10
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
            ctx.restore()
            strokeColor = winOpen ? '#5dc4e3' : '#d4a04a'
            ctx.strokeStyle = strokeColor
            ctx.lineWidth = winOpen ? 5 : 6
            ctx.setLineDash(winOpen ? [5, 3] : [])
          }
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          // Endpoint dots - doors and windows only. Filled circle
          // in the segment's accent color, ~3.5px radius. Walls
          // skip this so a long run of walls stays a clean line.
          if (seg.kind !== 'wall') {
            ctx.save()
            ctx.fillStyle = strokeColor
            ctx.setLineDash([])
            ctx.beginPath()
            ctx.arc(x1, y1, 3.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.beginPath()
            ctx.arc(x2, y2, 3.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          // Selection highlight - bright white glow around the
          // currently-selected segment so the GM can see exactly
          // which one the action panel is acting on. Drawn AFTER
          // the kind-specific stroke so it overlays cleanly.
          if (selectedSegmentIdRef.current === seg.id) {
            ctx.save()
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 6
            ctx.setLineDash([])
            ctx.shadowColor = '#ffffff'
            ctx.shadowBlur = 10
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
            ctx.restore()
          }
        }
        // Live preview of the in-flight segment.
        if (wallDrawStart && wallDrawHover && (fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window')) {
          const x1 = offsetX + wallDrawStart.x * cellW
          const y1 = offsetY + wallDrawStart.y * cellH
          const x2 = offsetX + wallDrawHover.x * cellW
          const y2 = offsetY + wallDrawHover.y * cellH
          ctx.strokeStyle = fogEditMode === 'wall' ? '#a08e75'
            : fogEditMode === 'door' ? '#8de066'
            : '#5dc4e3'
          ctx.globalAlpha = 0.55
          ctx.lineWidth = 4
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
        // Endpoint markers when in a draw mode - small dots at each
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

    // Wall-rect drag preview - dashed tan rectangle outline. Lives
    // OUTSIDE the segments.length>0 block so it renders on empty
    // scenes too (when boxing in the very first room).
    if (fogEditMode === 'wall-rect' && wallRectStart && wallRectEnd && scene) {
      const cellW = (scene.grid_cols * cellSize) / scene.grid_cols
      const cellH = (scene.grid_rows * cellSize) / scene.grid_rows
      const minX = Math.min(wallRectStart.x, wallRectEnd.x)
      const maxX = Math.max(wallRectStart.x, wallRectEnd.x)
      const minY = Math.min(wallRectStart.y, wallRectEnd.y)
      const maxY = Math.max(wallRectStart.y, wallRectEnd.y)
      ctx.save()
      ctx.strokeStyle = '#a08e75'
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 4
      ctx.setLineDash([4, 4])
      ctx.strokeRect(
        offsetX + minX * cellW,
        offsetY + minY * cellH,
        (maxX - minX) * cellW,
        (maxY - minY) * cellH,
      )
      ctx.restore()
    }

    // Rectangle marquee preview - draws while the GM is dragging
    // the Rect fog tool. On mouseup the rectangle is committed to
    // fog_state and the preview clears. Erase variant gets a red
    // tint so the GM knows it'll subtract.
    if ((fogEditMode === 'rect' || fogEditMode === 'rect-erase') && fogRectStart && fogRectEnd) {
      const cellW = (s.grid_cols * cellSize) / s.grid_cols
      const cellH = (s.grid_rows * cellSize) / s.grid_rows
      // Float-coord marquee - pixel-precise box that doesn't snap.
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

    // Transient toggle label - flashes "Door opened" / "Window
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
    const mx = (e.clientX - rect.left) / getScale()
    const my = (e.clientY - rect.top) / getScale()
    const gx = Math.floor((mx - 0) / cellSize)
    const gy = Math.floor((my - 0) / cellSize)
    if (gx < 0 || gx >= scene.grid_cols || gy < 0 || gy >= scene.grid_rows) return null
    return { gx, gy }
  }

  // Float-precision sub-cell mouse position. Used by the rect-fog
  // tool so the GM can drag a rectangle that doesn't snap to grid
  // intersections - gives a smooth marquee box. Out-of-bounds values
  // are clamped to scene edges so a drag past the canvas edge stays
  // on the map.
  function getCellPosFloat(e: React.MouseEvent): { x: number; y: number } | null {
    if (!canvasRef.current || !scene) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const cellSize = getCellSize()
    const mx = (e.clientX - rect.left) / getScale()
    const my = (e.clientY - rect.top) / getScale()
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
    // renders a circle of `cellSize * 0.4 * scale` pixels - i.e.
    // `0.4 * scale` cells radius - but its grid footprint stays at
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

  // Vehicle passenger sync helper - when an object token whose name
  // matches a campaign vehicle moves, every PC/NPC riding in one of
  // its slots (driver / brewer / navigator / gunner / passenger_seats)
  // has their own token dragged along by the same (dx, dy). Called
  // from BOTH the drag-completion path in handleMouseUp AND the
  // MOVE-button moveMode commit in handleMouseDown, so vehicles carry
  // their passengers no matter which gesture moves them. Vehicles
  // aren't a separate table; they live on campaigns.vehicles JSONB.
  // Name-based matching mirrors the damage-sync pattern (c35770e) -
  // fragile if two vehicles share a name in one campaign, rare edge
  // case. Fire-and-forget; if no vehicle matches the name, no-op.
  function syncVehiclePassengers(tok: Token, tokenId: string, dx: number, dy: number) {
    if (tok.token_type !== 'object' || (dx === 0 && dy === 0)) return
    void (async () => {
      const { data: camp } = await campaignVehiclesOnly(campaignId)
      const list = ((camp as any)?.vehicles ?? []) as any[]
      const veh = list.find(v => v?.name === tok.name)
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
      // tokensRef has the freshest version (the setTokens for the
      // vehicle just committed; React batched but the ref is updated).
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
        updateToken(p.id, { grid_x: p.grid_x + dx, grid_y: p.grid_y + dy })
      ))
      tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_moved', payload: {} })
    })()
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Alt + right-click anywhere → toggle the nearest door OR window
    // (segment OR object token), regardless of edit mode. Universal
    // gesture for "open/close that thing." Door state flips
    // open/closed (existing behavior); window state flips
    // closed-glass (movement blocked, vision passes) ↔ open-glass
    // (passable both ways). Plain right-click + edit mode still
    // means "delete nearest segment" - alt distinguishes the two.
    if (e.button === 2 && e.altKey && canvasRef.current && scene) {
      e.preventDefault()
      const rect = canvasRef.current.getBoundingClientRect()
      const cellSize = getCellSize()
      const mxCells = (e.clientX - rect.left) / getScale() / cellSize
      const myCells = (e.clientY - rect.top) / getScale() / cellSize
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
      // 2) Fall through to object TOKEN under the cursor - only doors
      //    or windows. Toggle door_open the same way the existing
      //    door-token click handler does.
      const pos = getGridPos(e)
      if (pos) {
        const tok = getTokenAt(pos.gx, pos.gy)
        if (tok && (tok.is_door || tok.is_window)) {
          const nextOpen = !tok.door_open
          setTokens(prev => prev.map(x => x.id === tok.id ? { ...x, door_open: nextOpen } : x))
          updateToken(tok.id, { door_open: nextOpen }).then(() => {
            tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
          })
          return
        }
      }
      return
    }
    // Select mode - left-click finds the nearest wall/door/window
    // segment (any kind, within ~half a cell) and highlights it. The
    // selected-segment action panel below the fog toolbar exposes
    // delete + open/close + convert. Click empty space to deselect.
    // Lives BEFORE the door/window plain-click toggle below so a
    // click in Select mode doesn't also flip a door state.
    if (fogEditMode === 'select' && isGM && e.button === 0 && canvasRef.current && scene) {
      const rect = canvasRef.current.getBoundingClientRect()
      const cellSize = getCellSize()
      const mx = (e.clientX - rect.left) / getScale() / cellSize
      const my = (e.clientY - rect.top) / getScale() / cellSize
      let bestId: string | null = null
      let bestDist = 0.5
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
      setSelectedSegmentId(bestId)  // null when click is empty space → deselect
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
      const mx = (e.clientX - rect.left) / getScale() / cellSize
      const my = (e.clientY - rect.top) / getScale() / cellSize
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
    // Door / window SEGMENT click - plain click toggles open/closed
    // when not in any edit mode (gameplay interaction). Detection is
    // point-to-segment distance against door + window segments.
    if (!fogEditMode && e.button === 0 && wallsLocalRef.current.some(w => w.kind === 'door' || w.kind === 'window')) {
      if (canvasRef.current && scene) {
        const rect = canvasRef.current.getBoundingClientRect()
        const cellSize = getCellSize()
        const mx = (e.clientX - rect.left) / getScale() / cellSize
        const my = (e.clientY - rect.top) / getScale() / cellSize
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
          // RPC is membership-gated; works for players, not isGM-only like scheduleWallsPersist
          toggleWallSegmentDoor(scene.id, targetId, nextOpen).then(({ error }) => {
            if (error) console.error('[TM] door toggle RPC failed:', error.message)
          })
          // Toast - render midpoint of the segment.
          const midX = (bestSeg.x1 + bestSeg.x2) / 2
          const midY = (bestSeg.y1 + bestSeg.y2) / 2
          showToggleLabel(midX, midY, `${bestSeg.kind === 'door' ? 'Door' : 'Window'} ${nextOpen ? 'opened' : 'closed'}`)
          return
        }
      }
    }
    // Wall-rect mode - drag from one corner to opposite corner.
    // mouseup commits 4 walls forming a closed rectangle. SHIFT-snap
    // honored automatically via getSegmentEndpoint. ESC cancels.
    if (fogEditMode === 'wall-rect' && isGM && e.button === 0) {
      const raw = getSegmentEndpoint(e)
      if (!raw) return
      setWallRectStart(raw)
      setWallRectEnd(raw)
      fogPaintingRef.current = true
      return
    }
    // Wall/door/window segment authoring. First click = start point;
    // second click = end point (commit). The preview line follows the
    // cursor between clicks. ESC cancels (handled in the keydown
    // effect above).
    if (fogEditMode && isGM && e.button === 0 && (fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window')) {
      const raw = getSegmentEndpoint(e)
      if (!raw) return
      // Doors + windows snap onto the nearest wall so they always
      // land on a wall's line - auto-split has a clean coincidence
      // to detect. Walls themselves stay free-form.
      const inter = (fogEditMode === 'wall') ? raw : snapPointToNearestWall(raw)
      if (!wallDrawStart) {
        setWallDrawStart(inter)
        setWallDrawHover(inter)
        return
      }
      // Second click - commit the segment if it's not zero-length.
      if (inter.x === wallDrawStart.x && inter.y === wallDrawStart.y) {
        // Same point - treat as cancel.
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
        // "punches a hole" in the wall - split the wall into the
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
      // Chain - pre-seed the next segment from the just-clicked
      // endpoint so the GM can draw an L or run-of-walls without
      // re-clicking. Press ESC or pick a different tool to stop.
      setWallDrawStart(inter)
      setWallDrawHover(inter)
      return
    }
    // Fog edit mode - paint or erase the cell under the cursor and
    // start tracking drag so handleMouseMove fills cells along the
    // drag path. Checked BEFORE every other mode so the GM can paint
    // fog without worrying about fall-through to token clicks.
    if (fogEditMode && isGM && e.button === 0) {
      const pos = getGridPos(e)
      if (pos) {
        fogPaintingRef.current = true
        if (fogEditMode === 'rect' || fogEditMode === 'rect-erase') {
          // Defer the state mutation to mouseup - during the drag
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
    // Throw-to-cell - click a valid cell to drop the grenade there.
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
            // Friendly-fire confirm - for Blast Radius weapons, scan
            // the 100ft far-band for any token whose character_id is
            // in the friendlyCharacterIds list. If we find any, prompt
            // the player by name + band before firing the throw.
            // Cancel keeps throwMode active so they can pick again
            // without re-clicking the Attack button.
            // Friendly-fire scan now includes the attacker themselves
            // (the splash code no longer carves out the thrower per
            // CRB p.71-72 - they take damage if they're in radius).
            // Self-hits get a (YOU) tag in the confirm dialog so the
            // player knows what they're doing before they cook off a
            // grenade at their own feet.
            // Faction-symmetric friendly-fire scan (SMOKE-3). A PC thrower's
            // friendlies are PC tokens (friendlyCharacterIds); an NPC
            // thrower's friendlies are NPC tokens (friendlyNpcIds). The page
            // only populates the list matching the thrower's faction, so the
            // opposing faction never matches here - hitting an enemy with a
            // grenade is intended, not friendly fire.
            const friendlies = throwMode.friendlyCharacterIds ?? []
            const friendlyNpcs = throwMode.friendlyNpcIds ?? []
            const attackerCharId = throwMode.attackerCharId
            const attackerNpcId = throwMode.attackerNpcId
            if (throwMode.hasBlast && (friendlies.length > 0 || friendlyNpcs.length > 0 || attackerCharId || attackerNpcId)) {
              // Per playtest 2026-04-27: blast only damages Engaged and
              // Close. Anything beyond 30ft takes no damage, so don't
              // warn the player about it.
              const engagedCells = Math.max(1, Math.round(5 / ft))
              const closeCells = Math.max(1, Math.round(30 / ft))
              const hits: { name: string; band: string; isSelf: boolean }[] = []
              for (const tok of tokens) {
                const isSelf =
                  (!!attackerCharId && tok.character_id === attackerCharId) ||
                  (!!attackerNpcId && tok.npc_id === attackerNpcId)
                const isFriendly =
                  (!!tok.character_id && friendlies.includes(tok.character_id)) ||
                  (!!tok.npc_id && friendlyNpcs.includes(tok.npc_id))
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
      // Out-of-range click - cancel so the player can retry or back out.
      onThrowCancel?.()
      return
    }
    // Move mode - click a valid cell to move the token there
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
          // Open doors are passable - exclude them from the occupied
          // set. Closed doors stay in `occupied` and additionally
          // get a clearer reject below so we can surface "the door is
          // closed" feedback rather than a silent no-op.
          const occupied = new Set(
            tokens
              .filter(t => t.id !== moveTok.id)
              // Open doors pass through. Windows ALWAYS block movement
              // (glass is always there - toggle only affects vision via
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
            const dxMove = pos.gx - moveTok.grid_x
            const dyMove = pos.gy - moveTok.grid_y
            tokenAnimRef.current.set(moveTok.id, { fromX, fromY, toX, toY, t: 0 })
            setTokens(prev => prev.map(t => t.id === moveTok.id ? { ...t, grid_x: pos.gx, grid_y: pos.gy } : t))
            updateToken(moveTok.id, { grid_x: pos.gx, grid_y: pos.gy }).then(() => {
              tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_moved', payload: {} })
              onMoveComplete?.()
            })
            // Carry passengers when an object-type vehicle token moves
            // via the popout MOVE button. Helper short-circuits for
            // non-vehicle tokens, so this is safe for any moveTok.
            syncVehiclePassengers(moveTok, moveTok.id, dxMove, dyMove)
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
    // Bumped above the token-click branch per Xero - the previous
    // "empty-cell only" gate meant you couldn't ping a specific NPC's
    // location, which is the most common case.
    if (pos && e.altKey) {
      const color = isGM ? '#EF9F27' : '#7fc458'
      setPing({ gx: pos.gx, gy: pos.gy, t: 0, color, count: 3 })
      pingChannelRef.current?.send({ type: 'broadcast', event: 'gm_ping', payload: { gx: pos.gx, gy: pos.gy, color } })
      return
    }
    if (pos) {
      const tok = getTokenAt(pos.gx, pos.gy)
      if (tok) {
        // Door / window click intercept. Players (no drag permission
        // on this token) toggle immediately. GMs fall through to the
        // normal select+drag flow - handleMouseUp checks "drag with
        // no move" on a door/window and toggles in that case, so the
        // GM has move + click-to-toggle on one button.
        if (tok.is_door || tok.is_window) {
          const isController = !!myCharacterId
            && Array.isArray(tok.controlled_by_character_ids)
            && tok.controlled_by_character_ids.includes(myCharacterId)
          if (!isGM && !isController) {
            const nextOpen = !tok.door_open
            setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, door_open: nextOpen } : t))
            updateToken(tok.id, { door_open: nextOpen }).then(() => {
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
        //     their token is locked until their next turn - playtest #10.
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
          const mx = (e.clientX - rect.left) / getScale()
          const my = (e.clientY - rect.top) / getScale()
          const cellSize = getCellSize()
          const tokCx = tok.grid_x * cellSize + cellSize / 2
          const tokCy = tok.grid_y * cellSize + cellSize / 2
          setDragging({ tokenId: tok.id, offsetX: tokCx - mx, offsetY: tokCy - my })
          dragPosRef.current = { px: tokCx, py: tokCy }
        }
        return
      }
    }
    // (The map-image corner resize handles were removed 2026-05-27: the bg is
    // now locked to the grid, so there is no independent image scale to drag.)
    // No token clicked - start panning (unless locked)
    setSelectedToken(null)
    onTokenSelect?.(null)
    trace('TacticalMap-mousedown-pan', {
      mapLocked,
      willStartPan: !mapLocked,
      button: e.button,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      spaceHeld,
      fogEditMode,
    })
    if (!mapLocked) {
      startPan(e.clientX, e.clientY)
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    // Wall draw preview - when a wallDrawStart exists, the moving
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
      // Don't return - fall through is fine, but no other handler
      // should fire while in segment mode.
      return
    }
    // Fog drag - extend the paint/erase from mousedown along the
    // cursor path. We touch each unique cell at most once per drag
    // so re-entering a cell mid-drag doesn't undo the operation.
    // Rect mode just updates the preview end cell; commit happens
    // on mouseup.
    if (fogEditMode && fogPaintingRef.current && isGM) {
      // Wall-rect drag: walls live on grid coordinates (not cells), so
      // we use getSegmentEndpoint (honors SHIFT-snap) instead of the
      // cell-based fog rect tracking.
      if (fogEditMode === 'wall-rect') {
        const raw = getSegmentEndpoint(e)
        if (raw && (!wallRectEnd || wallRectEnd.x !== raw.x || wallRectEnd.y !== raw.y)) {
          setWallRectEnd(raw)
        }
        return
      }
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
      const mx = (e.clientX - rect.left) / getScale()
      const my = (e.clientY - rect.top) / getScale()
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
      // Wall-rect commit - 4 wall segments forming a closed rectangle.
      if (fogEditMode === 'wall-rect' && wallRectStart && wallRectEnd) {
        const minX = Math.min(wallRectStart.x, wallRectEnd.x)
        const maxX = Math.max(wallRectStart.x, wallRectEnd.x)
        const minY = Math.min(wallRectStart.y, wallRectEnd.y)
        const maxY = Math.max(wallRectStart.y, wallRectEnd.y)
        // Reject zero-area drags (just-a-click with no movement).
        if (maxX - minX < 0.05 || maxY - minY < 0.05) {
          setWallRectStart(null)
          setWallRectEnd(null)
          return
        }
        const newSegs: WallSegment[] = [
          { id: crypto.randomUUID(), x1: minX, y1: minY, x2: maxX, y2: minY, kind: 'wall' },
          { id: crypto.randomUUID(), x1: maxX, y1: minY, x2: maxX, y2: maxY, kind: 'wall' },
          { id: crypto.randomUUID(), x1: maxX, y1: maxY, x2: minX, y2: maxY, kind: 'wall' },
          { id: crypto.randomUUID(), x1: minX, y1: maxY, x2: minX, y2: minY, kind: 'wall' },
        ]
        setWallsLocal(prev => {
          const next = [...prev, ...newSegs]
          wallsLocalRef.current = next
          return next
        })
        scheduleWallsPersist()
        setWallRectStart(null)
        setWallRectEnd(null)
        return
      }
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
    // Multi-cell-token click-snap fix (2026-05-15): a click landing
    // anywhere inside the token's existing footprint is a click, not
    // a move. The old check compared `pos.gx !== tok.grid_x`, which
    // treats the top-left cell as "stayed put" and every other
    // footprint cell as "moved" - so clicking Minnie's center cell
    // snapped her top-left to where the cursor landed. Footprint-
    // overlap test fixes both axes for any grid_w/grid_h. 1-cell
    // tokens are unchanged (the footprint collapses to one cell).
    const w = tok?.grid_w ?? 1
    const h = tok?.grid_h ?? 1
    const inFootprint = !!(pos && tok
      && pos.gx >= tok.grid_x && pos.gx < tok.grid_x + w
      && pos.gy >= tok.grid_y && pos.gy < tok.grid_y + h)
    // Visual-scale extension (2026-05-15 followup): tokens with
    // scale > 1 render a circle of 0.4 * scale cells radius even
    // when grid_w/grid_h stay at 1. getTokenAt's second pass picks
    // them up by that circle, so a click on Minnie's portrait edge
    // returned the token but landed outside her 1-cell footprint -
    // mouseup then read "moved" and snapped her anchor to the
    // clicked cell. Mirror the same circular hit-test here so a
    // click anywhere on the rendered token is treated as a click,
    // not a move. Falls back to footprint-only when scale <= 1.
    let inVisualCircle = false
    if (!inFootprint && pos && tok && (tok.scale ?? 1) > 1) {
      const cx = tok.grid_x + w / 2
      const cy = tok.grid_y + h / 2
      const dx = (pos.gx + 0.5) - cx
      const dy = (pos.gy + 0.5) - cy
      inVisualCircle = Math.hypot(dx, dy) <= 0.4 * (tok.scale ?? 1)
    }
    const stayedInsideOldFootprint = inFootprint || inVisualCircle
    const moved = pos && tok && !stayedInsideOldFootprint
    // GM "drag" with zero movement on a door OR window = a click →
    // toggle. Drag with actual movement falls through to the normal
    // reposition path.
    if (tok && (tok.is_door || tok.is_window) && !moved) {
      const nextOpen = !tok.door_open
      setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, door_open: nextOpen } : t))
      updateToken(tok.id, { door_open: nextOpen }).then(() => {
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
    // bypass this entirely - they can reposition any token anywhere.
    // Out-of-combat (no initiative entry) also bypasses.
    const isPlayerDrag = !isGM && tok && myCharacterId && tok.character_id === myCharacterId
    const ownInit = isPlayerDrag && tok ? initiativeOrder.find((ie: any) => ie.character_id === tok.character_id) : null
    const inCombat = !!ownInit
    const cellFt = sceneRef.current?.cell_feet ?? 3
    const maxMoveCells = Math.max(1, Math.ceil(10 / cellFt))
    const dragDistCells = pos && tok ? Math.max(Math.abs(pos.gx - tok.grid_x), Math.abs(pos.gy - tok.grid_y)) : 0
    const outOfRange = isPlayerDrag && inCombat && moved && dragDistCells > maxMoveCells
    if (outOfRange) {
      alert(`Can't move that far - max ${maxMoveCells} cell${maxMoveCells === 1 ? '' : 's'} (${cellFt * maxMoveCells}ft) per Move action.`)
    }
    // Snap the token's anchor (top-left) cell from dragPosRef rather than
    // pos.gx/gy. dragPosRef tracks where the anchor center actually is,
    // honoring dragging.offsetX/offsetY - so grabbing Minnie by her center
    // cell keeps her top-left offset on release. Using pos.gx/gy directly
    // (the cursor's cell) would snap the anchor to the cursor and Minnie
    // would jump +N cells beyond where the drag ended.
    const cellSize = getCellSize()
    const gCols = sceneRef.current?.grid_cols ?? 30
    const gRows = sceneRef.current?.grid_rows ?? 30
    const tokW = tok?.grid_w ?? 1
    const tokH = tok?.grid_h ?? 1
    const rawGx = dragPosRef.current ? Math.round((dragPosRef.current.px - cellSize / 2) / cellSize) : pos!.gx
    const rawGy = dragPosRef.current ? Math.round((dragPosRef.current.py - cellSize / 2) / cellSize) : pos!.gy
    const newGx = Math.max(0, Math.min(gCols - tokW, rawGx))
    const newGy = Math.max(0, Math.min(gRows - tokH, rawGy))
    if (moved && dragPosRef.current && !outOfRange) {
      const toX = newGx * cellPx + cellPx / 2
      const toY = newGy * cellPx + cellPx / 2
      tokenAnimRef.current.set(tokenId, { fromX: dragPosRef.current.px, fromY: dragPosRef.current.py, toX, toY, t: 0 })
    }
    // Clear drag state synchronously - never block cursor release on DB I/O
    dragPosRef.current = null
    if (dragRAFRef.current != null) {
      cancelAnimationFrame(dragRAFRef.current)
      dragRAFRef.current = null
    }
    setDragging(null)
    if (moved && !outOfRange) {
      const dx = newGx - tok!.grid_x
      const dy = newGy - tok!.grid_y
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, grid_x: newGx, grid_y: newGy } : t))
      updateToken(tokenId, { grid_x: newGx, grid_y: newGy }).then(({ error }: any) => {
        if (error) console.error('[TacticalMap] token move failed:', error)
        else tacticalChannelRef.current?.send({ type: 'broadcast', event: 'token_moved', payload: {} })
      })
      // Vehicle passenger sync - drag path. Helper handles the
      // object-token + non-zero (dx,dy) gate internally; safe to call
      // for any token. Same helper is invoked from the MOVE-button
      // moveMode commit so both gestures carry passengers.
      if (tok) syncVehiclePassengers(tok, tokenId, dx, dy)
      // Player drag in combat costs 1 action. Parent handles the DB write
      // via consumeAction (no log entry - drag movement is self-evident from
      // the token animation on the map).
      if (isPlayerDrag && inCombat && tok && tok.character_id) {
        onPlayerDragMove?.(tok.character_id)
      }
      // GM drag of the active combatant's token - same 1-action cost as
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
    // Bare double-click on empty cell does nothing - ping moved to
    // Alt+left-click on mousedown (single click). Removed Alt+double-
    // click duplicate path 2026-04-29.
  }

  // Scene management
  async function createScene(nameOverride?: string) {
    // One create at a time. The popout "+ New Map" button gives no in-flight
    // feedback in its own window, so it could be mashed - which once spawned
    // 4 blank "New Map" scenes in ~1s and stole the active scene (playtest
    // 2026-05-24). The ref drops re-entrant calls while a create is running.
    if (creatingSceneRef.current) return
    creatingSceneRef.current = true
    try {
      const { data, error } = await insertScene({
        campaign_id: campaignId, name: nameOverride ?? setupName, grid_cols: setupCols, grid_rows: setupRows, cell_feet: 3, cell_px: 35, is_active: true, has_grid: setupHasGrid,
      }).select().single()
      if (error) { console.error('[TacticalMap] createScene error:', error.message); alert('Failed to create scene: ' + error.message); return }
      if (data) {
        // Deactivate other scenes
        await deactivateOtherScenes(campaignId, data.id)
        setScene(data as unknown as Scene)
        setShowSetup(false)
        await loadScenes()
      }
    } finally {
      creatingSceneRef.current = false
    }
  }

  async function activateScene(sceneId: string) {
    await deactivateAllScenes(campaignId)
    await updateScene(sceneId, { is_active: true })
    await loadScenes()
    // Force-push the scene switch to every connected client. Even if the
    // postgres_changes UPDATE on tactical_scenes is delivered, the
    // broadcast is a guaranteed nudge - particularly important so
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
    await deleteTokensForScene(scene.id)
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
      await insertTokens(newTokens)
    }
    await loadTokens(scene.id)
  }

  // Fit-to-Map and Fit-to-Screen are extracted as named functions so
  // both the inline panel onClick AND the popped-out controls (via
  // BroadcastChannel) can trigger them. They depend on bgImageRef +
  // containerRef which only exist in this component, so the popout
  // can't run them itself - it sends a 'fit_to_map' / 'fit_to_screen'
  // command and we run it here.
  async function fitToMap() {
    // Exact snap to cover the map at the current cell size (can also shrink).
    const img = bgImageRef.current
    if (!img || !scene) return
    const { cols, rows } = gridToCoverMap(img.naturalWidth, img.naturalHeight, 1, cellPx)
    if (!cols) return
    setScene(p => p ? { ...p, grid_cols: cols, grid_rows: rows } : p)
    await updateScene(scene.id, { grid_cols: cols, grid_rows: rows })
  }

  function fitToScreen() {
    // "See the whole map": set the LOCAL zoom so the entire composite fits this
    // viewer's panel in BOTH dimensions, then center it. Never changes other viewers.
    const container = containerRef.current
    const s = sceneRef.current
    if (!container || !s) { setZoom(1); return }
    const gridW = s.grid_cols * getCellSize()
    const gridH = s.grid_rows * getCellSize()
    if (gridW <= 0 || gridH <= 0) { setZoom(1); return }
    const fit = fitWholeMapZoom(container.clientWidth, container.clientHeight, gridW, gridH)
    setZoom(fit)
    centerViewport(fit)
  }

  // Scene-controls bus - keeps the popped-out controls window in sync.
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
    new_scene: () => {},
  })
  sceneControlsHandlersRef.current = {
    fit_to_map: () => { fitToMap() },
    fit_to_screen: () => { fitToScreen() },
    place_tokens: () => { autoPopulateTokens() },
    // Popout "NEW MAP": create + activate a fresh blank scene; the GM then
    // names it (SCENE NAME) + uploads art (UPLOAD MAP) in the popout. Default
    // name so no cross-window modal is needed.
    new_scene: () => { void createScene('New Map') },
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

  // Outbound state broadcasts - fire when local state changes due to a
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
    await updateToken(tokenId, { is_visible: !tok.is_visible })
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, is_visible: !t.is_visible } : t))
    // Notify parent so it can broadcast token_changed - previously players had
    // to hard-refresh to see a Reveal. postgres_changes on scene_tokens may
    // not fire reliably for all clients (replication/RLS quirks); the
    // broadcast path is the reliable fallback.
    onTokenChanged?.()
  }

  async function removeToken(tokenId: string) {
    await deleteToken(tokenId)
    setTokens(prev => prev.filter(t => t.id !== tokenId))
  }

  // No scene - show setup (z-index above NPC cards overlay)
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
                  style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowSetup(false)}
                  style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => createScene()}
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
          strip. Moved to a separate browser window - opened via the
          "Map Setup" header button on the table page (table/page.tsx).
          State syncs over BroadcastChannel; see lib/scene-controls-bus.ts
          and the bus handlers earlier in this file. The map canvas now
          gets the full table-page width. */}

      {/* Map canvas area - scrollable when zoomed */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Zoom control + Share View - top right. Share View is the
            tactical-map sibling of the CampaignMap "👁 Share View"
            button (added 2026-05-11). GM-only one-shot push of the
            current scroll position + zoom to all players (the map scale
            is shared via grid dims, so only the viewport is pushed).
            Players' container smooth-scrolls to match. Flash green
            for ~1.5s after click as confirmation. Not a continuous
            follow - deliberate, GM-driven. */}
        <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Locked-map escape hatch - players can't pan when the GM locks the
              map, so give them a one-tap re-center so they're never stranded. */}
          {!isGM && mapLocked && (
            <button type="button" onClick={() => centerViewport()}
              title="Center the map on your token"
              style={{ padding: '3px 8px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Center
            </button>
          )}
          {isGM && (
            <button type="button"
              onClick={() => {
                const container = containerRef.current
                const channel = tacticalChannelRef.current
                if (!container || !channel) return
                channel.send({
                  type: 'broadcast',
                  event: 'tactical_view_share',
                  payload: {
                    scrollLeft: container.scrollLeft,
                    scrollTop: container.scrollTop,
                    zoom,
                  },
                })
                setTacticalShareFlash(true)
                window.setTimeout(() => setTacticalShareFlash(false), 1500)
              }}
              title="Push your current map view (scroll + zoom) to every player"
              style={{ padding: '3px 8px', background: tacticalShareFlash ? '#1a2e10' : 'rgba(15,15,15,.85)', border: `1px solid ${tacticalShareFlash ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: tacticalShareFlash ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {tacticalShareFlash ? '✓ Shared' : '👁 Share View'}
            </button>
          )}
          {/* Personal zoom slider - LOCAL only (never broadcast). 100% = fill
              the panel width (the baseline); drag up to zoom in, down to zoom
              out. The live % readout doubles as the right label. */}
          <div style={{ background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px' }} title="Zoom (only your view; 100% = fit the panel width)">
            <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>25%</span>
            <input type="range" min={25} max={300} step={5} value={Math.round(zoom * 100)}
              onChange={e => setZoom(Number(e.target.value) / 100)}
              style={{ width: '70px', accentColor: '#7ab3d4', cursor: 'pointer' }} />
            <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', minWidth: '34px', textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* GM Fog editor - top left by default; draggable via the ⠿
            handle on the left edge. Compact when collapsed (just the
            toggle button); expands into paint/erase + bulk controls
            when in edit mode. Hidden entirely from players. */}
        {isGM && scene && (
          <div ref={setFogBarRef} style={{ position: 'absolute', top: `${fogBarPos.y}px`, left: `${fogBarPos.x}px`, zIndex: 10, background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', width: '208px' }}>
            {/* Header row (full width): drag handle ⠿ + reset ↺. The bar is a
                2-column grid; single-item rows span both columns. */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div onMouseDown={startFogBarDrag}
                title="Drag to reposition the fog/lighting toolbar"
                style={{ cursor: 'move', color: '#5a5550', fontSize: '14px', lineHeight: 1, userSelect: 'none', padding: '0 4px' }}>⠿</div>
              {fogBarMoved && (
                <button onClick={resetFogBarPos}
                  title="Reset toolbar to default position (top-center)"
                  style={{ background: 'none', border: 'none', color: '#5a5550', fontSize: '13px', lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>↺</button>
              )}
            </div>
            {/* Day / Night toggle - outdoor scenes default 'day' (PCs
                see for miles, only walls block). Indoor/dark scenes
                flip to 'night' (per-token sight_radius governs;
                auto-fog kicks in beyond). Persists on
                tactical_scenes.lighting_mode so all viewers update. */}
            {(() => {
              const isDay = (scene.lighting_mode ?? 'day') === 'day'
              return (
                <button onClick={async () => {
                  const next = isDay ? 'night' : 'day'
                  await updateScene(scene.id, { lighting_mode: next })
                  setScene(p => p ? { ...p, lighting_mode: next } : p)
                }}
                  title={isDay ? 'Day - sight unbounded, only walls block. Click to switch to Night.' : 'Night - per-token sight radius governs, auto-fog beyond. Click to switch to Day.'}
                  style={{ padding: '4px 10px', background: isDay ? '#2a2010' : '#0f1a2e', border: `1px solid ${isDay ? '#EF9F27' : '#7ab3d4'}`, borderRadius: '3px', color: isDay ? '#EF9F27' : '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  {isDay ? '🌞 Day' : '🌙 Night'}
                </button>
              )
            })()}
            {/* Edit Fog: persistent toggle (row 1, col 2). Open -> reveals the
                tool grid below; click again (or Done) to collapse. */}
            <button onClick={() => setFogEditMode(fogEditMode ? null : 'paint')}
              title={fogEditMode ? 'Close the fog + structure tools' : 'Open the fog + structure tools'}
              style={{ padding: '4px 10px', background: fogEditMode ? '#2a1a3e' : '#1a1a1a', border: `1px solid ${fogEditMode ? '#c4a7f0' : '#5a2e5a'}`, borderRadius: '3px', color: '#c4a7f0', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
              🌫️ Fog
            </button>
            {fogEditMode && (
              <>
                <button onClick={() => setFogEditMode('paint')}
                  title="Drag to fog cells one at a time"
                  style={{ padding: '4px 10px', background: fogEditMode === 'paint' ? '#2a1a3e' : '#1a1a1a', border: `1px solid ${fogEditMode === 'paint' ? '#c4a7f0' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'paint' ? '#c4a7f0' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  Paint
                </button>
                <button onClick={() => setFogEditMode('erase')}
                  title="Drag to clear fog cells one at a time"
                  style={{ padding: '4px 10px', background: fogEditMode === 'erase' ? '#2a1a3e' : '#1a1a1a', border: `1px solid ${fogEditMode === 'erase' ? '#c4a7f0' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'erase' ? '#c4a7f0' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  Erase
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
                <button onClick={() => setFogEditMode('select')}
                  title="Click a wall/door/window to select it. Action panel below shows delete + open/close + convert."
                  style={{ gridColumn: '1 / -1', padding: '4px 10px', background: fogEditMode === 'select' ? '#1f1f2e' : '#1a1a1a', border: `1px solid ${fogEditMode === 'select' ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'select' ? '#7ab3d4' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  ↖ Select
                </button>
                <button onClick={() => { setFogEditMode('wall'); setWallDrawStart(null) }}
                  title="Draw walls - click intersection-to-intersection. Right-click a segment to delete."
                  style={{ padding: '4px 10px', background: fogEditMode === 'wall' ? '#2a2010' : '#1a1a1a', border: `1px solid ${fogEditMode === 'wall' ? '#a08e75' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'wall' ? '#a08e75' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  🧱 Wall
                </button>
                <button onClick={() => { setFogEditMode('wall-rect'); setWallDrawStart(null); setWallRectStart(null); setWallRectEnd(null) }}
                  title="Drag to draw a rectangular room - commits 4 wall segments at once. SHIFT to snap corners to grid."
                  style={{ padding: '4px 10px', background: fogEditMode === 'wall-rect' ? '#2a2010' : '#1a1a1a', border: `1px solid ${fogEditMode === 'wall-rect' ? '#a08e75' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'wall-rect' ? '#a08e75' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  ⬛ Wall Rect
                </button>
                <button onClick={() => { setFogEditMode('door'); setWallDrawStart(null) }}
                  title="Draw doors. Players click them mid-game to open/close."
                  style={{ padding: '4px 10px', background: fogEditMode === 'door' ? '#1a2e10' : '#1a1a1a', border: `1px solid ${fogEditMode === 'door' ? '#7fc458' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'door' ? '#7fc458' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  🚪 Door
                </button>
                <button onClick={() => { setFogEditMode('window'); setWallDrawStart(null) }}
                  title="Draw windows - block movement, vision passes through."
                  style={{ padding: '4px 10px', background: fogEditMode === 'window' ? '#0f1a2e' : '#1a1a1a', border: `1px solid ${fogEditMode === 'window' ? '#7ab3d4' : '#3a3a3a'}`, borderRadius: '3px', color: fogEditMode === 'window' ? '#7ab3d4' : '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  🪟 Window
                </button>
                <button onClick={() => {
                    if (!scene) return
                    const all: Record<string, boolean> = {}
                    for (let x = 0; x < scene.grid_cols; x++) {
                      for (let y = 0; y < scene.grid_rows; y++) all[`${x},${y}`] = true
                    }
                    setFogLocal(all); fogLocalRef.current = all; scheduleFogPersist()
                  }}
                  title="Fog the whole scene"
                  style={{ gridColumn: '1 / -1', padding: '4px 10px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Fog All
                </button>
                <button onClick={() => {
                    setFogLocal({}); fogLocalRef.current = {}; scheduleFogPersist()
                  }}
                  title="Clear all fog"
                  style={{ gridColumn: '1 / -1', padding: '4px 10px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Clear All
                </button>
                {(fogEditMode === 'wall' || fogEditMode === 'door' || fogEditMode === 'window') && (
                  <>
                    <span title="Right-click any segment to delete it"
                      style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4px 8px', background: 'transparent', border: '1px dashed #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      ⌫ Right-click to delete
                    </span>
                    <button onClick={() => {
                        if (!confirm('Clear EVERY wall, door, and window from this scene?')) return
                        setWallsLocal([])
                        wallsLocalRef.current = []
                        scheduleWallsPersist()
                      }}
                      title="Wipe all wall/door/window segments on this scene"
                      style={{ gridColumn: '1 / -1', padding: '4px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Clear Walls
                    </button>
                  </>
                )}
                <button onClick={() => setFogEditMode(null)}
                  title="Exit fog editing - players see fog as-painted"
                  style={{ gridColumn: '1 / -1', padding: '4px 10px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                  Done
                </button>
              </>
            )}
          </div>
        )}
        {/* Selection action panel - appears below the fog toolbar
            when Select mode is active AND a segment is selected.
            Tracks the toolbar's drag position so the two move
            together. Exposes the per-segment ops the right-click
            delete + alt-right-click toggle gestures already cover,
            but as visible buttons so the GM doesn't have to remember
            modifier keys. */}
        {isGM && fogEditMode === 'select' && selectedSegmentId && (() => {
          const seg = wallsLocal.find(w => w.id === selectedSegmentId)
          if (!seg) return null
          const kindLabel = seg.kind === 'wall' ? '🧱 Wall'
            : seg.kind === 'door' ? '🚪 Door'
            : '🪟 Window'
          // Per-kind default for door_open: doors default closed, windows default open
          const kindDefault = seg.kind === 'door' ? false : true
          const isOpen = seg.door_open ?? kindDefault
          const stateLabel = seg.kind === 'wall' ? null : (isOpen ? 'open' : 'closed')
          return (
            <div style={{ position: 'absolute', top: `${fogBarPos.y + 72}px`, left: `${fogBarPos.x}px`, zIndex: 10, background: 'rgba(15,15,15,.95)', border: '1px solid #7ab3d4', borderRadius: '3px', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <span style={{ fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Selected: {kindLabel}{stateLabel ? ` (${stateLabel})` : ''}
              </span>
              <span style={{ width: '1px', height: '18px', background: '#3a3a3a' }} />
              {seg.kind !== 'wall' && (
                <button onClick={() => {
                  setWallsLocal(prev => {
                    const next = prev.map(w => w.id === seg.id
                      ? { ...w, door_open: !(w.door_open ?? (w.kind === 'window' ? true : false)) }
                      : w)
                    wallsLocalRef.current = next
                    return next
                  })
                  scheduleWallsPersist()
                }}
                  style={{ padding: '3px 8px', background: '#1a1a2e', border: '1px solid #2e2e5a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {isOpen ? 'Close' : 'Open'}
                </button>
              )}
              {/* Convert kind - wall ↔ door ↔ window cycle. Each click
                  steps to the next kind so the GM can fix a misplaced
                  segment without delete + redraw. */}
              <button onClick={() => {
                const nextKind: WallSegment['kind'] = seg.kind === 'wall' ? 'door' : seg.kind === 'door' ? 'window' : 'wall'
                setWallsLocal(prev => {
                  const next = prev.map(w => w.id === seg.id ? { ...w, kind: nextKind, door_open: nextKind === 'wall' ? undefined : w.door_open } : w)
                  wallsLocalRef.current = next
                  return next
                })
                scheduleWallsPersist()
              }}
                title="Cycle kind: wall → door → window → wall"
                style={{ padding: '3px 8px', background: '#1a1a1a', border: '1px solid #5a5550', borderRadius: '3px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                ↻ Convert
              </button>
              <button onClick={() => {
                setWallsLocal(prev => {
                  const next = prev.filter(w => w.id !== seg.id)
                  wallsLocalRef.current = next
                  return next
                })
                scheduleWallsPersist()
                setSelectedSegmentId(null)
              }}
                style={{ padding: '3px 8px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                ✕ Delete
              </button>
              <button onClick={() => setSelectedSegmentId(null)}
                title="Deselect"
                style={{ background: 'none', border: 'none', color: '#5a5550', fontSize: '14px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>
                ✕
              </button>
            </div>
          )
        })()}
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
            cursor: panning ? 'grabbing' : spaceHeld ? 'grab' : dragging ? 'grabbing' : 'default',
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

      {/* Selected token info - bottom left */}
      {selectedToken && (() => {
        const tok = tokens.find(t => t.id === selectedToken)
        if (!tok) return null
        // Players who are listed in this token's controlled_by_character_ids
        // (e.g. the driver of a vehicle) get the Rot slider here too -
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
            {/* WP bar - object tokens only. Falls back to the matching
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
            {/* Action buttons - split into two groups so the GM-only
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
                {/* Popout - opens the full vehicle sheet in a new window
                    for any vehicle token. Shown to everyone (not just
                    controllers) since the popout's own canEdit gate
                    decides who can mutate, and reading should be open. */}
                {tok.token_type === 'object' && (() => {
                  const veh = vehicles?.find(v => v.name === tok.name)
                  if (!veh?.id || !campaignId) return null
                  return (
                    <button onClick={() => {
                        const url = `/vehicle?campaign=${campaignId}&vehicle=${veh.id}`
                        window.open(url, `vehicle_${veh.id}`, 'width=560,height=900,scrollbars=yes,resizable=yes')
                      }}
                      title="Open the vehicle sheet in a popout window"
                      style={{ padding: '2px 6px', background: '#241a3a', border: '1px solid #6b4fb1', borderRadius: '2px', color: '#c4a7f0', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Popout
                    </button>
                  )
                })()}
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
                        title={`Toggle firing arc - ${w.arc_degrees}° at mount ${w.mount_angle}°`}
                        style={{ padding: '2px 6px', background: active ? '#2a1a3e' : '#1a1a2e', border: `1px solid ${active ? '#c4a7f0' : '#2e2e5a'}`, borderRadius: '2px', color: active ? '#c4a7f0' : '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                        🎯 {w.name}
                      </button>
                    )
                  })
                })()}
                {/* Multistory Path B - shunt this token to another
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
                        await updateToken(tok.id, { scene_id: s.id, grid_x: 1, grid_y: 1 })
                        setMovingTokenToScene(null)
                        setSelectedToken(null)
                        // Local mirror - strip from current scene
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
                      await updateToken(tok.id, { scale: v })
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
                      await updateToken(tok.id, { rotation: v })
                    }}
                    style={{ flex: 1, accentColor: '#EF9F27', cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', width: '28px', textAlign: 'right' }}>{(tok.rotation ?? 0).toFixed(0)}°</span>
                </div>
                )}
                {/* Multi-cell footprint controls - objects only, GM only.
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
                        await updateToken(tok.id, { grid_w: v })
                      }}
                      style={{ width: '46px', padding: '2px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center' }} />
                    <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Carlito, sans-serif' }}>×</span>
                    <input type="number" min={1} max={20} step={1} value={tok.grid_h ?? 1}
                      title="Height in cells"
                      onChange={async e => {
                        const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                        setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, grid_h: v } : t))
                        await updateToken(tok.id, { grid_h: v })
                      }}
                      style={{ width: '46px', padding: '2px 4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textAlign: 'center' }} />
                  </div>
                )}
                {/* Sight radius - only meaningful for PC tokens that
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
                        await updateToken(tok.id, { sight_radius_cells: v })
                      }}
                      title={`Vision radius - ${tok.sight_radius_cells ?? 30} cells`}
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
                style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowSetup(false)}
                style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => createScene()}
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
// shallow comparison is sufficient - the parent passes data props
// by reference (initiativeOrder / entries / campaignNpcs / vehicles
// / mapTokens) and stabilized callbacks via useStableCallback. When
// any data ref changes (real combat update), props differ and the
// component renders normally.
export default memo(TacticalMap)
