'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase-browser'

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
  is_active: boolean
  has_grid: boolean
}

interface Props {
  campaignId: string
  isGM: boolean
  initiativeOrder: any[]
  onTokenClick?: (token: Token) => void
}

export default function TacticalMap({ campaignId, isGM, initiativeOrder, onTokenClick }: Props) {
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
  const [resizing, setResizing] = useState<{ corner: string; startX: number; startY: number; startZoom: number } | null>(null)
  const mapDrawRef = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 })
  const tokensRef = useRef<Token[]>([])
  const sceneRef = useRef<Scene | null>(null)

  // Keep refs in sync for canvas drawing
  useEffect(() => { tokensRef.current = tokens }, [tokens])
  useEffect(() => { sceneRef.current = scene }, [scene])

  // Load scenes
  async function loadScenes() {
    const { data } = await supabase.from('tactical_scenes').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    setScenes(data ?? [])
    const active = (data ?? []).find((s: Scene) => s.is_active)
    if (active) { setScene(active); loadTokens(active.id) }
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
    return () => { supabase.removeChannel(channel) }
  }, [campaignId])

  // Load background image when scene changes
  useEffect(() => {
    if (!scene?.background_url) { bgImageRef.current = null; draw(); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { bgImageRef.current = img; draw() }
    img.src = scene.background_url
  }, [scene?.background_url])

  // Redraw on token/scene changes
  useEffect(() => { draw() }, [tokens, scene, selectedToken, zoom, panX, panY])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  function getCellSize(): number {
    if (!canvasRef.current || !scene) return 40
    const cw = canvasRef.current.width
    const ch = canvasRef.current.height
    return Math.min(cw / scene.grid_cols, ch / scene.grid_rows)
  }

  function draw() {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const s = sceneRef.current
    if (!s) return

    // Canvas scales with zoom — at >100% it exceeds the container, enabling scroll
    canvas.width = Math.max(container.clientWidth, container.clientWidth * zoom)
    canvas.height = Math.max(container.clientHeight, container.clientHeight * zoom)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cellSize = getCellSize()
    const gridW = s.grid_cols * cellSize
    const gridH = s.grid_rows * cellSize
    const offsetX = (canvas.width - gridW) / 2
    const offsetY = (canvas.height - gridH) / 2

    // Clear
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Background image — draw at original aspect ratio, filling the canvas
    if (bgImageRef.current) {
      const img = bgImageRef.current
      const imgAspect = img.naturalWidth / img.naturalHeight
      let drawW: number, drawH: number
      if (imgAspect > canvas.width / canvas.height) {
        drawW = canvas.width
        drawH = canvas.width / imgAspect
      } else {
        drawH = canvas.height
        drawW = canvas.height * imgAspect
      }
      ctx.drawImage(img, 0, 0, drawW, drawH)
      mapDrawRef.current = { x: 0, y: 0, w: drawW, h: drawH }

      // Resize handles at corners (GM only, unlocked)
      if (isGM && !mapLocked) {
        const hs = 10
        ctx.fillStyle = '#c0392b'
        ;[
          [0, 0], [drawW - hs, 0],
          [0, drawH - hs], [drawW - hs, drawH - hs],
        ].forEach(([hx, hy]) => ctx.fillRect(hx, hy, hs, hs))
      }
    } else {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(offsetX, offsetY, gridW, gridH)
    }

    // Grid drawing removed — will be re-added with more context later

    // Tokens
    const toks = tokensRef.current
    const activeEntry = initiativeOrder.find((e: any) => e.is_active)

    toks.forEach(t => {
      if (!t.is_visible && !isGM) return
      const cx = offsetX + t.grid_x * cellSize + cellSize / 2
      const cy = offsetY + t.grid_y * cellSize + cellSize / 2
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

      // Token circle
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = t.is_visible ? (t.color || '#c0392b') : 'rgba(192,57,43,0.3)'
      ctx.fill()
      ctx.strokeStyle = isActive ? '#7fc458' : selectedToken === t.id ? '#f5f2ee' : 'rgba(255,255,255,0.4)'
      ctx.lineWidth = isActive || selectedToken === t.id ? 3 : 1.5
      ctx.stroke()

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // Hidden indicator
      if (!t.is_visible && isGM) {
        ctx.globalAlpha = 0.5
      }

      // Initials
      ctx.fillStyle = '#f5f2ee'
      ctx.font = `bold ${Math.max(10, radius * 0.8)}px Barlow Condensed`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      ctx.fillText(initials, cx, cy)

      // Name below
      ctx.font = `${Math.max(8, cellSize * 0.22)}px Barlow Condensed`
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText(t.name.split(' ')[0], cx, cy + radius + Math.max(8, cellSize * 0.2))

      ctx.globalAlpha = 1
    })

    // Range bands for selected token
    if (selectedToken) {
      const selTok = toks.find(t => t.id === selectedToken)
      if (selTok) {
        const cx = offsetX + selTok.grid_x * cellSize + cellSize / 2
        const cy = offsetY + selTok.grid_y * cellSize + cellSize / 2
        const bands = [
          { cells: 1, color: 'rgba(127,196,88,0.1)', label: 'Engaged' },
          { cells: 3, color: 'rgba(239,159,39,0.06)', label: 'Close' },
          { cells: 6, color: 'rgba(239,159,39,0.04)', label: 'Medium' },
          { cells: 10, color: 'rgba(192,57,43,0.03)', label: 'Long' },
        ]
        bands.reverse().forEach(b => {
          ctx.beginPath()
          ctx.arc(cx, cy, b.cells * cellSize, 0, Math.PI * 2)
          ctx.fillStyle = b.color
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.lineWidth = 0.5
          ctx.stroke()
        })
      }
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
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const gx = Math.floor((mx - offsetX) / cellSize)
    const gy = Math.floor((my - offsetY) / cellSize)
    if (gx < 0 || gx >= scene.grid_cols || gy < 0 || gy >= scene.grid_rows) return null
    return { gx, gy }
  }

  function getTokenAt(gx: number, gy: number): Token | undefined {
    return tokens.find(t => t.grid_x === gx && t.grid_y === gy && (t.is_visible || isGM))
  }

  function handleMouseDown(e: React.MouseEvent) {
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
    if (isGM && !mapLocked && bgImageRef.current) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
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
          setResizing({ corner: c.name, startX: e.clientX, startY: e.clientY, startZoom: zoom })
          return
        }
      }
    }
    // No token or handle clicked — start panning (unless locked)
    setSelectedToken(null)
    if (!mapLocked) {
      setPanning({ startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY })
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (resizing) {
      const delta = e.clientX - resizing.startX
      const zoomDelta = delta / 300
      setZoom(Math.max(0.1, Math.min(4, resizing.startZoom + zoomDelta)))
      return
    }
    if (panning) {
      setPanX(panning.startPanX + (e.clientX - panning.startX))
      setPanY(panning.startPanY + (e.clientY - panning.startY))
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
      await supabase.from('scene_tokens').update({ grid_x: pos.gx, grid_y: pos.gy }).eq('id', dragging.tokenId)
      setTokens(prev => prev.map(t => t.id === dragging.tokenId ? { ...t, grid_x: pos.gx, grid_y: pos.gy } : t))
    }
    setDragging(null)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    const pos = getGridPos(e)
    if (!pos) return
    const tok = getTokenAt(pos.gx, pos.gy)
    if (tok && onTokenClick) onTokenClick(tok)
  }

  // Scene management
  async function createScene() {
    const { data, error } = await supabase.from('tactical_scenes').insert({
      campaign_id: campaignId, name: setupName, grid_cols: setupCols, grid_rows: setupRows, is_active: true, has_grid: setupHasGrid,
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={setupHasGrid} onChange={e => setSetupHasGrid(e.target.checked)} style={{ accentColor: '#c0392b' }} />
                <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>Map has a grid</span>
              </label>
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
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Scene Name</div>
            <input value={scene.name} onChange={async e => {
              const newName = e.target.value
              setScene(prev => prev ? { ...prev, name: newName } : prev)
              await supabase.from('tactical_scenes').update({ name: newName }).eq('id', scene.id)
            }}
              style={{ width: '100%', padding: '4px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', textAlign: 'center' }} />
          </div>
          <label style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', display: 'block' }}>
            {uploading ? '...' : 'Upload Map'}
            <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) uploadBackground(e.target.files[0]) }} />
          </label>
          <button onClick={autoPopulateTokens}
            style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#7fc458', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%' }}>
            Place Tokens
          </button>
          <button onClick={() => setShowSetup(true)}
            style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%' }}>
            New Scene
          </button>
          {scenes.length > 1 && (
            <select value={scene.id} onChange={e => activateScene(e.target.value)}
              style={{ padding: '4px 8px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', appearance: 'none', cursor: 'pointer' }}>
              {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
              style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>−</button>
            <span style={{ padding: '4px 6px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', minWidth: '40px' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))}
              style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }}>+</button>
          </div>
          <button onClick={() => setMapLocked(prev => !prev)}
            style={{ padding: '4px 10px', background: mapLocked ? '#2a1210' : 'rgba(15,15,15,.85)', border: `1px solid ${mapLocked ? '#c0392b' : '#3a3a3a'}`, borderRadius: '3px', color: mapLocked ? '#f5a89a' : '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%' }}>
            {mapLocked ? 'Unlock Map' : 'Lock Map'}
          </button>
          {scene.background_url && (
            <button onClick={async () => {
              if (!confirm('Delete the map image?')) return
              await supabase.from('tactical_scenes').update({ background_url: null }).eq('id', scene.id)
              setScene(prev => prev ? { ...prev, background_url: null } : prev)
              bgImageRef.current = null
            }}
              style={{ padding: '4px 10px', background: 'rgba(15,15,15,.85)', border: '1px solid #c0392b', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'center', width: '100%' }}>
              Delete Map
            </button>
          )}
        </div>
      )}

      {/* Map canvas area — scrollable when zoomed */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <canvas ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(z => Math.max(0.1, Math.min(4, z + (e.deltaY < 0 ? 0.1 : -0.1)))) } }}
          style={{ display: 'block', cursor: resizing ? 'nwse-resize' : dragging ? 'grabbing' : 'default' }}
        />

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
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={setupHasGrid} onChange={e => setSetupHasGrid(e.target.checked)} style={{ accentColor: '#c0392b' }} />
              <span style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>Map has a grid</span>
            </label>
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
