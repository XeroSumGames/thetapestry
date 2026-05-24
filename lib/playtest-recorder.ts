// Playtest "tivo" - in-memory ring buffer of UI events the GM can dump to
// JSON when something goes weird. Always-on (cost is one click listener +
// a 2000-entry array) so we never miss a moment by forgetting to flip a flag.
//
// Captured: clicks, route changes, window errors, unhandled rejections,
// console.error/warn, manual marks. NEVER captures input values, cookies,
// localStorage contents, or auth tokens - see redact() below.

// Sized for a full 3-hour playtest (180 min). At a moderate ~50 events/min
// (active combat is denser, idle stretches are sparser), 3h ≈ 9000 events;
// 20000 gives ~2x headroom for stretches of click-heavy tactical work plus
// the diagnostic console.warns. Memory cost is ~4MB worst case.
const MAX_EVENTS = 20000
const STORAGE_KEY = 'tapestry_playtest_buffer'
// Per-campaign persisted enabled flag. Survives refresh / back-nav /
// tab-close so a GM-cascade Record toggle restores capture on the
// next /table mount without user action. Key shape:
//   tapestry_recorder_enabled_<campaignId> = '1' | (absent)
const ENABLED_KEY_PREFIX = 'tapestry_recorder_enabled_'
// Min ms between localStorage writes - protects against jank if something
// throws/marks in a tight loop (each persist is a sync JSON.stringify of
// up to PERSIST_BACKUP_COUNT events).
const PERSIST_THROTTLE_MS = 2000
// How many trailing events to back up to localStorage on each persist.
// Sized larger than the old 500 so a crash mid-3h session loses less
// context. Still bounded so the persist itself stays cheap.
const PERSIST_BACKUP_COUNT = 5000
// Periodic flush interval. Even with no errors or marks, we want the
// recent buffer mirrored to localStorage so a browser crash doesn't lose
// the whole session.
const PERIODIC_FLUSH_MS = 60_000
let lastPersistMs = 0
let periodicFlushTimer: ReturnType<typeof setInterval> | null = null

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
  // Tab-local capture flag. Defaults to false at page mount; the
  // table-page Record button's setEnabled(true) is the only thing
  // that flips it on. record() early-returns when false, so unless
  // THIS tab has clicked Record, no events accumulate.
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

// Toggle the recorder's enabled flag for THIS tab. Tab-local: no DB
// write, no cross-tab effect. Fires a window event so PlaytestRecorder
// can sync its corner-dot visibility. Does NOT wipe the buffer or
// trigger a download - those are explicit calls owned by the caller
// (the table-page Record button handles both).
export function setEnabled(enabled: boolean) {
  const r = getRecorder()
  if (!r) return
  if (r.enabled === enabled) return
  r.enabled = enabled
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('tapestry-recorder-changed', { detail: { enabled } }))
    } catch { /* ignore - some envs lack CustomEvent */ }
  }
}

// Explicit buffer wipe. Called by the table-page Record button when
// transitioning OFF -> ON so the new session starts with a clean
// buffer (no events from before the click).
export function wipeBuffer() {
  const r = getRecorder()
  if (!r) return
  r.buffer.length = 0
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

// Best-effort persist of the trailing buffer to localStorage. Called by
// the periodic flush timer and by error/rejection/mark events in
// record(). Throttled to avoid main-thread jank under spam.
function persistTrailing(now: number) {
  const r = getRecorder()
  if (!r || !r.enabled) return
  if (now - lastPersistMs < PERSIST_THROTTLE_MS) return
  lastPersistMs = now
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r.buffer.slice(-PERSIST_BACKUP_COUNT)))
  } catch { /* quota / no storage */ }
}

// One-shot full flush of the trailing buffer to localStorage. Called
// on beforeunload (tab close / refresh / nav-away) so we lose ≤1
// event instead of up to PERIODIC_FLUSH_MS worth of trailing context.
// No throttle: the unload window is short and we want every last
// event we have.
export function flushAllNow() {
  const r = getRecorder()
  if (!r || !r.enabled) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r.buffer.slice(-PERSIST_BACKUP_COUNT)))
  } catch { /* quota / no storage */ }
}

// Per-campaign persisted-enabled accessors. Used by the table page
// to resume capture after refresh / back-nav and by the recorder
// broadcast handlers to propagate GM-cascade state to all subscribed
// tabs' localStorage. Safe to call SSR - returns false / no-ops.
export function readCampaignEnabled(campaignId: string): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(ENABLED_KEY_PREFIX + campaignId) === '1' } catch { return false }
}

export function writeCampaignEnabled(campaignId: string, enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (enabled) localStorage.setItem(ENABLED_KEY_PREFIX + campaignId, '1')
    else localStorage.removeItem(ENABLED_KEY_PREFIX + campaignId)
  } catch { /* quota / no storage */ }
}

// Start a periodic flush so a browser crash mid-session loses ≤60s of
// trailing context instead of everything since the last error/mark.
// Idempotent: if a timer is already running, this no-ops. PlaytestRecorder
// calls this once per mount.
export function startPeriodicFlush() {
  if (typeof window === 'undefined') return
  if (periodicFlushTimer != null) return
  periodicFlushTimer = setInterval(() => persistTrailing(Date.now()), PERIODIC_FLUSH_MS)
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
  // Tab-local gate (2026-05-15 rewrite): only capture when THIS tab's
  // Record button has been clicked ON. Per Xero: "the GM and the
  // players should ALL have a record button that ONLY records their
  // browser tab." Previous unconditional-capture model coupled every
  // tab to the global playtest_recorder_config flag, so any user's
  // /record toggle started/stopped capture across every connected
  // client. Trade-off: a player who forgets to hit Record loses any
  // pre-click context. That's the price of strict tab-isolation.
  if (!r.enabled) return
  const ev: PlaytestEvent = {
    t: new Date().toISOString(),
    ms: Date.now() - r.startedAt,
    kind,
    data: redact(data) as Record<string, unknown>,
  }
  r.buffer.push(ev)
  if (r.buffer.length > MAX_EVENTS) r.buffer.splice(0, r.buffer.length - MAX_EVENTS)
  // Persist to localStorage on errors and marks - cheap insurance against
  // refresh wiping the buffer right when something interesting happened.
  // The periodic flush (every 60s) covers the no-interesting-event case.
  if (kind === 'error' || kind === 'rejection' || kind === 'mark') {
    persistTrailing(Date.now())
  }
}

// Explicit diagnostic trace (grand re-architecture Phase 6, Xero's option B).
//
// Replaces the old pattern of `console.warn('[label] ...', data)` whose only
// purpose was to (a) leak to every player's console and (b) get scooped into
// the recorder buffer by the console monkey-patch. trace() captures the same
// telemetry EXPLICITLY into the buffer (kind 'custom', tagged with `label`)
// and echoes to the console ONLY in development - so prod consoles stay clean
// while the recorder dump keeps the diagnostic timeline. record() already
// no-ops unless THIS tab has the recorder enabled, so trace() is free when off.
export function trace(label: string, data?: Record<string, unknown>) {
  record('custom', { label, ...(data ?? {}) })
  // Echo to the console ONLY in local dev - never in prod (clean player
  // consoles) and never in test (no spam in the vitest run).
  if (process.env.NODE_ENV === 'development' && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    if (data !== undefined) console.log(`[${label}]`, data)
    else console.log(`[${label}]`)
  }
}

function dumpBuffer(): { meta: Record<string, unknown>; events: PlaytestEvent[] } | null {
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
