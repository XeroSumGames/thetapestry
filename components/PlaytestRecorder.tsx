'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getCachedAuth } from '../lib/auth-cache'
import { createClient } from '../lib/supabase-browser'
import { record, downloadDump, getRecorder, startPeriodicFlush, flushAllNow } from '../lib/playtest-recorder'

// Warns we never want in the dump - already filtered from the console by the
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
  // Don't capture text from input/textarea - could contain PII.
  let text: string | null = null
  if (tag !== 'input' && tag !== 'textarea') {
    text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) || null
  }

  // Item 4: climb up ~6 parents for game-object IDs and nearest interactive.
  let nearest_interactive: string | null = null
  let game_object: { kind: string; id: string } | null = null
  let on_map = false
  let map_layer: string | null = null
  let node: Element | null = el
  for (let i = 0; i < 6 && node; i++) {
    const tokenId = node.getAttribute('data-token-id')
    const pinId = node.getAttribute('data-pin-id')
    const npcId = node.getAttribute('data-npc-id')
    if (tokenId && !game_object) game_object = { kind: 'token', id: tokenId }
    else if (pinId && !game_object) game_object = { kind: 'pin', id: pinId }
    else if (npcId && !game_object) game_object = { kind: 'npc', id: npcId }

    if (!on_map) {
      const nc = node.getAttribute('class') ?? ''
      const nt = node.tagName.toLowerCase()
      if (nc.includes('leaflet') || nt === 'canvas') {
        on_map = true
        map_layer = nc.split(' ').find(c => c.startsWith('leaflet-') || c === 'canvas') ?? null
      }
    }

    if (!nearest_interactive) {
      const nt = node.tagName.toLowerCase()
      const testid = node.getAttribute('data-testid')
      const nr = node.getAttribute('role')
      if (nt === 'button' || nt === 'a' || testid || (nr && nr !== 'presentation')) {
        const nt2 = node.tagName.toLowerCase()
        const label = testid ? `[testid=${testid}]` : nr ? `[role=${nr}]` : null
        const btxt = nt2 !== 'input' && nt2 !== 'textarea'
          ? (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
          : null
        nearest_interactive = [nt2, label, btxt ? `"${btxt}"` : null].filter(Boolean).join('')
      }
    }
    node = node.parentElement
  }

  return {
    tag, id, cls, aria, role, text, button_text: buttonText, link_href: linkHref,
    nearest_interactive,
    ...(game_object ? { game_object } : {}),
    ...(on_map ? { on_map: true, map_layer } : {}),
  }
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
    // context instead of the whole session. Idempotent -
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

    // ── Item 1: Network / RPC capture ────────────────────────────────────
    // Wrap fetch once to intercept Supabase calls. Filters to the Supabase
    // URL only. Records method/path/status/duration/table-or-rpc. NEVER
    // logs request or response bodies - only the PostgREST error envelope's
    // code+message on 4xx/5xx. Calls over 1500ms are flagged `slow:true`.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const origFetch = window.fetch
    if (supabaseUrl) {
      window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input
          : input instanceof URL ? input.href
          : (input as Request).url
        if (!url.startsWith(supabaseUrl)) return origFetch.call(window, input, init)

        let parsedPath = ''
        let table_or_rpc: string | null = null
        try {
          const pu = new URL(url)
          // Strip query values to param-names-only (privacy)
          const paramKeys = [...pu.searchParams.keys()]
          parsedPath = pu.pathname + (paramKeys.length ? `?[${paramKeys.join(',')}]` : '')
          // Parse /rest/v1/<table> or /rest/v1/rpc/<fn> or /auth/...
          const parts = pu.pathname.split('/').filter(Boolean)
          const rpcIdx = parts.indexOf('rpc')
          const v1Idx = parts.indexOf('v1')
          if (rpcIdx >= 0 && parts[rpcIdx + 1]) table_or_rpc = `rpc/${parts[rpcIdx + 1]}`
          else if (v1Idx >= 0 && parts[v1Idx + 1]) table_or_rpc = parts[v1Idx + 1]
          else if (pu.pathname.includes('/auth/')) table_or_rpc = 'auth'
        } catch {}

        const method = ((init?.method ?? 'GET') as string).toUpperCase()
        const t0 = Date.now()
        try {
          const res = await origFetch.call(window, input, init)
          const duration_ms = Date.now() - t0
          let error_code: string | null = null
          let error_message: string | null = null
          if (!res.ok && res.status >= 400) {
            try {
              const body = await res.clone().json()
              if (body && typeof body === 'object') {
                error_code = (body as any).code ?? null
                error_message = (body as any).message ? String((body as any).message).slice(0, 200) : null
              }
            } catch {}
          }
          record('net', {
            method, url_path: parsedPath, status: res.status, ok: res.ok,
            duration_ms, table_or_rpc,
            ...(error_code != null ? { error_code } : {}),
            ...(error_message != null ? { error_message } : {}),
            ...(duration_ms > 1500 ? { slow: true } : {}),
          })
          return res
        } catch (fetchErr: unknown) {
          const duration_ms = Date.now() - t0
          record('net', {
            method, url_path: parsedPath, status: 0, ok: false, duration_ms, table_or_rpc,
            error_message: fetchErr instanceof Error ? fetchErr.message.slice(0, 200) : 'network error',
            ...(duration_ms > 1500 ? { slow: true } : {}),
          })
          throw fetchErr
        }
      }
    }

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
    //
    // 2026-06-12: ALSO auto-trigger downloadDump on close while the
    // recorder is armed + has events. Xero lost a playtest's logs
    // because the tab closed without an explicit Stop click. The blob
    // download is created + clicked synchronously inside the unload
    // window so Chrome honors it; Firefox / Safari may block - in
    // which case the localStorage flush still preserves the buffer
    // for recovery. Refresh / in-app nav-away ALSO trigger the
    // download (browsers can't distinguish from close); the cost is
    // a stray download file the user deletes, which is much cheaper
    // than losing a session.
    const onBeforeUnload = () => {
      try {
        flushAllNow()
        const r = getRecorder()
        if (r?.enabled && r.buffer.length > 0) {
          downloadDump()
        }
      } catch {}
    }
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
        if (!getRecorder()?.enabled) {
          alert('Recorder is off - mark not saved. Click the ⏺ button in the sidebar to start recording.')
          return
        }
        const label = window.prompt('Mark this moment - what happened?')
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

  // Route changes - captured separately so they update on every nav.
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
  // dot is the visible UX signal - no point showing it if nothing's
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
