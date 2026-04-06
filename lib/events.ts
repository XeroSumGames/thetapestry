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

export async function logVisit(page: string) {
  if (typeof window === 'undefined') return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
