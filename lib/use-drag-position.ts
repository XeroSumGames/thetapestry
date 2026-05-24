'use client'
// Shared draggable-panel position hook. Extracted from the inline ATTACK
// roll modal (app/stories/[id]/table/page.tsx) so every roll modal can be
// dragged with identical behavior. The drag handle element must be a direct
// child of the panel it moves - onHandleMouseDown reads e.currentTarget's
// parent as the panel and tracks it from there.
//
// Usage:
//   const { pos, onHandleMouseDown } = useDragPosition()
//   <div style={{ position: 'fixed', left: pos?.x ?? '50%', top: pos?.y ?? '50%',
//                 transform: pos ? 'none' : 'translate(-50%, -50%)' }}>
//     <div onMouseDown={onHandleMouseDown} /* drag handle strip */ />
//     ...
//   </div>

import { useRef, useState } from 'react'
import type React from 'react'

export interface DragPosition {
  x: number
  y: number
}

export function useDragPosition() {
  const [pos, setPos] = useState<DragPosition | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const onHandleMouseDown = (e: React.MouseEvent) => {
    const panel = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return { pos, setPos, onHandleMouseDown }
}
