'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  file: File
  onCancel: () => void
  // mimeType is the format of `cropped` ('image/png' for PNG inputs to
  // preserve transparency, 'image/jpeg' otherwise) so callers can pick
  // the correct file extension when uploading.
  onCrop: (cropped: Blob, previewUrl: string, mimeType: string) => void
}

// Free-aspect cropper for object-token images. Loads the selected File,
// shows the image with a draggable / corner-resizable crop box (any
// rectangle — not forced square), and outputs a JPEG blob at the
// cropped aspect ratio. Long edge is capped at OUT_LONG_EDGE so the
// upload size stays sane for wide truck art.
export default function ObjectImageCropper({ file, onCancel, onCrop }: Props) {
  const [srcUrl, setSrcUrl] = useState<string | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  // Crop rect in NATURAL image pixels (not display pixels). Free aspect:
  // width and height are independent. Default = the entire image so a
  // GM who just wants to use the file as-is can hit Crop & Upload
  // immediately.
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [processing, setProcessing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; startBox: { x: number; y: number; w: number; h: number } } | null>(null)

  // Output JPEG: cap the longer edge at this many pixels. Preserves
  // aspect; a 5:2 truck stays 5:2, just downscaled if huge.
  const OUT_LONG_EDGE = 1024

  // Load the file as a data URL + measure dimensions
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setSrcUrl(url)
      const img = new Image()
      img.onload = () => {
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
        // Default crop: the entire image at its native aspect.
        setBox({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight })
      }
      img.src = url
    }
    reader.readAsDataURL(file)
  }, [file])

  // Display ↔ natural pixel ratio. The image fits in a 460×400 viewport.
  const MAX_DISPLAY = 460
  const displayScale = imgSize ? Math.min(MAX_DISPLAY / imgSize.w, 400 / imgSize.h, 1) : 1
  const displayW = imgSize ? imgSize.w * displayScale : 0
  const displayH = imgSize ? imgSize.h * displayScale : 0

  function onPointerDown(e: React.PointerEvent, kind: 'move' | 'resize') {
    if (!box) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { kind, startX: e.clientX, startY: e.clientY, startBox: { ...box } }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !box || !imgSize) return
    const dx = (e.clientX - dragRef.current.startX) / displayScale
    const dy = (e.clientY - dragRef.current.startY) / displayScale
    const sb = dragRef.current.startBox
    if (dragRef.current.kind === 'move') {
      const x = Math.max(0, Math.min(imgSize.w - sb.w, sb.x + dx))
      const y = Math.max(0, Math.min(imgSize.h - sb.h, sb.y + dy))
      setBox({ x, y, w: sb.w, h: sb.h })
    } else {
      // Resize bottom-right corner. Width and height move independently
      // so the GM can set any aspect they want — no aspect lock.
      const w = Math.max(32, Math.min(imgSize.w - sb.x, sb.w + dx))
      const h = Math.max(32, Math.min(imgSize.h - sb.y, sb.h + dy))
      setBox({ x: sb.x, y: sb.y, w, h })
    }
  }

  function onPointerUp() {
    dragRef.current = null
  }

  async function handleConfirm() {
    if (!srcUrl || !box || !imgSize) return
    setProcessing(true)
    const img = new Image()
    img.onload = () => {
      // Output dimensions: long edge clamped to OUT_LONG_EDGE,
      // short edge scaled to preserve the cropped aspect ratio.
      const aspect = box.w / box.h
      let outW: number
      let outH: number
      if (aspect >= 1) {
        outW = Math.min(OUT_LONG_EDGE, Math.round(box.w))
        outH = Math.round(outW / aspect)
      } else {
        outH = Math.min(OUT_LONG_EDGE, Math.round(box.h))
        outW = Math.round(outH * aspect)
      }
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) { setProcessing(false); return }
      ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, outW, outH)
      // Output format follows the input. PNG inputs may have a
      // transparent background (top-down vehicle art typically does);
      // JPEG would composite that onto black. Preserve transparency by
      // re-encoding as PNG when the source is PNG. For JPEG/other
      // sources, stick with JPEG for the smaller file size.
      const isPng = file.type === 'image/png'
      const outMime = isPng ? 'image/png' : 'image/jpeg'
      canvas.toBlob(blob => {
        if (!blob) { setProcessing(false); return }
        const previewUrl = canvas.toDataURL(outMime, isPng ? undefined : 0.9)
        onCrop(blob, previewUrl, outMime)
      }, outMime, isPng ? undefined : 0.9)
    }
    img.src = srcUrl
  }

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10003, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', maxWidth: '500px' }}>
        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Crop Image</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px' }}>Drag the box to move, drag the corner to resize. Crop to any shape — wide trucks, tall walls, square crates.</div>

        {srcUrl && imgSize && box ? (
          <div
            ref={containerRef}
            style={{ position: 'relative', width: `${displayW}px`, height: `${displayH}px`, margin: '0 auto 12px', userSelect: 'none', touchAction: 'none' }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img src={srcUrl} style={{ width: `${displayW}px`, height: `${displayH}px`, display: 'block', pointerEvents: 'none' }} alt="" />
            {/* Dim outside the crop using 4 overlays */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${box.y * displayScale}px`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: `${(box.y + box.h) * displayScale}px`, bottom: 0, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 0, top: `${box.y * displayScale}px`, width: `${box.x * displayScale}px`, height: `${box.h * displayScale}px`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: `${(box.x + box.w) * displayScale}px`, right: 0, top: `${box.y * displayScale}px`, height: `${box.h * displayScale}px`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            {/* Crop frame — draggable */}
            <div
              onPointerDown={e => onPointerDown(e, 'move')}
              style={{ position: 'absolute', left: `${box.x * displayScale}px`, top: `${box.y * displayScale}px`, width: `${box.w * displayScale}px`, height: `${box.h * displayScale}px`, border: '2px solid #EF9F27', boxSizing: 'border-box', cursor: 'move', background: 'transparent' }}
            />
            {/* Resize handle — bottom-right; free aspect (w and h move independently) */}
            <div
              onPointerDown={e => onPointerDown(e, 'resize')}
              style={{ position: 'absolute', left: `${(box.x + box.w) * displayScale - 7}px`, top: `${(box.y + box.h) * displayScale - 7}px`, width: '14px', height: '14px', background: '#EF9F27', border: '2px solid #1a1a1a', cursor: 'nwse-resize', borderRadius: '2px' }}
            />
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#5a5550' }}>Loading…</div>
        )}

        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={handleConfirm} disabled={!box || processing}
            style={{ flex: 1, padding: '8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: processing ? 'wait' : 'pointer', opacity: processing ? 0.6 : 1 }}>
            {processing ? 'Processing…' : 'Crop & Upload'}
          </button>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
