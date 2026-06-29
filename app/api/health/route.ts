import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Health-check endpoint for uptime monitors (Pingdom, StatusCake, etc).
// Pre-launch audit R5. Returns 200 when the app + Supabase DB are both
// reachable, 503 if the DB ping fails. No auth required - uptime monitors
// don't authenticate.
//
// The DB ping is a HEAD reachability probe against `profiles` with the anon
// key. RLS scopes it to 0 visible rows for an unauthed caller, but the round
// trip still proves the DB is reachable, authorizing, and responding. No
// count is computed (the value was never read) - head + limit(1) keeps it O(1).
//
// DB-amplification guard (stability-audit 2026-06-29, M-1): this endpoint is
// unauthenticated and unthrottled, so a flood of probes could amplify into a
// flood of DB round-trips. A short in-memory success cache collapses that to
// at most one DB ping per warm instance per CACHE_TTL_MS. ONLY success is
// cached - a failing or over-TTL probe always re-checks the DB, so a real
// outage still surfaces on the very next poll. The success response shape is
// byte-identical cached vs live, so uptime monitors see no contract change.
//
// Output shape:
//   { status: 'ok' | 'degraded', checks: { db: 'ok' | 'fail' }, ms: <int>, ts: <ISO> }
//
// Do NOT include user-identifiable data, environment names, version
// strings, or anything that would be useful to an attacker probing
// for fingerprints. Boolean health only.

export const dynamic = 'force-dynamic'  // never cache
export const revalidate = 0

const CACHE_TTL_MS = 10_000
let cachedOkAt = 0  // epoch ms of the last successful DB ping (0 = none yet)

export async function GET() {
  const start = Date.now()

  // Serve a recent healthy result without touching the DB.
  if (cachedOkAt && start - cachedOkAt < CACHE_TTL_MS) {
    return NextResponse.json({ status: 'ok', checks: { db: 'ok' }, ms: Date.now() - start, ts: new Date().toISOString() })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json(
      { status: 'degraded', checks: { db: 'fail' }, ms: Date.now() - start, ts: new Date().toISOString() },
      { status: 503 },
    )
  }
  const supabase = createClient(url, anon)
  try {
    const { error } = await supabase.from('profiles').select('id', { head: true }).limit(1)
    const ms = Date.now() - start
    if (error) {
      return NextResponse.json(
        { status: 'degraded', checks: { db: 'fail' }, ms, ts: new Date().toISOString() },
        { status: 503 },
      )
    }
    cachedOkAt = Date.now()
    return NextResponse.json({ status: 'ok', checks: { db: 'ok' }, ms, ts: new Date().toISOString() })
  } catch {
    return NextResponse.json(
      { status: 'degraded', checks: { db: 'fail' }, ms: Date.now() - start, ts: new Date().toISOString() },
      { status: 503 },
    )
  }
}
