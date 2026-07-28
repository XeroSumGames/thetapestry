import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

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
// unauthenticated, so a flood of probes could amplify into a flood of DB
// round-trips. Two guards:
//   1. In-memory success cache (10s TTL per instance) collapses per-instance load.
//   2. Upstash sliding-window rate limit (10 req/min per IP) closes the HTTP
//      flood surface across all instances (security-audit 2026-07-28 fix).
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

// 10 req/min per IP is generous for any legitimate uptime monitor (most ping
// every 1-5 min) while blocking flood attempts. Fails open if Upstash is
// misconfigured - the DB cache is the primary amplification guard.
let _ratelimit: Ratelimit | null | undefined
function getRatelimit(): Ratelimit | null {
  if (_ratelimit !== undefined) return _ratelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) { _ratelimit = null; return null }
  _ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'health',
    analytics: false,
  })
  return _ratelimit
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export async function GET(req: NextRequest) {
  const start = Date.now()

  const limiter = getRatelimit()
  if (limiter) {
    try {
      const { success, reset } = await limiter.limit(getClientIp(req))
      if (!success) {
        const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
        return NextResponse.json(
          { status: 'degraded', checks: { db: 'skip' }, ms: 0, ts: new Date().toISOString() },
          { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
        )
      }
    } catch {
      // Upstash error - fail open, DB cache is still in place.
    }
  }

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
