// debug_log — client-side telemetry for triaging perf / failures
// without screenshots.
//
// Captures:
//   - Manual: dlog.info / warn / error / perf events from app code
//   - window.onerror + unhandledrejection (auto)
//   - Fetch wrapper: 5xx + slow (>5s) + thrown failures (auto)
//   - Page-load timing on every navigation (auto, fired ~1s post-mount)
//
// Disable per-tab: localStorage.setItem('debug_log', '0') then refresh.
//
// Schema + triage queries: sql/debug-log.sql
//
// Designed to be non-invasive:
//   - Logs are batched (every 5s OR 50 entries) so we don't add a
//     round-trip per call site.
//   - DB writes go through a try/catch that swallows failures —
//     debug_log issues must NEVER cascade into user-visible errors.
//   - Self-aware: skips logging requests TO debug_log (would loop).
//   - Strips apikey query params from captured URLs (no secret leak).
//   - Truncates response bodies / stack traces to 500-1000 chars.

import { createClient } from './supabase-browser'
import { getCachedAuth } from './auth-cache'

type LogLevel = 'info' | 'warn' | 'error' | 'perf'

interface LogEntry {
  level: LogLevel
  event: string
  payload?: any
  url: string
  client_id: string
  created_at: string
}

const CLIENT_ID: string = (() => {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let id = sessionStorage.getItem('debug_log_client_id')
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem('debug_log_client_id', id)
    }
    return id
  } catch {
    return `tab-${Date.now()}`
  }
})()

let buffer: LogEntry[] = []
let flushTimer: any = null
let installed = false
let userId: string | null = null
let campaignId: string | null = null

const FLUSH_INTERVAL_MS = 5000
const FLUSH_THRESHOLD = 50

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('debug_log') !== '0'
  } catch {
    return false
  }
}

function urlPath(): string {
  if (typeof window === 'undefined') return ''
  try {
    return (window.location.pathname + window.location.search).replace(/[?&]apikey=[^&]+/, '').slice(0, 300)
  } catch {
    return ''
  }
}

function pushEntry(level: LogLevel, event: string, payload?: any) {
  if (!isEnabled()) return
  buffer.push({
    level,
    event,
    payload: payload ?? null,
    url: urlPath(),
    client_id: CLIENT_ID,
    created_at: new Date().toISOString(),
  })
  if (buffer.length >= FLUSH_THRESHOLD) {
    flushNow()
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushNow, FLUSH_INTERVAL_MS)
  }
}

async function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  if (buffer.length === 0) return
  const batch = buffer
  buffer = []
  try {
    const supabase = createClient()
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null
    const rows = batch.map(e => ({
      ...e,
      user_id: userId,
      campaign_id: campaignId,
      user_agent: ua,
    }))
    await supabase.from('debug_log').insert(rows)
  } catch {
    // Swallowed. debug_log failures must not cascade into the app.
    // Drop the batch — logging is best-effort.
  }
}

export function setDebugContext(opts: { userId?: string | null; campaignId?: string | null }) {
  if (opts.userId !== undefined) userId = opts.userId
  if (opts.campaignId !== undefined) campaignId = opts.campaignId
}

export const dlog = {
  info: (event: string, payload?: any) => pushEntry('info', event, payload),
  warn: (event: string, payload?: any) => pushEntry('warn', event, payload),
  error: (event: string, payload?: any) => pushEntry('error', event, payload),
  perf: (event: string, ms: number, payload?: any) => pushEntry('perf', event, { ms, ...(payload ?? {}) }),
}

function stripUrl(u: string): string {
  return u.replace(/[?&]apikey=[^&]+/, '').slice(0, 300)
}

function isDebugLogUrl(u: string): boolean {
  return /\/rest\/v1\/debug_log\b/.test(u)
}

export function installDebugLog() {
  if (installed || typeof window === 'undefined') return
  installed = true

  // Resolve current user once. Re-resolved on auth events via setDebugContext
  // calls from the app.
  getCachedAuth()
    .then(({ user }) => { if (user) userId = user.id })
    .catch(() => {})

  // Global error handlers
  try {
    window.addEventListener('error', (e: ErrorEvent) => {
      try {
        dlog.error('window.onerror', {
          message: e.message,
          filename: e.filename,
          line: e.lineno,
          col: e.colno,
          stack: e.error?.stack?.slice(0, 1000) ?? null,
        })
      } catch {}
    })
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      try {
        const reason = e.reason
        dlog.error('unhandledrejection', {
          reason: typeof reason === 'object' ? (reason?.message ?? String(reason)) : String(reason),
          stack: reason?.stack?.slice(0, 1000) ?? null,
        })
      } catch {}
    })
  } catch {}

  // Fetch wrapper — capture 5xx, slow, and thrown requests.
  // CAREFUL: we MUST NOT log the debug_log endpoint itself, and we MUST
  // NOT throw from this wrapper (would break every fetch in the app).
  try {
    const origFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      const url = typeof input === 'string'
        ? input
        : (input as Request)?.url ?? String(input)
      const isSelf = isDebugLogUrl(url)
      try {
        const res = await origFetch(input as any, init)
        if (isSelf) return res
        const dur = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start)
        if (!res.ok && res.status >= 500) {
          let body: string | null = null
          try {
            const cloned = res.clone()
            body = (await cloned.text()).slice(0, 500)
          } catch {}
          dlog.error('fetch_5xx', {
            url: stripUrl(url),
            status: res.status,
            duration_ms: dur,
            body,
          })
        } else if (dur > 5000) {
          dlog.warn('fetch_slow', {
            url: stripUrl(url),
            status: res.status,
            duration_ms: dur,
          })
        }
        return res
      } catch (err: any) {
        if (!isSelf) {
          const dur = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start)
          dlog.error('fetch_throw', {
            url: stripUrl(url),
            duration_ms: dur,
            message: err?.message ?? String(err),
          })
        }
        throw err
      }
    }
  } catch {}

  // Page-load navigation timing — fire ~1s after mount so the entry has
  // settled values for loadEventEnd / domContentLoadedEventEnd.
  try {
    setTimeout(() => {
      try {
        if (typeof performance === 'undefined' || !performance.getEntriesByType) return
        const nav = performance.getEntriesByType('navigation')[0] as any
        if (!nav) return
        dlog.perf('page_load', Math.round(nav.duration ?? 0), {
          ttfb: Math.round((nav.responseStart ?? 0) - (nav.requestStart ?? 0)),
          dom_content_loaded: Math.round(nav.domContentLoadedEventEnd ?? 0),
          load_event: Math.round(nav.loadEventEnd ?? 0),
          type: nav.type ?? null,
        })
      } catch {}
    }, 1500)
  } catch {}

  // Flush on tab close. sendBeacon would be more reliable but supabase-js
  // doesn't support it; the sync flush below at least gets a try.
  try {
    window.addEventListener('beforeunload', () => {
      try { flushNow() } catch {}
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        try { flushNow() } catch {}
      }
    })
  } catch {}
}
