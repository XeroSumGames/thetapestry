'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

const DISPLAY_MAX = 340

interface Circle { cx: number; cy: number; r: number }

interface Props {
  file: File
  onCrop: (dataUrl: string) => void
  onClose: () => void
}

export default function PhotoCropModal({ file, onCrop, onClose }: Props) {
  const loadedImageRef = useRef<HTMLImageElement | null>(null)
  const dragStateRef = useRef<{ startX: number; startY: number; origCx: number; origCy: number } | null>(null)

  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [origDims, setOrigDims] = useState<{ w: number; h: number } | null>(null)
  const [displayDims, setDisplayDims] = useState<{ w: number; h: number } | null>(null)
  const [circle, setCircle] = useState<Circle | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        loadedImageRef.current = img
        setImgSrc(dataUrl)
        setOrigDims({ w: img.width, h: img.height })
        const aspect = img.width / img.height
        let dw = img.width, dh = img.height
        if (dw > DISPLAY_MAX || dh > DISPLAY_MAX) {
          if (aspect >= 1) { dw = DISPLAY_MAX; dh = Math.round(DISPLAY_MAX / aspect) }
          else { dh = DISPLAY_MAX; dw = Math.round(DISPLAY_MAX * aspect) }
        }
        setDisplayDims({ w: dw, h: dh })
        const r = Math.min(dw, dh) / 2
        setCircle({ cx: dw / 2, cy: dh / 2, r })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }, [file])

  const renderOutput = useCallback(() => {
    const img = loadedImageRef.current
    if (!img || !circle || !displayDims || !origDims) return
    const scale = origDims.w / displayDims.w
    const sx = (circle.cx - circle.r) * scale
    const sy = (circle.cy - circle.r) * scale
    const sSize = circle.r * 2 * scale
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, 256, 256)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, 256, 256)
    setOutputUrl(canvas.toDataURL('image/jpeg', 0.9))
  }, [circle, displayDims, origDims])

  useEffect(() => { renderOutput() }, [renderOutput])

  function handleCircleMouseDown(e: React.MouseEvent<SVGCircleElement>) {
    if (!circle) return
    e.preventDefault()
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, origCx: circle.cx, origCy: circle.cy }
    function onMove(ev: MouseEvent) {
      const s = dragStateRef.current
      if (!s || !displayDims) return
      const dx = ev.clientX - s.startX
      const dy = ev.clientY - s.startY
      setCircle(c => {
        if (!c) return c
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
    const maxR = Math.min(displayDims.w, displayDims.h) / 2
    const r = Math.max(20, Math.min(maxR, newR))
    const cx = Math.max(r, Math.min(displayDims.w - r, circle.cx))
    const cy = Math.max(r, Math.min(displayDims.h - r, circle.cy))
    setCircle({ cx, cy, r })
  }

  function recenter() {
    if (!displayDims) return
    const r = Math.min(displayDims.w, displayDims.h) / 2
    setCircle({ cx: displayDims.w / 2, cy: displayDims.h / 2, r })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '6px', padding: '1.25rem', width: 'min(560px, 94vw)', maxHeight: '92vh', overflowY: 'auto', fontFamily: 'Carlito, sans-serif' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f5f2ee', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Crop Photo
        </div>

        {!imgSrc && (
          <div style={{ fontSize: '13px', color: '#7a7068', padding: '2rem', textAlign: 'center' }}>Loading image...</div>
        )}

        {imgSrc && displayDims && circle && (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '14px' }}>
              {/* Draggable crop area */}
              <div style={{ position: 'relative', width: displayDims.w, height: displayDims.h, userSelect: 'none', background: '#0a0a0a', border: '1px solid #2e2e2e', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc} alt="source" width={displayDims.w} height={displayDims.h} style={{ display: 'block', pointerEvents: 'none' }} draggable={false} />
                <svg width={displayDims.w} height={displayDims.h} viewBox={`0 0 ${displayDims.w} ${displayDims.h}`} style={{ position: 'absolute', inset: 0 }}>
                  <defs>
                    <mask id="photo-crop-mask">
                      <rect x={0} y={0} width={displayDims.w} height={displayDims.h} fill="white" />
                      <circle cx={circle.cx} cy={circle.cy} r={circle.r} fill="black" />
                    </mask>
                  </defs>
                  <rect x={0} y={0} width={displayDims.w} height={displayDims.h} fill="black" fillOpacity={0.55} mask="url(#photo-crop-mask)" pointerEvents="none" />
                  <circle cx={circle.cx} cy={circle.cy} r={circle.r} fill="transparent" stroke="#7fc458" strokeWidth={2} strokeDasharray="6 4" onMouseDown={handleCircleMouseDown} style={{ cursor: 'move' }} />
                  <circle cx={circle.cx} cy={circle.cy} r={3} fill="#7fc458" pointerEvents="none" />
                </svg>
              </div>

              {/* Controls */}
              <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {outputUrl && (
                  <div>
                    <div style={{ fontSize: '13px', color: '#7a7068', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Preview</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={outputUrl} alt="preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #3a3a3a', display: 'block' }} />
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '13px', color: '#7a7068', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Zoom</div>
                  <input
                    type="range"
                    min={20}
                    max={Math.floor(Math.min(displayDims.w, displayDims.h) / 2)}
                    step={1}
                    value={circle.r}
                    onChange={e => handleRadiusChange(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: '#7fc458' }}
                  />
                </div>

                <button onClick={recenter} style={{ padding: '6px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Recenter
                </button>

                <div style={{ fontSize: '13px', color: '#5a5a5a', lineHeight: 1.6 }}>
                  <div><strong style={{ color: '#7a7068' }}>Drag</strong> the circle to reframe</div>
                  <div><strong style={{ color: '#7a7068' }}>Slider</strong> to zoom in or out</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #2e2e2e', paddingTop: '12px' }}>
              <button onClick={onClose} style={{ padding: '8px 18px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => outputUrl && onCrop(outputUrl)} disabled={!outputUrl} style={{ padding: '8px 18px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: outputUrl ? 'pointer' : 'not-allowed', opacity: outputUrl ? 1 : 0.5 }}>
                Use this crop
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
