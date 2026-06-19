'use client'
import { useEffect, useRef, useState } from 'react'

// In-tab floating, draggable, always-on-top (within the browser tab) host for
// the scene-controls UI. Replaces the old separate browser WINDOW popout, which
// kept getting buried behind the main window and can't be pinned on top from
// web code (browsers don't expose always-on-top to a page). It hosts the SAME
// /scene-controls-popout page in a same-origin <iframe>, so every control keeps
// working UNCHANGED through the existing BroadcastChannel scene-controls bus -
// BroadcastChannel is shared across same-origin iframe + parent exactly like it
// was across the two windows. Swapping the container is the whole change.
// Keep the draggable titlebar clear of the table-page header (which is tall and
// sits at a high z-index) so the panel can never be dragged behind it and lost.
const HEADER_SAFE = 64

export default function MapSetupPanel({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const STORAGE_KEY = `mapsetup_panel_pos_${campaignId}`
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 12, y: HEADER_SAFE + 8 })

  function clampX(x: number) {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    return Math.max(0, Math.min(x, w - 60))
  }
  function clampY(y: number) {
    const h = typeof window !== 'undefined' ? window.innerHeight : 800
    // Floor at HEADER_SAFE so the titlebar always stays below the header.
    return Math.max(HEADER_SAFE, Math.min(y, h - 40))
  }

  // Restore the saved position (clamped so a stale value can't open off-screen).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (typeof p?.x === 'number' && typeof p?.y === 'number') setPos({ x: clampX(p.x), y: clampY(p.y) })
      }
    } catch { /* ignore bad json */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drag via the titlebar. Listeners are attached on mousedown and torn down on
  // mouseup, so there's no always-on window listener; the closure captures the
  // position at grab time, then the final spot is persisted to localStorage.
  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const origin = pos
    function onMove(ev: MouseEvent) {
      setPos({ x: clampX(origin.x + (ev.clientX - startX)), y: clampY(origin.y + (ev.clientY - startY)) })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setPos(p => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch { /* ignore */ } ; return p })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} style={{
      // Above the table-page header (zIndex 10001) so the titlebar is always
      // visible + grabbable; below the GM dropdown menus (10050+).
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 10002, width: '284px',
      background: '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '6px',
      boxShadow: '0 8px 28px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div onMouseDown={startDrag} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', background: '#1a1a1a', borderBottom: '1px solid #2e2e2e',
        cursor: 'move', userSelect: 'none',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
          &#x283f; Map Setup
        </span>
        <button onClick={onClose} title="Close" aria-label="Close Map Setup" style={{
          background: 'transparent', border: 'none', color: '#f5f2ee', fontSize: '16px',
          lineHeight: 1, cursor: 'pointer', padding: '0 4px',
        }}>&times;</button>
      </div>
      <iframe
        src={`/scene-controls-popout?c=${campaignId}`}
        title="Map Setup"
        style={{ width: '100%', height: '70vh', maxHeight: '640px', border: 'none', background: '#0f0f0f', display: 'block' }}
      />
    </div>
  )
}
