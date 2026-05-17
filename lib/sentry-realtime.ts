// Wraps Supabase realtime handlers (broadcast + postgres_changes) so a
// thrown exception inside one handler doesn't silently break the rest of
// the dispatch chain. Errors are logged to console + reported to Sentry
// with the event name as a tag so we can filter by which broadcast or
// table event blew up. Pre-launch audit R6 (tasks/pre-launch-audit-2026-05-17.md).

import * as Sentry from '@sentry/nextjs'

type AnyHandler = (msg: any) => void | Promise<void>

function wrap(kind: 'broadcast' | 'pg', name: string, fn: AnyHandler): AnyHandler {
  return async (msg: any) => {
    try {
      await fn(msg)
    } catch (err) {
      // Keep the console line so local dev sees breakage immediately.
      console.error(`[${kind}:${name}] handler threw`, err)
      try {
        Sentry.captureException(err, {
          tags: { realtime_kind: kind, realtime_event: name },
          extra: { msg },
        })
      } catch {
        // Sentry init may be incomplete on cold start; swallow.
      }
    }
  }
}

export function wrapBroadcast(name: string, fn: AnyHandler): AnyHandler {
  return wrap('broadcast', name, fn)
}

export function wrapDbChange(name: string, fn: AnyHandler): AnyHandler {
  return wrap('pg', name, fn)
}
