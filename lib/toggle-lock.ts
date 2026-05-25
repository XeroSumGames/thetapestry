// toggle-lock.ts
// A tiny time-based lock to debounce rapid re-clicks of a toggle keyed by
// id. claimToggleLock(key) returns true the first time and locks that key
// for `ms`; further calls within the window return false. Used by the
// player-bar Map toggle so a 2nd click (before the place/remove + token
// refresh settle) can't flip a just-added token straight back off
// (playtest 2026-05-25 "can't add some players to the map").

const locks = new Map<string, number>()

export function claimToggleLock(key: string, ms = 800, now = Date.now()): boolean {
  if (now < (locks.get(key) ?? 0)) return false
  locks.set(key, now + ms)
  return true
}

// Test seam: drop all locks (so a test run doesn't leak state across cases).
export function _resetToggleLocks(): void {
  locks.clear()
}
