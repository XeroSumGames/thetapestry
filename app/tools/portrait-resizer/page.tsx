'use client'
import { useRef, useState, useEffect } from 'react'

const OUTPUT_SIZE = 256

// ── Styling helpers (inline, matching the codebase pattern) ──
const panel: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', marginBottom: '1rem' }
const h1Style: React.CSSProperties = { fontFamily: '"Barlow Condensed", sans-serif', fontSize: '2rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px', borderBottom: '1px solid #c0392b', paddingBottom: '10px' }
const h2Style: React.CSSProperties = { fontFamily: '"Barlow Condensed", sans-serif', fontSize: '14px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }
const btnPrimary: React.CSSProperties = { padding: '10px 20px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const btnSecondary: React.CSSProperties = { ...btnPrimary, background: '#242424', border: '1px solid #3a3a3a', color: '#d4cfc9' }
const subLabel: React.CSSProperties = { fontSize: '11px', color: '#cce0f5', fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }

export default function PortraitResizerPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadedImageRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [origDims, setOrigDims] = useState<{ w: number; h: number } | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [fileSizeKB, setFileSizeKB] = useState<number>(0)
  const [quality, setQuality] = useState<number>(0.85)
  const [showCircleOverlay, setShowCircleOverlay] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  // When quality changes and we already have an image loaded, re-process
  useEffect(() => {
    if (loadedImageRef.current) processImage(loadedImageRef.current, quality)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality])

  function processImage(img: HTMLImageElement, q: number) {
    try {
      const srcSize = Math.min(img.width, img.height)
      const sx = (img.width - srcSize) / 2
      const sy = (img.height - srcSize) / 2
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) { setError('Canvas not supported in this browser.'); return }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      canvas.toBlob(blob => {
        if (blob) setFileSizeKB(Math.round((blob.size / 1024) * 10) / 10)
      }, 'image/jpeg', q)
      setOutputUrl(canvas.toDataURL('image/jpeg', q))
      setError(null)
    } catch (err: any) {
      setError(`Failed to process image: ${err?.message ?? 'unknown error'}`)
    }
  }

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
      processImage(img, quality)
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
    // Reset so choosing the same file again re-triggers onChange
    e.target.value = ''
  }

  function reset() {
    loadedImageRef.current = null
    setFileName(null)
    setOrigDims(null)
    setOutputUrl(null)
    setFileSizeKB(0)
    setError(null)
    setQuality(0.85)
  }

  const downloadName = fileName
    ? `${fileName.replace(/\.[^/.]+$/, '')}-256.jpg`
    : 'portrait-256.jpg'

  return (
    <div>
      <h1 style={h1Style}>Portrait Resizer</h1>
      <div style={{ color: '#cce0f5', fontSize: '14px', marginBottom: '1.5rem', fontFamily: 'Barlow, sans-serif' }}>
        Drop any image and export it as a 256×256 JPEG — ready for the NPC portrait bank.
        Non-square images are center-cropped automatically.
      </div>

      {/* Drop zone / file picker */}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ ...panel, background: '#2a1210', border: '1px solid #c0392b', color: '#f5a89a', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Output + controls */}
      {outputUrl && origDims && (
        <>
          <div style={panel}>
            <div style={h2Style}>Previews</div>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* 256×256 with optional circle overlay */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative', width: '256px', height: '256px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={outputUrl} alt="256 preview" width={256} height={256} style={{ display: 'block', borderRadius: '2px' }} />
                  {showCircleOverlay && (
                    <svg width={256} height={256} viewBox="0 0 256 256" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      <defs>
                        <mask id="circle-mask">
                          <rect x={0} y={0} width={256} height={256} fill="white" />
                          <circle cx={128} cy={128} r={128} fill="black" />
                        </mask>
                      </defs>
                      <rect x={0} y={0} width={256} height={256} fill="black" fillOpacity={0.5} mask="url(#circle-mask)" />
                      <circle cx={128} cy={128} r={128} fill="none" stroke="#c0392b" strokeWidth={2} strokeDasharray="6 4" />
                    </svg>
                  )}
                </div>
                <div style={subLabel}>256 × 256 (download)</div>
              </div>
              {/* 56px roster thumb */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outputUrl} alt="56 preview" width={56} height={56} style={{ display: 'block', borderRadius: '50%', border: '2px solid #c0392b' }} />
                <div style={subLabel}>56px (roster)</div>
              </div>
              {/* 32px tactical token */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outputUrl} alt="32 preview" width={32} height={32} style={{ display: 'block', borderRadius: '50%', border: '1.5px solid #f5f2ee' }} />
                <div style={subLabel}>32px (token)</div>
              </div>
            </div>

            {/* Circle overlay toggle */}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '1rem', cursor: 'pointer', fontSize: '13px', color: '#cce0f5' }}>
              <input type="checkbox" checked={showCircleOverlay} onChange={e => setShowCircleOverlay(e.target.checked)} style={{ accentColor: '#c0392b' }} />
              Show circle overlay (token clip area)
            </label>
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
            <a href={outputUrl} download={downloadName} style={btnPrimary}>⬇ Download {downloadName}</a>
            <button type="button" onClick={reset} style={btnSecondary}>Process Another</button>
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
