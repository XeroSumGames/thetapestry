import { createClient } from './supabase-browser'
import { getCachedAuth } from './auth-cache'

const SESSION_KEY = 'tapestry_session_id'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Emails of accounts whose visits should never be logged or email-alerted.
// Primarily the project owner — keeps the inbox clean while they're browsing
// their own site. Ghost-mode visits from these users are suppressed via a
// localStorage flag (set once in devtools: localStorage.tapestry_no_log = '1').
const OWNER_EMAILS = ['xerosumgames@gmail.com', 'xerosumstudio@gmail.com']

export async function logVisit(page: string) {
  if (typeof window === 'undefined') return
  // Device-level opt-out for ghost browsing — set in devtools once per device
  // (`localStorage.setItem('tapestry_no_log', '1')`) and reload. Survives
  // logout and stays local to that browser profile.
  if (localStorage.getItem('tapestry_no_log') === '1') return
  try {
    // Cached read — getCachedAuth() returns a 30s-fresh snapshot of the
    // session + user from getSession(). Replaces the prior pair of
    // getUser() + getSession() calls per nav (each acquired the auth
    // Web Lock, getUser() also did a server round-trip). For visit
    // logging we don't need the JWT-validate guarantee getUser provides.
    const { user, session } = await getCachedAuth()
    // Auth-level opt-out — if the signed-in user is an owner account, skip
    // logging entirely so their visits never hit the table or the email hook.
    if (user?.email && OWNER_EMAILS.includes(user.email.toLowerCase())) return

    const rawIP = getCookie('geo_ip') || null
    const ip_hash = rawIP ? await hashIP(rawIP) : null
    const geo = {
      country_code: getCookie('geo_country') || null,
      region: getCookie('geo_region') || null,
      city: getCookie('geo_city') || null,
      latitude: getCookie('geo_lat') ? parseFloat(getCookie('geo_lat')!) : null,
      longitude: getCookie('geo_lng') ? parseFloat(getCookie('geo_lng')!) : null,
      ip_hash,
    }

    try {
      // Fire-and-forget: don't await, the response doesn't matter to the caller.
      // Use keepalive so the request survives even if the page navigates away.
      fetch(`${SUPABASE_URL}/functions/v1/log-visit`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          session_id: getSessionId(),
          page,
          referrer: document.referrer || null,
          user_id: user?.id ?? null,
          ...geo,
        }),
      }).catch(() => {})
    } catch {
      const supabase = createClient()
      await supabase.from('visitor_logs').insert({
        session_id: getSessionId(),
        page,
        referrer: document.referrer || null,
        is_ghost: !user,
        user_id: user?.id ?? null,
        ...geo,
      })
    }
  } catch {}
}

export async function logEvent(eventType: string, metadata?: object) {
  if (typeof window === 'undefined') return
  try {
    const { user } = await getCachedAuth()
    if (!user) return
    const supabase = createClient()
    await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: eventType,
      metadata: metadata ?? null,
    })
  } catch {}
}

/**
 * Call once after a ghost signs up / logs in for the first time.
 * Links their anonymous visitor_logs to the new user_id and logs a conversion event.
 */
export async function trackGhostConversion() {
  if (typeof window === 'undefined') return
  try {
    const { user } = await getCachedAuth()
    if (!user) return
    const supabase = createClient()

    const sessionId = getSessionId()

    const { data: existing } = await supabase
      .from('user_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_type', 'ghost_converted')
      .limit(1)
    if (existing && existing.length > 0) return

    const { count } = await supabase
      .from('visitor_logs')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('is_ghost', true)

    await supabase
      .from('visitor_logs')
      .update({ user_id: user.id })
      .eq('session_id', sessionId)
      .is('user_id', null)

    await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: 'ghost_converted',
      metadata: { session_id: sessionId, ghost_pages_visited: count ?? 0 },
    })
  } catch {}
}

export async function logFirstEvent(eventType: string, metadata?: object) {
  if (typeof window === 'undefined') return
  try {
    const { user } = await getCachedAuth()
    if (!user) return
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('user_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_type', eventType)
      .limit(1)
    if (existing && existing.length > 0) return
    await supabase.from('user_events').insert({
      user_id: user.id,
      event_type: eventType,
      metadata: metadata ?? null,
    })
  } catch {}
}
