'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase-browser'

const OUTPUT_SIZE = 256
const DISPLAY_MAX = 500 // max width/height of the source preview
type Gender = 'man' | 'woman'
function pad3(n: number) { return String(n).padStart(3, '0') }

// ── Styling helpers (inline, matching the codebase pattern) ──
const panel: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', marginBottom: '1rem' }
const h1Style: React.CSSProperties = { fontFamily: '"Barlow Condensed", sans-serif', fontSize: '2rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px', borderBottom: '1px solid #c0392b', paddingBottom: '10px' }
const h2Style: React.CSSProperties = { fontFamily: '"Barlow Condensed", sans-serif', fontSize: '14px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }
const btnPrimary: React.CSSProperties = { padding: '10px 20px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const btnSecondary: React.CSSProperties = { ...btnPrimary, background: '#242424', border: '1px solid #3a3a3a', color: '#d4cfc9' }
const subLabel: React.CSSProperties = { fontSize: '11px', color: '#cce0f5', fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }

interface Circle { cx: number; cy: number; r: number } // in display coords

export default function PortraitResizerPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadedImageRef = useRef<HTMLImageElement | null>(null)
  const dragStateRef = useRef<{ startX: number; startY: number; origCx: number; origCy: number } | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [origDims, setOrigDims] = useState<{ w: number; h: number } | null>(null)
  const [displayDims, setDisplayDims] = useState<{ w: number; h: number } | null>(null)
  const [circle, setCircle] = useState<Circle | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [fileSizeKB, setFileSizeKB] = useState<number>(0)
  const [quality, setQuality] = useState<number>(0.85)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [gender, setGender] = useState<Gender>('man')
  const [counts, setCounts] = useState<{ man: number; woman: number }>({ man: 0, woman: 0 })

  // Fetch global counters on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('portrait_counters').select('gender, count')
      if (data) {
        const map = { man: 0, woman: 0 }
        for (const row of data as any[]) {
          if (row.gender === 'man' || row.gender === 'woman') map[row.gender as Gender] = row.count ?? 0
        }
        setCounts(map)
      }
    })()
  }, [supabase])

  // ── Render the 256x256 output whenever circle or quality changes ──
  const renderOutput = useCallback(() => {
    const img = loadedImageRef.current
    if (!img || !circle || !displayDims || !origDims) return
    try {
      // Scale from display coords → source (original image) coords
      const scale = origDims.w / displayDims.w
      const sx = (circle.cx - circle.r) * scale
      const sy = (circle.cy - circle.r) * scale
      const sSize = circle.r * 2 * scale

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) { setError('Canvas not supported in this browser.'); return }
      // Letterbox background (in case circle extends outside image)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      canvas.toBlob(blob => {
        if (blob) setFileSizeKB(Math.round((blob.size / 1024) * 10) / 10)
      }, 'image/jpeg', quality)
      setOutputUrl(canvas.toDataURL('image/jpeg', quality))
      setError(null)
    } catch (err: any) {
      setError(`Failed to process image: ${err?.message ?? 'unknown error'}`)
    }
  }, [circle, displayDims, origDims, quality])

  useEffect(() => { renderOutput() }, [renderOutput])

  function handleFile(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError(`"${file.name}" is not an image file. Try a JPG, PNG, GIF, or WebP.`)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      loadedImageRef.current = img
      setFileName(file.name)
      setOrigDims({ w: img.width, h: img.height })

      // Compute display size (fit within DISPLAY_MAX x DISPLAY_MAX)
      const aspect = img.width / img.height
      let dw = img.width, dh = img.height
      if (dw > DISPLAY_MAX || dh > DISPLAY_MAX) {
        if (aspect >= 1) { dw = DISPLAY_MAX; dh = DISPLAY_MAX / aspect }
        else { dh = DISPLAY_MAX; dw = DISPLAY_MAX * aspect }
      }
      setDisplayDims({ w: dw, h: dh })

      // Default circle: centered, biggest that fits
      const r = Math.min(dw, dh) / 2
      setCircle({ cx: dw / 2, cy: dh / 2, r })

      URL.revokeObjectURL(objectUrl)
    }
    img.onerror = () => {
      setError('Failed to load this image. It may be corrupt or an unsupported format.')
      URL.revokeObjectURL(objectUrl)
    }
    img.src = objectUrl
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragging(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  // ── Circle drag handlers ──
  function handleCircleMouseDown(e: React.MouseEvent<SVGCircleElement>) {
    if (!circle) return
    e.preventDefault()
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, origCx: circle.cx, origCy: circle.cy }
    function onMove(ev: MouseEvent) {
      const s = dragStateRef.current
      if (!s || !displayDims || !circle) return
      const dx = ev.clientX - s.startX
      const dy = ev.clientY - s.startY
      setCircle(c => {
        if (!c) return c
        // Clamp so the circle stays within the display bounds
        const cx = Math.max(c.r, Math.min(displayDims.w - c.r, s.origCx + dx))
        const cy = Math.max(c.r, Math.min(displayDims.h - c.r, s.origCy + dy))
        return { ...c, cx, cy }
      })
    }
    function onUp() {
      dragStateRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleRadiusChange(newR: number) {
    if (!circle || !displayDims) return
    // Constrain radius: at least 20px, at most half the shorter display dimension
    const maxR = Math.min(displayDims.w, displayDims.h) / 2
    const r = Math.max(20, Math.min(maxR, newR))
    // Re-clamp center so the resized circle still fits
    const cx = Math.max(r, Math.min(displayDims.w - r, circle.cx))
    const cy = Math.max(r, Math.min(displayDims.h - r, circle.cy))
    setCircle({ cx, cy, r })
  }

  function recenterCircle() {
    if (!displayDims) return
    const r = Math.min(displayDims.w, displayDims.h) / 2
    setCircle({ cx: displayDims.w / 2, cy: displayDims.h / 2, r })
  }

  function reset() {
    loadedImageRef.current = null
    setFileName(null)
    setOrigDims(null)
    setDisplayDims(null)
    setCircle(null)
    setOutputUrl(null)
    setFileSizeKB(0)
    setError(null)
    setQuality(0.85)
  }

  const nextNumber = counts[gender] + 1
  const genderLabel = gender === 'man' ? 'MAN' : 'WOMAN'
  const nextDownloadName = `NPC-${genderLabel}-${pad3(nextNumber)}.jpg`

  async function handleDownload() {
    if (!outputUrl) return
    // Atomically increment the global counter, then download using the number the server returned.
    const { data, error: rpcErr } = await supabase.rpc('increment_portrait_counter', { g: gender })
    if (rpcErr) { setError(`Counter error: ${rpcErr.message}`); return }
    const n: number = typeof data === 'number' ? data : nextNumber
    const filename = `NPC-${genderLabel}-${pad3(n)}.jpg`
    // Update local counts so the button shows the next number without a round-trip
    setCounts(prev => ({ ...prev, [gender]: n }))
    // Trigger download
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const imgSrc = loadedImageRef.current?.src

  return (
    <div>
      <h1 style={h1Style}>Portrait Resizer</h1>
      <div style={{ color: '#cce0f5', fontSize: '14px', marginBottom: '1.5rem', fontFamily: 'Barlow, sans-serif' }}>
        Drop any image and export it as a 256×256 JPEG — ready for the NPC portrait bank.
        Drag the circle to choose what gets captured, or resize it to zoom.
      </div>

      {/* Drop zone / file picker (hidden once an image is loaded) */}
      {!outputUrl && (
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...panel,
            minHeight: '180px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px dashed ${isDragging ? '#c0392b' : '#3a3a3a'}`,
            background: isDragging ? '#2a1210' : '#1a1a1a',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontFamily: '"Barlow Condensed", sans-serif', fontSize: '18px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: isDragging ? '#c0392b' : '#f5f2ee' }}>
            {isDragging ? 'Drop to process' : 'Drop an image here'}
          </div>
          <div style={{ color: '#5a5550', fontSize: '13px', marginTop: '8px' }}>or click to browse (JPG, PNG, GIF, WebP)</div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleInputChange} style={{ display: 'none' }} />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{ ...panel, background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Editor */}
      {outputUrl && origDims && displayDims && circle && imgSrc && (
        <>
          {/* Source image + circle editor */}
          <div style={panel}>
            <div style={h2Style}>Position the circle</div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', width: displayDims.w, height: displayDims.h, userSelect: 'none', background: '#0a0a0a', border: '1px solid #2e2e2e' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc} alt="source" width={displayDims.w} height={displayDims.h} style={{ display: 'block', pointerEvents: 'none' }} draggable={false} />
                <svg
                  width={displayDims.w}
                  height={displayDims.h}
                  viewBox={`0 0 ${displayDims.w} ${displayDims.h}`}
                  style={{ position: 'absolute', inset: 0 }}
                >
                  <defs>
                    <mask id="circle-mask-src">
                      <rect x={0} y={0} width={displayDims.w} height={displayDims.h} fill="white" />
                      <circle cx={circle.cx} cy={circle.cy} r={circle.r} fill="black" />
                    </mask>
                  </defs>
                  {/* Darken area outside the circle */}
                  <rect x={0} y={0} width={displayDims.w} height={displayDims.h} fill="black" fillOpacity={0.55} mask="url(#circle-mask-src)" pointerEvents="none" />
                  {/* Draggable circle */}
                  <circle
                    cx={circle.cx}
                    cy={circle.cy}
                    r={circle.r}
                    fill="transparent"
                    stroke="#c0392b"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    onMouseDown={handleCircleMouseDown}
                    style={{ cursor: 'move' }}
                  />
                  {/* Center crosshair */}
                  <circle cx={circle.cx} cy={circle.cy} r={3} fill="#c0392b" pointerEvents="none" />
                </svg>
              </div>

              {/* Controls panel */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ ...subLabel, marginBottom: '4px' }}>Circle size</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="range"
                      min={20}
                      max={Math.floor(Math.min(displayDims.w, displayDims.h) / 2)}
                      step={1}
                      value={circle.r}
                      onChange={e => handleRadiusChange(parseInt(e.target.value, 10))}
                      style={{ flex: 1, accentColor: '#c0392b' }}
                    />
                    <div style={{ fontFamily: '"Barlow Condensed", sans-serif', fontSize: '15px', color: '#f5f2ee', minWidth: '48px', textAlign: 'right' }}>
                      {Math.round(circle.r * 2)}px
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#5a5550', marginTop: '4px' }}>
                    Source area: {Math.round((circle.r * 2 * origDims.w) / displayDims.w)}px
                  </div>
                </div>

                <button type="button" onClick={recenterCircle} style={{ ...btnSecondary, padding: '6px 14px', fontSize: '12px', marginBottom: '1rem' }}>
                  Recenter / maximize
                </button>

                <div style={{ fontSize: '12px', color: '#cce0f5', lineHeight: 1.5 }}>
                  <div style={{ marginBottom: '4px' }}><strong style={{ color: '#f5f2ee' }}>Drag</strong> the circle to reposition</div>
                  <div><strong style={{ color: '#f5f2ee' }}>Slider</strong> resizes to zoom in or out</div>
                </div>
              </div>
            </div>
          </div>

          {/* Output previews */}
          <div style={panel}>
            <div style={h2Style}>Output preview</div>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outputUrl} alt="256 preview" width={256} height={256} style={{ display: 'block', borderRadius: '2px', border: '1px solid #2e2e2e' }} />
                <div style={subLabel}>256 × 256 (download)</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outputUrl} alt="56 preview" width={56} height={56} style={{ display: 'block', borderRadius: '50%', border: '2px solid #c0392b' }} />
                <div style={subLabel}>56px (roster)</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outputUrl} alt="32 preview" width={32} height={32} style={{ display: 'block', borderRadius: '50%', border: '1.5px solid #f5f2ee' }} />
                <div style={subLabel}>32px (token)</div>
              </div>
            </div>
          </div>

          {/* Quality + stats */}
          <div style={panel}>
            <div style={h2Style}>Quality</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.05}
                value={quality}
                onChange={e => setQuality(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#c0392b' }}
              />
              <div style={{ fontFamily: '"Barlow Condensed", sans-serif', fontSize: '18px', fontWeight: 700, color: '#f5f2ee', minWidth: '48px', textAlign: 'right' }}>
                {quality.toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <div style={subLabel}>Original</div>
                <div style={{ fontFamily: '"Barlow Condensed", sans-serif', fontSize: '16px', color: '#f5f2ee' }}>{origDims.w} × {origDims.h}</div>
              </div>
              <div>
                <div style={subLabel}>Output</div>
                <div style={{ fontFamily: '"Barlow Condensed", sans-serif', fontSize: '16px', color: '#f5f2ee' }}>256 × 256</div>
              </div>
              <div>
                <div style={subLabel}>File size</div>
                <div style={{ fontFamily: '"Barlow Condensed", sans-serif', fontSize: '16px', color: '#7fc458' }}>{fileSizeKB} KB</div>
              </div>
            </div>
          </div>

          {/* Gender toggle + actions */}
          <div style={panel}>
            <div style={h2Style}>NPC Gender</div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
              {(['man', 'woman'] as const).map(g => {
                const active = gender === g
                return (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: active ? '#2a1210' : '#242424',
                      border: `1px solid ${active ? '#c0392b' : '#3a3a3a'}`,
                      borderRadius: '3px',
                      color: active ? '#f5a89a' : '#d4cfc9',
                      fontSize: '14px',
                      fontFamily: '"Barlow Condensed", sans-serif',
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}>
                    {g === 'man' ? 'Male' : 'Female'}
                    <span style={{ fontSize: '11px', marginLeft: '8px', color: '#5a5550', fontWeight: 400 }}>{counts[g]} saved</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={handleDownload} style={btnPrimary}>
                ⬇ Download {nextDownloadName}
              </button>
              <button type="button" onClick={reset} style={btnSecondary}>Process Another</button>
            </div>
          </div>
        </>
      )}

      {/* Tips */}
      <div style={{ ...panel, background: '#111', borderColor: '#2e2e2e' }}>
        <div style={h2Style}>Tips for great portraits</div>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cce0f5', fontSize: '13px', lineHeight: 1.7 }}>
          <li>Head-and-shoulders framing — subject fills roughly 70% of the frame</li>
          <li>Keep important details away from the corners — the token mask clips them into a circle</li>
          <li>Simple, solid backgrounds read better at 32px than busy scenes</li>
          <li>A consistent style across your bank (all paintings, all photos, all sketches) keeps the roster cohesive</li>
          <li>Quality 0.85 is usually a good balance; drop to 0.70 for smaller files, or push to 1.0 for print-quality archives</li>
        </ul>
      </div>
    </div>
  )
}
