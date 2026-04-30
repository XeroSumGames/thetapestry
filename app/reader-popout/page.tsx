'use client'
// Reader popout — page-flip UI for a campaign_pin's image attachments.
// Opened from the 📖 Read button on pins where reader_mode='comic'.
//
// Storage path: pin-attachments/{campaign_id}/{pin_id}/{filename}.
// Pages are filtered to image extensions and sorted natural-numerically
// so 1.jpg → 2.jpg → … → 10.jpg flips correctly without zero-padding.
//
// Route name ends in -popout so LayoutShell auto-hides the sidebar
// per the AGENTS.md FULL_WIDTH_PATTERN convention.

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'

// Force dynamic rendering. Same reasoning as /gm-screen — the page
// reaches into Supabase on mount, which can't run in a static
// prerender without env vars bound.
export const dynamic = 'force-dynamic'

type FitMode = 'height' | 'width'
type LayoutMode = 'single' | 'spread'

export default function ReaderPopoutPage() {
  const supabase = createClient()
  const params = useSearchParams()
  const pinId = params?.get('pin') ?? ''

  const [pinName, setPinName] = useState<string>('Reader')
  const [pages, setPages] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [fitMode, setFitMode] = useState<FitMode>('height')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showChrome, setShowChrome] = useState(true)

  // Auto-hide the toolbars after 2.5s of mouse idle. Keeps the screen
  // clean while reading; movement (or hover near the chrome) brings
  // them back.
  const idleTimerRef = useRef<any>(null)
  function bumpIdle() {
    setShowChrome(true)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setShowChrome(false), 2500)
  }

  useEffect(() => {
    if (!pinId) { setLoading(false); setError('Missing ?pin=<id>'); return }
    let cancelled = false
    ;(async () => {
      const { data: pinRow, error: pinErr } = await supabase
        .from('campaign_pins')
        .select('id, name, campaign_id, reader_mode')
        .eq('id', pinId)
        .maybeSingle()
      if (cancelled) return
      if (pinErr || !pinRow) {
        setError(pinErr?.message ?? 'Pin not found.')
        setLoading(false)
        return
      }
      const row = pinRow as any
      setPinName(row.name || 'Reader')
      const { data: files, error: listErr } = await supabase
        .storage.from('pin-attachments')
        .list(`${row.campaign_id}/${row.id}`)
      if (cancelled) return
      if (listErr) {
        setError(listErr.message)
        setLoading(false)
        return
      }
      const imageFiles = (files ?? [])
        .filter((f: any) => /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(f.name))
        .sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
      const urls = imageFiles.map((f: any) => {
        const { data: urlData } = supabase.storage
          .from('pin-attachments')
          .getPublicUrl(`${row.campaign_id}/${row.id}/${f.name}`)
        return urlData.publicUrl
      })
      setPages(urls)
      setLoading(false)
      bumpIdle()
    })()
    return () => { cancelled = true }
  }, [supabase, pinId])

  // Keyboard nav. Arrow keys + JK + Home/End + F (fullscreen) + Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      bumpIdle()
      if (e.key === 'ArrowRight' || e.key === 'j' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'PageUp') { e.preventDefault(); prev() }
      else if (e.key === 'Home') { e.preventDefault(); setPageIndex(0) }
      else if (e.key === 'End') { e.preventDefault(); setPageIndex(Math.max(0, pages.length - 1)) }
      else if (e.key === 'f' || e.key === 'F') { toggleFullscreen() }
      else if (e.key === 'Escape') { window.close() }
    }
    function onMove() { bumpIdle() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousemove', onMove)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length])

  function step(): number { return layoutMode === 'spread' ? 2 : 1 }
  function next() { setPageIndex(i => Math.min(pages.length - 1, i + step())) }
  function prev() { setPageIndex(i => Math.max(0, i - step())) }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  // Click the left half of the canvas to go back, right half to go
  // forward. Standard comic-reader convention.
  function onCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width / 2) prev(); else next()
  }

  if (loading) {
    return <div style={fullPage}>Loading…</div>
  }
  if (error) {
    return <div style={fullPage}>{error}</div>
  }
  if (pages.length === 0) {
    return <div style={fullPage}>No pages found. Upload images to this pin&apos;s attachments to populate the reader.</div>
  }

  const currentPages = layoutMode === 'spread'
    ? [pages[pageIndex], pages[pageIndex + 1]].filter(Boolean) as string[]
    : [pages[pageIndex]]

  const fitStyle: React.CSSProperties = fitMode === 'height'
    ? { height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }
    : { width: '100%', height: 'auto', maxHeight: '100%', objectFit: 'contain' }

  const totalPages = pages.length
  const displayingFrom = pageIndex + 1
  const displayingTo = Math.min(totalPages, pageIndex + step())

  const btnStyle: React.CSSProperties = {
    height: 28, padding: '0 12px', fontSize: 13, fontFamily: 'Carlito, sans-serif',
    background: 'rgba(20,20,20,0.85)', color: '#cce0f5', border: '1px solid #3a3a3a',
    borderRadius: 4, cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase',
  }
  const btnActive: React.CSSProperties = { ...btnStyle, background: '#22303d', color: '#7ab3d4', borderColor: '#4a6a8a' }

  return (
    <div style={{
      background: '#000', color: '#f5f2ee', height: '100vh', width: '100vw',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'Carlito, sans-serif',
    }}>
      {/* Top chrome */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0))',
        opacity: showChrome ? 1 : 0, transition: 'opacity 250ms',
        pointerEvents: showChrome ? 'auto' : 'none',
      }}>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', flex: 1, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          📖 {pinName}
        </span>
        <span style={{ fontSize: 13, color: '#cce0f5', letterSpacing: '.06em' }}>
          {layoutMode === 'spread' && displayingFrom !== displayingTo
            ? `${displayingFrom}–${displayingTo} / ${totalPages}`
            : `${displayingFrom} / ${totalPages}`}
        </span>
        <button onClick={() => setFitMode(m => m === 'height' ? 'width' : 'height')}
          style={btnStyle}
          title="Toggle fit">
          Fit: {fitMode === 'height' ? 'Height' : 'Width'}
        </button>
        <button onClick={() => setLayoutMode(m => m === 'single' ? 'spread' : 'single')}
          style={layoutMode === 'spread' ? btnActive : btnStyle}
          title="Single page or two-page spread">
          {layoutMode === 'spread' ? 'Spread' : 'Single'}
        </button>
        <button onClick={toggleFullscreen} style={btnStyle} title="Fullscreen (F)">⛶</button>
        <button onClick={() => window.close()} style={{ ...btnStyle, color: '#f5a89a', borderColor: '#7a1f16' }} title="Close (Esc)">✕</button>
      </div>

      {/* Page canvas — click left half = prev, right half = next */}
      <div onClick={onCanvasClick}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: layoutMode === 'spread' ? 4 : 0, padding: '8px 8px',
          cursor: 'pointer', userSelect: 'none', minHeight: 0,
        }}>
        {currentPages.map((url, i) => (
          <img key={i} src={url} alt={`page ${pageIndex + 1 + i}`} draggable={false}
            style={{ ...fitStyle, background: '#0a0a0a' }} />
        ))}
      </div>

      {/* Bottom chrome — page jump + nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))',
        opacity: showChrome ? 1 : 0, transition: 'opacity 250ms',
        pointerEvents: showChrome ? 'auto' : 'none',
      }}>
        <button onClick={prev} disabled={pageIndex === 0} style={{ ...btnStyle, opacity: pageIndex === 0 ? 0.4 : 1 }}>← Prev</button>
        <input type="range" min={0} max={Math.max(0, totalPages - 1)} value={pageIndex}
          onChange={e => setPageIndex(parseInt(e.target.value, 10))}
          style={{ width: 240, accentColor: '#7ab3d4' }}
          title="Jump to page" />
        <button onClick={next} disabled={pageIndex >= totalPages - step()} style={{ ...btnStyle, opacity: pageIndex >= totalPages - step() ? 0.4 : 1 }}>Next →</button>
      </div>
    </div>
  )
}

const fullPage: React.CSSProperties = {
  background: '#0d0d0d', color: '#cce0f5', height: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Carlito, sans-serif', fontSize: 14, padding: 20, textAlign: 'center',
}
