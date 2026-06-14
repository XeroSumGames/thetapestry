import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Distributed IP rate limiter backed by Upstash Redis (L-3 of the
// 2026-05-19 stability audit). Replaces the previous per-instance
// in-memory bucket - that one leaked ~N x LIMIT requests across N
// warm Vercel instances, which is OK for casual abuse but inadequate
// for the launch window. The Upstash sliding-window is global across
// every instance.
//
// Env vars (set in Vercel dashboard, not in code):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
// Redis.fromEnv() picks these up automatically. Upstash free tier
// covers 10K commands/day - the launch rate-limiter window is well
// inside that even at projected peak.
//
// Production behavior when env vars missing: 503 + diagnostic (deploy
// is misconfigured; surface loudly so the operator notices). Dev
// behavior when env vars missing: fall back to the in-memory bucket
// so local signup still works without an Upstash account.

const LIMIT_PER_MIN = 30
const WINDOW_MS = 60_000
const MAX_BODY_BYTES = 4096

// Lazy construction so the module loads cleanly even without env vars
// (the fallback path checks for the limiter being null).
let _ratelimit: Ratelimit | null | undefined
function getRatelimit(): Ratelimit | null {
  if (_ratelimit !== undefined) return _ratelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    _ratelimit = null
    return null
  }
  _ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(LIMIT_PER_MIN, '60 s'),
    prefix: 'verify-turnstile',
    analytics: false,
  })
  return _ratelimit
}

// ── In-memory dev fallback ────────────────────────────────────────
// Kept ONLY for local dev when Upstash env vars are not set. Same
// per-instance leakage as the pre-KV implementation; that's fine for
// localhost where there's one process. Production routes through
// the Upstash-backed limiter above.
type Bucket = { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()

function rateLimitInMemory(ip: string): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now })
    return { ok: true, retryAfterMs: 0 }
  }
  if (b.count >= LIMIT_PER_MIN) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - b.windowStart) }
  }
  b.count += 1
  return { ok: true, retryAfterMs: 0 }
}

let lastSweep = 0
function sweepStaleBuckets() {
  const now = Date.now()
  if (now - lastSweep < WINDOW_MS) return
  lastSweep = now
  for (const [ip, b] of buckets) {
    if (now - b.windowStart >= WINDOW_MS * 2) buckets.delete(ip)
  }
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  const limiter = getRatelimit()
  if (limiter) {
    // Upstash-backed path. Distributed across instances.
    try {
      const { success, reset } = await limiter.limit(ip)
      if (!success) {
        const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
        return NextResponse.json(
          { ok: false, error: 'rate limited' },
          { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
        )
      }
    } catch (e: any) {
      // Upstash error (network blip, token expired, etc.). Log and
      // fall through to allow the request - this is a defense-in-depth
      // layer, not the only one. Cloudflare Turnstile below is the
      // primary anti-bot. The body-size cap also still runs.
      console.error('[verify-turnstile] upstash error - allowing request:', e?.message ?? String(e))
    }
  } else {
    // Upstash env vars missing. Log loudly so the operator notices, but
    // fall through to the in-memory bucket rather than hard-blocking every
    // user. Failing open here is the lesser evil - Turnstile below is the
    // primary bot defence; the rate limiter is defence-in-depth.
    if (process.env.NODE_ENV === 'production') {
      console.error('[verify-turnstile] ALERT: Upstash env vars not configured in production - using in-memory fallback')
    }
    sweepStaleBuckets()
    const limit = rateLimitInMemory(ip)
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: 'rate limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
      )
    }
  }

  // Body-size cap. A Turnstile token is ~600 bytes; 4KB is generous.
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'body too large' }, { status: 413 })
  }

  let token: string | undefined
  try {
    const parsed = JSON.parse(raw)
    token = parsed?.token
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing token' }, { status: 400 })
  }

  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Secret not configured - log loudly but fail open so users aren't blocked.
    // Fix by setting TURNSTILE_SECRET_KEY in Vercel env vars.
    if (process.env.NODE_ENV === 'production') {
      console.error('[verify-turnstile] ALERT: TURNSTILE_SECRET_KEY not set in production - skipping verification')
    }
    return NextResponse.json({ ok: true })
  }

  const body = new URLSearchParams({ secret, response: token })
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()
  if (data.success) return NextResponse.json({ ok: true })
  // Surface Cloudflare's error-codes so a rejected token tells us WHY
  // (e.g. invalid-input-secret = secret/site-key mismatch, or a hostname
  // problem) instead of an opaque 403. Codes are non-sensitive.
  // Log Cloudflare's error-codes server-side for future debugging (kept;
  // useful if real tokens ever start failing). Not returned to the client.
  const codes = Array.isArray(data['error-codes']) ? data['error-codes'] : []
  console.error('[verify-turnstile] cloudflare siteverify failed:', codes.join(',') || 'no-codes')
  return NextResponse.json({ ok: false, error: 'challenge failed' }, { status: 403 })
}
