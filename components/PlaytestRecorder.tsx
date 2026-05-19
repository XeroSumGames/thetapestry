'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getCachedAuth } from '../lib/auth-cache'
import { createClient } from '../lib/supabase-browser'
import { record, downloadDump, getRecorder, startPeriodicFlush, flushAllNow } from '../lib/playtest-recorder'

// Warns we never want in the dump — already filtered from the console by the
// head script in app/layout.tsx, but our recorder runs upstream of that
// filter so we need to mirror its rules. Keep this list tight and exact.
const BENIGN_WARN_SUBSTRINGS = [
  'Realtime send() is automatically falling back to REST API',
]

// Mounts once in app/layout.tsx. Initializes the global recorder state,
// wires DOM listeners (click, error, rejection, console.error/warn),
// and binds hotkeys: Ctrl+Shift+L = dump, Ctrl+Shift+M = mark moment,
// Ctrl+Shift+P = peek last 20 events in console.

function describeTarget(el: Element | null): Record<string, unknown> {
  if (!el) return { tag: null }
  const tag = el.tagName.toLowerCase()
  const id = el.id || null
  const cls = (el.getAttribute('class') || '').slice(0, 120) || null
  const aria = el.getAttribute('aria-label') || null
  const role = el.getAttribute('role') || null
  // Walk up to find the nearest "actionable" ancestor for context.
  const button = el.closest('button')
  const link = el.closest('a')
  const buttonText = button?.textContent?.trim().slice(0, 80) || null
  const linkHref = link?.getAttribute('href') || null
  // Don't capture text from input/textarea — could contain PII.
  let text: string | null = null
  if (tag !== 'input' && tag !== 'textarea') {
    text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) || null
  }
  return { tag, id, cls, aria, role, text, button_text: buttonText, link_href: linkHref }
}

export default function PlaytestRecorder() {
  const pathname = usePathname()
  const initRef = useRef(false)
  // Mirrors the recorder's `enabled` flag so we can hide the corner dot
  // when this tab is out-of-scope. Defaults to `null` ("config not yet
  // resolved") so the dot is hidden during the brief fetch window.
  const [enabledUI, setEnabledUI] = useState<boolean | null>(null)

  // One-time init: install the global state, listeners, console wrappers.
  useEffect(() => {
    if (initRef.current) return
    if (typeof window === 'undefined') return
    initRef.current = true

    const sessionId = (() => {
      try { return localStorage.getItem('tapestry_session_id') || crypto.randomUUID() } catch { return 'no-storage' }
    })()

    window.__tapestryRecorder = {
      buffer: [],
      startedAt: Date.now(),
      userId: null,
      userEmail: null,
      sessionId,
      pathname: window.location.pathname,
      // Tab-local gate (2026-05-15 rewrite): each tab starts OFF.
      // The only way to start capture is for that tab's Record
      // button click. No DB config, no realtime sync, no global
      // override. Previous "optimistic-on + DB gate" model coupled
      // every tab to a shared flag; players reported the GM's
      // button firing for them. Per Xero's spec, every user has
      // their own button that controls only their tab.
      enabled: false,
    }

    // Resolve user identity in the background; events recorded before this
    // resolves still get logged, just without user info on those entries
    // (the dump's meta block updates once auth is known).
    const applyUser = (user: { id: string; email?: string | null } | null) => {
      const r = getRecorder()
      if (!r) return
      if (user) {
        r.userId = user.id
        r.userEmail = user.email ?? null
      } else {
        r.userId = null
        r.userEmail = null
      }
    }
    getCachedAuth().then(({ user }) => applyUser(user ?? null)).catch(() => {})

    // Periodic flush so a browser crash mid-session loses <=60s of
    // context instead of the whole session. Idempotent —
    // startPeriodicFlush no-ops if a timer is already running.
    startPeriodicFlush()

    // Tab-local recorder state listener. When this tab's Record button
    // flips the lib's enabled flag, setEnabled fires a
    // 'tapestry-recorder-changed' window event - we mirror it into
    // enabledUI so the corner dot shows/hides. No DB config, no
    // realtime subscription, no cross-tab propagation. (Previous
    // PlaytestRecorder fetched playtest_recorder_config + subscribed
    // to it via realtime; that coupled every tab to a global flag and
    // caused the "GM Record button fires for every player" bug.
    // Removed 2026-05-15.)
    const onRecorderChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail.enabled === 'boolean') setEnabledUI(detail.enabled)
    }
    window.addEventListener('tapestry-recorder-changed', onRecorderChanged)
    // Initial sync from the lib's flag (false by default per the
    // __tapestryRecorder init above).
    setEnabledUI(!!getRecorder()?.enabled)

    // Subscribe to auth-state changes so dumps after a fresh sign-in
    // are tagged with the user - fixes the always-`anon` filename
    // problem when the recorder mounts on /login before the user has
    // signed in. No recorder-gate side effects here anymore.
    let authSub: { unsubscribe: () => void } | null = null
    try {
      const supabase = createClient()
      const { data } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { id: string; email?: string | null } | null } | null) => {
        applyUser(session?.user ?? null)
      })
      authSub = data.subscription
    } catch {}

    // ── Click capture (event delegation, capture phase, passive) ──────────
    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target as Element | null
        record('click', {
          ...describeTarget(target),
          x: e.clientX,
          y: e.clientY,
          button: e.button,
          path: window.location.pathname,
        })
      } catch {}
    }
    document.addEventListener('click', onClick, { capture: true, passive: true })

    // ── Window errors ─────────────────────────────────────────────────────
    const onError = (e: ErrorEvent) => {
      record('error', {
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack ? String(e.error.stack).slice(0, 2000) : null,
        path: window.location.pathname,
      })
    }
    window.addEventListener('error', onError)

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason
      record('rejection', {
        message: reason?.message ?? String(reason),
        stack: reason?.stack ? String(reason.stack).slice(0, 2000) : null,
        path: window.location.pathname,
      })
    }
    window.addEventListener('unhandledrejection', onRejection)

    // beforeunload: full flush to localStorage so close-tab / refresh /
    // nav-away loses ≤1 event instead of up to PERIODIC_FLUSH_MS (60s)
    // of trailing context. No-ops when capture is OFF.
    const onBeforeUnload = () => { try { flushAllNow() } catch {} }
    window.addEventListener('beforeunload', onBeforeUnload)

    // ── console.error / console.warn pass-through capture ────────────────
    // Cap the deep-cloned snapshot of each arg at ~10 KB so a stray
    // console.error(giantState) can't stall the main thread or balloon
    // the buffer.
    const MAX_ARG_BYTES = 10_000
    const captureArg = (a: unknown): unknown => {
      if (a instanceof Error) return { message: a.message, stack: a.stack?.slice(0, 1500) }
      if (typeof a !== 'object' || a === null) return String(a)
      try {
        const json = JSON.stringify(a)
        if (json.length > MAX_ARG_BYTES) {
          return { _truncated: true, size: json.length, preview: json.slice(0, MAX_ARG_BYTES) + '…' }
        }
        return JSON.parse(json)
      } catch {
        return String(a)
      }
    }
    const origError = console.error
    const origWarn = console.warn
    console.error = function(...args: unknown[]) {
      try {
        record('console-error', { args: args.map(captureArg), path: window.location.pathname })
      } catch {}
      return origError.apply(console, args)
    }
    console.warn = function(...args: unknown[]) {
      try {
        const isBenign = typeof args[0] === 'string' &&
          BENIGN_WARN_SUBSTRINGS.some(s => (args[0] as string).indexOf(s) !== -1)
        if (!isBenign) {
          record('console-warn', { args: args.map(captureArg), path: window.location.pathname })
        }
      } catch {}
      return origWarn.apply(console, args)
    }

    // ── Hotkeys ──────────────────────────────────────────────────────────
    // Capture the *original* console.log so our hotkey feedback messages
    // aren't suppressed by the head-script log filter.
    const origLog = console.log
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return
      const k = e.key.toLowerCase()
      if (k === 'l') {
        e.preventDefault()
        const name = downloadDump()
        origLog.call(console, `[playtest] dumped → ${name}`)
      } else if (k === 'm') {
        e.preventDefault()
        const label = window.prompt('Mark this moment — what happened?')
        if (label) {
          record('mark', { label, path: window.location.pathname })
          origLog.call(console, `[playtest] mark: ${label}`)
        }
      } else if (k === 'p') {
        e.preventDefault()
        const r = getRecorder()
        if (r) origLog.call(console, '[playtest] last 20:', r.buffer.slice(-20))
      }
    }
    window.addEventListener('keydown', onKey)

    // ── Expose helpers for ad-hoc use from devtools / app code ───────────
    window.__tapestryMark = (label: string, data?: Record<string, unknown>) => {
      record('mark', { label, ...(data || {}), path: window.location.pathname })
    }
    window.__tapestryDump = () => { downloadDump() }
    window.__tapestryRecord = record
  }, [])

  // Route changes — captured separately so they update on every nav.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const r = getRecorder()
    if (!r) return
    const prev = r.pathname
    r.pathname = pathname
    record('route', { from: prev, to: pathname })
  }, [pathname])

  // Don't render anything when the gate hasn't resolved yet, or when the
  // recorder is gated off for this user. The listeners stay installed
  // (they're cheap and harmless when record() short-circuits), but the
  // dot is the visible UX signal — no point showing it if nothing's
  // being captured.
  if (enabledUI !== true) return null

  return (
    <div
      aria-hidden
      title="Playtest recorder · Ctrl+Shift+L dump · Ctrl+Shift+M mark · Ctrl+Shift+P peek"
      style={{
        position: 'fixed',
        right: 6,
        bottom: 6,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#c33',
        boxShadow: '0 0 4px #c33',
        zIndex: 99999,
        pointerEvents: 'none',
        opacity: 0.6,
      }}
    />
  )
}
