import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ ok: false, error: 'missing token' }, { status: 400 })

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
