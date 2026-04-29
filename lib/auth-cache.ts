// Module-level auth cache for hot-path event logging.
//
// VisitLogger fires `logVisit(pathname)` on every Next.js navigation,
// and `logVisit` (plus `logEvent`, `logFirstEvent`, `trackGhostConversion`)
// each used to call `supabase.auth.getUser()` + `supabase.auth.getSession()`.
// Both calls take the auth Web Lock; getUser() additionally hits
// `GET /auth/v1/user` over the network to validate the JWT. None of those
// validations are necessary for logging — we just need to know "who, if
// anyone, is signed in." Repeating the work on every soft-nav was a
// measurable nav-latency tax and a contributor to the lock-contention
// issues the user has hit before.
//
// This cache:
//   - Stores the most recent { user, session } from getSession() for a
//     short TTL. getSession() reads from localStorage so it's cheap, but
//     it still acquires the lock; deduping under a TTL eliminates the
//     repeat work between same-tab navigations.
//   - Dedupes in-flight calls — if two callers race during a cold start,
//     they share one Promise instead of stacking lock waits.
//   - Subscribes to onAuthStateChange and invalidates the cache on real
//     auth events (SIGNED_IN, SIGNED_OUT, USER_UPDATED, TOKEN_REFRESHED)
//     so we never serve stale identity after a sign-in / sign-out.
//
// NOT a replacement for getUser() in security-critical paths. getUser()
// validates the JWT against the server; callers that need that hard
// guarantee (RLS-write paths, role checks) should keep calling it
// directly. logVisit / logEvent etc. are best-effort telemetry where a
// 30-second-stale identity is harmless.

import type { Session, User } from '@supabase/supabase-js'
import { createClient } from './supabase-browser'

type AuthSnapshot = { user: User | null; session: Session | null }

let snapshot: { value: AuthSnapshot; fetchedAt: number } | null = null
let inFlight: Promise<AuthSnapshot> | null = null
let listenerAttached = false

const TTL_MS = 30_000

function attachAuthListener() {
  if (listenerAttached || typeof window === 'undefined') return
  listenerAttached = true
  try {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event: string) => {
      // Any real identity transition invalidates the cache. TOKEN_REFRESHED
      // doesn't change identity but the session object changes, so refresh
      // too to keep callers' tokens current.
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED' ||
        event === 'TOKEN_REFRESHED'
      ) {
        snapshot = null
      }
    })
  } catch {
    // If the client can't be created (server build, no env), silently
    // skip — getCachedAuth callers will fall through to a direct fetch.
  }
}

export async function getCachedAuth(): Promise<AuthSnapshot> {
  attachAuthListener()
  const now = Date.now()
  if (snapshot && now - snapshot.fetchedAt < TTL_MS) return snapshot.value
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const value: AuthSnapshot = { user: session?.user ?? null, session: session ?? null }
      snapshot = { value, fetchedAt: Date.now() }
      return value
    } catch {
      return { user: null, session: null }
    }
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

// Test / cold-start helper. The auth listener auto-invalidates on real
// transitions, so callers should rarely need this — but exposing it lets
// callers force a re-read after operations they know mutated identity.
export function invalidateAuthCache() {
  snapshot = null
}
