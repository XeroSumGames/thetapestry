// Tracks popout positions per unique window name so repeated opens of the
// same popout land in the same slot, and new ones cascade to the next slot.
const positions = new Map<string, { x: number; y: number }>()

const INITIAL = { x: -1798, y: 0, w: 571, h: 257 }

export function openPopout(url: string, name: string): Window | null {
  let pos = positions.get(name)
  if (!pos) {
    pos = { x: INITIAL.x, y: INITIAL.y + positions.size * INITIAL.h }
    positions.set(name, pos)
  }
  const features = `width=${INITIAL.w},height=${INITIAL.h},left=${pos.x},top=${pos.y},menubar=no,toolbar=no`
  return window.open(url, name, features)
}
