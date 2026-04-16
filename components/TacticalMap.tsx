'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getWeaponByName } from '../lib/weapons'
import { getRangeBand, RANGE_BAND_COLOR } from '../lib/range-profiles'

const RANGE_BAND_FEET: Record<string, number> = {
  'Engaged': 5,
  'Close': 30,
  'Medium': 100,
  'Long': 300,
  'Distant': 600,
}

const RANGE_BAND_ORDER = ['Engaged', 'Close', 'Medium', 'Long', 'Distant']

function bestWeaponRange(names: string[]): string {
  let best = 'Engaged'
  let bestIdx = 0
  for (const name of names) {
    if (!name) continue
    const w = getWeaponByName(name)
    if (!w) continue
    const idx = RANGE_BAND_ORDER.indexOf(w.range)
    if (idx > bestIdx) { best = w.range; bestIdx = idx }
  }
  return best
}

interface Token {
  id: string
  scene_id: string
  name: string
  token_type: string
  character_id: string | null
  npc_id: string | null
  portrait_url: string | null
  grid_x: number
  grid_y: number
  is_visible: boolean
  color: string
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
  tokenRefreshKey?: number
  campaignNpcs?: any[]
  entries?: any[]
  moveMode?: { characterId?: string; npcId?: string; feet: number } | null
  onMoveComplete?: () => void
  onMoveCancel?: () => void
  onTokensUpdate?: (tokens: { id: string; character_id: string | null; npc_id: string | null; grid_x: number; grid_y: number }[], cellFeet: number) => void
}

export default function TacticalMap({ campaignId, isGM, initiativeOrder, onTokenClick, tokenRefreshKey, campaignNpcs, entries, moveMode, onMoveComplete, onMoveCancel, onTokensUpdate }: Props) {
  const supabase = createClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const [scene, setScene] = useState<Scene | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [dragging, setDragging] = useState<{ tokenId: string; offsetX: number; offsetY: number } | null>(null)
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [setupName, setSetupName] = useState('Scene')
  const [setupCols, setSetupCols] = useState(20)
  const [setupRows, setSetupRows] = useState(15)
  const [setupHasGrid, setSetupHasGrid] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [panning, setPanning] = useState<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)
  const [mapLocked, setMapLocked] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [imgScale, setImgScale] = useState(1)
  const [gridColor, setGridColor] = useState('white')
  const [ping, setPing] = useState<{ gx: number; gy: number; t: number } | null>(null)
  const pingChannelRef = useRef<any>(null)
  const [showRangeOverlay, setShowRangeOverlay] = useState(false)
  const [gridOpacity, setGridOpacity] = useState(0.4)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [cellPx, setCellPx] = useState(35)
  const [resizing, setResizing] = useState<{ corner: string; startX: number; startY: number; startZoom: number } | null>(null)
  const mapDrawRef = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 })
  const tokensRef = useRef<Token[]>([])
  const portraitCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const tokenAnimRef = useRef<Map<string, { fromX: number; fromY: number; toX: number; toY: number; t: number }>>(new Map())
  const animFrameRef = useRef<number>(0)
  const sceneRef = useRef<Scene | null>(null)

  // Keep refs in sync for canvas drawing
  useEffect(() => { tokensRef.current = tokens }, [tokens])
  useEffect(() => { sceneRef.current = scene }, [scene])

  // Load scenes
  async function loadScenes() {
    const { data } = await supabase.from('tactical_scenes').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    setScenes(data ?? [])
    const active = (data ?? []).find((s: Scene) => s.is_active)
    if (active) {
      setScene(active)
      loadTokens(active.id)
      // Apply saved visual settings
      if (active.cell_px) setCellPx(active.cell_px)
      if (active.img_scale) setImgScale(active.img_scale)
      setMapLocked(active.is_locked ?? false)
    }
  }

  async function loadTokens(sceneId: string) {
    const { data } = await supabase.from('scene_tokens').select('*').eq('scene_id', sceneId)
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
      .subscribe()
    const pingCh = supabase.channel(`ping_${campaignId}`)
      .on('broadcast', { event: 'gm_ping' }, (msg: any) => {
        const { gx, gy } = msg.payload ?? {}
        if (gx != null && gy != null) setPing({ gx, gy, t: 0 })
      })
      .subscribe()
    pingChannelRef.current = pingCh
    return () => { supabase.removeChannel(channel); supabase.removeChannel(pingCh) }
  }, [campaignId])

  // Load background image when scene changes
  useEffect(() => {
    if (!scene?.background_url) { bgImageRef.current = null; draw(); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { bgImageRef.current = img; draw() }
    img.src = scene.background_url
  }, [scene?.background_url])

  // Refresh tokens when parent signals a change
  useEffect(() => { if (sceneRef.current) loadTokens(sceneRef.current.id) }, [tokenRefreshKey])

  // Redraw on token/scene changes
  useEffect(() => { draw() }, [tokens, scene, selectedToken, zoom, panX, panY, showGrid, gridColor, gridOpacity, imgScale, cellPx, moveMode, campaignNpcs, entries, showRangeOverlay])

  // Notify parent of token positions for range calculations
  useEffect(() => {
    if (onTokensUpdate && scene) {
      onTokensUpdate(tokens.map(t => ({ id: t.id, character_id: t.character_id, npc_id: t.npc_id, grid_x: t.grid_x, grid_y: t.grid_y })), scene.cell_feet ?? 3)
    }
  }, [tokens, scene?.cell_feet])

  // Spacebar = pan mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) { e.preventDefault(); setSpaceHeld(true) }
      if (e.code === 'Escape' && onMoveCancel) { onMoveCancel() }
    }
    function onKeyUp(e: KeyboardEvent) { if (e.code === 'Space') { setSpaceHeld(false) } }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
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
    let imgW = 0, imgH = 0
    if (bgImageRef.current) {
      const img = bgImageRef.current
      const imgAspect = img.naturalWidth / img.naturalHeight
      // Always fit to container width — scroll vertically if needed
      imgW = baseW
      imgH = baseW / imgAspect
      imgW *= imgScale
      imgH *= imgScale
    }
    canvas.width = Math.max(baseW, baseW * zoom, imgW)
    canvas.height = Math.max(baseH, baseH * zoom, imgH)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cellSize = getCellSize()
    const gridW = s.grid_cols * cellSize
    const gridH = s.grid_rows * cellSize
    const offsetX = 0
    const offsetY = 0

    // Clear
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Apply zoom — scales everything: image, grid, tokens
    ctx.save()
    ctx.scale(zoom, zoom)

    // Background image — always fit to canvas width, scroll vertically if needed
    if (bgImageRef.current) {
      const img = bgImageRef.current
      const imgAspect = img.naturalWidth / img.naturalHeight
      const drawW = canvas.width
      const drawH = canvas.width / imgAspect
      const scaledW = drawW * imgScale
      const scaledH = drawH * imgScale
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
    ctx.font = `${Math.max(8, cellW * 0.3)}px Barlow Condensed`
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
        (moveMode.npcId && t.npc_id === moveMode.npcId)
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

    // Range overlay — color-coded bands from selected token
    if (showRangeOverlay && selectedToken) {
      const selTok = tokensRef.current.find(t => t.id === selectedToken)
      if (selTok) {
        const ft = s.cell_feet ?? 3
        for (let gx = 0; gx < s.grid_cols; gx++) {
          for (let gy = 0; gy < s.grid_rows; gy++) {
            if (gx === selTok.grid_x && gy === selTok.grid_y) continue
            const dist = Math.max(Math.abs(gx - selTok.grid_x), Math.abs(gy - selTok.grid_y))
            const feet = dist * ft
            const band = getRangeBand(feet)
            ctx.fillStyle = RANGE_BAND_COLOR[band]
            ctx.fillRect(offsetX + gx * cellSize, offsetY + gy * cellSize, cellSize, cellSize)
          }
        }
      }
    }

    // Tokens
    const toks = tokensRef.current
    const activeEntry = initiativeOrder.find((e: any) => e.is_active)

    let hasActiveAnim = false
    toks.forEach(t => {
      if (!t.is_visible && !isGM) return
      // Animated position — lerp toward target grid cell
      const targetPxX = offsetX + t.grid_x * cellSize + cellSize / 2
      const targetPxY = offsetY + t.grid_y * cellSize + cellSize / 2
      let cx = targetPxX
      let cy = targetPxY
      const anim = tokenAnimRef.current.get(t.id)
      if (anim) {
        anim.t = Math.min(1, anim.t + 0.08)
        const ease = 1 - Math.pow(1 - anim.t, 3) // ease-out cubic
        cx = anim.fromX + (anim.toX - anim.fromX) * ease
        cy = anim.fromY + (anim.toY - anim.fromY) * ease
        if (anim.t >= 1) tokenAnimRef.current.delete(t.id)
        else hasActiveAnim = true
      }
      const radius = cellSize * 0.4

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

      // Hidden indicator
      if (!t.is_visible && isGM) {
        ctx.globalAlpha = 0.5
      }

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
      }

      if (tokenDead) ctx.globalAlpha = 0.5

      // Token circle — portrait or solid color with initials
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      const portraitImg = t.portrait_url ? portraitCacheRef.current.get(t.portrait_url) : null
      if (portraitImg && portraitImg.complete && portraitImg.naturalWidth > 0) {
        // Clip to circle and draw portrait
        ctx.save()
        ctx.clip()
        ctx.drawImage(portraitImg, cx - radius, cy - radius, radius * 2, radius * 2)
        ctx.restore()
        // Border
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = isActive ? '#7fc458' : selectedToken === t.id ? '#f5f2ee' : t.color || '#c0392b'
        ctx.lineWidth = isActive || selectedToken === t.id ? 3 : 2
        ctx.stroke()
      } else {
        // Solid color circle with initials
        ctx.fillStyle = t.is_visible ? (t.color || '#c0392b') : 'rgba(192,57,43,0.3)'
        ctx.fill()
        ctx.strokeStyle = isActive ? '#7fc458' : selectedToken === t.id ? '#f5f2ee' : 'rgba(255,255,255,1)'
        ctx.lineWidth = isActive || selectedToken === t.id ? 3 : 1.5
        ctx.stroke()
        // Initials
        ctx.fillStyle = '#f5f2ee'
        ctx.font = `bold ${Math.max(10, radius * 0.8)}px Barlow Condensed`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        ctx.fillText(initials, cx, cy)
        // Load portrait for next draw
        if (t.portrait_url && !portraitCacheRef.current.has(t.portrait_url)) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => draw()
          img.src = t.portrait_url
          portraitCacheRef.current.set(t.portrait_url, img)
        }
      }

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // Mortal wound: red X over token
      if (tokenMortal || tokenDead) {
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

      // Name below — with dark background for legibility
      const fontSize = Math.max(14, cellSize * 0.34)
      ctx.font = `bold ${fontSize}px Barlow Condensed`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const nameText = t.name.split(' ')[0]
      const nameY = cy + radius + fontSize / 2 + 4
      const nameMetrics = ctx.measureText(nameText)
      const namePadX = 4
      const namePadY = 2
      const nameW = nameMetrics.width + namePadX * 2
      const nameH = fontSize + namePadY * 2
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillRect(Math.round(cx - nameW / 2), Math.round(nameY - nameH / 2), Math.round(nameW), Math.round(nameH))
      ctx.fillStyle = '#f5f2ee'
      ctx.fillText(nameText, cx, nameY)

      // WP bar beneath name
      let wpCur = 0, wpMax = 0
      if (t.npc_id && campaignNpcs) {
        const npc = campaignNpcs.find((n: any) => n.id === t.npc_id)
        if (npc) { wpCur = npc.wp_current ?? npc.wp_max ?? 10; wpMax = npc.wp_max ?? 10 }
      } else if (t.character_id && entries) {
        const entry = entries.find((e: any) => e.character.id === t.character_id)
        if (entry) { wpCur = entry.liveState.wp_current ?? entry.liveState.wp_max ?? 10; wpMax = entry.liveState.wp_max ?? 10 }
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
          ctx.font = `bold ${Math.max(8, badgeR * 1.2)}px Barlow Condensed`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(initIdx + 1), bx, by)
        }
      }

      ctx.globalAlpha = 1
    })

    // GM ping — pulsing ring that fades out
    if (ping) {
      const pingCx = offsetX + ping.gx * cellSize + cellSize / 2
      const pingCy = offsetY + ping.gy * cellSize + cellSize / 2
      const pingProgress = Math.min(1, ping.t)
      const pingRadius = cellSize * 0.5 + cellSize * 1.5 * pingProgress
      const pingAlpha = 1 - pingProgress
      ctx.beginPath()
      ctx.arc(pingCx, pingCy, pingRadius, 0, Math.PI * 2)
      ctx.strokeStyle = '#EF9F27'
      ctx.lineWidth = 3
      ctx.globalAlpha = pingAlpha
      ctx.stroke()
      // Inner solid dot
      if (pingProgress < 0.3) {
        ctx.beginPath()
        ctx.arc(pingCx, pingCy, cellSize * 0.2, 0, Math.PI * 2)
        ctx.fillStyle = '#EF9F27'
        ctx.globalAlpha = pingAlpha
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ping.t += 0.02
      if (ping.t >= 1) setPing(null)
      else hasActiveAnim = true
    }

    // Range circles for selected token: Engaged, Movement, Weapon Range
    if (selectedToken) {
      const selTok = toks.find(t => t.id === selectedToken)
      if (selTok) {
        const cx = offsetX + selTok.grid_x * cellSize + cellSize / 2
        const cy = offsetY + selTok.grid_y * cellSize + cellSize / 2
        const ft = s.cell_feet ?? 3

        // Look up weapon range for this token — use longest-range weapon available
        let weaponRangeBand = 'Engaged' // default unarmed
        if (selTok.npc_id && campaignNpcs) {
          const npc = campaignNpcs.find((n: any) => n.id === selTok.npc_id)
          const names: string[] = []
          if (npc?.skills?.weapon?.weaponName) names.push(npc.skills.weapon.weaponName)
          if (Array.isArray(npc?.equipment)) npc.equipment.forEach((eq: any) => { if (eq.name) names.push(eq.name) })
          if (names.length > 0) weaponRangeBand = bestWeaponRange(names)
        } else if (selTok.character_id && entries) {
          const entry = entries.find((e: any) => e.character.id === selTok.character_id)
          const names: string[] = []
          if (entry?.character.data?.weaponPrimary?.weaponName) names.push(entry.character.data.weaponPrimary.weaponName)
          if (entry?.character.data?.weaponSecondary?.weaponName) names.push(entry.character.data.weaponSecondary.weaponName)
          if (names.length > 0) weaponRangeBand = bestWeaponRange(names)
        }
        const weaponRangeFt = RANGE_BAND_FEET[weaponRangeBand] ?? 3
        const weaponCells = Math.max(1, Math.ceil(weaponRangeFt / ft))

        const circles = [
          { cells: weaponCells, fill: 'rgba(192,57,43,0.06)', stroke: '#c0392b', label: `${weaponRangeBand} (${weaponRangeFt}ft)` },
          { cells: 3, fill: 'rgba(52,152,219,0.08)', stroke: '#3498db', label: 'Move (9ft)' },
          { cells: Math.max(1, Math.ceil(3 / ft)), fill: 'rgba(127,196,88,0.15)', stroke: '#7fc458', label: 'Engaged' },
        ]
        // Draw largest first
        circles.sort((a, b) => b.cells - a.cells)
        circles.forEach(c => {
          ctx.beginPath()
          ctx.arc(cx, cy, c.cells * cellSize, 0, Math.PI * 2)
          ctx.fillStyle = c.fill
          ctx.fill()
          ctx.strokeStyle = c.stroke
          ctx.globalAlpha = 0.5
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.globalAlpha = 1
          // Label at top of circle
          ctx.font = `bold 12px Barlow Condensed`
          ctx.fillStyle = c.stroke
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(c.label, cx, cy - c.cells * cellSize + 12)
        })
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
    return tokens.find(t => t.grid_x === gx && t.grid_y === gy && (t.is_visible || isGM))
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Move mode — click a valid cell to move the token there
    if (moveMode) {
      const pos = getGridPos(e)
      if (pos && scene) {
        const ft = scene.cell_feet ?? 3
        const moveCells = Math.floor(moveMode.feet / ft)
        const moveTok = tokens.find(t =>
          (moveMode.characterId && t.character_id === moveMode.characterId) ||
          (moveMode.npcId && t.npc_id === moveMode.npcId)
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
      setPanning({ startX: e.clientX, startY: e.clientY, startPanX: containerRef.current?.scrollLeft ?? 0, startPanY: containerRef.current?.scrollTop ?? 0 })
      return
    }
    const pos = getGridPos(e)
    if (pos) {
      const tok = getTokenAt(pos.gx, pos.gy)
      if (tok) {
        setSelectedToken(tok.id)
        if (isGM) {
          setDragging({ tokenId: tok.id, offsetX: 0, offsetY: 0 })
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
    if (!mapLocked) {
      setPanning({ startX: e.clientX, startY: e.clientY, startPanX: containerRef.current?.scrollLeft ?? 0, startPanY: containerRef.current?.scrollTop ?? 0 })
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (resizing) {
      const delta = e.clientX - resizing.startX
      const scaleDelta = delta / 300
      setImgScale(Math.max(0.1, Math.min(5, resizing.startZoom + scaleDelta)))
      return
    }
    if (panning && containerRef.current) {
      const dx = e.clientX - panning.startX
      const dy = e.clientY - panning.startY
      containerRef.current.scrollLeft = panning.startPanX - dx
      containerRef.current.scrollTop = panning.startPanY - dy
    }
  }

  async function handleMouseUp(e: React.MouseEvent) {
    if (resizing) {
      setResizing(null)
      return
    }
    if (panning) {
      setPanning(null)
      return
    }
    if (!dragging) return
    const pos = getGridPos(e)
    if (pos) {
      // Start animation from current position to new position
      const tok = tokens.find(t => t.id === dragging.tokenId)
      if (tok) {
        const fromX = tok.grid_x * cellPx + cellPx / 2
        const fromY = tok.grid_y * cellPx + cellPx / 2
        const toX = pos.gx * cellPx + cellPx / 2
        const toY = pos.gy * cellPx + cellPx / 2
        tokenAnimRef.current.set(dragging.tokenId, { fromX, fromY, toX, toY, t: 0 })
      }
      await supabase.from('scene_tokens').update({ grid_x: pos.gx, grid_y: pos.gy }).eq('id', dragging.tokenId)
      setTokens(prev => prev.map(t => t.id === dragging.tokenId ? { ...t, grid_x: pos.gx, grid_y: pos.gy } : t))
    }
    setDragging(null)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    const pos = getGridPos(e)
    if (!pos) return
    const tok = getTokenAt(pos.gx, pos.gy)
    if (tok && onTokenClick) { onTokenClick(tok); return }
    // GM double-click on empty cell = ping
    if (isGM && !tok) {
      setPing({ gx: pos.gx, gy: pos.gy, t: 0 })
      pingChannelRef.current?.send({ type: 'broadcast', event: 'gm_ping', payload: { gx: pos.gx, gy: pos.gy } })
    }
  }

  // Scene management
  async function createScene() {
    const { data, error } = await supabase.from('tactical_scenes').insert({
      campaign_id: campaignId, name: setupName, grid_cols: setupCols, grid_rows: setupRows, cell_feet: 3, is_active: true, has_grid: setupHasGrid,
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
  }

  async function uploadBackground(file: File) {
    if (!scene) return
    setUploading(true)
    const path = `${campaignId}/${scene.id}/${file.name}`
    const { error: uploadErr } = await supabase.storage.from('tactical-maps').upload(path, file, { upsert: true })
    if (uploadErr) { console.error('[TacticalMap] upload error:', uploadErr.message); alert('Upload failed: ' + uploadErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('tactical-maps').getPublicUrl(path)
    const { error: updateErr } = await supabase.from('tactical_scenes').update({ background_url: urlData.publicUrl }).eq('id', scene.id)
    if (updateErr) { console.error('[TacticalMap] scene update error:', updateErr.message); alert('Failed to save map URL: ' + updateErr.message); setUploading(false); return }
    setScene(prev => prev ? { ...prev, background_url: urlData.publicUrl } : prev)
    setUploading(false)
  }

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
      grid_x: entry.is_npc ? scene.grid_cols - 2 : 1,
      grid_y: Math.min(i * 2 + 1, scene.grid_rows - 1),
      is_visible: true,
      color: entry.is_npc ? '#c0392b' : '#7ab3d4',
    }))
    if (newTokens.length > 0) {
      await supabase.from('scene_tokens').insert(newTokens)
    }
    await loadTokens(scene.id)
  }

  async function toggleTokenVisibility(tokenId: string) {
    const tok = tokens.find(t => t.id === tokenId)
    if (!tok) return
    await supabase.from('scene_tokens').update({ is_visible: !tok.is_visible }).eq('id', tokenId)
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, is_visible: !t.is_visible } : t))
  }

  async function removeToken(tokenId: string) {
    await supabase.from('scene_tokens').delete().eq('id', tokenId)
    setTokens(prev => prev.filter(t => t.id !== tokenId))
  }

  // No scene — show setup (z-index above NPC cards overlay)
  if (!scene && isGM) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', position: 'relative', zIndex: 1200 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '1rem' }}>No tactical scene set up</div>
          <button onClick={() => setShowSetup(true)}
            style={{ padding: '10px 24px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Create Scene
          </button>
        </div>
        {showSetup && (
          <div onClick={() => setShowSetup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '320px' }}>
              <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '1rem' }}>New Scene</div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Name</div>
                <input value={setupName} onChange={e => setSetupName(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowSetup(false)}
                  style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
                <button onClick={createScene}
                  style={{ flex: 2, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!scene) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', position: 'relative', zIndex: 1200 }}>Waiting for GM to set up a scene...</div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', background: '#111', overflow: 'hidden' }}>
      {/* GM Controls — left strip */}
      {isGM && (
        <div style={{ width: '130px', flexShrink: 0, background: '#0d0d0d', borderRight: '1px solid #2e2e2e', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
          <select value={scene.id} onChange={e => {
            if (e.target.value === '__new__') { setShowSetup(true); e.target.value = scene.id }
            else activateScene(e.target.value)
          }}
            style={{ padding: '4px 8px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', width: '100%', height: '28px', boxSizing: 'border-box', textAlign: 'center', marginBottom: '4px' }}>
            {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="__new__">+ New Scene</option>
          </select>
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '11px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px', textAlign: 'center' }}>Scene Name</div>
            <input value={scene.name} onChange={async e => {
              const newName = e.target.value
              setScene(prev => prev ? { ...prev, name: newName } : prev)
              await supabase.from('tactical_scenes').update({ name: newName }).eq('id', scene.id)
            }}
              style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', textAlign: 'center' }} />
          </div>
          <label style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '28px', boxSizing: 'border-box' }}>
            {uploading ? '...' : 'Upload Map'}
            <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) uploadBackground(e.target.files[0]) }} />
          </label>
          <button onClick={autoPopulateTokens}
            style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            Place Tokens
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
              style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>−</button>
            <span style={{ padding: '4px 6px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))}
              style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>+</button>
          </div>
          {/* Grid controls */}
          <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '6px', marginTop: '4px' }}>
            <button onClick={() => setShowGrid(prev => !prev)}
              style={{ padding: '4px 10px', background: showGrid ? '#1a2e10' : 'rgba(15,15,15,.85)', border: `1px solid ${showGrid ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: showGrid ? '#7fc458' : '#3a3a3a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', marginBottom: '4px' }}>
              Grid {showGrid ? 'ON' : 'OFF'}
            </button>
            <select value={gridColor} onChange={e => setGridColor(e.target.value)}
              style={{ padding: '4px 8px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer', width: '100%', height: '28px', boxSizing: 'border-box', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
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
                style={{ flex: 1, accentColor: '#c0392b', width: '70px', minWidth: 0 }} />
              <span style={{ fontSize: '11px', color: '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', minWidth: '22px', textAlign: 'right' }}>{Math.round(gridOpacity * 100)}%</span>
            </div>
            <button onClick={async () => {
              if (!bgImageRef.current || !containerRef.current) return
              const img = bgImageRef.current
              const cw = containerRef.current.clientWidth
              const ch = containerRef.current.clientHeight
              const imgAspect = img.naturalWidth / img.naturalHeight
              let drawW: number, drawH: number
              if (imgAspect > cw / ch) { drawW = cw; drawH = cw / imgAspect }
              else { drawH = ch; drawW = ch * imgAspect }
              const cellPx = Math.max(20, drawW / 30)
              const newCols = Math.round(drawW / cellPx)
              const newRows = Math.round(drawH / cellPx)
              setScene(p => p ? { ...p, grid_cols: newCols, grid_rows: newRows } : p)
              await supabase.from('tactical_scenes').update({ grid_cols: newCols, grid_rows: newRows }).eq('id', scene.id)
            }}
              style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', marginBottom: '4px' }}>
              Fit to Map
            </button>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', textAlign: 'center' }}>Cols</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                  <button onClick={async () => { const v = Math.max(1, scene.grid_cols - 1); setScene(p => p ? { ...p, grid_cols: v } : p); await supabase.from('tactical_scenes').update({ grid_cols: v }).eq('id', scene.id) }}
                    style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }}>−</button>
                  <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', minWidth: '20px', textAlign: 'center' }}>{scene.grid_cols}</span>
                  <button onClick={async () => { const v = scene.grid_cols + 1; setScene(p => p ? { ...p, grid_cols: v } : p); await supabase.from('tactical_scenes').update({ grid_cols: v }).eq('id', scene.id) }}
                    style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }}>+</button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', textAlign: 'center' }}>Rows</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                  <button onClick={async () => { const v = Math.max(1, scene.grid_rows - 1); setScene(p => p ? { ...p, grid_rows: v } : p); await supabase.from('tactical_scenes').update({ grid_rows: v }).eq('id', scene.id) }}
                    style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }}>−</button>
                  <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', minWidth: '20px', textAlign: 'center' }}>{scene.grid_rows}</span>
                  <button onClick={async () => { const v = scene.grid_rows + 1; setScene(p => p ? { ...p, grid_rows: v } : p); await supabase.from('tactical_scenes').update({ grid_rows: v }).eq('id', scene.id) }}
                    style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }}>+</button>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', textAlign: 'center' }}>Cell (ft)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                <button onClick={async () => { const v = Math.max(1, (scene.cell_feet ?? 3) - 1); setScene(p => p ? { ...p, cell_feet: v } : p); await supabase.from('tactical_scenes').update({ cell_feet: v }).eq('id', scene.id) }}
                  style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }}>−</button>
                <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', minWidth: '20px', textAlign: 'center' }}>{scene.cell_feet ?? 3}ft</span>
                <button onClick={async () => { const v = (scene.cell_feet ?? 3) + 1; setScene(p => p ? { ...p, cell_feet: v } : p); await supabase.from('tactical_scenes').update({ cell_feet: v }).eq('id', scene.id) }}
                  style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }}>+</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', textAlign: 'center' }}>Cell (px)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                <button onClick={() => setCellPx(p => Math.max(20, p - 5))}
                  style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }}>−</button>
                <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', minWidth: '30px', textAlign: 'center' }}>{cellPx}px</span>
                <button onClick={() => setCellPx(p => Math.min(200, p + 5))}
                  style={{ background: 'none', border: 'none', color: '#d4cfc9', cursor: 'pointer', fontSize: '14px', padding: 0 }}>+</button>
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => {
              setImgScale(1)
              setZoom(1)
              setPanX(0)
              setPanY(0)
              if (containerRef.current) { containerRef.current.scrollTop = 0; containerRef.current.scrollLeft = 0 }
            }}
              style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7ab3d4', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
              Fit to Screen
          </button>
          <button onClick={async () => {
            const newLocked = !mapLocked
            setMapLocked(newLocked)
            if (newLocked && scene) {
              // Save all visual settings to DB so players get the same view
              await supabase.from('tactical_scenes').update({
                is_locked: true, cell_px: cellPx, img_scale: imgScale,
              }).eq('id', scene.id)
              setScene(prev => prev ? { ...prev, is_locked: true, cell_px: cellPx, img_scale: imgScale } : prev)
            } else if (scene) {
              await supabase.from('tactical_scenes').update({ is_locked: false }).eq('id', scene.id)
              setScene(prev => prev ? { ...prev, is_locked: false } : prev)
            }
          }}
            style={{ padding: '4px 10px', background: mapLocked ? '#2a1210' : 'rgba(15,15,15,.85)', border: `1px solid ${mapLocked ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', color: mapLocked ? '#f5a89a' : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            {mapLocked ? 'Unlock Map' : 'Lock Map'}
          </button>
          <button onClick={() => setShowRangeOverlay(v => !v)}
            style={{ padding: '4px 10px', background: showRangeOverlay ? '#1a2e10' : 'rgba(15,15,15,.85)', border: `1px solid ${showRangeOverlay ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: showRangeOverlay ? '#7fc458' : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            {showRangeOverlay ? 'Hide Ranges' : 'Show Ranges'}
          </button>
          {scene.background_url && (
            <button onClick={async () => {
              if (!confirm('Delete the map image?')) return
              await supabase.from('tactical_scenes').update({ background_url: null }).eq('id', scene.id)
              setScene(prev => prev ? { ...prev, background_url: null } : prev)
              bgImageRef.current = null
            }}
              style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
              Delete Map
            </button>
          )}
          <button onClick={async () => {
            if (!confirm(`Delete scene "${scene.name}"? This cannot be undone.`)) return
            await supabase.from('scene_tokens').delete().eq('scene_id', scene.id)
            await supabase.from('tactical_scenes').delete().eq('id', scene.id)
            setScene(null)
            setTokens([])
            await loadScenes()
          }}
            style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            Delete Scene
          </button>
        </div>
      )}

      {/* Map canvas area — scrollable when zoomed */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Zoom control — top right */}
        <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif' }}>0%</span>
          <input type="range" min={25} max={400} step={25} value={Math.round(zoom * 100)}
            onChange={e => setZoom(Number(e.target.value) / 100)}
            style={{ width: '50px', accentColor: '#7ab3d4', cursor: 'pointer' }} />
          <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif' }}>100%</span>
        </div>
        <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
        <canvas ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={undefined}
          style={{ display: 'block', cursor: panning ? 'grabbing' : spaceHeld ? 'grab' : resizing ? 'nwse-resize' : dragging ? 'grabbing' : 'default' }}
        />
        </div>

      {/* Selected token info — bottom left */}
      {selectedToken && (() => {
        const tok = tokens.find(t => t.id === selectedToken)
        if (!tok) return null
        return (
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 10, background: 'rgba(15,15,15,.9)', border: '1px solid #3a3a3a', borderRadius: '3px', padding: '8px 12px', minWidth: '150px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{tok.name}</div>
            <div style={{ fontSize: '11px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase' }}>{tok.token_type} · {String.fromCharCode(65 + tok.grid_x)}{tok.grid_y + 1}</div>
            {isGM && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                <button onClick={() => toggleTokenVisibility(tok.id)}
                  style={{ padding: '2px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: tok.is_visible ? '#7fc458' : '#f5a89a', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {tok.is_visible ? 'Hide' : 'Reveal'}
                </button>
                <button onClick={() => { removeToken(tok.id); setSelectedToken(null) }}
                  style={{ padding: '2px 6px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '2px', color: '#f5a89a', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Scene setup modal */}
      {showSetup && (
        <div onClick={() => setShowSetup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '320px' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '1rem' }}>New Scene</div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '11px', color: '#cce0f5', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Name</div>
              <input value={setupName} onChange={e => setSetupName(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowSetup(false)}
                style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createScene}
                style={{ flex: 2, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>Create</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
