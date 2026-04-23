'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  file: File
  onCancel: () => void
  onCrop: (cropped: Blob, previewUrl: string) => void
}

// Square-only cropper for object-token images. Loads the selected File,
// shows the image in a modal with a draggable/resizable square crop box,
// and outputs a 512×512 JPEG blob when the user confirms.
export default function ObjectImageCropper({ file, onCancel, onCrop }: Props) {
  const [srcUrl, setSrcUrl] = useState<string | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  // Crop box in NATURAL image pixels (not display pixels)
  const [box, setBox] = useState<{ x: number; y: number; size: number } | null>(null)
  const [processing, setProcessing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; startBox: { x: number; y: number; size: number } } | null>(null)

  // Load the file as a data URL + measure dimensions
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setSrcUrl(url)
      const img = new Image()
      img.onload = () => {
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
        // Default crop: largest centered square
        const s = Math.min(img.naturalWidth, img.naturalHeight)
        setBox({ x: (img.naturalWidth - s) / 2, y: (img.naturalHeight - s) / 2, size: s })
      }
      img.src = url
    }
    reader.readAsDataURL(file)
  }, [file])

  // Display ↔ natural pixel ratio. The image fits in a 460px-wide container.
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
      const x = Math.max(0, Math.min(imgSize.w - sb.size, sb.x + dx))
      const y = Math.max(0, Math.min(imgSize.h - sb.size, sb.y + dy))
      setBox({ x, y, size: sb.size })
    } else {
      // Resize — keep square, anchor top-left. Use the larger of dx/dy for feel.
      const delta = Math.max(dx, dy)
      const maxSize = Math.min(imgSize.w - sb.x, imgSize.h - sb.y)
      const size = Math.max(32, Math.min(maxSize, sb.size + delta))
      setBox({ x: sb.x, y: sb.y, size })
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
      const out = 512
      const canvas = document.createElement('canvas')
      canvas.width = out
      canvas.height = out
      const ctx = canvas.getContext('2d')
      if (!ctx) { setProcessing(false); return }
      ctx.drawImage(img, box.x, box.y, box.size, box.size, 0, 0, out, out)
      canvas.toBlob(blob => {
        if (!blob) { setProcessing(false); return }
        const previewUrl = canvas.toDataURL('image/jpeg', 0.9)
        onCrop(blob, previewUrl)
      }, 'image/jpeg', 0.9)
    }
    img.src = srcUrl
  }

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10003, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1rem', maxWidth: '500px' }}>
        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>Crop Image</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px' }}>Drag the box to move, drag the corner to resize. Tokens render square.</div>

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
            <div style={{ position: 'absolute', left: 0, right: 0, top: `${(box.y + box.size) * displayScale}px`, bottom: 0, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 0, top: `${box.y * displayScale}px`, width: `${box.x * displayScale}px`, height: `${box.size * displayScale}px`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: `${(box.x + box.size) * displayScale}px`, right: 0, top: `${box.y * displayScale}px`, height: `${box.size * displayScale}px`, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
            {/* Crop frame — draggable */}
            <div
              onPointerDown={e => onPointerDown(e, 'move')}
              style={{ position: 'absolute', left: `${box.x * displayScale}px`, top: `${box.y * displayScale}px`, width: `${box.size * displayScale}px`, height: `${box.size * displayScale}px`, border: '2px solid #EF9F27', boxSizing: 'border-box', cursor: 'move', background: 'transparent' }}
            />
            {/* Resize handle — bottom-right */}
            <div
              onPointerDown={e => onPointerDown(e, 'resize')}
              style={{ position: 'absolute', left: `${(box.x + box.size) * displayScale - 7}px`, top: `${(box.y + box.size) * displayScale - 7}px`, width: '14px', height: '14px', background: '#EF9F27', border: '2px solid #1a1a1a', cursor: 'nwse-resize', borderRadius: '2px' }}
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
