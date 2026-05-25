import { useCallback, useEffect, useRef, useState } from 'react'
import { centeredToolbarX } from './tactical-spawn'

type Pos = { x: number; y: number }

// Position state for the GM fog/lighting toolbar.
//
// Defaults to top-center, computed from the live bar + canvas width the
// first time the bar mounts (a hardcoded "center" pixel only looks
// centered on one screen width). This stops the toolbar sitting on top
// of the locked (1,1) token spawn and hiding the PCs' tokens behind it
// (playtest 2026-05-25). See centeredToolbarX in ./tactical-spawn for
// the geometry + history. Draggable and persisted per-campaign.
//
// A saved {8,8} is the OLD corner default - indistinguishable from
// "never moved" - so it does NOT count as a deliberate choice and gets
// re-centered. A genuine non-corner drag is respected. reset() snaps
// back to the computed center, not the corner.
export function useFogBarPosition(campaignId: string) {
  const hadSaved = useRef(false)
  const positioned = useRef(false)
  const defaultPos = useRef<Pos>({ x: 8, y: 8 })
  const nodeRef = useRef<HTMLDivElement | null>(null)

  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === 'undefined') return { x: 8, y: 8 }
    try {
      const saved = localStorage.getItem(`fog_bar_pos_${campaignId}`)
      if (saved) {
        const v = JSON.parse(saved)
        if (typeof v?.x === 'number' && typeof v?.y === 'number') {
          if (v.x !== 8 || v.y !== 8) hadSaved.current = true
          return v
        }
      }
    } catch {}
    return { x: 8, y: 8 }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(`fog_bar_pos_${campaignId}`, JSON.stringify(pos)) } catch {}
  }, [pos, campaignId])

  // Callback ref on the toolbar node: fires once on mount, the first
  // moment we can measure to center. 290 = room reserved for the
  // top-right zoom/Share-View cluster pinned at right:8.
  const setRef = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node
    if (!node || positioned.current) return
    const container = node.parentElement
    if (!container) return
    const barW = node.getBoundingClientRect().width
    const contW = container.getBoundingClientRect().width
    if (barW === 0 || contW === 0) return // not laid out yet
    const x = centeredToolbarX(contW, barW, 290)
    defaultPos.current = { x, y: 8 }
    positioned.current = true
    if (!hadSaved.current) setPos({ x, y: 8 })
  }, [])

  const reset = useCallback(() => setPos({ ...defaultPos.current }), [])
  const isMoved = pos.x !== defaultPos.current.x || pos.y !== defaultPos.current.y

  return { pos, setPos, setRef, nodeRef, reset, isMoved }
}
