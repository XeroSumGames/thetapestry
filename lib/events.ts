import { createClient } from './supabase-browser'

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

export async function logVisit(page: string) {
  if (typeof window === 'undefined') return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Read Vercel geo data from cookies (set by middleware)
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

  // Try Edge Function for IP capture, fall back to direct insert
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${SUPABASE_URL}/functions/v1/log-visit`, {
      method: 'POST',
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
    })
  } catch {
    // Fallback: direct insert without IP
    await supabase.from('visitor_logs').insert({
      session_id: getSessionId(),
      page,
      referrer: document.referrer || null,
      is_ghost: !user,
      user_id: user?.id ?? null,
      ...geo,
    })
  }
}

export async function logEvent(eventType: string, metadata?: object) {
  if (typeof window === 'undefined') return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_events').insert({
    user_id: user.id,
    event_type: eventType,
    metadata: metadata ?? null,
  })
}

/**
 * Call once after a ghost signs up / logs in for the first time.
 * Links their anonymous visitor_logs to the new user_id and logs a conversion event.
 */
export async function trackGhostConversion() {
  if (typeof window === 'undefined') return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const sessionId = getSessionId()

  // Check if already tracked
  const { data: existing } = await supabase
    .from('user_events')
    .select('id')
    .eq('user_id', user.id)
    .eq('event_type', 'ghost_converted')
    .limit(1)
  if (existing && existing.length > 0) return

  // Count ghost pages visited before conversion
  const { count } = await supabase
    .from('visitor_logs')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('is_ghost', true)

  // Backfill user_id on ghost visit rows
  await supabase
    .from('visitor_logs')
    .update({ user_id: user.id })
    .eq('session_id', sessionId)
    .is('user_id', null)

  // Log conversion event
  await supabase.from('user_events').insert({
    user_id: user.id,
    event_type: 'ghost_converted',
    metadata: { session_id: sessionId, ghost_pages_visited: count ?? 0 },
  })
}

export async function logFirstEvent(eventType: string, metadata?: object) {
  if (typeof window === 'undefined') return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
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
}
