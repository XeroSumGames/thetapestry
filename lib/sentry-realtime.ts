// Wraps Supabase realtime handlers (broadcast + postgres_changes) so a
// thrown exception inside one handler doesn't silently break the rest of
// the dispatch chain. Errors are logged to console + reported to Sentry
// with the event name as a tag so we can filter by which broadcast or
// table event blew up. Pre-launch audit R6 (tasks/pre-launch-audit-2026-05-17.md).
//
// Also tees every inbound event into the playtest recorder (event name /
// table / kind only - NO payload bodies, per the hard privacy invariant).

import * as Sentry from '@sentry/nextjs'
import { record } from './playtest-recorder'

type AnyHandler = (msg: any) => void | Promise<void>

function wrap(kind: 'broadcast' | 'pg', name: string, fn: AnyHandler): AnyHandler {
  return async (msg: any) => {
    // Tee into playtest recorder: event name/kind only, never the payload.
    record('realtime', {
      direction: 'in',
      transport: kind === 'broadcast' ? 'broadcast' : 'postgres_changes',
      event: name,
    })
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
