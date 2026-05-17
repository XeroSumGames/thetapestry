import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Health-check endpoint for uptime monitors (Pingdom, StatusCake, etc).
// Pre-launch audit R5. Returns 200 when the app + Supabase DB are both
// reachable, 503 if the DB ping fails. No auth required — uptime monitors
// don't authenticate.
//
// The DB ping is a HEAD count against `profiles` with the anon key.
// RLS will scope the count to 0 for an unauthed caller, but the round
// trip still proves the DB is reachable and responding. Cost: one
// indexed count query, no row payload returned.
//
// Output shape:
//   { status: 'ok' | 'degraded', checks: { db: 'ok' | 'fail' }, ms: <int>, ts: <ISO> }
//
// Do NOT include user-identifiable data, environment names, version
// strings, or anything that would be useful to an attacker probing
// for fingerprints. Boolean health only.

export const dynamic = 'force-dynamic'  // never cache
export const revalidate = 0

export async function GET() {
  const start = Date.now()
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
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
    const ms = Date.now() - start
    if (error) {
      return NextResponse.json(
        { status: 'degraded', checks: { db: 'fail' }, ms, ts: new Date().toISOString() },
        { status: 503 },
      )
    }
    return NextResponse.json({ status: 'ok', checks: { db: 'ok' }, ms, ts: new Date().toISOString() })
  } catch {
    return NextResponse.json(
      { status: 'degraded', checks: { db: 'fail' }, ms: Date.now() - start, ts: new Date().toISOString() },
      { status: 503 },
    )
  }
}
