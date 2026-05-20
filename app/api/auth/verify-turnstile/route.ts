import { NextRequest, NextResponse } from 'next/server'

// In-memory IP token bucket. Per-instance, not distributed — a serverless
// function with N warm instances can leak ~N × LIMIT requests through
// before any one instance enforces. Sufficient for "stop one client looping"
// abuse, NOT for distributed abuse. Upgrade to a KV-backed limiter
// (@vercel/kv + @upstash/ratelimit) before paid-signups open.
const LIMIT_PER_MIN = 30
const WINDOW_MS = 60_000
const MAX_BODY_BYTES = 4096

type Bucket = { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()

function rateLimit(ip: string): { ok: boolean; retryAfterMs: number } {
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

// Periodically sweep stale buckets so the map doesn't grow unbounded under
// IP rotation. Runs at most once per request; O(n) over active IPs.
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
  sweepStaleBuckets()

  const ip = getClientIp(req)
  const limit = rateLimit(ip)
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
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
    // Secret not configured — fail open in dev so local signup still works.
    // In production this env var must be set in Vercel.
    if (process.env.NODE_ENV !== 'production') return NextResponse.json({ ok: true })
    return NextResponse.json({ ok: false, error: 'turnstile not configured' }, { status: 500 })
  }

  const body = new URLSearchParams({ secret, response: token })
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()
  if (data.success) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: false, error: 'challenge failed' }, { status: 403 })
}
