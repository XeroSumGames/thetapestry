// Tracks popout positions per unique window name so reopening the same popout
// lands in the same slot, and new ones cascade into the next slot.
const positions = new Map<string, { x: number; y: number }>()

const BASE_X = -1798
const BASE_Y = 0
const SLOT_HEIGHT = 257

export type PopoutSize = { w: number; h: number }

export function openPopout(url: string, name: string, size: PopoutSize = { w: 571, h: 257 }): Window | null {
  let pos = positions.get(name)
  if (!pos) {
    pos = { x: BASE_X, y: BASE_Y + positions.size * SLOT_HEIGHT }
    positions.set(name, pos)
  }
  const features = `width=${size.w},height=${size.h},left=${pos.x},top=${pos.y},menubar=no,toolbar=no`
  return window.open(url, name, features)
}
