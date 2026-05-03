'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'

const OUTPUT_SIZE = 256
const DISPLAY_MAX = 500 // max width/height of the source preview
type Gender = 'man' | 'woman'
function pad3(n: number) { return String(n).padStart(3, '0') }

// ── Styling helpers (inline, matching the codebase pattern) ──
const panel: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', marginBottom: '1rem' }
const h1Style: React.CSSProperties = { fontFamily: '"Carlito", sans-serif', fontSize: '2rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px', borderBottom: '1px solid #c0392b', paddingBottom: '10px' }
const h2Style: React.CSSProperties = { fontFamily: '"Carlito", sans-serif', fontSize: '14px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }
const btnPrimary: React.CSSProperties = { padding: '10px 20px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: '"Carlito", sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const btnSecondary: React.CSSProperties = { ...btnPrimary, background: '#242424', border: '1px solid #3a3a3a', color: '#d4cfc9' }
const subLabel: React.CSSProperties = { fontSize: '13px', color: '#cce0f5', fontFamily: '"Carlito", sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }

interface Circle { cx: number; cy: number; r: number } // in display coords

// Each successful batch upload, kept around so the user can re-crop
// any that auto-center missed. Holds the source File for re-processing
// + the storage paths so re-uploads overwrite in place (same URL,
// no counter bump, no new portrait_bank row).
interface BatchEntry {
  id: string
  file: File
  fileName: string
  number: number
  gender: Gender
  paths: { p256: string; p56: string; p32: string }
  previewUrl: string // ObjectURL — revoked when replaced or on unmount
}

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
  const [imgSrc, setImgSrc] = useState<string | null>(null) // data URL — survives re-renders
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle')
  // Batch mode — multi-file upload that auto-centers the crop circle
  // (radius = min(w, h) / 2) and uploads each file in sequence. Faster
  // than the single-image flow when seeding a setting bank from a
  // folder of cleanly-cropped portraits. For images that need a custom
  // crop, the GM still uses the single-image flow.
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; current: string }>({ done: 0, total: 0, current: '' })
  const [batchResults, setBatchResults] = useState<{ ok: number; failed: { name: string; error: string }[] }>({ ok: 0, failed: [] })
  // Successful batch uploads — rendered as a thumbnail grid below the
  // batch panel so the user can spot any that auto-center cropped
  // poorly and re-do them via the single-image editor.
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([])
  // When set, the single-image editor is in re-crop mode for this
  // entry. Save writes back to entry.paths instead of incrementing
  // the counter; metadata row stays put.
  const [recropTarget, setRecropTarget] = useState<BatchEntry | null>(null)
  // Thriver-only gate. The tool uploads into the public portrait-bank
  // bucket + bumps platform-wide counters, so signed-in randos
  // shouldn't be able to add or replace official portraits.
  const [authChecked, setAuthChecked] = useState(false)
  const [isThriver, setIsThriver] = useState(false)
  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { setAuthChecked(true); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setIsThriver((profile?.role ?? '').toString().toLowerCase() === 'thriver')
      setAuthChecked(true)
    })()
  }, [supabase])

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
    // Read as data URL so the source image stays available for both the <img> tag and canvas processing
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        loadedImageRef.current = img
        setImgSrc(dataUrl)
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
      }
      img.onerror = () => setError('Failed to load this image. It may be corrupt or an unsupported format.')
      img.src = dataUrl
    }
    reader.onerror = () => setError('Failed to read this file.')
    reader.readAsDataURL(file)
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
    setImgSrc(null)
    setFileName(null)
    setOrigDims(null)
    setDisplayDims(null)
    setCircle(null)
    setOutputUrl(null)
    setFileSizeKB(0)
    setError(null)
    setQuality(0.85)
    setRecropTarget(null)
  }

  const nextNumber = counts[gender] + 1
  const genderLabel = gender === 'man' ? 'MAN' : 'WOMAN'
  const nextDownloadName = `NPC-${genderLabel}-${pad3(nextNumber)}.jpg`

  async function renderCanvasAt(size: number): Promise<Blob | null> {
    const img = loadedImageRef.current
    if (!img || !circle || !displayDims || !origDims) return null
    const scale = origDims.w / displayDims.w
    const sx = (circle.cx - circle.r) * scale
    const sy = (circle.cy - circle.r) * scale
    const sSize = circle.r * 2 * scale
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size)
    return await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', quality))
  }

  async function handleDownload() {
    if (!outputUrl) return
    setUploadStatus('uploading')

    // 1. Atomic counter increment — gets our unique number
    const { data, error: rpcErr } = await supabase.rpc('increment_portrait_counter', { g: gender })
    if (rpcErr) { setError(`Counter error: ${rpcErr.message}`); setUploadStatus('idle'); return }
    const n: number = typeof data === 'number' ? data : nextNumber
    const base = `NPC-${genderLabel}-${pad3(n)}`
    const filename256 = `${base}.jpg`
    setCounts(prev => ({ ...prev, [gender]: n }))

    // 2. Render 3 sizes
    const [blob256, blob56, blob32] = await Promise.all([
      renderCanvasAt(256),
      renderCanvasAt(56),
      renderCanvasAt(32),
    ])
    if (!blob256 || !blob56 || !blob32) { setError('Failed to render one or more sizes.'); setUploadStatus('idle'); return }

    // 3. Upload to portrait-bank bucket
    try {
      const path256 = `${gender}/256/${filename256}`
      const path56 = `${gender}/56/${base}.jpg`
      const path32 = `${gender}/32/${base}.jpg`
      const uploads = await Promise.all([
        supabase.storage.from('portrait-bank').upload(path256, blob256, { contentType: 'image/jpeg', upsert: true }),
        supabase.storage.from('portrait-bank').upload(path56, blob56, { contentType: 'image/jpeg', upsert: true }),
        supabase.storage.from('portrait-bank').upload(path32, blob32, { contentType: 'image/jpeg', upsert: true }),
      ])
      const upErr = uploads.find(u => u.error)
      if (upErr?.error) { setError(`Upload failed: ${upErr.error.message}`); setUploadStatus('idle'); return }
      const url256 = supabase.storage.from('portrait-bank').getPublicUrl(path256).data.publicUrl
      const url56 = supabase.storage.from('portrait-bank').getPublicUrl(path56).data.publicUrl
      const url32 = supabase.storage.from('portrait-bank').getPublicUrl(path32).data.publicUrl

      // 4. Insert metadata row
      const { error: insErr } = await supabase.from('portrait_bank').insert({
        number: n, gender, url_256: url256, url_56: url56, url_32: url32,
      })
      if (insErr) { setError(`Metadata insert failed: ${insErr.message}`); setUploadStatus('idle'); return }
    } catch (err: any) {
      setError(`Upload error: ${err?.message ?? 'unknown'}`); setUploadStatus('idle'); return
    }

    // 5. Trigger local download of the 256 version
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = filename256
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    setUploadStatus('success')
    setTimeout(() => setUploadStatus('idle'), 2500)
  }

  // Re-crop an existing batch entry. Loads the original file into the
  // editor + flips on re-crop mode so Save overwrites at the entry's
  // storage paths instead of incrementing the counter.
  function startRecrop(entry: BatchEntry) {
    setRecropTarget(entry)
    handleFile(entry.file)
    // Scroll the editor into view — it renders far below the batch
    // panel once an image is loaded.
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  async function handleSaveRecrop() {
    if (!recropTarget) return
    setUploadStatus('uploading')
    try {
      const [b256, b56, b32] = await Promise.all([
        renderCanvasAt(256), renderCanvasAt(56), renderCanvasAt(32),
      ])
      if (!b256 || !b56 || !b32) { setError('Failed to render one or more sizes.'); setUploadStatus('idle'); return }
      const ups = await Promise.all([
        supabase.storage.from('portrait-bank').upload(recropTarget.paths.p256, b256, { contentType: 'image/jpeg', upsert: true }),
        supabase.storage.from('portrait-bank').upload(recropTarget.paths.p56, b56, { contentType: 'image/jpeg', upsert: true }),
        supabase.storage.from('portrait-bank').upload(recropTarget.paths.p32, b32, { contentType: 'image/jpeg', upsert: true }),
      ])
      const upErr = ups.find(u => u.error)
      if (upErr?.error) { setError(`Re-upload failed: ${upErr.error.message}`); setUploadStatus('idle'); return }
      // Swap the thumbnail's ObjectURL — old one is no longer used.
      const newPreview = URL.createObjectURL(b256)
      setBatchEntries(prev => prev.map(e => {
        if (e.id !== recropTarget.id) return e
        URL.revokeObjectURL(e.previewUrl)
        return { ...e, previewUrl: newPreview }
      }))
      setUploadStatus('success')
      setTimeout(() => setUploadStatus('idle'), 2500)
      // Close the editor + clear re-crop intent.
      setRecropTarget(null)
      reset()
    } catch (err: any) {
      setError(`Re-upload error: ${err?.message ?? 'unknown'}`); setUploadStatus('idle')
    }
  }

  // Revoke any outstanding ObjectURLs on unmount so the browser can
  // free the underlying Blobs.
  useEffect(() => {
    return () => {
      batchEntries.forEach(e => URL.revokeObjectURL(e.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render an image to a square JPEG blob using a centered, max-radius
  // circle crop. Used by the batch mode where there's no draggable
  // crop UI — the input image is assumed to already be roughly
  // portrait-shaped and the auto-center is good enough.
  async function renderAutoCircle(img: HTMLImageElement, size: number): Promise<Blob | null> {
    const r = Math.min(img.width, img.height) / 2
    const cx = img.width / 2
    const cy = img.height / 2
    const sx = cx - r
    const sy = cy - r
    const sSize = r * 2
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size)
    return new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.85))
  }

  function loadFileAsImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Image decode failed'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('File read failed'))
      reader.readAsDataURL(file)
    })
  }

  async function handleBatch(files: FileList) {
    if (batchRunning || files.length === 0) return
    setBatchRunning(true)
    setBatchResults({ ok: 0, failed: [] })
    setBatchProgress({ done: 0, total: files.length, current: '' })
    const results: { ok: number; failed: { name: string; error: string }[] } = { ok: 0, failed: [] }
    const list = Array.from(files)
    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      setBatchProgress({ done: i, total: list.length, current: file.name })
      try {
        if (!file.type.startsWith('image/')) {
          results.failed.push({ name: file.name, error: 'Not an image' })
          continue
        }
        const img = await loadFileAsImage(file)
        const [b256, b56, b32] = await Promise.all([
          renderAutoCircle(img, 256),
          renderAutoCircle(img, 56),
          renderAutoCircle(img, 32),
        ])
        if (!b256 || !b56 || !b32) {
          results.failed.push({ name: file.name, error: 'Canvas render failed' })
          continue
        }
        const { data: nData, error: rpcErr } = await supabase.rpc('increment_portrait_counter', { g: gender })
        if (rpcErr) {
          results.failed.push({ name: file.name, error: `Counter: ${rpcErr.message}` })
          continue
        }
        const n: number = typeof nData === 'number' ? nData : 0
        const base = `NPC-${gender === 'man' ? 'MAN' : 'WOMAN'}-${pad3(n)}`
        const path256 = `${gender}/256/${base}.jpg`
        const path56 = `${gender}/56/${base}.jpg`
        const path32 = `${gender}/32/${base}.jpg`
        const ups = await Promise.all([
          supabase.storage.from('portrait-bank').upload(path256, b256, { contentType: 'image/jpeg', upsert: true }),
          supabase.storage.from('portrait-bank').upload(path56, b56, { contentType: 'image/jpeg', upsert: true }),
          supabase.storage.from('portrait-bank').upload(path32, b32, { contentType: 'image/jpeg', upsert: true }),
        ])
        const upErr = ups.find(u => u.error)
        if (upErr?.error) {
          results.failed.push({ name: file.name, error: `Upload: ${upErr.error.message}` })
          continue
        }
        const url256 = supabase.storage.from('portrait-bank').getPublicUrl(path256).data.publicUrl
        const url56 = supabase.storage.from('portrait-bank').getPublicUrl(path56).data.publicUrl
        const url32 = supabase.storage.from('portrait-bank').getPublicUrl(path32).data.publicUrl
        const { error: insErr } = await supabase.from('portrait_bank').insert({
          number: n, gender, url_256: url256, url_56: url56, url_32: url32,
        })
        if (insErr) {
          results.failed.push({ name: file.name, error: `Metadata: ${insErr.message}` })
          continue
        }
        results.ok++
        setCounts(prev => ({ ...prev, [gender]: n }))
        // Stash the entry so it shows up in the re-crop grid. Use the
        // 256 blob as the thumbnail source (cheap ObjectURL — revoked
        // when the entry is re-cropped or the component unmounts).
        const entry: BatchEntry = {
          id: `${gender}-${n}`,
          file,
          fileName: file.name,
          number: n,
          gender,
          paths: { p256: path256, p56: path56, p32: path32 },
          previewUrl: URL.createObjectURL(b256),
        }
        setBatchEntries(prev => [...prev, entry])
      } catch (err: any) {
        results.failed.push({ name: file.name, error: err?.message ?? 'unknown' })
      }
      setBatchResults({ ...results })
    }
    setBatchProgress({ done: list.length, total: list.length, current: '' })
    setBatchResults(results)
    setBatchRunning(false)
  }

  if (!authChecked) return null
  if (!isThriver) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#cce0f5', textAlign: 'center' }}>
      Thriver access only.
    </div>
  )

  return (
    <div>
      <h1 style={h1Style}>Portrait Resizer</h1>
      <div style={{ color: '#cce0f5', fontSize: '14px', marginBottom: '1.5rem', fontFamily: 'Barlow, sans-serif' }}>
        Drop any image and export it as a 256×256 JPEG — ready for the NPC portrait bank.
        Drag the circle to choose what gets captured, or resize it to zoom.
      </div>

      {/* Batch upload — multi-file picker that auto-centers the crop
          circle and uploads each file in sequence. Use this for cleanly-
          cropped portrait sets where the auto-center is good enough.
          Single-image flow below is still the right tool when each
          image needs a custom crop. */}
      <div style={{ ...panel, background: '#1a1a2e', border: '1px solid #2e2e5a' }}>
        <div style={h2Style}>Batch Upload (auto-center crop)</div>
        <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '8px', fontFamily: 'Barlow, sans-serif' }}>
          Pick multiple images at once. Each is auto-cropped to a centered max-radius circle, rendered at 256/56/32 px, and uploaded as <strong style={{ color: '#7ab3d4' }}>{gender === 'man' ? 'Male' : 'Female'}</strong> portraits in sequence. Switch the gender pill below before starting.
        </div>
        <input
          type="file" accept="image/*" multiple disabled={batchRunning}
          onChange={e => { const files = e.target.files; if (files && files.length > 0) handleBatch(files); e.target.value = '' }}
          style={{ fontFamily: 'Barlow, sans-serif', fontSize: '13px', color: '#d4cfc9' }}
        />
        {batchRunning && (
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#7ab3d4', fontFamily: 'Carlito, sans-serif' }}>
            Processing {batchProgress.done + 1} / {batchProgress.total} — {batchProgress.current}
          </div>
        )}
        {!batchRunning && (batchResults.ok > 0 || batchResults.failed.length > 0) && (
          <div style={{ marginTop: '10px', fontSize: '13px', color: batchResults.failed.length === 0 ? '#7fc458' : '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            ✓ {batchResults.ok} uploaded · ✗ {batchResults.failed.length} failed
            {batchResults.failed.length > 0 && (
              <pre style={{ marginTop: '6px', fontSize: '13px', color: '#f5a89a', fontFamily: 'monospace', textTransform: 'none', letterSpacing: 0, whiteSpace: 'pre-wrap' }}>
                {batchResults.failed.map(f => `${f.name}: ${f.error}`).join('\n')}
              </pre>
            )}
          </div>
        )}

        {/* Re-crop grid — every successful batch upload renders here so
            the user can spot any auto-center misses and fix them. Click
            Re-crop to load the source file into the editor below in
            re-crop mode (Save overwrites the existing storage paths
            instead of incrementing the counter). */}
        {batchEntries.length > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #2e2e5a' }}>
            <div style={{ ...subLabel, marginBottom: '8px' }}>Uploaded — click Re-crop to fix any that auto-center missed</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
              {batchEntries.map(entry => {
                const active = recropTarget?.id === entry.id
                return (
                  <div key={entry.id}
                    style={{ background: '#0a0a0a', border: `1px solid ${active ? '#c0392b' : '#2e2e2e'}`, borderRadius: '3px', padding: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.previewUrl} alt={entry.fileName}
                      width={104} height={104}
                      style={{ display: 'block', borderRadius: '50%', border: `2px solid ${active ? '#c0392b' : '#3a3a3a'}` }} />
                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '108px' }}>
                      NPC-{entry.gender === 'man' ? 'MAN' : 'WOMAN'}-{pad3(entry.number)}
                    </div>
                    <button type="button" onClick={() => startRecrop(entry)} disabled={batchRunning || uploadStatus === 'uploading'}
                      style={{ ...btnSecondary, padding: '4px 10px', fontSize: '13px', width: '100%', cursor: batchRunning || uploadStatus === 'uploading' ? 'not-allowed' : 'pointer', opacity: batchRunning || uploadStatus === 'uploading' ? 0.5 : 1 }}>
                      {active ? '✎ Editing…' : '✎ Re-crop'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
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
          <div style={{ fontFamily: '"Carlito", sans-serif', fontSize: '18px', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: isDragging ? '#c0392b' : '#f5f2ee' }}>
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
                    <div style={{ fontFamily: '"Carlito", sans-serif', fontSize: '15px', color: '#f5f2ee', minWidth: '48px', textAlign: 'right' }}>
                      {Math.round(circle.r * 2)}px
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '4px' }}>
                    Source area: {Math.round((circle.r * 2 * origDims.w) / displayDims.w)}px
                  </div>
                </div>

                <button type="button" onClick={recenterCircle} style={{ ...btnSecondary, padding: '6px 14px', fontSize: '13px', marginBottom: '1rem' }}>
                  Recenter / maximize
                </button>

                <div style={{ fontSize: '13px', color: '#cce0f5', lineHeight: 1.5 }}>
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
              <div style={{ fontFamily: '"Carlito", sans-serif', fontSize: '18px', fontWeight: 700, color: '#f5f2ee', minWidth: '48px', textAlign: 'right' }}>
                {quality.toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <div style={subLabel}>Original</div>
                <div style={{ fontFamily: '"Carlito", sans-serif', fontSize: '16px', color: '#f5f2ee' }}>{origDims.w} × {origDims.h}</div>
              </div>
              <div>
                <div style={subLabel}>Output</div>
                <div style={{ fontFamily: '"Carlito", sans-serif', fontSize: '16px', color: '#f5f2ee' }}>256 × 256</div>
              </div>
              <div>
                <div style={subLabel}>File size</div>
                <div style={{ fontFamily: '"Carlito", sans-serif', fontSize: '16px', color: '#7fc458' }}>{fileSizeKB} KB</div>
              </div>
            </div>
          </div>

          {/* Re-crop banner — when the editor is in re-crop mode for a
              batch entry, the gender toggle is suppressed (gender is
              fixed by the entry) and the action button overwrites the
              existing storage paths. */}
          {recropTarget && (
            <div style={{ ...panel, background: '#2a1210', border: '1px solid #c0392b' }}>
              <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                ✎ Re-crop mode — overwriting NPC-{recropTarget.gender === 'man' ? 'MAN' : 'WOMAN'}-{pad3(recropTarget.number)}
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button type="button" onClick={handleSaveRecrop} disabled={uploadStatus === 'uploading'}
                  style={{ ...btnPrimary, opacity: uploadStatus === 'uploading' ? 0.6 : 1, cursor: uploadStatus === 'uploading' ? 'wait' : 'pointer' }}>
                  {uploadStatus === 'uploading' ? '⏳ Saving…' : '💾 Save Crop (overwrite)'}
                </button>
                <button type="button" onClick={reset} style={btnSecondary}>Cancel</button>
                {uploadStatus === 'success' && (
                  <span style={{ color: '#7fc458', fontSize: '13px', fontFamily: '"Carlito", sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>✓ Re-cropped</span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '8px' }}>
                Save replaces the 256/56/32 px files at the same storage paths. URL stays identical, no new portrait_bank row, no counter bump.
              </div>
            </div>
          )}

          {/* Gender toggle + actions — hidden in re-crop mode (the
              re-crop banner above owns the action surface). */}
          {!recropTarget && (
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
                      fontFamily: '"Carlito", sans-serif',
                      letterSpacing: '.08em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}>
                    {g === 'man' ? 'Male' : 'Female'}
                    <span style={{ fontSize: '13px', marginLeft: '8px', color: '#5a5550', fontWeight: 400 }}>{counts[g]} saved</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button type="button" onClick={handleDownload} disabled={uploadStatus === 'uploading'}
                style={{ ...btnPrimary, opacity: uploadStatus === 'uploading' ? 0.6 : 1, cursor: uploadStatus === 'uploading' ? 'wait' : 'pointer' }}>
                {uploadStatus === 'uploading' ? '⏳ Uploading...' : `⬇ Download ${nextDownloadName}`}
              </button>
              <button type="button" onClick={reset} style={btnSecondary}>Process Another</button>
              {uploadStatus === 'success' && (
                <span style={{ color: '#7fc458', fontSize: '13px', fontFamily: '"Carlito", sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>✓ Added to portrait bank</span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#5a5550', marginTop: '8px' }}>
              Each download uploads 256/56/32px versions to the shared portrait bank for random NPC assignment.
            </div>
          </div>
          )}
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
