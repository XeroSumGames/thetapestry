// Playtest "tivo" — in-memory ring buffer of UI events the GM can dump to
// JSON when something goes weird. Always-on (cost is one click listener +
// a 2000-entry array) so we never miss a moment by forgetting to flip a flag.
//
// Captured: clicks, route changes, window errors, unhandled rejections,
// console.error/warn, manual marks. NEVER captures input values, cookies,
// localStorage contents, or auth tokens — see redact() below.

const MAX_EVENTS = 2000
const STORAGE_KEY = 'tapestry_playtest_buffer'
// Min ms between localStorage writes — protects against jank if something
// throws/marks in a tight loop (each persist is a sync JSON.stringify of
// up to 500 events).
const PERSIST_THROTTLE_MS = 2000
let lastPersistMs = 0

export type PlaytestEvent = {
  t: string            // ISO timestamp
  ms: number           // ms since recorder start (cheap timeline scrubbing)
  kind: 'click' | 'route' | 'error' | 'rejection' | 'console-error' | 'console-warn' | 'mark' | 'custom'
  data: Record<string, unknown>
}

type RecorderState = {
  buffer: PlaytestEvent[]
  startedAt: number
  userId: string | null
  userEmail: string | null
  sessionId: string
  pathname: string
  // Set by PlaytestRecorder once it has fetched playtest_recorder_config
  // and matched it against the current user. Defaults to TRUE so events
  // captured before the config fetch resolves aren't lost on tabs that
  // turn out to be enabled. If the fetch resolves to "off for me",
  // the buffer is wiped and `enabled` flips to false — record() drops
  // any subsequent events on the floor.
  enabled: boolean
}

declare global {
  interface Window {
    __tapestryRecorder?: RecorderState
    __tapestryMark?: (label: string, data?: Record<string, unknown>) => void
    __tapestryDump?: () => void
    __tapestryRecord?: (kind: PlaytestEvent['kind'], data: Record<string, unknown>) => void
  }
}

// Called by PlaytestRecorder after fetching playtest_recorder_config and
// deciding whether the current user is in scope. Wipes the buffer when
// transitioning to disabled so the dump can't surface events captured
// before the config check resolved.
export function setEnabled(enabled: boolean) {
  const r = getRecorder()
  if (!r) return
  if (r.enabled === enabled) return
  r.enabled = enabled
  if (!enabled) {
    r.buffer.length = 0
    try { localStorage.removeItem('tapestry_playtest_buffer') } catch {}
  }
}

export function getRecorder(): RecorderState | null {
  if (typeof window === 'undefined') return null
  return window.__tapestryRecorder ?? null
}

// Truncate big strings, drop anything that smells like a token or password.
function redact(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[deep]'
  if (value == null) return value
  if (typeof value === 'string') {
    if (value.length > 500) return value.slice(0, 500) + `…(+${value.length - 500} chars)`
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase()
      if (lower.includes('password') || lower.includes('token') || lower === 'authorization' || lower === 'cookie') {
        out[k] = '[redacted]'
        continue
      }
      out[k] = redact(v, depth + 1)
    }
    return out
  }
  return String(value)
}

export function record(kind: PlaytestEvent['kind'], data: Record<string, unknown>) {
  const r = getRecorder()
  if (!r) return
  if (!r.enabled) return
  const ev: PlaytestEvent = {
    t: new Date().toISOString(),
    ms: Date.now() - r.startedAt,
    kind,
    data: redact(data) as Record<string, unknown>,
  }
  r.buffer.push(ev)
  if (r.buffer.length > MAX_EVENTS) r.buffer.splice(0, r.buffer.length - MAX_EVENTS)
  // Persist to localStorage on errors and marks — cheap insurance against
  // refresh wiping the buffer right when something interesting happened.
  // Throttled so a runaway error loop can't pin the main thread.
  if (kind === 'error' || kind === 'rejection' || kind === 'mark') {
    const now = Date.now()
    if (now - lastPersistMs >= PERSIST_THROTTLE_MS) {
      lastPersistMs = now
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r.buffer.slice(-500))) } catch {}
    }
  }
}

export function dumpBuffer(): { meta: Record<string, unknown>; events: PlaytestEvent[] } | null {
  const r = getRecorder()
  if (!r) return null
  return {
    meta: {
      dumped_at: new Date().toISOString(),
      started_at: new Date(r.startedAt).toISOString(),
      duration_ms: Date.now() - r.startedAt,
      session_id: r.sessionId,
      user_id: r.userId,
      user_email: r.userEmail,
      user_agent: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      pathname: r.pathname,
      event_count: r.buffer.length,
      app_version: 'playtest-2026-05-04',
    },
    events: [...r.buffer],
  }
}

export function downloadDump(): string | null {
  const dump = dumpBuffer()
  if (!dump) return null
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const who = (dump.meta.user_email as string | null)?.split('@')[0] || 'anon'
  const name = `playtest-${who}-${stamp}.json`
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return name
}
