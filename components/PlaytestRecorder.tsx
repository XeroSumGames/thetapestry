'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getCachedAuth } from '../lib/auth-cache'
import { record, downloadDump, getRecorder } from '../lib/playtest-recorder'

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
    }

    // Resolve user identity in the background; events recorded before this
    // resolves still get logged, just without user info on those entries
    // (the dump's meta block updates once auth is known).
    getCachedAuth().then(({ user }) => {
      const r = getRecorder()
      if (r && user) {
        r.userId = user.id
        r.userEmail = user.email ?? null
      }
    }).catch(() => {})

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

    // ── console.error / console.warn pass-through capture ────────────────
    const origError = console.error
    const origWarn = console.warn
    console.error = function(...args: unknown[]) {
      try {
        record('console-error', {
          args: args.map(a => {
            if (a instanceof Error) return { message: a.message, stack: a.stack?.slice(0, 1500) }
            if (typeof a === 'object') { try { return JSON.parse(JSON.stringify(a)) } catch { return String(a) } }
            return String(a)
          }),
          path: window.location.pathname,
        })
      } catch {}
      return origError.apply(console, args)
    }
    console.warn = function(...args: unknown[]) {
      try {
        record('console-warn', {
          args: args.map(a => typeof a === 'object' ? (() => { try { return JSON.parse(JSON.stringify(a)) } catch { return String(a) } })() : String(a)),
          path: window.location.pathname,
        })
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
